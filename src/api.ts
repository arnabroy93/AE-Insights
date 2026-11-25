
import {
  FilterParams,
  FilterOptions,
  OperationalSettings,
  UploadRecord,
  AuditLogEntry,
  SourceRow,
  RestorePoint,
  DatabaseStatus,
  MysqlConfigInput,
  ConnectionTestResult,
  MigrationResult,
  ScheduledVsConductedRecord,
  SchedulingAnalyticsData,
  RunningBatchAnalyticsData,
  ClosedBatchAnalyticsData,
  SlotReplacementRecord,
  ChallengeRecord,
  LivePresenceData,
  EXPECTED_SCHEMA_COLUMNS,
  SCHEDULED_VS_CONDUCTED_COLUMNS,
  SLOT_REPLACEMENT_COLUMNS,
  CHALLENGES_COLUMNS,
  EXCEPTION_APPROVAL_COLUMNS,
} from './types';
import {
  parseExcelFileLocally,
  transformAndValidateLocally,
} from './utils/excelProcessor';

function isPayloadTooLargeError(status: number, text: string): boolean {
  if (status === 413) return true;
  const lower = (text || '').toLowerCase();
  return (
    lower.includes('413') ||
    lower.includes('request entity too large') ||
    lower.includes('payload too large') ||
    lower.includes('entity too large')
  );
}

/**
 * Splits an array of row objects into compact chunks bounded by both row count and serialized JSON byte length
 * so individual HTTP requests stay well below reverse-proxy limits (~90 KB per request).
 */
function splitIntoSafeChunks<T>(
  rows: T[],
  maxRowsPerChunk = 150,
  maxBytesPerChunk = 90 * 1024
): T[][] {
  if (!rows || rows.length === 0) return [];
  const chunks: T[][] = [];
  let currentChunk: T[] = [];
  let currentBytes = 2; // '[]'

  for (const row of rows) {
    let rowBytes = 256;
    try {
      rowBytes = JSON.stringify(row).length + 1;
    } catch {
      rowBytes = 512;
    }

    if (
      currentChunk.length > 0 &&
      (currentChunk.length >= maxRowsPerChunk || currentBytes + rowBytes > maxBytesPerChunk)
    ) {
      chunks.push(currentChunk);
      currentChunk = [];
      currentBytes = 2;
    }

    currentChunk.push(row);
    currentBytes += rowBytes;
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3,
  onRetry?: (attempt: number, reason: string) => void
): Promise<Response> {
  let lastError: any = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) {
        const clone = res.clone();
        const text = await clone.text();
        if (text.toLowerCase().includes('<title>starting server') || text.toLowerCase().includes('starting server...')) {
          if (attempt < maxRetries) {
            if (onRetry) onRetry(attempt, 'Server initializing, retrying batch...');
            await new Promise((r) => setTimeout(r, 1500 * attempt));
            continue;
          }
        }
        return res;
      }
      if (res.status >= 500 || res.status === 429) {
        if (attempt < maxRetries) {
          if (onRetry) onRetry(attempt, `Server status ${res.status}, retrying...`);
          await new Promise((r) => setTimeout(r, 1500 * attempt));
          continue;
        }
      }
      return res;
    } catch (err: any) {
      lastError = err;
      if (attempt < maxRetries) {
        if (onRetry) onRetry(attempt, `Connection glitch (${err.message || 'Network error'}), retrying...`);
        await new Promise((r) => setTimeout(r, 1500 * attempt));
      }
    }
  }
  throw lastError || new Error(`Network request failed after ${maxRetries} attempts`);
}

async function parseSafeJson(res: Response): Promise<any> {
  const text = await res.text();
  if (text.trim().startsWith('<') || text.toLowerCase().includes('<!doctype') || text.toLowerCase().includes('<html')) {
    if (isPayloadTooLargeError(res.status, text)) {
      throw new Error('PAYLOAD_TOO_LARGE');
    }
    const titleMatch = text.match(/<title[^>]*>([^<]+)<\/title>/i);
    const serverMsg = titleMatch && titleMatch[1] ? titleMatch[1].trim() : `Server returned an HTML error page (${res.status} ${res.statusText})`;
    throw new Error(serverMsg);
  }
  try {
    return JSON.parse(text);
  } catch (err: any) {
    throw new Error(`Failed to parse response JSON: ${text.slice(0, 150)}`);
  }
}

function buildQueryString(filters: FilterParams, extra: Record<string, any> = {}): string {
  const params = new URLSearchParams();
  Object.entries({ ...filters, ...extra }).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '' && value !== 'ALL') {
      if (Array.isArray(value)) {
        if (value.length > 0) {
          params.append(key, value.join(','));
        }
      } else {
        params.append(key, String(value));
      }
    }
  });
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

