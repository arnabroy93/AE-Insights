import React, { useState } from 'react';
import {
  Building2,
  Layers,
  Users,
  PlayCircle,
  CheckCircle2,
  PauseCircle,
  UserX,
  AlertTriangle,
  Clock,
  TrendingUp,
  FileSpreadsheet,
  Award,
  ChevronRight,
  ShieldCheck,
  Upload,
  ArrowRight,
  Video,
  RefreshCw
} from 'lucide-react';
import { api } from '../api';
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
  LineChart,
  Line,
  CartesianGrid
} from 'recharts';
import { PresentableChartCard } from '../components/PresentableChartCard';
import { PresentableChartItem } from '../components/MeetingPresenterModal';

interface ExecutiveOverviewProps {
  data: any;
  loading: boolean;
  onNavigateToView: (view: string) => void;
  onSelectCenterDrilldown: (center: string) => void;
  onOpenPresenter?: (charts: PresentableChartItem[], startIndex?: number) => void;
}

const COLORS = ['#008C95', '#14B8A6', '#F59E0B', '#EF4444', '#6366F1', '#8B5CF6'];

export const ExecutiveOverview: React.FC<ExecutiveOverviewProps> = ({
  data,
  loading,
  onNavigateToView,
  onSelectCenterDrilldown,
}) => {
  const [syncingDb, setSyncingDb] = useState(false);

  if (loading || !data) {
    return (
      <div className="p-8 text-center text-xs text-slate-500">
        <div className="animate-spin w-6 h-6 border-2 border-[#008C95] border-t-transparent rounded-full mx-auto mb-2" />
        Loading Executive Academic Snapshot...
      </div>
    );
  }

  const { kpis, academic_health, attention_areas, batch_status_distribution, dropout_type_distribution, center_dropout_ranking, latest_upload } = data;

  // Empty State Banner when no dataset is uploaded
  if (kpis.total_students === 0) {
    return (
      <div className="bg-white rounded-2xl border border-dashed border-[#008C95]/40 p-10 shadow-xs text-center max-w-2xl mx-auto my-12">
        <div className="w-16 h-12 rounded-2xl bg-[#008C95]/10 text-[#008C95] flex items-center justify-center mx-auto mb-4">
          <Upload className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 mb-2">
          No Academic Data In Portal
        </h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto mb-6 leading-relaxed">
          All demo data has been removed from the portal. Everything should be based on your uploaded data. Please upload your Anudip Academic Excellence Excel or CSV export (30 standard columns) to populate live analytics.
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <button
            onClick={() => onNavigateToView('upload')}
            className="px-5 py-2.5 bg-[#008C95] hover:bg-[#00747C] text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>Go to Excel Upload Center</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={async () => {
              setSyncingDb(true);
              try {
                await api.syncFromMysql();
                window.location.reload();
              } catch (e: any) {
                console.error(e);
              } finally {
                setSyncingDb(false);
              }
            }}
            disabled={syncingDb}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold border border-slate-300 flex items-center gap-2 transition-colors cursor-pointer"
            title="Pull and synchronize uploaded records from the MySQL database into analytics"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncingDb ? 'animate-spin text-[#008C95]' : ''}`} />
            <span>{syncingDb ? 'Syncing...' : 'Sync Data from Database'}</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* 1. Overall Academic Snapshot (Top KPI Cards) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#008C95]" />
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Overall Academic Snapshot
            </h2>
          </div>
          <span className="text-xs text-slate-500">
            Operational Grain: Enrollments · Batches · Centers
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-8 gap-3">
          {/* Total Centers */}
          <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-semibold text-slate-500 uppercase">Centers</span>
              <Building2 className="w-3.5 h-3.5 text-[#008C95]" />
            </div>
            <div className="text-lg font-bold font-mono text-slate-900 tabular-nums">
              {kpis.total_centers}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Active Centers</div>
          </div>

          {/* Total Batches */}
          <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-semibold text-slate-500 uppercase">Batches</span>
              <Layers className="w-3.5 h-3.5 text-[#008C95]" />
            </div>
            <div className="text-lg font-bold font-mono text-slate-900 tabular-nums">
              {kpis.total_batches}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Total Batches</div>
          </div>

          {/* Total Students */}
          <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-semibold text-slate-500 uppercase">Students</span>
              <Users className="w-3.5 h-3.5 text-[#008C95]" />
            </div>
            <div className="text-lg font-bold font-mono text-slate-900 tabular-nums">
              {kpis.total_students.toLocaleString()}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Enrolled Students (Excluding Dropouts)</div>
          </div>

          {/* Total Trained */}
          <div className="bg-white p-3 rounded-xl border border-blue-200/90 bg-blue-50/20 shadow-xs">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-semibold text-blue-800 uppercase">Trained</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
            </div>
            <div className="text-lg font-bold font-mono text-blue-600 tabular-nums">
              {(kpis.total_trained ?? 0).toLocaleString()}
            </div>
            <div className="text-[10px] text-blue-600/80 mt-0.5">Trained Students</div>
          </div>

          {/* Active Batches */}
          <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-semibold text-slate-500 uppercase">Running</span>
              <PlayCircle className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <div className="text-lg font-bold font-mono text-emerald-700 tabular-nums">
              {kpis.active_batches}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Active Batches</div>
          </div>

          {/* Completed Batches */}
          <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-semibold text-slate-500 uppercase">Complete</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-[#008C95]" />
            </div>
            <div className="text-lg font-bold font-mono text-slate-900 tabular-nums">
              {kpis.completed_batches}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Completed</div>
          </div>

          {/* Total Dropouts */}
          <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-semibold text-slate-500 uppercase">Dropouts</span>
              <UserX className="w-3.5 h-3.5 text-rose-500" />
            </div>
            <div className="text-lg font-bold font-mono text-rose-600 tabular-nums">
              {kpis.total_dropouts.toLocaleString()}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Total Dropouts</div>
          </div>

          {/* Dropout % */}
          <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-semibold text-slate-500 uppercase">Dropout %</span>
              <TrendingUp className="w-3.5 h-3.5 text-rose-500" />
            </div>
            <div className="text-lg font-bold font-mono text-rose-600 tabular-nums">
              {kpis.dropout_rate}%
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Overall Rate</div>
          </div>
        </div>
      </div>

      {/* 3. Academic Health & Batch Status (Two Column Layout) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Academic Health Overview */}
        <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-[#008C95]" />
              <h3 className="text-sm font-bold text-slate-900">Academic Health & Metrics</h3>
            </div>
            <button
              onClick={() => onNavigateToView('academic-progress')}
              className="text-xs font-semibold text-[#008C95] hover:underline flex items-center gap-0.5 cursor-pointer"
            >
              <span>View Progress Analytics</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60">
              <span className="text-[11px] font-semibold text-slate-500">Running Attendance</span>
              <div className="text-xl font-bold font-mono text-[#008C95] mt-1 tabular-nums">
                {academic_health.avg_running_attendance}%
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Avg running class</div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60">
              <span className="text-[11px] font-semibold text-slate-500">Beneficiary Attendance</span>
              <div className="text-xl font-bold font-mono text-[#008C95] mt-1 tabular-nums">
                {academic_health.avg_beneficiary_attendance}%
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Avg beneficiary class</div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60">
              <span className="text-[11px] font-semibold text-slate-500">ILT Completion</span>
              <div className="text-xl font-bold font-mono text-[#008C95] mt-1 tabular-nums">
                {academic_health.avg_ilt_completion}%
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Instructor-led training</div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60">
              <span className="text-[11px] font-semibold text-slate-500">FM Completion</span>
              <div className="text-xl font-bold font-mono text-[#008C95] mt-1 tabular-nums">
                {academic_health.avg_fm_completion}%
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Foundation module</div>
            </div>
          </div>

          {/* Validation Rates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/60 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-700">Batch Validation Rate</span>
                <p className="text-[11px] text-slate-400">Validated / Total Batches</p>
              </div>
              <div className="text-xl font-bold font-mono text-slate-900 tabular-nums">
                {kpis.batch_validation_rate}%
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/60 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-700">Student Validation Rate</span>
                <p className="text-[11px] text-slate-400">
                  {kpis.students_with_validation_status} records available
                </p>
              </div>
              <div className="text-xl font-bold font-mono text-slate-900 tabular-nums">
                {kpis.student_validation_rate}%
              </div>
            </div>
          </div>
        </div>

        {/* Batch Status Distribution */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#008C95]" />
              <h3 className="text-sm font-bold text-slate-900">Batch Status Breakdown</h3>
            </div>
            <button
              onClick={() => onNavigateToView('batch-closure')}
              className="text-xs font-semibold text-[#008C95] hover:underline cursor-pointer"
            >
              Closure Dashboard
            </button>
          </div>

          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={batch_status_distribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {batch_status_distribution.map((entry: any, idx: number) => (
                    <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val: any) => [`${val} Batches`, 'Count']}
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '11px' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 4. Dropout Overview & Center Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Dropout by Center Ranking */}
        <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#008C95]" />
              <h3 className="text-sm font-bold text-slate-900">Center-wise Dropout Distribution</h3>
            </div>
            <button
              onClick={() => onNavigateToView('dropouts')}
              className="text-xs font-semibold text-[#008C95] hover:underline flex items-center gap-0.5 cursor-pointer"
            >
              <span>Full Dropout Analytics</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={center_dropout_ranking}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="center_code" tick={{ fontSize: 11, fill: '#64748B' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                <Tooltip
                  formatter={(val: any, name: any) => [val, name === 'dropouts' ? 'Dropouts' : 'Total Students']}
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '11px' }}
                />
                <Bar dataKey="students" name="Total Students" fill="#E2E8F0" radius={[4, 4, 0, 0]} />
                <Bar dataKey="dropouts" name="Dropouts" fill="#EF4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100 text-xs">
            {center_dropout_ranking.slice(0, 4).map((c: any) => (
              <button
                key={c.center_code}
                onClick={() => onSelectCenterDrilldown(c.center_code)}
                className="p-2 bg-slate-50 hover:bg-[#E6F4F5] rounded-lg text-left transition-colors cursor-pointer border border-slate-200/50"
              >
                <div className="font-bold text-slate-800">{c.center_code}</div>
                <div className="text-[11px] text-rose-600 font-semibold mt-0.5">
                  {c.dropouts} dropouts ({c.dropout_rate.toFixed(1)}%)
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Dropout Types Donut */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <UserX className="w-4 h-4 text-[#008C95]" />
              <h3 className="text-sm font-bold text-slate-900">Dropout Type Breakdown</h3>
            </div>
          </div>

          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={dropout_type_distribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {dropout_type_distribution.map((entry: any, idx: number) => (
                    <Cell key={`cell-d-${idx}`} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val: any) => [`${val} Students`, 'Count']}
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '11px' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 5. Recent Data Upload Information */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-[#008C95]" />
            <h3 className="text-sm font-bold text-slate-900">Active Source Dataset</h3>
          </div>
          <button
            onClick={() => onNavigateToView('upload')}
            className="text-xs font-semibold text-[#008C95] hover:underline cursor-pointer"
          >
            Upload New Workbook
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div>
            <span className="text-slate-400 font-medium">Source File</span>
            <p className="font-semibold text-slate-900 mt-0.5">{latest_upload?.file_name || 'data (1).xlsx'}</p>
          </div>
          <div>
            <span className="text-slate-400 font-medium">Sheet Name</span>
            <p className="font-semibold text-slate-900 mt-0.5">{latest_upload?.sheet_name || 'Export'}</p>
          </div>
          <div>
            <span className="text-slate-400 font-medium">Imported Records</span>
            <p className="font-bold font-mono text-slate-900 mt-0.5">
              {latest_upload?.valid_row_count ? latest_upload.valid_row_count.toLocaleString() : kpis.total_students.toLocaleString()}
            </p>
          </div>
          <div>
            <span className="text-slate-400 font-medium">Uploaded By</span>
            <p className="font-medium text-slate-700 mt-0.5">{latest_upload?.uploaded_by || 'arnab.roy@anudip.org'}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
