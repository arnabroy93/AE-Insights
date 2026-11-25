import React from 'react';
import {
  CheckCircle2,
  Clock,
  UserX,
  ShieldCheck,
  Building2,
  UserCheck,
  Users
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
  CartesianGrid
} from 'recharts';

interface StudentValidationAnalyticsProps {
  data: any;
  loading: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  Validated: '#10B981',
  ReValidated: '#008C95',
  Pending: '#F59E0B',
  Absent: '#64748B',
  Rejected: '#EF4444',
  'Not Available': '#CBD5E1',
};

export const StudentValidationAnalytics: React.FC<StudentValidationAnalyticsProps> = ({
  data,
  loading,
}) => {
  if (loading || !data) {
    return (
      <div className="p-8 text-center text-xs text-slate-500">
        <div className="animate-spin w-6 h-6 border-2 border-[#008C95] border-t-transparent rounded-full mx-auto mb-2" />
        Loading Student Validation Analytics...
      </div>
    );
  }

  const { kpis, status_distribution, validator_breakdown, center_breakdown } = data;

  return (
    <div className="space-y-6">
      {/* 1. Validation KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase">Total Students</span>
          <div className="text-xl font-bold font-mono text-slate-900 mt-1 tabular-nums">
            {kpis.total_students.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Distinct Students</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase">Data Available</span>
          <div className="text-xl font-bold font-mono text-slate-900 mt-1 tabular-nums">
            {kpis.students_with_validation_status.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Records with Validation Status</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase">Completion Rate</span>
          <div className="text-xl font-bold font-mono text-[#008C95] mt-1 tabular-nums">
            {kpis.validation_completion_pct}%
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">(Validated + ReVal) / Available</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase">Validated</span>
          <div className="text-xl font-bold font-mono text-emerald-600 mt-1 tabular-nums">
            {kpis.validated_students.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Approved</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase">Pending</span>
          <div className="text-xl font-bold font-mono text-amber-600 mt-1 tabular-nums">
            {kpis.pending_students.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Awaiting Review</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase">Rejected / Absent</span>
          <div className="text-xl font-bold font-mono text-rose-600 mt-1 tabular-nums">
            {(kpis.rejected_students + kpis.absent_students).toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">{kpis.rejected_students} Rej · {kpis.absent_students} Abs</div>
        </div>
      </div>

      {/* 2. Validation Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution Donut */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900">Validation Status Distribution</h3>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={status_distribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {status_distribution.map((entry: any) => (
                    <Cell key={`val-${entry.name}`} fill={STATUS_COLORS[entry.name] || '#64748B'} />
                  ))}
                </Pie>
                <Tooltip formatter={(val: any) => [`${val} Students`, 'Count']} contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '11px' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Validator Activity */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900">Validations Completed by Validator</h3>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={validator_breakdown} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#64748B' }} />
                <YAxis dataKey="validator" type="category" width={120} tick={{ fontSize: 10, fill: '#64748B' }} />
                <Tooltip contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '11px' }} />
                <Bar dataKey="validated_count" name="Validated" fill="#10B981" stackId="a" />
                <Bar dataKey="revalidated_count" name="ReValidated" fill="#008C95" stackId="a" />
                <Bar dataKey="pending_count" name="Pending" fill="#F59E0B" stackId="a" />
                <Bar dataKey="rejected_count" name="Rejected" fill="#EF4444" stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 3. Center Validation Progress Table */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900">Center Validation Completion Breakdown</h3>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-100 text-[11px] font-bold text-slate-600 uppercase border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Center Code</th>
                <th className="px-4 py-3 text-right">Total Students</th>
                <th className="px-4 py-3 text-right">Completed Validations</th>
                <th className="px-4 py-3 text-right">Pending Validations</th>
                <th className="px-4 py-3 text-right">Rejected Validations</th>
                <th className="px-4 py-3 text-right">Validation Rate %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {center_breakdown.map((c: any) => (
                <tr key={c.center_code} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-bold text-slate-900">{c.center_code}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{c.total_students.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-emerald-700 font-semibold">{c.completed_validations}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-amber-700 font-semibold">{c.pending_validations}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-rose-600">{c.rejected_validations}</td>
                  <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-900">{c.completion_rate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
