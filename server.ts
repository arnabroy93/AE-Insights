import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import {
  getDb,
  getFilterOptions,
  getExecutiveAnalytics,
  getDropoutAnalytics,
  getExceptionAnalytics,
  getBatchClosureAnalytics,
  getRunningBatchAnalytics,
  getClosedBatchAnalytics,
  getTrainedAnalytics,
  getFacultyAnalytics,
  getStudentValidationAnalytics,
  getAttendanceAnalytics,
  getPlacementAnalytics,
  getCenterAnalytics,
  getAeAnalytics,
  getRawRecords,
  getDataQualityMetrics,
  getSettings,
  updateSettings,
  getUploadHistory,
  getUploadHistoryAsync,
  getAuditLogs,
  logAudit,
  clearAllData,
  seedSampleData,
  processExceptionApprovalReportImport,
  getExceptionApprovalReports,
  getRestorePoints,
  createRestorePoint,
  restoreFromPoint,
  deleteRestorePoint,
  getRestorePointFilePath,
  syncMysqlToSqlite,
  insertScheduledVsConducted,
  getScheduledVsConducted,
  getSchedulingAnalytics,
  getBatchSessionDetails,
  insertSlotReplacement,
  getSlotReplacements,
  insertChallenges,
  getChallenges,
  exportChartRawDataWorkbook,
} from './server/db.ts';
import {
  getActiveEngine,
  setActiveEngine,
  getMysqlConfig,
  setMysqlConfig,
  testMysqlConnection,
  initMysqlTables,
  migrateSqliteToMysql,
  isMysqlConnected,
  queryMysql,
  upsertLiveUserPresence,
  markLiveUserOffline,
  getLiveActiveUsers,
} from './server/mysql.ts';
import fs from 'fs';
import {
  parseAndAnalyzeWorkbook,
  validateUploadedData,
  commitImport,
  commitImportChunk,
  generateTemplateWorkbook,
  generateExceptionApprovalTemplateWorkbook,
  generateScheduledVsConductedTemplateWorkbook,
  generateSlotReplacementTemplateWorkbook,
  generateChallengesTemplateWorkbook,
} from './server/importer.ts';
import * as XLSX from 'xlsx';
import { askAeInsight } from './server/ai.ts';
import type { FilterParams } from './server/types.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

