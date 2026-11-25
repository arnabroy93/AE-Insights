import React, { useState, useMemo, useEffect } from 'react';
import { consolidateUpvanDharClient } from '../utils/diyaConsolidation';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  TrendingUp,
  Users,
  Layers,
  Search,
  Download,
  RotateCcw,
  Building2,
  BookOpen,
  Maximize2,
  X,
  CheckSquare,
  Percent
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  LabelList
} from 'recharts';
import {
  ClosedBatchAnalyticsData,
  FilterParams,
  FilterOptions
} from '../types';
import { ProgramMultiSelect } from '../components/ProgramMultiSelect';
import { RmMultiSelect } from '../components/RmMultiSelect';
import { CenterMultiSelect } from '../components/CenterMultiSelect';
import { getScopedFilterOptions } from '../utils/filterHierarchy';
import { api } from '../api';

interface ClosedBatchAnalyticsProps {
  data: ClosedBatchAnalyticsData | null;
  loading: boolean;
  filters?: FilterParams;
  filterOptions?: FilterOptions;
  onFilterChange?: (filters: FilterParams) => void;
  onSelectCenterDrilldown?: (centerCode: string) => void;
}

export const ClosedBatchAnalytics: React.FC<ClosedBatchAnalyticsProps> = ({
  data,
  loading,
  filters = {},
  filterOptions,
  onFilterChange,
  onSelectCenterDrilldown,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [batchTabFilter, setBatchTabFilter] = useState<'all' | 'gte_75' | 'gte_50' | 'lt_50'>('all');
  const [centerSortMode, setCenterSortMode] = useState<'highest' | 'lowest' | 'volume'>('highest');
  const [centerLimit, setCenterLimit] = useState<number | 'all'>(15);

  const [activeChartTab, setActiveChartTab] = useState<'all' | 'rm' | 'center' | 'program'>('all');
  const [breakdownMetric, setBreakdownMetric] = useState<'rate' | 'volume'>('rate');
  const [rmMetric, setRmMetric] = useState<'rate' | 'volume' | 'lt_50' | 'lt_50_count'>('rate');
  const [centerMetric, setCenterMetric] = useState<'rate' | 'volume'>('rate');
  const [programMetric, setProgramMetric] = useState<'rate' | 'volume'>('rate');
  const [fullscreenChart, setFullscreenChart] = useState<'rm' | 'center' | 'program' | null>(null);
  const [exportingChart, setExportingChart] = useState<string | null>(null);

  const handleGlobalMetricChange = (metric: 'rate' | 'volume') => {
    setBreakdownMetric(metric);
    setRmMetric(metric);
    setCenterMetric(metric);
    setProgramMetric(metric);
  };

  const handleExportChartExcel = async (
    chartType: 'rm' | 'center' | 'program' | 'all',
    chartTitle: string,
    chartSummary: any[]
  ) => {
    try {
      setExportingChart(chartType);
      await api.exportChartRawExcel({
        module: 'closed_batch',
        chartType,
        chartTitle,
        filters: { ...(filters || {}), batchStatus: 'complete' },
        chartSummary,
      });
    } catch (err) {
      console.error('Failed to export Closed Batch Progress chart raw data:', err);
    } finally {
      setExportingChart(null);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreenChart(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const renderRotatedTick = (props: any) => {
    const { x, y, payload } = props;
    const text = String(payload?.value ?? '');
    const formatted = text.length > 18 ? `${text.substring(0, 16)}...` : text;
    return (
      <g transform={`translate(${x},${y})`}>
        <text
          x={0}
          y={0}
          dy={12}
          textAnchor="end"
          transform="rotate(-35)"
          fill="#1E293B"
          fontSize={10}
          fontWeight={600}
        >
          <title>{text}</title>
          {formatted}
        </text>
      </g>
    );
  };

  const currentProgramType = filters?.programType || 'Diya and Deeptech';

  const scopedOptions = useMemo(
    () => getScopedFilterOptions(filterOptions, filters),
    [filterOptions, filters]
  );

  const handleProgramTypeSelect = (type: string) => {
    if (onFilterChange) {
      onFilterChange({
        ...filters,
        programType: type,
      });
    }
  };

  const handleRmsChange = (selected: string[]) => {
    if (onFilterChange) {
      onFilterChange({
        ...filters,
        rmShZhs: selected.length > 0 ? selected : undefined,
        rmShZh: selected.length === 1 ? selected[0] : (selected.length > 1 ? selected.join(',') : undefined),
      });
    }
  };

  const handleCentersChange = (selected: string[]) => {
    if (onFilterChange) {
      onFilterChange({
        ...filters,
        centerCodes: selected.length > 0 ? selected : undefined,
        centerCode: selected.length === 1 ? selected[0] : (selected.length > 1 ? selected.join(',') : undefined),
      });
    }
  };

  const handleProgramsChange = (selected: string[]) => {
    if (onFilterChange) {
      onFilterChange({
        ...filters,
        programNames: selected.length > 0 ? selected : undefined,
        programName: selected.length === 1 ? selected[0] : (selected.length > 1 ? selected.join(',') : undefined),
      });
    }
  };

  const handleResetFilters = () => {
    if (onFilterChange) {
      onFilterChange({
        ...filters,
        centerCode: undefined,
        centerCodes: undefined,
        programName: undefined,
        programNames: undefined,
        assignedAe: undefined,
        assignedAes: undefined,
        rmShZh: undefined,
        rmShZhs: undefined,
        startDate: undefined,
        endDate: undefined,
        programType: 'Diya and Deeptech',
      });
    }
  };

  const currentProgramNames = scopedOptions.selectedPrograms;
  const currentCenterCodes = scopedOptions.selectedCenters;
  const currentRmShZhs = scopedOptions.selectedRms;
  const hasActiveCustomFilters =
    currentCenterCodes.length > 0 ||
    currentProgramNames.length > 0 ||
    currentRmShZhs.length > 0 ||
    Boolean(filters?.startDate) ||
    Boolean(filters?.endDate) ||
    currentProgramType !== 'Diya and Deeptech';

  const kpis = data?.kpis || {
    avg_beneficiary_attendance: 0,
    enrolled_avg_beneficiary_attendance: 0,
    avg_running_attendance: 0,
    avg_ilt_completion: 0,
    avg_fm_completion: 0,
    completed_batches: 0,
    total_students: 0,
    enrolled_students: 0,
    dropout_students: 0,
    active_centers: 0,
    active_programs: 0,
    students_gte_75: 0,
    students_gte_75_pct: 0,
    students_lt_75: 0,
    students_lt_75_pct: 0,
    students_gte_50: 0,
    students_gte_50_pct: 0,
    students_lt_50: 0,
    students_lt_50_pct: 0,
  };

  const sorted_by_rm = useMemo(() => {
    const rawArr = data?.by_rm || [];
    const arr = consolidateUpvanDharClient(rawArr, currentProgramType);
    const filtered =
      rmMetric === 'lt_50' || rmMetric === 'lt_50_count'
        ? arr.filter((r: any) => (r.avg_beneficiary_attendance || 0) < 50)
        : arr;
    return [...filtered].sort((a: any, b: any) => {
      if (rmMetric === 'volume' || rmMetric === 'lt_50_count') {
        return (b.count || b.total_students || 0) - (a.count || a.total_students || 0);
      }
      return (b.avg_beneficiary_attendance || 0) - (a.avg_beneficiary_attendance || 0);
    });
  }, [data?.by_rm, rmMetric, currentProgramType]);

  const sorted_by_center = useMemo(() => {
    const arr = data?.by_center || [];
    const mapped = [...arr].map((c: any) => ({
      ...c,
      name: c.name || c.center_code || 'Unknown',
    }));
    if (centerMetric === 'volume' || centerSortMode === 'volume') {
      mapped.sort((a: any, b: any) => (b.count || b.total_students || 0) - (a.count || a.total_students || 0));
    } else if (centerSortMode === 'lowest') {
      mapped.sort((a: any, b: any) => (a.avg_beneficiary_attendance || 0) - (b.avg_beneficiary_attendance || 0));
    } else {
      mapped.sort((a: any, b: any) => (b.avg_beneficiary_attendance || 0) - (a.avg_beneficiary_attendance || 0));
    }
    if (centerLimit === 'all') return mapped;
    return mapped.slice(0, centerLimit);
  }, [data?.by_center, centerMetric, centerSortMode, centerLimit]);

  const sorted_by_program = useMemo(() => {
    const arr = data?.by_program || [];
    return [...arr]
      .map((p: any) => ({
        ...p,
        name: p.name || p.program_name || 'Unknown',
      }))
      .sort((a: any, b: any) => {
        if (programMetric === 'volume') {
          return (b.count || b.total_students || 0) - (a.count || a.total_students || 0);
        }
        return (b.avg_beneficiary_attendance || 0) - (a.avg_beneficiary_attendance || 0);
      });
  }, [data?.by_program, programMetric]);

  const filteredBatches = useMemo(() => {
    if (!data?.batches) return [];
    return data.batches.filter((b) => {
      if (batchTabFilter === 'gte_75' && b.avg_beneficiary_attendance < 75) return false;
      if (batchTabFilter === 'gte_50' && b.avg_beneficiary_attendance < 50) return false;
      if (batchTabFilter === 'lt_50' && b.avg_beneficiary_attendance >= 50) return false;

      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        (b.batch_code || '').toLowerCase().includes(term) ||
        (b.center_code || '').toLowerCase().includes(term) ||
        (b.program_name || '').toLowerCase().includes(term) ||
        (b.rm_sh_zh || '').toLowerCase().includes(term) ||
        (b.assigned_trainers || '').toLowerCase().includes(term) ||
        (b.funder_name || '').toLowerCase().includes(term)
      );
    });
  }, [data?.batches, batchTabFilter, searchTerm]);

  const handleExportCsv = () => {
    if (!filteredBatches || filteredBatches.length === 0) return;
    const headers = [
      'Batch Code',
      'Center Code',
      'Program Name',
      'Funder Name',
      'RM / SH / ZH',
      'Assigned Trainers',
      'Batch Status',
      'Batch Start Date',
      'Planned End Date',
      'Actual End Date',
      'Student Count',
      'Enrolled Students',
      'Average of Beneficiary_Class_Attendance %',
      'Average Running Attendance %',
      'Average ILT Completion %',
      'Students >= 75% Beneficiary Attendance',
      'Students >= 50% Beneficiary Attendance',
      'Students < 50% Beneficiary Attendance'
    ];

    const rows = filteredBatches.map((b) => [
      `"${b.batch_code}"`,
      `"${b.center_code || ''}"`,
      `"${b.program_name || ''}"`,
      `"${b.funder_name || ''}"`,
      `"${b.rm_sh_zh || ''}"`,
      `"${(b.assigned_trainers || '').replace(/"/g, '""')}"`,
      `"${b.batch_status || 'complete'}"`,
      `"${b.batch_start_date || ''}"`,
      `"${b.batch_end_date || ''}"`,
      `"${b.batch_actual_end_date || ''}"`,
      b.total_students,
      b.enrolled_students,
      `${b.avg_beneficiary_attendance}%`,
      `${b.avg_running_attendance}%`,
      `${b.avg_ilt_completion}%`,
      b.students_gte_75,
      b.students_gte_50 ?? 0,
      b.students_lt_50 ?? 0,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Closed_Batch_Progress_Report_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const renderCustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    const item = payload[0]?.payload;
    if (!item) return null;
    return (
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-lg text-xs space-y-1.5 min-w-[230px]">
        <div className="font-bold text-slate-900 border-b border-slate-100 pb-1">{label}</div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-500">Avg Beneficiary_Class_Attendance %:</span>
          <span className="font-mono font-bold text-[#008C95]">{item.avg_beneficiary_attendance}%</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-500">Student Count:</span>
          <span className="font-mono font-bold text-indigo-700">{Number(item.count || item.total_students || 0).toLocaleString()}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-500">Closed Batches Count:</span>
          <span className="font-mono font-bold text-emerald-700">{Number(item.completed_batches || 0).toLocaleString()}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-500">Avg ILT Completion %:</span>
          <span className="font-mono font-semibold text-slate-700">{item.avg_ilt_completion ?? 0}%</span>
        </div>
      </div>
    );
  };

  if (loading && !data) {
    return (
      <div className="p-12 text-center text-xs text-slate-500">
        <div className="animate-spin w-8 h-8 border-3 border-[#008C95] border-t-transparent rounded-full mx-auto mb-3" />
        Computing Closed Batch Progress Analytics (Batch Status = &quot;complete&quot;)...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner & Module Header */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs relative z-30">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200/60 flex items-center justify-center text-[#008C95] shrink-0">
                <CheckSquare className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2 flex-wrap">
                  <span>Closed Batch Progress</span>
                  <span className="text-[10px] uppercase font-bold text-[#008C95]">
                    Core Dashboard &middot; Batch Status = &quot;complete&quot;
                  </span>
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Average of Beneficiary_Class_Attendance % and student &amp; batch counts across RM, Center, and Program for closed batches
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleExportCsv}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer shadow-2xs"
              title="Download Closed Batch CSV Ledger"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Export CSV</span>
            </button>
            {hasActiveCustomFilters && (
              <button
                onClick={handleResetFilters}
                className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Filters</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center gap-3 text-xs">
          {/* Program Type Segmented Selector */}
          <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200/60">
            {['Diya and Deeptech', 'Diya Only', 'Deeptech Only'].map((pt) => {
              const active = currentProgramType === pt;
              return (
                <button
                  key={pt}
                  onClick={() => handleProgramTypeSelect(pt)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    active
                      ? 'bg-white text-[#008C95] shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {pt}
                </button>
              );
            })}
          </div>

          {/* Date Range Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200 shadow-2xs">
            <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span className="text-[11px] font-semibold text-slate-600 whitespace-nowrap">From:</span>
            <input
              type="date"
              value={filters?.startDate || ''}
              onChange={(e) => onFilterChange?.({ ...filters, startDate: e.target.value || undefined })}
              className="bg-white border border-slate-300 rounded-md px-2 py-1 text-xs text-slate-800 font-medium focus:outline-hidden focus:ring-1 focus:ring-[#008C95] cursor-pointer"
            />
            <span className="text-[11px] font-semibold text-slate-600 whitespace-nowrap">To:</span>
            <input
              type="date"
              value={filters?.endDate || ''}
              onChange={(e) => onFilterChange?.({ ...filters, endDate: e.target.value || undefined })}
              className="bg-white border border-slate-300 rounded-md px-2 py-1 text-xs text-slate-800 font-medium focus:outline-hidden focus:ring-1 focus:ring-[#008C95] cursor-pointer"
            />
            {(filters?.startDate || filters?.endDate) && (
              <button
                onClick={() => onFilterChange?.({ ...filters, startDate: undefined, endDate: undefined })}
                className="ml-0.5 p-0.5 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                title="Clear Date Filter"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Regional Manager & Program Multi-Select Filter */}
          <RmMultiSelect
            options={scopedOptions.rmOptions}
            selectedRms={filters?.rmShZhs}
            selectedRm={filters?.rmShZh}
            onChange={handleRmsChange}
            programOptions={scopedOptions.programOptions}
            selectedPrograms={filters?.programNames}
            selectedProgram={filters?.programName}
            onProgramsChange={handleProgramsChange}
          />

          {/* Center & Program Multi-Select Filter */}
          <CenterMultiSelect
            options={scopedOptions.centerOptions}
            selectedCenters={filters?.centerCodes}
            selectedCenter={filters?.centerCode}
            onChange={handleCentersChange}
            programOptions={scopedOptions.programOptions}
            selectedPrograms={filters?.programNames}
            selectedProgram={filters?.programName}
            onProgramsChange={handleProgramsChange}
          />

          {/* Program Multi-Select Filter */}
          <ProgramMultiSelect
            options={scopedOptions.programOptions}
            selectedPrograms={filters?.programNames}
            selectedProgram={filters?.programName}
            onChange={handleProgramsChange}
          />
        </div>
      </div>

      {/* Primary KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* KPI 1: Average of Beneficiary_Class_Attendance % */}
        <div className="bg-gradient-to-br from-teal-50/70 to-cyan-50/30 bg-white p-4 rounded-2xl border border-teal-200 shadow-xs">
          <div className="flex items-center justify-between text-[#008C95] mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">
              Avg Beneficiary_Class_Attendance %
            </span>
            <div className="w-7 h-7 rounded-lg bg-teal-100/80 text-[#008C95] flex items-center justify-center">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-slate-900 tabular-nums">
            {kpis.avg_beneficiary_attendance}%
          </div>
          <div className="text-[11px] text-teal-800 mt-2 font-medium">
            Enrolled Cohort Avg: <span className="font-mono font-bold">{kpis.enrolled_avg_beneficiary_attendance}%</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            Batch Status = &quot;complete&quot;
          </div>
        </div>

        {/* KPI 2: Closed Batches Count */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">
              Closed Batches
            </span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <CheckSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-slate-900 tabular-nums">
            {kpis.completed_batches.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-600 mt-2">
            Across <span className="font-mono font-bold">{kpis.active_centers}</span> Centers &middot; <span className="font-mono font-bold">{kpis.active_programs}</span> Programs
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            Distinct Completed Batches
          </div>
        </div>

        {/* KPI 3: Closed Batch Students Count */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">
              Closed Batch Students
            </span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-slate-900 tabular-nums">
            {kpis.total_students.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-600 mt-2">
            Enrolled: <span className="font-mono font-bold text-emerald-700">{kpis.enrolled_students.toLocaleString()}</span> &middot; Avg ILT: <span className="font-mono font-bold">{kpis.avg_ilt_completion}%</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            Total Records in Closed Batches
          </div>
        </div>

        {/* KPI 4: Students >= 75% Beneficiary Attendance */}
        <div className="bg-gradient-to-br from-emerald-50/50 to-teal-50/20 bg-white p-4 rounded-2xl border border-emerald-200 shadow-xs">
          <div className="flex items-center justify-between text-emerald-700 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">
              Beneficiary Attendance &ge; 75%
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-100/80 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-emerald-900 tabular-nums">
            {kpis.students_gte_75.toLocaleString()}
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs">
            <span className="font-mono font-bold text-emerald-800">{kpis.students_gte_75_pct}%</span>
            <span className="text-slate-500">of closed cohort</span>
          </div>
          <div className="text-[10px] text-emerald-800/80 mt-1 font-medium">
            Meeting 75% attendance benchmark
          </div>
        </div>

        {/* KPI 5: Students >= 50% Beneficiary Attendance */}
        <div className="bg-gradient-to-br from-cyan-50/50 to-sky-50/20 bg-white p-4 rounded-2xl border border-cyan-200 shadow-xs">
          <div className="flex items-center justify-between text-cyan-700 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">
              Beneficiary Attendance &ge; 50%
            </span>
            <div className="w-7 h-7 rounded-lg bg-cyan-100/80 text-cyan-700 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-cyan-900 tabular-nums">
            {(kpis.students_gte_50 ?? 0).toLocaleString()}
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs">
            <span className="font-mono font-bold text-cyan-800">{kpis.students_gte_50_pct ?? 0}%</span>
            <span className="text-slate-500">of closed cohort</span>
          </div>
          <div className="text-[10px] text-cyan-800/80 mt-1 font-medium">
            Meeting 50% attendance benchmark
          </div>
        </div>

        {/* KPI 6: Students < 50% Beneficiary Attendance */}
        <div className="bg-gradient-to-br from-rose-50/50 to-amber-50/20 bg-white p-4 rounded-2xl border border-rose-200 shadow-xs">
          <div className="flex items-center justify-between text-rose-700 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">
              Beneficiary Attendance &lt; 50%
            </span>
            <div className="w-7 h-7 rounded-lg bg-rose-100/80 text-rose-700 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-rose-900 tabular-nums">
            {(kpis.students_lt_50 ?? 0).toLocaleString()}
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs">
            <span className="font-mono font-bold text-rose-800">{kpis.students_lt_50_pct ?? 0}%</span>
            <span className="text-slate-500">of closed cohort</span>
          </div>
          <div className="text-[10px] text-rose-800/80 mt-1 font-medium">
            Below 50% beneficiary attendance
          </div>
        </div>
      </div>

      {/* Chart Category Switcher Tabs & Global View Metric Switcher */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100/90 rounded-xl border border-slate-200/80 max-w-fit overflow-x-auto">
          {[
            { id: 'all', label: 'All Charts', icon: Layers },
            { id: 'rm', label: 'RM Wise', icon: Users, color: 'text-indigo-600' },
            { id: 'center', label: 'Center Wise', icon: Building2, color: 'text-cyan-600' },
            { id: 'program', label: 'Program Wise', icon: BookOpen, color: 'text-emerald-600' },
          ].map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeChartTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveChartTab(tab.id as any)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                  isSelected
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80 font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${tab.color || ''}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Global View Metric Switcher: % vs Count */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200 text-xs font-medium">
          <span className="text-[11px] text-slate-500 px-1.5 font-semibold">View Metric:</span>
          <button
            onClick={() => handleGlobalMetricChange('rate')}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer transition-all ${
              breakdownMetric === 'rate'
                ? 'bg-white text-slate-900 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            % (Avg Beneficiary_Class_Attendance %)
          </button>
          <button
            onClick={() => handleGlobalMetricChange('volume')}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer transition-all ${
              breakdownMetric === 'volume'
                ? 'bg-white text-slate-900 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Count
          </button>
        </div>
      </div>

      {/* 3 CORE BAR CHARTS: RM WISE, CENTER WISE & PROGRAM WISE (Batch Status = "complete") */}
      <div className="space-y-6">
        {/* --- 1. RM WISE CHART --- */}
        {(activeChartTab === 'all' || activeChartTab === 'rm') && (
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-indigo-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    RM Wise Closed Batch Progress Breakdown
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Regional Manager Average of Beneficiary_Class_Attendance % and Count for Batch Status = &quot;complete&quot;
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs font-medium flex-wrap">
                <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg border border-slate-200 text-xs font-medium">
                  <span className="text-[10px] text-slate-500 px-1.5 font-semibold">View Metric:</span>
                  <button
                    onClick={() => setRmMetric('rate')}
                    className={`px-2.5 py-0.5 rounded-md text-[11px] font-semibold cursor-pointer transition-all ${
                      rmMetric === 'rate'
                        ? 'bg-white text-slate-900 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    %
                  </button>
                  <button
                    onClick={() => setRmMetric('volume')}
                    className={`px-2.5 py-0.5 rounded-md text-[11px] font-semibold cursor-pointer transition-all ${
                      rmMetric === 'volume'
                        ? 'bg-white text-slate-900 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Count
                  </button>
                  <button
                    onClick={() => setRmMetric('lt_50')}
                    className={`px-2.5 py-0.5 rounded-md text-[11px] font-semibold cursor-pointer transition-all ${
                      rmMetric === 'lt_50'
                        ? 'bg-white text-rose-700 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    &lt;50%
                  </button>
                  <button
                    onClick={() => setRmMetric('lt_50_count')}
                    className={`px-2.5 py-0.5 rounded-md text-[11px] font-semibold cursor-pointer transition-all ${
                      rmMetric === 'lt_50_count'
                        ? 'bg-white text-rose-700 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    &lt;50% Count
                  </button>
                </div>
                <button
                  onClick={() => handleExportChartExcel('rm', 'Closed_Batch_Progress_RM_Wise', sorted_by_rm)}
                  disabled={exportingChart === 'rm'}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-600 hover:text-white transition-all cursor-pointer border border-emerald-200 disabled:opacity-60"
                  title="Export chart summary and underlying closed batch records to Excel"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{exportingChart === 'rm' ? 'Exporting...' : 'Export Raw Data (Excel)'}</span>
                </button>
                <button
                  onClick={() => setFullscreenChart('rm')}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-[#008C95] hover:text-white transition-all cursor-pointer border border-slate-200"
                  title="Open RM Chart in Presentation Mode"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>Presentation Mode</span>
                </button>
              </div>
            </div>

            <div className="h-[420px]">
              {(rmMetric === 'lt_50' || rmMetric === 'lt_50_count') && sorted_by_rm.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-slate-400 font-medium">
                  No Regional Managers have Beneficiary Attendance % less than 50% for the current filters.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  {rmMetric === 'rate' || rmMetric === 'lt_50' ? (
                    <BarChart data={sorted_by_rm} margin={{ top: 32, right: 24, left: 6, bottom: 65 }} barGap={6} barCategoryGap="25%">
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis dataKey="name" interval={0} height={65} tick={renderRotatedTick} />
                      <YAxis unit="%" domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748B' }} />
                      <Tooltip content={renderCustomTooltip} />
                      <Legend iconSize={12} wrapperStyle={{ fontSize: '14px', fontWeight: 700, paddingTop: '12px' }} />
                      <Bar
                        dataKey="avg_beneficiary_attendance"
                        name={rmMetric === 'lt_50' ? 'Average of Beneficiary Attendance % (< 50%)' : 'Average of Beneficiary_Class_Attendance %'}
                        fill={rmMetric === 'lt_50' ? '#E11D48' : '#4F46E5'}
                        barSize={24}
                        radius={[4, 4, 0, 0]}
                      >
                        <LabelList
                          dataKey="avg_beneficiary_attendance"
                          position="top"
                          formatter={(v: any) => (v != null ? `${Number(v).toFixed(1)}%` : '')}
                          fill={rmMetric === 'lt_50' ? '#9F1239' : '#3730A3'}
                          fontSize={9.5}
                          fontWeight={700}
                          offset={6}
                        />
                      </Bar>
                    </BarChart>
                  ) : rmMetric === 'lt_50_count' ? (
                    <BarChart data={sorted_by_rm} margin={{ top: 32, right: 24, left: 6, bottom: 65 }} barGap={6} barCategoryGap="25%">
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis dataKey="name" interval={0} height={65} tick={renderRotatedTick} />
                      <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                      <Tooltip content={renderCustomTooltip} />
                      <Legend iconSize={12} wrapperStyle={{ fontSize: '14px', fontWeight: 700, paddingTop: '12px' }} />
                      <Bar
                        dataKey="count"
                        name="Average <50% Count"
                        fill="#E11D48"
                        barSize={24}
                        radius={[4, 4, 0, 0]}
                      >
                        <LabelList
                          dataKey="count"
                          position="top"
                          formatter={(v: any) => (v != null ? Number(v).toLocaleString() : '')}
                          fill="#9F1239"
                          fontSize={9.5}
                          fontWeight={700}
                          offset={6}
                        />
                      </Bar>
                    </BarChart>
                  ) : (
                    <BarChart data={sorted_by_rm} margin={{ top: 32, right: 24, left: 6, bottom: 65 }} barGap={6} barCategoryGap="25%">
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis dataKey="name" interval={0} height={65} tick={renderRotatedTick} />
                      <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                      <Tooltip content={renderCustomTooltip} />
                      <Legend iconSize={12} wrapperStyle={{ fontSize: '14px', fontWeight: 700, paddingTop: '12px' }} />
                      <Bar dataKey="count" name="Closed Batch Students (Count)" fill="#4F46E5" barSize={20} radius={[4, 4, 0, 0]}>
                        <LabelList dataKey="count" position="top" formatter={(v: any) => (v ? Number(v).toLocaleString() : '')} fill="#3730A3" fontSize={9.5} fontWeight={700} offset={6} />
                      </Bar>
                      <Bar dataKey="completed_batches" name="Closed Batches (Count)" fill="#10B981" barSize={20} radius={[4, 4, 0, 0]}>
                        <LabelList dataKey="completed_batches" position="top" formatter={(v: any) => (v ? Number(v).toLocaleString() : '')} fill="#047857" fontSize={9.5} fontWeight={700} offset={6} />
                      </Bar>
                    </BarChart>
                  )}
                </ResponsiveContainer>
              )}
            </div>
          </div>
        )}

        {/* --- 2. CENTER WISE CHART --- */}
        {(activeChartTab === 'all' || activeChartTab === 'center') && (
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-cyan-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Center Wise Closed Batch Progress Breakdown
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Center comparison of Average of Beneficiary_Class_Attendance % and Count for Batch Status = &quot;complete&quot;
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs font-medium flex-wrap">
                {/* Sort & Limit Controls */}
                <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                  <button
                    onClick={() => setCenterSortMode('highest')}
                    className={`px-2 py-0.5 rounded-md text-[11px] font-semibold cursor-pointer ${
                      centerSortMode === 'highest' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600'
                    }`}
                  >
                    Highest %
                  </button>
                  <button
                    onClick={() => setCenterSortMode('lowest')}
                    className={`px-2 py-0.5 rounded-md text-[11px] font-semibold cursor-pointer ${
                      centerSortMode === 'lowest' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600'
                    }`}
                  >
                    Lowest %
                  </button>
                  <button
                    onClick={() => setCenterLimit(centerLimit === 15 ? 'all' : 15)}
                    className="px-2 py-0.5 rounded-md text-[11px] font-semibold text-[#008C95] hover:bg-white cursor-pointer"
                  >
                    {centerLimit === 'all' ? 'Show Top 15' : 'Show All Centers'}
                  </button>
                </div>

                <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg border border-slate-200 text-xs font-medium">
                  <span className="text-[10px] text-slate-500 px-1.5 font-semibold">View Metric:</span>
                  <button
                    onClick={() => setCenterMetric('rate')}
                    className={`px-2.5 py-0.5 rounded-md text-[11px] font-semibold cursor-pointer transition-all ${
                      centerMetric === 'rate'
                        ? 'bg-white text-slate-900 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    %
                  </button>
                  <button
                    onClick={() => setCenterMetric('volume')}
                    className={`px-2.5 py-0.5 rounded-md text-[11px] font-semibold cursor-pointer transition-all ${
                      centerMetric === 'volume'
                        ? 'bg-white text-slate-900 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Count
                  </button>
                </div>
                <button
                  onClick={() => handleExportChartExcel('center', 'Closed_Batch_Progress_Center_Wise', sorted_by_center)}
                  disabled={exportingChart === 'center'}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-600 hover:text-white transition-all cursor-pointer border border-emerald-200 disabled:opacity-60"
                  title="Export chart summary and underlying closed batch records to Excel"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{exportingChart === 'center' ? 'Exporting...' : 'Export Raw Data (Excel)'}</span>
                </button>
                <button
                  onClick={() => setFullscreenChart('center')}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-[#008C95] hover:text-white transition-all cursor-pointer border border-slate-200"
                  title="Open Center Chart in Presentation Mode"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>Presentation Mode</span>
                </button>
              </div>
            </div>

            <div className="h-[420px]">
              <ResponsiveContainer width="100%" height="100%">
                {centerMetric === 'rate' ? (
                  <BarChart data={sorted_by_center} margin={{ top: 32, right: 24, left: 6, bottom: 65 }} barGap={6} barCategoryGap="25%">
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="name" interval={0} height={65} tick={renderRotatedTick} />
                    <YAxis unit="%" domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748B' }} />
                    <Tooltip content={renderCustomTooltip} />
                    <Legend iconSize={12} wrapperStyle={{ fontSize: '14px', fontWeight: 700, paddingTop: '12px' }} />
                    <Bar dataKey="avg_beneficiary_attendance" name="Average of Beneficiary_Class_Attendance %" fill="#0891B2" barSize={24} radius={[4, 4, 0, 0]}>
                      <LabelList dataKey="avg_beneficiary_attendance" position="top" formatter={(v: any) => (v != null ? `${Number(v).toFixed(1)}%` : '')} fill="#0E7490" fontSize={9.5} fontWeight={700} offset={6} />
                    </Bar>
                  </BarChart>
                ) : (
                  <BarChart data={sorted_by_center} margin={{ top: 32, right: 24, left: 6, bottom: 65 }} barGap={6} barCategoryGap="25%">
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="name" interval={0} height={65} tick={renderRotatedTick} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                    <Tooltip content={renderCustomTooltip} />
                    <Legend iconSize={12} wrapperStyle={{ fontSize: '14px', fontWeight: 700, paddingTop: '12px' }} />
                    <Bar dataKey="count" name="Closed Batch Students (Count)" fill="#0891B2" barSize={20} radius={[4, 4, 0, 0]}>
                      <LabelList dataKey="count" position="top" formatter={(v: any) => (v ? Number(v).toLocaleString() : '')} fill="#0E7490" fontSize={9.5} fontWeight={700} offset={6} />
                    </Bar>
                    <Bar dataKey="completed_batches" name="Closed Batches (Count)" fill="#10B981" barSize={20} radius={[4, 4, 0, 0]}>
                      <LabelList dataKey="completed_batches" position="top" formatter={(v: any) => (v ? Number(v).toLocaleString() : '')} fill="#047857" fontSize={9.5} fontWeight={700} offset={6} />
                    </Bar>
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* --- 3. PROGRAM WISE CHART --- */}
        {(activeChartTab === 'all' || activeChartTab === 'program') && (
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Program Wise Closed Batch Progress Breakdown
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Program comparison of Average of Beneficiary_Class_Attendance % and Count for Batch Status = &quot;complete&quot;
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs font-medium flex-wrap">
                <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg border border-slate-200 text-xs font-medium">
                  <span className="text-[10px] text-slate-500 px-1.5 font-semibold">View Metric:</span>
                  <button
                    onClick={() => setProgramMetric('rate')}
                    className={`px-2.5 py-0.5 rounded-md text-[11px] font-semibold cursor-pointer transition-all ${
                      programMetric === 'rate'
                        ? 'bg-white text-slate-900 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    %
                  </button>
                  <button
                    onClick={() => setProgramMetric('volume')}
                    className={`px-2.5 py-0.5 rounded-md text-[11px] font-semibold cursor-pointer transition-all ${
                      programMetric === 'volume'
                        ? 'bg-white text-slate-900 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Count
                  </button>
                </div>
                <button
                  onClick={() => handleExportChartExcel('program', 'Closed_Batch_Progress_Program_Wise', sorted_by_program)}
                  disabled={exportingChart === 'program'}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-600 hover:text-white transition-all cursor-pointer border border-emerald-200 disabled:opacity-60"
                  title="Export chart summary and underlying closed batch records to Excel"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{exportingChart === 'program' ? 'Exporting...' : 'Export Raw Data (Excel)'}</span>
                </button>
                <button
                  onClick={() => setFullscreenChart('program')}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-[#008C95] hover:text-white transition-all cursor-pointer border border-slate-200"
                  title="Open Program Chart in Presentation Mode"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>Presentation Mode</span>
                </button>
              </div>
            </div>

            <div className="h-[420px]">
              <ResponsiveContainer width="100%" height="100%">
                {programMetric === 'rate' ? (
                  <BarChart data={sorted_by_program} margin={{ top: 32, right: 24, left: 6, bottom: 65 }} barGap={6} barCategoryGap="25%">
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="name" interval={0} height={65} tick={renderRotatedTick} />
                    <YAxis unit="%" domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748B' }} />
                    <Tooltip content={renderCustomTooltip} />
                    <Legend iconSize={12} wrapperStyle={{ fontSize: '14px', fontWeight: 700, paddingTop: '12px' }} />
                    <Bar dataKey="avg_beneficiary_attendance" name="Average of Beneficiary_Class_Attendance %" fill="#059669" barSize={24} radius={[4, 4, 0, 0]}>
                      <LabelList dataKey="avg_beneficiary_attendance" position="top" formatter={(v: any) => (v != null ? `${Number(v).toFixed(1)}%` : '')} fill="#047857" fontSize={9.5} fontWeight={700} offset={6} />
                    </Bar>
                  </BarChart>
                ) : (
                  <BarChart data={sorted_by_program} margin={{ top: 32, right: 24, left: 6, bottom: 65 }} barGap={6} barCategoryGap="25%">
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="name" interval={0} height={65} tick={renderRotatedTick} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                    <Tooltip content={renderCustomTooltip} />
                    <Legend iconSize={12} wrapperStyle={{ fontSize: '14px', fontWeight: 700, paddingTop: '12px' }} />
                    <Bar dataKey="count" name="Closed Batch Students (Count)" fill="#059669" barSize={20} radius={[4, 4, 0, 0]}>
                      <LabelList dataKey="count" position="top" formatter={(v: any) => (v ? Number(v).toLocaleString() : '')} fill="#047857" fontSize={9.5} fontWeight={700} offset={6} />
                    </Bar>
                    <Bar dataKey="completed_batches" name="Closed Batches (Count)" fill="#3B82F6" barSize={20} radius={[4, 4, 0, 0]}>
                      <LabelList dataKey="completed_batches" position="top" formatter={(v: any) => (v ? Number(v).toLocaleString() : '')} fill="#1D4ED8" fontSize={9.5} fontWeight={700} offset={6} />
                    </Bar>
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Closed Batches Ledger Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Closed Batches Attendance Ledger (Batch Status = &quot;complete&quot;)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Showing {filteredBatches.length.toLocaleString()} closed batches with Average of Beneficiary_Class_Attendance % and student counts
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs">
              {[
                { id: 'all', label: 'All Closed' },
                { id: 'gte_75', label: 'Beneficiary Attendance >= 75%' },
                { id: 'gte_50', label: 'Beneficiary Attendance >= 50%' },
                { id: 'lt_50', label: 'Beneficiary Attendance < 50%' },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setBatchTabFilter(t.id as any)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                    batchTabFilter === t.id
                      ? 'bg-white text-slate-900 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search batch, center, RM..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#008C95]/20 focus:border-[#008C95] w-56"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto max-h-[480px]">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider sticky top-0 z-10 border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Batch Code</th>
                <th className="py-3 px-3">Center</th>
                <th className="py-3 px-3">Program</th>
                <th className="py-3 px-3">RM / SH / ZH</th>
                <th className="py-3 px-3">Trainer</th>
                <th className="py-3 px-3 text-right">Students (Count)</th>
                <th className="py-3 px-3 text-right">Enrolled</th>
                <th className="py-3 px-3 text-right">Avg Beneficiary_Class_Attendance %</th>
                <th className="py-3 px-3 text-right">Avg Running Att %</th>
                <th className="py-3 px-4 text-right">Avg ILT Completion %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredBatches.slice(0, 150).map((b) => (
                <tr key={b.batch_code} className="hover:bg-slate-50/90 transition-colors">
                  <td className="py-2.5 px-4 font-mono font-bold text-slate-900">{b.batch_code}</td>
                  <td className="py-2.5 px-3">
                    <button
                      onClick={() => onSelectCenterDrilldown?.(b.center_code)}
                      className="font-semibold text-[#008C95] hover:underline cursor-pointer"
                    >
                      {b.center_code}
                    </button>
                  </td>
                  <td className="py-2.5 px-3 max-w-[180px] truncate" title={b.program_name}>
                    {b.program_name}
                  </td>
                  <td className="py-2.5 px-3 font-medium text-slate-800">{b.rm_sh_zh || '—'}</td>
                  <td className="py-2.5 px-3 max-w-[150px] truncate" title={b.assigned_trainers}>
                    {b.assigned_trainers || '—'}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                    {b.total_students.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                    {b.enrolled_students.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold">
                    <span className={b.avg_beneficiary_attendance >= 75 ? 'text-emerald-700' : 'text-rose-600'}>
                      {b.avg_beneficiary_attendance}%
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                    {b.avg_running_attendance}%
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono text-slate-700">
                    {b.avg_ilt_completion}%
                  </td>
                </tr>
              ))}
              {filteredBatches.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-400">
                    No closed batches match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Presentation Mode Chart Modal */}
      {fullscreenChart && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-7xl h-[88vh] flex flex-col overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span>
                    {fullscreenChart === 'rm' && 'RM Wise Closed Batch Progress Breakdown'}
                    {fullscreenChart === 'center' && 'Center Wise Closed Batch Progress Breakdown'}
                    {fullscreenChart === 'program' && 'Program Wise Closed Batch Progress Breakdown'}
                  </span>
                  <span className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded bg-[#008C95]/10 text-[#008C95] border border-[#008C95]/30 font-mono font-semibold">
                    Presentation Mode
                  </span>
                </h2>
                <p className="text-xs text-slate-500">
                  Batch Status = &quot;complete&quot; &bull; Average of Beneficiary_Class_Attendance % vs Count
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200 text-xs font-medium">
                  <span className="text-[11px] text-slate-500 px-1.5 font-semibold">View Metric:</span>
                  <button
                    onClick={() => {
                      if (fullscreenChart === 'rm') setRmMetric('rate');
                      if (fullscreenChart === 'center') setCenterMetric('rate');
                      if (fullscreenChart === 'program') setProgramMetric('rate');
                    }}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer ${
                      (fullscreenChart === 'rm' ? rmMetric : fullscreenChart === 'center' ? centerMetric : programMetric) === 'rate'
                        ? 'bg-white text-slate-900 shadow-2xs font-bold'
                        : 'text-slate-600'
                    }`}
                  >
                    % (Avg Beneficiary_Class_Attendance %)
                  </button>
                  <button
                    onClick={() => {
                      if (fullscreenChart === 'rm') setRmMetric('volume');
                      if (fullscreenChart === 'center') setCenterMetric('volume');
                      if (fullscreenChart === 'program') setProgramMetric('volume');
                    }}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer ${
                      (fullscreenChart === 'rm' ? rmMetric : fullscreenChart === 'center' ? centerMetric : programMetric) === 'volume'
                        ? 'bg-white text-slate-900 shadow-2xs font-bold'
                        : 'text-slate-600'
                    }`}
                  >
                    Count
                  </button>
                  {fullscreenChart === 'rm' && (
                    <>
                      <button
                        onClick={() => setRmMetric('lt_50')}
                        className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer ${
                          rmMetric === 'lt_50'
                            ? 'bg-white text-rose-700 shadow-2xs font-bold'
                            : 'text-slate-600'
                        }`}
                      >
                        &lt;50%
                      </button>
                      <button
                        onClick={() => setRmMetric('lt_50_count')}
                        className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer ${
                          rmMetric === 'lt_50_count'
                            ? 'bg-white text-rose-700 shadow-2xs font-bold'
                            : 'text-slate-600'
                        }`}
                      >
                        &lt;50% Count
                      </button>
                    </>
                  )}
                </div>
                <button
                  onClick={() => setFullscreenChart(null)}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-700 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                  title="Exit Presentation Mode"
                >
                  <X className="w-4 h-4" />
                  <span>Exit Presentation Mode</span>
                </button>
              </div>
            </div>

            <div className="flex-1 p-6 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                {(() => {
                  const activeMetric =
                    fullscreenChart === 'rm'
                      ? rmMetric
                      : fullscreenChart === 'center'
                      ? centerMetric
                      : programMetric;
                  const chartData =
                    fullscreenChart === 'rm'
                      ? sorted_by_rm
                      : fullscreenChart === 'center'
                      ? sorted_by_center
                      : sorted_by_program;
                  const barColor =
                    fullscreenChart === 'rm'
                      ? activeMetric === 'lt_50' || activeMetric === 'lt_50_count'
                        ? '#E11D48'
                        : '#4F46E5'
                      : fullscreenChart === 'center'
                      ? '#0891B2'
                      : '#059669';

                  return activeMetric === 'rate' || activeMetric === 'lt_50' ? (
                    <BarChart data={chartData} margin={{ top: 36, right: 30, left: 10, bottom: 80 }} barGap={8} barCategoryGap="22%">
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis dataKey="name" interval={0} height={80} tick={renderRotatedTick} />
                      <YAxis unit="%" domain={[0, 100]} tick={{ fontSize: 12, fill: '#64748B' }} />
                      <Tooltip content={renderCustomTooltip} />
                      <Legend iconSize={13} wrapperStyle={{ fontSize: '15px', fontWeight: 700, paddingTop: '15px' }} />
                      <Bar
                        dataKey="avg_beneficiary_attendance"
                        name={activeMetric === 'lt_50' ? 'Average of Beneficiary Attendance % (< 50%)' : 'Average of Beneficiary_Class_Attendance %'}
                        fill={barColor}
                        barSize={28}
                        radius={[4, 4, 0, 0]}
                      >
                        <LabelList dataKey="avg_beneficiary_attendance" position="top" formatter={(v: any) => (v != null ? `${Number(v).toFixed(1)}%` : '')} fill="#0F172A" fontSize={11} fontWeight={700} offset={6} />
                      </Bar>
                    </BarChart>
                  ) : activeMetric === 'lt_50_count' ? (
                    <BarChart data={chartData} margin={{ top: 36, right: 30, left: 10, bottom: 80 }} barGap={8} barCategoryGap="22%">
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis dataKey="name" interval={0} height={80} tick={renderRotatedTick} />
                      <YAxis tick={{ fontSize: 12, fill: '#64748B' }} />
                      <Tooltip content={renderCustomTooltip} />
                      <Legend iconSize={13} wrapperStyle={{ fontSize: '15px', fontWeight: 700, paddingTop: '15px' }} />
                      <Bar
                        dataKey="count"
                        name="Average <50% Count"
                        fill={barColor}
                        barSize={28}
                        radius={[4, 4, 0, 0]}
                      >
                        <LabelList dataKey="count" position="top" formatter={(v: any) => (v != null ? Number(v).toLocaleString() : '')} fill="#9F1239" fontSize={11} fontWeight={700} offset={6} />
                      </Bar>
                    </BarChart>
                  ) : (
                    <BarChart data={chartData} margin={{ top: 36, right: 30, left: 10, bottom: 80 }} barGap={8} barCategoryGap="22%">
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis dataKey="name" interval={0} height={80} tick={renderRotatedTick} />
                      <YAxis tick={{ fontSize: 12, fill: '#64748B' }} />
                      <Tooltip content={renderCustomTooltip} />
                      <Legend iconSize={13} wrapperStyle={{ fontSize: '15px', fontWeight: 700, paddingTop: '15px' }} />
                      <Bar dataKey="count" name="Closed Batch Students (Count)" fill={barColor} barSize={24} radius={[4, 4, 0, 0]}>
                        <LabelList dataKey="count" position="top" formatter={(v: any) => (v ? Number(v).toLocaleString() : '')} fill="#0F172A" fontSize={11} fontWeight={700} offset={6} />
                      </Bar>
                      <Bar dataKey="completed_batches" name="Closed Batches (Count)" fill="#10B981" barSize={24} radius={[4, 4, 0, 0]}>
                        <LabelList dataKey="completed_batches" position="top" formatter={(v: any) => (v ? Number(v).toLocaleString() : '')} fill="#047857" fontSize={11} fontWeight={700} offset={6} />
                      </Bar>
                    </BarChart>
                  );
                })()}
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
