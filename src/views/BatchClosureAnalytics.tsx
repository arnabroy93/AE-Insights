import React, { useState, useMemo, useEffect } from 'react';
import { consolidateUpvanDharClient } from '../utils/diyaConsolidation';
import {
  Layers,
  Clock,
  CheckCircle2,
  AlertTriangle,
  PlayCircle,
  PauseCircle,
  Download,
  Search,
  ChevronDown,
  RotateCcw,
  Users,
  Building2,
  BookOpen,
  Percent,
  Award,
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
  LineChart,
  Line,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
  LabelList
} from 'recharts';
import { FilterParams, FilterOptions } from '../types';
import { ProgramMultiSelect } from '../components/ProgramMultiSelect';
import { RmMultiSelect } from '../components/RmMultiSelect';
import { CenterMultiSelect } from '../components/CenterMultiSelect';
import { getScopedFilterOptions } from '../utils/filterHierarchy';
import { api } from '../api';

interface BatchClosureAnalyticsProps {
  data: any;
  loading: boolean;
  filters?: FilterParams;
  filterOptions?: FilterOptions;
  onFilterChange?: (filters: FilterParams) => void;
  onSelectRecord?: (record: any) => void;
}

const COLORS = ['#10B981', '#EF4444', '#F59E0B', '#6366F1'];

