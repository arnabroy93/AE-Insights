// 30 Source Columns Schema Definitions for AE INSIGHT

export interface SourceRow {
  // Batch / Organization Fields (1-8)
  center_code: string;
  funder_name: string;
  program_name: string;
  assigned_trainers: string;
  assigned_ae: string;
  rm_sh_zh: string;
  batch_code: string;
  course_code: string;

  // Batch Date Fields (9-13)
  batch_start_date: string | null;
  batch_initial_start_date: string | null;
  batch_initial_end_date: string | null;
  batch_end_date: string | null;
  batch_actual_end_date: string | null;

  // Batch Status Fields (14-15)
  batch_status: string; // 'running' | 'complete' | 'hold' | other
  batch_validation_status: string; // 'Not Yet Validated' | 'Partially Validated' | 'Fully Validated'

  // Student Fields (16-19)
  student_code: string;
  enrollment_status: string; // 'enrolled' | 'dropped out' | 'completed' | etc.
  dropout_type: string | null; // 'Initial Session Dropout' | 'Regular Session Dropout' | 'M&E Dropout' | null
  email_verification_status: string; // 'y' | 'p' | 'n'

  // Assessment / Placement Fields (20-22)
  final_exam_marks: number | null;
  placement_type: string | null; // 'Placed By Anudip CRD' | 'Self Placed' | 'Placed By Anudip Center/Local' | 'Placed By College/Campus' | null
  exam_schedule_date: string | null;

  // Academic Progress Fields (23-26) - Decimal 0.00 to 1.00
  ilt_completion: number | null;
  ilt_as_on_joining_date?: number | null;
  fm_class_completion: number | null;
  running_attendance: number | null;
  beneficiary_class_attendance: number | null;

  // Exception Field - 1 or 0 (Evaluated dynamically per criteria)
  is_exception?: number;
  incomplete_attendance_exception?: number;
  incomplete_module_exception?: number;
  special_case?: string | number | null;
  joining_date?: string | null;

  // Student Validation Fields (29-30)
  validation_status: string; // 'Validated' | 'Absent' | 'ReValidated' | 'Pending' | 'Rejected' | 'Not Available'
  validation_done_by: string | null;

  // Metadata
  id?: number;
  upload_id?: string;
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
  module?: string; // 'dropout' | 'exception' | 'batch_closure' | 'general'
  restrictDeepTech?: boolean;
  trainer?: string;
  search?: string;
}

export interface OperationalSettings {
  attendanceThreshold: number; // e.g. 0.75 (75%)
  completionThreshold: number; // e.g. 0.80 (80%)
  batchDelayThresholdDays: number; // e.g. 0
  dropoutAlertThreshold: number; // e.g. 0.15 (15%)
  enableFacultyDeploymentIndex: boolean;
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

export interface UserRole {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'Academic Excellence Manager' | 'AE Member' | 'Viewer';
  permissions: string[];
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
    aliases: ['fm email id', 'fm email', 'fm_email_id', 'faculty email', 'faculty email id', 'trainer email', 'trainer email id', 'fm_email', 'email']
  },
  {
    key: 'batch_code',
    name: 'Batch Code',
    required: true,
    aliases: ['batch code', 'batchcode', 'batch_code', 'batch id', 'batch', 'batch_id']
  },
  {
    key: 'actual_center_code',
    name: 'Actual Center Code',
    required: false,
    aliases: ['actual center code', 'actual_center_code', 'center code', 'center', 'centercode', 'centre code', 'actual center']
  },
  {
    key: 'program_name',
    name: 'Program Name',
    required: false,
    aliases: ['program name', 'program_name', 'programname', 'program', 'course']
  },
  {
    key: 'gmeet_id',
    name: 'G-meet ID',
    required: false,
    aliases: ['g-meet id', 'gmeet id', 'gmeet_id', 'meet id', 'g meet id', 'google meet id', 'g-meet', 'gmeet', 'meeting id']
  },
  {
    key: 'batch_status',
    name: 'Batch Status',
    required: false,
    aliases: ['batch status', 'batch_status', 'batchstatus', 'status']
  },
  {
    key: 'actual_status',
    name: 'Actual Status',
    required: false,
    aliases: ['actual status', 'actual_status', 'actualstatus', 'class status', 'session status', 'conducted status']
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
      'schedule_class_start_time'
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
      'actual_class_start_time'
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
      'schedule_class_end_time'
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
      'actual_class_end_time'
    ]
  },
  {
    key: 'class_link',
    name: 'class_link',
    required: false,
    aliases: ['class_link', 'class link', 'meeting link', 'meet link', 'link', 'url', 'gmeet link']
  },
  {
    key: 'form_status',
    name: 'Form Status',
    required: false,
    aliases: ['form status', 'form_status', 'formstatus', 'submission status', 'form submitted']
  }
];

