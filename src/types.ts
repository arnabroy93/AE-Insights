export interface FilterParams {
  startDate?: string;
  endDate?: string;
  centerCode?: string;
  centerCodes?: string[];
  funderName?: string;
  programName?: string;
  programNames?: string[];
  programType?: string; // 'Diya and Deeptech' | 'Diya Only' | 'Deeptech Only' | 'ALL'
  courseCode?: string;
  batchCode?: string;
  assignedTrainer?: string;
  assignedAe?: string;
  assignedAes?: string[];
  rmShZh?: string;
  rmShZhs?: string[];
  batchStatus?: string;
  enrollmentStatus?: string;
  studentStatus?: string;
  dropoutType?: string;
  batchValidationStatus?: string;
  studentValidationStatus?: string;
  placementType?: string;
  hasException?: boolean;
  specialCase?: string;
  module?: string;
  restrictDeepTech?: boolean;
  trainer?: string;
  search?: string;
}

export interface FilterOptions {
  centers: string[];
  funders: string[];
  programs: string[];
  courses: string[];
  batches: string[];
  trainers: string[];
  aes: string[];
  rmShZhs: string[];
  batchStatuses: string[];
  enrollmentStatuses: string[];
  studentStatuses?: string[];
  dropoutTypes: string[];
  batchValidationStatuses: string[];
  studentValidationStatuses: string[];
  placementTypes: string[];
  hierarchy?: { rm: string; center: string; program: string }[];
}

export interface SourceRow {
  id: number;
  center_code: string;
  funder_name: string;
  program_name: string;
  assigned_trainers: string;
  assigned_ae: string;
  rm_sh_zh: string;
  batch_code: string;
  course_code: string;
  batch_start_date: string | null;
  batch_initial_start_date: string | null;
  batch_initial_end_date: string | null;
  batch_end_date: string | null;
  batch_actual_end_date: string | null;
  batch_status: string;
  batch_validation_status: string;
  student_code: string;
  enrollment_status: string;
  dropout_type: string | null;
  email_verification_status: string;
  final_exam_marks: number | null;
  placement_type: string | null;
  exam_schedule_date: string | null;
  ilt_completion: number | null;
  ilt_as_on_joining_date?: number | null;
  fm_class_completion: number | null;
  running_attendance: number | null;
  beneficiary_class_attendance: number | null;
  incomplete_attendance_exception: number;
  incomplete_module_exception: number;
  is_exception?: number;
  special_case?: string | number | null;
  joining_date?: string | null;
  validation_status: string;
  validation_done_by: string | null;
  upload_id?: string;
}

export interface OperationalSettings {
  attendanceThreshold: number;
  completionThreshold: number;
  batchDelayThresholdDays: number;
  dropoutAlertThreshold: number;
  enableFacultyDeploymentIndex: boolean;
}

export interface UploadRecord {
  id: string;
  file_name: string;
  sheet_name: string;
  uploaded_by: string;
  uploaded_at: string;
  row_count: number;
  valid_row_count: number;
  invalid_row_count: number;
  duplicate_count: number;
  processing_status: 'completed' | 'processing' | 'failed';
  processing_duration_ms: number;
  source_hash: string;
}

export interface AuditLogEntry {
  id: string;
  user_email: string;
  user_role: string;
  action: string;
  timestamp: string;
  upload_id?: string;
  details: string;
  result: 'success' | 'warning' | 'error';
}

export interface RestorePoint {
  id: string;
  name: string;
  description: string;
  fileName: string;
  createdAt: string;
  fileSize: number;
  fileSizeFormatted: string;
  recordCount: number;
  batchCount: number;
  uploadCount: number;
  createdBy: string;
  isBaseline?: boolean;
}