export const BatchClosureAnalytics: React.FC<BatchClosureAnalyticsProps> = ({
  data,
  loading,
  filters = {},
  filterOptions,
  onFilterChange,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [closureFilter, setClosureFilter] = useState<'all' | 'within_10' | 'after_10' | 'within_7' | 'after_7' | 'ilt_gte_120' | 'ilt_lt_120'>('all');
  const [centerSortMode, setCenterSortMode] = useState<'lowest' | 'highest' | 'volume'>('lowest');
  const [centerLimit, setCenterLimit] = useState<number | 'all'>(10);
  const [centerViewType, setCenterViewType] = useState<'stacked_pct' | 'ontime_only' | 'counts'>('stacked_pct');

  const [activeChartTab, setActiveChartTab] = useState<'all' | 'rm' | 'center' | 'program'>('all');
  const [breakdownMetric, setBreakdownMetric] = useState<'rate' | 'volume'>('rate');
  const [rmMetric, setRmMetric] = useState<'rate' | 'volume'>('rate');
  const [centerMetric, setCenterMetric] = useState<'rate' | 'volume'>('rate');
  const [programMetric, setProgramMetric] = useState<'rate' | 'volume'>('rate');
  const [fullscreenChart, setFullscreenChart] = useState<'rm' | 'center' | 'program' | null>(null);
  const [exportingChart, setExportingChart] = useState<string | null>(null);

  const handleGlobalMetricChange = (m: 'rate' | 'volume') => {
    setBreakdownMetric(m);
    setRmMetric(m);
    setCenterMetric(m);
    setProgramMetric(m);
  };

  const handleExportChartExcel = async (
    chartType: 'rm' | 'center' | 'program' | 'all',
    chartTitle: string,
    chartSummary: any[]
  ) => {
    try {
      setExportingChart(chartType);
      await api.exportChartRawExcel({
        module: 'batch_closure',
        chartType,
        chartTitle,
        filters: filters || {},
        chartSummary,
      });
    } catch (err) {
      console.error('Failed to export Batch Closure chart raw data:', err);
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

  const sorted_by_rm = useMemo(() => {
    const rawArr = data?.by_rm || [];
    const arr = consolidateUpvanDharClient(rawArr, currentProgramType);
    return [...arr].sort((a: any, b: any) => {
      if (rmMetric === 'volume') {
        return (b.after_10_days ?? b.delayed ?? 0) - (a.after_10_days ?? a.delayed ?? 0);
      }
      return (b.within_10_pct ?? b.on_time_pct ?? 0) - (a.within_10_pct ?? a.on_time_pct ?? 0);
    });
  }, [data?.by_rm, rmMetric, currentProgramType]);

  const sorted_by_center = useMemo(() => {
    const arr = data?.by_center || [];
    return [...arr].map((c: any) => ({
      ...c,
      name: c.name || c.center_code || 'Unknown'
    })).sort((a: any, b: any) => {
      if (centerMetric === 'volume') {
        return (b.after_10_days ?? b.delayed ?? 0) - (a.after_10_days ?? a.delayed ?? 0);
      }
      return (b.within_10_pct ?? b.on_time_pct ?? 0) - (a.within_10_pct ?? a.on_time_pct ?? 0);
    }).slice(0, 10);
  }, [data?.by_center, centerMetric]);

  const sorted_by_program = useMemo(() => {
    const arr = data?.by_program || [];
    return [...arr].map((p: any) => ({
      ...p,
      name: p.name || p.program_name || 'Unknown'
    })).sort((a: any, b: any) => {
      if (programMetric === 'volume') {
        return (b.after_10_days ?? b.delayed ?? 0) - (a.after_10_days ?? a.delayed ?? 0);
      }
      return (b.within_10_pct ?? b.on_time_pct ?? 0) - (a.within_10_pct ?? a.on_time_pct ?? 0);
    }).slice(0, 10);
  }, [data?.by_program, programMetric]);

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

  const center_closure_summary = data?.center_closure_summary;
  const allBatches = (data?.closure_batches || data?.delayed_batches || []) as any[];

  // Process and enrich center closure summary for proper visual representation (Called unconditionally at top level)
  const processedCenterData = useMemo(() => {
    if (!center_closure_summary || !Array.isArray(center_closure_summary)) return [];
    return center_closure_summary.map((c: any) => {
      const total = c.total_eligible || (c.on_time + c.delayed) || 1;
      const onTimePct = c.on_time_pct !== undefined ? Number(c.on_time_pct) : Number(((c.on_time / total) * 100).toFixed(1));
      const delayedPct = Number((100 - onTimePct).toFixed(1));
      return {
        ...c,
        on_time: Number(c.on_time || 0),
        delayed: Number(c.delayed || 0),
        total_eligible: Number(total),
        on_time_pct: onTimePct,
        delayed_pct: Math.max(0, delayedPct),
        avg_delay_days: Number(c.avg_delay_days || 0),
      };
    });
  }, [center_closure_summary]);

  const sortedCenterData = useMemo(() => {
    const list = [...processedCenterData];
    if (centerSortMode === 'lowest') {
      // Prioritize centers with lowest on-time percentage (problem areas), secondary by most delayed
      list.sort((a, b) => a.on_time_pct - b.on_time_pct || b.delayed - a.delayed);
    } else if (centerSortMode === 'highest') {
      // Prioritize top on-time performing centers
      list.sort((a, b) => b.on_time_pct - a.on_time_pct || b.on_time - a.on_time);
    } else if (centerSortMode === 'volume') {
      // Prioritize highest batch volume centers
      list.sort((a, b) => (b.total_eligible || 0) - (a.total_eligible || 0) || b.delayed - a.delayed);
    }

    if (centerLimit === 'all') {
      return list;
    }
    return list.slice(0, typeof centerLimit === 'number' ? centerLimit : 10);
  }, [processedCenterData, centerSortMode, centerLimit]);

  if (loading && !data) {
    return (
      <div className="p-8 text-center text-xs text-slate-500">
        <div className="animate-spin w-6 h-6 border-2 border-[#008C95] border-t-transparent rounded-full mx-auto mb-2" />
        Loading Batch Closure Efficiency Analytics...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 text-center text-xs text-slate-500">
        No batch closure data available.
      </div>
    );
  }

  const { kpis, monthly_trend } = data;

  const filteredBatches = allBatches.filter((b: any) => {
    const isWithin10 = b.is_within_10_days !== undefined
      ? b.is_within_10_days
      : (b.is_within_7_days !== undefined ? b.is_within_7_days : (b.delay_days !== undefined ? b.delay_days <= 10 : true));
    if ((closureFilter === 'within_10' || closureFilter === 'within_7') && !isWithin10) return false;
    if ((closureFilter === 'after_10' || closureFilter === 'after_7') && isWithin10) return false;
    if (closureFilter === 'ilt_gte_120') {
      const ilt = b.ilt_pct !== undefined && b.ilt_pct !== null
        ? b.ilt_pct
        : (b.ilt_completion != null ? (b.ilt_completion > 2 ? b.ilt_completion : b.ilt_completion * 100) : null);
      if (ilt == null || ilt < 120) return false;
    }
    if (closureFilter === 'ilt_lt_120') {
      const ilt = b.ilt_pct !== undefined && b.ilt_pct !== null
        ? b.ilt_pct
        : (b.ilt_completion != null ? (b.ilt_completion > 2 ? b.ilt_completion : b.ilt_completion * 100) : null);
      if (ilt != null && ilt >= 120) return false;
    }

    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (b.batch_code || '').toLowerCase().includes(term) ||
      (b.center_code || '').toLowerCase().includes(term) ||
      (b.assigned_trainers || '').toLowerCase().includes(term) ||
      (b.program_name || '').toLowerCase().includes(term)
    );
  });

  const exportClosureCsv = () => {
    const headers = [
      'Batch Code',
      'Center Code',
      'Program',
      'Trainer',
      'Start Date',
      'Planned End Date',
      'Actual End Date',
      'Delay Days',
      'Closure Category',
      'ILT %',
      'Status',
      'Validation Status'
    ];
    const rows = filteredBatches.map((b: any) => {
      const isWithin10 = b.is_within_10_days !== undefined
        ? b.is_within_10_days
        : (b.is_within_7_days !== undefined ? b.is_within_7_days : (b.delay_days !== undefined ? b.delay_days <= 10 : true));
      const iltVal = b.ilt_pct !== undefined && b.ilt_pct !== null ? `${b.ilt_pct}%` : '—';
      return [
        b.batch_code,
        b.center_code,
        `"${b.program_name || ''}"`,
        `"${b.assigned_trainers || ''}"`,
        b.batch_start_date || '',
        b.batch_end_date || '',
        b.batch_actual_end_date || '',
        b.delay_days,
        isWithin10 ? 'Closed within 10 Days' : 'Closed After 10 Days',
        iltVal,
        b.batch_status,
        b.batch_validation_status
      ];
    });
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r: any[]) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Batch_Closure_Report_${closureFilter}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header & Combined Filters: Program Type (Diya and Deeptech / Diya Only / Deeptech Only), RM wise, Center, Program */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-3.5 relative z-30">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                Batch Closure &amp; Lifecycle Efficiency
              </h2>
              <span className="text-[11px] font-semibold px-2 py-0.5 bg-[#E6F4F5] text-[#005F66] rounded-md border border-[#CCECF0]">
                {currentProgramType}
              </span>
              {(filters?.startDate || filters?.endDate) && (
                <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                  <Clock className="w-3 h-3" />
                  <span>
                    Date: {filters?.startDate || '...'} to {filters?.endDate || '...'}
                  </span>
                  <button
                    onClick={() => onFilterChange?.({ ...filters, startDate: undefined, endDate: undefined })}
                    className="ml-0.5 hover:text-amber-950 cursor-pointer"
                    title="Clear Date filter"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {hasActiveCustomFilters && (
                <button
                  onClick={handleResetFilters}
                  className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Reset all filters"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset</span>
                </button>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Distinct batch closure timeline, on-time completion rates, and delay analysis
            </p>
          </div>

          {/* Program Type Filter Options: Diya and Deeptech, Diya Only, Deeptech Only */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200 self-start md:self-auto shrink-0">
            {[
              { id: 'Diya and Deeptech', label: 'Diya and Deeptech', tooltip: 'Combined dataset of Diya and Deep Tech batches' },
              { id: 'Diya Only', label: 'Diya Only', tooltip: 'Diya programs only (strictly excludes Deep Tech batches)' },
              { id: 'Deeptech Only', label: 'Deeptech Only', tooltip: 'Deep Tech programs only (across all funders & RMs)' },
            ].map((opt) => {
              const isSelected = currentProgramType === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => handleProgramTypeSelect(opt.id)}
                  title={opt.tooltip}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#008C95] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Multi-Filter Controls Row */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2.5">
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

          {/* RM Wise Multi-Select Filter with embedded Program selection */}
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

          {/* Center Wise Multi-Select Filter with embedded Program selection */}
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

      {/* 1. Batch Closure KPIs (Distinct Batch Level Grain) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 xl:grid-cols-8 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase">Total Batches</span>
          <div className="text-xl font-bold font-mono text-slate-900 mt-1 tabular-nums">
            {kpis?.total_batches || 0}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Distinct Batch Codes</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase">Running Batches</span>
          <div className="text-xl font-bold font-mono text-emerald-600 mt-1 tabular-nums">
            {kpis?.running_batches || 0}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Active</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase">Completed Batches</span>
          <div className="text-xl font-bold font-mono text-[#008C95] mt-1 tabular-nums">
            {kpis?.completed_batches || 0}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Closed Status</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase">On-Hold Batches</span>
          <div className="text-xl font-bold font-mono text-amber-600 mt-1 tabular-nums">
            {kpis?.hold_batches || 0}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Temporarily paused</div>
        </div>

        {/* 1. Batch Closed within 10 Days */}
        <div
          onClick={() => setClosureFilter(closureFilter === 'within_10' || closureFilter === 'within_7' ? 'all' : 'within_10')}
          className={`p-4 rounded-xl border transition-all cursor-pointer relative ${
            closureFilter === 'within_10' || closureFilter === 'within_7'
              ? 'bg-emerald-50/80 border-emerald-400 ring-2 ring-emerald-500/30 shadow-xs'
              : 'bg-white border-slate-200/80 hover:border-emerald-300 hover:bg-emerald-50/20 shadow-xs'
          }`}
          title="Click to filter table: Difference between Batch End Date and Batch Actual End Date <= 10 days"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-tight">
              Closed within 10 Days
            </span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          </div>
          <div className="text-xl font-bold font-mono text-emerald-700 mt-1 tabular-nums">
            {kpis?.closed_within_10_days ?? kpis?.closed_within_7_days ?? 0}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5 flex items-center justify-between">
            <span>Diff ≤ 10 days</span>
            <span className="font-semibold text-emerald-600">
              {kpis?.closed_within_10_days_pct ?? kpis?.closed_within_7_days_pct ?? 0}%
            </span>
          </div>
        </div>

        {/* 2. Batch Closed After 10 Days */}
        <div
          onClick={() => setClosureFilter(closureFilter === 'after_10' || closureFilter === 'after_7' ? 'all' : 'after_10')}
          className={`p-4 rounded-xl border transition-all cursor-pointer relative ${
            closureFilter === 'after_10' || closureFilter === 'after_7'
              ? 'bg-rose-50/80 border-rose-400 ring-2 ring-rose-500/30 shadow-xs'
              : 'bg-white border-slate-200/80 hover:border-rose-300 hover:bg-rose-50/20 shadow-xs'
          }`}
          title="Click to filter table: Difference between Batch End Date and Batch Actual End Date > 10 days"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-rose-700 uppercase tracking-tight">
              Closed After 10 Days
            </span>
            <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
          </div>
          <div className="text-xl font-bold font-mono text-rose-700 mt-1 tabular-nums">
            {kpis?.closed_after_10_days ?? kpis?.closed_after_7_days ?? 0}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5 flex items-center justify-between">
            <span>Diff &gt; 10 days</span>
            <span className="font-semibold text-rose-600">
              {kpis?.closed_after_10_days_pct ?? kpis?.closed_after_7_days_pct ?? 0}%
            </span>
          </div>
        </div>

        {/* 3. Closed Batches ILT >= 120% */}
        <div
          onClick={() => setClosureFilter(closureFilter === 'ilt_gte_120' ? 'all' : 'ilt_gte_120')}
          className={`p-4 rounded-xl border transition-all cursor-pointer relative ${
            closureFilter === 'ilt_gte_120'
              ? 'bg-blue-50/90 border-blue-400 ring-2 ring-blue-500/30 shadow-xs'
              : 'bg-white border-slate-200/80 hover:border-blue-300 hover:bg-blue-50/20 shadow-xs'
          }`}
          title="Click to filter table: Closed Batches with ILT percentage >= 120%"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-blue-700 uppercase tracking-tight">
              Closed ILT ≥ 120%
            </span>
            <Award className="w-3.5 h-3.5 text-blue-600 shrink-0" />
          </div>
          <div className="text-xl font-bold font-mono text-blue-700 mt-1 tabular-nums">
            {kpis?.closed_batches_ilt_gte_120 ?? kpis?.closed_batches_ilt_gte_110 ?? 0}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5 flex items-center justify-between">
            <span>ILT ≥ 120%</span>
            <span className="font-semibold text-blue-600">
              {kpis?.closed_batches_ilt_gte_120_pct ?? kpis?.closed_batches_ilt_gte_110_pct ?? 0}%
            </span>
          </div>
        </div>

        {/* 4. Closed Batches ILT < 120% */}
        <div
          onClick={() => setClosureFilter(closureFilter === 'ilt_lt_120' ? 'all' : 'ilt_lt_120')}
          className={`p-4 rounded-xl border transition-all cursor-pointer relative ${
            closureFilter === 'ilt_lt_120'
              ? 'bg-amber-50/90 border-amber-400 ring-2 ring-amber-500/30 shadow-xs'
              : 'bg-white border-slate-200/80 hover:border-amber-300 hover:bg-amber-50/20 shadow-xs'
          }`}
          title="Click to filter table: Closed Batches with ILT percentage < 120%"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-amber-700 uppercase tracking-tight">
              Closed ILT &lt; 120%
            </span>
            <Percent className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          </div>
          <div className="text-xl font-bold font-mono text-amber-700 mt-1 tabular-nums">
            {kpis?.closed_batches_ilt_lt_120 ?? kpis?.closed_batches_ilt_lt_110 ?? 0}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5 flex items-center justify-between">
            <span>ILT &lt; 120%</span>
            <span className="font-semibold text-amber-600">
              {kpis?.closed_batches_ilt_lt_120_pct ?? kpis?.closed_batches_ilt_lt_110_pct ?? 0}%
            </span>
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
          <span className="text-[11px] text-slate-500 px-1 font-semibold">View Metric (All):</span>
          <button
            onClick={() => handleGlobalMetricChange('rate')}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer transition-all ${
              breakdownMetric === 'rate'
                ? 'bg-white text-slate-900 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Closure Rate (%)
          </button>
          <button
            onClick={() => handleGlobalMetricChange('volume')}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer transition-all ${
              breakdownMetric === 'volume'
                ? 'bg-white text-slate-900 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Batch Volume
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
                  <h3 className="text-sm font-bold text-slate-900">RM Wise Batch Closure Breakdown</h3>
                  <p className="text-[11px] text-slate-500">
                    Regional Manager distribution of within 10 days vs after 10 days batch closures
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
                    Closure Rate (%)
                  </button>
                  <button
                    onClick={() => setRmMetric('volume')}
                    className={`px-2 py-0.5 rounded-md text-[11px] font-semibold cursor-pointer transition-all ${
                      rmMetric === 'volume'
                        ? 'bg-white text-slate-900 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Batch Volume
                  </button>
                </div>
                <button
                  onClick={() => handleExportChartExcel('rm', 'BatchClosure_RM_Wise_Breakdown', sorted_by_rm)}
                  disabled={exportingChart === 'rm'}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-600 hover:text-white transition-all cursor-pointer border border-emerald-200 disabled:opacity-60"
                  title="Export chart summary and underlying batch-level raw records to Excel for manual verification"
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



            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                {rmMetric === 'rate' ? (
                  <BarChart data={sorted_by_rm} margin={{ top: 32, right: 24, left: 6, bottom: 65 }} barGap={6} barCategoryGap="25%">
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="name" interval={0} height={65} tick={renderRotatedTick} />
                    <YAxis unit="%" domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748B' }} />
                    <Tooltip formatter={(val: any, name: any) => [`${Number(val).toFixed(1)}%`, name]} contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #BFDBFE', fontSize: '11px' }} />
                    <Legend iconSize={12} wrapperStyle={{ fontSize: '14px', fontWeight: 700, paddingTop: '12px' }} />
                    <Bar dataKey="within_10_pct" name="Closed Within 10 Days %" fill="#10B981" barSize={18} radius={[4, 4, 0, 0]}>
                      <LabelList dataKey="within_10_pct" position="top" formatter={(v: any) => (v ? `${Number(v).toFixed(1)}%` : '')} fill="#047857" fontSize={9.5} fontWeight={700} offset={6} />
                    </Bar>
                    <Bar dataKey="after_10_pct" name="Closed After 10 Days %" fill="#EF4444" barSize={18} radius={[4, 4, 0, 0]}>
                      <LabelList dataKey="after_10_pct" position="top" formatter={(v: any) => (v ? `${Number(v).toFixed(1)}%` : '')} fill="#B91C1C" fontSize={9.5} fontWeight={700} offset={6} />
                    </Bar>
                  </BarChart>
                ) : (
                  <BarChart data={sorted_by_rm} margin={{ top: 32, right: 24, left: 6, bottom: 65 }} barGap={6} barCategoryGap="25%">
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="name" interval={0} height={65} tick={renderRotatedTick} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                    <Tooltip formatter={(val: any, name: any) => [`${val} batches`, name]} contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #BFDBFE', fontSize: '11px' }} />
                    <Legend iconSize={12} wrapperStyle={{ fontSize: '14px', fontWeight: 700, paddingTop: '12px' }} />
                    <Bar dataKey="within_10_days" name="Within 10 Days Batches" fill="#10B981" barSize={18} radius={[4, 4, 0, 0]}>
                      <LabelList dataKey="within_10_days" position="top" formatter={(v: any) => (v ? v : '')} fill="#047857" fontSize={9.5} fontWeight={700} offset={6} />
                    </Bar>
                    <Bar dataKey="after_10_days" name="After 10 Days Batches" fill="#EF4444" barSize={18} radius={[4, 4, 0, 0]}>
                      <LabelList dataKey="after_10_days" position="top" formatter={(v: any) => (v ? v : '')} fill="#B91C1C" fontSize={9.5} fontWeight={700} offset={6} />
                    </Bar>
                    <Bar dataKey="total_batches" name="Total Closed Batches" fill="#6366F1" barSize={18} radius={[4, 4, 0, 0]}>
                      <LabelList dataKey="total_batches" position="top" formatter={(v: any) => (v ? v : '')} fill="#4338CA" fontSize={9.5} fontWeight={700} offset={6} />
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
                  <h3 className="text-sm font-bold text-slate-900">Center Wise Batch Closure Breakdown (Top 10)</h3>
                  <p className="text-[11px] text-slate-500">
                    Top 10 centers comparison of within 10 days vs after 10 days batch closures
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
                    Closure Rate (%)
                  </button>
                  <button
                    onClick={() => setCenterMetric('volume')}
                    className={`px-2 py-0.5 rounded-md text-[11px] font-semibold cursor-pointer transition-all ${
                      centerMetric === 'volume'
                        ? 'bg-white text-slate-900 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Batch Volume
                  </button>
                </div>
                <button
                  onClick={() => handleExportChartExcel('center', 'BatchClosure_Center_Wise_Top10_Breakdown', sorted_by_center)}
                  disabled={exportingChart === 'center'}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-600 hover:text-white transition-all cursor-pointer border border-emerald-200 disabled:opacity-60"
                  title="Export chart summary and underlying batch-level raw records to Excel for manual verification"
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



            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                {centerMetric === 'rate' ? (
                  <BarChart data={sorted_by_center} margin={{ top: 32, right: 24, left: 6, bottom: 65 }} barGap={6} barCategoryGap="25%">
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="name" interval={0} height={65} tick={renderRotatedTick} />
                    <YAxis unit="%" domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748B' }} />
                    <Tooltip formatter={(val: any, name: any) => [`${Number(val).toFixed(1)}%`, name]} contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #BFDBFE', fontSize: '11px' }} />
                    <Legend iconSize={12} wrapperStyle={{ fontSize: '14px', fontWeight: 700, paddingTop: '12px' }} />
                    <Bar dataKey="within_10_pct" name="Closed Within 10 Days %" fill="#10B981" barSize={18} radius={[4, 4, 0, 0]}>
                      <LabelList dataKey="within_10_pct" position="top" formatter={(v: any) => (v ? `${Number(v).toFixed(1)}%` : '')} fill="#047857" fontSize={9.5} fontWeight={700} offset={6} />
                    </Bar>
                    <Bar dataKey="after_10_pct" name="Closed After 10 Days %" fill="#EF4444" barSize={18} radius={[4, 4, 0, 0]}>
                      <LabelList dataKey="after_10_pct" position="top" formatter={(v: any) => (v ? `${Number(v).toFixed(1)}%` : '')} fill="#B91C1C" fontSize={9.5} fontWeight={700} offset={6} />
                    </Bar>
                  </BarChart>
                ) : (
                  <BarChart data={sorted_by_center} margin={{ top: 32, right: 24, left: 6, bottom: 65 }} barGap={6} barCategoryGap="25%">
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="name" interval={0} height={65} tick={renderRotatedTick} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                    <Tooltip formatter={(val: any, name: any) => [`${val} batches`, name]} contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #BFDBFE', fontSize: '11px' }} />
                    <Legend iconSize={12} wrapperStyle={{ fontSize: '14px', fontWeight: 700, paddingTop: '12px' }} />
                    <Bar dataKey="within_10_days" name="Within 10 Days Batches" fill="#10B981" barSize={18} radius={[4, 4, 0, 0]}>
                      <LabelList dataKey="within_10_days" position="top" formatter={(v: any) => (v ? v : '')} fill="#047857" fontSize={9.5} fontWeight={700} offset={6} />
                    </Bar>
                    <Bar dataKey="after_10_days" name="After 10 Days Batches" fill="#EF4444" barSize={18} radius={[4, 4, 0, 0]}>
                      <LabelList dataKey="after_10_days" position="top" formatter={(v: any) => (v ? v : '')} fill="#B91C1C" fontSize={9.5} fontWeight={700} offset={6} />
                    </Bar>
                    <Bar dataKey="total_batches" name="Total Closed Batches" fill="#6366F1" barSize={18} radius={[4, 4, 0, 0]}>
                      <LabelList dataKey="total_batches" position="top" formatter={(v: any) => (v ? v : '')} fill="#4338CA" fontSize={9.5} fontWeight={700} offset={6} />
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
                  <h3 className="text-sm font-bold text-slate-900">Program Wise Batch Closure Breakdown (Top 10)</h3>
                  <p className="text-[11px] text-slate-500">
                    Top 10 programs comparison of within 10 days vs after 10 days batch closures
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
                    Closure Rate (%)
                  </button>
                  <button
                    onClick={() => setProgramMetric('volume')}
                    className={`px-2 py-0.5 rounded-md text-[11px] font-semibold cursor-pointer transition-all ${
                      programMetric === 'volume'
                        ? 'bg-white text-slate-900 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Batch Volume
                  </button>
                </div>
                <button
                  onClick={() => handleExportChartExcel('program', 'BatchClosure_Program_Wise_Top10_Breakdown', sorted_by_program)}
                  disabled={exportingChart === 'program'}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-600 hover:text-white transition-all cursor-pointer border border-emerald-200 disabled:opacity-60"
                  title="Export chart summary and underlying batch-level raw records to Excel for manual verification"
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



            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                {programMetric === 'rate' ? (
                  <BarChart data={sorted_by_program} margin={{ top: 32, right: 24, left: 6, bottom: 65 }} barGap={6} barCategoryGap="25%">
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="name" interval={0} height={65} tick={renderRotatedTick} />
                    <YAxis unit="%" domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748B' }} />
                    <Tooltip formatter={(val: any, name: any) => [`${Number(val).toFixed(1)}%`, name]} contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #BFDBFE', fontSize: '11px' }} />
                    <Legend iconSize={12} wrapperStyle={{ fontSize: '14px', fontWeight: 700, paddingTop: '12px' }} />
                    <Bar dataKey="within_10_pct" name="Closed Within 10 Days %" fill="#10B981" barSize={18} radius={[4, 4, 0, 0]}>
                      <LabelList dataKey="within_10_pct" position="top" formatter={(v: any) => (v ? `${Number(v).toFixed(1)}%` : '')} fill="#047857" fontSize={9.5} fontWeight={700} offset={6} />
                    </Bar>
                    <Bar dataKey="after_10_pct" name="Closed After 10 Days %" fill="#EF4444" barSize={18} radius={[4, 4, 0, 0]}>
                      <LabelList dataKey="after_10_pct" position="top" formatter={(v: any) => (v ? `${Number(v).toFixed(1)}%` : '')} fill="#B91C1C" fontSize={9.5} fontWeight={700} offset={6} />
                    </Bar>
                  </BarChart>
                ) : (
                  <BarChart data={sorted_by_program} margin={{ top: 32, right: 24, left: 6, bottom: 65 }} barGap={6} barCategoryGap="25%">
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="name" interval={0} height={65} tick={renderRotatedTick} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                    <Tooltip formatter={(val: any, name: any) => [`${val} batches`, name]} contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #BFDBFE', fontSize: '11px' }} />
                    <Legend iconSize={12} wrapperStyle={{ fontSize: '14px', fontWeight: 700, paddingTop: '12px' }} />
                    <Bar dataKey="within_10_days" name="Within 10 Days Batches" fill="#10B981" barSize={18} radius={[4, 4, 0, 0]}>
                      <LabelList dataKey="within_10_days" position="top" formatter={(v: any) => (v ? v : '')} fill="#047857" fontSize={9.5} fontWeight={700} offset={6} />
                    </Bar>
                    <Bar dataKey="after_10_days" name="After 10 Days Batches" fill="#EF4444" barSize={18} radius={[4, 4, 0, 0]}>
                      <LabelList dataKey="after_10_days" position="top" formatter={(v: any) => (v ? v : '')} fill="#B91C1C" fontSize={9.5} fontWeight={700} offset={6} />
                    </Bar>
                    <Bar dataKey="total_batches" name="Total Closed Batches" fill="#6366F1" barSize={18} radius={[4, 4, 0, 0]}>
                      <LabelList dataKey="total_batches" position="top" formatter={(v: any) => (v ? v : '')} fill="#4338CA" fontSize={9.5} fontWeight={700} offset={6} />
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
            <div className="bg-white w-full max-w-6xl h-[92vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
              <div className="flex items-center justify-between p-4 px-6 border-b border-slate-200 bg-slate-50 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <div className={`w-3.5 h-3.5 rounded-full ${fullscreenChart === 'rm' ? 'bg-indigo-600' : fullscreenChart === 'center' ? 'bg-cyan-600' : 'bg-emerald-600'}`} />
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <span>
                      {fullscreenChart === 'rm' && 'RM Wise Batch Closure Breakdown'}
                      {fullscreenChart === 'center' && 'Center Wise Batch Closure Breakdown'}
                      {fullscreenChart === 'program' && 'Program Wise Batch Closure Breakdown'}
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
                      Closure Rate (%)
                    </button>
                    <button
                      onClick={() => setMetric('volume')}
                      className={`px-2 py-0.5 rounded-md text-[11px] font-semibold cursor-pointer transition-all ${
                        currentMetric === 'volume'
                          ? 'bg-white text-slate-900 shadow-2xs font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Batch Volume
                    </button>
                  </div>
                  <button
                    onClick={() =>
                      handleExportChartExcel(
                        fullscreenChart,
                        fullscreenChart === 'rm'
                          ? 'BatchClosure_RM_Wise_Breakdown'
                          : fullscreenChart === 'center'
                          ? 'BatchClosure_Center_Wise_Top10_Breakdown'
                          : 'BatchClosure_Program_Wise_Top10_Breakdown',
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
              <div className="p-6 flex-1 min-h-0 bg-white flex flex-col space-y-4 overflow-y-auto">
                <div className="flex-1 min-h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    {currentMetric === 'rate' ? (
                      <BarChart data={modalData} margin={{ top: 32, right: 24, left: 6, bottom: 85 }} barGap={6} barCategoryGap="25%">
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                        <XAxis dataKey="name" interval={0} height={85} tick={renderRotatedTick} />
                        <YAxis unit="%" domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748B' }} />
                        <Tooltip formatter={(val: any, name: any) => [`${Number(val).toFixed(1)}%`, name]} contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #BFDBFE', fontSize: '11px' }} />
                        <Legend iconSize={13} wrapperStyle={{ fontSize: '15px', fontWeight: 700, paddingTop: '15px' }} />
                        <Bar dataKey="within_10_pct" name="Closed Within 10 Days %" fill="#10B981" barSize={22} radius={[4, 4, 0, 0]}>
                          <LabelList dataKey="within_10_pct" position="top" formatter={(v: any) => (v ? `${Number(v).toFixed(1)}%` : '')} fill="#047857" fontSize={10} fontWeight={700} offset={6} />
                        </Bar>
                        <Bar dataKey="after_10_pct" name="Closed After 10 Days %" fill="#EF4444" barSize={22} radius={[4, 4, 0, 0]}>
                          <LabelList dataKey="after_10_pct" position="top" formatter={(v: any) => (v ? `${Number(v).toFixed(1)}%` : '')} fill="#B91C1C" fontSize={10} fontWeight={700} offset={6} />
                        </Bar>
                      </BarChart>
                    ) : (
                      <BarChart data={modalData} margin={{ top: 32, right: 24, left: 6, bottom: 85 }} barGap={6} barCategoryGap="25%">
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                        <XAxis dataKey="name" interval={0} height={85} tick={renderRotatedTick} />
                        <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                        <Tooltip formatter={(val: any, name: any) => [`${val} batches`, name]} contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #BFDBFE', fontSize: '11px' }} />
                        <Legend iconSize={13} wrapperStyle={{ fontSize: '15px', fontWeight: 700, paddingTop: '15px' }} />
                        <Bar dataKey="within_10_days" name="Within 10 Days Batches" fill="#10B981" barSize={22} radius={[4, 4, 0, 0]}>
                          <LabelList dataKey="within_10_days" position="top" formatter={(v: any) => (v ? v : '')} fill="#047857" fontSize={10} fontWeight={700} offset={6} />
                        </Bar>
                        <Bar dataKey="after_10_days" name="After 10 Days Batches" fill="#EF4444" barSize={22} radius={[4, 4, 0, 0]}>
                          <LabelList dataKey="after_10_days" position="top" formatter={(v: any) => (v ? v : '')} fill="#B91C1C" fontSize={10} fontWeight={700} offset={6} />
                        </Bar>
                        <Bar dataKey="total_batches" name="Total Closed Batches" fill="#6366F1" barSize={22} radius={[4, 4, 0, 0]}>
                          <LabelList dataKey="total_batches" position="top" formatter={(v: any) => (v ? v : '')} fill="#4338CA" fontSize={10} fontWeight={700} offset={6} />
                        </Bar>
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 3. Batch Closure Analysis & Register */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3 pb-2 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#008C95]" />
              <h3 className="text-sm font-bold text-slate-900">
                Batch Closure Register ({filteredBatches.length} Batches)
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Difference between Batch End Date and Batch Actual End Date
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Filter Toggle Buttons */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-medium">
              <button
                onClick={() => setClosureFilter('all')}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  closureFilter === 'all'
                    ? 'bg-white text-slate-800 font-semibold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All ({allBatches.length})
              </button>
              <button
                onClick={() => setClosureFilter('within_10')}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                  closureFilter === 'within_10' || closureFilter === 'within_7'
                    ? 'bg-emerald-600 text-white font-semibold shadow-2xs'
                    : 'text-slate-600 hover:text-emerald-700'
                }`}
              >
                <CheckCircle2 className="w-3 h-3" />
                Within 10 Days ({kpis?.closed_within_10_days ?? kpis?.closed_within_7_days ?? 0})
              </button>
              <button
                onClick={() => setClosureFilter('after_10')}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                  closureFilter === 'after_10' || closureFilter === 'after_7'
                    ? 'bg-rose-600 text-white font-semibold shadow-2xs'
                    : 'text-slate-600 hover:text-rose-700'
                }`}
              >
                <AlertTriangle className="w-3 h-3" />
                After 10 Days ({kpis?.closed_after_10_days ?? kpis?.closed_after_7_days ?? 0})
              </button>
              <button
                onClick={() => setClosureFilter('ilt_gte_120')}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                  closureFilter === 'ilt_gte_120'
                    ? 'bg-blue-600 text-white font-semibold shadow-2xs'
                    : 'text-slate-600 hover:text-blue-700'
                }`}
              >
                <Award className="w-3 h-3" />
                ILT ≥ 120% ({kpis?.closed_batches_ilt_gte_120 ?? kpis?.closed_batches_ilt_gte_110 ?? 0})
              </button>
              <button
                onClick={() => setClosureFilter('ilt_lt_120')}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                  closureFilter === 'ilt_lt_120'
                    ? 'bg-amber-600 text-white font-semibold shadow-2xs'
                    : 'text-slate-600 hover:text-amber-700'
                }`}
              >
                <Percent className="w-3 h-3" />
                ILT &lt; 120% ({kpis?.closed_batches_ilt_lt_120 ?? kpis?.closed_batches_ilt_lt_110 ?? 0})
              </button>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search batch or center..."
                className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:outline-hidden focus:ring-1 focus:ring-[#008C95]"
              />
            </div>
            <button
              onClick={exportClosureCsv}
              className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-100 text-[11px] font-bold text-slate-600 uppercase border-b border-slate-200">
              <tr>
                <th className="px-3 py-3">Batch Code</th>
                <th className="px-3 py-3">Center</th>
                <th className="px-3 py-3">Program</th>
                <th className="px-3 py-3">Trainer</th>
                <th className="px-3 py-3">Planned End</th>
                <th className="px-3 py-3">Actual End</th>
                <th className="px-3 py-3 text-center">Closure Timing</th>
                <th className="px-3 py-3 text-right">Delay / Variance</th>
                <th className="px-3 py-3 text-right">ILT Completion</th>
                <th className="px-3 py-3">Batch Status</th>
                <th className="px-3 py-3">Validation Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredBatches.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-3 py-6 text-center text-slate-400">
                    No batches found matching current filters.
                  </td>
                </tr>
              ) : (
                filteredBatches.map((b: any) => {
                  const isWithin10 = b.is_within_10_days !== undefined
                    ? b.is_within_10_days
                    : (b.is_within_7_days !== undefined ? b.is_within_7_days : (b.delay_days !== undefined && b.delay_days <= 10));
                  return (
                    <tr
                      key={b.batch_code}
                      className={`hover:bg-slate-50/70 ${
                        isWithin10 ? 'hover:bg-emerald-50/20' : 'hover:bg-rose-50/20'
                      }`}
                    >
                      <td className="px-3 py-2.5 font-mono font-bold text-slate-900">{b.batch_code}</td>
                      <td className="px-3 py-2.5 font-semibold text-slate-800">{b.center_code}</td>
                      <td className="px-3 py-2.5 text-slate-600">{b.program_name}</td>
                      <td className="px-3 py-2.5 text-slate-700">{b.assigned_trainers}</td>
                      <td className="px-3 py-2.5 text-slate-600">{b.batch_end_date}</td>
                      <td className="px-3 py-2.5 text-slate-800 font-medium">{b.batch_actual_end_date}</td>
                      <td className="px-3 py-2.5 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${
                            isWithin10
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : 'bg-rose-100 text-rose-800 border border-rose-200'
                          }`}
                        >
                          {isWithin10 ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Within 10 Days
                            </>
                          ) : (
                            <>
                              <AlertTriangle className="w-3 h-3 text-rose-600" />
                              After 10 Days
                            </>
                          )}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {b.delay_days <= 0 ? (
                          <span className="px-2 py-0.5 rounded font-mono font-medium text-xs bg-slate-100 text-slate-600">
                            On Time ({b.delay_days}d)
                          </span>
                        ) : isWithin10 ? (
                          <span className="px-2 py-0.5 rounded font-mono font-bold text-xs bg-emerald-100 text-emerald-700">
                            +{b.delay_days} days
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded font-mono font-bold text-xs bg-rose-100 text-rose-700">
                            +{b.delay_days} days
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono">
                        {b.ilt_pct != null ? (
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                              b.ilt_pct >= 120
                                ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                : 'bg-amber-100 text-amber-800 border border-amber-200'
                            }`}
                          >
                            {b.ilt_pct}%
                          </span>
                        ) : (
                          <span className="text-slate-400 font-normal text-xs">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 capitalize">{b.batch_status}</td>
                      <td className="px-3 py-2.5">{b.batch_validation_status}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
