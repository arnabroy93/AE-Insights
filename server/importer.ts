import * as XLSX from 'xlsx';
import crypto from 'crypto';
import { getDb, logAudit, saveDbToDisk, resyncExceptionStatuses } from './db.ts';
import { getActiveEngine, getMysqlPool, initMysqlTables } from './mysql.ts';
import type { SourceRow, UploadRecord } from './types.ts';

export function parseNullableNumber(val: any): number | null {
  if (val === undefined || val === null) return null;
  if (typeof val === 'number') return isNaN(val) ? null : val;
  const str = String(val).trim();
  if (str === '' || str.toLowerCase() === 'null' || str.toLowerCase() === 'n/a') return null;
  const num = Number(str);
  return isNaN(num) ? null : num;
}

export function parseSpecialCaseVal(val: any): string | number | null {
  if (val === undefined || val === null) return null;
  const str = String(val).trim();
  if (str === '' || str === '0') return null;
  if (str === '1') return 1;
  return str;
}

// The 30 Standard Source Schema Columns with comprehensive fuzzy aliases
export const EXPECTED_SCHEMA_COLUMNS = [
  {
    key: 'center_code',
    name: 'Center Code',
    required: true,
    aliases: ['center code', 'centercode', 'center_code', 'center', 'centre', 'centre code', 'center name', 'center_name', 'centre_code']
  },
  {
    key: 'funder_name',
    name: 'Funder Name',
    required: true,
    aliases: ['funder name', 'fundername', 'funder_name', 'funder', 'donor', 'donor name', 'partner', 'funder_partner', 'donor_name']
  },
  {
    key: 'program_name',
    name: 'Programname',
    required: true,
    aliases: ['programname', 'program name', 'program_name', 'program', 'course name', 'project name', 'project']
  },
  {
    key: 'assigned_trainers',
    name: 'Assigned Trainers',
    required: true,
    aliases: ['assigned trainers', 'assigned trainer', 'trainer', 'trainers', 'trainer name', 'assigned_trainers', 'faculty', 'assigned faculty', 'trainer_name']
  },
  {
    key: 'assigned_ae',
    name: 'Assigned AE',
    required: true,
    aliases: ['assigned ae', 'ae', 'assigned_ae', 'academic excellence member', 'ae member', 'assigned academic excellence', 'ae name', 'assigned_ae_member']
  },
  {
    key: 'rm_sh_zh',
    name: 'RM / SH / ZH',
    required: false,
    aliases: ['rm / sh / zh', 'rm/sh/zh', 'rm_sh_zh', 'rm', 'sh', 'zh', 'regional manager', 'state head', 'zonal head', 'rm / sh /zh', 'rm/sh']
  },
  {
    key: 'batch_code',
    name: 'Batch Code',
    required: true,
    aliases: ['batch code', 'batchcode', 'batch_code', 'batch', 'batch id', 'batch name', 'batch_id', 'batch_name']
  },
  {
    key: 'course_code',
    name: 'Course Code',
    required: false,
    aliases: ['course code', 'coursecode', 'course_code', 'course', 'course id', 'course_id']
  },
  {
    key: 'batch_start_date',
    name: 'Batch Start Date',
    required: false,
    aliases: ['batch start date', 'start date', 'batch_start_date', 'startdate', 'start_date', 'batch start']
  },
  {
    key: 'batch_initial_start_date',
    name: 'Batch Initial Start Date',
    required: false,
    aliases: ['batch initial start date', 'initial start date', 'batch_initial_start_date', 'initial_start_date']
  },
  {
    key: 'batch_initial_end_date',
    name: 'Batch Initial End Date',
    required: false,
    aliases: ['batch initial end date', 'initial end date', 'batch_initial_end_date', 'initial_end_date']
  },
  {
    key: 'batch_end_date',
    name: 'Batch End Date',
    required: false,
    aliases: ['batch end date', 'end date', 'planned end date', 'batch_end_date', 'enddate', 'end_date', 'batch end']
  },
  {
    key: 'batch_actual_end_date',
    name: 'Batch Actual End Date',
    required: false,
    aliases: ['batch actual end date', 'actual end date', 'batch_actual_end_date', 'actual_end_date']
  },
  {
    key: 'batch_status',
    name: 'Batch Status',
    required: true,
    aliases: ['batch status', 'batchstatus', 'batch_status', 'status', 'batch state', 'batch_state']
  },
  {
    key: 'batch_validation_status',
    name: 'Batch Validation Status',
    required: false,
    aliases: ['batch validation status', 'batch_validation_status', 'batch validation', 'batch_validation']
  },
  {
    key: 'student_code',
    name: 'Student Code',
    required: true,
    aliases: ['student code', 'studentcode', 'student_code', 'student id', 'student', 'student_id', 'candidate id', 'candidate_code', 'reg id', 'registration id']
  },
  {
    key: 'enrollment_status',
    name: 'Enrollment Status',
    required: true,
    aliases: ['enrollment status', 'enrollmentstatus', 'enrollment_status', 'student status', 'enrolment status', 'enrolment_status']
  },
  {
    key: 'dropout_type',
    name: 'Dropout(modified)',
    required: false,
    aliases: ['dropout(modified)', 'dropout type', 'dropout_type', 'dropout', 'dropout reason', 'drop out', 'dropout category']
  },
  {
    key: 'email_verification_status',
    name: 'Email verification status',
    required: false,
    aliases: ['email verification status', 'email_verification_status', 'email verification', 'email status', 'email verified', 'email_verified']
  },
  {
    key: 'final_exam_marks',
    name: 'Final Exam Marks',
    required: false,
    aliases: ['final exam marks', 'exam marks', 'final_exam_marks', 'score', 'marks', 'exam score', 'final score', 'exam_marks']
  },
  {
    key: 'placement_type',
    name: 'Placement Type',
    required: false,
    aliases: ['placement type', 'placement_type', 'placement', 'placement status', 'placement_status']
  },
  {
    key: 'exam_schedule_date',
    name: 'Exam Schedule Date',
    required: false,
    aliases: ['exam schedule date', 'exam date', 'exam_schedule_date', 'exam schedule', 'exam_date']
  },
  {
    key: 'ilt_completion',
    name: 'ILT completion%',
    required: false,
    aliases: ['ilt completion%', 'ilt completion', 'ilt_completion', 'ilt completion %', 'ilt_percentage']
  },
  {
    key: 'ilt_as_on_joining_date',
    name: 'ILT_as_on_Joining_Date',
    required: false,
    aliases: ['ilt_as_on_joining_date', 'ilt as on joining date', 'ilt percentage as on joining date', 'ilt % as on joining date', 'ilt_percentage_as_on_joining_date']
  },
  {
    key: 'fm_class_completion',
    name: 'FM Class Completion % (Running)',
    required: false,
    aliases: ['fm class completion % (running)', 'fm class completion %', 'fm completion %', 'fm completion', 'fm_class_completion', 'fm %', 'fm class %']
  },
  {
    key: 'running_attendance',
    name: 'Running Attendance %',
    required: false,
    aliases: ['running attendance %', 'running attendance', 'running_attendance', 'attendance %', 'attendance', 'running att %', 'running att', 'attendance_percentage']
  },
  {
    key: 'beneficiary_class_attendance',
    name: 'Beneficiary Class Attendance %',
    required: false,
    aliases: ['beneficiary class attendance %', 'beneficiary attendance %', 'beneficiary attendance', 'beneficiary_class_attendance', 'ben attendance', 'beneficiary class attendance']
  },
  {
    key: 'validation_status',
    name: 'Validation Status Student wise',
    required: false,
    aliases: ['validation status student wise', 'validation status', 'student validation status', 'validation_status', 'student validation', 'validation status student-wise']
  },
  {
    key: 'validation_done_by',
    name: 'Validation done by',
    required: false,
    aliases: ['validation done by', 'validator', 'validation_done_by', 'validated by', 'validator name', 'validation_by']
  },
  {
    key: 'special_case',
    name: 'Special Case',
    required: false,
    aliases: ['special case', 'special_case', 'specialcase', 'special', 'special case ']
  },
  {
    key: 'joining_date',
    name: 'Joining Date',
    required: false,
    aliases: ['joining date', 'joining_date', 'joiningdate', 'date of joining', 'doj', 'student joining date', 'candidate joining date', 'enrollment date', 'joining date ']
  }
];

export interface FileAnalysisResult {
  fileName: string;
  fileSize: number;
  sheetNames: string[];
  selectedSheet: string;
  totalRows: number;
  totalColumns: number;
  detectedHeaders: string[];
  suggestedMapping: Record<string, string>; // expected_key -> detected_header
  missingRequired: string[];
  missingOptional: string[];
  unknownHeaders: string[];
  previewRows: any[];
}

export interface ValidationSummary {
  totalRows: number;
  validRowsCount: number;
  warningRowsCount: number;
  invalidRowsCount: number;
  duplicateCount: number;
  issues: {
    rowNumber: number;
    studentCode: string;
    batchCode: string;
    type: 'error' | 'warning';
    field: string;
    message: string;
  }[];
}

