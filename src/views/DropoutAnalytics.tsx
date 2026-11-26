import React, { useState, useEffect } from 'react';
import { consolidateUpvanDharClient } from '../utils/diyaConsolidation';
import {
  UserX,
  TrendingDown,
  Building2,
  BookOpen,
  Users,
  Download,
  Filter,
  Search,
  ChevronRight,
  UserCheck,
  RotateCcw,
  Layers,
  Activity,
  GraduationCap,
  CheckCircle2,
  Award,
  Percent,
  BarChart3,
  X,
  MapPin,
  Briefcase,
  Maximize2,
  Minimize2,
  Clock,
  RefreshCw
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
  AreaChart,
  Area,
  LabelList
} from 'recharts';
import { SourceRow, FilterParams, FilterOptions } from '../types';
import { ProgramMultiSelect } from '../components/ProgramMultiSelect';
import { RmMultiSelect } from '../components/RmMultiSelect';
import { CenterMultiSelect } from '../components/CenterMultiSelect';
import { getScopedFilterOptions, isCollegeModelProgram } from '../utils/filterHierarchy';
import { api } from '../api';

interface DropoutAnalyticsProps {
  data: any;
  loading: boolean;
  filters?: FilterParams;
  filterOptions?: FilterOptions;
  onFilterChange?: (newFilters: FilterParams) => void;
  onSelectCenterDrilldown: (center: string) => void;
  onSelectRecord: (record: SourceRow) => void;
  onOpenPresenter?: (charts?: any[], startIndex?: number) => void;
}

const TYPE_COLORS = {
  initial: '#38BDF8',   // Light Sky Blue
  regular: '#1D4ED8',   // Royal / Deep Blue
  trained: '#60A5FA',   // Bright Ocean Blue
  active: '#93C5FD',    // Soft Powder Blue
  overall: '#2563EB',   // Classic Blue
};

const renderRotatedTick = (props: any) => {
  const { x, y, payload } = props;
  const raw = payload?.value || '';
  const text = String(raw);
  const formatted = text.length > 15 ? `${text.slice(0, 14)}…` : text;
  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0}
        y={0}
        dy={14}
        dx={-6}
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

