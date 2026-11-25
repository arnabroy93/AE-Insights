import React from 'react';
import {
  Briefcase,
  Users,
  Award,
  Building2,
  CheckCircle2
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

interface PlacementAnalyticsProps {
  data: any;
  loading: boolean;
}

const COLORS = ['#008C95', '#14B8A6', '#F59E0B', '#6366F1'];

export const PlacementAnalytics: React.FC<PlacementAnalyticsProps> = ({ data, loading }) => {
  if (loading || !data) {
    return (
      <div className="p-8 text-center text-xs text-slate-500">
        <div className="animate-spin w-6 h-6 border-2 border-[#008C95] border-t-transparent rounded-full mx-auto mb-2" />
        Loading Placement Analytics...
      </div>
    );
  }

  const { kpis, distribution, by_program } = data;

  return (
    <div className="space-y-6">
      {/* 1. Placement KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase">Placement Data</span>
          <div className="text-xl font-bold font-mono text-slate-900 mt-1 tabular-nums">
            {kpis.students_with_placement_info.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Students with records</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase">Total Placed</span>
          <div className="text-xl font-bold font-mono text-[#008C95] mt-1 tabular-nums">
            {kpis.total_placed_students.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">All Placement Types</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase">Anudip CRD</span>
          <div className="text-xl font-bold font-mono text-[#008C95] mt-1 tabular-nums">
            {kpis.placed_by_crd.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Central Placement</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase">Self Placed</span>
          <div className="text-xl font-bold font-mono text-emerald-600 mt-1 tabular-nums">
            {kpis.self_placed.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Direct candidate placement</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase">Center / Local</span>
          <div className="text-xl font-bold font-mono text-amber-600 mt-1 tabular-nums">
            {kpis.placed_by_local.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Local center drive</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase">College / Campus</span>
          <div className="text-xl font-bold font-mono text-indigo-600 mt-1 tabular-nums">
            {kpis.placed_by_campus.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Campus hiring</div>
        </div>
      </div>

      {/* 2. Placement Distribution & Program Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Placement Type Breakdown */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900">Placement Type Distribution</h3>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={distribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {distribution.map((entry: any, idx: number) => (
                    <Cell key={`pl-${idx}`} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(val: any) => [`${val} Students`, 'Count']} contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '11px' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Placements by Program */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900">Placements by Program</h3>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={by_program} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#64748B' }} />
                <YAxis dataKey="program_name" type="category" width={110} tick={{ fontSize: 10, fill: '#64748B' }} />
                <Tooltip contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '11px' }} />
                <Bar dataKey="placed_students" name="Placed Students" fill="#008C95" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