function resolveServerPort(): number {
  const portArgIdx = process.argv.findIndex((arg) => arg === '--port' || arg === '-p');
  if (portArgIdx !== -1 && process.argv[portArgIdx + 1]) {
    const parsed = Number(process.argv[portArgIdx + 1]);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  const portEqArg = process.argv.find((arg) => arg.startsWith('--port='));
  if (portEqArg) {
    const parsed = Number(portEqArg.split('=')[1]);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  // Avoid colliding with AI Studio's Nginx reverse proxy on port 8080
  if (process.env.NGINX_PORT && process.env.PORT && String(process.env.NGINX_PORT) === String(process.env.PORT)) {
    const defaultPort = Number(process.env.DEFAULT_APP_PORT);
    return Number.isFinite(defaultPort) && defaultPort > 0 ? defaultPort : 3000;
  }
  const envPort = Number(process.env.PORT);
  return Number.isFinite(envPort) && envPort > 0 ? envPort : 3000;
}

const PORT = resolveServerPort();

process.on('uncaughtException', (err) => {
  console.error('[AE INSIGHT Uncaught Exception]:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[AE INSIGHT Unhandled Rejection]:', reason);
});

app.get(['/health', '/api/health'], (_req, res) => {
  res.status(200).json({ status: 'ok', port: PORT, timestamp: Date.now() });
});

// Direct forced-attachment download routes for standalone generated PDF report (not linked in portal UI)
const DIYA_REPORT_FILENAME = 'AE_INSIGHT_Diya_Only_RM_Analysis_01_25_Nov_2026.pdf';
function resolveDiyaReportPath(): string | null {
  const candidates = [
    path.join(__dirname, 'public', 'downloads', DIYA_REPORT_FILENAME),
    path.join(__dirname, 'dist', 'downloads', DIYA_REPORT_FILENAME),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

app.get(
  [`/downloads/${DIYA_REPORT_FILENAME}`, '/api/download-report/diya-nov-2026'],
  (_req, res) => {
    const filePath = resolveDiyaReportPath();
    if (!filePath) {
      return res.status(404).send('Report PDF not found.');
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${DIYA_REPORT_FILENAME}"`);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.sendFile(filePath);
  }
);

app.get('/downloads/diya-nov-2026', (_req, res) => {
  const filePath = resolveDiyaReportPath();
  if (!filePath) {
    return res.status(404).send('Report PDF not found.');
  }
  const sizeKb = Math.round(fs.statSync(filePath).size / 1024);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Download — ${DIYA_REPORT_FILENAME}</title>
  <style>
    body { margin:0; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; background:#0F172A; color:#F8FAFC; min-height:100vh; display:flex; align-items:center; justify-content:center; padding:24px; }
    .card { background:#1E293B; border:1px solid #334155; border-top:4px solid #00B4BF; border-radius:12px; max-width:520px; width:100%; padding:28px; box-shadow:0 20px 50px rgba(0,0,0,0.4); }
    h1 { margin:0 0 8px; font-size:20px; font-weight:800; }
    p { margin:0 0 20px; font-size:13.5px; color:#CBD5E1; line-height:1.5; }
    .btn { display:inline-block; background:#008C95; color:#FFFFFF; text-decoration:none; font-weight:700; font-size:14px; padding:12px 22px; border-radius:8px; cursor:pointer; border:none; }
    .btn:hover { background:#00A3AD; }
    .meta { margin-top:14px; font-size:12px; color:#94A3B8; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Diya Only RM Analysis (01–25 Nov 2026)</h1>
    <p>Your 12-slide 16:9 widescreen PDF report (${sizeKb} KB) should begin downloading automatically. If it did not start, click the button below.</p>
    <a id="dlBtn" class="btn" href="/api/download-report/diya-nov-2026" download="${DIYA_REPORT_FILENAME}">Download 16:9 PDF (${sizeKb} KB)</a>
    <div class="meta">File: ${DIYA_REPORT_FILENAME}</div>
  </div>
  <script>
    window.addEventListener('DOMContentLoaded', function() {
      setTimeout(function() {
        var a = document.getElementById('dlBtn');
        if (a) a.click();
      }, 300);
    });
  </script>
</body>
</html>`);
});

// Setup Multer for memory upload with error handling
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
});

const safeUpload = (fieldName: string) => (req: express.Request, res: express.Response, next: express.NextFunction) => {
  upload.single(fieldName)(req, res, (err: any) => {
    if (err) {
      console.error(`Multer upload error on ${fieldName}:`, err);
      return res.status(400).json({ error: err.message || 'File upload error. Please ensure file is valid.' });
    }
    next();
  });
};

const TRAINERS_AVAILABILITY_UPSTREAM =
  'https://ais-pre-cztpw3iboshg4dbqemkfya-856160031754.asia-southeast1.run.app';
let trainersAvailabilityGaesaCookie = '';

function readRawRequestBody(req: express.Request): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function proxyToTrainersAvailability(
  req: express.Request,
  res: express.Response,
  upstreamPath: string
) {
  try {
    const targetUrl = `${TRAINERS_AVAILABILITY_UPSTREAM}${upstreamPath}`;
    const cookieParts = ['__SECURE-aistudio_auth_token=one_token_to_rule_them_all'];
    if (trainersAvailabilityGaesaCookie) {
      cookieParts.push(trainersAvailabilityGaesaCookie);
    }

    const headers: Record<string, string> = {
      Cookie: cookieParts.join('; '),
      Accept: (req.headers['accept'] as string) || '*/*',
      'User-Agent': (req.headers['user-agent'] as string) || 'Mozilla/5.0',
    };

    if (req.headers['content-type']) {
      headers['Content-Type'] = req.headers['content-type'] as string;
    }

    let bodyBuffer: Buffer | undefined = undefined;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      bodyBuffer = await readRawRequestBody(req);
    }

    const upstreamRes = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: bodyBuffer && bodyBuffer.length > 0 ? new Uint8Array(bodyBuffer) : undefined,
      redirect: 'follow',
    });

    const setCookieHeader = upstreamRes.headers.get('set-cookie');
    if (setCookieHeader) {
      const gaesaMatch = setCookieHeader.match(/GAESA=[^;]+/);
      if (gaesaMatch) {
        trainersAvailabilityGaesaCookie = gaesaMatch[0];
      }
    }

    const contentType = upstreamRes.headers.get('content-type') || 'application/octet-stream';
    res.status(upstreamRes.status);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'no-cache');

    if (contentType.includes('text/html')) {
      let html = await upstreamRes.text();
      html = html
        .replace(/<script[^>]*src="\/_aistudio-iframe\.js[^"]*"[^>]*><\/script>/gi, '')
        .replace(/(src|href)="\/assets\//g, '$1="/trainers-availability-embed/assets/');
      return res.send(html);
    }

    const arrayBuffer = await upstreamRes.arrayBuffer();
    return res.send(Buffer.from(arrayBuffer));
  } catch (err: any) {
    console.error('[Trainers Availability Proxy Error]:', err);
    return res.status(502).json({
      error: 'Failed to proxy Trainers Availability service',
      details: err?.message || String(err),
    });
  }
}

app.use('/trainers-availability-embed', async (req, res) => {
  const subPath = req.url || '/?view=1';
  const normalizedPath = subPath.startsWith('/') ? subPath : `/${subPath}`;
  await proxyToTrainersAvailability(req, res, normalizedPath);
});

app.use('/api/mysql', async (req, res) => {
  const upstreamPath = `/api/mysql${req.url || ''}`;
  await proxyToTrainersAvailability(req, res, upstreamPath);
});

app.use(express.json({ limit: '100mb' }));

app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Helper to parse query filter params
function parseMultiParam(rawArrayParam: any, rawSingleParam: any): { list?: string[]; joined?: string } {
  let list: string[] | undefined = undefined;
  if (rawArrayParam) {
    if (Array.isArray(rawArrayParam)) {
      list = rawArrayParam
        .flatMap((v: any) => String(v).split(','))
        .map((v: string) => v.trim())
        .filter((v: string) => v && v !== 'ALL');
    } else if (typeof rawArrayParam === 'string') {
      try {
        const parsed = JSON.parse(rawArrayParam);
        if (Array.isArray(parsed)) {
          list = parsed.map(v => String(v).trim()).filter(v => v && v !== 'ALL');
        } else {
          list = rawArrayParam.split(',').map((v: string) => v.trim()).filter((v: string) => v && v !== 'ALL');
        }
      } catch {
        list = rawArrayParam.split(',').map((v: string) => v.trim()).filter((v: string) => v && v !== 'ALL');
      }
    }
  } else if (rawSingleParam && typeof rawSingleParam === 'string') {
    if (rawSingleParam.includes(',')) {
      list = rawSingleParam.split(',').map((v: string) => v.trim()).filter((v: string) => v && v !== 'ALL');
    } else if (rawSingleParam !== 'ALL') {
      list = [rawSingleParam.trim()];
    }
  }

  let joined: string | undefined = undefined;
  if (list && list.length === 1) {
    joined = list[0];
  } else if (list && list.length > 1) {
    joined = list.join(',');
  } else if (rawSingleParam && rawSingleParam !== 'ALL') {
    joined = String(rawSingleParam);
  }

  return {
    list: list && list.length > 0 ? list : undefined,
    joined,
  };
}

function parseFilters(query: any): FilterParams {
  const prog = parseMultiParam(query.programNames, query.programName);
  const ae = parseMultiParam(query.assignedAes, query.assignedAe);
  const center = parseMultiParam(query.centerCodes, query.centerCode);
  const rm = parseMultiParam(query.rmShZhs, query.rmShZh);

  return {
    startDate: query.startDate as string,
    endDate: query.endDate as string,
    centerCode: center.joined,
    centerCodes: center.list,
    funderName: query.funderName as string,
    programName: prog.joined,
    programNames: prog.list,
    programType: query.programType as string,
    courseCode: query.courseCode as string,
    batchCode: query.batchCode as string,
    assignedTrainer: query.assignedTrainer as string,
    assignedAe: ae.joined,
    assignedAes: ae.list,
    rmShZh: rm.joined,
    rmShZhs: rm.list,
    batchStatus: query.batchStatus as string,
    enrollmentStatus: query.enrollmentStatus as string,
    studentStatus: query.studentStatus as string,
    dropoutType: query.dropoutType as string,
    batchValidationStatus: query.batchValidationStatus as string,
    studentValidationStatus: query.studentValidationStatus as string,
    placementType: query.placementType as string,
    hasException: query.hasException === 'true',
    specialCase: query.specialCase as string,
    module: query.module as string,
    restrictDeepTech: query.restrictDeepTech === 'true',
  };
}

// API Routes

// 1. Filter Options
app.get('/api/filters/options', async (req, res) => {
  try {
    const options = await getFilterOptions();
    res.json(options);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Executive Overview
app.get('/api/analytics/executive', async (req, res) => {
  try {
    const filters = parseFilters(req.query);
    const data = await getExecutiveAnalytics(filters);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Dropout Analytics
app.get('/api/analytics/dropouts', async (req, res) => {
  try {
    const filters = parseFilters(req.query);
    filters.module = 'dropout';
    filters.restrictDeepTech = true;
    const data = await getDropoutAnalytics(filters);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Exception Analytics
app.get('/api/analytics/exceptions', async (req, res) => {
  try {
    const filters = parseFilters(req.query);
    filters.module = 'exception';
    filters.restrictDeepTech = true;
    const data = await getExceptionAnalytics(filters);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Batch Closure Efficiency
app.get('/api/analytics/batch-closure', async (req, res) => {
  try {
    const filters = parseFilters(req.query);
    filters.module = 'batch_closure';
    filters.restrictDeepTech = true;
    const data = await getBatchClosureAnalytics(filters);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 5a. Running Batch Progress (Batch Status = "running", Average of Running Attendance %)
app.get('/api/analytics/running-batch', async (req, res) => {
  try {
    const filters = parseFilters(req.query);
    filters.module = 'running_batch';
    filters.restrictDeepTech = true;
    const data = await getRunningBatchAnalytics(filters);
    res.json(data);
  } catch (error: any) {
    console.error('Failed to get running batch analytics:', error);
    res.status(500).json({ error: error.message });
  }
});

// 5a-2. Closed Batch Progress (Batch Status = "complete", Average of Beneficiary_Class_Attendance %)
app.get('/api/analytics/closed-batch', async (req, res) => {
  try {
    const filters = parseFilters(req.query);
    filters.module = 'closed_batch';
    filters.restrictDeepTech = true;
    const data = await getClosedBatchAnalytics(filters);
    res.json(data);
  } catch (error: any) {
    console.error('Failed to get closed batch analytics:', error);
    res.status(500).json({ error: error.message });
  }
});

// 5b. Trained Analytics & Assessment Timeliness
app.get('/api/analytics/trained', async (req, res) => {
  try {
    const filters = parseFilters(req.query);
    filters.module = 'trained';
    filters.restrictDeepTech = true;
    const data = await getTrainedAnalytics(filters);
    res.json(data);
  } catch (error: any) {
    console.error('Failed to get trained analytics:', error);
    res.status(500).json({ error: error.message });
  }
});

// 5c. Batch Session Scheduling vs Conducted Analytics
app.get('/api/analytics/scheduling', async (req, res) => {
  try {
    const filters = parseFilters(req.query);
    const data = await getSchedulingAnalytics(filters);
    res.json(data);
  } catch (error: any) {
    console.error('Failed to get scheduling analytics:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/analytics/scheduling/batch/:batchCode', async (req, res) => {
  try {
    const { batchCode } = req.params;
    const fmEmailId = (req.query.fmEmailId as string) || (req.query.fm_email_id as string);
    const data = await getBatchSessionDetails(batchCode, fmEmailId);
    res.json(data);
  } catch (error: any) {
    console.error('Failed to get batch session details:', error);
    res.status(500).json({ error: error.message });
  }
});

// 6. Faculty Deployment & Workload
app.get('/api/analytics/faculty', async (req, res) => {
  try {
    const filters = parseFilters(req.query);
    const data = await getFacultyAnalytics(filters);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 7. Student Validation
app.get('/api/analytics/validation', async (req, res) => {
  try {
    const filters = parseFilters(req.query);
    const data = await getStudentValidationAnalytics(filters);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 8. Attendance & Academic Progress
app.get('/api/analytics/attendance', async (req, res) => {
  try {
    const filters = parseFilters(req.query);
    const data = await getAttendanceAnalytics(filters);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 9. Placement Analytics
app.get('/api/analytics/placements', async (req, res) => {
  try {
    const filters = parseFilters(req.query);
    const data = await getPlacementAnalytics(filters);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 10. Center Analytics
app.get('/api/analytics/centers', async (req, res) => {
  try {
    const filters = parseFilters(req.query);
    const data = await getCenterAnalytics(filters);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 11. AE Performance Overview
app.get('/api/analytics/aes', async (req, res) => {
  try {
    const filters = parseFilters(req.query);
    const data = await getAeAnalytics(filters);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 12. Raw Records / Data Explorer
app.get('/api/records', async (req, res) => {
  try {
    const filters = parseFilters(req.query);
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 50;
    const search = (req.query.search as string) || '';
    const sortColumn = (req.query.sortColumn as string) || 'id';
    const sortDirection = (req.query.sortDirection as string) || 'DESC';

    const data = await getRawRecords(filters, page, pageSize, search, sortColumn, sortDirection);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 13. Data Quality Metrics
app.get('/api/data-quality', async (req, res) => {
  try {
    const data = await getDataQualityMetrics();
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 14. Excel Upload Wizard: Step 1 & 2 Analyze File
app.post('/api/upload/analyze', safeUpload('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const analysis = parseAndAnalyzeWorkbook(req.file.buffer, req.file.originalname);
    res.json(analysis);
  } catch (error: any) {
    console.error('File analysis error:', error);
    res.status(400).json({ error: error.message || 'Unable to process the uploaded file. Please verify the file structure and try again.' });
  }
});

// 15. Excel Upload Wizard: Step 3 Validate with mapping
app.post('/api/upload/validate', safeUpload('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const sheetName = req.body.sheetName || 'Export';
    const mapping = JSON.parse(req.body.mapping || '{}');

    const result = validateUploadedData(req.file.buffer, sheetName, mapping);
    res.json({
      validation: result.validation,
      previewTransformedRows: result.transformedRows.slice(0, 10),
    });
  } catch (error: any) {
    console.error('Validation error:', error);
    res.status(400).json({ error: error.message || 'Validation failed' });
  }
});

// 16. Excel Upload Wizard: Step 4 Final Commit
app.post('/api/upload/commit', safeUpload('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const sheetName = req.body.sheetName || 'Export';
    const mapping = JSON.parse(req.body.mapping || '{}');
    const duplicateMode = (req.body.duplicateMode || 'skip') as 'skip' | 'update' | 'import_new';
    const uploadedBy = req.body.uploadedBy || 'arnab.roy@anudip.org';

    const result = validateUploadedData(req.file.buffer, sheetName, mapping);
    const uploadRecord = await commitImport(
      req.file.originalname,
      sheetName,
      uploadedBy,
      result.transformedRows,
      duplicateMode,
      result.validation.validRowsCount,
      result.validation.invalidRowsCount,
      result.validation.duplicateCount
    );

    res.json({ success: true, upload: uploadRecord });
  } catch (error: any) {
    console.error('Commit import error:', error);
    res.status(500).json({ error: error.message || 'Error committing import' });
  }
});

// 16b. Direct JSON Records Import (Client-side parsed fast commit)
app.post('/api/upload/direct-import', async (req, res) => {
  try {
    const { fileName, sheetName, uploadedBy, transformedRows, duplicateMode, validCount, invalidCount, duplicateCount } = req.body;
    if (!transformedRows || !Array.isArray(transformedRows) || transformedRows.length === 0) {
      return res.status(400).json({ error: 'No valid transformed rows provided for import.' });
    }

    const uploadRecord = await commitImport(
      fileName || 'imported_dataset.xlsx',
      sheetName || 'Export',
      uploadedBy || 'arnab.roy@anudip.org',
      transformedRows,
      duplicateMode || 'skip',
      validCount || transformedRows.length,
      invalidCount || 0,
      duplicateCount || 0
    );

    res.json({ success: true, upload: uploadRecord });
  } catch (error: any) {
    console.error('Direct import error:', error);
    res.status(500).json({ error: error.message || 'Error executing direct dataset import' });
  }
});

// 16b-2. Chunked Direct Dataset Import (Prevents 413 Request Entity Too Large)
app.post('/api/upload/direct-import-chunk', async (req, res) => {
  try {
    const {
      uploadId,
      fileName,
      sheetName,
      uploadedBy,
      chunkRows,
      chunkIndex,
      totalChunks,
      totalRows,
      duplicateMode,
      validCount,
      invalidCount,
      duplicateCount,
      isFinal
    } = req.body;

    if (!chunkRows || !Array.isArray(chunkRows)) {
      return res.status(400).json({ error: 'No chunk rows provided' });
    }

    const result = await commitImportChunk({
      uploadId: uploadId || ('UPL-' + Date.now().toString(36).toUpperCase()),
      fileName: fileName || 'imported_dataset.xlsx',
      sheetName: sheetName || 'Export',
      uploadedBy: uploadedBy || 'arnab.roy@anudip.org',
      chunkRows,
      chunkIndex: Number(chunkIndex || 0),
      totalChunks: Number(totalChunks || 1),
      totalRows: Number(totalRows || chunkRows.length),
      duplicateMode: duplicateMode || 'skip',
      validCount: Number(validCount || totalRows || chunkRows.length),
      invalidCount: Number(invalidCount || 0),
      duplicateCount: Number(duplicateCount || 0),
      isFinal: Boolean(isFinal)
    });

    res.json({ success: true, ...result });
  } catch (error: any) {
    console.error('Direct import chunk error:', error);
    res.status(500).json({ error: error.message || 'Error executing dataset chunk import' });
  }
});

// 16c. Exception Approval Report Import (Supports both JSON payload and direct Excel file upload)
app.post('/api/upload/exception-approval', safeUpload('file'), async (req, res) => {
  try {
    let rows: any[] = [];
    let fileName = 'Exception_Approval_Report.xlsx';
    let uploadedBy = 'arnab.roy@anudip.org';

    if (req.file) {
      fileName = req.file.originalname;
      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
      if (req.body?.uploadedBy) uploadedBy = req.body.uploadedBy;
    } else if (req.body?.transformedRows && Array.isArray(req.body.transformedRows)) {
      rows = req.body.transformedRows;
      fileName = req.body.fileName || fileName;
      uploadedBy = req.body.uploadedBy || uploadedBy;
    } else if (Array.isArray(req.body)) {
      rows = req.body;
    }

    if (!rows || rows.length === 0) {
      return res.status(400).json({ error: 'No valid exception approval records found in the uploaded file.' });
    }

    const result = await processExceptionApprovalReportImport(rows, uploadedBy);
    res.json({ success: true, fileName, summary: result });
  } catch (error: any) {
    console.error('Exception Approval Report import error:', error);
    res.status(500).json({ error: error.message || 'Error processing Exception Approval Report' });
  }
});

// 16c-2. Chunked Exception Approval Report Import
app.post('/api/upload/exception-approval-chunk', async (req, res) => {
  try {
    const { fileName, uploadedBy, chunkRows, chunkIndex, totalChunks, isFinal } = req.body;
    if (!chunkRows || !Array.isArray(chunkRows)) {
      return res.status(400).json({ error: 'No exception chunk rows provided' });
    }

    const result = await processExceptionApprovalReportImport(
      chunkRows,
      uploadedBy || 'arnab.roy@anudip.org'
    );

    res.json({ success: true, chunkIndex, isFinal, summary: result });
  } catch (error: any) {
    console.error('Exception approval chunk error:', error);
    res.status(500).json({ error: error.message || 'Error processing exception approval chunk' });
  }
});

// 16c-3. Get Exception Approval Reports
app.get('/api/exception-approval-reports', async (req, res) => {
  try {
    const data = await getExceptionApprovalReports();
    res.json(data);
  } catch (error: any) {
    console.error('Fetch exception approval reports error:', error);
    res.status(500).json({ error: error.message || 'Error fetching exception approval reports' });
  }
});

// 16d. Scheduled vs Conducted Excel Import (Stored in MySQL scheduled_vs_conducted in afae_aeinsight)
app.post('/api/upload/scheduled-vs-conducted', safeUpload('file'), async (req, res) => {
  try {
    let rows: any[] = [];
    let fileName = 'Scheduled_vs_Conducted.xlsx';
    let uploadedBy = 'arnab.roy@anudip.org';

    if (req.file) {
      fileName = req.file.originalname;
      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const rawJson = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
      rows = rawJson.map((r: any) => ({
        slot_date: r['Slot Date'] || r['slot_date'] || r['Date'] || null,
        fm_email_id: r['FM email id'] || r['fm_email_id'] || r['Faculty Email'] || null,
        batch_code: r['Batch Code'] || r['batch_code'] || null,
        actual_center_code: r['Actual Center Code'] || r['actual_center_code'] || r['Center Code'] || null,
        program_name: r['Program Name'] || r['program_name'] || null,
        gmeet_id: r['G-meet ID'] || r['gmeet_id'] || r['Gmeet ID'] || null,
        batch_status: r['Batch Status'] || r['batch_status'] || null,
        actual_status: r['Actual Status'] || r['actual_status'] || null,
        schedule_class_start_time: r['Schedule Clsss start time'] || r['Schedule Class start time'] || r['schedule_class_start_time'] || null,
        actual_class_started: r['Actual Class Started'] || r['actual_class_started'] || null,
        schedule_class_end_time: r['Schedule Clsss end time'] || r['Schedule Class end time'] || r['schedule_class_end_time'] || null,
        actual_class_ended: r['Actual Class ended'] || r['actual_class_ended'] || null,
        class_link: r['class_link'] || r['Class Link'] || null,
        form_status: r['Form Status'] || r['form_status'] || null
      }));
      if (req.body?.uploadedBy) uploadedBy = req.body.uploadedBy;
    } else if (req.body?.transformedRows && Array.isArray(req.body.transformedRows)) {
      rows = req.body.transformedRows;
      fileName = req.body.fileName || fileName;
      uploadedBy = req.body.uploadedBy || uploadedBy;
    } else if (Array.isArray(req.body?.rows)) {
      rows = req.body.rows;
      fileName = req.body.fileName || fileName;
      uploadedBy = req.body.uploadedBy || uploadedBy;
    } else if (Array.isArray(req.body)) {
      rows = req.body;
    }

    if (!rows || rows.length === 0) {
      return res.status(400).json({ error: 'No valid scheduled vs conducted records found in the uploaded file.' });
    }

    const result = await insertScheduledVsConducted(rows, req.body?.uploadId, uploadedBy);
    res.json({ success: true, fileName, summary: result });
  } catch (error: any) {
    console.error('Scheduled vs Conducted import error:', error);
    res.status(500).json({ error: error.message || 'Error processing Scheduled vs Conducted workbook' });
  }
});

// 16d-2. Chunked Scheduled vs Conducted Import
app.post('/api/upload/scheduled-vs-conducted-chunk', async (req, res) => {
  try {
    const { fileName, uploadedBy, chunkRows, chunkIndex, totalChunks, isFinal, uploadId } = req.body;
    if (!chunkRows || !Array.isArray(chunkRows)) {
      return res.status(400).json({ error: 'No scheduled vs conducted chunk rows provided' });
    }
    const result = await insertScheduledVsConducted(
      chunkRows,
      uploadId,
      uploadedBy || 'arnab.roy@anudip.org',
      {
        chunkIndex: chunkIndex !== undefined ? Number(chunkIndex) : undefined,
        totalChunks: totalChunks !== undefined ? Number(totalChunks) : undefined,
        isFinal: Boolean(isFinal),
      }
    );
    res.json({ success: true, chunkIndex, isFinal, summary: result });
  } catch (error: any) {
    console.error('Scheduled vs conducted chunk error:', error);
    res.status(500).json({ error: error.message || 'Error processing scheduled vs conducted chunk' });
  }
});

// 16d-3. Query Scheduled vs Conducted Records
app.get('/api/scheduled-vs-conducted', async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 50;
    const offset = Number(req.query.offset) || 0;
    const search = String(req.query.search || '');
    const filters = parseFilters(req.query);
    const data = await getScheduledVsConducted(limit, offset, search, filters);
    res.json(data);
  } catch (error: any) {
    console.error('Get scheduled vs conducted error:', error);
    res.status(500).json({ error: error.message || 'Error fetching scheduled vs conducted records' });
  }
});

// 16e-1. Upload Slot Replacement Excel File or Transformed Data
app.post('/api/upload/slot-replacement', safeUpload('file'), async (req, res) => {
  try {
    let rows: any[] = [];
    let fileName = 'Slot_Replacement.xlsx';
    let uploadedBy = 'arnab.roy@anudip.org';

    if (req.file) {
      fileName = req.file.originalname;
      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const rawJson = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
      rows = rawJson.map((r: any) => ({
        emp_code: r['Emp Code'] || r['emp_code'] || r['EmpCode'] || null,
        trainer_name: r['Trainer Name'] || r['trainer_name'] || r['TrainerName'] || null,
        batch_code: r['Batch Code'] || r['batch_code'] || r['BatchCode'] || null,
        alias: r['Alias'] || r['alias'] || null,
        actual_class_date: r['Actual Class Date'] || r['actual_class_date'] || null,
        replacement_class_date: r['Replacement Class Date'] || r['replacement_class_date'] || null,
        center_code: r['Center Code'] || r['center_code'] || r['CenterCode'] || null,
        center_name: r['Center Name'] || r['center_name'] || r['CenterName'] || null,
        approved_rejected_by: r['Approved/Rejected By'] || r['approved_rejected_by'] || r['Approver'] || null,
        approval_rejected_date: r['Approval/Rejected Date'] || r['approval_rejected_date'] || r['Approval Date'] || null,
        requested_date: r['Requested Date'] || r['requested_date'] || r['Request Date'] || null,
        request_status: r['Request Status'] || r['request_status'] || r['Status'] || null,
        reason: r['Reason'] || r['reason'] || r['Remarks'] || null,
      }));
      if (req.body?.uploadedBy) uploadedBy = req.body.uploadedBy;
    } else if (req.body?.transformedRows && Array.isArray(req.body.transformedRows)) {
      rows = req.body.transformedRows;
      fileName = req.body.fileName || fileName;
      uploadedBy = req.body.uploadedBy || uploadedBy;
    } else if (Array.isArray(req.body?.rows)) {
      rows = req.body.rows;
      fileName = req.body.fileName || fileName;
      uploadedBy = req.body.uploadedBy || uploadedBy;
    } else if (Array.isArray(req.body?.records)) {
      rows = req.body.records;
      fileName = req.body.fileName || fileName;
      uploadedBy = req.body.uploadedBy || uploadedBy;
    } else if (Array.isArray(req.body)) {
      rows = req.body;
    }

    if (!rows || rows.length === 0) {
      return res.status(400).json({ error: 'No valid slot replacement records found in the uploaded file.' });
    }

    const result = await insertSlotReplacement(rows, req.body?.uploadId, uploadedBy);
    res.json({ success: true, fileName, summary: result });
  } catch (error: any) {
    console.error('Slot Replacement import error:', error);
    res.status(500).json({ error: error.message || 'Error processing Slot Replacement workbook' });
  }
});

// 16e-2. Chunked Slot Replacement Import
app.post('/api/upload/slot-replacement-chunk', async (req, res) => {
  try {
    const { fileName, uploadedBy, chunkRows, chunkIndex, totalChunks, isFinal, uploadId } = req.body;
    if (!chunkRows || !Array.isArray(chunkRows)) {
      return res.status(400).json({ error: 'No slot replacement chunk rows provided' });
    }
    const result = await insertSlotReplacement(
      chunkRows,
      uploadId,
      uploadedBy || 'arnab.roy@anudip.org',
      {
        chunkIndex: chunkIndex !== undefined ? Number(chunkIndex) : undefined,
        totalChunks: totalChunks !== undefined ? Number(totalChunks) : undefined,
        isFinal: Boolean(isFinal),
      }
    );
    res.json({ success: true, chunkIndex, isFinal, summary: result });
  } catch (error: any) {
    console.error('Slot replacement chunk error:', error);
    res.status(500).json({ error: error.message || 'Error processing slot replacement chunk' });
  }
});

// 16e-3. Query Slot Replacement Records
app.get('/api/slot-replacement', async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 50;
    const offset = Number(req.query.offset) || 0;
    const search = String(req.query.search || '');
    const data = await getSlotReplacements(limit, offset, search);
    res.json(data);
  } catch (error: any) {
    console.error('Get slot replacements error:', error);
    res.status(500).json({ error: error.message || 'Error fetching slot replacement records' });
  }
});

// 16f-1. Upload Challenges Excel/CSV File
app.post('/api/upload/challenges', safeUpload('file'), async (req, res) => {
  try {
    let rows: any[] = [];
    let fileName = 'RM_Challenges.xlsx';
    let uploadedBy = 'arnab.roy@anudip.org';

    if (req.file) {
      fileName = req.file.originalname;
      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const rawJson = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
      rows = rawJson.map((r: any) => ({
        sl_no: r['Sl No.'] || r['Sl No'] || r['sl_no'] || r['slno'] || r['S.No'] || r['sno'] || r['Sl. No.'] || r['Sl.No.'] || null,
        rm_name: r['RM Name'] || r['rm_name'] || r['RM'] || r['Rm Name'] || r['RM_Name'] || null,
        challenges: r['Challenges'] || r['challenges'] || r['Challenge'] || r['rm_challenges'] || r['Challenge Details'] || null,
        impact: r['Impact'] || r['impact'] || r['Impacts'] || r['rm_impact'] || r['Business Impact'] || null,
      }));
      if (req.body?.uploadedBy) uploadedBy = req.body.uploadedBy;
    } else if (req.body?.transformedRows && Array.isArray(req.body.transformedRows)) {
      rows = req.body.transformedRows;
      fileName = req.body.fileName || fileName;
      uploadedBy = req.body.uploadedBy || uploadedBy;
    } else if (Array.isArray(req.body?.rows)) {
      rows = req.body.rows;
      fileName = req.body.fileName || fileName;
      uploadedBy = req.body.uploadedBy || uploadedBy;
    } else if (Array.isArray(req.body?.records)) {
      rows = req.body.records;
      fileName = req.body.fileName || fileName;
      uploadedBy = req.body.uploadedBy || uploadedBy;
    } else if (Array.isArray(req.body)) {
      rows = req.body;
    }

    if (!rows || rows.length === 0) {
      return res.status(400).json({ error: 'No valid challenge records found in the uploaded file.' });
    }

    const result = await insertChallenges(rows, req.body?.uploadId, uploadedBy);
    logAudit(uploadedBy, 'Admin', 'RM Challenges Upload', `Uploaded ${result.validCount} challenge records from ${fileName}`, 'success');
    res.json({ success: true, fileName, summary: result });
  } catch (error: any) {
    console.error('RM Challenges import error:', error);
    res.status(500).json({ error: error.message || 'Error processing RM Challenges workbook' });
  }
});

// 16f-2. Chunked Challenges Import
app.post('/api/upload/challenges-chunk', async (req, res) => {
  try {
    const { fileName, uploadedBy, chunkRows, chunkIndex, totalChunks, isFinal, uploadId } = req.body;
    if (!chunkRows || !Array.isArray(chunkRows)) {
      return res.status(400).json({ error: 'No challenge chunk rows provided' });
    }
    const result = await insertChallenges(
      chunkRows,
      uploadId,
      uploadedBy || 'arnab.roy@anudip.org'
    );
    if (isFinal) {
      logAudit(uploadedBy || 'arnab.roy@anudip.org', 'Admin', 'RM Challenges Upload', `Uploaded challenge records from ${fileName || 'Challenges Workbook'} (${totalChunks || 1} chunks)`, 'success');
    }
    res.json({ success: true, chunkIndex, isFinal, summary: result });
  } catch (error: any) {
    console.error('Challenges chunk error:', error);
    res.status(500).json({ error: error.message || 'Error processing challenges chunk' });
  }
});

// 16f-3. Query Challenges Records
app.get('/api/challenges', async (req, res) => {
  try {
    const limit = req.query.limit !== undefined ? Number(req.query.limit) : 1000;
    const offset = Number(req.query.offset) || 0;
    const search = String(req.query.search || '');
    const data = await getChallenges(limit, offset, search);
    res.json(data);
  } catch (error: any) {
    console.error('Get challenges error:', error);
    res.status(500).json({ error: error.message || 'Error fetching challenges records' });
  }
});

// 17. Download Standard Sample Template (Master 30-Column)
app.get('/api/template/download', (req, res) => {
  try {
    const buffer = generateTemplateWorkbook();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="AE_INSIGHT_Master_Template.xlsx"');
    res.send(buffer);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 17b. Download Exception Approval Template
app.get('/api/template/exception-approval/download', (req, res) => {
  try {
    const buffer = generateExceptionApprovalTemplateWorkbook();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="Exception_Approval_Template.xlsx"');
    res.send(buffer);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 17c. Download Scheduled vs Conducted Template
app.get('/api/template/scheduled-vs-conducted/download', (req, res) => {
  try {
    const buffer = generateScheduledVsConductedTemplateWorkbook();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="Scheduled_vs_Conducted_Template.xlsx"');
    res.send(buffer);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 17d. Download Slot Replacement Template
app.get('/api/template/slot-replacement/download', (req, res) => {
  try {
    const buffer = generateSlotReplacementTemplateWorkbook();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="Slot_Replacement_Template.xlsx"');
    res.send(buffer);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 17e. Download Challenges Template
app.get(['/api/template/challenges/download', '/api/templates/challenges'], (req, res) => {
  try {
    const buffer = generateChallengesTemplateWorkbook();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="RM_Challenges_Template.xlsx"');
    res.send(buffer);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 17f. Export Chart Raw Data Workbook (.xlsx) for Manual Verification
app.post('/api/export/chart-excel', async (req, res) => {
  try {
    const { module, chartType, chartTitle, filters, chartSummary } = req.body || {};
    if (!module) {
      return res.status(400).json({ error: 'Module is required for chart raw data export' });
    }
    const parsedFilters = parseFilters(filters || {});
    const { buffer, fileName } = await exportChartRawDataWorkbook({
      module,
      chartType,
      chartTitle,
      filters: parsedFilters,
      chartSummary,
    });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(buffer);
  } catch (error: any) {
    console.error('Chart Excel export error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate Excel raw data export' });
  }
});

// 18. Upload History
app.get('/api/upload/history', async (req, res) => {
  try {
    const history = await getUploadHistoryAsync();
    res.json(history);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 19. Audit Logs
app.get('/api/audit-logs', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const logs = getAuditLogs(limit);
    res.json(logs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 20. Settings (Operational Thresholds)
app.get('/api/settings', (req, res) => {
  res.json(getSettings());
});

app.put('/api/settings', (req, res) => {
  try {
    const updated = updateSettings(req.body);
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 21. AI Insights ("Ask AE INSIGHT" with Gemini)
app.post('/api/ai/ask', async (req, res) => {
  try {
    const { query, filters } = req.body;
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query prompt is required' });
    }
    const result = await askAeInsight(query, filters || {});
    logAudit('arnab.roy@anudip.org', 'Admin', 'AI Insight Query', `User queried: "${query.substring(0, 80)}"`, 'success');
    res.json(result);
  } catch (error: any) {
    console.error('AI ask error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 22. Clear all data (Removes all records and uploads)
app.post('/api/data/clear', async (req, res) => {
  try {
    const userEmail = req.body.userEmail || 'arnab.roy@anudip.org';
    await clearAllData(userEmail);
    res.json({ success: true, message: 'All sample and operational data have been removed from the portal.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 23. Seed sample data (optional demo reload)
app.post('/api/data/seed', async (req, res) => {
  try {
    const userEmail = req.body.userEmail || 'arnab.roy@anudip.org';
    await seedSampleData(userEmail);
    res.json({ success: true, message: 'Sample Anudip operational dataset loaded.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 24. Restore Points & System Backups
app.get('/api/restore-points', (req, res) => {
  try {
    const list = getRestorePoints();
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/restore-points', async (req, res) => {
  try {
    const { name, description, userEmail, isBaseline } = req.body || {};
    const point = await createRestorePoint(name, description, userEmail, isBaseline);
    res.json({ success: true, point });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/restore-points/:id/restore', async (req, res) => {
  try {
    const { id } = req.params;
    const { userEmail } = req.body || {};
    const result = await restoreFromPoint(id, userEmail);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/restore-points/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { userEmail } = req.body || {};
    const result = await deleteRestorePoint(id, userEmail);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/restore-points/:id/download', (req, res) => {
  try {
    const { id } = req.params;
    const fileInfo = getRestorePointFilePath(id);
    res.download(fileInfo.filePath, fileInfo.displayName);
  } catch (error: any) {
    res.status(404).json({ error: error.message });
  }
});

// =============================================================================
// 25. Database Backend Management & MySQL Configuration Routes
// =============================================================================

// Get current database status, active engine, and record counts
app.get('/api/database/status', async (req, res) => {
  try {
    const activeEngine = getActiveEngine();
    const mysqlConfig = getMysqlConfig();
    const isConnected = await isMysqlConnected();

    // Query SQLite count
    const db = await getDb();
    let sqliteCount = 0;
    try {
      const dbRes = db.exec('SELECT COUNT(*) as c FROM raw_records');
      sqliteCount = Number(dbRes[0]?.values[0][0]) || 0;
    } catch (e) {}

    // Query MySQL count if connected
    let mysqlCount: number | null = null;
    let latencyMs = 0;
    let mysqlVersion = '';
    const mysqlTables: Record<string, { rowCount: number }> = {};
    if (isConnected) {
      try {
        const testRes = await testMysqlConnection();
        latencyMs = testRes.latencyMs;
        mysqlVersion = testRes.version || '';
        const rows = await queryMysql('SELECT COUNT(*) as cnt FROM raw_records');
        mysqlCount = Number(rows[0]?.cnt) || 0;
        mysqlTables.raw_records = { rowCount: mysqlCount };

        const svcRows = await queryMysql('SELECT COUNT(*) as cnt FROM scheduled_vs_conducted').catch(() => []);
        mysqlTables.scheduled_vs_conducted = { rowCount: Number(svcRows[0]?.cnt) || 0 };

        const srRows = await queryMysql('SELECT COUNT(*) as cnt FROM slot_replacement').catch(() => []);
        mysqlTables.slot_replacement = { rowCount: Number(srRows[0]?.cnt) || 0 };
      } catch (e) {}
    }

    res.json({
      activeEngine,
      isConnected,
      mysqlConfig,
      sqliteRecordCount: sqliteCount,
      mysqlRecordCount: mysqlCount,
      activeRecordCount: activeEngine === 'mysql' && mysqlCount !== null ? mysqlCount : sqliteCount,
      latencyMs,
      mysqlVersion,
      mysqlTables,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Test connection to MySQL database with given credentials
app.post('/api/database/test-connection', async (req, res) => {
  try {
    const result = await testMysqlConnection(req.body);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Save MySQL configuration and optionally switch active engine
app.post('/api/database/config', async (req, res) => {
  try {
    const { host, port, user, password, database, ssl, connectionLimit, switchToMysql } = req.body || {};
    await setMysqlConfig({
      host: host || 'localhost',
      port: Number(port) || 3306,
      user: user || 'root',
      password: password !== undefined ? password : '',
      database: database || 'ae_insight',
      ssl: Boolean(ssl),
      connectionLimit: Number(connectionLimit) || 10,
    }, Boolean(switchToMysql));

    if (switchToMysql) {
      const test = await testMysqlConnection();
      if (!test.success) {
        return res.status(400).json({
          success: false,
          error: test.message,
          details: test
        });
      }
      await initMysqlTables();
    }

    logAudit('arnab.roy@anudip.org', 'Admin', 'Database Config Updated', `Configured MySQL database ${database || 'ae_insight'} on ${host || 'localhost'}:${port || 3306}`, 'success');
    res.json({
      success: true,
      message: 'Database configuration updated successfully.',
      activeEngine: getActiveEngine()
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Switch active database engine between 'sqlite' and 'mysql'
app.post('/api/database/switch-engine', async (req, res) => {
  try {
    const { engine } = req.body || {};
    if (engine !== 'sqlite' && engine !== 'mysql') {
      return res.status(400).json({ error: 'Engine must be sqlite or mysql' });
    }
    if (engine === 'mysql') {
      const isConnected = await isMysqlConnected();
      if (!isConnected) {
        const test = await testMysqlConnection();
        if (!test.success) {
          return res.status(400).json({ error: `Cannot switch to MySQL: ${test.message}` });
        }
      }
    }
    setActiveEngine(engine);
    logAudit('arnab.roy@anudip.org', 'Admin', 'Database Engine Switched', `Switched active database engine to ${engine.toUpperCase()}`, 'success');
    res.json({ success: true, activeEngine: engine });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Migrate all existing SQLite data to MySQL
app.post('/api/database/migrate-to-mysql', async (req, res) => {
  try {
    const db = await getDb();
    const result = await migrateSqliteToMysql(db);
    logAudit('arnab.roy@anudip.org', 'Admin', 'Migrate to MySQL', result.message, 'success');
    res.json(result);
  } catch (error: any) {
    console.error('Migration to MySQL failed:', error);
    res.status(500).json({ error: error.message || 'Migration to MySQL failed' });
  }
});

// Synchronize MySQL data to local analytics engine
app.post('/api/database/sync-from-mysql', async (req, res) => {
  try {
    const count = await syncMysqlToSqlite();
    logAudit('arnab.roy@anudip.org', 'Admin', 'Sync from MySQL', `Synchronized ${count} records from MySQL into local analytics cache`, 'success');
    res.json({
      success: true,
      recordsSynced: count,
      message: `Successfully synchronized ${count.toLocaleString()} records from MySQL to live analytics.`
    });
  } catch (error: any) {
    console.error('Sync from MySQL failed:', error);
    res.status(500).json({ error: error.message || 'Sync from MySQL failed' });
  }
});

// Get MySQL schema DDL SQL code
app.get('/api/database/schema', (req, res) => {
  try {
    const schemaPath = path.join(process.cwd(), 'mysql_schema.sql');
    if (fs.existsSync(schemaPath)) {
      const sql = fs.readFileSync(schemaPath, 'utf-8');
      res.json({ schema: sql });
    } else {
      res.status(404).json({ error: 'mysql_schema.sql not found' });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

function deriveDisplayNameFromEmail(email: string): string {
  if (!email) return 'Authenticated User';
  const local = email.split('@')[0] || email;
  // Clean common separators
  const cleaned = local
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
  return cleaned || local;
}

function detectEmailFromHeaders(req: express.Request): string | null {
  const candidates = [
    req.headers['x-goog-authenticated-user-email'],
    req.headers['x-forwarded-email'],
    req.headers['x-user-email'],
    req.headers['x-authenticated-user'],
    req.headers['x-AppEngine-User-Email'.toLowerCase()],
  ];

  for (const raw of candidates) {
    if (typeof raw === 'string' && raw.includes('@')) {
      const cleaned = raw.replace(/^accounts\.google\.com:/i, '').trim().toLowerCase();
      if (cleaned.includes('@')) return cleaned;
    }
  }
  return null;
}

// Live User Presence & Browser Gmail Identity Routes
app.get('/api/presence/detect-browser-user', (req, res) => {
  const headerEmail = detectEmailFromHeaders(req);
  const defaultEnvEmail = process.env.DEFAULT_BROWSER_GMAIL || 'arnabredmi3sprime@gmail.com';
  const detectedEmail = headerEmail || defaultEnvEmail;
  const userName = deriveDisplayNameFromEmail(detectedEmail);

  res.json({
    email: detectedEmail,
    userName,
    source: headerEmail ? 'google_browser_header' : 'browser_session',
    googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  });
});

app.post('/api/presence/heartbeat', async (req, res) => {
  try {
    const body = req.body || {};
    const headerEmail = detectEmailFromHeaders(req);
    const rawEmail = String(body.email || headerEmail || 'arnabredmi3sprime@gmail.com').trim().toLowerCase();
    const email = rawEmail.includes('@') ? rawEmail : `${rawEmail}@gmail.com`;
    const userName = String(body.userName || '').trim() || deriveDisplayNameFromEmail(email);
    const sessionId = String(body.sessionId || `sess_${email}_${req.ip || 'local'}`).trim();
    const userRole = String(body.userRole || 'Admin');
    const currentView = String(body.currentView || 'overview');
    const currentViewLabel = String(body.currentViewLabel || 'Dashboard');
    const portalMode = String(body.portalMode || 'Main Dashboard');
    const browserInfo = String(body.browserInfo || 'Google Chrome');
    const deviceOs = String(body.deviceOs || 'Desktop');
    const hostOrigin = String(body.hostOrigin || req.headers.host || 'localhost');
    const startedAt = Number(body.startedAt) || Date.now();
    const now = Date.now();

    const forwardedFor = req.headers['x-forwarded-for'];
    const ipAddress = typeof forwardedFor === 'string'
      ? forwardedFor.split(',')[0].trim()
      : req.socket.remoteAddress || null;

    await upsertLiveUserPresence({
      session_id: sessionId,
      email,
      user_name: userName,
      avatar_url: body.avatarUrl ? String(body.avatarUrl) : null,
      user_role: userRole,
      current_view: currentView,
      current_view_label: currentViewLabel,
      portal_mode: portalMode,
      browser_info: browserInfo,
      device_os: deviceOs,
      host_origin: hostOrigin,
      ip_address: ipAddress,
      started_at: startedAt,
      last_seen_at: now,
      is_online: 1,
    });

    const liveData = await getLiveActiveUsers();
    res.json({
      success: true,
      ...liveData,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Heartbeat failed' });
  }
});

app.get('/api/presence/active-users', async (req, res) => {
  try {
    const data = await getLiveActiveUsers();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to load active users' });
  }
});

app.post('/api/presence/leave', async (req, res) => {
  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        body = {};
      }
    }
    const sessionId = body?.sessionId;
    if (sessionId) {
      await markLiveUserOffline(String(sessionId));
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Initialize database and start server
// Diagnostic route
app.get('/api/debug/query-counts', async (req, res) => {
  try {
    const db = await getDb();
    const rows: any[] = [];
    const stmt = db.prepare(`SELECT program_name, funder_name, rm_sh_zh, COUNT(*) as cnt FROM raw_records GROUP BY program_name, funder_name, rm_sh_zh ORDER BY cnt DESC`);
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

async function startServer() {
  const distIndexPath = path.join(__dirname, 'dist', 'index.html');
  const hasBuiltDist = fs.existsSync(distIndexPath);
  const isPreOrProd =
    process.env.NODE_ENV === 'production' ||
    Boolean(process.env.K_SERVICE && process.env.K_SERVICE.startsWith('ais-pre'));
  const useViteDev = !isPreOrProd || !hasBuiltDist;
  let vite: any = null;

  if (useViteDev) {
    try {
      const { createServer: createViteServer } = await import('vite');
      vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } catch (e) {
      console.warn('Vite middleware not loaded, falling back to static dist:', e);
    }
  }

  // Serve static files from dist directory
  app.use(express.static(path.join(__dirname, 'dist')));

  app.get('*', async (req, res, next) => {
    if (req.originalUrl.startsWith('/api')) {
      return next();
    }

    if (vite) {
      try {
        const rootIndexPath = path.resolve(__dirname, 'index.html');
        if (fs.existsSync(rootIndexPath)) {
          let template = fs.readFileSync(rootIndexPath, 'utf-8');
          template = await vite.transformIndexHtml(req.originalUrl, template);
          return res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
        }
      } catch (e: any) {
        if (vite.ssrFixStacktrace) vite.ssrFixStacktrace(e);
        return next(e);
      }
    }

    if (fs.existsSync(distIndexPath)) {
      return res.sendFile(distIndexPath);
    }

    res.status(404).send('App build not found. Please run npm run build.');
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[AE INSIGHT Server] Running on port ${PORT} (mode=${useViteDev ? 'vite-dev' : 'static-dist'})`);
    // Warm up database asynchronously after binding port so Cloud Run health checks succeed immediately
    getDb().catch((err) => {
      console.error('Background DB warmup error:', err);
    });
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