// Robust Helper to convert any Date/Number/String into ISO date string 'YYYY-MM-DD' or null (strictly safe for MySQL DATE datatype)
export function parseIsoDate(val: any): string | null {
  if (val === null || val === undefined || val === '') return null;

  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    // Excel cellDates can sometimes shift by local timezone offset if close to midnight; round to nearest UTC day if needed
    const roundedMs = val.getTime() + 12 * 3600 * 1000;
    const d = new Date(roundedMs);
    return `${String(d.getUTCFullYear()).padStart(4, '0')}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  }

  // Handle Excel numeric serial dates (e.g. 45230)
  if (typeof val === 'number' && val > 15000 && val < 80000) {
    const utcDays = Math.floor(val - 25569);
    const dateObj = new Date(utcDays * 86400 * 1000);
    if (!isNaN(dateObj.getTime())) {
      return dateObj.toISOString().split('T')[0];
    }
  }

  const str = String(val).trim();
  if (!str) return null;
  const lower = str.toLowerCase();
  if (lower === 'null' || lower === 'n/a' || lower === 'na' || lower === '-' || lower === '--' || lower === 'none' || str === '0000-00-00') {
    return null;
  }

  // If numeric string (Excel serial)
  const num = Number(str);
  if (!isNaN(num) && num > 15000 && num < 80000) {
    const utcDays = Math.floor(num - 25569);
    const dateObj = new Date(utcDays * 86400 * 1000);
    if (!isNaN(dateObj.getTime())) {
      return dateObj.toISOString().split('T')[0];
    }
  }

  // Handle YYYY-MM-DD or YYYY/MM/DD (with optional trailing time)
  const isoMatch = str.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})(?:\s|T|$)/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10);
    const day = parseInt(isoMatch[3], 10);
    if (year >= 1900 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // Handle DD/MM/YYYY or DD-MM-YYYY or MM/DD/YYYY (with optional trailing time)
  const dateMatch = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})(?:\s|T|$)/);
  if (dateMatch) {
    const p1 = parseInt(dateMatch[1], 10);
    const p2 = parseInt(dateMatch[2], 10);
    let year = parseInt(dateMatch[3], 10);
    if (year < 100) year += 2000;
    let day = p1;
    let month = p2;
    if (p1 <= 12 && p2 > 12) {
      day = p2;
      month = p1;
    }
    if (year >= 1900 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const d = new Date(Date.UTC(year, month - 1, day));
      if (!isNaN(d.getTime())) {
        return d.toISOString().split('T')[0];
      }
    }
  }

  // Handle DD-MMM-YYYY or DD MMM YYYY (e.g. 15-Aug-2025, 15 Aug 25)
  const monthNames: Record<string, number> = {
    jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
    may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8,
    sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12
  };
  const namedMonthMatch = str.match(/^(\d{1,2})[\s\-\/\.]+([a-zA-Z]+)[\s\-\/\.,]+(\d{2,4})(?:\s|T|$)/);
  if (namedMonthMatch) {
    const day = parseInt(namedMonthMatch[1], 10);
    const mName = namedMonthMatch[2].toLowerCase();
    let year = parseInt(namedMonthMatch[3], 10);
    if (year < 100) year += 2000;
    const month = monthNames[mName];
    if (month && year >= 1900 && year <= 2100 && day >= 1 && day <= 31) {
      return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getUTCFullYear();
    if (y >= 1900 && y <= 2100) {
      return parsed.toISOString().split('T')[0];
    }
  }

  return null;
}

// Robust Helper to convert any percentage/decimal number or string into a 0.0 - 1.0+ float
export function parsePercentageDecimal(val: any): number | null {
  if (val === null || val === undefined || val === '') return null;
  
  if (typeof val === 'number') {
    if (isNaN(val)) return null;
    // Numbers <= 2.0 (e.g. 0.85 = 85%, 1.0 = 100%, 1.0496 = 104.96%) are already in decimal ratio format.
    // Only numbers > 2.0 (e.g. 50, 75, 90, 100 entered as whole numbers) are divided by 100.
    if (val > 2.0) return val / 100;
    return Math.max(0, val);
  }

  let str = String(val).trim().replace(',', '.');
  if (str.includes('%')) {
    str = str.replace('%', '').trim();
    const num = parseFloat(str);
    if (isNaN(num)) return null;
    return Math.max(0, num / 100);
  }

  const num = parseFloat(str);
  if (isNaN(num)) return null;
  if (num > 2.0) return num / 100;
  return Math.max(0, num);
}

// Anudip Exception Formula Logic
export function evaluateStudentExceptionLogic(row: {
  enrollment_status?: string | null;
  batch_status?: string | null;
  program_name?: string | null;
  placement_type?: string | null;
  ilt_completion?: number | null;
  ilt_as_on_joining_date?: number | null;
  ILT_as_on_Joining_Date?: number | null;
  fm_class_completion?: number | null;
  beneficiary_class_attendance?: number | null;
  running_attendance?: number | null;
  dropout_type?: string | null;
  final_exam_marks?: number | null;
  special_case?: string | number | null;
  joining_date?: string | null;
  batch_actual_end_date?: string | null;
  validation_status?: string | null;
  status?: string | null;
  approval_status?: string | null;
}): { isException: number; isTrained: number; reason: string } {
  const enrollmentStatus = String(row.enrollment_status || '').trim().toLowerCase();
  const batchStatus = String(row.batch_status || '').trim().toLowerCase();
  const isBatchComplete = batchStatus === 'complete' || batchStatus === 'completed';
  const placementRaw = String(row.placement_type || '').trim();
  const placementType = placementRaw.toLowerCase();
  const hasPlacementType = placementType !== '' && placementType !== '—' && placementType !== '-' && placementType !== 'null' && placementType !== 'na' && placementType !== 'n/a';
  const finalExamMarks = row.final_exam_marks !== null && row.final_exam_marks !== undefined && String(row.final_exam_marks).trim() !== '' ? Number(row.final_exam_marks) : null;
  const validationStatus = String(row.validation_status ?? row.status ?? row.approval_status ?? '').trim().toLowerCase();

  // 1. Trained Count Check: Batch Status = Complete or Running, Enrollment Status = 'Enrolled', Final Exam Marks >= 50
  const isBatchCompleteOrRunning = isBatchComplete || batchStatus === 'running';
  const isTrained = (
    isBatchCompleteOrRunning &&
    enrollmentStatus === 'enrolled' &&
    finalExamMarks !== null &&
    !isNaN(finalExamMarks) &&
    finalExamMarks >= 50
  ) ? 1 : 0;

  // Special Approval check: If status = "Special Approval" or "Approved Exception", exception count becomes zero
  if (
    validationStatus.includes('special approval') ||
    validationStatus.includes('special approved') ||
    validationStatus === 'approved exception'
  ) {
    return { isException: 0, isTrained, reason: 'Exempt: Special Approval granted in Exception Approval Report (Exception Count = 0)' };
  }

  // Excel Formula Gate: =If(Trained Count<>1, 0, ...)
  if (isTrained !== 1) {
    return { isException: 0, isTrained: 0, reason: 'Trained Count <> 1 (Exception Count = 0)' };
  }

  // Student Status: Enrolled Status="Enrolled" and Placement Type=" " -> "Running", else Placed categories
  const studentStatus = !hasPlacementType ? 'Running' : 'Placed';

  // Metrics Normalization (0.0 to 1.0+): ILT completion%, ILT_as_on_Joining_Date, and Beneficiary Class Attendance %
  const rawIlt = row.ilt_completion !== null && row.ilt_completion !== undefined && String(row.ilt_completion).trim() !== ''
    ? Number(row.ilt_completion)
    : Number(row.fm_class_completion ?? 0);
  const iltPct = rawIlt > 2.0 ? rawIlt / 100 : Math.max(0, rawIlt);

  const rawAtt = row.beneficiary_class_attendance !== null && row.beneficiary_class_attendance !== undefined && String(row.beneficiary_class_attendance).trim() !== ''
    ? Number(row.beneficiary_class_attendance)
    : Number(row.running_attendance ?? 0);
  const attendancePct = rawAtt > 2.0 ? rawAtt / 100 : Math.max(0, rawAtt);

  const rawRunningAtt = row.running_attendance !== null && row.running_attendance !== undefined && String(row.running_attendance).trim() !== ''
    ? Number(row.running_attendance)
    : 0;
  const runningAttPct = rawRunningAtt > 2.0 ? rawRunningAtt / 100 : Math.max(0, rawRunningAtt);

  const joiningIltCandidate = row.ilt_as_on_joining_date ?? row.ILT_as_on_Joining_Date;
  let iltJoiningPct: number;
  if (joiningIltCandidate !== null && joiningIltCandidate !== undefined && String(joiningIltCandidate).trim() !== '') {
    const rawIltJoining = Number(joiningIltCandidate);
    iltJoiningPct = rawIltJoining > 2.0 ? rawIltJoining / 100 : Math.max(0, rawIltJoining);
  } else if (runningAttPct > 0 && attendancePct > 0) {
    // Derive ILT_as_on_Joining_Date from Beneficiary Class Attendance % / Running Attendance % when column is not populated
    iltJoiningPct = attendancePct / runningAttPct;
  } else {
    iltJoiningPct = iltPct;
  }

  const EPS = 1e-9;
  const minRequiredAttendanceIlt = Math.min(iltPct * 0.5, 0.50);
  const minRequiredAttendanceJoining = Math.min(iltJoiningPct * 0.5, 0.50);

  const joiningDateIso = parseIsoDate(row.joining_date);
  const actualEndDateIso = parseIsoDate(row.batch_actual_end_date);
  const isJoiningAfterActualEnd = Boolean(joiningDateIso && actualEndDateIso && joiningDateIso > actualEndDateIso);

  // Branch 1: If(And(Student Status="Placed", Batch Status="Complete", Joining Date > Batch Actual End Date),
  //              If(And(ILT completion%>=90%, Beneficiary Class Attendance %>=Min(ILT completion%*50%,50%)), 0, 1), ...)
  if (studentStatus === 'Placed' && isBatchComplete && isJoiningAfterActualEnd) {
    if (iltPct + EPS >= 0.90 && attendancePct + EPS >= minRequiredAttendanceIlt) {
      return {
        isException: 0,
        isTrained: 1,
        reason: 'Compliant: Placed with Joining Date > Batch Actual End Date meets ILT completion% >= 90% and Attendance >= Min(ILT completion%*50%, 50%)'
      };
    }
    return {
      isException: 1,
      isTrained: 1,
      reason: 'Exception: Placed with Joining Date > Batch Actual End Date (Requires ILT completion% >= 90% & Attendance >= Min(ILT completion%*50%, 50%))'
    };
  }

  // Branch 2 (Else):
  // If(Or(
  //   And(Student Status="Running", ILT completion%>=90%, Beneficiary Class Attendance %>=Min(ILT completion%*50%,50%)),
  //   And(Placement Type="Placed By Anudip Crd", ILT_as_on_Joining_Date>=70%, Beneficiary Class Attendance %>=Min(ILT_as_on_Joining_Date*50%,50%)),
  //   And(Placement Type="Placed By Anudip Center/Local", ILT_as_on_Joining_Date>=70%, Beneficiary Class Attendance %>=Min(ILT_as_on_Joining_Date*50%,50%)),
  //   And(Placement Type="Self Placed", ILT_as_on_Joining_Date>=50%, Beneficiary Class Attendance %>=Min(ILT_as_on_Joining_Date*50%,50%)),
  //   And(Placement Type="Placed By College/Campus", ILT_as_on_Joining_Date>=50%, Beneficiary Class Attendance %>=Min(ILT_as_on_Joining_Date*50%,50%))
  // ), 0, 1)
  const isCrd = placementType === 'placed by anudip crd' || placementType.includes('crd');
  const isCenterLocal = placementType === 'placed by anudip center/local' || placementType.includes('center') || placementType.includes('local');
  const isSelfPlaced = placementType === 'self placed' || placementType.includes('self');
  const isCollegeCampus = placementType === 'placed by college/campus' || placementType.includes('college') || placementType.includes('campus');

  const condRunning = studentStatus === 'Running' && iltPct + EPS >= 0.90 && attendancePct + EPS >= minRequiredAttendanceIlt;
  const condCrd = isCrd && iltJoiningPct + EPS >= 0.70 && attendancePct + EPS >= minRequiredAttendanceJoining;
  const condCenterLocal = isCenterLocal && iltJoiningPct + EPS >= 0.70 && attendancePct + EPS >= minRequiredAttendanceJoining;
  const condSelfPlaced = isSelfPlaced && iltJoiningPct + EPS >= 0.50 && attendancePct + EPS >= minRequiredAttendanceJoining;
  const condCollegeCampus = isCollegeCampus && iltJoiningPct + EPS >= 0.50 && attendancePct + EPS >= minRequiredAttendanceJoining;

  if (condRunning || condCrd || condCenterLocal || condSelfPlaced || condCollegeCampus) {
    return {
      isException: 0,
      isTrained: 1,
      reason: studentStatus === 'Running'
        ? 'Compliant: Running student meets ILT completion% >= 90% and Attendance >= Min(ILT completion%*50%, 50%)'
        : `Compliant: ${placementRaw} meets required ILT_as_on_Joining_Date and Attendance >= Min(ILT_as_on_Joining_Date*50%, 50%)`
    };
  }

  if (studentStatus === 'Running') {
    return {
      isException: 1,
      isTrained: 1,
      reason: 'Exception: Running student fails ILT completion% >= 90% or Attendance >= Min(ILT completion%*50%, 50%)'
    };
  }

  if (isCrd || isCenterLocal) {
    return {
      isException: 1,
      isTrained: 1,
      reason: `Exception: ${placementRaw} fails ILT_as_on_Joining_Date >= 70% or Attendance >= Min(ILT_as_on_Joining_Date*50%, 50%)`
    };
  }

  return {
    isException: 1,
    isTrained: 1,
    reason: `Exception: ${placementRaw || 'Placed'} fails ILT_as_on_Joining_Date >= 50% or Attendance >= Min(ILT_as_on_Joining_Date*50%, 50%)`
  };
}

// Find header row in sheet array
function extractHeadersAndRows(rawJson: any[][]): { headers: string[]; dataRows: any[][] } {
  if (!rawJson || rawJson.length === 0) {
    return { headers: [], dataRows: [] };
  }

  // Find the row index that has the most non-empty string cells matching our aliases
  let bestHeaderIndex = 0;
  let maxMatches = 0;

  for (let r = 0; r < Math.min(5, rawJson.length); r++) {
    const row = rawJson[r] || [];
    let matchCount = 0;
    for (const cell of row) {
      if (!cell) continue;
      const clean = String(cell).toLowerCase().trim().replace(/[^a-z0-9]/g, '');
      if (EXPECTED_SCHEMA_COLUMNS.some((col) => col.aliases.some((a) => a.replace(/[^a-z0-9]/g, '') === clean))) {
        matchCount++;
      }
    }
    if (matchCount > maxMatches) {
      maxMatches = matchCount;
      bestHeaderIndex = r;
    }
  }

  const headerRow = rawJson[bestHeaderIndex] || [];
  const headers = headerRow.map((h: any) => String(h || '').trim()).filter(Boolean);
  const dataRows = rawJson.slice(bestHeaderIndex + 1).filter((r: any[]) =>
    r && r.some((cell) => cell !== '' && cell !== null && cell !== undefined)
  );

  return { headers, dataRows };
}

export function parseAndAnalyzeWorkbook(buffer: Buffer, originalFilename: string): FileAnalysisResult {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true, raw: false });
  const sheetNames = workbook.SheetNames;
  if (!sheetNames || sheetNames.length === 0) {
    throw new Error('No worksheets found in uploaded file.');
  }

  // Prefer "Export" sheet as specified in requirements or the first sheet with data
  let selectedSheet = sheetNames.find((s) => s.toLowerCase() === 'export') || sheetNames[0];
  let worksheet = workbook.Sheets[selectedSheet];
  let rawJson: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

  // If selected sheet is empty, check other sheets
  if ((!rawJson || rawJson.length <= 1) && sheetNames.length > 1) {
    for (const name of sheetNames) {
      const ws = workbook.Sheets[name];
      const json: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      if (json && json.length > 1) {
        selectedSheet = name;
        worksheet = ws;
        rawJson = json;
        break;
      }
    }
  }

  if (!rawJson || rawJson.length === 0) {
    throw new Error('The selected worksheet is completely empty.');
  }

  const { headers: detectedHeaders, dataRows } = extractHeadersAndRows(rawJson);

  // Auto-map headers using 2-pass matching (Pass 1: exact match, Pass 2: substring match on unclaimed headers)
  const suggestedMapping: Record<string, string> = {};
  const missingRequired: string[] = [];
  const missingOptional: string[] = [];
  const claimedHeaders = new Set<string>();

  // Pass 1: Exact match
  for (const expected of EXPECTED_SCHEMA_COLUMNS) {
    const exactMatch = detectedHeaders.find((h) => {
      if (claimedHeaders.has(h)) return false;
      const lower = h.toLowerCase().trim();
      const stripped = lower.replace(/[^a-z0-9]/g, '');
      const expStripped = expected.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (stripped === expStripped || lower === expected.key.toLowerCase()) return true;
      return expected.aliases.some((alias) => {
        const aliasStripped = alias.toLowerCase().replace(/[^a-z0-9]/g, '');
        return lower === alias.toLowerCase().trim() || stripped === aliasStripped;
      });
    });
    if (exactMatch) {
      suggestedMapping[expected.key] = exactMatch;
      claimedHeaders.add(exactMatch);
    }
  }

  // Pass 2: Substring match on remaining unclaimed headers
  for (const expected of EXPECTED_SCHEMA_COLUMNS) {
    if (suggestedMapping[expected.key]) continue;
    const fuzzyMatch = detectedHeaders.find((h) => {
      if (claimedHeaders.has(h)) return false;
      const lower = h.toLowerCase().trim();
      const stripped = lower.replace(/[^a-z0-9]/g, '');
      return expected.aliases.some((alias) => {
        const aliasStripped = alias.toLowerCase().replace(/[^a-z0-9]/g, '');
        return stripped.includes(aliasStripped) || aliasStripped.includes(stripped);
      });
    });

    if (fuzzyMatch) {
      suggestedMapping[expected.key] = fuzzyMatch;
      claimedHeaders.add(fuzzyMatch);
    } else {
      if (expected.required) {
        missingRequired.push(expected.name);
      } else {
        missingOptional.push(expected.name);
      }
    }
  }

  const matchedValues = new Set(Object.values(suggestedMapping));
  const unknownHeaders = detectedHeaders.filter((h) => !matchedValues.has(h));

  // Preview 10 rows
  const previewRows: any[] = [];
  const previewLimit = Math.min(10, dataRows.length);
  for (let i = 0; i < previewLimit; i++) {
    const rowObj: any = {};
    detectedHeaders.forEach((header, idx) => {
      rowObj[header] = dataRows[i][idx] !== undefined ? dataRows[i][idx] : '';
    });
    previewRows.push(rowObj);
  }

  return {
    fileName: originalFilename,
    fileSize: buffer.length,
    sheetNames,
    selectedSheet,
    totalRows: dataRows.length,
    totalColumns: detectedHeaders.length,
    detectedHeaders,
    suggestedMapping,
    missingRequired,
    missingOptional,
    unknownHeaders,
    previewRows,
  };
}

export function validateUploadedData(
  buffer: Buffer,
  sheetName: string,
  columnMapping: Record<string, string>
): { validation: ValidationSummary; transformedRows: SourceRow[] } {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const worksheet = workbook.Sheets[sheetName] || workbook.Sheets[workbook.SheetNames[0]];
  if (!worksheet) throw new Error(`Sheet "${sheetName}" does not exist.`);

  const rawJson: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
  const { headers, dataRows } = extractHeadersAndRows(rawJson);

  return validateDataMatrix(dataRows, headers, columnMapping);
}

export function validateDataMatrix(
  dataRows: any[][],
  headers: string[],
  columnMapping: Record<string, string>
): { validation: ValidationSummary; transformedRows: SourceRow[] } {
  const headerIndexMap: Record<string, number> = {};
  headers.forEach((h, idx) => {
    headerIndexMap[h] = idx;
  });

  const issues: ValidationSummary['issues'] = [];
  const transformedRows: SourceRow[] = [];
  const seenStudentBatchKeys = new Set<string>();

  let validCount = 0;
  let warningCount = 0;
  let invalidCount = 0;
  let duplicateCount = 0;

  const getCell = (rowArr: any[], key: string): any => {
    let mappedHeader: string | undefined = columnMapping[key];
    if (!mappedHeader) {
      const colDef = EXPECTED_SCHEMA_COLUMNS.find((c) => c.key === key);
      if (colDef) {
        mappedHeader = headers.find((h) => {
          const lower = String(h || '').toLowerCase().trim();
          const stripped = lower.replace(/[^a-z0-9]/g, '');
          return colDef.aliases.some((alias) => {
            const aliasStripped = alias.toLowerCase().replace(/[^a-z0-9]/g, '');
            return lower === alias.toLowerCase() || stripped === aliasStripped || stripped.includes(aliasStripped) || aliasStripped.includes(stripped);
          });
        });
      }
    }
    if (!mappedHeader) return null;
    const colIdx = headerIndexMap[mappedHeader];
    if (colIdx === undefined) return null;
    const val = rowArr[colIdx];
    return val !== undefined && val !== null ? val : null;
  };

  dataRows.forEach((rowArr, rowIndex) => {
    const rowNumber = rowIndex + 2; // 1-indexed including header
    if (!rowArr.some((c: any) => c !== '' && c !== null && c !== undefined)) {
      return; // Skip blank rows
    }

    let hasError = false;
    let hasWarning = false;

    let studentCode = String(getCell(rowArr, 'student_code') || '').trim();
    let batchCode = String(getCell(rowArr, 'batch_code') || '').trim();
    let centerCode = String(getCell(rowArr, 'center_code') || '').trim();
    let funderName = String(getCell(rowArr, 'funder_name') || '').trim();
    let programName = String(getCell(rowArr, 'program_name') || '').trim();
    let assignedTrainers = String(getCell(rowArr, 'assigned_trainers') || '').trim();
    let assignedAe = String(getCell(rowArr, 'assigned_ae') || '').trim();
    let batchStatus = String(getCell(rowArr, 'batch_status') || '').trim();
    let enrollmentStatus = String(getCell(rowArr, 'enrollment_status') || '').trim();

    // Fallbacks for missing non-critical mandatory fields
    if (!centerCode && batchCode) {
      // Try to infer center code from batch prefix e.g. "BCH-WBCOE-101" -> "WBCOE"
      const match = batchCode.match(/^[A-Za-z]+-([A-Za-z0-9]+)/);
      centerCode = match ? match[1] : 'Center 1';
    }
    if (!centerCode) centerCode = 'Center 1';
    if (!funderName) funderName = 'General CSR';
    if (!programName) programName = 'Digital Skills';
    if (!assignedTrainers) assignedTrainers = 'Faculty Trainer';
    if (!assignedAe) assignedAe = 'Academic Excellence';
    if (!batchStatus) batchStatus = 'running';
    if (!enrollmentStatus) enrollmentStatus = 'enrolled';

    // Truly Mandatory validations
    if (!studentCode) {
      // If student code is missing, generate a deterministic row-based identifier
      studentCode = `STU-GEN-${rowNumber}`;
      hasWarning = true;
      issues.push({
        rowNumber,
        studentCode: 'Auto-Generated',
        batchCode: batchCode || 'N/A',
        type: 'warning',
        field: 'Student Code',
        message: `Missing student code in row ${rowNumber}. Auto-assigned ${studentCode}`
      });
    }

    if (!batchCode) {
      hasError = true;
      issues.push({
        rowNumber,
        studentCode,
        batchCode: 'N/A',
        type: 'error',
        field: 'Batch Code',
        message: 'Missing mandatory Batch Code'
      });
    }

    // Duplicate detection
    const uniqueKey = `${studentCode}_${batchCode}`.toLowerCase();
    if (seenStudentBatchKeys.has(uniqueKey)) {
      duplicateCount++;
      hasWarning = true;
      issues.push({
        rowNumber,
        studentCode,
        batchCode,
        type: 'warning',
        field: 'Record Duplicate',
        message: `Duplicate Student (${studentCode}) in Batch (${batchCode})`
      });
    } else {
      seenStudentBatchKeys.add(uniqueKey);
    }

    // Attendance & Progress
    const runningAttendanceRaw = getCell(rowArr, 'running_attendance');
    const runningAttendance = parsePercentageDecimal(runningAttendanceRaw);
    if (runningAttendanceRaw !== null && runningAttendanceRaw !== '' && runningAttendance === null) {
      hasWarning = true;
      issues.push({
        rowNumber,
        studentCode,
        batchCode,
        type: 'warning',
        field: 'Running Attendance %',
        message: `Unparseable attendance: "${runningAttendanceRaw}"`
      });
    }

    const iltCompletion = parsePercentageDecimal(getCell(rowArr, 'ilt_completion'));
    const iltAsOnJoiningDate = parsePercentageDecimal(getCell(rowArr, 'ilt_as_on_joining_date'));
    const fmCompletion = parsePercentageDecimal(getCell(rowArr, 'fm_class_completion'));
    const beneficiaryAttendance = parsePercentageDecimal(getCell(rowArr, 'beneficiary_class_attendance'));

    const examMarksRaw = getCell(rowArr, 'final_exam_marks');
    let finalExamMarks: number | null = null;
    if (examMarksRaw !== null && examMarksRaw !== '') {
      const num = Number(examMarksRaw);
      if (!isNaN(num)) finalExamMarks = num;
    }

    const validationStatusStr = String(getCell(rowArr, 'validation_status') || 'Not Available').trim();
    const placementTypeStr = String(getCell(rowArr, 'placement_type') || '').trim();
    const specialCaseRaw = getCell(rowArr, 'special_case');
    const parsedActualEndDate = parseIsoDate(getCell(rowArr, 'batch_actual_end_date'));
    const parsedJoiningDate = parseIsoDate(getCell(rowArr, 'joining_date'));
    const evaluatedException = evaluateStudentExceptionLogic({
      enrollment_status: enrollmentStatus,
      batch_status: batchStatus,
      program_name: programName,
      placement_type: placementTypeStr,
      ilt_completion: iltCompletion,
      ilt_as_on_joining_date: iltAsOnJoiningDate,
      fm_class_completion: fmCompletion,
      beneficiary_class_attendance: beneficiaryAttendance,
      running_attendance: runningAttendance,
      dropout_type: String(getCell(rowArr, 'dropout_type') || '').trim() || null,
      final_exam_marks: finalExamMarks,
      special_case: specialCaseRaw,
      joining_date: parsedJoiningDate,
      batch_actual_end_date: parsedActualEndDate,
      validation_status: validationStatusStr,
    });

    const attendanceException = evaluatedException.isException;
    const moduleException = 0;

    if (hasError) {
      invalidCount++;
    } else if (hasWarning) {
      warningCount++;
      validCount++;
    } else {
      validCount++;
    }

    if (!hasError) {
      transformedRows.push({
        center_code: centerCode,
        funder_name: funderName,
        program_name: programName,
        assigned_trainers: assignedTrainers,
        assigned_ae: assignedAe,
        rm_sh_zh: String(getCell(rowArr, 'rm_sh_zh') || '').trim() || 'General Operations',
        batch_code: batchCode,
        course_code: String(getCell(rowArr, 'course_code') || '').trim(),
        batch_start_date: parseIsoDate(getCell(rowArr, 'batch_start_date')),
        batch_initial_start_date: parseIsoDate(getCell(rowArr, 'batch_initial_start_date')),
        batch_initial_end_date: parseIsoDate(getCell(rowArr, 'batch_initial_end_date')),
        batch_end_date: parseIsoDate(getCell(rowArr, 'batch_end_date')),
        batch_actual_end_date: parseIsoDate(getCell(rowArr, 'batch_actual_end_date')),
        batch_status: batchStatus,
        batch_validation_status: String(getCell(rowArr, 'batch_validation_status') || 'Not Yet Validated').trim(),
        student_code: studentCode,
        enrollment_status: enrollmentStatus,
        dropout_type: String(getCell(rowArr, 'dropout_type') || '').trim() || null,
        email_verification_status: String(getCell(rowArr, 'email_verification_status') || 'y').trim(),
        final_exam_marks: finalExamMarks,
        placement_type: String(getCell(rowArr, 'placement_type') || '').trim() || null,
        exam_schedule_date: parseIsoDate(getCell(rowArr, 'exam_schedule_date')),
        ilt_completion: iltCompletion,
        ilt_as_on_joining_date: iltAsOnJoiningDate,
        fm_class_completion: fmCompletion,
        running_attendance: runningAttendance,
        beneficiary_class_attendance: beneficiaryAttendance,
        incomplete_attendance_exception: attendanceException,
        incomplete_module_exception: moduleException,
        is_exception: attendanceException,
        special_case: specialCaseRaw !== null && specialCaseRaw !== undefined ? String(specialCaseRaw).trim() : null,
        joining_date: parseIsoDate(getCell(rowArr, 'joining_date')),
        validation_status: String(getCell(rowArr, 'validation_status') || 'Not Available').trim(),
        validation_done_by: String(getCell(rowArr, 'validation_done_by') || '').trim() || null,
      });
    }
  });

  return {
    validation: {
      totalRows: dataRows.length,
      validRowsCount: validCount,
      warningRowsCount: warningCount,
      invalidRowsCount: invalidCount,
      duplicateCount,
      issues: issues.slice(0, 300),
    },
    transformedRows,
  };
}

export async function commitImport(
  fileName: string,
  sheetName: string,
  uploadedBy: string,
  rows: SourceRow[],
  duplicateMode: 'skip' | 'update' | 'import_new',
  validCount: number,
  invalidCount: number,
  duplicateCount: number
): Promise<UploadRecord> {
  const startTime = Date.now();
  const uploadId = 'UPL-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
  const uploadedAt = new Date().toISOString();
  const sourceHash = crypto.createHash('sha256').update(fileName + uploadedAt + rows.length).digest('hex').substring(0, 16);

  let finalRowsToInsert = rows.filter((r) => r.student_code && r.batch_code).map((r) => {
    const evalRes = evaluateStudentExceptionLogic(r);
    return {
      ...r,
      incomplete_attendance_exception: evalRes.isException,
    };
  });

  const isMysql = getActiveEngine() === 'mysql';
  const mysqlPool = isMysql ? await getMysqlPool() : null;

  if (isMysql && mysqlPool) {
    // -------------------------------------------------------------------------
    // 1. MySQL Execution Path (afae_aeinsight database -> raw_records)
    // -------------------------------------------------------------------------
    const conn = await mysqlPool.getConnection();
    try {
      await initMysqlTables(mysqlPool).catch(() => {});

      if (duplicateMode === 'skip') {
        const [existingPairs]: any = await conn.query('SELECT LOWER(student_code) as sc, LOWER(batch_code) as bc, joining_date FROM raw_records');
        const pairSet = new Set<string>();
        const missingJoiningDateSet = new Set<string>();
        for (const r of existingPairs) {
          const key = `${r.sc}_${r.bc}`;
          pairSet.add(key);
          if (!r.joining_date) missingJoiningDateSet.add(key);
        }

        // Backfill joining_date on existing records if they were previously uploaded without joining_date
        const rowsToBackfill = finalRowsToInsert.filter((r) => {
          const key = `${String(r.student_code).toLowerCase()}_${String(r.batch_code).toLowerCase()}`;
          return missingJoiningDateSet.has(key) && parseIsoDate(r.joining_date);
        });
        for (const bf of rowsToBackfill) {
          await conn.query(
            'UPDATE raw_records SET joining_date = ? WHERE LOWER(student_code) = LOWER(?) AND LOWER(batch_code) = LOWER(?) AND joining_date IS NULL',
            [parseIsoDate(bf.joining_date), bf.student_code, bf.batch_code]
          );
        }

        finalRowsToInsert = finalRowsToInsert.filter((r) => !pairSet.has(`${String(r.student_code).toLowerCase()}_${String(r.batch_code).toLowerCase()}`));
      } else if (duplicateMode === 'update' && finalRowsToInsert.length > 0) {
        const studentCodes = Array.from(new Set(finalRowsToInsert.map(r => String(r.student_code).trim().toLowerCase())));
        if (studentCodes.length > 0) {
          for (let i = 0; i < studentCodes.length; i += 500) {
            const scChunk = studentCodes.slice(i, i + 500);
            await conn.query('DELETE FROM raw_records WHERE LOWER(student_code) IN (?)', [scChunk]);
          }
        }
      }

      await conn.beginTransaction();

      const insertColumns = [
        'center_code', 'funder_name', 'program_name', 'assigned_trainers', 'assigned_ae', 'rm_sh_zh',
        'batch_code', 'course_code', 'batch_start_date', 'batch_initial_start_date', 'batch_initial_end_date',
        'batch_end_date', 'batch_actual_end_date', 'batch_status', 'batch_validation_status',
        'student_code', 'enrollment_status', 'dropout_type', 'email_verification_status',
        'final_exam_marks', 'placement_type', 'exam_schedule_date', 'ilt_completion', 'ilt_as_on_joining_date',
        'fm_class_completion', 'running_attendance', 'beneficiary_class_attendance',
        'incomplete_attendance_exception', 'incomplete_module_exception', 'special_case', 'joining_date', 'validation_status',
        'validation_done_by', 'upload_id'
      ];

      // Bulk insert in chunks of 500 for optimal performance
      const chunkSize = 500;
      if (finalRowsToInsert.length > 0) {
        for (let i = 0; i < finalRowsToInsert.length; i += chunkSize) {
          const chunk = finalRowsToInsert.slice(i, i + chunkSize);
          const chunkTuples = chunk.map(r => [
            r.center_code || 'Center 1',
            r.funder_name || 'General CSR',
            r.program_name || 'Digital Skills',
            r.assigned_trainers || 'Faculty Trainer',
            r.assigned_ae || 'Academic Excellence',
            r.rm_sh_zh || 'General Operations',
            r.batch_code,
            r.course_code || '',
            parseIsoDate(r.batch_start_date) ?? null,
            parseIsoDate(r.batch_initial_start_date) ?? null,
            parseIsoDate(r.batch_initial_end_date) ?? null,
            parseIsoDate(r.batch_end_date) ?? null,
            parseIsoDate(r.batch_actual_end_date) ?? null,
            r.batch_status || 'running',
            r.batch_validation_status || 'Not Yet Validated',
            r.student_code,
            r.enrollment_status || 'enrolled',
            r.dropout_type ?? null,
            r.email_verification_status || 'y',
            parseNullableNumber(r.final_exam_marks),
            r.placement_type ?? null,
            parseIsoDate(r.exam_schedule_date) ?? null,
            parseNullableNumber(r.ilt_completion),
            parseNullableNumber(r.ilt_as_on_joining_date ?? (r as any).ILT_as_on_Joining_Date),
            parseNullableNumber(r.fm_class_completion),
            parseNullableNumber(r.running_attendance),
            parseNullableNumber(r.beneficiary_class_attendance),
            r.incomplete_attendance_exception ? 1 : 0,
            r.incomplete_module_exception ? 1 : 0,
            parseSpecialCaseVal(r.special_case),
            parseIsoDate(r.joining_date) ?? null,
            r.validation_status || 'Not Available',
            r.validation_done_by ?? null,
            uploadId
          ]);

          if (chunkTuples.length > 0) {
            const bulkSql = `INSERT INTO raw_records (${insertColumns.join(', ')}) VALUES ?`;
            await conn.query(bulkSql, [chunkTuples]);
          }
        }
      }

      const durationMs = Date.now() - startTime;
      const uploadRecord: UploadRecord = {
        id: uploadId,
        file_name: fileName,
        sheet_name: sheetName,
        uploaded_by: uploadedBy,
        uploaded_at: uploadedAt,
        row_count: rows.length,
        valid_row_count: finalRowsToInsert.length,
        invalid_row_count: invalidCount,
        duplicate_count: duplicateCount,
        processing_status: 'completed',
        processing_duration_ms: durationMs,
        source_hash: sourceHash,
      };

      await conn.query(
        `INSERT INTO uploads (id, file_name, sheet_name, uploaded_by, uploaded_at, row_count, valid_row_count, invalid_row_count, duplicate_count, processing_status, processing_duration_ms, source_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uploadRecord.id, uploadRecord.file_name, uploadRecord.sheet_name, uploadRecord.uploaded_by,
          uploadRecord.uploaded_at, uploadRecord.row_count, uploadRecord.valid_row_count, uploadRecord.invalid_row_count,
          uploadRecord.duplicate_count, uploadRecord.processing_status, uploadRecord.processing_duration_ms, uploadRecord.source_hash
        ]
      );

      await conn.commit();

      // Also mirror imported records and metadata in local SQLite analytics engine
      try {
        const sqliteDb = await getDb();
        if (duplicateMode === 'update') {
          for (const r of finalRowsToInsert) {
            sqliteDb.run(`DELETE FROM raw_records WHERE LOWER(student_code) = LOWER(?) AND LOWER(batch_code) = LOWER(?)`, [r.student_code, r.batch_code]);
          }
        }
        sqliteDb.run('BEGIN TRANSACTION;');
        const insertStmt = sqliteDb.prepare(`
          INSERT INTO raw_records (
            center_code, funder_name, program_name, assigned_trainers, assigned_ae, rm_sh_zh,
            batch_code, course_code, batch_start_date, batch_initial_start_date, batch_initial_end_date,
            batch_end_date, batch_actual_end_date, batch_status, batch_validation_status,
            student_code, enrollment_status, dropout_type, email_verification_status,
            final_exam_marks, placement_type, exam_schedule_date, ilt_completion, ilt_as_on_joining_date,
            fm_class_completion, running_attendance, beneficiary_class_attendance,
            incomplete_attendance_exception, incomplete_module_exception, special_case, joining_date, validation_status,
            validation_done_by, upload_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const r of finalRowsToInsert) {
          insertStmt.run([
            r.center_code || 'Center 1',
            r.funder_name || 'General CSR',
            r.program_name || 'Digital Skills',
            r.assigned_trainers || 'Faculty Trainer',
            r.assigned_ae || 'Academic Excellence',
            r.rm_sh_zh || 'General Operations',
            r.batch_code,
            r.course_code || '',
            parseIsoDate(r.batch_start_date) ?? null,
            parseIsoDate(r.batch_initial_start_date) ?? null,
            parseIsoDate(r.batch_initial_end_date) ?? null,
            parseIsoDate(r.batch_end_date) ?? null,
            parseIsoDate(r.batch_actual_end_date) ?? null,
            r.batch_status || 'running',
            r.batch_validation_status || 'Not Yet Validated',
            r.student_code,
            r.enrollment_status || 'enrolled',
            r.dropout_type ?? null,
            r.email_verification_status || 'y',
            parseNullableNumber(r.final_exam_marks),
            r.placement_type ?? null,
            parseIsoDate(r.exam_schedule_date) ?? null,
            parseNullableNumber(r.ilt_completion),
            parseNullableNumber(r.ilt_as_on_joining_date ?? (r as any).ILT_as_on_Joining_Date),
            parseNullableNumber(r.fm_class_completion),
            parseNullableNumber(r.running_attendance),
            parseNullableNumber(r.beneficiary_class_attendance),
            r.incomplete_attendance_exception ? 1 : 0,
            r.incomplete_module_exception ? 1 : 0,
            parseSpecialCaseVal(r.special_case),
            parseIsoDate(r.joining_date) ?? null,
            r.validation_status || 'Not Available',
            r.validation_done_by ?? null,
            uploadId
          ]);
        }
        insertStmt.free();

        const insertUpload = sqliteDb.prepare(`
          INSERT INTO uploads (
            id, file_name, sheet_name, uploaded_by, uploaded_at, row_count,
            valid_row_count, invalid_row_count, duplicate_count, processing_status,
            processing_duration_ms, source_hash
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        insertUpload.run([
          uploadRecord.id, uploadRecord.file_name, uploadRecord.sheet_name, uploadRecord.uploaded_by,
          uploadRecord.uploaded_at, uploadRecord.row_count, uploadRecord.valid_row_count, uploadRecord.invalid_row_count,
          uploadRecord.duplicate_count, uploadRecord.processing_status, uploadRecord.processing_duration_ms, uploadRecord.source_hash
        ]);
        insertUpload.free();

        sqliteDb.run('COMMIT;');
        resyncExceptionStatuses(sqliteDb);
        saveDbToDisk();
      } catch (e: any) {
        console.error('Failed to mirror imported records to SQLite:', e.message);
      }

      logAudit(uploadedBy, 'AE Member', 'Data Import Completed', `Imported ${finalRowsToInsert.length} records into MySQL raw_records from ${fileName} (${duplicateMode} mode)`, 'success', uploadId);

      return uploadRecord;
    } catch (err: any) {
      await conn.rollback();
      console.error('MySQL commitImport error:', err);
      throw err;
    } finally {
      conn.release();
    }
  }

  // ---------------------------------------------------------------------------
  // 2. SQLite Execution Path (Fallback when MySQL is not connected)
  // ---------------------------------------------------------------------------
  const db = await getDb();

  if (duplicateMode === 'skip') {
    const existingPairs = new Set<string>();
    const stmt = db.prepare(`SELECT student_code, batch_code FROM raw_records`);
    while (stmt.step()) {
      const obj = stmt.getAsObject();
      existingPairs.add(`${obj.student_code}_${obj.batch_code}`.toLowerCase());
    }
    stmt.free();
    finalRowsToInsert = finalRowsToInsert.filter((r) => !existingPairs.has(`${r.student_code}_${r.batch_code}`.toLowerCase()));
  } else if (duplicateMode === 'update') {
    for (const r of finalRowsToInsert) {
      db.run(`DELETE FROM raw_records WHERE LOWER(student_code) = LOWER(?) AND LOWER(batch_code) = LOWER(?)`, [r.student_code, r.batch_code]);
    }
  }

  // Insert records inside transaction
  db.run('BEGIN TRANSACTION;');

  const insertStmt = db.prepare(`
    INSERT INTO raw_records (
      center_code, funder_name, program_name, assigned_trainers, assigned_ae, rm_sh_zh,
      batch_code, course_code, batch_start_date, batch_initial_start_date, batch_initial_end_date,
      batch_end_date, batch_actual_end_date, batch_status, batch_validation_status,
      student_code, enrollment_status, dropout_type, email_verification_status,
      final_exam_marks, placement_type, exam_schedule_date, ilt_completion, ilt_as_on_joining_date,
      fm_class_completion, running_attendance, beneficiary_class_attendance,
      incomplete_attendance_exception, incomplete_module_exception, special_case, joining_date, validation_status,
      validation_done_by, upload_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const r of finalRowsToInsert) {
    insertStmt.run([
      r.center_code || 'Center 1',
      r.funder_name || 'General CSR',
      r.program_name || 'Digital Skills',
      r.assigned_trainers || 'Faculty Trainer',
      r.assigned_ae || 'Academic Excellence',
      r.rm_sh_zh || 'General Operations',
      r.batch_code,
      r.course_code || '',
      parseIsoDate(r.batch_start_date) ?? null,
      parseIsoDate(r.batch_initial_start_date) ?? null,
      parseIsoDate(r.batch_initial_end_date) ?? null,
      parseIsoDate(r.batch_end_date) ?? null,
      parseIsoDate(r.batch_actual_end_date) ?? null,
      r.batch_status || 'running',
      r.batch_validation_status || 'Not Yet Validated',
      r.student_code,
      r.enrollment_status || 'enrolled',
      r.dropout_type ?? null,
      r.email_verification_status || 'y',
      r.final_exam_marks !== undefined && r.final_exam_marks !== null ? Number(r.final_exam_marks) : null,
      r.placement_type ?? null,
      parseIsoDate(r.exam_schedule_date) ?? null,
      r.ilt_completion !== undefined && r.ilt_completion !== null ? Number(r.ilt_completion) : null,
      parseNullableNumber(r.ilt_as_on_joining_date ?? (r as any).ILT_as_on_Joining_Date),
      r.fm_class_completion !== undefined && r.fm_class_completion !== null ? Number(r.fm_class_completion) : null,
      r.running_attendance !== undefined && r.running_attendance !== null ? Number(r.running_attendance) : null,
      r.beneficiary_class_attendance !== undefined && r.beneficiary_class_attendance !== null ? Number(r.beneficiary_class_attendance) : null,
      r.incomplete_attendance_exception ? 1 : 0,
      r.incomplete_module_exception ? 1 : 0,
      parseSpecialCaseVal(r.special_case),
      parseIsoDate(r.joining_date) ?? null,
      r.validation_status || 'Not Available',
      r.validation_done_by ?? null,
      uploadId
    ]);
  }
  insertStmt.free();

  const durationMs = Date.now() - startTime;

  const uploadRecord: UploadRecord = {
    id: uploadId,
    file_name: fileName,
    sheet_name: sheetName,
    uploaded_by: uploadedBy,
    uploaded_at: uploadedAt,
    row_count: rows.length,
    valid_row_count: finalRowsToInsert.length,
    invalid_row_count: invalidCount,
    duplicate_count: duplicateCount,
    processing_status: 'completed',
    processing_duration_ms: durationMs,
    source_hash: sourceHash,
  };

  db.run(`
    INSERT INTO uploads (id, file_name, sheet_name, uploaded_by, uploaded_at, row_count, valid_row_count, invalid_row_count, duplicate_count, processing_status, processing_duration_ms, source_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    uploadRecord.id, uploadRecord.file_name, uploadRecord.sheet_name, uploadRecord.uploaded_by,
    uploadRecord.uploaded_at, uploadRecord.row_count, uploadRecord.valid_row_count, uploadRecord.invalid_row_count,
    uploadRecord.duplicate_count, uploadRecord.processing_status, uploadRecord.processing_duration_ms, uploadRecord.source_hash
  ]);

  db.run('COMMIT;');
  resyncExceptionStatuses(db);
  saveDbToDisk();

  logAudit(uploadedBy, 'AE Member', 'Data Import Completed', `Imported ${finalRowsToInsert.length} records from ${fileName} (${duplicateMode} mode)`, 'success', uploadId);

  return uploadRecord;
}