export interface ScheduledVsConductedRecord {
  id?: number;
  slot_date?: string | null;
  fm_email_id?: string | null;
  batch_code?: string | null;
  actual_center_code?: string | null;
  program_name?: string | null;
  gmeet_id?: string | null;
  batch_status?: string | null;
  actual_status?: string | null;
  schedule_class_start_time?: string | null;
  actual_class_started?: string | null;
  schedule_class_end_time?: string | null;
  actual_class_ended?: string | null;
  class_link?: string | null;
  form_status?: string | null;
  upload_id?: string | null;
  uploaded_by?: string | null;
  created_at?: string;
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
    rows: any[];
    totalCount: number;
  };
}

export const SLOT_REPLACEMENT_COLUMNS = [
  {
    key: 'emp_code',
    name: 'Emp Code',
    required: false,
    aliases: ['emp code', 'emp_code', 'empcode', 'employee code', 'trainer emp code', 'trainer code']
  },
  {
    key: 'trainer_name',
    name: 'Trainer Name',
    required: false,
    aliases: ['trainer name', 'trainer_name', 'trainer', 'faculty name', 'fm name', 'faculty']
  },
  {
    key: 'batch_code',
    name: 'Batch Code',
    required: true,
    aliases: ['batch code', 'batchcode', 'batch_code', 'batch id', 'batch']
  },
  {
    key: 'alias',
    name: 'Alias',
    required: false,
    aliases: ['alias', 'batch alias', 'trainer alias', 'alias name']
  },
  {
    key: 'actual_class_date',
    name: 'Actual Class Date',
    required: false,
    aliases: ['actual class date', 'actual_class_date', 'actual date', 'original class date', 'class date']
  },
  {
    key: 'replacement_class_date',
    name: 'Replacement Class Date',
    required: false,
    aliases: ['replacement class date', 'replacement_class_date', 'replacement date', 'rescheduled date', 'reschedule date']
  },
  {
    key: 'center_code',
    name: 'Center Code',
    required: false,
    aliases: ['center code', 'center_code', 'centercode', 'centre code']
  },
  {
    key: 'center_name',
    name: 'Center Name',
    required: false,
    aliases: ['center name', 'center_name', 'centername', 'centre name']
  },
  {
    key: 'approved_rejected_by',
    name: 'Approved/Rejected By',
    required: false,
    aliases: ['approved/rejected by', 'approved / rejected by', 'approved_rejected_by', 'approver', 'action by', 'approved by', 'rejected by']
  },
  {
    key: 'approval_rejected_date',
    name: 'Approval/Rejected Date',
    required: false,
    aliases: ['approval/rejected date', 'approval / rejected date', 'approval_rejected_date', 'approval date', 'rejected date', 'approved date']
  },
  {
    key: 'requested_date',
    name: 'Requested Date',
    required: false,
    aliases: ['requested date', 'requested_date', 'request date']
  },
  {
    key: 'request_status',
    name: 'Request Status',
    required: false,
    aliases: ['request status', 'request_status', 'status', 'approval status', 'replacement status']
  },
  {
    key: 'reason',
    name: 'Reason',
    required: false,
    aliases: ['reason', 'replacement reason', 'remarks', 'remark', 'comments']
  }
];

export interface SlotReplacementRecord {
  id?: number;
  emp_code?: string | null;
  trainer_name?: string | null;
  batch_code?: string | null;
  alias?: string | null;
  actual_class_date?: string | null;
  replacement_class_date?: string | null;
  center_code?: string | null;
  center_name?: string | null;
  approved_rejected_by?: string | null;
  approval_rejected_date?: string | null;
  requested_date?: string | null;
  request_status?: string | null;
  reason?: string | null;
  upload_id?: string | null;
  uploaded_by?: string | null;
  created_at?: string;
}

