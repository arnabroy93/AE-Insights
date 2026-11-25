import React from 'react';
import {
  UserCheck,
  Layers,
  Users,
  Building2,
  CheckCircle2,
  AlertTriangle,
  Info
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from 'recharts';

interface AeAnalyticsProps {
  data: any[];
  loading: boolean;
}

export const AeAnalytics: React.FC<AeAnalyticsProps> = ({ data, loading }) => {
  if (loading || !data) {
    return (
      <div className="p-8 text-center text-xs text-slate-500">
        <div className="animate-spin w-6 h-6 border-2 border-[#008C95] border-t-transparent rounded-full mx-auto mb-2" />
        Loading Academic Excellence &amp; RM/SH/ZH Analytics...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Descriptive Policy Notice */}
      <div className="bg-[#E6F4F5] border border-[#CCECF0] rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-[#005F66]">
        <Info className="w-4 h-4 text-[#008C95] shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">AE Analytics Policy:</span>{' '}
          This dashboard displays descriptive operational statistics for Assigned AE Members and Regional Leadership (RM/SH/ZH). In accordance with Anudip policy, this data is strictly operational and does NOT represent an arbitrary employee ranking or performance evaluation score.
        </div>
      </div>

      {/* 1. AE Batch & Student Allocation Chart */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900">Assigned AE Batch Coverage</h3>
          <span className="text-xs text-slate-500">Active vs Completed Batches</span>
        </div>

        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
              <XAxis dataKey="ae_name" tick={{ fontSize: 10, fill: '#64748B' }} />
              <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
              <Tooltip contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '11px' }} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Bar dataKey="active_batches" name="Active Batches" fill="#008C95" radius={[4, 4, 0, 0]} />
              <Bar dataKey="completed_batches" name="Completed Batches" fill="#94A3B8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 2. AE Operational Register Table */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Academic Excellence (AE) Operational Coverage Register</h3>
            <p className="text-xs text-slate-500">Descriptive metrics for batches, centers, student coverage, and validation</p>
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-100 text-[11px] font-bold text-slate-600 uppercase border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Assigned AE</th>
                <th className="px-4 py-3 text-right">Total Batches</th>
                <th className="px-4 py-3 text-right">Active Batches</th>
                <th className="px-4 py-3 text-right">Completed Batches</th>
                <th className="px-4 py-3 text-right">Centers</th>
                <th className="px-4 py-3 text-right">Students</th>
                <th className="px-4 py-3 text-right">Dropouts</th>
                <th className="px-4 py-3 text-right">Dropout %</th>
                <th className="px-4 py-3 text-right">Exceptions</th>
                <th className="px-4 py-3 text-right">Validated Students</th>
                <th className="px-4 py-3 text-right">Avg Attendance</th>
                <th className="px-4 py-3 text-right">Avg ILT Comp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((ae: any) => (
                <tr key={ae.ae_name} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-bold text-slate-900">{ae.ae_name}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{ae.total_batches}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-emerald-700 font-semibold">{ae.active_batches}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-600">{ae.completed_batches}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{ae.total_centers}</td>
                  <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-900">{ae.total_students.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-rose-600">{ae.dropouts}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{ae.dropout_rate}%</td>
                  <td className="px-4 py-2.5 text-right font-mono text-amber-700">{ae.exceptions}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-emerald-700">{ae.validated_students}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{ae.avg_attendance}%</td>
                  <td className="px-4 py-2.5 text-right font-mono">{ae.avg_ilt_completion}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