async function extractErrorMessage(res: Response, defaultMessage: string): Promise<string> {
  try {
    const text = await res.text();
    if (isPayloadTooLargeError(res.status, text)) {
      return 'PAYLOAD_TOO_LARGE';
    }
    try {
      const json = JSON.parse(text);
      return json.error || json.message || defaultMessage;
    } catch {
      if (text.includes('<html') || text.includes('<body') || text.includes('<!DOCTYPE')) {
        const titleMatch = text.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleMatch && titleMatch[1]) {
          return `${defaultMessage}: ${titleMatch[1].trim()}`;
        }
        const stripped = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        return stripped.length > 0 ? `${defaultMessage}: ${stripped.substring(0, 150)}` : defaultMessage;
      }
      return text && text.trim().length > 0 ? text.trim().substring(0, 150) : defaultMessage;
    }
  } catch {
    return defaultMessage;
  }
}

/**
 * Posts a batch of rows to a chunk endpoint. If the proxy/server ever returns HTTP 413 (Payload Too Large),
 * automatically splits the batch in half and recursively uploads smaller sub-batches so the upload never fails.
 */
async function postChunkWithAutoSplit<T>(
  url: string,
  chunkRows: T[],
  isFinalChunk: boolean,
  buildPayload: (subRows: T[], subIsFinal: boolean) => Record<string, any>,
  onRetry?: (attempt: number, reason: string) => void
): Promise<any[]> {
  const res = await fetchWithRetry(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildPayload(chunkRows, isFinalChunk)),
    },
    3,
    onRetry
  );

  if (!res.ok) {
    const errorMsg = await extractErrorMessage(res, `Batch upload failed (${res.status})`);
    if (errorMsg === 'PAYLOAD_TOO_LARGE' && chunkRows.length > 1) {
      const mid = Math.ceil(chunkRows.length / 2);
      const firstHalf = chunkRows.slice(0, mid);
      const secondHalf = chunkRows.slice(mid);
      const res1 = await postChunkWithAutoSplit(url, firstHalf, false, buildPayload, onRetry);
      const res2 = await postChunkWithAutoSplit(url, secondHalf, isFinalChunk, buildPayload, onRetry);
      return [...res1, ...res2];
    }
    throw new Error(errorMsg === 'PAYLOAD_TOO_LARGE' ? 'A single record exceeded the server maximum request size.' : errorMsg);
  }

  try {
    const data = await parseSafeJson(res);
    return [data];
  } catch (err: any) {
    if (err?.message === 'PAYLOAD_TOO_LARGE' && chunkRows.length > 1) {
      const mid = Math.ceil(chunkRows.length / 2);
      const firstHalf = chunkRows.slice(0, mid);
      const secondHalf = chunkRows.slice(mid);
      const res1 = await postChunkWithAutoSplit(url, firstHalf, false, buildPayload, onRetry);
      const res2 = await postChunkWithAutoSplit(url, secondHalf, isFinalChunk, buildPayload, onRetry);
      return [...res1, ...res2];
    }
    throw err;
  }
}