export const DropoutAnalytics: React.FC<DropoutAnalyticsProps> = ({
  data,
  loading,
  filters = {},
  filterOptions,
  onFilterChange,
  onSelectCenterDrilldown,
  onSelectRecord,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeChartTab, setActiveChartTab] = useState<'all' | 'breakdowns' | 'rm' | 'center' | 'program' | 'rates' | 'lifecycle'>('all');
  const [breakdownMetric, setBreakdownMetric] = useState<'rate' | 'volume'>('rate');
  const [centerDisplayMode, setCenterDisplayMode] = useState<'split' | 'total'>('split');
  const [fullscreenChart, setFullscreenChart] = useState<'rm' | 'center' | 'program' | 'rates' | 'lifecycle' | null>(null);
  const [exportingChart, setExportingChart] = useState<string | null>(null);

  const handleExportChartExcel = async (
    chartType: 'rm' | 'center' | 'program' | 'rates' | 'lifecycle' | 'all',
    chartTitle: string,
    chartSummary: any[]
  ) => {
    try {
      setExportingChart(chartType);
      await api.exportChartRawExcel({
        module: 'dropout',
        chartType,
        chartTitle,
        filters: filters || {},
        chartSummary,
      });
    } catch (err) {
      console.error('Failed to export Dropout chart raw data:', err);
    } finally {
      setExportingChart(null);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setFullscreenChart(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const currentProgramType = filters.programType || 'Diya and Deeptech';
  const currentRmShZh = filters.rmShZh || 'ALL';
  const currentCenterCode = filters.centerCode || 'ALL';
  const currentProgramName = filters.programName || 'ALL';

  const scopedOptions = getScopedFilterOptions(filterOptions, filters);

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

  const handleProgramNameChange = (val: string) => {
    handleProgramsChange(val === 'ALL' || !val ? [] : [val]);
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

  if (loading && !data) {
    return (
      <div className="p-8 text-center text-xs text-slate-500">
        <div className="animate-spin w-6 h-6 border-2 border-[#008C95] border-t-transparent rounded-full mx-auto mb-2"></div>
        Loading Dropout &amp; Training Analytics...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 text-center text-xs text-slate-500">
        No dropout data available.
      </div>
    );
  }

  const {
    kpis,
    trend = [],
    by_program = [],
    by_center = [],
    by_rm = [],
    center_table = []
  } = data;

  // Ensure all breakdowns are sorted from highest to lowest based on dropout %
  const raw_by_rm = consolidateUpvanDharClient(by_rm || [], currentProgramType);
  const sorted_by_rm = [...raw_by_rm]
    .map((r: any) => ({
      ...r,
      name: r.name || r.rm_sh_zh || 'Unknown',
      students: Number(r.students) || 0,
      initial_dropout_rate: Number(r.initial_dropout_rate) || 0,
      regular_dropout_rate: Number(r.regular_dropout_rate) || 0,
      total_dropout_rate: Number(((Number(r.initial_dropout_rate) || 0) + (Number(r.regular_dropout_rate) || 0)).toFixed(2)),
      initial_dropouts: Number(r.initial_dropouts) || 0,
      regular_dropouts: Number(r.regular_dropouts) || 0,
      total_dropouts: (Number(r.initial_dropouts) || 0) + (Number(r.regular_dropouts) || 0),
      dropout_rate: Number(r.dropout_rate) || 0,
      dropouts: Number(r.dropouts) || 0,
    }))
    .sort((a: any, b: any) => (Number(b.dropout_rate) || 0) - (Number(a.dropout_rate) || 0) || (Number(b.dropouts) || 0) - (Number(a.dropouts) || 0));

  const renderRmTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    const rmData = payload[0]?.payload || {};
    const totalStudents = Number(rmData.students) || 0;
    const initDropouts = Number(rmData.initial_dropouts) || 0;
    const regDropouts = Number(rmData.regular_dropouts) || 0;
    const totDropouts = Number(rmData.total_dropouts) || (initDropouts + regDropouts);
    const isRateMode = breakdownMetric === 'rate';

    return (
      <div className="bg-white p-3 rounded-lg border border-blue-200 shadow-md text-[11px] space-y-1.5 min-w-[205px]">
        <div className="font-bold text-slate-900 border-b border-slate-100 pb-1">
          {label || rmData.name}
        </div>
        <div className="font-semibold text-slate-800">
          Total Students : {totalStudents.toLocaleString()} students
        </div>
        {isRateMode ? (
          <>
            <div style={{ color: '#38BDF8' }} className="font-medium">
              Initial Dropout % : {Number(rmData.initial_dropout_rate || 0).toFixed(2)}% ({initDropouts.toLocaleString()} students)
            </div>
            <div style={{ color: '#1D4ED8' }} className="font-medium">
              Regular Dropout % : {Number(rmData.regular_dropout_rate || 0).toFixed(2)}% ({regDropouts.toLocaleString()} students)
            </div>
            <div style={{ color: '#EF4444' }} className="font-medium">
              Total Dropout % : {Number(rmData.total_dropout_rate || 0).toFixed(2)}% ({totDropouts.toLocaleString()} students)
            </div>
          </>
        ) : (
          <>
            <div style={{ color: '#38BDF8' }} className="font-medium">
              Initial Dropouts : {initDropouts.toLocaleString()} students
            </div>
            <div style={{ color: '#1D4ED8' }} className="font-medium">
              Regular Dropouts : {regDropouts.toLocaleString()} students
            </div>
            <div style={{ color: '#EF4444' }} className="font-medium">
              Total Dropouts : {totDropouts.toLocaleString()} students
            </div>
          </>
        )}
      </div>
    );
  };

  // Normalize by_center to ensure name, center_code, numeric fields, and non-empty fallback
  const rawCenterList = (by_center && by_center.length > 0)
    ? by_center
    : (center_table && center_table.length > 0 ? center_table.slice(0, 10) : []);

  const sorted_by_center = rawCenterList
    .map((c: any) => {
      const cName = c.name || c.center_code || 'Unknown';
      const initDrop = Number(c.initial_dropouts) || 0;
      const regDrop = Number(c.regular_dropouts) || 0;
      const totDrop = Number(c.dropouts) || (initDrop + regDrop);
      const initRate = Number(c.initial_dropout_rate) || 0;
      const regRate = Number(c.regular_dropout_rate) || 0;
      const totRate = Number(c.dropout_rate) || (c.students > 0 ? Number(((totDrop / c.students) * 100).toFixed(1)) : 0);

      return {
        ...c,
        name: cName,
        center_code: c.center_code || cName,
        initial_dropouts: initDrop,
        regular_dropouts: regDrop,
        total_dropouts: totDrop,
        initial_dropout_rate: initRate,
        regular_dropout_rate: regRate,
        total_dropout_rate: Number((initRate + regRate).toFixed(2)),
        dropout_rate: totRate,
        students: Number(c.students) || 0,
        trained_students: Number(c.trained_students) || 0,
        trained_rate: Number(c.trained_rate) || 0,
      };
    })
    .sort((a: any, b: any) => {
      if (breakdownMetric === 'volume') {
        return (b.dropouts - a.dropouts) || (b.dropout_rate - a.dropout_rate);
      }
      return (b.dropout_rate - a.dropout_rate) || (b.dropouts - a.dropouts);
    });

  const sorted_by_program = [...by_program]
    .map((p: any) => ({
      ...p,
      name: p.name || p.program_name || 'Unassigned',
      initial_dropout_rate: Number(p.initial_dropout_rate) || 0,
      regular_dropout_rate: Number(p.regular_dropout_rate) || 0,
      total_dropout_rate: Number(((Number(p.initial_dropout_rate) || 0) + (Number(p.regular_dropout_rate) || 0)).toFixed(2)),
      initial_dropouts: Number(p.initial_dropouts) || 0,
      regular_dropouts: Number(p.regular_dropouts) || 0,
      total_dropouts: (Number(p.initial_dropouts) || 0) + (Number(p.regular_dropouts) || 0),
      dropout_rate: Number(p.dropout_rate) || 0,
      dropouts: Number(p.dropouts) || 0,
    }))
    .sort((a: any, b: any) => (Number(b.dropout_rate) || 0) - (Number(a.dropout_rate) || 0) || (Number(b.dropouts) || 0) - (Number(a.dropouts) || 0));

  const filteredCenters = center_table
    .filter((c: any) => (c.center_code || '').toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a: any, b: any) => (Number(b.dropout_rate) || 0) - (Number(a.dropout_rate) || 0) || (Number(b.dropouts) || 0) - (Number(a.dropouts) || 0));

  // Student Lifecycle Outcome Composition Data
  const activeInTraining = Math.max(0, (kpis.total_students || 0) - (kpis.total_trained || 0) - (kpis.total_dropouts || 0));
  const outcomeComposition = [
    { name: 'Total Trained', value: kpis.total_trained || 0, color: TYPE_COLORS.trained },
    { name: 'Regular Session Dropout', value: kpis.regular_session_dropouts || 0, color: TYPE_COLORS.regular },
    { name: 'Initial Session Dropout', value: kpis.initial_session_dropouts || 0, color: TYPE_COLORS.initial },
    ...(activeInTraining > 0 ? [{ name: 'In-Training / Active', value: activeInTraining, color: TYPE_COLORS.active }] : [])
  ].filter(d => d.value > 0);

  const exportCenterCsv = () => {
    if (!filteredCenters || filteredCenters.length === 0) return;
    const headers = [
      'Center Code',
      'Total Students',
      'Total Trained',
      'Trained Rate %',
      'Total Dropouts',
      'Dropout Rate %',
      'Initial Session Dropouts',
      'Initial Dropout %',
      'Regular Session Dropouts',
      'Regular Dropout %',
      'Batches'
    ];
    const csvRows = [
      headers.join(','),
      ...filteredCenters.map((c: any) => {
        const initRate = c.students > 0 ? ((c.initial_dropouts || 0) / c.students * 100).toFixed(1) : '0';
        const regRate = c.students > 0 ? ((c.regular_dropouts || 0) / c.students * 100).toFixed(1) : '0';
        const trCount = c.trained_students ?? Math.max(0, (c.students || 0) - (c.dropouts || 0));
        const trRate = c.students > 0 ? ((trCount / c.students) * 100).toFixed(1) : '0';
        return [
          `"${c.center_code || ''}"`,
          c.students || 0,
          trCount,
          `${trRate}%`,
          c.dropouts || 0,
          `${c.dropout_rate || 0}%`,
          c.initial_dropouts || 0,
          `${initRate}%`,
          c.regular_dropouts || 0,
          `${regRate}%`,
          c.batches || 0,
        ].join(',');
      })
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Dropout_Trained_Analytics_Center_Summary_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header & Combined Filters: Center Code, Program Name, RM wise, Program Type */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-3.5 relative z-30">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center flex-wrap gap-2">
              <h2 className="text-base font-bold text-slate-900">Dropout &amp; Training Analytics</h2>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-[#E6F4F5] text-[#005F66] border border-[#CCECF0]">
                {currentProgramType}
              </span>
              {currentRmShZhs.length > 0 && (
                <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  <UserCheck className="w-3 h-3" />
                  <span>
                    {currentRmShZhs.length === 1
                      ? `RM: ${currentRmShZhs[0]}`
                      : `RMs: ${currentRmShZhs.length} selected`}
                  </span>
                  <button
                    onClick={() => handleRmsChange([])}
                    className="ml-0.5 hover:text-indigo-900 cursor-pointer"
                    title="Clear RM filter"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {currentCenterCodes.length > 0 && (
                <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full font-semibold bg-cyan-50 text-cyan-800 border border-cyan-200">
                  <Building2 className="w-3 h-3" />
                  <span>
                    {currentCenterCodes.length === 1
                      ? `Center: ${currentCenterCodes[0]}`
                      : `Centers: ${currentCenterCodes.length} selected`}
                  </span>
                  <button
                    onClick={() => handleCentersChange([])}
                    className="ml-0.5 hover:text-cyan-950 cursor-pointer"
                    title="Clear Center filter"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {currentProgramNames.filter((p) => !isCollegeModelProgram(p)).length > 0 && (() => {
                const ownSelected = currentProgramNames.filter((p) => !isCollegeModelProgram(p));
                const collegeSelected = currentProgramNames.filter((p) => isCollegeModelProgram(p));
                return (
                  <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                    <BookOpen className="w-3 h-3" />
                    <span>
                      {ownSelected.length === 1
                        ? `Program (Own): ${ownSelected[0]}`
                        : `Program (Own): ${ownSelected.length} selected`}
                    </span>
                    <button
                      onClick={() => handleProgramsChange(collegeSelected)}
                      className="ml-0.5 hover:text-emerald-950 cursor-pointer"
                      title="Clear Program (Own) filter"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                );
              })()}
              {currentProgramNames.filter((p) => isCollegeModelProgram(p)).length > 0 && (() => {
                const ownSelected = currentProgramNames.filter((p) => !isCollegeModelProgram(p));
                const collegeSelected = currentProgramNames.filter((p) => isCollegeModelProgram(p));
                return (
                  <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full font-semibold bg-indigo-50 text-indigo-800 border border-indigo-200">
                    <BookOpen className="w-3 h-3" />
                    <span>
                      {collegeSelected.length === 1
                        ? `Program (College Model Only): ${collegeSelected[0]}`
                        : `Program (College Model Only): ${collegeSelected.length} selected`}
                    </span>
                    <button
                      onClick={() => handleProgramsChange(ownSelected)}
                      className="ml-0.5 hover:text-indigo-950 cursor-pointer"
                      title="Clear Program (College Model Only) filter"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                );
              })()}
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
              Interactive insights across RM, Center, Program, and Cohort Timeline
            </p>
          </div>

          {/* Program Type Filter Options */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200 self-start md:self-auto shrink-0">
            {[
              { id: 'Diya and Deeptech', label: 'Diya and Deeptech', tooltip: 'Combined dataset of Diya and Deep Tech' },
              { id: 'Diya Only', label: 'Diya Only', tooltip: 'Diya programs only (strictly excludes all Deep Tech numbers)' },
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

          {/* Center Code Multi-Select Filter with embedded Program selection */}
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

      {/* 1. Dropout & Trained KPI Cards (Separate Count & % Cards) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9 gap-2.5">
        {/* Total Students */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Students</span>
          <div className="text-lg sm:text-xl font-bold font-mono text-slate-900 mt-1 tabular-nums">
            {kpis.total_students.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Enrolled Students (Excluding Dropouts)</div>
        </div>

        {/* Total Trained Count */}
        <div className="bg-white p-3.5 rounded-xl border border-blue-200/90 bg-blue-50/20 shadow-xs">
          <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider">Total Trained</span>
          <div className="text-lg sm:text-xl font-bold font-mono text-blue-600 mt-1 tabular-nums">
            {(kpis.total_trained || 0).toLocaleString()}
          </div>
          <div className="text-[10px] text-blue-600/80 mt-0.5">Batch Complete &bull; Enrolled &bull; Marks &ge; 50</div>
        </div>

        {/* Total Trained % */}
        <div className="bg-white p-3.5 rounded-xl border border-blue-200/90 bg-blue-50/20 shadow-xs">
          <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider">Total Trained %</span>
          <div className="text-lg sm:text-xl font-bold font-mono text-blue-600 mt-1 tabular-nums">
            {kpis.trained_rate ?? 0}%
          </div>
          <div className="text-[10px] text-blue-600/80 mt-0.5">Trained / Total</div>
        </div>

        {/* Overall Dropouts */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Overall Dropouts</span>
          <div className="text-lg sm:text-xl font-bold font-mono text-blue-700 mt-1 tabular-nums">
            {kpis.total_dropouts.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Total Dropped</div>
        </div>

        {/* Overall Dropout % */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Overall Dropout %</span>
          <div className="text-lg sm:text-xl font-bold font-mono text-blue-700 mt-1 tabular-nums">
            {kpis.dropout_rate}%
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Dropouts / Total</div>
        </div>

        {/* Initial Session Dropout Count */}
        <div className="bg-white p-3.5 rounded-xl border border-sky-200/90 bg-sky-50/20 shadow-xs">
          <span className="text-[10px] font-bold text-sky-800 uppercase tracking-wider">Initial Dropouts</span>
          <div className="text-lg sm:text-xl font-bold font-mono text-sky-600 mt-1 tabular-nums">
            {kpis.initial_session_dropouts.toLocaleString()}
          </div>
          <div className="text-[10px] text-sky-600/80 mt-0.5">Early Stage Count</div>
        </div>

        {/* Initial Session Dropout % */}
        <div className="bg-white p-3.5 rounded-xl border border-sky-200/90 bg-sky-50/20 shadow-xs">
          <span className="text-[10px] font-bold text-sky-800 uppercase tracking-wider">Initial Dropout %</span>
          <div className="text-lg sm:text-xl font-bold font-mono text-sky-600 mt-1 tabular-nums">
            {kpis.initial_dropout_rate ?? 0}%
          </div>
          <div className="text-[10px] text-sky-600/80 mt-0.5">Initial / Total</div>
        </div>

        {/* Regular Session Dropout Count */}
        <div className="bg-white p-3.5 rounded-xl border border-blue-200/90 bg-blue-50/30 shadow-xs">
          <span className="text-[10px] font-bold text-blue-900 uppercase tracking-wider">Regular Dropouts</span>
          <div className="text-lg sm:text-xl font-bold font-mono text-blue-800 mt-1 tabular-nums">
            {kpis.regular_session_dropouts.toLocaleString()}
          </div>
          <div className="text-[10px] text-blue-700/80 mt-0.5">Mid-Course Count</div>
        </div>

        {/* Regular Session Dropout % */}
        <div className="bg-white p-3.5 rounded-xl border border-blue-200/90 bg-blue-50/30 shadow-xs">
          <span className="text-[10px] font-bold text-blue-900 uppercase tracking-wider">Regular Dropout %</span>
          <div className="text-lg sm:text-xl font-bold font-mono text-blue-800 mt-1 tabular-nums">
            {kpis.regular_dropout_rate ?? 0}%
          </div>
          <div className="text-[10px] text-blue-700/80 mt-0.5">Regular / Total</div>
        </div>
      </div>

      {/* Chart Category Switcher Tabs */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100/90 rounded-xl border border-slate-200/80 max-w-fit overflow-x-auto">
          {[
            { id: 'all', label: 'All Charts', icon: Layers },
            { id: 'rm', label: 'RM Wise', icon: Users, color: 'text-indigo-600' },
            { id: 'center', label: 'Center Wise', icon: Building2, color: 'text-cyan-600' },
            { id: 'program', label: 'Program Wise', icon: BookOpen, color: 'text-emerald-600' },
            { id: 'rates', label: 'Monthly Rates Trend', icon: TrendingDown, color: 'text-violet-600' },
            { id: 'lifecycle', label: 'Trained & Lifecycle', icon: GraduationCap, color: 'text-emerald-600' },
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
            onClick={() => setBreakdownMetric('rate')}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer transition-all ${
              breakdownMetric === 'rate'
                ? 'bg-white text-slate-900 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Percentages (%)
          </button>
          <button
            onClick={() => setBreakdownMetric('volume')}
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

      {/* ========================================================================= */}
      {/* 2. THREE CORE BREAKDOWNS: RM WISE, CENTER WISE & PROGRAM WISE             */}
      {/* ========================================================================= */}
      <div className="space-y-6">
        {/* --- RM WISE CHART SECTION --- */}
        {(activeChartTab === 'all' || activeChartTab === 'rm') && (
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-indigo-600"></div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">RM Wise Dropout &amp; Retention Breakdown</h3>
                  <p className="text-[11px] text-slate-500">
                    Regional Manager comparison of Initial Session vs. Regular Session attrition and completion
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs font-medium flex-wrap">
                <span className="inline-flex items-center gap-1.5 text-sm text-sky-700 font-bold">
                  <span className="w-3 h-3 rounded-xs bg-sky-400"></span> Initial Session
                </span>
                <span className="inline-flex items-center gap-1.5 text-sm text-blue-900 font-bold">
                  <span className="w-3 h-3 rounded-xs bg-blue-700"></span> Regular Session
                </span>
                <span className="inline-flex items-center gap-1.5 text-sm text-blue-600 font-bold">
                  <span className="w-3 h-3 rounded-xs bg-blue-500"></span> Total Trained
                </span>
                <button
                  onClick={() => handleExportChartExcel('rm', 'Dropout_RM_Wise_Breakdown', sorted_by_rm)}
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* RM Column Chart */}
              <div className="lg:col-span-2 h-[460px]">
                <ResponsiveContainer width="100%" height="100%">
                  {breakdownMetric === 'rate' ? (
                    <BarChart data={sorted_by_rm} margin={{ top: 32, right: 24, left: 6, bottom: 65 }} barGap={6} barCategoryGap="25%">
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis
                        dataKey="name"
                        interval={0}
                        height={65}
                        tick={renderRotatedTick}
                      />
                      <YAxis
                        unit="%"
                        domain={[0, (dataMax: number) => Math.max(10, Math.ceil(dataMax * 1.35 + 2))]}
                        tick={{ fontSize: 11, fill: '#64748B' }}
                      />
                      <Tooltip content={renderRmTooltip} />
                      <Legend iconSize={12} wrapperStyle={{ fontSize: '14px', fontWeight: 700, paddingTop: '12px' }} />
                      <Bar dataKey="initial_dropout_rate" name="Initial Dropout %" fill="#38BDF8" barSize={18} radius={[4, 4, 0, 0]}>
                        <LabelList
                          dataKey="initial_dropout_rate"
                          position="top"
                          formatter={(v: any) => (v && Number(v) > 0 ? `${Number(v).toFixed(2)}%` : '')}
                          fill="#0284C7"
                          fontSize={9.5}
                          fontWeight={700}
                          offset={6}
                        />
                      </Bar>
                      <Bar dataKey="regular_dropout_rate" name="Regular Dropout %" fill="#1D4ED8" barSize={18} radius={[4, 4, 0, 0]}>
                        <LabelList
                          dataKey="regular_dropout_rate"
                          position="top"
                          formatter={(v: any) => (v && Number(v) > 0 ? `${Number(v).toFixed(2)}%` : '')}
                          fill="#1E40AF"
                          fontSize={9.5}
                          fontWeight={700}
                          offset={6}
                        />
                      </Bar>
                      <Bar dataKey="total_dropout_rate" name="Total Dropout %" fill="#EF4444" barSize={18} radius={[4, 4, 0, 0]}>
                        <LabelList
                          dataKey="total_dropout_rate"
                          position="top"
                          formatter={(v: any) => (v && Number(v) > 0 ? `${Number(v).toFixed(2)}%` : '')}
                          fill="#B91C1C"
                          fontSize={9.5}
                          fontWeight={700}
                          offset={6}
                        />
                      </Bar>
                    </BarChart>
                  ) : (
                    <BarChart data={sorted_by_rm} margin={{ top: 32, right: 24, left: 6, bottom: 65 }} barGap={6} barCategoryGap="25%">
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis
                        dataKey="name"
                        interval={0}
                        height={65}
                        tick={renderRotatedTick}
                      />
                      <YAxis
                        domain={[0, (dataMax: number) => Math.max(10, Math.ceil(dataMax * 1.3 + 2))]}
                        tick={{ fontSize: 11, fill: '#64748B' }}
                      />
                      <Tooltip content={renderRmTooltip} />
                      <Legend iconSize={12} wrapperStyle={{ fontSize: '14px', fontWeight: 700, paddingTop: '12px' }} />
                      <Bar dataKey="initial_dropouts" name="Initial Dropouts" fill="#38BDF8" barSize={18} radius={[4, 4, 0, 0]}>
                        <LabelList
                          dataKey="initial_dropouts"
                          position="top"
                          formatter={(v: any) => (v && Number(v) > 0 ? v.toLocaleString() : '')}
                          fill="#0284C7"
                          fontSize={9.5}
                          fontWeight={700}
                          offset={6}
                        />
                      </Bar>
                      <Bar dataKey="regular_dropouts" name="Regular Dropouts" fill="#1D4ED8" barSize={18} radius={[4, 4, 0, 0]}>
                        <LabelList
                          dataKey="regular_dropouts"
                          position="top"
                          formatter={(v: any) => (v && Number(v) > 0 ? v.toLocaleString() : '')}
                          fill="#1E40AF"
                          fontSize={9.5}
                          fontWeight={700}
                          offset={6}
                        />
                      </Bar>
                      <Bar dataKey="total_dropouts" name="Total Dropouts" fill="#EF4444" barSize={18} radius={[4, 4, 0, 0]}>
                        <LabelList
                          dataKey="total_dropouts"
                          position="top"
                          formatter={(v: any) => (v && Number(v) > 0 ? v.toLocaleString() : '')}
                          fill="#B91C1C"
                          fontSize={9.5}
                          fontWeight={700}
                          offset={6}
                        />
                      </Bar>
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>

              {/* RM Summary Card List with click-to-filter */}
              <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  RM Performance Ranking ({sorted_by_rm.length})
                </span>
                {sorted_by_rm.map((rm: any, idx: number) => (
                  <button
                    key={`${rm.name}_${idx}`}
                    onClick={() => handleRmShZhChange(rm.name === currentRmShZh ? 'ALL' : rm.name)}
                    className={`w-full text-left p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                      currentRmShZh === rm.name
                        ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-200'
                        : 'bg-slate-50/70 hover:bg-slate-100 border-slate-200/70'
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-900 truncate">{rm.name}</span>
                        {currentRmShZh === rm.name && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-600 text-white font-semibold">Active Filter</span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-2">
                        <span>Students: <b>{rm.students.toLocaleString()}</b></span>
                        <span>•</span>
                        <span className="text-blue-700 font-semibold">Trained: {rm.trained_rate}%</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs font-mono font-bold text-blue-700">{rm.dropout_rate}%</div>
                      <div className="text-[10px] text-slate-400 font-mono">{rm.dropouts} dropouts</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* --- CENTER WISE CHART SECTION --- */}
        {(activeChartTab === 'all' || activeChartTab === 'center') && (
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-sky-600"></div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Center Wise Dropout Analysis (Top Centers)</h3>
                  <p className="text-[11px] text-slate-500">
                    Highest dropout volume centers with initial vs regular session distribution &amp; quick drill-down
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs font-medium flex-wrap">
                <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg border border-slate-200 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setCenterDisplayMode('split')}
                    className={`px-2 py-0.5 rounded-md font-semibold cursor-pointer transition-all ${
                      centerDisplayMode === 'split'
                        ? 'bg-white text-slate-900 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Split (Initial vs Regular)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCenterDisplayMode('total')}
                    className={`px-2 py-0.5 rounded-md font-semibold cursor-pointer transition-all ${
                      centerDisplayMode === 'total'
                        ? 'bg-white text-slate-900 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Total Dropouts
                  </button>
                </div>

                {centerDisplayMode === 'split' ? (
                  <>
                    <span className="inline-flex items-center gap-1.5 text-sm text-sky-700 font-bold">
                      <span className="w-3 h-3 rounded-xs bg-sky-400"></span> Initial Dropouts
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-sm text-blue-900 font-bold">
                      <span className="w-3 h-3 rounded-xs bg-blue-700"></span> Regular Dropouts
                    </span>
                  </>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-sm text-rose-700 font-bold">
                    <span className="w-3 h-3 rounded-xs bg-rose-500"></span> Overall Dropouts
                  </span>
                )}

                <button
                  onClick={() => handleExportChartExcel('center', 'Dropout_Center_Wise_Top10_Breakdown', sorted_by_center)}
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Center Column Chart */}
              <div className="lg:col-span-2 min-w-0 w-full h-[460px] relative">
                {sorted_by_center.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                    <Building2 className="w-10 h-10 text-slate-300 mb-2" />
                    <p className="text-sm font-semibold text-slate-700">No Center Dropout Data Available</p>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm">No centers match the current filter selection. Try adjusting your filter parameters.</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%" minWidth={280} minHeight={380}>
                    {breakdownMetric === 'rate' ? (
                      <BarChart data={sorted_by_center} margin={{ top: 32, right: 24, left: 6, bottom: 65 }} barGap={6} barCategoryGap="20%">
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                        <XAxis
                          dataKey="name"
                          interval={0}
                          height={65}
                          tick={renderRotatedTick}
                        />
                        <YAxis
                          unit="%"
                          domain={[0, (dataMax: number) => {
                            const max = Number(dataMax) || 0;
                            return max > 0 ? Math.ceil(max * 1.25 + 2) : 25;
                          }]}
                          tick={{ fontSize: 11, fill: '#64748B' }}
                        />
                        <Tooltip
                          formatter={(val: any, name: any) => [`${Number(val).toFixed(2)}%`, name]}
                          contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #BFDBFE', fontSize: '11px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                        <Legend iconSize={12} wrapperStyle={{ fontSize: '14px', fontWeight: 700, paddingTop: '12px' }} />
                        {centerDisplayMode === 'split' ? (
                          <>
                            <Bar dataKey="initial_dropout_rate" name="Initial Dropout %" fill="#38BDF8" maxBarSize={36} radius={[4, 4, 0, 0]} isAnimationActive={false}>
                              <LabelList
                                dataKey="initial_dropout_rate"
                                position="top"
                                formatter={(v: any) => (v && Number(v) > 0 ? `${Number(v).toFixed(2)}%` : '')}
                                fill="#0284C7"
                                fontSize={9.5}
                                fontWeight={700}
                                offset={6}
                              />
                            </Bar>
                            <Bar dataKey="regular_dropout_rate" name="Regular Dropout %" fill="#1D4ED8" maxBarSize={36} radius={[4, 4, 0, 0]} isAnimationActive={false}>
                              <LabelList
                                dataKey="regular_dropout_rate"
                                position="top"
                                formatter={(v: any) => (v && Number(v) > 0 ? `${Number(v).toFixed(2)}%` : '')}
                                fill="#1E40AF"
                                fontSize={9.5}
                                fontWeight={700}
                                offset={6}
                              />
                            </Bar>
                            <Bar dataKey="total_dropout_rate" name="Total Dropout %" fill="#EF4444" maxBarSize={36} radius={[4, 4, 0, 0]} isAnimationActive={false}>
                              <LabelList
                                dataKey="total_dropout_rate"
                                position="top"
                                formatter={(v: any) => (v && Number(v) > 0 ? `${Number(v).toFixed(2)}%` : '')}
                                fill="#B91C1C"
                                fontSize={9.5}
                                fontWeight={700}
                                offset={6}
                              />
                            </Bar>
                          </>
                        ) : (
                          <Bar dataKey="dropout_rate" name="Total Dropout %" fill="#F43F5E" maxBarSize={36} radius={[4, 4, 0, 0]} isAnimationActive={false}>
                            <LabelList
                              dataKey="dropout_rate"
                              position="top"
                              formatter={(v: any) => (v && Number(v) > 0 ? `${Number(v).toFixed(2)}%` : '')}
                              fill="#BE123C"
                              fontSize={9.5}
                              fontWeight={700}
                              offset={6}
                            />
                          </Bar>
                        )}
                      </BarChart>
                    ) : (
                      <BarChart data={sorted_by_center} margin={{ top: 32, right: 24, left: 6, bottom: 65 }} barGap={6} barCategoryGap="20%">
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                        <XAxis
                          dataKey="name"
                          interval={0}
                          height={65}
                          tick={renderRotatedTick}
                        />
                        <YAxis
                          domain={[0, (dataMax: number) => {
                            const max = Number(dataMax) || 0;
                            return max > 0 ? Math.ceil(max * 1.2 + 2) : 20;
                          }]}
                          tick={{ fontSize: 11, fill: '#64748B' }}
                        />
                        <Tooltip
                          formatter={(val: any, name: any) => [`${Number(val).toLocaleString()} students`, name]}
                          contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #BFDBFE', fontSize: '11px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                        <Legend iconSize={12} wrapperStyle={{ fontSize: '14px', fontWeight: 700, paddingTop: '12px' }} />
                        {centerDisplayMode === 'split' ? (
                          <>
                            <Bar dataKey="initial_dropouts" name="Initial Dropouts" fill="#38BDF8" maxBarSize={36} radius={[4, 4, 0, 0]} isAnimationActive={false}>
                              <LabelList
                                dataKey="initial_dropouts"
                                position="top"
                                formatter={(v: any) => (v && Number(v) > 0 ? v.toLocaleString() : '')}
                                fill="#0284C7"
                                fontSize={9.5}
                                fontWeight={700}
                                offset={6}
                              />
                            </Bar>
                            <Bar dataKey="regular_dropouts" name="Regular Dropouts" fill="#1D4ED8" maxBarSize={36} radius={[4, 4, 0, 0]} isAnimationActive={false}>
                              <LabelList
                                dataKey="regular_dropouts"
                                position="top"
                                formatter={(v: any) => (v && Number(v) > 0 ? v.toLocaleString() : '')}
                                fill="#1E40AF"
                                fontSize={9.5}
                                fontWeight={700}
                                offset={6}
                              />
                            </Bar>
                            <Bar dataKey="total_dropouts" name="Total Dropouts" fill="#EF4444" maxBarSize={36} radius={[4, 4, 0, 0]} isAnimationActive={false}>
                              <LabelList
                                dataKey="total_dropouts"
                                position="top"
                                formatter={(v: any) => (v && Number(v) > 0 ? v.toLocaleString() : '')}
                                fill="#B91C1C"
                                fontSize={9.5}
                                fontWeight={700}
                                offset={6}
                              />
                            </Bar>
                          </>
                        ) : (
                          <Bar dataKey="total_dropouts" name="Total Dropouts" fill="#EF4444" maxBarSize={36} radius={[4, 4, 0, 0]} isAnimationActive={false}>
                            <LabelList
                              dataKey="total_dropouts"
                              position="top"
                              formatter={(v: any) => (v && Number(v) > 0 ? v.toLocaleString() : '')}
                              fill="#B91C1C"
                              fontSize={9.5}
                              fontWeight={700}
                              offset={6}
                            />
                          </Bar>
                        )}
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                )}
              </div>

              {/* Center Quick Drill Cards */}
              <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Top Dropout Centers ({sorted_by_center.length})
                </span>
                {sorted_by_center.map((c: any) => {
                  const centerName = c.center_code || c.name || 'Unknown';
                  return (
                    <div
                      key={centerName}
                      className="p-2.5 rounded-xl border bg-slate-50/70 hover:bg-slate-100 border-slate-200/70 transition-all flex items-center justify-between"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => onSelectCenterDrilldown(centerName)}
                            className="text-xs font-bold text-blue-700 hover:underline truncate text-left cursor-pointer"
                            title="Drill down into Center Batches"
                          >
                            {centerName}
                          </button>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-2">
                          <span>Students: <b>{c.students.toLocaleString()}</b></span>
                          <span>•</span>
                          <span className="text-sky-700 font-semibold">Init: {c.initial_dropouts}</span>
                          <span>•</span>
                          <span className="text-blue-900 font-semibold">Reg: {c.regular_dropouts}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0 flex items-center gap-2">
                        <div>
                          <div className="text-xs font-mono font-bold text-blue-700">{c.dropout_rate}%</div>
                          <div className="text-[10px] text-slate-400 font-mono">{c.dropouts} drops</div>
                        </div>
                        <button
                          onClick={() => onSelectCenterDrilldown(centerName)}
                          className="p-1 rounded-md text-slate-400 hover:text-blue-700 hover:bg-white cursor-pointer"
                          title="Drill down"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* --- PROGRAM WISE CHART SECTION --- */}
        {(activeChartTab === 'all' || activeChartTab === 'program') && (
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-teal-600"></div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Program Wise Dropout &amp; Completion Breakdown</h3>
                  <p className="text-[11px] text-slate-500">
                    Dropout rates vs. completion rates across institutional and skilling programs
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs font-medium flex-wrap">
                <span className="inline-flex items-center gap-1.5 text-sm text-sky-700 font-bold">
                  <span className="w-3 h-3 rounded-xs bg-sky-400"></span> Initial %
                </span>
                <span className="inline-flex items-center gap-1.5 text-sm text-blue-900 font-bold">
                  <span className="w-3 h-3 rounded-xs bg-blue-700"></span> Regular %
                </span>
                <span className="inline-flex items-center gap-1.5 text-sm text-blue-600 font-bold">
                  <span className="w-3 h-3 rounded-xs bg-blue-500"></span> Trained %
                </span>
                <button
                  onClick={() => handleExportChartExcel('program', 'Dropout_Program_Wise_Top10_Breakdown', sorted_by_program)}
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Program Column Chart */}
              <div className="lg:col-span-2 h-[460px]">
                <ResponsiveContainer width="100%" height="100%">
                  {breakdownMetric === 'rate' ? (
                    <BarChart data={sorted_by_program} margin={{ top: 32, right: 24, left: 6, bottom: 65 }} barGap={6} barCategoryGap="25%">
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis
                        dataKey="name"
                        interval={0}
                        height={65}
                        tick={renderRotatedTick}
                      />
                      <YAxis
                        unit="%"
                        domain={[0, (dataMax: number) => Math.max(10, Math.ceil(dataMax * 1.35 + 2))]}
                        tick={{ fontSize: 11, fill: '#64748B' }}
                      />
                      <Tooltip
                        formatter={(val: any, name: any) => [`${Number(val).toFixed(2)}%`, name]}
                        contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #BFDBFE', fontSize: '11px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      />
                      <Legend iconSize={12} wrapperStyle={{ fontSize: '14px', fontWeight: 700, paddingTop: '12px' }} />
                      <Bar dataKey="initial_dropout_rate" name="Initial Dropout %" fill="#38BDF8" barSize={18} radius={[4, 4, 0, 0]}>
                        <LabelList
                          dataKey="initial_dropout_rate"
                          position="top"
                          formatter={(v: any) => (v && Number(v) > 0 ? `${Number(v).toFixed(2)}%` : '')}
                          fill="#0284C7"
                          fontSize={9.5}
                          fontWeight={700}
                          offset={6}
                        />
                      </Bar>
                      <Bar dataKey="regular_dropout_rate" name="Regular Dropout %" fill="#1D4ED8" barSize={18} radius={[4, 4, 0, 0]}>
                        <LabelList
                          dataKey="regular_dropout_rate"
                          position="top"
                          formatter={(v: any) => (v && Number(v) > 0 ? `${Number(v).toFixed(2)}%` : '')}
                          fill="#1E40AF"
                          fontSize={9.5}
                          fontWeight={700}
                          offset={6}
                        />
                      </Bar>
                      <Bar dataKey="total_dropout_rate" name="Total Dropout %" fill="#EF4444" barSize={18} radius={[4, 4, 0, 0]}>
                        <LabelList
                          dataKey="total_dropout_rate"
                          position="top"
                          formatter={(v: any) => (v && Number(v) > 0 ? `${Number(v).toFixed(2)}%` : '')}
                          fill="#B91C1C"
                          fontSize={9.5}
                          fontWeight={700}
                          offset={6}
                        />
                      </Bar>
                    </BarChart>
                  ) : (
                    <BarChart data={sorted_by_program} margin={{ top: 32, right: 24, left: 6, bottom: 65 }} barGap={6} barCategoryGap="25%">
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis
                        dataKey="name"
                        interval={0}
                        height={65}
                        tick={renderRotatedTick}
                      />
                      <YAxis
                        domain={[0, (dataMax: number) => Math.max(10, Math.ceil(dataMax * 1.3 + 2))]}
                        tick={{ fontSize: 11, fill: '#64748B' }}
                      />
                      <Tooltip
                        formatter={(val: any, name: any) => [`${val.toLocaleString()} students`, name]}
                        contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #BFDBFE', fontSize: '11px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      />
                      <Legend iconSize={12} wrapperStyle={{ fontSize: '14px', fontWeight: 700, paddingTop: '12px' }} />
                      <Bar dataKey="initial_dropouts" name="Initial Dropouts" fill="#38BDF8" barSize={18} radius={[4, 4, 0, 0]}>
                        <LabelList
                          dataKey="initial_dropouts"
                          position="top"
                          formatter={(v: any) => (v && Number(v) > 0 ? v.toLocaleString() : '')}
                          fill="#0284C7"
                          fontSize={9.5}
                          fontWeight={700}
                          offset={6}
                        />
                      </Bar>
                      <Bar dataKey="regular_dropouts" name="Regular Dropouts" fill="#1D4ED8" barSize={18} radius={[4, 4, 0, 0]}>
                        <LabelList
                          dataKey="regular_dropouts"
                          position="top"
                          formatter={(v: any) => (v && Number(v) > 0 ? v.toLocaleString() : '')}
                          fill="#1E40AF"
                          fontSize={9.5}
                          fontWeight={700}
                          offset={6}
                        />
                      </Bar>
                      <Bar dataKey="total_dropouts" name="Total Dropouts" fill="#EF4444" barSize={18} radius={[4, 4, 0, 0]}>
                        <LabelList
                          dataKey="total_dropouts"
                          position="top"
                          formatter={(v: any) => (v && Number(v) > 0 ? v.toLocaleString() : '')}
                          fill="#B91C1C"
                          fontSize={9.5}
                          fontWeight={700}
                          offset={6}
                        />
                      </Bar>
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>

              {/* Program Summary Cards with click-to-filter */}
              <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Programs Overview ({sorted_by_program.length})
                </span>
                {sorted_by_program.map((p: any) => (
                  <button
                    key={p.name}
                    onClick={() => handleProgramNameChange(p.name === currentProgramName ? 'ALL' : p.name)}
                    className={`w-full text-left p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                      currentProgramName === p.name
                        ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-200'
                        : 'bg-slate-50/70 hover:bg-slate-100 border-slate-200/70'
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-900 truncate">{p.name}</span>
                        {currentProgramName === p.name && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-600 text-white font-semibold">Filtered</span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-2">
                        <span>Students: <b>{p.students.toLocaleString()}</b></span>
                        <span>•</span>
                        <span className="text-blue-700 font-semibold">Trained: {p.trained_rate}%</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs font-mono font-bold text-blue-700">{p.dropout_rate}%</div>
                      <div className="text-[10px] text-slate-400 font-mono">{p.dropouts} dropouts</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 3. MONTHLY RATES TRAJECTORY & LIFECYCLE OUTCOME                           */}
      {/* ========================================================================= */}
      {(activeChartTab === 'all' || activeChartTab === 'rates' || activeChartTab === 'lifecycle') && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Multi-Rate Cohort Monthly Trend */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4 lg:col-span-2">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 flex-wrap gap-2">
              <div>
                <h4 className="text-xs font-bold text-slate-900">Monthly Trajectory: Trained % vs. Dropout %</h4>
                <p className="text-[11px] text-slate-500">
                  Side-by-side progression of Total Trained %, Regular Dropout %, and Initial Dropout %
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs font-semibold flex-wrap">
                <span className="inline-flex items-center gap-1.5 text-sm font-bold text-blue-600">
                  <span className="w-3 h-3 rounded-full bg-blue-500"></span> Trained: {kpis.trained_rate ?? 0}%
                </span>
                <span className="inline-flex items-center gap-1.5 text-sm font-bold text-blue-900">
                  <span className="w-3 h-3 rounded-full bg-blue-700"></span> Regular: {kpis.regular_dropout_rate ?? 0}%
                </span>
                <span className="inline-flex items-center gap-1.5 text-sm font-bold text-sky-700">
                  <span className="w-3 h-3 rounded-full bg-sky-400"></span> Initial: {kpis.initial_dropout_rate ?? 0}%
                </span>
                <button
                  onClick={() => handleExportChartExcel('rates', 'Dropout_Monthly_Trajectory', trend)}
                  disabled={exportingChart === 'rates'}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-600 hover:text-white transition-all cursor-pointer border border-emerald-200 disabled:opacity-60"
                  title="Export monthly trajectory summary and underlying raw student records to Excel"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{exportingChart === 'rates' ? 'Exporting...' : 'Export Raw Data (Excel)'}</span>
                </button>
                <button
                  onClick={() => setFullscreenChart('rates')}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-[#008C95] hover:text-white transition-all cursor-pointer border border-slate-200"
                  title="Open Monthly Trajectory Chart in Presentation Mode"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>Presentation Mode</span>
                </button>
              </div>
            </div>

            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend} margin={{ top: 18, right: 18, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748B' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748B' }} unit="%" domain={[0, 100]} />
                  <Tooltip
                    formatter={(val: any, name: any) => [`${val}%`, name]}
                    contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #BFDBFE', fontSize: '11px' }}
                  />
                  <Legend iconSize={12} wrapperStyle={{ fontSize: '14px', fontWeight: 700, paddingTop: '10px' }} />
                  <Line
                    type="monotone"
                    dataKey="trained_rate"
                    name="Total Trained %"
                    stroke="#2563EB"
                    strokeWidth={2.5}
                    dot={{ r: 3.5, fill: '#2563EB' }}
                  >
                    <LabelList
                      dataKey="trained_rate"
                      position="top"
                      formatter={(v: any) => (v && Number(v) > 0 ? `${v}%` : '')}
                      fill="#1D4ED8"
                      fontSize={9.5}
                      fontWeight={700}
                      offset={6}
                    />
                  </Line>
                  <Line
                    type="monotone"
                    dataKey="regular_dropout_rate"
                    name="Regular Dropout %"
                    stroke="#1E3A8A"
                    strokeWidth={2}
                    strokeDasharray="4 2"
                    dot={{ r: 3, fill: '#1E3A8A' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="initial_dropout_rate"
                    name="Initial Dropout %"
                    stroke="#38BDF8"
                    strokeWidth={2}
                    strokeDasharray="2 2"
                    dot={{ r: 3, fill: '#38BDF8' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Student Lifecycle Outcome Distribution Donut */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 flex-wrap gap-2">
              <div>
                <h4 className="text-xs font-bold text-slate-900">Student Lifecycle Outcome</h4>
                <p className="text-[11px] text-slate-500">Trained vs. Dropouts vs. In-Training</p>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={() => handleExportChartExcel('lifecycle', 'Dropout_Lifecycle_Outcome', outcomeComposition)}
                  disabled={exportingChart === 'lifecycle'}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-600 hover:text-white transition-all cursor-pointer border border-emerald-200 disabled:opacity-60"
                  title="Export lifecycle outcome summary and underlying raw student records to Excel"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{exportingChart === 'lifecycle' ? 'Exporting...' : 'Export Excel'}</span>
                </button>
                <button
                  onClick={() => setFullscreenChart('lifecycle')}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-[#008C95] hover:text-white transition-all cursor-pointer border border-slate-200"
                  title="Open Lifecycle Outcome Chart in Presentation Mode"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>Presentation Mode</span>
                </button>
              </div>
            </div>

            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={outcomeComposition}
                    cx="50%"
                    cy="50%"
                    innerRadius={44}
                    outerRadius={68}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ percent }) => (percent && percent > 0.1 ? `${(percent * 100).toFixed(0)}%` : '')}
                    labelLine={false}
                  >
                    {outcomeComposition.map((entry, idx) => (
                      <Cell key={`cell-outcome-${idx}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: any, name: any) => [
                      `${val.toLocaleString()} students (${kpis.total_students > 0 ? ((val / kpis.total_students) * 100).toFixed(1) : 0}%)`,
                      name
                    ]}
                    contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #BFDBFE', fontSize: '11px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-100 text-sm font-bold">
              {outcomeComposition.map((d) => (
                <div key={d.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: d.color }}></div>
                    <span className="text-slate-800 font-bold truncate">{d.name}</span>
                  </div>
                  <span className="font-bold text-slate-900 font-mono shrink-0">
                    {d.value.toLocaleString()} ({kpis.total_students > 0 ? ((d.value / kpis.total_students) * 100).toFixed(1) : 0}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. Center-wise Detail Table with Drill-down & Search                       */}
      {/* ========================================================================= */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3 pb-2 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Center-wise Detailed Breakdown &amp; Batch Drill-down</h3>
            <p className="text-xs text-slate-500">
              Complete rate and count comparisons with drill-down into Batches and Students
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
              onClick={exportCenterCsv}
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
                <th className="px-3.5 py-3">Center Code</th>
                <th className="px-3.5 py-3 text-right">Students</th>
                <th className="px-3.5 py-3 text-right">Trained</th>
                <th className="px-3.5 py-3 text-right">Trained %</th>
                <th className="px-3.5 py-3 text-right">Total Dropouts</th>
                <th className="px-3.5 py-3 text-right">Dropout %</th>
                <th className="px-3.5 py-3 text-right">Initial Session %</th>
                <th className="px-3.5 py-3 text-right">Regular Session %</th>
                <th className="px-3.5 py-3 text-right">Batches</th>
                <th className="px-3.5 py-3 text-right">Drill-down</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCenters.map((c: any) => {
                const initRate = c.students > 0 ? Number(((c.initial_dropouts || 0) / c.students * 100).toFixed(1)) : 0;
                const regRate = c.students > 0 ? Number(((c.regular_dropouts || 0) / c.students * 100).toFixed(1)) : 0;
                const trCount = c.trained_students ?? Math.max(0, (c.students || 0) - (c.dropouts || 0));
                const trRate = c.students > 0 ? Number(((trCount / c.students) * 100).toFixed(1)) : 0;

                return (
                  <tr key={c.center_code} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-3.5 py-2.5 font-bold text-slate-900">
                      <button
                        onClick={() => onSelectCenterDrilldown(c.center_code)}
                        className="text-[#008C95] hover:underline font-bold"
                      >
                        {c.center_code}
                      </button>
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-mono">{c.students.toLocaleString()}</td>
                    <td className="px-3.5 py-2.5 text-right font-mono text-emerald-700 font-bold">{trCount.toLocaleString()}</td>
                    <td className="px-3.5 py-2.5 text-right font-mono font-semibold text-emerald-700">{trRate}%</td>
                    <td className="px-3.5 py-2.5 text-right font-mono font-bold text-rose-600">{c.dropouts.toLocaleString()}</td>
                    <td className="px-3.5 py-2.5 text-right">
                      <span className={`px-2 py-0.5 rounded font-mono font-bold text-xs ${
                        c.dropout_rate > 15 ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {c.dropout_rate}%
                      </span>
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-mono text-amber-700 font-medium">
                      {c.initial_dropouts} ({initRate}%)
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-mono text-rose-700 font-medium">
                      {c.regular_dropouts} ({regRate}%)
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-mono">{c.batches}</td>
                    <td className="px-3.5 py-2.5 text-right">
                      <button
                        onClick={() => onSelectCenterDrilldown(c.center_code)}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#008C95] hover:text-[#005F66]"
                      >
                        <span>Drill</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* FULLSCREEN CHART MODAL OVERLAY                                             */}
      {/* ========================================================================= */}
      {fullscreenChart && (
        <div
          className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 md:p-6 animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setFullscreenChart(null);
          }}
        >
          <div className="bg-white w-full h-full max-w-[1600px] max-h-[95vh] rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
            {/* Modal Top Bar */}
            <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0 gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-800 rounded-lg text-[#008C95]">
                  <BarChart3 className="w-5 h-5 text-[#38BDF8]" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span>
                      {fullscreenChart === 'rm' && 'RM Wise Dropout & Retention Breakdown'}
                      {fullscreenChart === 'center' && 'Center Wise Dropout Analysis'}
                      {fullscreenChart === 'program' && 'Program Wise Dropout & Completion Breakdown'}
                      {fullscreenChart === 'rates' && 'Monthly Trajectory: Trained % vs. Dropout %'}
                      {fullscreenChart === 'lifecycle' && 'Student Lifecycle Outcome Distribution'}
                    </span>
                    <span className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded bg-[#008C95]/20 text-[#38BDF8] border border-[#008C95]/40 font-mono font-semibold">
                      Presentation Mode
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    {fullscreenChart === 'rm' && 'Regional Manager comparison of Initial Session vs. Regular Session attrition and completion'}
                    {fullscreenChart === 'center' && 'Highest dropout volume centers with initial vs regular session distribution'}
                    {fullscreenChart === 'program' && 'Dropout rates vs. completion rates across institutional and skilling programs'}
                    {fullscreenChart === 'rates' && 'Side-by-side progression of Total Trained %, Regular Dropout %, and Initial Dropout %'}
                    {fullscreenChart === 'lifecycle' && 'Trained vs. Dropouts vs. In-Training proportion breakdown'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {['rm', 'center', 'program'].includes(fullscreenChart) && (
                  <div className="flex items-center gap-1 p-1 bg-slate-800 rounded-lg border border-slate-700 text-xs">
                    <span className="text-[11px] text-slate-400 px-1 font-medium">Metric:</span>
                    <button
                      onClick={() => setBreakdownMetric('rate')}
                      className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer transition-all ${
                        breakdownMetric === 'rate'
                          ? 'bg-[#008C95] text-white shadow-xs'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      Percentages (%)
                    </button>
                    <button
                      onClick={() => setBreakdownMetric('volume')}
                      className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer transition-all ${
                        breakdownMetric === 'volume'
                          ? 'bg-[#008C95] text-white shadow-xs'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      Counts (Headcount)
                    </button>
                  </div>
                )}

                <button
                  onClick={() =>
                    handleExportChartExcel(
                      fullscreenChart,
                      fullscreenChart === 'rm'
                        ? 'Dropout_RM_Wise_Breakdown'
                        : fullscreenChart === 'center'
                        ? 'Dropout_Center_Wise_Top10_Breakdown'
                        : fullscreenChart === 'program'
                        ? 'Dropout_Program_Wise_Top10_Breakdown'
                        : fullscreenChart === 'rates'
                        ? 'Dropout_Monthly_Trajectory'
                        : 'Dropout_Lifecycle_Outcome',
                      fullscreenChart === 'rm'
                        ? sorted_by_rm
                        : fullscreenChart === 'center'
                        ? sorted_by_center
                        : fullscreenChart === 'program'
                        ? sorted_by_program
                        : fullscreenChart === 'rates'
                        ? trend
                        : outcomeComposition
                    )
                  }
                  disabled={exportingChart === fullscreenChart}
                  className="px-3 py-1.5 text-emerald-300 hover:text-white bg-emerald-950/60 hover:bg-emerald-700 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-semibold border border-emerald-700/60 disabled:opacity-60"
                  title="Export chart summary and underlying raw student records to Excel"
                >
                  <Download className="w-4 h-4" />
                  <span>{exportingChart === fullscreenChart ? 'Exporting...' : 'Export Raw Data (Excel)'}</span>
                </button>

                <button
                  onClick={() => setFullscreenChart(null)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-semibold border border-slate-700"
                  title="Exit Presentation Mode (Esc)"
                >
                  <Minimize2 className="w-4 h-4 text-slate-300" />
                  <span className="hidden sm:inline">Exit Presentation Mode</span>
                </button>
              </div>
            </div>

            {/* Modal Main Area */}
            <div className="p-6 flex-1 overflow-y-auto bg-slate-50/50 space-y-6">
              {/* --- 1. RM CHART FULLSCREEN --- */}
              {fullscreenChart === 'rm' && (
                <div className="space-y-6">
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-indigo-600" />
                        <h4 className="text-sm font-bold text-slate-900">Regional Manager High-Resolution Chart ({sorted_by_rm.length} RMs)</h4>
                      </div>
                      <div className="flex items-center gap-4 text-sm font-bold">
                        <span className="inline-flex items-center gap-1.5 text-sky-700">
                          <span className="w-3.5 h-3.5 rounded-xs bg-sky-400"></span> Initial Session
                        </span>
                        <span className="inline-flex items-center gap-1.5 text-blue-900">
                          <span className="w-3.5 h-3.5 rounded-xs bg-blue-700"></span> Regular Session
                        </span>
                      </div>
                    </div>

                    <div className="h-[520px]">
                      <ResponsiveContainer width="100%" height="100%">
                        {breakdownMetric === 'rate' ? (
                          <BarChart data={sorted_by_rm} margin={{ top: 32, right: 24, left: 10, bottom: 85 }} barGap={8} barCategoryGap="20%">
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                            <XAxis dataKey="name" interval={0} height={85} tick={renderRotatedTick} />
                            <YAxis unit="%" domain={[0, (dataMax: number) => Math.max(10, Math.ceil(dataMax * 1.35 + 2))]} tick={{ fontSize: 12, fill: '#475569' }} />
                            <Tooltip content={renderRmTooltip} />
                            <Legend iconSize={13} wrapperStyle={{ fontSize: '15px', fontWeight: 700, paddingTop: '15px' }} />
                            <Bar dataKey="initial_dropout_rate" name="Initial Dropout %" fill="#38BDF8" barSize={26} radius={[6, 6, 0, 0]}>
                              <LabelList dataKey="initial_dropout_rate" position="top" formatter={(v: any) => (v && Number(v) > 0 ? `${Number(v).toFixed(2)}%` : '')} fill="#0284C7" fontSize={11} fontWeight={700} offset={8} />
                            </Bar>
                            <Bar dataKey="regular_dropout_rate" name="Regular Dropout %" fill="#1D4ED8" barSize={26} radius={[6, 6, 0, 0]}>
                              <LabelList dataKey="regular_dropout_rate" position="top" formatter={(v: any) => (v && Number(v) > 0 ? `${Number(v).toFixed(2)}%` : '')} fill="#1E40AF" fontSize={11} fontWeight={700} offset={8} />
                            </Bar>
                            <Bar dataKey="total_dropout_rate" name="Total Dropout %" fill="#EF4444" barSize={26} radius={[6, 6, 0, 0]}>
                              <LabelList dataKey="total_dropout_rate" position="top" formatter={(v: any) => (v && Number(v) > 0 ? `${Number(v).toFixed(2)}%` : '')} fill="#B91C1C" fontSize={11} fontWeight={700} offset={8} />
                            </Bar>
                          </BarChart>
                        ) : (
                          <BarChart data={sorted_by_rm} margin={{ top: 32, right: 24, left: 10, bottom: 85 }} barGap={8} barCategoryGap="20%">
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                            <XAxis dataKey="name" interval={0} height={85} tick={renderRotatedTick} />
                            <YAxis domain={[0, (dataMax: number) => Math.max(10, Math.ceil(dataMax * 1.3 + 2))]} tick={{ fontSize: 12, fill: '#475569' }} />
                            <Tooltip content={renderRmTooltip} />
                            <Legend iconSize={13} wrapperStyle={{ fontSize: '15px', fontWeight: 700, paddingTop: '15px' }} />
                            <Bar dataKey="initial_dropouts" name="Initial Dropouts" fill="#38BDF8" barSize={26} radius={[6, 6, 0, 0]}>
                              <LabelList dataKey="initial_dropouts" position="top" formatter={(v: any) => (v && Number(v) > 0 ? v.toLocaleString() : '')} fill="#0284C7" fontSize={11} fontWeight={700} offset={8} />
                            </Bar>
                            <Bar dataKey="regular_dropouts" name="Regular Dropouts" fill="#1D4ED8" barSize={26} radius={[6, 6, 0, 0]}>
                              <LabelList dataKey="regular_dropouts" position="top" formatter={(v: any) => (v && Number(v) > 0 ? v.toLocaleString() : '')} fill="#1E40AF" fontSize={11} fontWeight={700} offset={8} />
                            </Bar>
                            <Bar dataKey="total_dropouts" name="Total Dropouts" fill="#EF4444" barSize={26} radius={[6, 6, 0, 0]}>
                              <LabelList dataKey="total_dropouts" position="top" formatter={(v: any) => (v && Number(v) > 0 ? v.toLocaleString() : '')} fill="#B91C1C" fontSize={11} fontWeight={700} offset={8} />
                            </Bar>
                          </BarChart>
                        )}
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* RM Full Detailed Data Grid */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                    <h5 className="text-xs font-bold text-slate-900 uppercase tracking-wider">RM Breakdown Summary Table</h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      {sorted_by_rm.map((rm: any, idx: number) => (
                        <div key={`${rm.name}_${idx}`} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                          <div className="font-bold text-slate-900 text-xs truncate">{rm.name}</div>
                          <div className="flex items-center justify-between text-[11px] text-slate-600">
                            <span>Students: <b className="font-mono">{rm.students.toLocaleString()}</b></span>
                            <span className="text-blue-700 font-bold font-mono">Trained: {rm.trained_rate}%</span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200">
                            <span className="text-sky-700 font-medium">Init: {rm.initial_dropouts} ({rm.initial_dropout_rate}%)</span>
                            <span className="text-blue-900 font-medium">Reg: {rm.regular_dropouts} ({rm.regular_dropout_rate}%)</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* --- 2. CENTER CHART FULLSCREEN --- */}
              {fullscreenChart === 'center' && (
                <div className="space-y-6">
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-sky-600" />
                        <h4 className="text-sm font-bold text-slate-900">Center Wise High-Resolution Chart ({sorted_by_center.length} Top Centers)</h4>
                      </div>
                      <div className="flex items-center gap-4 text-xs font-semibold">
                        <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg border border-slate-200 text-[11px]">
                          <button
                            type="button"
                            onClick={() => setCenterDisplayMode('split')}
                            className={`px-2 py-0.5 rounded-md font-semibold cursor-pointer transition-all ${
                              centerDisplayMode === 'split'
                                ? 'bg-white text-slate-900 shadow-2xs font-bold'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            Split (Initial vs Regular)
                          </button>
                          <button
                            type="button"
                            onClick={() => setCenterDisplayMode('total')}
                            className={`px-2 py-0.5 rounded-md font-semibold cursor-pointer transition-all ${
                              centerDisplayMode === 'total'
                                ? 'bg-white text-slate-900 shadow-2xs font-bold'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            Total Dropouts
                          </button>
                        </div>

                        {centerDisplayMode === 'split' ? (
                          <>
                            <span className="inline-flex items-center gap-1.5 text-sm font-bold text-sky-700">
                              <span className="w-3.5 h-3.5 rounded-xs bg-sky-400"></span> Initial Dropouts
                            </span>
                            <span className="inline-flex items-center gap-1.5 text-sm font-bold text-blue-900">
                              <span className="w-3.5 h-3.5 rounded-xs bg-blue-700"></span> Regular Dropouts
                            </span>
                          </>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-sm font-bold text-rose-700">
                            <span className="w-3.5 h-3.5 rounded-xs bg-rose-500"></span> Overall Dropouts
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="h-[520px] min-w-0 w-full">
                      <ResponsiveContainer width="100%" height="100%" minWidth={280} minHeight={400}>
                        {breakdownMetric === 'rate' ? (
                          <BarChart data={sorted_by_center} margin={{ top: 32, right: 24, left: 10, bottom: 85 }} barGap={8} barCategoryGap="20%">
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                            <XAxis dataKey="name" interval={0} height={85} tick={renderRotatedTick} />
                            <YAxis
                              unit="%"
                              domain={[0, (dataMax: number) => {
                                const max = Number(dataMax) || 0;
                                return max > 0 ? Math.ceil(max * 1.25 + 2) : 25;
                              }]}
                              tick={{ fontSize: 12, fill: '#475569' }}
                            />
                            <Tooltip formatter={(val: any, name: any) => [`${Number(val).toFixed(2)}%`, name]} contentStyle={{ backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #93C5FD', fontSize: '12px', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                            <Legend iconSize={13} wrapperStyle={{ fontSize: '15px', fontWeight: 700, paddingTop: '15px' }} />
                            {centerDisplayMode === 'split' ? (
                              <>
                                <Bar dataKey="initial_dropout_rate" name="Initial Dropout %" fill="#38BDF8" maxBarSize={40} radius={[6, 6, 0, 0]} isAnimationActive={false}>
                                  <LabelList dataKey="initial_dropout_rate" position="top" formatter={(v: any) => (v && Number(v) > 0 ? `${Number(v).toFixed(2)}%` : '')} fill="#0284C7" fontSize={11} fontWeight={700} offset={8} />
                                </Bar>
                                <Bar dataKey="regular_dropout_rate" name="Regular Dropout %" fill="#1D4ED8" maxBarSize={40} radius={[6, 6, 0, 0]} isAnimationActive={false}>
                                  <LabelList dataKey="regular_dropout_rate" position="top" formatter={(v: any) => (v && Number(v) > 0 ? `${Number(v).toFixed(2)}%` : '')} fill="#1E40AF" fontSize={11} fontWeight={700} offset={8} />
                                </Bar>
                                <Bar dataKey="total_dropout_rate" name="Total Dropout %" fill="#EF4444" maxBarSize={40} radius={[6, 6, 0, 0]} isAnimationActive={false}>
                                  <LabelList dataKey="total_dropout_rate" position="top" formatter={(v: any) => (v && Number(v) > 0 ? `${Number(v).toFixed(2)}%` : '')} fill="#B91C1C" fontSize={11} fontWeight={700} offset={8} />
                                </Bar>
                              </>
                            ) : (
                              <Bar dataKey="dropout_rate" name="Total Dropout %" fill="#F43F5E" maxBarSize={44} radius={[6, 6, 0, 0]} isAnimationActive={false}>
                                <LabelList dataKey="dropout_rate" position="top" formatter={(v: any) => (v && Number(v) > 0 ? `${Number(v).toFixed(2)}%` : '')} fill="#BE123C" fontSize={11} fontWeight={700} offset={8} />
                              </Bar>
                            )}
                          </BarChart>
                        ) : (
                          <BarChart data={sorted_by_center} margin={{ top: 32, right: 24, left: 10, bottom: 85 }} barGap={8} barCategoryGap="20%">
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                            <XAxis dataKey="name" interval={0} height={85} tick={renderRotatedTick} />
                            <YAxis
                              domain={[0, (dataMax: number) => {
                                const max = Number(dataMax) || 0;
                                return max > 0 ? Math.ceil(max * 1.2 + 2) : 20;
                              }]}
                              tick={{ fontSize: 12, fill: '#475569' }}
                            />
                            <Tooltip formatter={(val: any, name: any) => [`${Number(val).toLocaleString()} students`, name]} contentStyle={{ backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #93C5FD', fontSize: '12px', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                            <Legend iconSize={13} wrapperStyle={{ fontSize: '15px', fontWeight: 700, paddingTop: '15px' }} />
                            {centerDisplayMode === 'split' ? (
                              <>
                                <Bar dataKey="initial_dropouts" name="Initial Dropouts" fill="#38BDF8" maxBarSize={40} radius={[6, 6, 0, 0]} isAnimationActive={false}>
                                  <LabelList dataKey="initial_dropouts" position="top" formatter={(v: any) => (v && Number(v) > 0 ? v.toLocaleString() : '')} fill="#0284C7" fontSize={11} fontWeight={700} offset={8} />
                                </Bar>
                                <Bar dataKey="regular_dropouts" name="Regular Dropouts" fill="#1D4ED8" maxBarSize={40} radius={[6, 6, 0, 0]} isAnimationActive={false}>
                                  <LabelList dataKey="regular_dropouts" position="top" formatter={(v: any) => (v && Number(v) > 0 ? v.toLocaleString() : '')} fill="#1E40AF" fontSize={11} fontWeight={700} offset={8} />
                                </Bar>
                                <Bar dataKey="total_dropouts" name="Total Dropouts" fill="#EF4444" maxBarSize={40} radius={[6, 6, 0, 0]} isAnimationActive={false}>
                                  <LabelList dataKey="total_dropouts" position="top" formatter={(v: any) => (v && Number(v) > 0 ? v.toLocaleString() : '')} fill="#B91C1C" fontSize={11} fontWeight={700} offset={8} />
                                </Bar>
                              </>
                            ) : (
                              <Bar dataKey="dropouts" name="Total Dropouts" fill="#F43F5E" maxBarSize={44} radius={[6, 6, 0, 0]} isAnimationActive={false}>
                                <LabelList dataKey="dropouts" position="top" formatter={(v: any) => (v && Number(v) > 0 ? v.toLocaleString() : '')} fill="#BE123C" fontSize={11} fontWeight={700} offset={8} />
                              </Bar>
                            )}
                          </BarChart>
                        )}
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Top Centers Grid */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                    <h5 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Top Centers Detailed Breakdown</h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      {sorted_by_center.map((c: any) => {
                        const centerName = c.center_code || c.name || 'Unknown';
                        return (
                          <div key={centerName} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-blue-700 text-xs truncate">{centerName}</span>
                              <span className="font-mono text-xs font-bold text-blue-800">{c.dropout_rate}%</span>
                            </div>
                            <div className="text-[11px] text-slate-600 flex items-center justify-between">
                              <span>Students: <b className="font-mono">{c.students.toLocaleString()}</b></span>
                              <span className="text-slate-500 font-mono">{c.dropouts} drops</span>
                            </div>
                            <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200">
                              <span className="text-sky-700 font-medium">Init: {c.initial_dropouts}</span>
                              <span className="text-blue-900 font-medium">Reg: {c.regular_dropouts}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* --- 3. PROGRAM CHART FULLSCREEN --- */}
              {fullscreenChart === 'program' && (
                <div className="space-y-6">
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-teal-600" />
                        <h4 className="text-sm font-bold text-slate-900">Program Wise High-Resolution Chart ({sorted_by_program.length} Programs)</h4>
                      </div>
                      <div className="flex items-center gap-4 text-sm font-bold">
                        <span className="inline-flex items-center gap-1.5 text-sky-700">
                          <span className="w-3.5 h-3.5 rounded-xs bg-sky-400"></span> Initial %
                        </span>
                        <span className="inline-flex items-center gap-1.5 text-blue-900">
                          <span className="w-3.5 h-3.5 rounded-xs bg-blue-700"></span> Regular %
                        </span>
                      </div>
                    </div>

                    <div className="h-[520px]">
                      <ResponsiveContainer width="100%" height="100%">
                        {breakdownMetric === 'rate' ? (
                          <BarChart data={sorted_by_program} margin={{ top: 32, right: 24, left: 10, bottom: 85 }} barGap={8} barCategoryGap="20%">
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                            <XAxis dataKey="name" interval={0} height={85} tick={renderRotatedTick} />
                            <YAxis unit="%" domain={[0, (dataMax: number) => Math.max(10, Math.ceil(dataMax * 1.35 + 2))]} tick={{ fontSize: 12, fill: '#475569' }} />
                            <Tooltip formatter={(val: any, name: any) => [`${Number(val).toFixed(2)}%`, name]} contentStyle={{ backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #93C5FD', fontSize: '12px', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                            <Legend iconSize={13} wrapperStyle={{ fontSize: '15px', fontWeight: 700, paddingTop: '15px' }} />
                            <Bar dataKey="initial_dropout_rate" name="Initial Dropout %" fill="#38BDF8" barSize={26} radius={[6, 6, 0, 0]}>
                              <LabelList dataKey="initial_dropout_rate" position="top" formatter={(v: any) => (v && Number(v) > 0 ? `${Number(v).toFixed(2)}%` : '')} fill="#0284C7" fontSize={11} fontWeight={700} offset={8} />
                            </Bar>
                            <Bar dataKey="regular_dropout_rate" name="Regular Dropout %" fill="#1D4ED8" barSize={26} radius={[6, 6, 0, 0]}>
                              <LabelList dataKey="regular_dropout_rate" position="top" formatter={(v: any) => (v && Number(v) > 0 ? `${Number(v).toFixed(2)}%` : '')} fill="#1E40AF" fontSize={11} fontWeight={700} offset={8} />
                            </Bar>
                            <Bar dataKey="total_dropout_rate" name="Total Dropout %" fill="#EF4444" barSize={26} radius={[6, 6, 0, 0]}>
                              <LabelList dataKey="total_dropout_rate" position="top" formatter={(v: any) => (v && Number(v) > 0 ? `${Number(v).toFixed(2)}%` : '')} fill="#B91C1C" fontSize={11} fontWeight={700} offset={8} />
                            </Bar>
                          </BarChart>
                        ) : (
                          <BarChart data={sorted_by_program} margin={{ top: 32, right: 24, left: 10, bottom: 85 }} barGap={8} barCategoryGap="20%">
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                            <XAxis dataKey="name" interval={0} height={85} tick={renderRotatedTick} />
                            <YAxis domain={[0, (dataMax: number) => Math.max(10, Math.ceil(dataMax * 1.3 + 2))]} tick={{ fontSize: 12, fill: '#475569' }} />
                            <Tooltip formatter={(val: any, name: any) => [`${val.toLocaleString()} students`, name]} contentStyle={{ backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #93C5FD', fontSize: '12px', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                            <Legend iconSize={13} wrapperStyle={{ fontSize: '15px', fontWeight: 700, paddingTop: '15px' }} />
                            <Bar dataKey="initial_dropouts" name="Initial Dropouts" fill="#38BDF8" barSize={26} radius={[6, 6, 0, 0]}>
                              <LabelList dataKey="initial_dropouts" position="top" formatter={(v: any) => (v && Number(v) > 0 ? v.toLocaleString() : '')} fill="#0284C7" fontSize={11} fontWeight={700} offset={8} />
                            </Bar>
                            <Bar dataKey="regular_dropouts" name="Regular Dropouts" fill="#1D4ED8" barSize={26} radius={[6, 6, 0, 0]}>
                              <LabelList dataKey="regular_dropouts" position="top" formatter={(v: any) => (v && Number(v) > 0 ? v.toLocaleString() : '')} fill="#1E40AF" fontSize={11} fontWeight={700} offset={8} />
                            </Bar>
                            <Bar dataKey="total_dropouts" name="Total Dropouts" fill="#EF4444" barSize={26} radius={[6, 6, 0, 0]}>
                              <LabelList dataKey="total_dropouts" position="top" formatter={(v: any) => (v && Number(v) > 0 ? v.toLocaleString() : '')} fill="#B91C1C" fontSize={11} fontWeight={700} offset={8} />
                            </Bar>
                          </BarChart>
                        )}
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Program Summary Grid */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                    <h5 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Program Breakdown Summary</h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      {sorted_by_program.map((p: any) => (
                        <div key={p.name} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                          <div className="font-bold text-slate-900 text-xs truncate">{p.name}</div>
                          <div className="flex items-center justify-between text-[11px] text-slate-600">
                            <span>Students: <b className="font-mono">{p.students.toLocaleString()}</b></span>
                            <span className="text-blue-700 font-bold font-mono">Trained: {p.trained_rate}%</span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200">
                            <span className="text-slate-500 font-mono">Dropouts: {p.dropouts}</span>
                            <span className="text-blue-800 font-bold font-mono">Rate: {p.dropout_rate}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* --- 4. MONTHLY TRAJECTORY FULLSCREEN --- */}
              {fullscreenChart === 'rates' && (
                <div className="space-y-6">
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <TrendingDown className="w-4 h-4 text-violet-600" />
                        <h4 className="text-sm font-bold text-slate-900">Monthly Trajectory: Trained % vs. Dropout % ({trend.length} Cohort Months)</h4>
                      </div>
                      <div className="flex items-center gap-4 text-sm font-bold">
                        <span className="inline-flex items-center gap-1.5 text-blue-600">
                          <span className="w-3.5 h-3.5 rounded-full bg-blue-500"></span> Total Trained %
                        </span>
                        <span className="inline-flex items-center gap-1.5 text-blue-900">
                          <span className="w-3.5 h-3.5 rounded-full bg-blue-800"></span> Regular Dropout %
                        </span>
                        <span className="inline-flex items-center gap-1.5 text-sky-700">
                          <span className="w-3.5 h-3.5 rounded-full bg-sky-400"></span> Initial Dropout %
                        </span>
                      </div>
                    </div>

                    <div className="h-[500px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={trend} margin={{ top: 25, right: 25, left: 0, bottom: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                          <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#475569' }} />
                          <YAxis tick={{ fontSize: 12, fill: '#475569' }} unit="%" domain={[0, 100]} />
                          <Tooltip formatter={(val: any, name: any) => [`${Number(val).toFixed(2)}%`, name]} contentStyle={{ backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #93C5FD', fontSize: '12px', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                          <Legend iconSize={13} wrapperStyle={{ fontSize: '15px', fontWeight: 700, paddingTop: '15px' }} />
                          <Line type="monotone" dataKey="trained_rate" name="Total Trained %" stroke="#2563EB" strokeWidth={3} dot={{ r: 5, fill: '#2563EB' }}>
                            <LabelList dataKey="trained_rate" position="top" formatter={(v: any) => (v && Number(v) > 0 ? `${Number(v).toFixed(2)}%` : '')} fill="#1D4ED8" fontSize={11} fontWeight={700} offset={8} />
                          </Line>
                          <Line type="monotone" dataKey="regular_dropout_rate" name="Regular Dropout %" stroke="#1E3A8A" strokeWidth={2.5} strokeDasharray="4 2" dot={{ r: 4, fill: '#1E3A8A' }} />
                          <Line type="monotone" dataKey="initial_dropout_rate" name="Initial Dropout %" stroke="#38BDF8" strokeWidth={2.5} strokeDasharray="2 2" dot={{ r: 4, fill: '#38BDF8' }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Monthly Numerical Table */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                    <h5 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Cohort Monthly Numerical Summary</h5>
                    <div className="overflow-x-auto border border-slate-200 rounded-xl">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100 text-[11px] font-bold text-slate-600 uppercase border-b border-slate-200">
                          <tr>
                            <th className="px-4 py-2.5">Month</th>
                            <th className="px-4 py-2.5 text-right">Trained %</th>
                            <th className="px-4 py-2.5 text-right">Dropout %</th>
                            <th className="px-4 py-2.5 text-right">Initial %</th>
                            <th className="px-4 py-2.5 text-right">Regular %</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono">
                          {trend.map((t: any) => (
                            <tr key={t.month} className="hover:bg-slate-50">
                              <td className="px-4 py-2 font-bold text-slate-900">{t.month}</td>
                              <td className="px-4 py-2 text-right text-blue-600 font-bold">{t.trained_rate}%</td>
                              <td className="px-4 py-2 text-right text-blue-800 font-bold">{t.dropout_rate}%</td>
                              <td className="px-4 py-2 text-right text-sky-600">{t.initial_dropout_rate}%</td>
                              <td className="px-4 py-2 text-right text-blue-900">{t.regular_dropout_rate}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* --- 5. STUDENT LIFECYCLE OUTCOME FULLSCREEN --- */}
              {fullscreenChart === 'lifecycle' && (
                <div className="space-y-6">
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <GraduationCap className="w-4 h-4 text-emerald-600" />
                        <h4 className="text-sm font-bold text-slate-900">Student Lifecycle Outcome Proportions</h4>
                      </div>
                      <span className="text-xs font-mono font-bold text-slate-600">Total: {kpis.total_students.toLocaleString()} Students</span>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                      <div className="h-[420px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={outcomeComposition}
                              cx="50%"
                              cy="50%"
                              innerRadius={80}
                              outerRadius={140}
                              paddingAngle={4}
                              dataKey="value"
                              label={({ name, percent }) => `${name}: ${percent ? (percent * 100).toFixed(1) : 0}%`}
                            >
                              {outcomeComposition.map((entry, idx) => (
                                <Cell key={`cell-fullscreen-outcome-${idx}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(val: any, name: any) => [`${val.toLocaleString()} students (${((val / kpis.total_students) * 100).toFixed(1)}%)`, name]} contentStyle={{ backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #93C5FD', fontSize: '12px' }} />
                            <Legend iconSize={13} wrapperStyle={{ fontSize: '15px', fontWeight: 700, paddingTop: '15px' }} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>

                      <div className="space-y-4">
                        <h5 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Detailed Outcome Metrics</h5>
                        <div className="space-y-3">
                          {outcomeComposition.map((d) => {
                            const pct = kpis.total_students > 0 ? ((d.value / kpis.total_students) * 100).toFixed(1) : '0';
                            return (
                              <div key={d.name} className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: d.color }}></div>
                                    <span className="font-bold text-slate-900 text-sm">{d.name}</span>
                                  </div>
                                  <span className="font-bold font-mono text-slate-900 text-sm">{d.value.toLocaleString()} students</span>
                                </div>
                                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: d.color }}></div>
                                </div>
                                <div className="text-right text-xs font-mono font-semibold text-slate-500">{pct}% of total enrollments</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