export const EXPECTED_SCHEMA_COLUMNS = [
  { key: 'center_code', name: 'Center Code', required: true, aliases: ['center code', 'centercode', 'center_code', 'center'] },
  { key: 'funder_name', name: 'Funder Name', required: true, aliases: ['funder name', 'fundername', 'funder_name', 'funder'] },
  { key: 'program_name', name: 'Programname', required: true, aliases: ['programname', 'program name', 'program_name', 'program'] },
  { key: 'assigned_trainers', name: 'Assigned Trainers', required: true, aliases: ['assigned trainers', 'assigned trainer', 'trainer', 'trainers', 'assigned_trainers'] },
  { key: 'assigned_ae', name: 'Assigned AE', required: true, aliases: ['assigned ae', 'ae', 'assigned_ae', 'academic excellence member'] },
  { key: 'rm_sh_zh', name: 'RM / SH / ZH', required: false, aliases: ['rm / sh / zh', 'rm/sh/zh', 'rm_sh_zh', 'rm', 'sh', 'zh', 'regional manager'] },
  { key: 'batch_code', name: 'Batch Code', required: true, aliases: ['batch code', 'batchcode', 'batch_code', 'batch'] },
  { key: 'course_code', name: 'Course Code', required: false, aliases: ['course code', 'coursecode', 'course_code', 'course'] },
  { key: 'batch_start_date', name: 'Batch Start Date', required: false, aliases: ['batch start date', 'start date', 'batch_start_date'] },
  { key: 'batch_initial_start_date', name: 'Batch Initial Start Date', required: false, aliases: ['batch initial start date', 'initial start date', 'batch_initial_start_date'] },
  { key: 'batch_initial_end_date', name: 'Batch Initial End Date', required: false, aliases: ['batch initial end date', 'initial end date', 'batch_initial_end_date'] },
  { key: 'batch_end_date', name: 'Batch End Date', required: false, aliases: ['batch end date', 'end date', 'planned end date', 'batch_end_date'] },
  { key: 'batch_actual_end_date', name: 'Batch Actual End Date', required: false, aliases: ['batch actual end date', 'actual end date', 'batch_actual_end_date'] },
  { key: 'batch_status', name: 'Batch Status', required: true, aliases: ['batch status', 'batchstatus', 'batch_status', 'status'] },
  { key: 'batch_validation_status', name: 'Batch Validation Status', required: false, aliases: ['batch validation status', 'batch_validation_status'] },
  { key: 'student_code', name: 'Student Code', required: true, aliases: ['student code', 'studentcode', 'student_code', 'student id'] },
  { key: 'enrollment_status', name: 'Enrollment Status', required: true, aliases: ['enrollment status', 'enrollmentstatus', 'enrollment_status'] },
  { key: 'dropout_type', name: 'Dropout(modified)', required: false, aliases: ['dropout(modified)', 'dropout type', 'dropout_type', 'dropout'] },
  { key: 'email_verification_status', name: 'Email verification status', required: false, aliases: ['email verification status', 'email_verification_status', 'email verification'] },
  { key: 'final_exam_marks', name: 'Final Exam Marks', required: false, aliases: ['final exam marks', 'exam marks', 'final_exam_marks', 'score'] },
  { key: 'placement_type', name: 'Placement Type', required: false, aliases: ['placement type', 'placement_type', 'placement'] },
  { key: 'exam_schedule_date', name: 'Exam Schedule Date', required: false, aliases: ['exam schedule date', 'exam date', 'exam_schedule_date'] },
  { key: 'ilt_completion', name: 'ILT completion%', required: false, aliases: ['ilt completion%', 'ilt completion', 'ilt_completion', 'ilt completion %'] },
  { key: 'ilt_as_on_joining_date', name: 'ILT_as_on_Joining_Date', required: false, aliases: ['ilt_as_on_joining_date', 'ilt as on joining date', 'ilt percentage as on joining date', 'ilt % as on joining date', 'ilt_percentage_as_on_joining_date'] },
  { key: 'fm_class_completion', name: 'FM Class Completion % (Running)', required: false, aliases: ['fm class completion % (running)', 'fm class completion %', 'fm completion', 'fm_class_completion'] },
  { key: 'running_attendance', name: 'Running Attendance %', required: false, aliases: ['running attendance %', 'running attendance', 'running_attendance', 'attendance %'] },
  { key: 'beneficiary_class_attendance', name: 'Beneficiary Class Attendance %', required: false, aliases: ['beneficiary class attendance %', 'beneficiary attendance', 'beneficiary_class_attendance'] },
  { key: 'validation_status', name: 'Validation Status Student wise', required: false, aliases: ['validation status student wise', 'validation status', 'student validation status', 'validation_status'] },
  { key: 'validation_done_by', name: 'Validation done by', required: false, aliases: ['validation done by', 'validator', 'validation_done_by'] },
  { key: 'special_case', name: 'Special Case', required: false, aliases: ['special case', 'special_case', 'specialcase', 'special', 'special case '] },
  { key: 'joining_date', name: 'Joining Date', required: false, aliases: ['joining date', 'joining_date', 'joiningdate', 'date of joining', 'doj', 'student joining date', 'candidate joining date', 'enrollment date', 'joining date '] }
];

