import React, { useState } from 'react';
import {
  Users,
  Briefcase,
  Layers,
  Building2,
  BookOpen,
  Info,
  Search,
  Download,
  AlertCircle
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

interface FacultyAnalyticsProps {
  data: any;
  loading: boolean;
}

export const FacultyAnalytics: React.FC<FacultyAnalyticsProps> = ({ data, loading }) => {
  const [searchTerm, setSearchTerm] = useState('');

  if (loading || !data) {
    return (
      <div className="p-8 text-center text-xs text-slate-500">
        <div className="animate-spin w-6 h-6 border-2 border-[#008C95] border-t-transparent rounded-full mx-auto mb-2" />
        Loading Faculty Deployment & Workload Analytics...
      </div>
    );
  }

  const { kpis, proxy_disclaimer, trainers } = data;

  const filteredTrainers = trainers.filter((t: any) =>
    t.trainer_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Disclaimer Banner for Proxy Metric */}
      <div className="bg-[#E6F4F5] border border-[#CCECF0] rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-[#005F66]">
        <Info className="w-4 h-4 text-[#008C95] shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">Faculty Deployment Policy:</span>{' '}
          {proxy_disclaimer}
        </div>
      </div>

      {/* 1. Faculty Deployment KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase">Total Trainers</span>
          <div className="text-xl font-bold font-mono text-slate-900 mt-1 tabular-nums">
            {kpis.total_trainers}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Distinct Faculty</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase">Active Trainers</span>
          <div className="text-xl font-bold font-mono text-emerald-600 mt-1 tabular-nums">
            {kpis.trainers_assigned_active_batches}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">With Running Batches</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase">Completed Trainers</span>
          <div className="text-xl font-bold font-mono text-[#008C95] mt-1 tabular-nums">
            {kpis.trainers_assigned_completed_batches}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">With Closed Batches</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase">Multi-Batch Load</span>
          <div className="text-xl font-bold font-mono text-amber-600 mt-1 tabular-nums">
            {kpis.trainers_multiple_active_batches}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">&gt;1 active batch</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase">Avg Active Batches</span>
          <div className="text-xl font-bold font-mono text-slate-900 mt-1 tabular-nums">
            {kpis.avg_active_batches_per_trainer}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Batches / Active Trainer</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase">Avg Students / Trainer</span>
          <div className="text-xl font-bold font-mono text-slate-900 mt-1 tabular-nums">
            {kpis.avg_students_per_active_trainer}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">In active batches</div>
        </div>
      </div>

      {/* 2. Workload Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active vs Completed Batches per Trainer */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900">Trainer Batch Allocation</h3>
            <span className="text-xs text-slate-500">Active vs Completed</span>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trainers.slice(0, 10)}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="trainer_name" tick={{ fontSize: 10, fill: '#64748B' }} interval={0} />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                <Tooltip contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '11px' }} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="active_batches" name="Active Batches" fill="#008C95" radius={[4, 4, 0, 0]} />
                <Bar dataKey="completed_batches" name="Completed Batches" fill="#94A3B8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Student Load per Trainer */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900">Active Student Load per Faculty</h3>
            <span className="text-xs text-slate-500">Distinct student count</span>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trainers.slice(0, 10)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#64748B' }} />
                <YAxis dataKey="trainer_name" type="category" width={110} tick={{ fontSize: 10, fill: '#64748B' }} />
                <Tooltip contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '11px' }} />
                <Bar dataKey="active_students" name="Active Students" fill="#14B8A6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 3. Detailed Faculty Workload Register */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3 pb-2 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Faculty Deployment &amp; Workload Register</h3>
            <p className="text-xs text-slate-500">
              Descriptive workload indicators based on batch and student assignments
            </p>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search faculty name..."
              className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:outline-hidden focus:ring-1 focus:ring-[#008C95]"
            />
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-100 text-[11px] font-bold text-slate-600 uppercase border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Faculty / Trainer</th>
                <th className="px-4 py-3 text-right">Active Batches</th>
                <th className="px-4 py-3 text-right">Completed Batches</th>
                <th className="px-4 py-3 text-right">Active Students</th>
                <th className="px-4 py-3 text-right">Total Students</th>
                <th className="px-4 py-3 text-right">Centers</th>
                <th className="px-4 py-3 text-right">Avg Attendance</th>
                <th className="px-4 py-3 text-right">Avg ILT Comp</th>
                {kpis.is_proxy_enabled && (
                  <th className="px-4 py-3 text-right">
                    <span title="Analytical proxy based on batch & student allocation" className="cursor-help underline decoration-dotted">
                      Deployment Index (Proxy)
                    </span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTrainers.map((t: any) => (
                <tr key={t.trainer_name} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-bold text-slate-900">{t.trainer_name}</td>
                  <td className="px-4 py-2.5 text-right font-mono font-semibold text-emerald-700">{t.active_batches}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-600">{t.completed_batches}</td>
                  <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-900">{t.active_students}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-600">{t.total_students}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{t.center_count}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{t.avg_attendance}%</td>
                  <td className="px-4 py-2.5 text-right font-mono">{t.avg_ilt_completion}%</td>
                  {kpis.is_proxy_enabled && (
                    <td className="px-4 py-2.5 text-right font-mono font-bold text-[#008C95]">
                      {t.faculty_deployment_index} / 100
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
