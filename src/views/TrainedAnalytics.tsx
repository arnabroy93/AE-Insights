import React, { useState, useMemo, useEffect } from 'react';
import { consolidateUpvanDharClient } from '../utils/diyaConsolidation';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  TrendingUp,
  Users,
  Layers,
  Award,
  Search,
  Download,
  Filter,
  RotateCcw,
  Building2,
  Calendar,
  Sparkles,
  ChevronDown,
  ArrowUpDown,
  BookOpen,
  GraduationCap,
  Maximize2,
  X
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
  CartesianGrid,
  LabelList
} from 'recharts';
import {
  TrainedAnalyticsData,
  FilterParams,
  FilterOptions
} from '../types';
import { PresentableChartItem } from '../components/MeetingPresenterModal';
import { ProgramMultiSelect } from '../components/ProgramMultiSelect';
import { RmMultiSelect } from '../components/RmMultiSelect';
import { CenterMultiSelect } from '../components/CenterMultiSelect';
import { getScopedFilterOptions } from '../utils/filterHierarchy';
import { api } from '../api';

interface TrainedAnalyticsProps {
  data: TrainedAnalyticsData | null;
  loading: boolean;
  filters?: FilterParams;
  filterOptions?: FilterOptions;
  onFilterChange?: (filters: FilterParams) => void;
  onSelectCenterDrilldown?: (centerCode: string) => void;
  onOpenPresenter?: (charts: PresentableChartItem[]) => void;
}

const COLORS = ['#10B981', '#EF4444', '#F59E0B', '#3B82F6', '#6366F1'];