export const EXCEPTION_APPROVAL_COLUMNS = [
  {
    key: 'date',
    name: 'Date',
    required: false,
    aliases: ['date', 'report date', 'report_date', 'approval date', 'approved date', 'date ']
  },
  {
    key: 'batch_code',
    name: 'Batch Code',
    required: false,
    aliases: ['batch code', 'batchcode', 'batch_code', 'batch', 'batch id', 'batch name', 'batch_id', 'batch code ']
  },
  {
    key: 'student_code',
    name: 'Student Code',
    required: true,
    aliases: [
      'student code', 'studentcode', 'student_code', 'student id', 'studentid', 'student_id',
      'candidate id', 'candidate_code', 'candidate code', 'reg id', 'enrollment id', 'student code '
    ]
  },
  {
    key: 'student_name',
    name: 'Student Name',
    required: false,
    aliases: ['student name', 'studentname', 'student_name', 'name', 'candidate name', 'candidate_name', 'student name ']
  },
  {
    key: 'center_code',
    name: 'Center Code',
    required: false,
    aliases: ['center code', 'centercode', 'center_code', 'center', 'center_id', 'center code ']
  },
  {
    key: 'center_name',
    name: 'Center Name',
    required: false,
    aliases: ['center name', 'centername', 'center_name']
  },
  {
    key: 'reason',
    name: 'Reason',
    required: false,
    aliases: ['reason', 'exception reason', 'exception_reason', 'reason ']
  },
  {
    key: 'remarks',
    name: 'Remarks',
    required: false,
    aliases: ['remarks', 'remarks / reason', 'comment', 'comments', 'notes', 'remarks ']
  },
  {
    key: 'status',
    name: 'Status',
    required: false,
    aliases: ['status', 'approval status', 'approval_status', 'decision', 'exception status', 'action', 'status ']
  },
  {
    key: 'created_by',
    name: 'Created By',
    required: false,
    aliases: ['created by', 'created_by', 'createdby', 'creator', 'created by ']
  },
  {
    key: 'created_by_email',
    name: 'Created By Email',
    required: false,
    aliases: ['created by email', 'created_by_email', 'creator email']
  },
  {
    key: 'cm_name',
    name: 'CM Name',
    required: false,
    aliases: ['cm name', 'cm_name', 'cmname', 'center manager', 'center manager name', 'cm name ']
  },
  {
    key: 'cm_email',
    name: 'CM Email',
    required: false,
    aliases: ['cm email', 'cm_email', 'cmemail', 'center manager email']
  },
  {
    key: 'approval_remarks',
    name: 'Approval Remarks',
    required: false,
    aliases: ['approval remarks', 'approval_remarks', 'approver remarks', 'approval remarks ']
  },
  {
    key: 'approved_by',
    name: 'Approved By',
    required: false,
    aliases: ['approved by', 'approved_by', 'approver', 'approved by user', 'manager', 'reviewer', 'approved by ']
  },
  {
    key: 'approved_by_email',
    name: 'Approved By Email',
    required: false,
    aliases: ['approved by email', 'approved_by_email', 'approver email']
  },
  {
    key: 'approved_date',
    name: 'Approved Date',
    required: false,
    aliases: ['approved date', 'approved_date', 'approval date', 'decision date', 'approved date ']
  },
  {
    key: 'exception_remove_status',
    name: 'Exception Remove Status',
    required: false,
    aliases: ['exception remove status', 'exception_remove_status', 'remove status', 'removal status']
  },
  {
    key: 'exception_remove_date',
    name: 'Exception Remove Date',
    required: false,
    aliases: ['exception remove date', 'exception_remove_date', 'remove date', 'removal date']
  },
];

