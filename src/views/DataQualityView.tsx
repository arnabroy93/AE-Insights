import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Database,
  BarChart3,
  RefreshCw
} from 'lucide-react';
import { api } from '../api';

export const DataQualityView: React.FC = () => {
  const [metrics, setMetrics] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadQuality();
  }, []);

  const loadQuality = async () => {
    setLoading(true);
    try {
      const data = await api.getDataQuality();
      setMetrics(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !metrics) {
    return (
      <div className="p-8 text-center text-xs text-slate-500">
        <div className="animate-spin w-6 h-6 border-2 border-[#008C95] border-t-transparent rounded-full mx-auto mb-2" />
        Loading Data Quality Metrics...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#008C95] text-white flex items-center justify-center font-bold">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Data Quality &amp; Hygiene Dashboard</h2>
            <p className="text-xs text-slate-500">
              Field completeness, missing key indicators &amp; structural health scores
            </p>
          </div>
        </div>

        <button
          onClick={loadQuality}
          className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Scores</span>
        </button>
      </div>

      {/* Top Quality Score & Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase">Data Quality %</span>
          <div className="text-2xl font-bold font-mono text-emerald-600 mt-1 tabular-nums">
            {metrics.data_quality_pct}%
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Valid / Total Records × 100</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase">Total Records</span>
          <div className="text-2xl font-bold font-mono text-slate-900 mt-1 tabular-nums">
            {metrics.total_records.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Imported Excel Rows</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase">Valid Records</span>
          <div className="text-2xl font-bold font-mono text-emerald-600 mt-1 tabular-nums">
            {metrics.valid_records.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Complete Mandatory Keys</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase">Missing Mandatory Keys</span>
          <div className="text-2xl font-bold font-mono text-rose-600 mt-1 tabular-nums">
            {metrics.invalid_records}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Student / Batch / Center</div>
        </div>
      </div>

      {/* Field Completeness Scores */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100">
          Field Completeness &amp; Hygiene Scores
        </h3>

        <div className="space-y-3">
          {Object.entries(metrics.field_scores).map(([field, score]: any) => (
            <div key={field} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-slate-700 capitalize">{field.replace(/_/g, ' ')}</span>
                <span className="font-mono font-bold text-slate-900">{score}%</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    score >= 95 ? 'bg-emerald-500' : score >= 80 ? 'bg-[#008C95]' : 'bg-amber-500'
                  }`}
                  style={{ width: `${score}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Missing Values Breakdown Table */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100">
          Missing Values Diagnostic Breakdown
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60">
            <span className="text-slate-500">Missing Student Codes</span>
            <div className="text-lg font-bold font-mono text-slate-900 mt-0.5">{metrics.missing_student_codes}</div>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60">
            <span className="text-slate-500">Missing Batch Codes</span>
            <div className="text-lg font-bold font-mono text-slate-900 mt-0.5">{metrics.missing_batch_codes}</div>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60">
            <span className="text-slate-500">Missing Center Codes</span>
            <div className="text-lg font-bold font-mono text-slate-900 mt-0.5">{metrics.missing_center_codes}</div>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60">
            <span className="text-slate-500">Missing Trainer Mapping</span>
            <div className="text-lg font-bold font-mono text-slate-900 mt-0.5">{metrics.missing_trainer_mapping}</div>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60">
            <span className="text-slate-500">Missing Dates</span>
            <div className="text-lg font-bold font-mono text-slate-900 mt-0.5">{metrics.missing_dates}</div>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60">
            <span className="text-slate-500">Missing Validation Info</span>
            <div className="text-lg font-bold font-mono text-slate-900 mt-0.5">{metrics.missing_validation_data}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
