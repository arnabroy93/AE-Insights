import React, { useState } from 'react';
import {
  Building2,
  Users,
  Layers,
  Search,
  Download,
  ChevronRight,
  TrendingUp,
  AlertTriangle
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

interface CenterAnalyticsProps {
  data: any[];
  loading: boolean;
  onSelectCenterDrilldown: (center: string) => void;
}

export const CenterAnalytics: React.FC<CenterAnalyticsProps> = ({
  data,
  loading,
  onSelectCenterDrilldown,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('total_students');
  const [sortAsc, setSortAsc] = useState(false);

  if (loading || !data) {
    return (
      <div className="p-8 text-center text-xs text-slate-500">
        <div className="animate-spin w-6 h-6 border-2 border-[#008C95] border-t-transparent rounded-full mx-auto mb-2" />
        Loading Center Analytics...
      </div>
    );
  }

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const sortedCenters = [...data]
    .filter((c: any) => c.center_code.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a: any, b: any) => {
      const valA = a[sortField];
      const valB = b[sortField];
      if (typeof valA === 'string') {
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortAsc ? (valA || 0) - (valB || 0) : (valB || 0) - (valA || 0);
    });

  const exportCentersCsv = () => {
    const headers = ['Center Code', 'Total Batches', 'Active Batches', 'Completed Batches', 'Total Students', 'Dropouts', 'Dropout %', 'Avg Attendance %', 'Avg ILT Comp %', 'Exceptions', 'Validated Students', 'Placed Students'];
    const rows = sortedCenters.map((c: any) => [
      c.center_code,
      c.total_batches,
      c.active_batches,
      c.completed_batches,
      c.total_students,
      c.dropouts,
      `${c.dropout_rate}%`,
      `${c.avg_attendance}%`,
      `${c.avg_ilt_completion}%`,
      c.exceptions,
      c.validated_students,
      c.placed_students
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r: any[]) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Center_Performance_Summary_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* 1. Center Comparison Chart */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Center-wise Student Volume &amp; Dropout Distribution</h3>
            <p className="text-xs text-slate-500">Student enrollment scale vs dropouts across operational centers</p>
          </div>
        </div>

        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.slice(0, 14)}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
              <XAxis dataKey="center_code" tick={{ fontSize: 10, fill: '#64748B' }} />
              <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
              <Tooltip contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '11px' }} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Bar dataKey="total_students" name="Total Students" fill="#008C95" radius={[4, 4, 0, 0]} />
              <Bar dataKey="dropouts" name="Dropouts" fill="#EF4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 2. Detailed Center Performance Matrix Table */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3 pb-2 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Center Performance Overview Table</h3>
            <p className="text-xs text-slate-500">
              Aggregated center analytics. Click column header to sort; click center to drill down.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search center..."
                className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:outline-hidden focus:ring-1 focus:ring-[#008C95]"
              />
            </div>
            <button
              onClick={exportCentersCsv}
              className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-100 text-[11px] font-bold text-slate-600 uppercase border-b border-slate-200 cursor-pointer select-none">
              <tr>
                <th className="px-3 py-3" onClick={() => handleSort('center_code')}>
                  Center {sortField === 'center_code' ? (sortAsc ? '▲' : '▼') : ''}
                </th>
                <th className="px-3 py-3 text-right" onClick={() => handleSort('total_batches')}>
                  Batches {sortField === 'total_batches' ? (sortAsc ? '▲' : '▼') : ''}
                </th>
                <th className="px-3 py-3 text-right" onClick={() => handleSort('active_batches')}>
                  Active {sortField === 'active_batches' ? (sortAsc ? '▲' : '▼') : ''}
                </th>
                <th className="px-3 py-3 text-right" onClick={() => handleSort('total_students')}>
                  Students {sortField === 'total_students' ? (sortAsc ? '▲' : '▼') : ''}
                </th>
                <th className="px-3 py-3 text-right" onClick={() => handleSort('dropouts')}>
                  Dropouts {sortField === 'dropouts' ? (sortAsc ? '▲' : '▼') : ''}
                </th>
                <th className="px-3 py-3 text-right" onClick={() => handleSort('dropout_rate')}>
                  Dropout % {sortField === 'dropout_rate' ? (sortAsc ? '▲' : '▼') : ''}
                </th>
                <th className="px-3 py-3 text-right" onClick={() => handleSort('avg_attendance')}>
                  Attendance % {sortField === 'avg_attendance' ? (sortAsc ? '▲' : '▼') : ''}
                </th>
                <th className="px-3 py-3 text-right" onClick={() => handleSort('avg_ilt_completion')}>
                  ILT Comp % {sortField === 'avg_ilt_completion' ? (sortAsc ? '▲' : '▼') : ''}
                </th>
                <th className="px-3 py-3 text-right" onClick={() => handleSort('exceptions')}>
                  Exceptions {sortField === 'exceptions' ? (sortAsc ? '▲' : '▼') : ''}
                </th>
                <th className="px-3 py-3 text-right" onClick={() => handleSort('validated_students')}>
                  Validated {sortField === 'validated_students' ? (sortAsc ? '▲' : '▼') : ''}
                </th>
                <th className="px-3 py-3 text-right" onClick={() => handleSort('placed_students')}>
                  Placed {sortField === 'placed_students' ? (sortAsc ? '▲' : '▼') : ''}
                </th>
                <th className="px-3 py-3 text-right">Drill</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedCenters.map((c: any) => (
                <tr key={c.center_code} className="hover:bg-slate-50">
                  <td className="px-3 py-2.5 font-bold text-slate-900">
                    <button
                      onClick={() => onSelectCenterDrilldown(c.center_code)}
                      className="text-[#008C95] hover:underline"
                    >
                      {c.center_code}
                    </button>
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono">{c.total_batches}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-emerald-700 font-semibold">{c.active_batches}</td>
                  <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-900">{c.total_students.toLocaleString()}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-rose-600 font-semibold">{c.dropouts}</td>
                  <td className="px-3 py-2.5 text-right font-mono">{c.dropout_rate}%</td>
                  <td className="px-3 py-2.5 text-right font-mono">{c.avg_attendance}%</td>
                  <td className="px-3 py-2.5 text-right font-mono">{c.avg_ilt_completion}%</td>
                  <td className="px-3 py-2.5 text-right font-mono text-amber-700">{c.exceptions}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-emerald-700">{c.validated_students}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-[#008C95] font-semibold">{c.placed_students}</td>
                  <td className="px-3 py-2.5 text-right">
                    <button
                      onClick={() => onSelectCenterDrilldown(c.center_code)}
                      className="text-[#008C95] hover:text-[#005F66]"
                    >
                      <ChevronRight className="w-4 h-4 inline" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
