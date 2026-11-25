import React from 'react';
import { SourceRow } from '../types';
import { X, User, BookOpen, Award, CheckCircle2, AlertTriangle, Briefcase, Calendar, CheckSquare, Mail } from 'lucide-react';

interface RecordDetailModalProps {
  record: SourceRow | null;
  onClose: () => void;
}

export const RecordDetailModal: React.FC<RecordDetailModalProps> = ({ record, onClose }) => {
  if (!record) return null;

  const formatPct = (val: number | null) => {
    if (val === null || val === undefined) return 'No Data';
    return `${(val * 100).toFixed(1)}%`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 bg-[#008C95] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center font-mono font-bold text-lg">
              {record.student_code.substring(0, 3)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold tracking-tight">{record.student_code}</h3>
                <span className="text-xs px-2 py-0.5 bg-white/20 rounded font-medium">
                  {record.batch_code}
                </span>
                <span className="text-xs px-2 py-0.5 bg-white/20 rounded font-medium">
                  {record.center_code}
                </span>
              </div>
              <p className="text-xs text-white/80">
                {record.program_name} · Funder: {record.funder_name}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body - 8 Logical Sections */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-700">
          {/* 1. Student Information */}
          <div>
            <div className="flex items-center gap-1.5 font-bold text-sm text-slate-900 mb-3 pb-1 border-b border-slate-200">
              <User className="w-4 h-4 text-[#008C95]" />
              <h4>1. Student Information</h4>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
              <div>
                <span className="text-slate-400 font-medium">Student Code</span>
                <p className="font-mono font-bold text-slate-900 mt-0.5">{record.student_code}</p>
              </div>
              <div>
                <span className="text-slate-400 font-medium">Enrollment Status</span>
                <p className={`font-semibold mt-0.5 ${record.enrollment_status === 'dropped out' ? 'text-rose-600' : 'text-emerald-700'}`}>
                  {record.enrollment_status}
                </p>
              </div>
              <div>
                <span className="text-slate-400 font-medium">Dropout Type</span>
                <p className="font-medium text-slate-800 mt-0.5">{record.dropout_type || 'Not Applicable'}</p>
              </div>
              <div>
                <span className="text-slate-400 font-medium">Email Verification</span>
                <p className="font-medium text-slate-800 mt-0.5">
                  {record.email_verification_status === 'y' ? 'Verified (y)' : record.email_verification_status === 'p' ? 'Pending (p)' : 'Not Verified (n)'}
                </p>
              </div>
            </div>
          </div>

          {/* 2. Batch Information */}
          <div>
            <div className="flex items-center gap-1.5 font-bold text-sm text-slate-900 mb-3 pb-1 border-b border-slate-200">
              <BookOpen className="w-4 h-4 text-[#008C95]" />
              <h4>2. Batch Information</h4>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
              <div>
                <span className="text-slate-400 font-medium">Batch Code</span>
                <p className="font-mono font-bold text-slate-900 mt-0.5">{record.batch_code}</p>
              </div>
              <div>
                <span className="text-slate-400 font-medium">Center Code</span>
                <p className="font-semibold text-slate-900 mt-0.5">{record.center_code}</p>
              </div>
              <div>
                <span className="text-slate-400 font-medium">Funder Name</span>
                <p className="font-medium text-slate-800 mt-0.5">{record.funder_name}</p>
              </div>
              <div>
                <span className="text-slate-400 font-medium">Program Name</span>
                <p className="font-medium text-slate-800 mt-0.5">{record.program_name}</p>
              </div>
              <div>
                <span className="text-slate-400 font-medium">Course Code</span>
                <p className="font-mono text-slate-800 mt-0.5">{record.course_code || 'Not Available'}</p>
              </div>
              <div>
                <span className="text-slate-400 font-medium">Batch Status</span>
                <p className="font-semibold text-slate-800 capitalize mt-0.5">{record.batch_status}</p>
              </div>
              <div>
                <span className="text-slate-400 font-medium">Batch Validation Status</span>
                <p className="font-medium text-slate-800 mt-0.5">{record.batch_validation_status}</p>
              </div>
              <div>
                <span className="text-slate-400 font-medium">Batch Start Date</span>
                <p className="font-medium text-slate-800 mt-0.5">{record.batch_start_date || 'Not Available'}</p>
              </div>
              <div>
                <span className="text-slate-400 font-medium">Planned End Date</span>
                <p className="font-medium text-slate-800 mt-0.5">{record.batch_end_date || 'Not Available'}</p>
              </div>
              <div>
                <span className="text-slate-400 font-medium">Actual End Date</span>
                <p className="font-medium text-slate-800 mt-0.5">{record.batch_actual_end_date || 'Not Available'}</p>
              </div>
            </div>
          </div>

          {/* 3. Faculty / Trainer & Management */}
          <div>
            <div className="flex items-center gap-1.5 font-bold text-sm text-slate-900 mb-3 pb-1 border-b border-slate-200">
              <Briefcase className="w-4 h-4 text-[#008C95]" />
              <h4>3. Faculty & Management Deployment</h4>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
              <div>
                <span className="text-slate-400 font-medium">Assigned Trainer</span>
                <p className="font-semibold text-slate-900 mt-0.5">{record.assigned_trainers}</p>
              </div>
              <div>
                <span className="text-slate-400 font-medium">Assigned AE (Academic Excellence)</span>
                <p className="font-semibold text-slate-900 mt-0.5">{record.assigned_ae}</p>
              </div>
              <div>
                <span className="text-slate-400 font-medium">RM / SH / ZH</span>
                <p className="font-medium text-slate-800 mt-0.5">{record.rm_sh_zh}</p>
              </div>
            </div>
          </div>

          {/* 4. Academic Progress */}
          <div>
            <div className="flex items-center gap-1.5 font-bold text-sm text-slate-900 mb-3 pb-1 border-b border-slate-200">
              <CheckSquare className="w-4 h-4 text-[#008C95]" />
              <h4>4. Academic Progress & Attendance (Converted from decimals)</h4>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
              <div>
                <span className="text-slate-400 font-medium">Running Attendance %</span>
                <p className="font-mono font-bold text-slate-900 text-sm mt-0.5">{formatPct(record.running_attendance)}</p>
              </div>
              <div>
                <span className="text-slate-400 font-medium">Beneficiary Class Attendance %</span>
                <p className="font-mono font-bold text-slate-900 text-sm mt-0.5">{formatPct(record.beneficiary_class_attendance)}</p>
              </div>
              <div>
                <span className="text-slate-400 font-medium">ILT Completion %</span>
                <p className="font-mono font-bold text-slate-900 text-sm mt-0.5">{formatPct(record.ilt_completion)}</p>
              </div>
              <div>
                <span className="text-slate-400 font-medium">FM Class Completion % (Running)</span>
                <p className="font-mono font-bold text-slate-900 text-sm mt-0.5">{formatPct(record.fm_class_completion)}</p>
              </div>
            </div>
          </div>

          {/* 5. Exceptions & Student Validation */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center gap-1.5 font-bold text-sm text-slate-900 mb-3 pb-1 border-b border-slate-200">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <h4>5. Exception Flags</h4>
              </div>
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Academic Exception:</span>
                  <span className={`font-semibold px-2 py-0.5 rounded text-xs ${(record.incomplete_attendance_exception === 1 || record.is_exception === 1) ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}`}>
                    {(record.incomplete_attendance_exception === 1 || record.is_exception === 1) ? 'Yes (Exception Flagged)' : 'No (Compliant / Exempt)'}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500">
                  {(record.incomplete_attendance_exception === 1 || record.is_exception === 1)
                    ? 'Student is trained but non-compliant with ILT completion & attendance thresholds.'
                    : 'Within compliance thresholds or granted Special Approval.'}
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-1.5 font-bold text-sm text-slate-900 mb-3 pb-1 border-b border-slate-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <h4>6. Student Validation & Special Case</h4>
              </div>
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Validation Status Student wise:</span>
                  <span className="font-semibold text-slate-900">{record.validation_status || 'Not Available'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Validation Done By:</span>
                  <span className="font-medium text-slate-800">{record.validation_done_by || 'Not Available'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Special Case:</span>
                  <span className={`font-semibold px-2 py-0.5 rounded text-xs ${(String(record.special_case ?? '').trim() === '1' || record.special_case === 1) ? 'bg-amber-100 text-amber-800' : 'text-slate-600'}`}>
                    {(String(record.special_case ?? '').trim() === '1' || record.special_case === 1) ? 'Special Case (1)' : (record.special_case || 'None / 0')}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 7. Assessment & Placement */}
          <div>
            <div className="flex items-center gap-1.5 font-bold text-sm text-slate-900 mb-3 pb-1 border-b border-slate-200">
              <Award className="w-4 h-4 text-[#008C95]" />
              <h4>7. Assessment & Placement Outcomes</h4>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
              <div>
                <span className="text-slate-400 font-medium">Final Exam Marks</span>
                <p className="font-mono font-bold text-slate-900 mt-0.5">
                  {record.final_exam_marks !== null && record.final_exam_marks !== undefined ? `${record.final_exam_marks} / 100` : 'No Data'}
                </p>
              </div>
              <div>
                <span className="text-slate-400 font-medium">Exam Schedule Date</span>
                <p className="font-medium text-slate-800 mt-0.5">{record.exam_schedule_date || 'No Data'}</p>
              </div>
              <div>
                <span className="text-slate-400 font-medium">Placement Type</span>
                <p className="font-semibold text-[#008C95] mt-0.5">{record.placement_type || 'No Data / Not Placed'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
          >
            Close Record
          </button>
        </div>
      </div>
    </div>
  );
};