export const SCHEDULED_VS_CONDUCTED_COLUMNS = [
  {
    key: 'slot_date',
    name: 'Slot Date',
    required: false,
    aliases: ['slot date', 'slot_date', 'slotdate', 'date', 'class date', 'session date', 'scheduled date']
  },
  {
    key: 'fm_email_id',
    name: 'FM email id',
    required: false,
    aliases: ['fm email id', 'fm email', 'fm_email_id', 'faculty email', 'faculty email id', 'trainer email', 'trainer email id', 'fm_email', 'email', 'fm email id ']
  },
  {
    key: 'batch_code',
    name: 'Batch Code',
    required: true,
    aliases: ['batch code', 'batchcode', 'batch_code', 'batch id', 'batch', 'batch_id', 'batch code ']
  },
  {
    key: 'actual_center_code',
    name: 'Actual Center Code',
    required: false,
    aliases: ['actual center code', 'actual_center_code', 'center code', 'center', 'centercode', 'centre code', 'actual center', 'actual center code ']
  },
  {
    key: 'program_name',
    name: 'Program Name',
    required: false,
    aliases: ['program name', 'program_name', 'programname', 'program', 'course', 'program name ']
  },
  {
    key: 'gmeet_id',
    name: 'G-meet ID',
    required: false,
    aliases: ['g-meet id', 'gmeet id', 'gmeet_id', 'meet id', 'g meet id', 'google meet id', 'g-meet', 'gmeet', 'meeting id', 'g-meet id ']
  },
  {
    key: 'batch_status',
    name: 'Batch Status',
    required: false,
    aliases: ['batch status', 'batch_status', 'batchstatus', 'status', 'batch status ']
  },
  {
    key: 'actual_status',
    name: 'Actual Status',
    required: false,
    aliases: ['actual status', 'actual_status', 'actualstatus', 'class status', 'session status', 'conducted status', 'actual status ']
  },
  {
    key: 'schedule_class_start_time',
    name: 'Schedule Clsss start time',
    required: false,
    aliases: [
      'schedule clsss start time',
      'schedule class start time',
      'scheduled class start time',
      'scheduled clsss start time',
      'schedule start time',
      'scheduled start time',
      'class start time',
      'start time',
      'schedule_class_start_time',
      'schedule clsss start time '
    ]
  },
  {
    key: 'actual_class_started',
    name: 'Actual Class Started',
    required: false,
    aliases: [
      'actual class started',
      'actual class start time',
      'actual start time',
      'class started',
      'actual_class_started',
      'actual_class_start_time',
      'actual class started '
    ]
  },
  {
    key: 'schedule_class_end_time',
    name: 'Schedule Clsss end time',
    required: false,
    aliases: [
      'schedule clsss end time',
      'schedule class end time',
      'scheduled class end time',
      'scheduled clsss end time',
      'schedule end time',
      'scheduled end time',
      'class end time',
      'end time',
      'schedule_class_end_time',
      'schedule clsss end time '
    ]
  },
  {
    key: 'actual_class_ended',
    name: 'Actual Class ended',
    required: false,
    aliases: [
      'actual class ended',
      'actual class end time',
      'actual end time',
      'class ended',
      'actual_class_ended',
      'actual_class_end_time',
      'actual class ended '
    ]
  },
  {
    key: 'class_link',
    name: 'class_link',
    required: false,
    aliases: ['class_link', 'class link', 'meeting link', 'meet link', 'link', 'url', 'gmeet link', 'class_link ']
  },
  {
    key: 'form_status',
    name: 'Form Status',
    required: false,
    aliases: ['form status', 'form_status', 'formstatus', 'submission status', 'form submitted', 'form status ']
  }
];

export interface ScheduledVsConductedRecord {
  id: number;
  slot_date: string | null;
  fm_email_id: string | null;
  batch_code: string | null;
  actual_center_code: string | null;
  program_name: string | null;
  gmeet_id: string | null;
  batch_status: string | null;
  actual_status: string | null;
  schedule_class_start_time: string | null;
  actual_class_started: string | null;
  schedule_class_end_time: string | null;
  actual_class_ended: string | null;
  class_link: string | null;
  form_status: string | null;
  upload_id: string | null;
  uploaded_by: string | null;
  created_at: string;
}

