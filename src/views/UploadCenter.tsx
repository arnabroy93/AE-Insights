import React, { useState, useRef } from 'react';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Download,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  Layers,
  Settings2,
  Copy,
  FileText,
  Trash2,
  Search,
  X,
  CalendarClock,
  Repeat,
} from 'lucide-react';
import { api } from '../api';
import {
  EXPECTED_SCHEMA_COLUMNS,
  SCHEDULED_VS_CONDUCTED_COLUMNS,
  ScheduledVsConductedRecord,
  SLOT_REPLACEMENT_COLUMNS,
  SlotReplacementRecord,
  CHALLENGES_COLUMNS,
  ChallengeRecord,
} from '../types';
import {
  parseExcelFileLocally,
  transformAndValidateLocally,
  ClientAnalysisResult
} from '../utils/excelProcessor';

interface UploadCenterProps {
  onImportSuccess: () => void;
  onOpenClearModal?: () => void;
}

export const UploadCenter: React.FC<UploadCenterProps> = ({ onImportSuccess, onOpenClearModal }) => {
  const [step, setStep] = useState<number>(1);
  const [uploadCategory, setUploadCategory] = useState<'master' | 'scheduled_vs_conducted' | 'slot_replacement' | 'challenges'>('master');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Analysis result
  const [analysis, setAnalysis] = useState<ClientAnalysisResult | any | null>(null);
  const [selectedSheet, setSelectedSheet] = useState<string>('Export');
  const [mapping, setMapping] = useState<Record<string, string>>({});

  // Transformed & validated rows
  const [transformedRows, setTransformedRows] = useState<any[]>([]);
  const [validationResult, setValidationResult] = useState<any | null>(null);

  // Duplicate mode
  const [duplicateMode, setDuplicateMode] = useState<'skip' | 'update' | 'import_new'>('skip');

  // Success summary
  const [commitSummary, setCommitSummary] = useState<any | null>(null);
  const [importProgressText, setImportProgressText] = useState<string | null>(null);

  // Stored scheduled_vs_conducted inspection modal
  const [showSvcModal, setShowSvcModal] = useState(false);
  const [svcList, setSvcList] = useState<ScheduledVsConductedRecord[]>([]);
  const [loadingSvc, setLoadingSvc] = useState(false);
  const [svcSearch, setSvcSearch] = useState('');
  const [svcTotalCount, setSvcTotalCount] = useState(0);

  // Stored slot_replacement inspection modal
  const [showSlotReplacementModal, setShowSlotReplacementModal] = useState(false);
  const [slotReplacementList, setSlotReplacementList] = useState<SlotReplacementRecord[]>([]);
  const [loadingSlotReplacement, setLoadingSlotReplacement] = useState(false);
  const [slotReplacementSearch, setSlotReplacementSearch] = useState('');
  const [slotReplacementTotalCount, setSlotReplacementTotalCount] = useState(0);

  // Stored challenges inspection modal
  const [showChallengesModal, setShowChallengesModal] = useState(false);
  const [challengesList, setChallengesList] = useState<ChallengeRecord[]>([]);
  const [loadingChallenges, setLoadingChallenges] = useState(false);
  const [challengesSearch, setChallengesSearch] = useState('');
  const [challengesTotalCount, setChallengesTotalCount] = useState(0);

  const fetchStoredSvcRecords = async (query = '') => {
    setLoadingSvc(true);
    try {
      const res = await api.getScheduledVsConducted(100, 0, query);
      setSvcList(res.rows || []);
      setSvcTotalCount(res.totalCount || 0);
      setShowSvcModal(true);
    } catch (err: any) {
      alert(err.message || 'Failed to fetch stored scheduled vs conducted records');
    } finally {
      setLoadingSvc(false);
    }
  };

  const fetchStoredSlotReplacements = async (query = '') => {
    setLoadingSlotReplacement(true);
    try {
      const res = await api.getSlotReplacements(100, 0, query);
      setSlotReplacementList(res.rows || []);
      setSlotReplacementTotalCount(res.totalCount || 0);
      setShowSlotReplacementModal(true);
    } catch (err: any) {
      alert(err.message || 'Failed to fetch stored slot replacement records');
    } finally {
      setLoadingSlotReplacement(false);
    }
  };

  const fetchStoredChallenges = async (query = '') => {
    setLoadingChallenges(true);
    try {
      const res = await api.getChallenges(100, 0, query);
      setChallengesList(res.rows || []);
      setChallengesTotalCount(res.totalCount || 0);
      setShowChallengesModal(true);
    } catch (err: any) {
      alert(err.message || 'Failed to fetch stored RM challenge records');
    } finally {
      setLoadingChallenges(false);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentSchemaColumns =
    uploadCategory === 'challenges'
      ? CHALLENGES_COLUMNS
      : uploadCategory === 'slot_replacement'
      ? SLOT_REPLACEMENT_COLUMNS
      : uploadCategory === 'scheduled_vs_conducted'
      ? SCHEDULED_VS_CONDUCTED_COLUMNS
      : EXPECTED_SCHEMA_COLUMNS;


  const isScheduledVsConductedFile = (fileName: string, headers: string[] = []): boolean => {
    const lower = fileName.toLowerCase();
    if (
      lower.includes('scheduled') ||
      lower.includes('conducted') ||
      lower.includes('sched_vs_cond') ||
      lower.includes('svc') ||
      lower.includes('g-meet') ||
      lower.includes('gmeet')
    ) {
      return true;
    }
    const cleanHeaders = headers.map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
    const svcKeywords = [
      'slotdate', 'fmemailid', 'gmeetid', 'actualstatus',
      'scheduleclsssstarttime', 'scheduleclassstarttime',
      'actualclassstarted', 'scheduleclsssendtime', 'scheduleclassendtime',
      'actualclassended', 'classlink', 'formstatus'
    ];
    const matches = svcKeywords.filter(k => cleanHeaders.some(h => h.includes(k)));
    return matches.length >= 2;
  };

  const isSlotReplacementFile = (fileName: string, headers: string[] = []): boolean => {
    const lower = fileName.toLowerCase();
    if (
      lower.includes('slot replacement') ||
      lower.includes('slot_replacement') ||
      lower.includes('slotreplace') ||
      lower.includes('slot replace') ||
      lower.includes('replacement') ||
      lower.includes('replacement class')
    ) {
      return true;
    }
    const cleanHeaders = headers.map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
    const srKeywords = [
      'empcode', 'trainername', 'alias', 'actualclassdate', 'replacementclassdate',
      'approvedrejectedby', 'approvalrejecteddate', 'requesteddate', 'requeststatus'
    ];
    const matches = srKeywords.filter(k => cleanHeaders.some(h => h.includes(k)));
    return matches.length >= 2;
  };

  const isChallengesFile = (fileName: string, headers: string[] = []): boolean => {
    const lower = fileName.toLowerCase();
    if (
      lower.includes('challenge') ||
      lower.includes('rm_challenge') ||
      lower.includes('rm challenge') ||
      lower.includes('rm_challenges') ||
      lower.includes('impact')
    ) {
      return true;
    }
    const cleanHeaders = headers.map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
    const chKeywords = ['slno', 'rmname', 'challenges', 'challenge', 'impact', 'rmchallenges'];
    const matches = chKeywords.filter(k => cleanHeaders.some(h => h.includes(k)));
    return matches.length >= 2;
  };

  const handleFileSelect = (selectedFile: File) => {
    setFile(selectedFile);
    setError(null);

    // Auto-detect category from file name or headers
    let targetCategory = uploadCategory;
    if (isChallengesFile(selectedFile.name)) {
      targetCategory = 'challenges';
      setUploadCategory('challenges');
    } else if (isSlotReplacementFile(selectedFile.name)) {
      targetCategory = 'slot_replacement';
      setUploadCategory('slot_replacement');
    } else if (isScheduledVsConductedFile(selectedFile.name)) {
      targetCategory = 'scheduled_vs_conducted';
      setUploadCategory('scheduled_vs_conducted');
    }

    analyzeFile(selectedFile, targetCategory);
  };

  const analyzeFile = async (f: File, categoryOverride?: 'master' | 'scheduled_vs_conducted' | 'slot_replacement' | 'challenges') => {
    setLoading(true);
    setError(null);
    let cat = categoryOverride || uploadCategory;
    if (isChallengesFile(f.name)) {
      cat = 'challenges';
      setUploadCategory('challenges');
    } else if (isSlotReplacementFile(f.name)) {
      cat = 'slot_replacement';
      setUploadCategory('slot_replacement');
    } else if (isScheduledVsConductedFile(f.name)) {
      cat = 'scheduled_vs_conducted';
      setUploadCategory('scheduled_vs_conducted');
    }

    const schemaToUse =
      cat === 'challenges'
        ? CHALLENGES_COLUMNS
        : cat === 'slot_replacement'
        ? SLOT_REPLACEMENT_COLUMNS
        : cat === 'scheduled_vs_conducted'
        ? SCHEDULED_VS_CONDUCTED_COLUMNS
        : EXPECTED_SCHEMA_COLUMNS;

    try {
      // Step 1: Parse file with client-side fast engine using selected schema
      let localResult = await parseExcelFileLocally(f, schemaToUse);

      // Step 1b: Verify headers to check if an auto-detection correction is needed
      if (cat === 'master') {
        if (isChallengesFile(f.name, localResult.detectedHeaders)) {
          cat = 'challenges';
          setUploadCategory('challenges');
          localResult = await parseExcelFileLocally(f, CHALLENGES_COLUMNS);
        } else if (isSlotReplacementFile(f.name, localResult.detectedHeaders)) {
          cat = 'slot_replacement';
          setUploadCategory('slot_replacement');
          localResult = await parseExcelFileLocally(f, SLOT_REPLACEMENT_COLUMNS);
        } else if (isScheduledVsConductedFile(f.name, localResult.detectedHeaders)) {
          cat = 'scheduled_vs_conducted';
          setUploadCategory('scheduled_vs_conducted');
          localResult = await parseExcelFileLocally(f, SCHEDULED_VS_CONDUCTED_COLUMNS);
        }
      }

      setAnalysis(localResult);
      setSelectedSheet(localResult.selectedSheet);
      setMapping(localResult.suggestedMapping);
      setStep(2);
    } catch (localErr: any) {
      console.warn('Local parsing encountered error, attempting server analysis:', localErr);
      try {
        const res = await api.analyzeUploadFile(f);
        setAnalysis(res);
        setSelectedSheet(res.selectedSheet);
        setMapping(res.suggestedMapping);
        setStep(2);
      } catch (err: any) {
        setError(err.message || 'Unable to process the uploaded file. Please verify the file structure and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleMappingChange = (expectedKey: string, detectedHeader: string) => {
    setMapping((prev) => ({
      ...prev,
      [expectedKey]: detectedHeader,
    }));
  };

  const runValidation = async () => {
    if (!file || !analysis) return;
    setLoading(true);
    setError(null);
    const effectiveCategory =
      uploadCategory === 'challenges' || isChallengesFile(file.name, analysis.detectedHeaders || [])
        ? 'challenges'
        : uploadCategory === 'slot_replacement' || isSlotReplacementFile(file.name, analysis.detectedHeaders || [])
        ? 'slot_replacement'
        : uploadCategory === 'scheduled_vs_conducted' || isScheduledVsConductedFile(file.name, analysis.detectedHeaders || [])
        ? 'scheduled_vs_conducted'
        : 'master';

    try {
      // Validate locally if rawRows are available using the current category
      if (analysis.rawRows && analysis.rawRows.length > 0) {
        const localVal = transformAndValidateLocally(analysis.rawRows, analysis.detectedHeaders, mapping, effectiveCategory);
        setValidationResult(localVal.validation);
        setTransformedRows(localVal.transformedRows);
        setStep(4);
      } else {
        const res = await api.validateUploadFile(file, selectedSheet, mapping);
        setValidationResult(res.validation);
        setTransformedRows(res.previewTransformedRows || []);
        setStep(4);
      }
    } catch (err: any) {
      try {
        const res = await api.validateUploadFile(file, selectedSheet, mapping);
        setValidationResult(res.validation);
        setTransformedRows(res.previewTransformedRows || []);
        setStep(4);
      } catch (serverErr: any) {
        setError(serverErr.message || 'Data validation failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFinalCommit = async () => {
    if (!file || !analysis) return;
    setLoading(true);
    setImportProgressText(null);
    setError(null);
    try {
      const isChallenges =
        uploadCategory === 'challenges' ||
        isChallengesFile(file.name, analysis.detectedHeaders || []);

      const isSlotReplacement =
        !isChallenges && (
          uploadCategory === 'slot_replacement' ||
          isSlotReplacementFile(file.name, analysis.detectedHeaders || [])
        );

      const isSvc =
        !isChallenges && !isSlotReplacement && (
          uploadCategory === 'scheduled_vs_conducted' ||
          isScheduledVsConductedFile(file.name, analysis.detectedHeaders || [])
        );

      let rowsToCommit = transformedRows;
      let validCount = validationResult?.validRowsCount || 0;
      let invalidCount = validationResult?.invalidRowsCount || 0;
      let duplicateCount = validationResult?.duplicateCount || 0;

      if (analysis.rawRows && analysis.rawRows.length > 0) {
        const localVal = transformAndValidateLocally(
          analysis.rawRows,
          analysis.detectedHeaders,
          mapping,
          isChallenges ? 'challenges' : isSlotReplacement ? 'slot_replacement' : isSvc ? 'scheduled_vs_conducted' : 'master'
        );
        rowsToCommit = localVal.transformedRows;
        validCount = localVal.validation.validRowsCount;
        invalidCount = localVal.validation.invalidRowsCount;
        duplicateCount = localVal.validation.duplicateCount;
      }

      if (isChallenges) {
        if (rowsToCommit.length === 0 && analysis.rawRows && analysis.rawRows.length > 0) {
          const localVal = transformAndValidateLocally(
            analysis.rawRows,
            analysis.detectedHeaders,
            mapping,
            'challenges'
          );
          rowsToCommit = localVal.transformedRows;
        }

        let res: any;
        if (rowsToCommit && rowsToCommit.length > 0) {
          res = await api.importChallengesReport(
            {
              fileName: file.name,
              uploadedBy: 'arnab.roy@anudip.org',
              transformedRows: rowsToCommit,
            },
            (progressMsg) => {
              setImportProgressText(progressMsg);
            }
          );
        } else {
          res = await api.uploadChallengesFile(
            file,
            'arnab.roy@anudip.org',
            (progressMsg) => {
              setImportProgressText(progressMsg);
            }
          );
        }

        const count = res.summary?.validCount || res.summary?.totalRecords || rowsToCommit.length;
        setCommitSummary({
          file_name: file.name,
          uploaded_at: new Date().toISOString(),
          valid_row_count: count,
          row_count: count,
          processing_status: 'completed',
          details: `Successfully uploaded ${count.toLocaleString()} RM Challenge records to MySQL table "challenges" in database "afae_aeinsight".`
        });
        setStep(6);
      } else if (isSlotReplacement) {
        if (rowsToCommit.length === 0 && analysis.rawRows && analysis.rawRows.length > 0) {
          const localVal = transformAndValidateLocally(
            analysis.rawRows,
            analysis.detectedHeaders,
            mapping,
            'slot_replacement'
          );
          rowsToCommit = localVal.transformedRows;
        }

        let res: any;
        if (rowsToCommit && rowsToCommit.length > 0) {
          res = await api.importSlotReplacementReport(
            {
              fileName: file.name,
              uploadedBy: 'arnab.roy@anudip.org',
              transformedRows: rowsToCommit,
            },
            (progressMsg) => {
              setImportProgressText(progressMsg);
            }
          );
        } else {
          res = await api.uploadSlotReplacementFile(
            file,
            'arnab.roy@anudip.org',
            (progressMsg) => {
              setImportProgressText(progressMsg);
            }
          );
        }

        const count = res.summary?.recordsInserted || rowsToCommit.length;
        setCommitSummary({
          file_name: file.name,
          uploaded_at: new Date().toISOString(),
          valid_row_count: count,
          row_count: count,
          processing_status: 'completed',
          details: `Successfully uploaded ${count.toLocaleString()} slot replacement records to MySQL table "slot_replacement" in database "afae_aeinsight". Existing operational metrics for Trained, Dropout, Exceptions, and Batch Closure remain untouched.`
        });
        setStep(6);
      } else if (isSvc) {
        if (rowsToCommit.length === 0 && analysis.rawRows && analysis.rawRows.length > 0) {
          const localVal = transformAndValidateLocally(
            analysis.rawRows,
            analysis.detectedHeaders,
            mapping,
            'scheduled_vs_conducted'
          );
          rowsToCommit = localVal.transformedRows;
        }

        let res: any;
        if (rowsToCommit && rowsToCommit.length > 0) {
          res = await api.importScheduledVsConductedReport(
            {
              fileName: file.name,
              uploadedBy: 'arnab.roy@anudip.org',
              transformedRows: rowsToCommit,
            },
            (progressMsg) => {
              setImportProgressText(progressMsg);
            }
          );
        } else {
          res = await api.uploadScheduledVsConductedFile(
            file,
            'arnab.roy@anudip.org',
            (progressMsg) => {
              setImportProgressText(progressMsg);
            }
          );
        }

        const count = res.summary?.recordsInserted || rowsToCommit.length;
        setCommitSummary({
          file_name: file.name,
          uploaded_at: new Date().toISOString(),
          valid_row_count: count,
          row_count: count,
          processing_status: 'completed',
          details: `Successfully uploaded ${count.toLocaleString()} session records to MySQL table "scheduled_vs_conducted" in database "afae_aeinsight". Existing operational metrics for Trained, Dropout, Exceptions, and Batch Closure remain untouched.`
        });
        setStep(6);
      } else {
        // Master Operational Workbook upload
        // Always use byte-bounded chunking so every request stays well under proxy limits
        let uploadRes: any;
        if (rowsToCommit.length > 0) {
          uploadRes = await api.directImportRecordsChunked(
            {
              fileName: file.name,
              sheetName: selectedSheet,
              uploadedBy: 'arnab.roy@anudip.org',
              transformedRows: rowsToCommit,
              duplicateMode,
              validCount,
              invalidCount,
              duplicateCount,
            },
            (progressMsg) => {
              setImportProgressText(progressMsg);
            }
          );
        } else {
          throw new Error('No valid student records could be prepared for import. Please ensure the workbook contains data rows.');
        }

        setCommitSummary(uploadRes.upload);
        setStep(6);
      }
    } catch (err: any) {
      console.warn('Import commit failed:', err);
      setError(err.message || 'Error committing import.');
    } finally {
      setLoading(false);
      setImportProgressText(null);
    }
  };

  const downloadTemplate = (cat?: 'master' | 'scheduled_vs_conducted' | 'slot_replacement' | 'challenges') => {
    const targetCat = cat || uploadCategory;
    if (targetCat === 'challenges') {
      window.location.href = '/api/template/challenges/download';
    } else if (targetCat === 'slot_replacement') {
      window.location.href = '/api/template/slot-replacement/download';
    } else if (targetCat === 'scheduled_vs_conducted') {
      window.location.href = '/api/template/scheduled-vs-conducted/download';
    } else {
      window.location.href = '/api/template/download';
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">Excel Import &amp; Processing Center</h2>
          <p className="text-xs text-slate-500">
            Multi-step schema validation, flexible mapping, duplicate resolution &amp; distinct aggregation
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {onOpenClearModal && (
            <button
              onClick={onOpenClearModal}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-800 rounded-lg text-xs font-semibold border border-rose-200 transition-colors cursor-pointer"
              title="Clear all stored student records, batches, and uploaded files from the portal"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
              <span>Clear Portal Data</span>
            </button>
          )}

          {/* Inspect Slot Replacement in MySQL */}
          <button
            onClick={() => fetchStoredSlotReplacements()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg text-xs font-semibold border border-amber-200 transition-colors cursor-pointer"
            title="Inspect rows stored in MySQL slot_replacement table in afae_aeinsight"
          >
            <Repeat className="w-3.5 h-3.5 text-amber-700" />
            <span>View Slot Replacements</span>
          </button>

          {/* Inspect Scheduled vs Conducted in MySQL */}
          <button
            onClick={() => fetchStoredSvcRecords()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-semibold border border-indigo-200 transition-colors cursor-pointer"
            title="Inspect rows stored in MySQL scheduled_vs_conducted table in afae_aeinsight"
          >
            <CalendarClock className="w-3.5 h-3.5 text-indigo-600" />
            <span>View Scheduled vs Conducted</span>
          </button>

          {/* Inspect RM Challenges in MySQL */}
          <button
            onClick={() => fetchStoredChallenges()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg text-xs font-semibold border border-purple-200 transition-colors cursor-pointer"
            title="Inspect rows stored in MySQL challenges table in afae_aeinsight"
          >
            <FileText className="w-3.5 h-3.5 text-purple-600" />
            <span>View RM Challenges</span>
          </button>

          {/* Template Download */}
          <button
            onClick={() => downloadTemplate()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#E6F4F5] hover:bg-[#CCECF0] text-[#005F66] rounded-lg text-xs font-semibold border border-[#008C95]/30 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-[#008C95]" />
            <span>
              {uploadCategory === 'challenges'
                ? 'Download RM Challenges Template (.xlsx)'
                : uploadCategory === 'slot_replacement'
                ? 'Download Slot Replacement Template (.xlsx)'
                : uploadCategory === 'scheduled_vs_conducted'
                ? 'Download Scheduled vs Conducted Template (.xlsx)'
                : 'Download 30-Column Master Template (.xlsx)'}
            </span>
          </button>
        </div>
      </div>

      {/* Wizard Progress Steps */}
      <div className="grid grid-cols-6 gap-2 text-center text-xs">
        {[
          { num: 1, label: '1. Select File' },
          { num: 2, label: '2. Detect File' },
          { num: 3, label: '3. Column Map' },
          { num: 4, label: '4. Validation' },
          { num: 5, label: '5. Duplicates' },
          { num: 6, label: '6. Complete' },
        ].map((s) => (
          <div
            key={s.num}
            className={`p-2 rounded-xl font-medium border text-[11px] ${
              step === s.num
                ? 'bg-[#008C95] text-white border-[#008C95] shadow-xs'
                : step > s.num
                ? 'bg-[#E6F4F5] text-[#005F66] border-[#CCECF0]'
                : 'bg-white text-slate-400 border-slate-200'
            }`}
          >
            {s.label}
          </div>
        ))}
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div>{error}</div>
        </div>
      )}

      {/* STEP 1: Upload File & Category Selector */}
      {step === 1 && (
        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200/80 shadow-xs space-y-6">
          {/* Category Selector Cards */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-900">1. Select Upload File Type</h3>
              <span className="text-xs text-slate-500 font-medium">Choose target dataset or report type</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Option 1: Master Workbook */}
              <div
                onClick={() => setUploadCategory('master')}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  uploadCategory === 'master'
                    ? 'bg-[#E6F4F5] border-[#008C95] ring-2 ring-[#CCECF0] shadow-xs'
                    : 'bg-slate-50/60 border-slate-200 hover:bg-slate-100/70 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`p-2 rounded-lg ${uploadCategory === 'master' ? 'bg-white text-[#008C95] shadow-2xs' : 'bg-slate-200 text-slate-600'}`}>
                    <FileSpreadsheet className="w-4 h-4" />
                  </span>
                  <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded font-mono ${uploadCategory === 'master' ? 'bg-[#008C95] text-white' : 'bg-slate-200 text-slate-600'}`}>
                    30 Columns
                  </span>
                </div>
                <h4 className="font-bold text-slate-900 text-xs">Primary Master Operational</h4>
                <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                  Standard 30-column Student &amp; Batch Master Dataset (`data (1).xlsx`)
                </p>
              </div>

              {/* Option 2: Scheduled vs Conducted */}
              <div
                onClick={() => setUploadCategory('scheduled_vs_conducted')}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  uploadCategory === 'scheduled_vs_conducted'
                    ? 'bg-indigo-50 border-indigo-600 ring-2 ring-indigo-200 shadow-xs'
                    : 'bg-slate-50/60 border-slate-200 hover:bg-slate-100/70 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`p-2 rounded-lg ${uploadCategory === 'scheduled_vs_conducted' ? 'bg-white text-indigo-700 shadow-2xs' : 'bg-slate-200 text-slate-600'}`}>
                    <CalendarClock className="w-4 h-4" />
                  </span>
                  <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded font-mono ${uploadCategory === 'scheduled_vs_conducted' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                    14 Columns
                  </span>
                </div>
                <h4 className="font-bold text-slate-900 text-xs">Scheduled vs Conducted</h4>
                <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                  Online session timings, FM email, batch, G-meet ID &amp; actual status stored in MySQL table <code className="font-mono text-[10px] bg-slate-200/70 px-1 rounded">scheduled_vs_conducted</code>
                </p>
              </div>

              {/* Option 3: Slot Replacement */}
              <div
                onClick={() => setUploadCategory('slot_replacement')}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  uploadCategory === 'slot_replacement'
                    ? 'bg-emerald-50 border-emerald-600 ring-2 ring-emerald-200 shadow-xs'
                    : 'bg-slate-50/60 border-slate-200 hover:bg-slate-100/70 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`p-2 rounded-lg ${uploadCategory === 'slot_replacement' ? 'bg-white text-emerald-700 shadow-2xs' : 'bg-slate-200 text-slate-600'}`}>
                    <Repeat className="w-4 h-4" />
                  </span>
                  <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded font-mono ${uploadCategory === 'slot_replacement' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                    13 Columns
                  </span>
                </div>
                <h4 className="font-bold text-slate-900 text-xs">Slot Replacement</h4>
                <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                  Trainer replacement class tracking stored in MySQL table <code className="font-mono text-[10px] bg-slate-200/70 px-1 rounded">slot_replacement</code>
                </p>
              </div>

              {/* Option 4: RM Challenges & Impact */}
              <div
                onClick={() => setUploadCategory('challenges')}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  uploadCategory === 'challenges'
                    ? 'bg-purple-50 border-purple-600 ring-2 ring-purple-200 shadow-xs'
                    : 'bg-slate-50/60 border-slate-200 hover:bg-slate-100/70 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`p-2 rounded-lg ${uploadCategory === 'challenges' ? 'bg-white text-purple-700 shadow-2xs' : 'bg-slate-200 text-slate-600'}`}>
                    <FileText className="w-4 h-4" />
                  </span>
                  <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded font-mono ${uploadCategory === 'challenges' ? 'bg-purple-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                    4 Columns
                  </span>
                </div>
                <h4 className="font-bold text-slate-900 text-xs">RM Challenges &amp; Impact</h4>
                <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                  Regional Manager challenges &amp; impact log stored in MySQL table <code className="font-mono text-[10px] bg-slate-200/70 px-1 rounded">challenges</code> with no length limit
                </p>
              </div>
            </div>
          </div>

          {/* Drag and Drop Zone */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files?.[0]) handleFileSelect(e.dataTransfer.files[0]);
            }}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-[#008C95]/40 hover:border-[#008C95] rounded-2xl p-8 sm:p-10 bg-slate-50/50 hover:bg-[#E6F4F5]/30 transition-all cursor-pointer text-center space-y-3"
          >
            <div className="w-12 h-12 rounded-full bg-[#008C95]/15 text-[#008C95] flex items-center justify-center mx-auto">
              <Upload className="w-6 h-6" />
            </div>
            <div>
              <div className="font-bold text-slate-800 text-sm">
                Click to upload or drag &amp; drop {
                  uploadCategory === 'challenges'
                    ? 'RM Challenges & Impact File'
                    : uploadCategory === 'scheduled_vs_conducted'
                    ? 'Scheduled vs Conducted Workbook'
                    : uploadCategory === 'slot_replacement'
                    ? 'Slot Replacement Sheet'
                    : 'Master Operational Workbook'
                }
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Supports .xlsx, .xls, and .csv files (e.g. {
                  uploadCategory === 'challenges'
                    ? 'RM_Challenges_Template.xlsx'
                    : uploadCategory === 'scheduled_vs_conducted'
                    ? 'scheduled vs conducted.xlsx'
                    : uploadCategory === 'slot_replacement'
                    ? 'Slot Replacement.xlsx'
                    : 'data (1).xlsx'
                })
              </div>
            </div>
          </div>

          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => {
              if (e.target.files?.[0]) handleFileSelect(e.target.files[0]);
            }}
            accept=".xlsx,.xls,.csv"
            className="hidden"
          />
        </div>
      )}

      {/* STEP 2: Detection Summary */}
      {step === 2 && analysis && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900">File Structure Detected</h3>
            <span className="text-xs text-slate-500">File: {analysis.fileName}</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl">
              <span className="text-slate-400">Total Rows</span>
              <div className="text-lg font-bold font-mono text-slate-900 mt-0.5">
                {analysis.totalRows.toLocaleString()}
              </div>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl">
              <span className="text-slate-400">Columns Detected</span>
              <div className="text-lg font-bold font-mono text-slate-900 mt-0.5">
                {analysis.totalColumns}
              </div>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl">
              <span className="text-slate-400">Required Schema Fields</span>
              <div className="text-lg font-bold font-mono text-emerald-600 mt-0.5">
                {currentSchemaColumns.filter((c) => c.required).length - analysis.missingRequired.length} / {currentSchemaColumns.filter((c) => c.required).length}
              </div>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl">
              <span className="text-slate-400">Worksheet</span>
              <select
                value={selectedSheet}
                onChange={async (e) => {
                  const newSheet = e.target.value;
                  setSelectedSheet(newSheet);
                  if (file) {
                    try {
                      const localRes = await parseExcelFileLocally(file, currentSchemaColumns, newSheet);
                      setAnalysis(localRes);
                      setMapping(localRes.suggestedMapping);
                    } catch (err) {
                      console.warn('Error switching worksheet locally:', err);
                    }
                  }
                }}
                className="w-full mt-1 bg-white border border-slate-300 rounded px-2 py-1 text-xs font-semibold text-slate-800"
              >
                {analysis.sheetNames.map((s: string) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Missing Fields Indicator */}
          {analysis.missingRequired.length > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
              <span className="font-bold">Missing Required Schema Fields:</span>{' '}
              {analysis.missingRequired.join(', ')}
            </div>
          )}

          <div className="flex justify-between pt-4 border-t border-slate-100">
            <button
              onClick={() => setStep(1)}
              className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
            >
              Choose Different File
            </button>
            <button
              onClick={() => setStep(3)}
              className="px-5 py-1.5 bg-[#008C95] hover:bg-[#00747C] text-white rounded-lg text-xs font-semibold flex items-center gap-1"
            >
              <span>Review Column Mapping</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Schema Mapping */}
      {step === 3 && analysis && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Schema &amp; Column Mapping</h3>
              <p className="text-xs text-slate-500">
                Verify automatic mapping against the {currentSchemaColumns.length} fields for {
                  uploadCategory === 'slot_replacement'
                    ? 'Slot Replacement Sheet'
                    : uploadCategory === 'scheduled_vs_conducted'
                    ? 'Scheduled vs Conducted Workbook'
                    : 'Master Operational Workbook'
                }
              </p>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 text-xs">
            <div className="bg-slate-100 font-bold p-2.5 grid grid-cols-12 text-[11px] uppercase text-slate-600">
              <div className="col-span-5">Standard Application Field</div>
              <div className="col-span-2">Requirement</div>
              <div className="col-span-5">Mapped Excel Header</div>
            </div>
            {currentSchemaColumns.map((col) => (
              <div key={col.key} className="p-2.5 grid grid-cols-12 items-center hover:bg-slate-50 gap-2">
                <div className="col-span-5 font-semibold text-slate-800">{col.name}</div>
                <div className="col-span-2">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${col.required ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>
                    {col.required ? 'Required' : 'Optional'}
                  </span>
                </div>
                <div className="col-span-5">
                  <select
                    value={mapping[col.key] || ''}
                    onChange={(e) => handleMappingChange(col.key, e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs"
                  >
                    <option value="">(Skip / Not in file)</option>
                    {analysis.detectedHeaders.map((h: string) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-between pt-4 border-t border-slate-100">
            <button
              onClick={() => setStep(2)}
              className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
            >
              Back
            </button>
            <button
              onClick={runValidation}
              disabled={loading}
              className="px-5 py-1.5 bg-[#008C95] hover:bg-[#00747C] text-white rounded-lg text-xs font-semibold flex items-center gap-1"
            >
              <span>{loading ? 'Validating Data...' : 'Validate Dataset'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: Validation Summary */}
      {step === 4 && validationResult && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Pre-Import Validation Results</h3>
              <p className="text-xs text-slate-500">Inspection of blank rows, invalid percentages, dates, and identifiers</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
              <span className="text-emerald-700 font-semibold">Valid Records</span>
              <div className="text-xl font-bold font-mono text-emerald-800 mt-0.5">
                {validationResult.validRowsCount.toLocaleString()}
              </div>
            </div>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <span className="text-amber-700 font-semibold">Warning Records</span>
              <div className="text-xl font-bold font-mono text-amber-800 mt-0.5">
                {validationResult.warningRowsCount}
              </div>
            </div>
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl">
              <span className="text-rose-700 font-semibold">Invalid Records</span>
              <div className="text-xl font-bold font-mono text-rose-800 mt-0.5">
                {validationResult.invalidRowsCount}
              </div>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-slate-600 font-semibold">Duplicates Detected</span>
              <div className="text-xl font-bold font-mono text-slate-900 mt-0.5">
                {validationResult.duplicateCount}
              </div>
            </div>
          </div>

          {/* Issue Log List */}
          {validationResult.issues.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-800">
                Validation Notices &amp; Warnings ({validationResult.issues.length})
              </div>
              <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-1.5 text-xs">
                {validationResult.issues.map((iss: any, idx: number) => (
                  <div key={idx} className="flex items-start gap-2 text-slate-700">
                    <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold shrink-0 ${iss.type === 'error' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-800'}`}>
                      Row {iss.rowNumber}
                    </span>
                    <span className="font-semibold text-slate-800">{iss.field}:</span>
                    <span className="text-slate-600">{iss.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-between pt-4 border-t border-slate-100">
            <button
              onClick={() => setStep(3)}
              className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
            >
              Back
            </button>
            <button
              onClick={() => setStep(5)}
              className="px-5 py-1.5 bg-[#008C95] hover:bg-[#00747C] text-white rounded-lg text-xs font-semibold flex items-center gap-1"
            >
              <span>Duplicate Handling Strategy</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 5: Duplicate Resolution */}
      {step === 5 && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Duplicate Management Strategy</h3>
              <p className="text-xs text-slate-500">
                Select how the database should handle matching Student Code + Batch Code records
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {[
              {
                id: 'skip',
                title: 'Skip Duplicates (Recommended)',
                desc: 'Keep existing database records and only insert completely new student/batch records.',
              },
              {
                id: 'update',
                title: 'Update Existing Records',
                desc: 'Overwrite existing student records in the database with the freshly uploaded dataset values.',
              },
              {
                id: 'import_new',
                title: 'Import as New Record',
                desc: 'Append all valid records to maintain full multi-session student records.',
              },
            ].map((opt) => (
              <label
                key={opt.id}
                className={`p-4 rounded-xl border flex items-start gap-3 cursor-pointer transition-colors ${
                  duplicateMode === opt.id
                    ? 'bg-[#E6F4F5]/60 border-[#008C95]'
                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <input
                  type="radio"
                  name="dupMode"
                  checked={duplicateMode === opt.id}
                  onChange={() => setDuplicateMode(opt.id as any)}
                  className="mt-0.5 text-[#008C95]"
                />
                <div>
                  <div className="text-xs font-bold text-slate-900">{opt.title}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{opt.desc}</div>
                </div>
              </label>
            ))}
          </div>

          <div className="flex justify-between pt-4 border-t border-slate-100">
            <button
              onClick={() => setStep(4)}
              className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
            >
              Back
            </button>
            <button
              onClick={handleFinalCommit}
              disabled={loading}
              className="px-6 py-2 bg-[#008C95] hover:bg-[#00747C] text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all"
            >
              {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>{loading ? (importProgressText || 'Committing Import...') : 'Confirm & Execute Import'}</span>
            </button>
          </div>
        </div>
      )}

      {/* STEP 6: Success Completion */}
      {step === 6 && commitSummary && (
        <div className="bg-white p-8 rounded-2xl border border-slate-200/80 shadow-xs text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Excel Import Completed Successfully!</h3>
            <p className="text-xs text-slate-500 mt-1">
              Data has been transformed, indexed, and normalized into the MySQL database.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-lg mx-auto text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <span className="text-slate-400">Target Table</span>
              <div className="font-mono font-bold text-slate-900 mt-0.5 truncate" title={uploadCategory === 'scheduled_vs_conducted' ? 'scheduled_vs_conducted (MySQL afae_aeinsight)' : undefined}>
                {uploadCategory === 'slot_replacement' || commitSummary.details?.includes('slot_replacement')
                  ? 'slot_replacement'
                  : uploadCategory === 'scheduled_vs_conducted' || commitSummary.details?.includes('scheduled_vs_conducted')
                  ? 'scheduled_vs_conducted'
                  : (commitSummary.id || 'raw_records')}
              </div>
            </div>
            <div>
              <span className="text-slate-400">Processed Rows</span>
              <div className="font-mono font-bold text-emerald-700 mt-0.5">
                {(commitSummary.valid_row_count ?? commitSummary.row_count ?? 0).toLocaleString()}
              </div>
            </div>
            <div>
              <span className="text-slate-400">File Name</span>
              <div className="font-mono font-bold text-slate-900 mt-0.5 truncate" title={commitSummary.file_name}>
                {commitSummary.file_name || 'Uploaded File'}
              </div>
            </div>
            <div>
              <span className="text-slate-400">Status</span>
              <div className="font-bold text-emerald-700 mt-0.5 capitalize">{commitSummary.processing_status || 'completed'}</div>
            </div>
          </div>

          {commitSummary.details && (
            <div className="text-xs text-slate-700 bg-emerald-50 border border-emerald-200 p-3 rounded-xl max-w-lg mx-auto leading-relaxed">
              {commitSummary.details}
            </div>
          )}

          <div className="pt-3">
            <button
              onClick={() => {
                onImportSuccess();
              }}
              className="px-6 py-2 bg-[#008C95] hover:bg-[#00747C] text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
            >
              View Updated Academic Dashboards
            </button>
          </div>
        </div>
      )}



      {/* Stored Scheduled vs Conducted Modal */}
      {showSvcModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <span className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
                  <CalendarClock className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Stored Session Records (<code className="font-mono text-indigo-700">scheduled_vs_conducted</code> in MySQL <code className="font-mono text-indigo-700">afae_aeinsight</code>)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Showing {svcList.length} of {svcTotalCount} total session records stored in backend MySQL table.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSvcModal(false)}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 border-b border-slate-200 bg-white flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by batch code, FM email id, actual center, program name, status, slot date..."
                  value={svcSearch}
                  onChange={(e) => {
                    setSvcSearch(e.target.value);
                    fetchStoredSvcRecords(e.target.value);
                  }}
                  className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <button
                onClick={() => downloadTemplate('scheduled_vs_conducted')}
                className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-semibold border border-indigo-200 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-indigo-600" />
                <span>Download Sample Sheet</span>
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4 bg-slate-50">
              {loadingSvc ? (
                <div className="flex items-center justify-center py-16 gap-2 text-slate-500 text-xs">
                  <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
                  <span>Loading records from MySQL database afae_aeinsight...</span>
                </div>
              ) : svcList.length === 0 ? (
                <div className="text-center py-16 space-y-2">
                  <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-500 flex items-center justify-center mx-auto">
                    <CalendarClock className="w-6 h-6" />
                  </div>
                  <div className="text-sm font-semibold text-slate-700">No scheduled vs conducted records found</div>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    Upload a spreadsheet named &quot;scheduled vs conducted&quot; using the 14-column layout to store sessions in MySQL table <code className="font-mono">scheduled_vs_conducted</code>.
                  </p>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl bg-white overflow-hidden shadow-2xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="p-3">Slot Date</th>
                        <th className="p-3">FM Email ID</th>
                        <th className="p-3">Batch Code</th>
                        <th className="p-3">Center</th>
                        <th className="p-3">Program</th>
                        <th className="p-3">Actual Status</th>
                        <th className="p-3">Batch Status</th>
                        <th className="p-3">Schedule Start</th>
                        <th className="p-3">Actual Started</th>
                        <th className="p-3">Schedule End</th>
                        <th className="p-3">Actual Ended</th>
                        <th className="p-3">G-Meet ID</th>
                        <th className="p-3">Form Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-600">
                      {svcList.map((row, idx) => (
                        <tr key={row.id || idx} className="hover:bg-slate-50/80">
                          <td className="p-3 font-mono font-medium text-slate-900 whitespace-nowrap">{row.slot_date || '-'}</td>
                          <td className="p-3 font-medium text-slate-900 truncate max-w-[140px]" title={row.fm_email_id || ''}>{row.fm_email_id || '-'}</td>
                          <td className="p-3 font-mono font-semibold text-indigo-700 whitespace-nowrap">{row.batch_code || '-'}</td>
                          <td className="p-3 whitespace-nowrap">{row.actual_center_code || '-'}</td>
                          <td className="p-3 truncate max-w-[120px]" title={row.program_name || ''}>{row.program_name || '-'}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              String(row.actual_status || '').toLowerCase().includes('conducted') ? 'bg-emerald-100 text-emerald-800' :
                              String(row.actual_status || '').toLowerCase().includes('cancelled') ? 'bg-rose-100 text-rose-800' :
                              'bg-amber-100 text-amber-800'
                            }`}>
                              {row.actual_status || '-'}
                            </span>
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            <span className="text-[11px] text-slate-600 font-medium">
                              {row.batch_status || '-'}
                            </span>
                          </td>
                          <td className="p-3 font-mono text-[11px] whitespace-nowrap">{row.schedule_class_start_time || '-'}</td>
                          <td className="p-3 font-mono text-[11px] whitespace-nowrap">{row.actual_class_started || '-'}</td>
                          <td className="p-3 font-mono text-[11px] whitespace-nowrap">{row.schedule_class_end_time || '-'}</td>
                          <td className="p-3 font-mono text-[11px] whitespace-nowrap">{row.actual_class_ended || '-'}</td>
                          <td className="p-3 font-mono text-[11px] truncate max-w-[110px]" title={row.gmeet_id || row.class_link || ''}>
                            {row.class_link ? (
                              <a href={row.class_link} target="_blank" rel="noreferrer" className="text-indigo-600 underline hover:text-indigo-800">
                                {row.gmeet_id || 'Join Meet'}
                              </a>
                            ) : (
                              row.gmeet_id || '-'
                            )}
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                              String(row.form_status || '').toLowerCase().includes('submit') ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600'
                            }`}>
                              {row.form_status || '-'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 bg-white flex items-center justify-between">
              <div className="text-[11px] text-slate-500">
                Data accurately stored in backend MySQL table <code className="font-mono text-indigo-700">scheduled_vs_conducted</code> in database <code className="font-mono text-indigo-700">afae_aeinsight</code>. Existing data for Trained, Dropout, Exceptions, and Batch Closure remain untouched.
              </div>
              <button
                onClick={() => setShowSvcModal(false)}
                className="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-900 transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Slot Replacement Records Modal */}
      {showSlotReplacementModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-emerald-50/60">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                  <Repeat className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <span>Slot Replacement Database Records</span>
                    <span className="font-mono text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                      afae_aeinsight.slot_replacement
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Live records in MySQL database table for trainer replacement classes ({slotReplacementList.length} loaded)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSlotReplacementModal(false)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 border-b border-slate-200 bg-white flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative flex-1 w-full sm:max-w-md">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter by Batch Code, Trainer Name, Emp Code, Center..."
                  value={slotReplacementSearch}
                  onChange={(e) => {
                    setSlotReplacementSearch(e.target.value);
                    fetchStoredSlotReplacements(e.target.value);
                  }}
                  className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <button
                onClick={() => downloadTemplate('slot_replacement')}
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-semibold border border-emerald-200 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-emerald-600" />
                <span>Download Sample Sheet</span>
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4 bg-slate-50">
              {loadingSlotReplacement ? (
                <div className="flex items-center justify-center py-16 gap-2 text-slate-500 text-xs">
                  <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
                  <span>Loading records from MySQL database afae_aeinsight...</span>
                </div>
              ) : slotReplacementList.length === 0 ? (
                <div className="text-center py-16 space-y-2">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center mx-auto">
                    <Repeat className="w-6 h-6" />
                  </div>
                  <div className="text-sm font-semibold text-slate-700">No slot replacement records found</div>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    Upload an Excel sheet named &quot;Slot Replacement&quot; using the 13-column format to store records in MySQL table <code className="font-mono">slot_replacement</code>.
                  </p>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl bg-white overflow-hidden shadow-2xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="p-3">Emp Code</th>
                        <th className="p-3">Trainer Name</th>
                        <th className="p-3">Batch Code</th>
                        <th className="p-3">Alias</th>
                        <th className="p-3">Actual Class Date</th>
                        <th className="p-3">Replacement Class Date</th>
                        <th className="p-3">Center Code</th>
                        <th className="p-3">Center Name</th>
                        <th className="p-3">Approved/Rejected By</th>
                        <th className="p-3">Approval/Rejected Date</th>
                        <th className="p-3">Requested Date</th>
                        <th className="p-3">Request Status</th>
                        <th className="p-3">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-600">
                      {slotReplacementList.map((row, idx) => (
                        <tr key={row.id || idx} className="hover:bg-slate-50/80">
                          <td className="p-3 font-mono font-medium text-slate-900 whitespace-nowrap">{row.emp_code || '-'}</td>
                          <td className="p-3 font-medium text-slate-900 truncate max-w-[140px]" title={row.trainer_name || ''}>{row.trainer_name || '-'}</td>
                          <td className="p-3 font-mono font-semibold text-emerald-700 whitespace-nowrap">{row.batch_code || '-'}</td>
                          <td className="p-3 whitespace-nowrap">{row.alias || '-'}</td>
                          <td className="p-3 font-mono text-[11px] whitespace-nowrap">{row.actual_class_date || '-'}</td>
                          <td className="p-3 font-mono text-[11px] whitespace-nowrap">{row.replacement_class_date || '-'}</td>
                          <td className="p-3 font-mono whitespace-nowrap">{row.center_code || '-'}</td>
                          <td className="p-3 truncate max-w-[130px]" title={row.center_name || ''}>{row.center_name || '-'}</td>
                          <td className="p-3 text-slate-700 truncate max-w-[130px]" title={row.approved_rejected_by || ''}>{row.approved_rejected_by || '-'}</td>
                          <td className="p-3 font-mono text-[11px] whitespace-nowrap">{row.approval_rejected_date || '-'}</td>
                          <td className="p-3 font-mono text-[11px] whitespace-nowrap">{row.requested_date || '-'}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              String(row.request_status || '').toLowerCase().includes('approve') ? 'bg-emerald-100 text-emerald-800' :
                              String(row.request_status || '').toLowerCase().includes('reject') ? 'bg-rose-100 text-rose-800' :
                              'bg-amber-100 text-amber-800'
                            }`}>
                              {row.request_status || '-'}
                            </span>
                          </td>
                          <td className="p-3 text-[11px] truncate max-w-[180px]" title={row.reason || ''}>{row.reason || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 bg-white flex items-center justify-between">
              <div className="text-[11px] text-slate-500">
                Data strictly stored in backend MySQL table <code className="font-mono text-emerald-700">slot_replacement</code> in database <code className="font-mono text-emerald-700">afae_aeinsight</code>. Existing operational tables for Trained, Dropout, Exceptions, and Batch Closure remain completely isolated and unaffected.
              </div>
              <button
                onClick={() => setShowSlotReplacementModal(false)}
                className="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-900 transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RM Challenges Records Modal */}
      {showChallengesModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-purple-50/60">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-xs font-bold text-xs">
                  RM
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <span>RM Challenges Database Records</span>
                    <span className="font-mono text-[10px] bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full font-bold">
                      afae_aeinsight.challenges
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Live records in MySQL database table for RM challenges and impacts ({challengesList.length} loaded)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowChallengesModal(false)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 border-b border-slate-200 bg-white flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative flex-1 w-full sm:max-w-md">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter by RM Name, Challenges, Impact..."
                  value={challengesSearch}
                  onChange={(e) => {
                    setChallengesSearch(e.target.value);
                    fetchStoredChallenges(e.target.value);
                  }}
                  className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <button
                onClick={() => downloadTemplate('challenges')}
                className="flex items-center gap-1.5 px-3 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-xl text-xs font-semibold border border-purple-200 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-purple-600" />
                <span>Download Sample Sheet</span>
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4 bg-slate-50">
              {loadingChallenges ? (
                <div className="flex items-center justify-center py-16 gap-2 text-slate-500 text-xs">
                  <RefreshCw className="w-4 h-4 animate-spin text-purple-600" />
                  <span>Loading records from MySQL database afae_aeinsight...</span>
                </div>
              ) : challengesList.length === 0 ? (
                <div className="text-center py-16 space-y-2">
                  <div className="w-12 h-12 rounded-full bg-purple-50 text-purple-500 flex items-center justify-center mx-auto font-bold text-sm">
                    RM
                  </div>
                  <div className="text-sm font-semibold text-slate-700">No RM challenges records found</div>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    Upload an Excel sheet using the 4-column format (Sl No., RM Name, Challenges, Impact) to store records in MySQL table <code className="font-mono">challenges</code>.
                  </p>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl bg-white overflow-hidden shadow-2xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="p-3 w-16">Sl No.</th>
                        <th className="p-3 w-48">RM Name</th>
                        <th className="p-3">Challenges</th>
                        <th className="p-3">Impact</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-600">
                      {challengesList.map((row, idx) => (
                        <tr key={row.id || idx} className="hover:bg-slate-50/80">
                          <td className="p-3 font-mono font-medium text-slate-900 whitespace-nowrap">{row.sl_no || idx + 1}</td>
                          <td className="p-3 font-medium text-slate-900 truncate max-w-[200px]" title={row.rm_name || ''}>{row.rm_name || '-'}</td>
                          <td className="p-3 text-slate-800 whitespace-pre-wrap leading-relaxed">{row.challenges || '-'}</td>
                          <td className="p-3 text-slate-800 whitespace-pre-wrap leading-relaxed">{row.impact || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 bg-white flex items-center justify-between">
              <div className="text-[11px] text-slate-500">
                RM operational challenges and impact records stored with full text support.
              </div>
              <button
                onClick={() => setShowChallengesModal(false)}
                className="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-900 transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
