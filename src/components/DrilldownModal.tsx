import React, { useState, useEffect } from 'react';
import { ChevronRight, Building2, Layers, User, X, ArrowLeft, ExternalLink } from 'lucide-react';
import { api } from '../api';
import { SourceRow } from '../types';

interface DrilldownModalProps {
  initialCenter: string | null;
  onClose: () => void;
  onSelectRecord: (record: SourceRow) => void;
}

export const DrilldownModal: React.FC<DrilldownModalProps> = ({
  initialCenter,
  onClose,
  onSelectRecord,
}) => {
  const [selectedCenter, setSelectedCenter] = useState<string | null>(initialCenter);
  const [selectedBatch, setSelectedBatch] = useState<string | null>(null);
  const [students, setStudents] = useState<SourceRow[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selectedCenter && !selectedBatch) {
      loadCenterBatches(selectedCenter);
    } else if (selectedCenter && selectedBatch) {
      loadBatchStudents(selectedCenter, selectedBatch);
    }
  }, [selectedCenter, selectedBatch]);

  const loadCenterBatches = async (center: string) => {
    setLoading(true);
    try {
      const data = await api.getBatchClosureAnalytics({ centerCode: center });
      setBatches(data.delayed_batches || []);
      // Also get all distinct batches by querying records
      const recs = await api.getRecords({ centerCode: center }, 1, 100);
      const uniqueBatches = Array.from(new Set(recs.records.map((r: SourceRow) => r.batch_code))).map(bCode => {
        const found = recs.records.find((r: SourceRow) => r.batch_code === bCode);
        return {
          batch_code: bCode,
          program_name: found?.program_name,
          assigned_trainers: found?.assigned_trainers,
          batch_status: found?.batch_status,
          batch_start_date: found?.batch_start_date,
        };
      });
      setBatches(uniqueBatches);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadBatchStudents = async (center: string, batch: string) => {
    setLoading(true);
    try {
      const data = await api.getRecords({ centerCode: center, batchCode: batch }, 1, 100);
      setStudents(data.records || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!selectedCenter) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header with Breadcrumb */}
        <div className="px-6 py-4 bg-[#008C95] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-sm font-semibold flex-wrap">
            <button
              onClick={() => {
                setSelectedBatch(null);
              }}
              className="flex items-center gap-1 hover:underline text-white/90"
            >
              <Building2 className="w-4 h-4" />
              <span>Center: {selectedCenter}</span>
            </button>

            {selectedBatch && (
              <>
                <ChevronRight className="w-4 h-4 text-white/60" />
                <span className="flex items-center gap-1 text-white font-bold">
                  <Layers className="w-4 h-4" />
                  <span>Batch: {selectedBatch}</span>
                </span>
              </>
            )}
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {loading && (
            <div className="p-12 text-center text-xs text-slate-500">
              Loading drill-down records...
            </div>
          )}

          {/* Level 1: Batches in Center */}
          {!loading && !selectedBatch && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-bold text-slate-900">
                  Batches in Center {selectedCenter} ({batches.length})
                </h4>
                <span className="text-xs text-slate-500">Click a batch to view students</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {batches.map((b) => (
                  <div
                    key={b.batch_code}
                    onClick={() => setSelectedBatch(b.batch_code)}
                    className="p-3.5 bg-slate-50 hover:bg-[#E6F4F5] border border-slate-200/80 rounded-xl transition-colors cursor-pointer text-xs flex items-center justify-between group"
                  >
                    <div>
                      <div className="font-mono font-bold text-slate-900 group-hover:text-[#005F66]">
                        {b.batch_code}
                      </div>
                      <div className="text-slate-600 mt-0.5">{b.program_name}</div>
                      <div className="text-slate-400 text-[11px] mt-0.5">
                        Trainer: {b.assigned_trainers} · Status: {b.batch_status}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-[#008C95]" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Level 2: Students in Batch */}
          {!loading && selectedBatch && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={() => setSelectedBatch(null)}
                  className="flex items-center gap-1 text-xs font-semibold text-[#008C95] hover:underline"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Batches</span>
                </button>
                <span className="text-xs text-slate-500">
                  {students.length} Students in {selectedBatch}
                </span>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-100 text-[11px] font-bold text-slate-600 uppercase border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2">Student Code</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Dropout Type</th>
                      <th className="px-3 py-2">Attendance</th>
                      <th className="px-3 py-2">Completion</th>
                      <th className="px-3 py-2">Exam Marks</th>
                      <th className="px-3 py-2">Validation</th>
                      <th className="px-3 py-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {students.map((st) => (
                      <tr key={st.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-mono font-bold text-slate-900">{st.student_code}</td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${st.enrollment_status === 'dropped out' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                            {st.enrollment_status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-slate-500">{st.dropout_type || '—'}</td>
                        <td className="px-3 py-2 font-mono font-semibold">
                          {st.running_attendance !== null ? `${(st.running_attendance * 100).toFixed(0)}%` : '—'}
                        </td>
                        <td className="px-3 py-2 font-mono font-semibold">
                          {st.ilt_completion !== null ? `${(st.ilt_completion * 100).toFixed(0)}%` : '—'}
                        </td>
                        <td className="px-3 py-2 font-mono">
                          {st.final_exam_marks !== null ? st.final_exam_marks : '—'}
                        </td>
                        <td className="px-3 py-2">{st.validation_status || '—'}</td>
                        <td className="px-3 py-2 text-right">
                          <button
                            onClick={() => {
                              onSelectRecord(st);
                              onClose();
                            }}
                            className="p-1 text-[#008C95] hover:bg-[#E6F4F5] rounded transition-colors"
                            title="View full record"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