export const SLOT_REPLACEMENT_COLUMNS = [
  {
    key: 'emp_code',
    name: 'Emp Code',
    required: false,
    aliases: ['emp code', 'emp_code', 'empcode', 'employee code', 'trainer emp code', 'trainer code', 'emp code ']
  },
  {
    key: 'trainer_name',
    name: 'Trainer Name',
    required: false,
    aliases: ['trainer name', 'trainer_name', 'trainer', 'faculty name', 'fm name', 'faculty', 'trainer name ']
  },
  {
    key: 'batch_code',
    name: 'Batch Code',
    required: true,
    aliases: ['batch code', 'batchcode', 'batch_code', 'batch id', 'batch', 'batch code ']
  },
  {
    key: 'alias',
    name: 'Alias',
    required: false,
    aliases: ['alias', 'batch alias', 'trainer alias', 'alias name', 'alias ']
  },
  {
    key: 'actual_class_date',
    name: 'Actual Class Date',
    required: false,
    aliases: ['actual class date', 'actual_class_date', 'actual date', 'original class date', 'class date', 'actual class date ']
  },
  {
    key: 'replacement_class_date',
    name: 'Replacement Class Date',
    required: false,
    aliases: ['replacement class date', 'replacement_class_date', 'replacement date', 'rescheduled date', 'reschedule date', 'replacement class date ']
  },
  {
    key: 'center_code',
    name: 'Center Code',
    required: false,
    aliases: ['center code', 'center_code', 'centercode', 'centre code', 'center code ']
  },
  {
    key: 'center_name',
    name: 'Center Name',
    required: false,
    aliases: ['center name', 'center_name', 'centername', 'centre name', 'center name ']
  },
  {
    key: 'approved_rejected_by',
    name: 'Approved/Rejected By',
    required: false,
    aliases: ['approved/rejected by', 'approved / rejected by', 'approved_rejected_by', 'approver', 'action by', 'approved by', 'rejected by', 'approved/rejected by ']
  },
  {
    key: 'approval_rejected_date',
    name: 'Approval/Rejected Date',
    required: false,
    aliases: ['approval/rejected date', 'approval / rejected date', 'approval_rejected_date', 'approval date', 'rejected date', 'approved date', 'approval/rejected date ']
  },
  {
    key: 'requested_date',
    name: 'Requested Date',
    required: false,
    aliases: ['requested date', 'requested_date', 'request date', 'requested date ']
  },
  {
    key: 'request_status',
    name: 'Request Status',
    required: false,
    aliases: ['request status', 'request_status', 'status', 'approval status', 'replacement status', 'request status ']
  },
  {
    key: 'reason',
    name: 'Reason',
    required: false,
    aliases: ['reason', 'replacement reason', 'remarks', 'remark', 'comments', 'reason ']
  }
];

export const CHALLENGES_COLUMNS = [
  {
    key: 'sl_no',
    name: 'Sl No.',
    required: false,
    aliases: ['sl no.', 'sl no', 'sl_no', 'slno', 's.no', 'sno', 'sl. no.', 'sl.no.']
  },
  {
    key: 'rm_name',
    name: 'RM Name',
    required: true,
    aliases: ['rm name', 'rm_name', 'rm', 'rm name ', 'regional manager', 'rm_sh_zh']
  },
  {
    key: 'challenges',
    name: 'Challenges',
    required: true,
    aliases: ['challenges', 'challenge', 'rm_challenges', 'challenge details', 'challenges ']
  },
  {
    key: 'impact',
    name: 'Impact',
    required: true,
    aliases: ['impact', 'impacts', 'rm_impact', 'business impact', 'impact ']
  }
];

export interface SlotReplacementRecord {
  id: number;
  emp_code: string | null;
  trainer_name: string | null;
  batch_code: string | null;
  alias: string | null;
  actual_class_date: string | null;
  replacement_class_date: string | null;
  center_code: string | null;
  center_name: string | null;
  approved_rejected_by: string | null;
  approval_rejected_date: string | null;
  requested_date: string | null;
  request_status: string | null;
  reason: string | null;
  upload_id: string | null;
  uploaded_by: string | null;
  created_at?: string;
}

export interface ChallengeRecord {
  id?: number;
  sl_no: string | number | null;
  rm_name: string | null;
  challenges: string | null;
  impact: string | null;
  upload_id?: string | null;
  uploaded_by?: string | null;
  created_at?: string;
}

export interface DatabaseStatus {
  activeEngine: 'sqlite' | 'mysql';
  isConnected: boolean;
  mysqlConfig: {
    host: string;
    port: number;
    user: string;
    database: string;
    ssl?: boolean;
    connectionLimit?: number;
    hasPassword?: boolean;
  };
  sqliteRecordCount: number;
  mysqlRecordCount: number | null;
  activeRecordCount: number;
  latencyMs: number;
  mysqlVersion?: string;
  mysqlTables?: Record<string, { rowCount: number; exists?: boolean }>;
}

