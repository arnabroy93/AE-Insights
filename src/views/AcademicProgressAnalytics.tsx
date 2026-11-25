import React, { useState } from 'react';
import {
  CheckSquare,
  AlertCircle,
  Users,
  Building2,
  Sliders,
  Search,
  Download,
  ExternalLink
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
import { SourceRow } from '../types';

interface AcademicProgressAnalyticsProps {
  data: any;
  loading: boolean;
  onSelectRecord?: (record: any) => void;
}

export const AcademicProgressAnalytics: React.FC<AcademicProgressAnalyticsProps> = ({
  data,
  loading,
  onSelectRecord,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  if (loading || !data) {
    return (
      <div className="p-8 text-center text-xs text-slate-500">
        <div className="animate-spin w-6 h-6 border-2 border-[#008C95] border-t-transparent rounded-full mx-auto mb-2" />
        Loading Academic Progress Analytics...
      </div>
    );
  }

  const { kpis, center_attendance, low_attendance_students } = data;

  const filteredLowAttendance = low_attendance_students.filter((st: any) =>
    st.student_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    st.batch_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    st.center_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    st.assigned_trainers.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* 1. Academic Progress KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase">Running Attendance</span>
          <div className="text-xl font-bold font-mono text-[#008C95] mt-1 tabular-nums">
            {kpis.avg_running_attendance}%
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Average running class</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase">Beneficiary Attendance</span>
          <div className="text-xl font-bold font-mono text-[#008C95] mt-1 tabular-nums">
            {kpis.avg_beneficiary_attendance}%
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Average beneficiary</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase">ILT Completion</span>
          <div className="text-xl font-bold font-mono text-[#008C95] mt-1 tabular-nums">
            {kpis.avg_ilt_completion}%
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Instructor-led training</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase">FM Completion</span>
          <div className="text-xl font-bold font-mono text-[#008C95] mt-1 tabular-nums">
            {kpis.avg_fm_completion}%
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Foundation module</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase">Below Attendance Threshold</span>
          <div className="text-xl font-bold font-mono text-rose-600 mt-1 tabular-nums">
            {kpis.students_below_attendance_threshold.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">&lt; {kpis.thresholds.attendance}% attendance</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase">Below Completion Threshold</span>
          <div className="text-xl font-bold font-mono text-amber-600 mt-1 tabular-nums">
            {kpis.students_below_completion_threshold.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">&lt; {kpis.thresholds.completion}% completion</div>
        </div>
      </div>

      {/* 2. Attendance vs Completion Charts by Center */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Attendance vs Completion by Center</h3>
            <p className="text-xs text-slate-500">Comparison of average attendance and ILT/FM module completions</p>
          </div>
        </div>

        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={center_attendance}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
              <XAxis dataKey="center_code" tick={{ fontSize: 10, fill: '#64748B' }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748B' }} />
              <Tooltip contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '11px' }} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Bar dataKey="avg_running_attendance" name="Running Attendance %" fill="#008C95" radius={[4, 4, 0, 0]} />
              <Bar dataKey="avg_ilt_completion" name="ILT Completion %" fill="#14B8A6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="avg_fm_completion" name="FM Completion %" fill="#6366F1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 3. Attention Area: Low Attendance & Low Completion Student Register */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3 pb-2 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500" />
              <h3 className="text-sm font-bold text-slate-900">
                Attention Required: Low Attendance Student List ({low_attendance_students.length} Records)
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Students falling below the {kpis.thresholds.attendance}% attendance operational threshold
            </p>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search student / batch..."
              className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:outline-hidden focus:ring-1 focus:ring-[#008C95]"
            />
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-100 text-[11px] font-bold text-slate-600 uppercase border-b border-slate-200">
              <tr>
                <th className="px-3 py-3">Student Code</th>
                <th className="px-3 py-3">Batch Code</th>
                <th className="px-3 py-3">Center</th>
                <th className="px-3 py-3">Program</th>
                <th className="px-3 py-3">Trainer</th>
                <th className="px-3 py-3 text-right">Running Attendance %</th>
                <th className="px-3 py-3 text-right">Beneficiary Attendance %</th>
                <th className="px-3 py-3 text-right">ILT Completion %</th>
                <th className="px-3 py-3 text-right">FM Completion %</th>
                <th className="px-3 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLowAttendance.map((st: any, idx: number) => (
                <tr key={`${st.student_code}_${idx}`} className="hover:bg-rose-50/30">
                  <td className="px-3 py-2.5 font-mono font-bold text-slate-900">{st.student_code}</td>
                  <td className="px-3 py-2.5 font-mono text-slate-800">{st.batch_code}</td>
                  <td className="px-3 py-2.5 font-semibold text-slate-800">{st.center_code}</td>
                  <td className="px-3 py-2.5 text-slate-600">{st.program_name}</td>
                  <td className="px-3 py-2.5 text-slate-700">{st.assigned_trainers}</td>
                  <td className="px-3 py-2.5 text-right font-mono font-bold text-rose-600">
                    {st.running_attendance_pct}%
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-rose-600">
                    {st.beneficiary_attendance_pct}%
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-slate-700">
                    {st.ilt_completion_pct}%
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-slate-700">
                    {st.fm_completion_pct}%
                  </td>
                  <td className="px-3 py-2.5 capitalize">{st.enrollment_status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