export interface CommitImportChunkParams {
  uploadId: string;
  fileName: string;
  sheetName: string;
  uploadedBy: string;
  chunkRows: SourceRow[];
  chunkIndex: number;
  totalChunks: number;
  totalRows: number;
  duplicateMode: 'skip' | 'update' | 'import_new';
  validCount: number;
  invalidCount: number;
  duplicateCount: number;
  isFinal: boolean;
}

export async function commitImportChunk(params: CommitImportChunkParams): Promise<{
  isComplete: boolean;
  chunkIndex: number;
  totalChunks: number;
  upload?: UploadRecord;
}> {
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
  } = params;

  let finalRowsToInsert = (chunkRows || []).filter((r) => r.student_code && r.batch_code).map((r) => {
    const evalRes = evaluateStudentExceptionLogic(r);
    return {
      ...r,
      incomplete_attendance_exception: evalRes.isException,
    };
  });

  const isMysql = getActiveEngine() === 'mysql';
  const mysqlPool = isMysql ? await getMysqlPool() : null;

  if (isMysql && mysqlPool) {
    if (chunkIndex === 0) {
      await initMysqlTables(mysqlPool).catch(() => {});
    }
    const conn = await mysqlPool.getConnection();
    try {
      if (duplicateMode === 'skip' && finalRowsToInsert.length > 0) {
        const studentCodes = Array.from(new Set(finalRowsToInsert.map(r => String(r.student_code).trim().toLowerCase())));
        const pairSet = new Set<string>();
        const missingJoiningDateSet = new Set<string>();
        for (let i = 0; i < studentCodes.length; i += 500) {
          const scChunk = studentCodes.slice(i, i + 500);
          const [existingRows]: any = await conn.query(
            'SELECT LOWER(student_code) as sc, LOWER(batch_code) as bc, joining_date FROM raw_records WHERE LOWER(student_code) IN (?)',
            [scChunk]
          );
          for (const er of existingRows) {
            const key = `${er.sc}_${er.bc}`;
            pairSet.add(key);
            if (!er.joining_date) missingJoiningDateSet.add(key);
          }
        }

        const rowsToBackfill = finalRowsToInsert.filter((r) => {
          const key = `${String(r.student_code).trim().toLowerCase()}_${String(r.batch_code).trim().toLowerCase()}`;
          return missingJoiningDateSet.has(key) && parseIsoDate(r.joining_date);
        });
        for (const bf of rowsToBackfill) {
          await conn.query(
            'UPDATE raw_records SET joining_date = ? WHERE LOWER(student_code) = LOWER(?) AND LOWER(batch_code) = LOWER(?) AND joining_date IS NULL',
            [parseIsoDate(bf.joining_date), bf.student_code, bf.batch_code]
          );
        }

        finalRowsToInsert = finalRowsToInsert.filter(
          (r) => !pairSet.has(`${String(r.student_code).trim().toLowerCase()}_${String(r.batch_code).trim().toLowerCase()}`)
        );
      } else if (duplicateMode === 'update' && finalRowsToInsert.length > 0) {
        const studentCodes = Array.from(new Set(finalRowsToInsert.map(r => String(r.student_code).trim().toLowerCase())));
        for (let i = 0; i < studentCodes.length; i += 500) {
          const scChunk = studentCodes.slice(i, i + 500);
          await conn.query('DELETE FROM raw_records WHERE LOWER(student_code) IN (?)', [scChunk]);
        }
      }

      await conn.beginTransaction();

      const insertColumns = [
        'center_code', 'funder_name', 'program_name', 'assigned_trainers', 'assigned_ae', 'rm_sh_zh',
        'batch_code', 'course_code', 'batch_start_date', 'batch_initial_start_date', 'batch_initial_end_date',
        'batch_end_date', 'batch_actual_end_date', 'batch_status', 'batch_validation_status',
        'student_code', 'enrollment_status', 'dropout_type', 'email_verification_status',
        'final_exam_marks', 'placement_type', 'exam_schedule_date', 'ilt_completion', 'ilt_as_on_joining_date',
        'fm_class_completion', 'running_attendance', 'beneficiary_class_attendance',
        'incomplete_attendance_exception', 'incomplete_module_exception', 'special_case', 'joining_date', 'validation_status',
        'validation_done_by', 'upload_id'
      ];

      const chunkSize = 500;
      if (finalRowsToInsert.length > 0) {
        for (let i = 0; i < finalRowsToInsert.length; i += chunkSize) {
          const chunk = finalRowsToInsert.slice(i, i + chunkSize);
          const chunkTuples = chunk.map(r => [
            r.center_code || 'Center 1',
            r.funder_name || 'General CSR',
            r.program_name || 'Digital Skills',
            r.assigned_trainers || 'Faculty Trainer',
            r.assigned_ae || 'Academic Excellence',
            r.rm_sh_zh || 'General Operations',
            r.batch_code,
            r.course_code || '',
            parseIsoDate(r.batch_start_date) ?? null,
            parseIsoDate(r.batch_initial_start_date) ?? null,
            parseIsoDate(r.batch_initial_end_date) ?? null,
            parseIsoDate(r.batch_end_date) ?? null,
            parseIsoDate(r.batch_actual_end_date) ?? null,
            r.batch_status || 'running',
            r.batch_validation_status || 'Not Yet Validated',
            r.student_code,
            r.enrollment_status || 'enrolled',
            r.dropout_type ?? null,
            r.email_verification_status || 'y',
            parseNullableNumber(r.final_exam_marks),
            r.placement_type ?? null,
            parseIsoDate(r.exam_schedule_date) ?? null,
            parseNullableNumber(r.ilt_completion),
            parseNullableNumber(r.ilt_as_on_joining_date ?? (r as any).ILT_as_on_Joining_Date),
            parseNullableNumber(r.fm_class_completion),
            parseNullableNumber(r.running_attendance),
            parseNullableNumber(r.beneficiary_class_attendance),
            r.incomplete_attendance_exception ? 1 : 0,
            r.incomplete_module_exception ? 1 : 0,
            parseSpecialCaseVal(r.special_case),
            parseIsoDate(r.joining_date) ?? null,
            r.validation_status || 'Not Available',
            r.validation_done_by ?? null,
            uploadId
          ]);

          if (chunkTuples.length > 0) {
            const bulkSql = `INSERT INTO raw_records (${insertColumns.join(', ')}) VALUES ?`;
            await conn.query(bulkSql, [chunkTuples]);
          }
        }
      }

      await conn.commit();
    } catch (err: any) {
      await conn.rollback();
      console.error('MySQL commitImportChunk error:', err);
      throw err;
    } finally {
      conn.release();
    }
  }

  // Also mirror into local SQLite analytics database
  try {
    const sqliteDb = await getDb();
    if (duplicateMode === 'update' && finalRowsToInsert.length > 0) {
      for (const r of finalRowsToInsert) {
        sqliteDb.run(`DELETE FROM raw_records WHERE LOWER(student_code) = LOWER(?) AND LOWER(batch_code) = LOWER(?)`, [r.student_code, r.batch_code]);
      }
    }
    sqliteDb.run('BEGIN TRANSACTION;');
    const insertStmt = sqliteDb.prepare(`
      INSERT INTO raw_records (
        center_code, funder_name, program_name, assigned_trainers, assigned_ae, rm_sh_zh,
        batch_code, course_code, batch_start_date, batch_initial_start_date, batch_initial_end_date,
        batch_end_date, batch_actual_end_date, batch_status, batch_validation_status,
        student_code, enrollment_status, dropout_type, email_verification_status,
        final_exam_marks, placement_type, exam_schedule_date, ilt_completion, ilt_as_on_joining_date,
        fm_class_completion, running_attendance, beneficiary_class_attendance,
        incomplete_attendance_exception, incomplete_module_exception, special_case, joining_date, validation_status,
        validation_done_by, upload_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const r of finalRowsToInsert) {
      insertStmt.run([
        r.center_code || 'Center 1',
        r.funder_name || 'General CSR',
        r.program_name || 'Digital Skills',
        r.assigned_trainers || 'Faculty Trainer',
        r.assigned_ae || 'Academic Excellence',
        r.rm_sh_zh || 'General Operations',
        r.batch_code,
        r.course_code || '',
        parseIsoDate(r.batch_start_date) ?? null,
        parseIsoDate(r.batch_initial_start_date) ?? null,
        parseIsoDate(r.batch_initial_end_date) ?? null,
        parseIsoDate(r.batch_end_date) ?? null,
        parseIsoDate(r.batch_actual_end_date) ?? null,
        r.batch_status || 'running',
        r.batch_validation_status || 'Not Yet Validated',
        r.student_code,
        r.enrollment_status || 'enrolled',
        r.dropout_type ?? null,
        r.email_verification_status || 'y',
        parseNullableNumber(r.final_exam_marks),
        r.placement_type ?? null,
        parseIsoDate(r.exam_schedule_date) ?? null,
        parseNullableNumber(r.ilt_completion),
        parseNullableNumber(r.ilt_as_on_joining_date ?? (r as any).ILT_as_on_Joining_Date),
        parseNullableNumber(r.fm_class_completion),
        parseNullableNumber(r.running_attendance),
        parseNullableNumber(r.beneficiary_class_attendance),
        r.incomplete_attendance_exception ? 1 : 0,
        r.incomplete_module_exception ? 1 : 0,
        parseSpecialCaseVal(r.special_case),
        parseIsoDate(r.joining_date) ?? null,
        r.validation_status || 'Not Available',
        r.validation_done_by ?? null,
        uploadId
      ]);
    }
    insertStmt.free();
    sqliteDb.run('COMMIT;');
  } catch (e: any) {
    console.error('Failed to mirror chunk to SQLite:', e.message);
  }

  // If this is the final chunk, finalize upload metadata
  if (isFinal) {
    const uploadedAt = new Date().toISOString();
    const sourceHash = crypto.createHash('sha256').update(fileName + uploadId + totalRows).digest('hex').substring(0, 16);
    const uploadRecord: UploadRecord = {
      id: uploadId,
      file_name: fileName,
      sheet_name: sheetName,
      uploaded_by: uploadedBy,
      uploaded_at: uploadedAt,
      row_count: totalRows,
      valid_row_count: validCount || totalRows,
      invalid_row_count: invalidCount,
      duplicate_count: duplicateCount,
      processing_status: 'completed',
      processing_duration_ms: 0,
      source_hash: sourceHash,
    };

    if (isMysql && mysqlPool) {
      try {
        await mysqlPool.query(
          `INSERT INTO uploads (id, file_name, sheet_name, uploaded_by, uploaded_at, row_count, valid_row_count, invalid_row_count, duplicate_count, processing_status, processing_duration_ms, source_hash)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE row_count = VALUES(row_count), valid_row_count = VALUES(valid_row_count)`,
          [
            uploadRecord.id, uploadRecord.file_name, uploadRecord.sheet_name, uploadRecord.uploaded_by,
            uploadRecord.uploaded_at, uploadRecord.row_count, uploadRecord.valid_row_count, uploadRecord.invalid_row_count,
            uploadRecord.duplicate_count, uploadRecord.processing_status, uploadRecord.processing_duration_ms, uploadRecord.source_hash
          ]
        );
      } catch (e) {
        console.error('Failed to record upload in MySQL:', e);
      }
    }

    try {
      const sqliteDb = await getDb();
      sqliteDb.run(`
        INSERT INTO uploads (id, file_name, sheet_name, uploaded_by, uploaded_at, row_count, valid_row_count, invalid_row_count, duplicate_count, processing_status, processing_duration_ms, source_hash)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        uploadRecord.id, uploadRecord.file_name, uploadRecord.sheet_name, uploadRecord.uploaded_by,
        uploadRecord.uploaded_at, uploadRecord.row_count, uploadRecord.valid_row_count, uploadRecord.invalid_row_count,
        uploadRecord.duplicate_count, uploadRecord.processing_status, uploadRecord.processing_duration_ms, uploadRecord.source_hash
      ]);
      resyncExceptionStatuses(sqliteDb);
      saveDbToDisk();
    } catch (e) {
      console.error('Failed to record upload in SQLite:', e);
    }

    logAudit(uploadedBy, 'AE Member', 'Data Import Completed', `Imported ${totalRows} records from ${fileName} (Chunked ${duplicateMode} mode)`, 'success', uploadId);

    return {
      isComplete: true,
      chunkIndex,
      totalChunks,
      upload: uploadRecord
    };
  }

  return {
    isComplete: false,
    chunkIndex,
    totalChunks
  };
}