export interface MysqlConfigInput {
  host: string;
  port: number;
  user: string;
  password?: string;
  database: string;
  ssl?: boolean;
  connectionLimit?: number;
  switchToMysql?: boolean;
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  latencyMs: number;
  version?: string;
  database?: string;
  tables?: string[];
  hasAllTables?: boolean;
  error?: string;
}

export interface MigrationResult {
  success: boolean;
  recordsMigrated: number;
  uploadsMigrated: number;
  auditLogsMigrated: number;
  durationMs: number;
  message: string;
}

export interface TrainedKpis {
  total_students: number;
  total_students_including_dropouts: number;
  total_trained: number;
  trained_within_10_days: number;
  trained_within_10_days_pct: number;
  trained_after_10_days: number;
  trained_after_10_days_pct: number;
  running_trained_pct: number;
  active_in_training: number;
  total_batches: number;
  running_batches: number;
  completed_batches: number;
}

export interface TrainedByRm {
  name: string;
  students: number;
  trained: number;
  trained_within_10: number;
  trained_within_10_pct: number;
  trained_after_10: number;
  trained_after_10_pct: number;
  running_trained_pct: number;
  in_training: number;
  batches: number;
}

export interface TrainedByCenter {
  center_code: string;
  name: string;
  students: number;
  trained: number;
  trained_within_10: number;
  trained_within_10_pct: number;
  trained_after_10: number;
  trained_after_10_pct: number;
  running_trained_pct: number;
  in_training: number;
  batches: number;
}

export interface TrainedByProgram {
  name: string;
  students: number;
  trained: number;
  trained_within_10: number;
  trained_within_10_pct: number;
  trained_after_10: number;
  trained_after_10_pct: number;
  running_trained_pct: number;
  in_training: number;
  batches: number;
}

export interface TrainedBatchItem {
  batch_code: string;
  center_code: string;
  program_name: string;
  funder_name: string;
  rm_sh_zh: string;
  assigned_trainers: string;
  batch_status: string;
  batch_actual_end_date: string | null;
  exam_schedule_date: string | null;
  students: number;
  trained: number;
  trained_within_10: number;
  trained_within_10_pct: number;
  trained_after_10: number;
  trained_after_10_pct: number;
  avg_delay_days: number;
  status: string;
}

export interface TrainedAnalyticsData {
  kpis: TrainedKpis;
  by_rm: TrainedByRm[];
  by_center: TrainedByCenter[];
  by_program: TrainedByProgram[];
  batches: TrainedBatchItem[];
}

export interface SchedulingBatchItem {
  center_code: string;
  batch_code: string;
  program_name: string;
  fm_email_id: string;
  total_scheduled: number;
  sessions_not_conducted: number;
  sessions_rescheduled?: number;
  sessions_conducted: number;
  conducted_pct: number;
  batch_status?: string;
  earliest_slot_date?: string;
  latest_slot_date?: string;
}

export interface SchedulingAnalyticsData {
  summary: {
    total_batches: number;
    total_scheduled_sessions: number;
    total_sessions_not_conducted: number;
    total_sessions_rescheduled?: number;
    total_sessions_conducted: number;
    overall_conducted_pct: number;
    batches_with_missed_sessions: number;
    zero_missed_batches: number;
  };
  batches: SchedulingBatchItem[];
  center_options: string[];
  program_options: string[];
  fm_options: string[];
  is_sample_data?: boolean;
  by_rm?: any[];
  by_center?: any[];
  by_program?: any[];
  initial_records?: {
    rows: ScheduledVsConductedRecord[];
    totalCount: number;
  };
}

export interface RunningBatchKpis {
  avg_running_attendance: number;
  enrolled_avg_running_attendance: number;
  avg_beneficiary_attendance: number;
  avg_ilt_completion: number;
  avg_fm_completion: number;
  running_batches: number;
  total_students: number;
  enrolled_students: number;
  dropout_students: number;
  active_centers: number;
  active_programs: number;
  students_gte_75: number;
  students_gte_75_pct: number;
  students_lt_75: number;
  students_lt_75_pct: number;
  students_gte_50: number;
  students_gte_50_pct: number;
  students_lt_50: number;
  students_lt_50_pct: number;
}