export const TrainedAnalytics: React.FC<TrainedAnalyticsProps> = ({
  data,
  loading,
  filters = {},
  filterOptions,
  onFilterChange,
  onSelectCenterDrilldown,
  onOpenPresenter,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [batchTabFilter, setBatchTabFilter] = useState<'all' | 'within_10' | 'after_10' | 'running'>('all');
  const [centerSortMode, setCenterSortMode] = useState<'lowest' | 'highest' | 'volume'>('highest');
  const [centerLimit, setCenterLimit] = useState<number | 'all'>(10);
  const [tableSearch, setTableSearch] = useState('');

  const [activeChartTab, setActiveChartTab] = useState<'all' | 'rm' | 'center' | 'program'>('all');
  const [breakdownMetric, setBreakdownMetric] = useState<'rate' | 'volume'>('rate');
  const [rmMetric, setRmMetric] = useState<'rate' | 'volume'>('rate');
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
        module: 'trained',
        chartType,
        chartTitle,
        filters: filters || {},
        chartSummary,
      });
    } catch (err) {
      console.error('Failed to export Trained chart raw data:', err);
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
    const text = payload?.value ?? '';
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
  const currentRmShZh = filters?.rmShZh || 'ALL';
  const currentCenterCode = filters?.centerCode || 'ALL';
  const currentProgramName = filters?.programName || 'ALL';

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

  const handleRmShZhChange = (value: string) => {
    handleRmsChange(value === 'ALL' || !value ? [] : [value]);
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

  const handleCenterChange = (value: string) => {
    handleCentersChange(value === 'ALL' || !value ? [] : [value]);
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
    total_students: 0,
    total_students_including_dropouts: 0,
    total_trained: 0,
    trained_within_10_days: 0,
    trained_within_10_days_pct: 0,
    trained_after_10_days: 0,
    trained_after_10_days_pct: 0,
    running_trained_pct: 0,
    active_in_training: 0,
    total_batches: 0,
    running_batches: 0,
    completed_batches: 0,
  };

  const sorted_by_rm = useMemo(() => {
    const rawArr = data?.by_rm || [];
    const arr = consolidateUpvanDharClient(rawArr, currentProgramType);
    return [...arr].sort((a: any, b: any) => {
      if (breakdownMetric === 'volume') {
        return (b.trained || 0) - (a.trained || 0);
      }
      return (b.trained_within_10_pct || 0) - (a.trained_within_10_pct || 0);
    });
  }, [data?.by_rm, breakdownMetric, currentProgramType]);

  const sorted_by_center = useMemo(() => {
    const arr = data?.by_center || [];
    return [...arr].map((c: any) => ({
      ...c,
      name: c.name || c.center_code || 'Unknown'
    })).sort((a: any, b: any) => {
      if (breakdownMetric === 'volume') {
        return (b.trained || 0) - (a.trained || 0);
      }
      return (b.trained_within_10_pct || 0) - (a.trained_within_10_pct || 0);
    }).slice(0, 10);
  }, [data?.by_center, breakdownMetric]);

  const sorted_by_program = useMemo(() => {
    const arr = data?.by_program || [];
    return [...arr].map((p: any) => ({
      ...p,
      name: p.name || p.program_name || 'Unknown'
    })).sort((a: any, b: any) => {
      if (breakdownMetric === 'volume') {
        return (b.trained || 0) - (a.trained || 0);
      }
      return (b.trained_within_10_pct || 0) - (a.trained_within_10_pct || 0);
    }).slice(0, 10);
  }, [data?.by_program, breakdownMetric]);

  // Filter batches for table
  const filteredBatches = useMemo(() => {
    if (!data?.batches) return [];
    return data.batches.filter((b) => {
      if (batchTabFilter === 'within_10' && b.trained_within_10 === 0) return false;
      if (batchTabFilter === 'after_10' && b.trained_after_10 === 0) return false;
      if (batchTabFilter === 'running' && b.batch_status !== 'running') return false;

      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        b.batch_code.toLowerCase().includes(term) ||
        (b.center_code && b.center_code.toLowerCase().includes(term)) ||
        (b.program_name && b.program_name.toLowerCase().includes(term)) ||
        (b.rm_sh_zh && b.rm_sh_zh.toLowerCase().includes(term)) ||
        (b.assigned_trainers && b.assigned_trainers.toLowerCase().includes(term)) ||
        (b.funder_name && b.funder_name.toLowerCase().includes(term))
      );
    });
  }, [data?.batches, batchTabFilter, searchTerm]);

  // Sorted and filtered centers
  const sortedCenters = useMemo(() => {
    if (!data?.by_center) return [];
    let list = [...data.by_center];
    if (tableSearch) {
      const q = tableSearch.toLowerCase();
      list = list.filter((c) => c.center_code.toLowerCase().includes(q));
    }
    if (centerSortMode === 'lowest') {
      list.sort((a, b) => a.trained_within_10_pct - b.trained_within_10_pct);
    } else if (centerSortMode === 'highest') {
      list.sort((a, b) => b.trained_within_10_pct - a.trained_within_10_pct);
    } else {
      list.sort((a, b) => b.trained - a.trained);
    }
    if (centerLimit === 'all') return list;
    return list.slice(0, centerLimit);
  }, [data?.by_center, centerSortMode, centerLimit, tableSearch]);

  // Export batches to CSV
  const handleExportCsv = () => {
    if (!data?.batches || data.batches.length === 0) return;
    const headers = [
      'Batch Code',
      'Center Code',
      'Program Name',
      'Funder Name',
      'Regional Manager',
      'Assigned Trainers',
      'Batch Status',
      'Batch Actual End Date',
      'Exam Schedule Date',
      'Total Students',
      'Total Trained',
      'Trained Within 10 Days',
      'Trained Within 10 Days %',
      'Trained After 10 Days (>10d)',
      'Trained After 10 Days %',
      'Avg Delay (Days)',
      'Timeliness Status'
    ];

    const rows = filteredBatches.map((b) => [
      `"${b.batch_code}"`,
      `"${b.center_code || ''}"`,
      `"${b.program_name || ''}"`,
      `"${b.funder_name || ''}"`,
      `"${b.rm_sh_zh || ''}"`,
      `"${(b.assigned_trainers || '').replace(/"/g, '""')}"`,
      `"${b.batch_status || ''}"`,
      `"${b.batch_actual_end_date || ''}"`,
      `"${b.exam_schedule_date || ''}"`,
      b.students,
      b.trained,
      b.trained_within_10,
      `${b.trained_within_10_pct}%`,
      b.trained_after_10,
      `${b.trained_after_10_pct}%`,
      b.avg_delay_days,
      `"${b.status}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Trained_Students_Timeliness_Report_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const pieData = [
    { name: 'Trained Within Time (<=10d)', value: kpis.trained_within_10_days, color: '#10B981' },
    { name: 'Trained Delayed (>10d)', value: kpis.trained_after_10_days, color: '#EF4444' },
  ].filter((d) => d.value > 0);

  if (loading && !data) {
    return (
      <div className="p-12 text-center text-xs text-slate-500">
        <div className="animate-spin w-8 h-8 border-3 border-[#008C95] border-t-transparent rounded-full mx-auto mb-3" />
        Computing Trained Students & Assessment Timeliness Analytics...
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
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                  Trained Students & Timeliness Analytics
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 bg-teal-100/70 text-[#008C95] rounded-full border border-teal-200">
                    Core Dashboard
                  </span>
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Track graduates, assessment timeliness within 10 days of batch actual end date, delayed certifications, and running training progress
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleExportCsv}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer shadow-2xs"
              title="Download CSV Ledger"
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* KPI 1: Active Enrolled Students */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">
              Enrolled (Excl. Dropouts)
            </span>
            <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-slate-900 tabular-nums">
            {kpis.total_students.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-400 mt-2">
            Active Cohort Students
          </div>
        </div>

        {/* KPI 2: Total Trained Candidates */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">
              Total Trained
            </span>
            <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-slate-900 tabular-nums">
            {kpis.total_trained.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-400 mt-2">
            Batch Complete &bull; Enrolled &bull; Exam &ge; 50
          </div>
        </div>

        {/* KPI 3: Running % of trained student */}
        <div className="bg-gradient-to-br from-blue-50/50 to-indigo-50/20 bg-white p-4 rounded-2xl border border-blue-200 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-blue-700 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">
              Running Trained %
            </span>
            <div className="w-7 h-7 rounded-lg bg-blue-100/80 text-blue-700 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-blue-900 tabular-nums">
            {kpis.running_trained_pct}%
          </div>
          <div className="mt-2 text-xs font-medium text-blue-700">
            {kpis.total_trained.toLocaleString()} / {kpis.total_students.toLocaleString()} Students
          </div>
          <div className="text-[10px] text-blue-800/80 mt-2 font-medium">
            Trained vs Active Enrolled Population
          </div>
        </div>

        {/* KPI 4: Trained within time (10 days from actual end date) */}
        <div className="bg-gradient-to-br from-emerald-50/50 to-teal-50/20 bg-white p-4 rounded-2xl border border-emerald-200 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-emerald-700 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">
              Trained Within Time
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-100/80 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-emerald-900 tabular-nums">
            {kpis.trained_within_10_days.toLocaleString()}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
              {kpis.trained_within_10_days_pct}%
            </span>
            <span className="text-[11px] text-slate-500 font-medium">of trained cohort</span>
          </div>
          <div className="text-[10px] text-emerald-800/80 mt-2 font-medium">
            &le; 10 days from actual end date
          </div>
        </div>

        {/* KPI 5: Trained time (>10 days from actual end date) */}
        <div className="bg-gradient-to-br from-rose-50/50 to-amber-50/20 bg-white p-4 rounded-2xl border border-rose-200 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-rose-700 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">
              Trained Delayed (&gt;10d)
            </span>
            <div className="w-7 h-7 rounded-lg bg-rose-100/80 text-rose-700 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-rose-900 tabular-nums">
            {kpis.trained_after_10_days.toLocaleString()}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
              {kpis.trained_after_10_days_pct}%
            </span>
            <span className="text-[11px] text-slate-500 font-medium">of trained cohort</span>
          </div>
          <div className="text-[10px] text-rose-800/80 mt-2 font-medium">
            &gt; 10 days from actual end date
          </div>
        </div>
      </div>

      {/* Chart Category Switcher Tabs & Metric Switcher */}
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

        {/* Rate vs Volume Switcher */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200 text-xs font-medium">
          <span className="text-[11px] text-slate-500 px-1 font-semibold">View Metric:</span>
          <button
            onClick={() => handleGlobalMetricChange('rate')}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer transition-all ${
              breakdownMetric === 'rate'
                ? 'bg-white text-slate-900 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Percentages (%)
          </button>
          <button
            onClick={() => handleGlobalMetricChange('volume')}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer transition-all ${
              breakdownMetric === 'volume'
                ? 'bg-white text-slate-900 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Counts (Headcount)
          </button>
        </div>
      </div>

      {/* 3 CORE BAR CHARTS: RM WISE, CENTER WISE & PROGRAM WISE */}
      <div className="space-y-6">
        {/* --- RM WISE CHART --- */}
        {(activeChartTab === 'all' || activeChartTab === 'rm') && (
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-indigo-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">RM Wise Trained & Timeliness Breakdown</h3>
                  <p className="text-[11px] text-slate-500">
                    Regional Manager distribution of trained candidates within 10 days vs delayed assessment
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs font-medium flex-wrap">
                <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg border border-slate-200 text-xs font-medium">
                  <span className="text-[10px] text-slate-500 px-1.5 font-semibold">View Metric:</span>
                  <button
                    onClick={() => setRmMetric('rate')}
                    className={`px-2 py-0.5 rounded-md text-[11px] font-semibold cursor-pointer transition-all ${
                      rmMetric === 'rate'
                        ? 'bg-white text-slate-900 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Timeliness Rate (%)
                  </button>
                  <button
                    onClick={() => setRmMetric('volume')}
                    className={`px-2 py-0.5 rounded-md text-[11px] font-semibold cursor-pointer transition-all ${
                      rmMetric === 'volume'
                        ? 'bg-white text-slate-900 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Student Volume
                  </button>
                </div>
                <button
                  onClick={() => handleExportChartExcel('rm', 'Trained_RM_Wise_Breakdown', sorted_by_rm)}
                  disabled={exportingChart === 'rm'}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-600 hover:text-white transition-all cursor-pointer border border-emerald-200 disabled:opacity-60"
                  title="Export chart summary and underlying raw student records to Excel for manual verification"
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
              <ResponsiveContainer width="100%" height="100%">
                {rmMetric === 'rate' ? (
                  <BarChart data={sorted_by_rm} margin={{ top: 32, right: 24, left: 6, bottom: 65 }} barGap={6} barCategoryGap="25%">
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="name" interval={0} height={65} tick={renderRotatedTick} />
                    <YAxis unit="%" domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748B' }} />
                    <Tooltip
                      formatter={(val: any, name: any) => [`${Number(val).toFixed(1)}%`, name]}
                      contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #BFDBFE', fontSize: '11px' }}
                    />
                    <Legend iconSize={12} wrapperStyle={{ fontSize: '14px', fontWeight: 700, paddingTop: '12px' }} />
                    <Bar dataKey="trained_within_10_pct" name="Trained Within 10 Days %" fill="#10B981" barSize={18} radius={[4, 4, 0, 0]}>
                      <LabelList dataKey="trained_within_10_pct" position="top" formatter={(v: any) => (v ? `${Number(v).toFixed(1)}%` : '')} fill="#047857" fontSize={9.5} fontWeight={700} offset={6} />
                    </Bar>
                    <Bar dataKey="trained_after_10_pct" name="Delayed Assessment (>10d) %" fill="#EF4444" barSize={18} radius={[4, 4, 0, 0]}>
                      <LabelList dataKey="trained_after_10_pct" position="top" formatter={(v: any) => (v ? `${Number(v).toFixed(1)}%` : '')} fill="#B91C1C" fontSize={9.5} fontWeight={700} offset={6} />
                    </Bar>
                  </BarChart>
                ) : (
                  <BarChart data={sorted_by_rm} margin={{ top: 32, right: 24, left: 6, bottom: 65 }} barGap={6} barCategoryGap="25%">
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="name" interval={0} height={65} tick={renderRotatedTick} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                    <Tooltip formatter={(val: any, name: any) => [`${Number(val).toLocaleString()} students`, name]} contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #BFDBFE', fontSize: '11px' }} />
                    <Legend iconSize={12} wrapperStyle={{ fontSize: '14px', fontWeight: 700, paddingTop: '12px' }} />
                    <Bar dataKey="trained_within_10" name="Trained Within 10 Days" fill="#10B981" barSize={18} radius={[4, 4, 0, 0]}>
                      <LabelList dataKey="trained_within_10" position="top" formatter={(v: any) => (v ? Number(v).toLocaleString() : '')} fill="#047857" fontSize={9.5} fontWeight={700} offset={6} />
                    </Bar>
                    <Bar dataKey="trained_after_10" name="Delayed Assessment (>10d)" fill="#EF4444" barSize={18} radius={[4, 4, 0, 0]}>
                      <LabelList dataKey="trained_after_10" position="top" formatter={(v: any) => (v ? Number(v).toLocaleString() : '')} fill="#B91C1C" fontSize={9.5} fontWeight={700} offset={6} />
                    </Bar>
                    <Bar dataKey="trained" name="Total Trained" fill="#3B82F6" barSize={18} radius={[4, 4, 0, 0]}>
                      <LabelList dataKey="trained" position="top" formatter={(v: any) => (v ? Number(v).toLocaleString() : '')} fill="#1D4ED8" fontSize={9.5} fontWeight={700} offset={6} />
                    </Bar>
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* --- CENTER WISE CHART --- */}
        {(activeChartTab === 'all' || activeChartTab === 'center') && (
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-cyan-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Center Wise Trained & Timeliness Breakdown (Top 10)</h3>
                  <p className="text-[11px] text-slate-500">
                    Top 10 centers comparison of trained candidates within 10 days vs delayed assessment
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs font-medium flex-wrap">
                <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg border border-slate-200 text-xs font-medium">
                  <span className="text-[10px] text-slate-500 px-1.5 font-semibold">View Metric:</span>
                  <button
                    onClick={() => setCenterMetric('rate')}
                    className={`px-2 py-0.5 rounded-md text-[11px] font-semibold cursor-pointer transition-all ${
                      centerMetric === 'rate'
                        ? 'bg-white text-slate-900 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Timeliness Rate (%)
                  </button>
                  <button
                    onClick={() => setCenterMetric('volume')}
                    className={`px-2 py-0.5 rounded-md text-[11px] font-semibold cursor-pointer transition-all ${
                      centerMetric === 'volume'
                        ? 'bg-white text-slate-900 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Student Volume
                  </button>
                </div>
                <button
                  onClick={() => handleExportChartExcel('center', 'Trained_Center_Wise_Top10_Breakdown', sorted_by_center)}
                  disabled={exportingChart === 'center'}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-600 hover:text-white transition-all cursor-pointer border border-emerald-200 disabled:opacity-60"
                  title="Export chart summary and underlying raw student records to Excel for manual verification"
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
                    <Tooltip formatter={(val: any, name: any) => [`${Number(val).toFixed(1)}%`, name]} contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #BFDBFE', fontSize: '11px' }} />
                    <Legend iconSize={12} wrapperStyle={{ fontSize: '14px', fontWeight: 700, paddingTop: '12px' }} />
                    <Bar dataKey="trained_within_10_pct" name="Trained Within 10 Days %" fill="#10B981" barSize={18} radius={[4, 4, 0, 0]}>
                      <LabelList dataKey="trained_within_10_pct" position="top" formatter={(v: any) => (v ? `${Number(v).toFixed(1)}%` : '')} fill="#047857" fontSize={9.5} fontWeight={700} offset={6} />
                    </Bar>
                    <Bar dataKey="trained_after_10_pct" name="Delayed Assessment (>10d) %" fill="#EF4444" barSize={18} radius={[4, 4, 0, 0]}>
                      <LabelList dataKey="trained_after_10_pct" position="top" formatter={(v: any) => (v ? `${Number(v).toFixed(1)}%` : '')} fill="#B91C1C" fontSize={9.5} fontWeight={700} offset={6} />
                    </Bar>
                  </BarChart>
                ) : (
                  <BarChart data={sorted_by_center} margin={{ top: 32, right: 24, left: 6, bottom: 65 }} barGap={6} barCategoryGap="25%">
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="name" interval={0} height={65} tick={renderRotatedTick} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                    <Tooltip formatter={(val: any, name: any) => [`${Number(val).toLocaleString()} students`, name]} contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #BFDBFE', fontSize: '11px' }} />
                    <Legend iconSize={12} wrapperStyle={{ fontSize: '14px', fontWeight: 700, paddingTop: '12px' }} />
                    <Bar dataKey="trained_within_10" name="Trained Within 10 Days" fill="#10B981" barSize={18} radius={[4, 4, 0, 0]}>
                      <LabelList dataKey="trained_within_10" position="top" formatter={(v: any) => (v ? Number(v).toLocaleString() : '')} fill="#047857" fontSize={9.5} fontWeight={700} offset={6} />
                    </Bar>
                    <Bar dataKey="trained_after_10" name="Delayed Assessment (>10d)" fill="#EF4444" barSize={18} radius={[4, 4, 0, 0]}>
                      <LabelList dataKey="trained_after_10" position="top" formatter={(v: any) => (v ? Number(v).toLocaleString() : '')} fill="#B91C1C" fontSize={9.5} fontWeight={700} offset={6} />
                    </Bar>
                    <Bar dataKey="trained" name="Total Trained" fill="#3B82F6" barSize={18} radius={[4, 4, 0, 0]}>
                      <LabelList dataKey="trained" position="top" formatter={(v: any) => (v ? Number(v).toLocaleString() : '')} fill="#1D4ED8" fontSize={9.5} fontWeight={700} offset={6} />
                    </Bar>
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* --- PROGRAM WISE CHART --- */}
        {(activeChartTab === 'all' || activeChartTab === 'program') && (
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Program Wise Trained & Timeliness Breakdown (Top 10)</h3>
                  <p className="text-[11px] text-slate-500">
                    Top 10 programs comparison of trained candidates within 10 days vs delayed assessment
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs font-medium flex-wrap">
                <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg border border-slate-200 text-xs font-medium">
                  <span className="text-[10px] text-slate-500 px-1.5 font-semibold">View Metric:</span>
                  <button
                    onClick={() => setProgramMetric('rate')}
                    className={`px-2 py-0.5 rounded-md text-[11px] font-semibold cursor-pointer transition-all ${
                      programMetric === 'rate'
                        ? 'bg-white text-slate-900 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Timeliness Rate (%)
                  </button>
                  <button
                    onClick={() => setProgramMetric('volume')}
                    className={`px-2 py-0.5 rounded-md text-[11px] font-semibold cursor-pointer transition-all ${
                      programMetric === 'volume'
                        ? 'bg-white text-slate-900 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Student Volume
                  </button>
                </div>
                <button
                  onClick={() => handleExportChartExcel('program', 'Trained_Program_Wise_Top10_Breakdown', sorted_by_program)}
                  disabled={exportingChart === 'program'}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-600 hover:text-white transition-all cursor-pointer border border-emerald-200 disabled:opacity-60"
                  title="Export chart summary and underlying raw student records to Excel for manual verification"
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
                    <Tooltip formatter={(val: any, name: any) => [`${Number(val).toFixed(1)}%`, name]} contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #BFDBFE', fontSize: '11px' }} />
                    <Legend iconSize={12} wrapperStyle={{ fontSize: '14px', fontWeight: 700, paddingTop: '12px' }} />
                    <Bar dataKey="trained_within_10_pct" name="Trained Within 10 Days %" fill="#10B981" barSize={18} radius={[4, 4, 0, 0]}>
                      <LabelList dataKey="trained_within_10_pct" position="top" formatter={(v: any) => (v ? `${Number(v).toFixed(1)}%` : '')} fill="#047857" fontSize={9.5} fontWeight={700} offset={6} />
                    </Bar>
                    <Bar dataKey="trained_after_10_pct" name="Delayed Assessment (>10d) %" fill="#EF4444" barSize={18} radius={[4, 4, 0, 0]}>
                      <LabelList dataKey="trained_after_10_pct" position="top" formatter={(v: any) => (v ? `${Number(v).toFixed(1)}%` : '')} fill="#B91C1C" fontSize={9.5} fontWeight={700} offset={6} />
                    </Bar>
                  </BarChart>
                ) : (
                  <BarChart data={sorted_by_program} margin={{ top: 32, right: 24, left: 6, bottom: 65 }} barGap={6} barCategoryGap="25%">
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="name" interval={0} height={65} tick={renderRotatedTick} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                    <Tooltip formatter={(val: any, name: any) => [`${Number(val).toLocaleString()} students`, name]} contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #BFDBFE', fontSize: '11px' }} />
                    <Legend iconSize={12} wrapperStyle={{ fontSize: '14px', fontWeight: 700, paddingTop: '12px' }} />
                    <Bar dataKey="trained_within_10" name="Trained Within 10 Days" fill="#10B981" barSize={18} radius={[4, 4, 0, 0]}>
                      <LabelList dataKey="trained_within_10" position="top" formatter={(v: any) => (v ? Number(v).toLocaleString() : '')} fill="#047857" fontSize={9.5} fontWeight={700} offset={6} />
                    </Bar>
                    <Bar dataKey="trained_after_10" name="Delayed Assessment (>10d)" fill="#EF4444" barSize={18} radius={[4, 4, 0, 0]}>
                      <LabelList dataKey="trained_after_10" position="top" formatter={(v: any) => (v ? Number(v).toLocaleString() : '')} fill="#B91C1C" fontSize={9.5} fontWeight={700} offset={6} />
                    </Bar>
                    <Bar dataKey="trained" name="Total Trained" fill="#3B82F6" barSize={18} radius={[4, 4, 0, 0]}>
                      <LabelList dataKey="trained" position="top" formatter={(v: any) => (v ? Number(v).toLocaleString() : '')} fill="#1D4ED8" fontSize={9.5} fontWeight={700} offset={6} />
                    </Bar>
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* FULLSCREEN MODAL FOR CHARTS */}
      {fullscreenChart && (() => {
        const modalData = fullscreenChart === 'rm' ? sorted_by_rm : fullscreenChart === 'center' ? sorted_by_center : sorted_by_program;
        const currentMetric = fullscreenChart === 'rm' ? rmMetric : fullscreenChart === 'center' ? centerMetric : programMetric;
        const setMetric = fullscreenChart === 'rm' ? setRmMetric : fullscreenChart === 'center' ? setCenterMetric : setProgramMetric;

        return (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs z-[9999] flex items-center justify-center p-4 sm:p-6 animate-fadeIn">
            <div className="bg-white w-full max-w-6xl h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
              <div className="flex items-center justify-between p-4 px-6 border-b border-slate-200 bg-slate-50 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <div className={`w-3.5 h-3.5 rounded-full ${fullscreenChart === 'rm' ? 'bg-indigo-600' : fullscreenChart === 'center' ? 'bg-cyan-600' : 'bg-emerald-600'}`} />
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <span>
                      {fullscreenChart === 'rm' && 'RM Wise Trained & Timeliness Breakdown'}
                      {fullscreenChart === 'center' && 'Center Wise Trained & Timeliness Breakdown'}
                      {fullscreenChart === 'program' && 'Program Wise Trained & Timeliness Breakdown'}
                    </span>
                    <span className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded bg-[#008C95]/10 text-[#008C95] border border-[#008C95]/30 font-mono font-semibold">
                      Presentation Mode
                    </span>
                  </h3>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg border border-slate-200 text-xs font-medium">
                    <span className="text-[10px] text-slate-500 px-1.5 font-semibold">View Metric:</span>
                    <button
                      onClick={() => setMetric('rate')}
                      className={`px-2 py-0.5 rounded-md text-[11px] font-semibold cursor-pointer transition-all ${
                        currentMetric === 'rate'
                          ? 'bg-white text-slate-900 shadow-2xs font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Timeliness Rate (%)
                    </button>
                    <button
                      onClick={() => setMetric('volume')}
                      className={`px-2 py-0.5 rounded-md text-[11px] font-semibold cursor-pointer transition-all ${
                        currentMetric === 'volume'
                          ? 'bg-white text-slate-900 shadow-2xs font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Student Volume
                    </button>
                  </div>
                  <button
                    onClick={() =>
                      handleExportChartExcel(
                        fullscreenChart,
                        fullscreenChart === 'rm'
                          ? 'Trained_RM_Wise_Breakdown'
                          : fullscreenChart === 'center'
                          ? 'Trained_Center_Wise_Top10_Breakdown'
                          : 'Trained_Program_Wise_Top10_Breakdown',
                        modalData
                      )
                    }
                    disabled={exportingChart === fullscreenChart}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-600 hover:text-white transition-all cursor-pointer border border-emerald-200 disabled:opacity-60"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{exportingChart === fullscreenChart ? 'Exporting...' : 'Export Raw Data (Excel)'}</span>
                  </button>
                  <button
                    onClick={() => setFullscreenChart(null)}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-700 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-all"
                    title="Exit Presentation Mode"
                  >
                    <X className="w-4 h-4" />
                    <span>Exit Presentation Mode</span>
                  </button>
                </div>
              </div>
              <div className="p-6 flex-1 min-h-0 bg-white">
                <ResponsiveContainer width="100%" height="100%">
                  {currentMetric === 'rate' ? (
                    <BarChart data={modalData} margin={{ top: 32, right: 24, left: 6, bottom: 85 }} barGap={6} barCategoryGap="25%">
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis dataKey="name" interval={0} height={85} tick={renderRotatedTick} />
                      <YAxis unit="%" domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748B' }} />
                      <Tooltip formatter={(val: any, name: any) => [`${Number(val).toFixed(1)}%`, name]} contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #BFDBFE', fontSize: '11px' }} />
                      <Legend iconSize={13} wrapperStyle={{ fontSize: '15px', fontWeight: 700, paddingTop: '15px' }} />
                      <Bar dataKey="trained_within_10_pct" name="Trained Within 10 Days %" fill="#10B981" barSize={22} radius={[4, 4, 0, 0]}>
                        <LabelList dataKey="trained_within_10_pct" position="top" formatter={(v: any) => (v ? `${Number(v).toFixed(1)}%` : '')} fill="#047857" fontSize={10} fontWeight={700} offset={6} />
                      </Bar>
                      <Bar dataKey="trained_after_10_pct" name="Delayed Assessment (>10d) %" fill="#EF4444" barSize={22} radius={[4, 4, 0, 0]}>
                        <LabelList dataKey="trained_after_10_pct" position="top" formatter={(v: any) => (v ? `${Number(v).toFixed(1)}%` : '')} fill="#B91C1C" fontSize={10} fontWeight={700} offset={6} />
                      </Bar>
                    </BarChart>
                  ) : (
                    <BarChart data={modalData} margin={{ top: 32, right: 24, left: 6, bottom: 85 }} barGap={6} barCategoryGap="25%">
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis dataKey="name" interval={0} height={85} tick={renderRotatedTick} />
                      <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                      <Tooltip formatter={(val: any, name: any) => [`${Number(val).toLocaleString()} students`, name]} contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #BFDBFE', fontSize: '11px' }} />
                      <Legend iconSize={13} wrapperStyle={{ fontSize: '15px', fontWeight: 700, paddingTop: '15px' }} />
                      <Bar dataKey="trained_within_10" name="Trained Within 10 Days" fill="#10B981" barSize={22} radius={[4, 4, 0, 0]}>
                        <LabelList dataKey="trained_within_10" position="top" formatter={(v: any) => (v ? Number(v).toLocaleString() : '')} fill="#047857" fontSize={10} fontWeight={700} offset={6} />
                      </Bar>
                      <Bar dataKey="trained_after_10" name="Delayed Assessment (>10d)" fill="#EF4444" barSize={22} radius={[4, 4, 0, 0]}>
                        <LabelList dataKey="trained_after_10" position="top" formatter={(v: any) => (v ? Number(v).toLocaleString() : '')} fill="#B91C1C" fontSize={10} fontWeight={700} offset={6} />
                      </Bar>
                      <Bar dataKey="trained" name="Total Trained" fill="#3B82F6" barSize={22} radius={[4, 4, 0, 0]}>
                        <LabelList dataKey="trained" position="top" formatter={(v: any) => (v ? Number(v).toLocaleString() : '')} fill="#1D4ED8" fontSize={10} fontWeight={700} offset={6} />
                      </Bar>
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Regional Manager Timeliness Ledger Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Regional Manager (RM) Training & Timeliness Ledger
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Comparative breakdown of candidates trained within 10 days vs delayed
            </p>
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-200/80 rounded-xl">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50/80 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-3.5 py-3">Regional Manager (RM)</th>
                <th className="px-3.5 py-3 text-right">Active Students</th>
                <th className="px-3.5 py-3 text-right">Total Trained</th>
                <th className="px-3.5 py-3 text-right">Within 10 Days (Count)</th>
                <th className="px-3.5 py-3 text-right">Within 10 Days (%)</th>
                <th className="px-3.5 py-3 text-right">Delayed &gt; 10 Days (Count)</th>
                <th className="px-3.5 py-3 text-right">Delayed &gt; 10 Days (%)</th>
                <th className="px-3.5 py-3 text-right">Running Trained %</th>
                <th className="px-3.5 py-3 text-right">In Training</th>
                <th className="px-3.5 py-3 text-right">Batches</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
              {sorted_by_rm && sorted_by_rm.length > 0 ? (
                sorted_by_rm.map((rm, idx) => (
                  <tr key={`${rm.name}_${idx}`} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-3.5 py-2.5 font-sans font-bold text-slate-900 text-xs">
                      {rm.name}
                    </td>
                    <td className="px-3.5 py-2.5 text-right text-slate-700">
                      {rm.students.toLocaleString()}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-bold text-blue-700">
                      {rm.trained.toLocaleString()}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-bold text-emerald-700">
                      {rm.trained_within_10.toLocaleString()}
                    </td>
                    <td className="px-3.5 py-2.5 text-right">
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        {rm.trained_within_10_pct}%
                      </span>
                    </td>
                    <td className="px-3.5 py-2.5 text-right text-rose-700 font-bold">
                      {rm.trained_after_10.toLocaleString()}
                    </td>
                    <td className="px-3.5 py-2.5 text-right">
                      {rm.trained_after_10 > 0 ? (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                          {rm.trained_after_10_pct}%
                        </span>
                      ) : (
                        <span className="text-slate-400">0%</span>
                      )}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-bold text-slate-900">
                      {rm.running_trained_pct}%
                    </td>
                    <td className="px-3.5 py-2.5 text-right text-amber-700">
                      {rm.in_training.toLocaleString()}
                    </td>
                    <td className="px-3.5 py-2.5 text-right text-slate-600">
                      {rm.batches}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-slate-400 font-sans">
                    No Regional Manager data available for the active filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Center Timeliness Breakdown */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Center Timeliness & Assessment Ranking
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Examine center-level compliance with the 10-day post-completion assessment SLA
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                placeholder="Search center..."
                className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-1 focus:ring-[#008C95]"
              />
            </div>

            <select
              value={centerSortMode}
              onChange={(e) => setCenterSortMode(e.target.value as any)}
              className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 cursor-pointer"
            >
              <option value="highest">Highest On-Time %</option>
              <option value="lowest">Lowest On-Time %</option>
              <option value="volume">Highest Trained Volume</option>
            </select>

            <select
              value={centerLimit}
              onChange={(e) => setCenterLimit(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 cursor-pointer"
            >
              <option value={10}>Top 10</option>
              <option value={25}>Top 25</option>
              <option value="all">All Centers</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-200/80 rounded-xl max-h-96">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50/80 text-slate-600 font-semibold border-b border-slate-200 sticky top-0">
              <tr>
                <th className="px-3.5 py-3">Center Code</th>
                <th className="px-3.5 py-3 text-right">Students</th>
                <th className="px-3.5 py-3 text-right">Trained</th>
                <th className="px-3.5 py-3 text-right">Within 10 Days</th>
                <th className="px-3.5 py-3 text-right">On-Time % (&le;10d)</th>
                <th className="px-3.5 py-3 text-right">Delayed (&gt;10d)</th>
                <th className="px-3.5 py-3 text-right">Delayed %</th>
                <th className="px-3.5 py-3 text-right">Running %</th>
                <th className="px-3.5 py-3 text-right">In Training</th>
                <th className="px-3.5 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
              {sortedCenters.map((c) => (
                <tr key={c.center_code} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-3.5 py-2.5 font-sans font-bold text-slate-900 text-xs">
                    {c.center_code}
                  </td>
                  <td className="px-3.5 py-2.5 text-right text-slate-700">
                    {c.students.toLocaleString()}
                  </td>
                  <td className="px-3.5 py-2.5 text-right font-bold text-blue-700">
                    {c.trained.toLocaleString()}
                  </td>
                  <td className="px-3.5 py-2.5 text-right font-bold text-emerald-700">
                    {c.trained_within_10.toLocaleString()}
                  </td>
                  <td className="px-3.5 py-2.5 text-right">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        c.trained_within_10_pct >= 90
                          ? 'bg-emerald-100 text-emerald-800'
                          : c.trained_within_10_pct >= 70
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {c.trained_within_10_pct}%
                    </span>
                  </td>
                  <td className="px-3.5 py-2.5 text-right text-rose-700 font-bold">
                    {c.trained_after_10.toLocaleString()}
                  </td>
                  <td className="px-3.5 py-2.5 text-right">
                    {c.trained_after_10 > 0 ? (
                      <span className="text-rose-600 font-bold">{c.trained_after_10_pct}%</span>
                    ) : (
                      <span className="text-slate-400">0%</span>
                    )}
                  </td>
                  <td className="px-3.5 py-2.5 text-right font-bold text-slate-900">
                    {c.running_trained_pct}%
                  </td>
                  <td className="px-3.5 py-2.5 text-right text-amber-700">
                    {c.in_training.toLocaleString()}
                  </td>
                  <td className="px-3.5 py-2.5 text-center font-sans">
                    {onSelectCenterDrilldown && (
                      <button
                        onClick={() => onSelectCenterDrilldown(c.center_code)}
                        className="px-2 py-1 bg-slate-100 hover:bg-[#008C95] hover:text-white rounded-lg text-[10px] font-semibold text-slate-700 transition-colors cursor-pointer"
                      >
                        Drilldown
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Batch-Level Ledger Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Batch-Level Assessment Timeliness Ledger ({filteredBatches.length} Batches)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Audit batch end dates, exam schedule dates, and 10-day timeliness compliance
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Filter Tabs */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
              <button
                onClick={() => setBatchTabFilter('all')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  batchTabFilter === 'all'
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setBatchTabFilter('within_10')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  batchTabFilter === 'within_10'
                    ? 'bg-emerald-600 text-white shadow-xs font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Within 10 Days
              </button>
              <button
                onClick={() => setBatchTabFilter('after_10')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  batchTabFilter === 'after_10'
                    ? 'bg-rose-600 text-white shadow-xs font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Delayed (&gt;10d)
              </button>
              <button
                onClick={() => setBatchTabFilter('running')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  batchTabFilter === 'running'
                    ? 'bg-amber-600 text-white shadow-xs font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                In Training
              </button>
            </div>

            {/* Search Box */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search batch code, center, RM..."
                className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-1 focus:ring-[#008C95] w-60"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-200/80 rounded-xl max-h-96">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50/80 text-slate-600 font-semibold border-b border-slate-200 sticky top-0">
              <tr>
                <th className="px-3.5 py-3">Batch Code</th>
                <th className="px-3.5 py-3">Center</th>
                <th className="px-3.5 py-3">Program</th>
                <th className="px-3.5 py-3">RM</th>
                <th className="px-3.5 py-3">Actual End Date</th>
                <th className="px-3.5 py-3">Exam Schedule Date</th>
                <th className="px-3.5 py-3 text-right">Students</th>
                <th className="px-3.5 py-3 text-right">Trained</th>
                <th className="px-3.5 py-3 text-right">&le; 10d (Count)</th>
                <th className="px-3.5 py-3 text-right">&gt; 10d (Count)</th>
                <th className="px-3.5 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
              {filteredBatches.slice(0, 100).map((b) => (
                <tr key={b.batch_code} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-3.5 py-2.5 font-bold text-slate-900 text-xs">
                    {b.batch_code}
                  </td>
                  <td className="px-3.5 py-2.5 font-sans text-slate-700">{b.center_code}</td>
                  <td className="px-3.5 py-2.5 font-sans text-slate-700 truncate max-w-[150px]" title={b.program_name}>
                    {b.program_name}
                  </td>
                  <td className="px-3.5 py-2.5 font-sans text-slate-700">{b.rm_sh_zh}</td>
                  <td className="px-3.5 py-2.5 text-slate-600">{b.batch_actual_end_date || '—'}</td>
                  <td className="px-3.5 py-2.5 text-slate-600">{b.exam_schedule_date || '—'}</td>
                  <td className="px-3.5 py-2.5 text-right text-slate-700">{b.students}</td>
                  <td className="px-3.5 py-2.5 text-right font-bold text-blue-700">{b.trained}</td>
                  <td className="px-3.5 py-2.5 text-right font-bold text-emerald-700">{b.trained_within_10}</td>
                  <td className="px-3.5 py-2.5 text-right font-bold text-rose-700">{b.trained_after_10}</td>
                  <td className="px-3.5 py-2.5 text-center font-sans">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        b.trained_after_10 > 0
                          ? 'bg-rose-100 text-rose-800'
                          : b.trained_within_10 > 0
                          ? 'bg-emerald-100 text-emerald-800'
                          : b.batch_status === 'running'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {b.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredBatches.length > 100 && (
          <div className="mt-3 text-center text-xs text-slate-400">
            Showing first 100 of {filteredBatches.length} batches. Click 'Export CSV' to download the full ledger.
          </div>
        )}
      </div>
    </div>
  );
};