// Excel Template Generator with the exact 30 columns
export function generateTemplateWorkbook(): Buffer {
  const headers = EXPECTED_SCHEMA_COLUMNS.map((c) => c.name);
  const sampleRows = [
    [
      'WBCOE', 'Accenture', 'DICA - Cloud & AI', 'Subhashis Roy', 'Arnab Roy', 'Vivek Kumar',
      'BCH-WBCOE-101', 'CRS-AI-01', '2026-01-10', '2026-01-05', '2026-04-10', '2026-04-15', '2026-04-15',
      'complete', 'Fully Validated', 'STU-10001', 'completed', '', 'y',
      88, 'Placed By Anudip CRD', '2026-04-12', 0.95, 0.92, 0.96, 0.94,
      0, 0, 'Validated', 'Pooja Sharma (Validator)', ''
    ],
    [
      'WBCOE', 'Accenture', 'DICA - Cloud & AI', 'Subhashis Roy', 'Arnab Roy', 'Krishna Sadhan Adhikari',
      'BCH-WBCOE-101', 'CRS-AI-01', '2026-01-10', '2026-01-05', '2026-04-10', '2026-04-15', '2026-04-15',
      'complete', 'Fully Validated', 'STU-10002', 'dropped out', 'Regular Session Dropout', 'p',
      null, '', '', 0.32, 0.28, 0.40, 0.35,
      1, 0, 'Rejected', 'Pooja Sharma (Validator)', ''
    ],
    [
      'DEL-02', 'Cisco Systems', 'Full Stack Web Development', 'Rahul Verma', 'Sweta Banerjee', 'Khalid Khan',
      'BCH-DEL02-204', 'CRS-FSW-03', '2026-05-15', '2026-05-10', '2026-08-15', '2026-08-20', '',
      'running', 'Partially Validated', 'STU-20045', 'enrolled', '', 'y',
      null, '', '', 0.78, 0.81, 0.88, 0.85,
      0, 0, 'Pending', 'Anil Roy (AE QA)', ''
    ]
  ];

  const wsData = [headers, ...sampleRows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Export');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

// Exception Approval Template Generator
export function generateExceptionApprovalTemplateWorkbook(): Buffer {
  const headers = [
    'Student Code',
    'Batch Code',
    'Exception Type',
    'Approval Status',
    'Approved By',
    'Remarks'
  ];
  const sampleRows = [
    ['STU-10002', 'BCH-WBCOE-101', 'Attendance Exception', 'Approved', 'Arnab Roy', 'Medical certificate verified'],
    ['STU-20046', 'BCH-DEL02-204', 'Incomplete Module Exception', 'Approved', 'Sweta Banerjee', 'Makeup session attended'],
    ['STU-30012', 'BCH-MUM-01', 'Attendance Exception', 'Rejected', 'Arnab Roy', 'Insufficient attendance proof']
  ];

  const wsData = [headers, ...sampleRows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Exception_Approvals');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

// Scheduled vs Conducted Template Generator
export function generateScheduledVsConductedTemplateWorkbook(): Buffer {
  const headers = [
    'Slot Date',
    'FM email id',
    'Batch Code',
    'Actual Center Code',
    'Program Name',
    'G-meet ID',
    'Batch Status',
    'Actual Status',
    'Schedule Clsss start time',
    'Actual Class Started',
    'Schedule Clsss end time',
    'Actual Class ended',
    'class_link',
    'Form Status'
  ];
  const sampleRows = [
    [
      '2026-10-20',
      'trainer.sample@anudip.org',
      'ANP-D6339',
      'CENT001',
      'Deep Tech',
      'meet.google.com/abc-defg-hij',
      'Running',
      'Conducted',
      '10:00 AM',
      '10:05 AM',
      '12:00 PM',
      '12:02 PM',
      'https://meet.google.com/abc-defg-hij',
      'Submitted'
    ],
    [
      '2026-10-20',
      'faculty.tech@anudip.org',
      'ANP-D7070',
      'CENT042',
      'Diya',
      'meet.google.com/xyz-uvwx-rst',
      'Complete',
      'Conducted',
      '02:00 PM',
      '02:00 PM',
      '04:00 PM',
      '04:10 PM',
      'https://meet.google.com/xyz-uvwx-rst',
      'Submitted'
    ]
  ];

  const wsData = [headers, ...sampleRows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Scheduled_vs_Conducted');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

// Slot Replacement Template Generator
export function generateSlotReplacementTemplateWorkbook(): Buffer {
  const headers = [
    'Emp Code',
    'Trainer Name',
    'Batch Code',
    'Alias',
    'Actual Class Date',
    'Replacement Class Date',
    'Center Code',
    'Center Name',
    'Approved/Rejected By',
    'Approval/Rejected Date',
    'Requested Date',
    'Request Status',
    'Reason'
  ];

  const sampleRows = [
    [
      'EMP1024',
      'Subhajit Dutta',
      'ANP-D5484',
      'ANP-D5484-M1',
      '2026-10-15',
      '2026-10-18',
      'WBCGD',
      'Cooch Behar Center',
      'Academic Lead',
      '2026-10-16',
      '2026-10-15',
      'Approved',
      'Medical leave / Health contingency'
    ],
    [
      'EMP2088',
      'Niladri Majumder',
      'ANP-D5733',
      'ANP-D5733-M2',
      '2026-10-17',
      '2026-10-20',
      'KACGB',
      'Bangalore Central Center',
      'Academic Manager',
      '2026-10-18',
      '2026-10-17',
      'Approved',
      'Official Center event / Internet outage'
    ]
  ];

  const wsData = [headers, ...sampleRows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Slot_Replacement');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

// Challenges Template Generator
export function generateChallengesTemplateWorkbook(): Buffer {
  const headers = [
    'Sl No.',
    'RM Name',
    'Challenges',
    'Impact'
  ];

  const sampleRows = [
    [
      '1',
      'Krishna Prasad',
      'Delayed student attendance reporting from regional centers due to connectivity bottlenecks.',
      'Slight delay in weekly conductance analysis report generation.'
    ],
    [
      '2',
      'Dipti Sharma',
      'Faculty replacement requests during festival period in North region.',
      'Re-scheduling required for 12 session slots across 4 active batches.'
    ]
  ];

  const wsData = [headers, ...sampleRows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'RM_Challenges');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}