export interface RunningBatchBreakdownItem {
  name: string;
  center_code?: string;
  program_name?: string;
  rm_sh_zh?: string;
  avg_running_attendance: number;
  avg_beneficiary_attendance: number;
  avg_ilt_completion: number;
  count: number;
  total_students: number;
  enrolled_students: number;
  running_batches: number;
  students_gte_75: number;
  students_gte_75_pct: number;
  students_lt_75: number;
  students_lt_75_pct: number;
  students_gte_50?: number;
  students_gte_50_pct?: number;
  students_lt_50?: number;
  students_lt_50_pct?: number;
  running_attendance_sum?: number;
  running_attendance_count?: number;
  beneficiary_attendance_sum?: number;
  beneficiary_attendance_count?: number;
  ilt_completion_sum?: number;
  ilt_completion_count?: number;
}

export interface RunningBatchItem {
  batch_code: string;
  center_code: string;
  program_name: string;
  funder_name: string;
  rm_sh_zh: string;
  assigned_trainers: string;
  batch_status: string;
  batch_start_date: string | null;
  batch_end_date: string | null;
  total_students: number;
  enrolled_students: number;
  avg_running_attendance: number;
  avg_beneficiary_attendance: number;
  avg_ilt_completion: number;
  avg_fm_completion: number;
  students_gte_75: number;
  students_lt_75: number;
  students_gte_50?: number;
  students_lt_50?: number;
}

export interface RunningBatchAnalyticsData {
  kpis: RunningBatchKpis;
  by_rm: RunningBatchBreakdownItem[];
  by_center: RunningBatchBreakdownItem[];
  by_program: RunningBatchBreakdownItem[];
  batches: RunningBatchItem[];
}

export interface ClosedBatchKpis {
  avg_beneficiary_attendance: number;
  enrolled_avg_beneficiary_attendance: number;
  avg_running_attendance: number;
  avg_ilt_completion: number;
  avg_fm_completion: number;
  completed_batches: number;
  total_students: number;
  enrolled_students: number;
  dropout_students: number;
  active_centers: number;
  active_programs: number;
  students_gte_75: number;
  students_gte_75_pct: number;
  students_lt_75: number;
  students_lt_75_pct: number;
  students_gte_50: number;
  students_gte_50_pct: number;
  students_lt_50: number;
  students_lt_50_pct: number;
}

export interface ClosedBatchBreakdownItem {
  name: string;
  center_code?: string;
  program_name?: string;
  rm_sh_zh?: string;
  avg_beneficiary_attendance: number;
  avg_running_attendance: number;
  avg_ilt_completion: number;
  count: number;
  total_students: number;
  enrolled_students: number;
  completed_batches: number;
  students_gte_75: number;
  students_gte_75_pct: number;
  students_lt_75: number;
  students_lt_75_pct: number;
  students_gte_50?: number;
  students_gte_50_pct?: number;
  students_lt_50?: number;
  students_lt_50_pct?: number;
  beneficiary_attendance_sum?: number;
  beneficiary_attendance_count?: number;
  running_attendance_sum?: number;
  running_attendance_count?: number;
  ilt_completion_sum?: number;
  ilt_completion_count?: number;
}

export interface ClosedBatchItem {
  batch_code: string;
  center_code: string;
  program_name: string;
  funder_name: string;
  rm_sh_zh: string;
  assigned_trainers: string;
  batch_status: string;
  batch_start_date: string | null;
  batch_end_date: string | null;
  batch_actual_end_date: string | null;
  total_students: number;
  enrolled_students: number;
  avg_beneficiary_attendance: number;
  avg_running_attendance: number;
  avg_ilt_completion: number;
  avg_fm_completion: number;
  students_gte_75: number;
  students_lt_75: number;
  students_gte_50?: number;
  students_lt_50?: number;
}

export interface ClosedBatchAnalyticsData {
  kpis: ClosedBatchKpis;
  by_rm: ClosedBatchBreakdownItem[];
  by_center: ClosedBatchBreakdownItem[];
  by_program: ClosedBatchBreakdownItem[];
  batches: ClosedBatchItem[];
}

export interface LiveUserPresenceItem {
  session_id: string;
  email: string;
  user_name: string;
  avatar_url?: string | null;
  user_role: string;
  current_view: string;
  current_view_label: string;
  portal_mode: string;
  browser_info: string;
  device_os: string;
  host_origin: string;
  ip_address?: string | null;
  started_at: number;
  last_seen_at: number;
  is_online: number;
  status: 'online' | 'idle' | 'offline';
  active_seconds: number;
  seconds_since_ping: number;
}

export interface LivePresenceData {
  activeUsers: LiveUserPresenceItem[];
  recentUsers: LiveUserPresenceItem[];
  serverTimestamp: number;
}