export const api = {
  getFilterOptions: async (): Promise<FilterOptions> => {
    const res = await fetch('/api/filters/options');
    if (!res.ok) throw new Error('Failed to fetch filter options');
    return parseSafeJson(res);
  },

  getExecutiveAnalytics: async (filters: FilterParams) => {
    const res = await fetch(`/api/analytics/executive${buildQueryString(filters)}`);
    if (!res.ok) throw new Error('Failed to fetch executive analytics');
    return parseSafeJson(res);
  },

  getDropoutAnalytics: async (filters: FilterParams) => {
    const res = await fetch(`/api/analytics/dropouts${buildQueryString(filters)}`);
    if (!res.ok) throw new Error('Failed to fetch dropout analytics');
    return parseSafeJson(res);
  },

  getExceptionAnalytics: async (filters: FilterParams) => {
    const res = await fetch(`/api/analytics/exceptions${buildQueryString(filters)}`);
    if (!res.ok) throw new Error('Failed to fetch exception analytics');
    return parseSafeJson(res);
  },

  getBatchClosureAnalytics: async (filters: FilterParams) => {
    const res = await fetch(`/api/analytics/batch-closure${buildQueryString(filters)}`);
    if (!res.ok) throw new Error('Failed to fetch batch closure analytics');
    return parseSafeJson(res);
  },

  getRunningBatchAnalytics: async (filters: FilterParams): Promise<RunningBatchAnalyticsData> => {
    const res = await fetch(`/api/analytics/running-batch${buildQueryString(filters)}`);
    if (!res.ok) throw new Error('Failed to fetch running batch analytics');
    return parseSafeJson(res);
  },

  getClosedBatchAnalytics: async (filters: FilterParams): Promise<ClosedBatchAnalyticsData> => {
    const res = await fetch(`/api/analytics/closed-batch${buildQueryString(filters)}`);
    if (!res.ok) throw new Error('Failed to fetch closed batch analytics');
    return parseSafeJson(res);
  },

  getTrainedAnalytics: async (filters: FilterParams) => {
    const res = await fetch(`/api/analytics/trained${buildQueryString(filters)}`);
    if (!res.ok) throw new Error('Failed to fetch trained analytics');
    return parseSafeJson(res);
  },

  getSchedulingAnalytics: async (filters: FilterParams): Promise<SchedulingAnalyticsData> => {
    const res = await fetch(`/api/analytics/scheduling${buildQueryString(filters)}`);
    if (!res.ok) throw new Error('Failed to fetch scheduling analytics');
    return parseSafeJson(res);
  },

  getBatchSessionDetails: async (batchCode: string, fmEmailId?: string): Promise<any[]> => {
    const qs = fmEmailId ? `?fmEmailId=${encodeURIComponent(fmEmailId)}` : '';
    const res = await fetch(`/api/analytics/scheduling/batch/${encodeURIComponent(batchCode)}${qs}`);
    if (!res.ok) throw new Error('Failed to fetch batch session details');
    return parseSafeJson(res);
  },

  getFacultyAnalytics: async (filters: FilterParams) => {
    const res = await fetch(`/api/analytics/faculty${buildQueryString(filters)}`);
    if (!res.ok) throw new Error('Failed to fetch faculty analytics');
    return parseSafeJson(res);
  },

  getStudentValidationAnalytics: async (filters: FilterParams) => {
    const res = await fetch(`/api/analytics/validation${buildQueryString(filters)}`);
    if (!res.ok) throw new Error('Failed to fetch validation analytics');
    return parseSafeJson(res);
  },

  getAttendanceAnalytics: async (filters: FilterParams) => {
    const res = await fetch(`/api/analytics/attendance${buildQueryString(filters)}`);
    if (!res.ok) throw new Error('Failed to fetch attendance analytics');
    return parseSafeJson(res);
  },

  getPlacementAnalytics: async (filters: FilterParams) => {
    const res = await fetch(`/api/analytics/placements${buildQueryString(filters)}`);
    if (!res.ok) throw new Error('Failed to fetch placement analytics');
    return parseSafeJson(res);
  },

  getCenterAnalytics: async (filters: FilterParams) => {
    const res = await fetch(`/api/analytics/centers${buildQueryString(filters)}`);
    if (!res.ok) throw new Error('Failed to fetch center analytics');
    return parseSafeJson(res);
  },

  getAeAnalytics: async (filters: FilterParams) => {
    const res = await fetch(`/api/analytics/aes${buildQueryString(filters)}`);
    if (!res.ok) throw new Error('Failed to fetch AE analytics');
    return parseSafeJson(res);
  },

  getRecords: async (filters: FilterParams, page = 1, pageSize = 50, search = '', sortColumn = 'id', sortDirection = 'DESC') => {
    const qs = buildQueryString(filters, { page, pageSize, search, sortColumn, sortDirection });
    const res = await fetch(`/api/records${qs}`);
    if (!res.ok) throw new Error('Failed to fetch records');
    return parseSafeJson(res);
  },

  getDataQuality: async () => {
    const res = await fetch('/api/data-quality');
    if (!res.ok) throw new Error('Failed to fetch data quality metrics');
    return parseSafeJson(res);
  },

  getUploadHistory: async (): Promise<UploadRecord[]> => {
    const res = await fetch('/api/upload/history');
    if (!res.ok) throw new Error('Failed to fetch upload history');
    return parseSafeJson(res);
  },

  getAuditLogs: async (limit = 100): Promise<AuditLogEntry[]> => {
    const res = await fetch(`/api/audit-logs?limit=${limit}`);
    if (!res.ok) throw new Error('Failed to fetch audit logs');
    return parseSafeJson(res);
  },

  getSettings: async (): Promise<OperationalSettings> => {
    const res = await fetch('/api/settings');
    if (!res.ok) throw new Error('Failed to fetch settings');
    return parseSafeJson(res);
  },

  updateSettings: async (settings: Partial<OperationalSettings>): Promise<OperationalSettings> => {
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    if (!res.ok) throw new Error('Failed to update settings');
    return parseSafeJson(res);
  },

  askAi: async (query: string, filters: FilterParams = {}) => {
    const res = await fetch('/api/ai/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, filters }),
    });
    if (!res.ok) throw new Error('Failed to get AI insight');
    return parseSafeJson(res);
  },

  analyzeUploadFile: async (file: File) => {
    try {
      return await parseExcelFileLocally(file, EXPECTED_SCHEMA_COLUMNS);
    } catch {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload/analyze', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const err = await parseSafeJson(res).catch(() => ({ error: 'Unable to process the uploaded file. Please verify file format.' }));
        throw new Error(err.error || 'Failed to analyze upload file');
      }
      return parseSafeJson(res);
    }
  },

  validateUploadFile: async (file: File, sheetName: string, mapping: Record<string, string>) => {
    try {
      const localAnalysis = await parseExcelFileLocally(file, EXPECTED_SCHEMA_COLUMNS, sheetName);
      if (localAnalysis.rawRows) {
        const localVal = transformAndValidateLocally(localAnalysis.rawRows, localAnalysis.detectedHeaders, mapping, 'master');
        return {
          validation: localVal.validation,
          previewTransformedRows: localVal.transformedRows.slice(0, 10),
          transformedRows: localVal.transformedRows,
        };
      }
    } catch {
      // Fall back to server endpoint if local validation fails
    }
    const formData = new FormData();
    formData.append('file', file);
    formData.append('sheetName', sheetName);
    formData.append('mapping', JSON.stringify(mapping));
    const res = await fetch('/api/upload/validate', {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await parseSafeJson(res).catch(() => ({ error: 'Validation failed' }));
      throw new Error(err.error || 'Validation failed');
    }
    return parseSafeJson(res);
  },

  commitUploadFile: async (file: File, sheetName: string, mapping: Record<string, string>, duplicateMode: string, uploadedBy: string) => {
    const localAnalysis = await parseExcelFileLocally(file, EXPECTED_SCHEMA_COLUMNS, sheetName);
    const localVal = transformAndValidateLocally(localAnalysis.rawRows || [], localAnalysis.detectedHeaders, mapping, 'master');
    return api.directImportRecordsChunked({
      fileName: file.name,
      sheetName: sheetName || localAnalysis.selectedSheet,
      uploadedBy,
      transformedRows: localVal.transformedRows,
      duplicateMode,
      validCount: localVal.validation.validRowsCount,
      invalidCount: localVal.validation.invalidRowsCount,
      duplicateCount: localVal.validation.duplicateCount,
    });
  },

  directImportRecords: async (payload: {
    fileName: string;
    sheetName: string;
    uploadedBy: string;
    transformedRows: any[];
    duplicateMode: string;
    validCount?: number;
    invalidCount?: number;
    duplicateCount?: number;
  }) => {
    // Always route through byte-safe chunked import to prevent 413 Payload Too Large errors
    return api.directImportRecordsChunked(payload);
  },

  directImportRecordsChunked: async (
    payload: {
      fileName: string;
      sheetName: string;
      uploadedBy: string;
      transformedRows: any[];
      duplicateMode: string;
      validCount?: number;
      invalidCount?: number;
      duplicateCount?: number;
    },
    onProgress?: (progressText: string, percent: number) => void
  ) => {
    const uploadId = 'UPL-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
    const rows = payload.transformedRows || [];
    const chunks = splitIntoSafeChunks(rows, 150, 90 * 1024);
    const totalChunks = chunks.length || 1;

    let finalUploadRecord: any = null;
    let stepCounter = 0;

    for (let i = 0; i < chunks.length; i++) {
      const chunkRows = chunks[i];
      const isFinal = i === chunks.length - 1;

      const percent = Math.round(((i + 1) / totalChunks) * 100);
      if (onProgress) {
        onProgress(`Importing batch ${i + 1} of ${totalChunks} (${percent}%)...`, percent);
      }

      const responses = await postChunkWithAutoSplit(
        '/api/upload/direct-import-chunk',
        chunkRows,
        isFinal,
        (subRows, subIsFinal) => {
          const currentIdx = stepCounter++;
          return {
            uploadId,
            fileName: payload.fileName,
            sheetName: payload.sheetName,
            uploadedBy: payload.uploadedBy,
            chunkRows: subRows,
            chunkIndex: currentIdx,
            totalChunks: Math.max(totalChunks, currentIdx + 1),
            totalRows: rows.length,
            duplicateMode: payload.duplicateMode,
            validCount: payload.validCount || rows.length,
            invalidCount: payload.invalidCount || 0,
            duplicateCount: payload.duplicateCount || 0,
            isFinal: subIsFinal,
          };
        },
        (attempt, reason) => {
          if (onProgress) {
            onProgress(`Batch ${i + 1} of ${totalChunks}: ${reason}`, percent);
          }
        }
      );

      for (const data of responses) {
        if (data?.upload) {
          finalUploadRecord = data.upload;
        }
      }
    }

    return {
      success: true,
      upload: finalUploadRecord || {
        id: uploadId,
        file_name: payload.fileName,
        sheet_name: payload.sheetName,
        uploaded_by: payload.uploadedBy,
        uploaded_at: new Date().toISOString(),
        row_count: rows.length,
        valid_row_count: payload.validCount || rows.length,
        invalid_row_count: payload.invalidCount || 0,
        duplicate_count: payload.duplicateCount || 0,
        processing_status: 'completed',
      },
    };
  },

  importExceptionApprovalReport: async (
    payload: {
      fileName: string;
      uploadedBy?: string;
      transformedRows: any[];
    },
    onProgress?: (progressText: string, percent: number) => void
  ) => {
    const rows = payload.transformedRows || [];
    const chunks = splitIntoSafeChunks(rows, 150, 90 * 1024);
    const totalChunks = chunks.length || 1;
    let stepCounter = 0;

    const aggregatedSummary = {
      approvedCount: 0,
      specialApprovalCount: 0,
      rejectedCount: 0,
      recordsUpdated: 0,
      totalProcessed: rows.length,
    };

    for (let i = 0; i < chunks.length; i++) {
      const chunkRows = chunks[i];
      const isFinal = i === chunks.length - 1;

      const percent = Math.round(((i + 1) / totalChunks) * 100);
      if (onProgress) {
        onProgress(`Importing exception batch ${i + 1} of ${totalChunks} (${percent}%)...`, percent);
      }

      const responses = await postChunkWithAutoSplit(
        '/api/upload/exception-approval-chunk',
        chunkRows,
        isFinal,
        (subRows, subIsFinal) => {
          const currentIdx = stepCounter++;
          return {
            fileName: payload.fileName,
            uploadedBy: payload.uploadedBy || 'arnab.roy@anudip.org',
            chunkRows: subRows,
            chunkIndex: currentIdx,
            totalChunks: Math.max(totalChunks, currentIdx + 1),
            isFinal: subIsFinal,
          };
        },
        (attempt, reason) => {
          if (onProgress) {
            onProgress(`Exception batch ${i + 1} of ${totalChunks}: ${reason}`, percent);
          }
        }
      );

      for (const data of responses) {
        if (data?.summary) {
          aggregatedSummary.approvedCount += data.summary.approvedCount || 0;
          aggregatedSummary.specialApprovalCount += data.summary.specialApprovalCount || 0;
          aggregatedSummary.rejectedCount += data.summary.rejectedCount || 0;
          aggregatedSummary.recordsUpdated += data.summary.recordsUpdated || 0;
        }
      }
    }

    return { success: true, fileName: payload.fileName, summary: aggregatedSummary };
  },

  uploadExceptionApprovalFile: async (
    file: File,
    uploadedBy?: string,
    onProgress?: (progressText: string, percent: number) => void
  ) => {
    const localAnalysis = await parseExcelFileLocally(file, EXCEPTION_APPROVAL_COLUMNS);
    const localVal = transformAndValidateLocally(
      localAnalysis.rawRows || [],
      localAnalysis.detectedHeaders,
      localAnalysis.suggestedMapping,
      'exception_approval'
    );
    return api.importExceptionApprovalReport(
      {
        fileName: file.name,
        uploadedBy: uploadedBy || 'arnab.roy@anudip.org',
        transformedRows: localVal.transformedRows,
      },
      onProgress
    );
  },

  getExceptionApprovalReports: async () => {
    const res = await fetch('/api/exception-approval-reports');
    if (!res.ok) {
      const errorMessage = await extractErrorMessage(res, 'Failed to fetch exception approval reports');
      throw new Error(errorMessage);
    }
    return parseSafeJson(res);
  },

  importScheduledVsConductedReport: async (
    payload: {
      fileName: string;
      uploadedBy?: string;
      transformedRows: any[];
    },
    onProgress?: (progressText: string, percent: number) => void
  ) => {
    const rows = payload.transformedRows || [];
    const chunks = splitIntoSafeChunks(rows, 200, 90 * 1024);
    const totalChunks = chunks.length || 1;
    const uploadId = 'SVC-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();

    let totalInserted = 0;
    let stepCounter = 0;

    for (let i = 0; i < chunks.length; i++) {
      const chunkRows = chunks[i];
      const isFinal = i === chunks.length - 1;
      const percent = Math.round(((i + 1) / totalChunks) * 100);

      if (onProgress) {
        onProgress(`Saving scheduled vs conducted batch ${i + 1} of ${totalChunks} (${percent}%)...`, percent);
      }

      const responses = await postChunkWithAutoSplit(
        '/api/upload/scheduled-vs-conducted-chunk',
        chunkRows,
        isFinal,
        (subRows, subIsFinal) => {
          const currentIdx = stepCounter++;
          return {
            fileName: payload.fileName,
            uploadedBy: payload.uploadedBy || 'arnab.roy@anudip.org',
            chunkRows: subRows,
            chunkIndex: currentIdx,
            totalChunks: Math.max(totalChunks, currentIdx + 1),
            isFinal: subIsFinal,
            uploadId,
          };
        }
      );

      for (const data of responses) {
        totalInserted += Number(data?.summary?.recordsInserted ?? 0);
      }
    }

    return {
      success: true,
      fileName: payload.fileName,
      summary: {
        recordsInserted: totalInserted || rows.length,
        uploadId,
      },
    };
  },

  uploadScheduledVsConductedFile: async (
    file: File,
    uploadedBy?: string,
    onProgress?: (progressText: string, percent: number) => void
  ) => {
    const localAnalysis = await parseExcelFileLocally(file, SCHEDULED_VS_CONDUCTED_COLUMNS);
    const localVal = transformAndValidateLocally(
      localAnalysis.rawRows || [],
      localAnalysis.detectedHeaders,
      localAnalysis.suggestedMapping,
      'scheduled_vs_conducted'
    );
    return api.importScheduledVsConductedReport(
      {
        fileName: file.name,
        uploadedBy: uploadedBy || 'arnab.roy@anudip.org',
        transformedRows: localVal.transformedRows,
      },
      onProgress
    );
  },

  getScheduledVsConducted: async (
    limit = 50,
    offset = 0,
    search = '',
    filters: FilterParams = {}
  ): Promise<{ rows: ScheduledVsConductedRecord[]; totalCount: number }> => {
    const qs = buildQueryString(filters, { limit, offset, search });
    const res = await fetch(`/api/scheduled-vs-conducted${qs}`);
    if (!res.ok) {
      const errorMessage = await extractErrorMessage(res, 'Failed to fetch scheduled vs conducted records');
      throw new Error(errorMessage);
    }
    return parseSafeJson(res);
  },

  importSlotReplacementReport: async (
    payload: {
      fileName: string;
      uploadedBy?: string;
      transformedRows: any[];
    },
    onProgress?: (progressText: string, percent: number) => void
  ) => {
    const rows = payload.transformedRows || [];
    const chunks = splitIntoSafeChunks(rows, 200, 90 * 1024);
    const totalChunks = chunks.length || 1;
    const uploadId = 'SR-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();

    let totalInserted = 0;
    let stepCounter = 0;

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const isFinal = i === chunks.length - 1;
      const percent = Math.round(((i + 1) / totalChunks) * 100);
      if (onProgress) {
        onProgress(`Uploading Slot Replacement batch ${i + 1} of ${totalChunks} (${percent}%)...`, percent);
      }

      const responses = await postChunkWithAutoSplit(
        '/api/upload/slot-replacement-chunk',
        chunk,
        isFinal,
        (subRows, subIsFinal) => {
          const currentIdx = stepCounter++;
          return {
            fileName: payload.fileName,
            uploadedBy: payload.uploadedBy || 'arnab.roy@anudip.org',
            chunkRows: subRows,
            chunkIndex: currentIdx,
            totalChunks: Math.max(totalChunks, currentIdx + 1),
            isFinal: subIsFinal,
            uploadId,
          };
        }
      );

      for (const data of responses) {
        totalInserted += Number(data?.summary?.recordsInserted ?? 0);
      }
    }

    return {
      success: true,
      fileName: payload.fileName,
      summary: {
        recordsInserted: totalInserted || rows.length,
        uploadId,
      },
    };
  },

  uploadSlotReplacementFile: async (
    file: File,
    uploadedBy?: string,
    onProgress?: (progressText: string, percent: number) => void
  ) => {
    const localAnalysis = await parseExcelFileLocally(file, SLOT_REPLACEMENT_COLUMNS);
    const localVal = transformAndValidateLocally(
      localAnalysis.rawRows || [],
      localAnalysis.detectedHeaders,
      localAnalysis.suggestedMapping,
      'slot_replacement'
    );
    return api.importSlotReplacementReport(
      {
        fileName: file.name,
        uploadedBy: uploadedBy || 'arnab.roy@anudip.org',
        transformedRows: localVal.transformedRows,
      },
      onProgress
    );
  },

  getSlotReplacements: async (limit = 50, offset = 0, search = ''): Promise<{ rows: SlotReplacementRecord[]; totalCount: number }> => {
    const params = new URLSearchParams();
    if (limit) params.append('limit', String(limit));
    if (offset) params.append('offset', String(offset));
    if (search) params.append('search', search);
    const res = await fetch(`/api/slot-replacement?${params.toString()}`);
    if (!res.ok) {
      const errorMessage = await extractErrorMessage(res, 'Failed to fetch slot replacement records');
      throw new Error(errorMessage);
    }
    return parseSafeJson(res);
  },

  importChallengesReport: async (
    payload: {
      fileName: string;
      uploadedBy?: string;
      transformedRows: any[];
    },
    onProgress?: (progressText: string, percent: number) => void
  ) => {
    const rows = payload.transformedRows || [];
    const chunks = splitIntoSafeChunks(rows, 150, 90 * 1024);
    const totalChunks = chunks.length || 1;
    const uploadId = 'CH-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();

    let totalValid = 0;
    let stepCounter = 0;

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const isFinal = i === chunks.length - 1;
      const percent = Math.round(((i + 1) / totalChunks) * 100);
      if (onProgress) {
        onProgress(`Uploading RM Challenges batch ${i + 1} of ${totalChunks} (${percent}%)...`, percent);
      }

      const responses = await postChunkWithAutoSplit(
        '/api/upload/challenges-chunk',
        chunk,
        isFinal,
        (subRows, subIsFinal) => {
          const currentIdx = stepCounter++;
          return {
            fileName: payload.fileName,
            uploadedBy: payload.uploadedBy || 'arnab.roy@anudip.org',
            chunkRows: subRows,
            chunkIndex: currentIdx,
            totalChunks: Math.max(totalChunks, currentIdx + 1),
            isFinal: subIsFinal,
            uploadId,
          };
        }
      );

      for (const data of responses) {
        totalValid += Number(data?.summary?.validCount ?? data?.summary?.totalRecords ?? 0);
      }
    }

    return {
      success: true,
      fileName: payload.fileName,
      summary: {
        validCount: totalValid || rows.length,
        totalRecords: rows.length,
        uploadId,
      },
    };
  },

  uploadChallengesFile: async (
    file: File,
    uploadedBy?: string,
    onProgress?: (progressText: string, percent: number) => void
  ) => {
    const localAnalysis = await parseExcelFileLocally(file, CHALLENGES_COLUMNS);
    const localVal = transformAndValidateLocally(
      localAnalysis.rawRows || [],
      localAnalysis.detectedHeaders,
      localAnalysis.suggestedMapping,
      'challenges'
    );
    return api.importChallengesReport(
      {
        fileName: file.name,
        uploadedBy: uploadedBy || 'arnab.roy@anudip.org',
        transformedRows: localVal.transformedRows,
      },
      onProgress
    );
  },

  getChallenges: async (limit = 50, offset = 0, search = ''): Promise<{ rows: ChallengeRecord[]; totalCount: number }> => {
    const params = new URLSearchParams();
    if (limit) params.append('limit', String(limit));
    if (offset) params.append('offset', String(offset));
    if (search) params.append('search', search);
    const res = await fetch(`/api/challenges?${params.toString()}`);
    if (!res.ok) {
      const errorMessage = await extractErrorMessage(res, 'Failed to fetch challenge records');
      throw new Error(errorMessage);
    }
    return parseSafeJson(res);
  },

  clearAllData: async (userEmail?: string) => {
    const res = await fetch('/api/data/clear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userEmail }),
    });
    if (!res.ok) throw new Error('Failed to clear data');
    return parseSafeJson(res);
  },

  seedSampleData: async (userEmail?: string) => {
    const res = await fetch('/api/data/seed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userEmail }),
    });
    if (!res.ok) throw new Error('Failed to seed sample data');
    return parseSafeJson(res);
  },

  getRestorePoints: async (): Promise<RestorePoint[]> => {
    const res = await fetch('/api/restore-points');
    if (!res.ok) throw new Error('Failed to fetch restore points');
    return parseSafeJson(res);
  },

  createRestorePoint: async (payload: {
    name?: string;
    description?: string;
    userEmail?: string;
    isBaseline?: boolean;
  }): Promise<{ success: boolean; point: RestorePoint }> => {
    const res = await fetch('/api/restore-points', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await parseSafeJson(res).catch(() => ({ error: 'Failed to create restore point' }));
      throw new Error(err.error || 'Failed to create restore point');
    }
    return parseSafeJson(res);
  },

  restoreFromPoint: async (id: string, userEmail?: string): Promise<{ success: boolean; restoredPoint: RestorePoint; recordCount: number }> => {
    const res = await fetch(`/api/restore-points/${id}/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userEmail }),
    });
    if (!res.ok) {
      const err = await parseSafeJson(res).catch(() => ({ error: 'Failed to restore database from restore point' }));
      throw new Error(err.error || 'Failed to restore database from restore point');
    }
    return parseSafeJson(res);
  },

  deleteRestorePoint: async (id: string, userEmail?: string): Promise<{ success: boolean }> => {
    const res = await fetch(`/api/restore-points/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userEmail }),
    });
    if (!res.ok) {
      const err = await parseSafeJson(res).catch(() => ({ error: 'Failed to delete restore point' }));
      throw new Error(err.error || 'Failed to delete restore point');
    }
    return parseSafeJson(res);
  },

  getRestorePointDownloadUrl: (id: string) => `/api/restore-points/${id}/download`,
  
  // Database Backend & MySQL Management
  getDatabaseStatus: async (): Promise<DatabaseStatus> => {
    const res = await fetch('/api/database/status');
    if (!res.ok) throw new Error('Failed to fetch database status');
    return parseSafeJson(res);
  },

  testMysqlConnection: async (config: Partial<MysqlConfigInput> = {}): Promise<ConnectionTestResult> => {
    const res = await fetch('/api/database/test-connection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    return parseSafeJson(res);
  },

  updateDatabaseConfig: async (config: MysqlConfigInput): Promise<{ success: boolean; message: string; activeEngine: string }> => {
    const res = await fetch('/api/database/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    if (!res.ok) {
      const err = await parseSafeJson(res).catch(() => ({ error: 'Failed to update database configuration' }));
      throw new Error(err.error || 'Failed to update database configuration');
    }
    return parseSafeJson(res);
  },

  switchDatabaseEngine: async (engine: 'sqlite' | 'mysql'): Promise<{ success: boolean; activeEngine: string }> => {
    const res = await fetch('/api/database/switch-engine', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ engine }),
    });
    if (!res.ok) {
      const err = await parseSafeJson(res).catch(() => ({ error: 'Failed to switch database engine' }));
      throw new Error(err.error || 'Failed to switch database engine');
    }
    return parseSafeJson(res);
  },

  migrateToMysql: async (): Promise<MigrationResult> => {
    const res = await fetch('/api/database/migrate-to-mysql', {
      method: 'POST',
    });
    if (!res.ok) {
      const err = await parseSafeJson(res).catch(() => ({ error: 'Failed to migrate data to MySQL' }));
      throw new Error(err.error || 'Failed to migrate data to MySQL');
    }
    return parseSafeJson(res);
  },

  syncFromMysql: async (): Promise<{ success: boolean; recordsSynced: number; message: string }> => {
    const res = await fetch('/api/database/sync-from-mysql', {
      method: 'POST',
    });
    if (!res.ok) {
      const err = await parseSafeJson(res).catch(() => ({ error: 'Failed to synchronize data from MySQL' }));
      throw new Error(err.error || 'Failed to synchronize data from MySQL');
    }
    return parseSafeJson(res);
  },

  getDatabaseSchema: async (): Promise<{ schema: string }> => {
    const res = await fetch('/api/database/schema');
    if (!res.ok) throw new Error('Failed to fetch database schema');
    return parseSafeJson(res);
  },

  exportChartRawExcel: async (payload: {
    module: 'trained' | 'dropout' | 'exception' | 'batch_closure' | 'scheduling' | 'running_batch' | 'closed_batch';
    chartType: string;
    chartTitle: string;
    filters: FilterParams;
    chartSummary?: any[];
  }): Promise<void> => {
    const res = await fetch('/api/export/chart-excel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errMsg = await extractErrorMessage(res, 'Failed to export chart raw data to Excel');
      throw new Error(errMsg);
    }
    const blob = await res.blob();
    const disposition = res.headers.get('Content-Disposition') || '';
    const match = disposition.match(/filename="?([^"]+)"?/i);
    const safeDefault = `${payload.chartTitle.replace(/[^a-zA-Z0-9_-]+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    const fileName = match && match[1] ? match[1] : safeDefault;

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  // Live Active Users & Browser Gmail Presence
  detectBrowserUser: async (): Promise<{
    email: string;
    userName: string;
    source: string;
    googleClientId?: string;
  }> => {
    const res = await fetch('/api/presence/detect-browser-user');
    if (!res.ok) throw new Error('Failed to detect browser user');
    return parseSafeJson(res);
  },

  sendPresenceHeartbeat: async (payload: {
    sessionId: string;
    email: string;
    userName: string;
    avatarUrl?: string | null;
    userRole: string;
    currentView: string;
    currentViewLabel: string;
    portalMode: string;
    browserInfo: string;
    deviceOs: string;
    hostOrigin: string;
    startedAt: number;
  }): Promise<LivePresenceData> => {
    const res = await fetch('/api/presence/heartbeat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to send presence heartbeat');
    return parseSafeJson(res);
  },

  getLiveActiveUsers: async (): Promise<LivePresenceData> => {
    const res = await fetch('/api/presence/active-users');
    if (!res.ok) throw new Error('Failed to fetch live active users');
    return parseSafeJson(res);
  },
};



