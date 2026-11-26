import React, { useState, useEffect } from 'react';
import { consolidateUpvanDharClient } from '../utils/diyaConsolidation';
import {
  AlertTriangle,
  Users,
  Building2,
  BookOpen,
  Briefcase,
  Search,
  Download,
  Filter,
  Layers,
  Percent,
  RotateCcw,
  X,
  ChevronRight,
  Maximize2,
  Minimize2,
  BarChart3,
  CheckCircle2,
  UserCheck,
  Clock
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  LabelList
} from 'recharts';
import { SourceRow, FilterParams, FilterOptions } from '../types';
import { ProgramMultiSelect } from '../components/ProgramMultiSelect';
import { RmMultiSelect } from '../components/RmMultiSelect';
import { CenterMultiSelect } from '../components/CenterMultiSelect';
import { getScopedFilterOptions, isCollegeModelProgram } from '../utils/filterHierarchy';
import { api } from '../api';

interface ExceptionAnalyticsProps {
  data: any;
  loading: boolean;
  filters?: FilterParams;
  filterOptions?: FilterOptions;
  onFilterChange?: (newFilters: FilterParams) => void;
  onSelectCenterDrilldown?: (center: string) => void;
  onSelectRecord?: (record: SourceRow) => void;
  onOpenPresenter?: (charts?: any[], startIndex?: number) => void;
  onNavigateToUpload?: () => void;
}

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
        {formatted}
      </text>
    </g>
  );
};

export const ExceptionAnalytics: React.FC<ExceptionAnalyticsProps> = ({
  data,
  loading,
  filters,
  filterOptions,
  onFilterChange,
  onSelectCenterDrilldown,
  onSelectRecord,
  onOpenPresenter,
  onNavigateToUpload,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeChartTab, setActiveChartTab] = useState<'all' | 'rm' | 'center' | 'program' | 'trainer'>('all');
  const [breakdownMetric, setBreakdownMetric] = useState<'rate' | 'volume'>('rate');
  const [rmMetric, setRmMetric] = useState<'rate' | 'volume'>('rate');
  const [centerMetric, setCenterMetric] = useState<'rate' | 'volume'>('rate');
  const [programMetric, setProgramMetric] = useState<'rate' | 'volume'>('rate');
  const [fullscreenChart, setFullscreenChart] = useState<'rm' | 'center' | 'program' | 'trainer' | null>(null);
  const [exportingChart, setExportingChart] = useState<string | null>(null);

  const handleGlobalMetricChange = (metric: 'rate' | 'volume') => {
    setBreakdownMetric(metric);
    setRmMetric(metric);
    setCenterMetric(metric);
    setProgramMetric(metric);
  };

  const handleExportChartExcel = async (
    chartType: 'rm' | 'center' | 'program' | 'trainer' | 'all',
    chartTitle: string,
    chartSummary: any[]
  ) => {
    try {
      setExportingChart(chartType);
      await api.exportChartRawExcel({
        module: 'exception',
        chartType,
        chartTitle,
        filters: filters || {},
        chartSummary,
      });
    } catch (err) {
      console.error('Failed to export Exception chart raw data:', err);
    } finally {
      setExportingChart(null);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && fullscreenChart) {
        setFullscreenChart(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fullscreenChart]);

  if (loading && !data) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-28 bg-slate-200 rounded-2xl"></div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 bg-slate-200 rounded-xl"></div>
          ))}
        </div>
        <div className="h-96 bg-slate-200 rounded-2xl"></div>
      </div>
    );
  }

  const kpis = data?.kpis || {
    total_students: 0,
    total_records: 0,
    total_exceptions: 0,
    exception_rate: 0,
  };

  const by_rm = data?.by_rm || [];
  const by_center = data?.by_center || [];
  const by_program = data?.by_program || [];
  const by_trainer = data?.by_trainer || [];
  const center_table = data?.center_table || [];

  const currentProgramType = filters?.programType || 'Diya Only';
  const currentRmShZh = filters?.rmShZh || 'ALL';
  const currentCenterCode = filters?.centerCode || 'ALL';
  const currentProgramName = filters?.programName || 'ALL';
  const currentStudentStatus = filters?.studentStatus || 'ALL';

  const scopedOptions = getScopedFilterOptions(filterOptions, filters);

  const handleProgramTypeSelect = (type: string) => {
    if (!onFilterChange) return;
    onFilterChange({
      ...filters,
      programType: type,
    });
  };

  const handleRmsChange = (selected: string[]) => {
    if (!onFilterChange) return;
    onFilterChange({
      ...filters,
      rmShZhs: selected.length > 0 ? selected : undefined,
      rmShZh: selected.length === 1 ? selected[0] : (selected.length > 1 ? selected.join(',') : undefined),
    });
  };

  const handleRmShZhChange = (val: string) => {
    handleRmsChange(val === 'ALL' || !val ? [] : [val]);
  };

  const handleCentersChange = (selected: string[]) => {
    if (!onFilterChange) return;
    onFilterChange({
      ...filters,
      centerCodes: selected.length > 0 ? selected : undefined,
      centerCode: selected.length === 1 ? selected[0] : (selected.length > 1 ? selected.join(',') : undefined),
    });
  };

  const handleCenterCodeChange = (val: string) => {
    handleCentersChange(val === 'ALL' || !val ? [] : [val]);
  };

  const handleProgramsChange = (selected: string[]) => {
    if (!onFilterChange) return;
    onFilterChange({
      ...filters,
      programNames: selected.length > 0 ? selected : undefined,
      programName: selected.length === 1 ? selected[0] : (selected.length > 1 ? selected.join(',') : undefined),
    });
  };

  const handleProgramNameChange = (val: string) => {
    handleProgramsChange(val === 'ALL' || !val ? [] : [val]);
  };

  const handleStudentStatusChange = (val: string) => {
    if (!onFilterChange) return;
    onFilterChange({
      ...filters,
      studentStatus: val === 'ALL' ? undefined : val,
    });
  };

  const clearAppliedFilters = () => {
    if (!onFilterChange) return;
    onFilterChange({
      ...filters,
      rmShZh: undefined,
      rmShZhs: undefined,
      centerCode: undefined,
      centerCodes: undefined,
      programName: undefined,
      programNames: undefined,
      assignedAe: undefined,
      assignedAes: undefined,
      assignedTrainer: undefined,
      studentStatus: undefined,
      startDate: undefined,
      endDate: undefined,
      programType: 'Diya and Deeptech',
    });
  };

  const currentProgramNames = scopedOptions.selectedPrograms;
  const currentCenterCodes = scopedOptions.selectedCenters;
  const currentRmShZhs = scopedOptions.selectedRms;
  const hasActiveLocalFilter =
    currentRmShZhs.length > 0 ||
    currentCenterCodes.length > 0 ||
    currentProgramNames.length > 0 ||
    Boolean(filters?.startDate) ||
    Boolean(filters?.endDate) ||
    (currentStudentStatus && currentStudentStatus !== 'ALL') ||
    (currentProgramType && currentProgramType !== 'Diya and Deeptech');

  const raw_by_rm = consolidateUpvanDharClient(by_rm || [], currentProgramType);
  const sorted_by_rm = [...raw_by_rm]
    .map((item: any) => ({
      ...item,
      students: Number(item.students ?? item.total_students ?? 0),
      trained_students: Number(item.trained_students ?? item.total_trained ?? 0),
      total_exceptions: Number(item.total_exceptions ?? 0),
    }))
    .sort((a: any, b: any) => (Number(b.exception_rate) || 0) - (Number(a.exception_rate) || 0) || (Number(b.total_exceptions) || 0) - (Number(a.total_exceptions) || 0));

  const sorted_by_center = [...by_center]
    .map((item: any) => ({
      ...item,
      students: Number(item.students ?? item.total_students ?? 0),
      trained_students: Number(item.trained_students ?? item.total_trained ?? 0),
      total_exceptions: Number(item.total_exceptions ?? 0),
    }))
    .sort((a: any, b: any) => (Number(b.exception_rate) || 0) - (Number(a.exception_rate) || 0) || (Number(b.total_exceptions) || 0) - (Number(a.total_exceptions) || 0));

  const raw_by_program = [...by_program]
    .map((item: any) => ({
      ...item,
      students: Number(item.students ?? item.total_students ?? 0),
      trained_students: Number(item.trained_students ?? item.total_trained ?? 0),
      total_exceptions: Number(item.total_exceptions ?? 0),
    }))
    .sort((a: any, b: any) => (Number(b.total_exceptions) || 0) - (Number(a.total_exceptions) || 0) || (Number(b.students) || 0) - (Number(a.students) || 0));

  const totalProgramExceptionsSum = raw_by_program.reduce((sum: number, item: any) => sum + (Number(item.total_exceptions) || 0), 0);
  const normalized_by_program = (() => {
    if (totalProgramExceptionsSum <= 0 || raw_by_program.length === 0) {
      return raw_by_program.map((item: any) => ({ ...item, exception_rate: 0 }));
    }
    const rawTenths = raw_by_program.map((item: any) => ((Number(item.total_exceptions) || 0) / totalProgramExceptionsSum) * 1000);
    const tenths = rawTenths.map((val: number, idx: number) =>
      (Number(raw_by_program[idx].total_exceptions) || 0) > 0 ? Math.max(1, Math.floor(val)) : 0
    );
    const currentSum = tenths.reduce((a: number, b: number) => a + b, 0);

    if (currentSum < 1000) {
      let diff = 1000 - currentSum;
      const order = rawTenths
        .map((val: number, idx: number) => ({ idx, rem: val - tenths[idx] }))
        .sort((a, b) => b.rem - a.rem || a.idx - b.idx);
      for (let i = 0; i < order.length && diff > 0; i++) {
        tenths[order[i].idx] += 1;
        diff--;
      }
    } else if (currentSum > 1000) {
      let diff = currentSum - 1000;
      const order = rawTenths
        .map((val: number, idx: number) => ({ idx, rem: val - tenths[idx] }))
        .sort((a, b) => a.rem - b.rem || b.idx - a.idx);
      for (let i = 0; i < order.length && diff > 0; i++) {
        if (tenths[order[i].idx] > 1) {
          tenths[order[i].idx] -= 1;
          diff--;
        }
      }
    }

    return raw_by_program.map((item: any, idx: number) => ({
      ...item,
      exception_rate: Number((tenths[idx] / 10).toFixed(1)),
    }));
  })();

  const sorted_by_program = [...normalized_by_program].sort(
    (a: any, b: any) =>
      (Number(b.exception_rate) || 0) - (Number(a.exception_rate) || 0) ||
      (Number(b.total_exceptions) || 0) - (Number(a.total_exceptions) || 0)
  );

  const sorted_by_trainer = [...by_trainer]
    .sort((a: any, b: any) => (Number(b.exception_rate) || 0) - (Number(a.exception_rate) || 0) || (Number(b.total_exceptions) || 0) - (Number(a.total_exceptions) || 0));

  const filteredCenters = center_table
    .filter((c: any) => (c.center_code || '').toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a: any, b: any) => (Number(b.exception_rate) || 0) - (Number(a.exception_rate) || 0) || (Number(b.total_exceptions) || 0) - (Number(a.total_exceptions) || 0));

  const exportCenterCsv = () => {
    if (!filteredCenters || filteredCenters.length === 0) return;
    const headers = [
      'Center Code',
      'Total Students',
      'Trained Students',
      'Total Exception',
      'Exception % (vs Trained)',
      'Batches'
    ];
    const csvRows = [
      headers.join(','),
      ...filteredCenters.map((c: any) => {
        const s = Number(c.students || c.total_students) || 0;
        const tr = Number(c.trained_students) || 0;
        const totEx = Number(c.total_exceptions) || 0;
        const totRate = c.exception_rate ?? (tr > 0 ? ((totEx / tr) * 100).toFixed(1) : '0');
        return [
          `"${c.center_code || ''}"`,
          s,
          tr,
          totEx,
          `${totRate}%`,
          c.batches || 0,
        ].join(',');
      })
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Exception_Analytics_Center_Summary_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalStudentsCount = Number(kpis.total_students ?? kpis.total_records) || 0;
  const totalTrainedCount = Number(kpis.total_trained) || 0;
  const totalExceptionsCount = Number(kpis.total_exceptions) || 0;
  const specialApprovalsCount = Number(kpis.special_approvals) || 0;
  const specialCasesCount = Number(kpis.special_cases_count) || 0;
  // Exceptions are counted strictly against trained candidates
  const exceptionRateVal = kpis.exception_rate ?? (totalTrainedCount > 0 ? Number(((totalExceptionsCount / totalTrainedCount) * 100).toFixed(2)) : 0);

  const studentStatusOptions = filterOptions?.studentStatuses && filterOptions.studentStatuses.length > 0
    ? filterOptions.studentStatuses
    : [
        'Running',
        'Placed',
        'Placed By Anudip CRD',
        'Placed By Anudip Center/Local',
        'Self Placed',
        'Placed By College/Campus',
        'dropped out',
      ];

  return (
    <div className="space-y-6">
      {/* Exception Calculation Formula & Business Policy Guide */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3.5">
        <div className="flex items-center justify-between flex-wrap gap-2 pb-2.5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-[#E6F4F5] text-[#008C95] rounded-lg border border-[#CCECF0]">
              <Layers className="w-4 h-4" />
            </span>
            <div>
              <h3 className="text-xs font-bold text-slate-900">Anudip Standard Exception Logic</h3>
              <p className="text-[11px] text-slate-500">
                Evaluated on <b>Trained Count = 1</b> (otherwise <b>0</b>). <b>Student Status = &quot;Running&quot;</b> when <b>Enrollment Status = &quot;Enrolled&quot;</b> &amp; <b>Placement Type = &quot; &quot;</b>, else placement categories.
              </p>
            </div>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold border border-slate-200">
            =IF(Trained&lt;&gt;1, 0, IF(AND(Placed, Complete, Joining&gt;ActualEnd), IF(AND(ILT&ge;90%, Att&ge;MIN(ILT*50%,50%)),0,1), ...))
          </span>
        </div>

        {/* 3 Operational Exception Cohort Rules */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          {/* Rule 1: Running & Post-Batch Joining */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 text-[11px]">1. Running / Joining &gt; Actual End</span>
              <span className="text-[9px] font-mono bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-bold">ILT &ge; 90%</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-normal">
              Compliant (<b>0</b>) if <b>ILT completion% &ge; 90%</b> AND <b>Beneficiary Attendance &ge; Min(ILT*50%, 50%)</b>, else <b className="text-rose-600">1</b>
            </p>
            <div className="text-[10px] text-slate-400 font-mono">Student Status = &quot;Running&quot; OR (Placed &amp; Joining Date &gt; Actual End Date)</div>
          </div>

          {/* Rule 2: CRD / Center Local */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 text-[11px]">2. Anudip CRD / Center Local</span>
              <span className="text-[9px] font-mono bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold">ILT_as_on_Joining_Date &ge; 70%</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-normal">
              Compliant (<b>0</b>) if <b>ILT_as_on_Joining_Date &ge; 70%</b> AND <b>Beneficiary Attendance &ge; Min(ILT_as_on_Joining_Date*50%, 50%)</b>, else <b className="text-rose-600">1</b>
            </p>
            <div className="text-[10px] text-slate-400 font-mono">Placed By Anudip CRD / Placed By Anudip Center/Local</div>
          </div>

          {/* Rule 3: Self Placed / College Campus */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 text-[11px]">3. Self / College Campus</span>
              <span className="text-[9px] font-mono bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded font-bold">ILT_as_on_Joining_Date &ge; 50%</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-normal">
              Compliant (<b>0</b>) if <b>ILT_as_on_Joining_Date &ge; 50%</b> AND <b>Beneficiary Attendance &ge; Min(ILT_as_on_Joining_Date*50%, 50%)</b>, else <b className="text-rose-600">1</b>
            </p>
            <div className="text-[10px] text-slate-400 font-mono">Self Placed / Placed By College/Campus</div>
          </div>
        </div>

        {/* Dual-File Pipeline & Dropout Isolation Notice */}
        <div className="pt-3 border-t border-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs bg-slate-50/70 p-3 rounded-xl border border-slate-200/60">
          <div className="flex items-start gap-2.5">
            <div className="p-1 rounded-md bg-[#E6F4F5] text-[#008C95] shrink-0 mt-0.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="font-bold text-slate-900 flex items-center gap-2">
                <span>Exception Calculation Rules</span>
                <span className="px-2 py-0.2 rounded text-[10px] font-mono bg-amber-100 text-amber-900 font-bold border border-amber-300">
                  Trained Count &lt;&gt; 1 = 0 Exceptions
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                If <b>Trained Count &lt;&gt; 1</b>, exception is <b>0</b>. For <b>Enrollment Status = &quot;Enrolled&quot;</b> and <b>Placement Type = &quot; &quot;</b>, Student Status is <b>Running</b>; otherwise it follows the placement categories above.
              </p>
            </div>
          </div>

          {onNavigateToUpload && (
            <button
              onClick={onNavigateToUpload}
              className="px-3 py-1.5 bg-[#008C95] hover:bg-[#00747C] text-white font-semibold rounded-lg text-xs transition-colors shrink-0 cursor-pointer shadow-2xs flex items-center gap-1.5"
            >
              <span>Upload Exception Files</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Exception Interactive Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3.5 relative z-30">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center flex-wrap gap-2">
              <div className="p-1.5 bg-[#E6F4F5] rounded-lg text-[#008C95]">
                <Filter className="w-4 h-4" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Academic &amp; Attendance Exceptions</h3>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-[#E6F4F5] text-[#005F66] border border-[#CCECF0]">
                {currentProgramType}
              </span>
              {currentRmShZhs.length > 0 && (
                <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  <Users className="w-3 h-3" />
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
              {currentStudentStatus !== 'ALL' && (
                <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full font-semibold bg-violet-50 text-violet-800 border border-violet-200">
                  <UserCheck className="w-3 h-3" />
                  <span>Status: {currentStudentStatus}</span>
                  <button
                    onClick={() => handleStudentStatusChange('ALL')}
                    className="ml-0.5 hover:text-violet-950 cursor-pointer"
                    title="Clear Student Status filter"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
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
              {hasActiveLocalFilter && (
                <button
                  onClick={clearAppliedFilters}
                  className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Reset all filters"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset</span>
                </button>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Analyze exceptions across Program Type, Regional Managers, Centers &amp; Programs
            </p>
          </div>

          {/* Program Type Filter Options */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200 self-start md:self-auto shrink-0">
            {[
              { id: 'Diya Only', label: 'Diya Only', tooltip: 'Diya programs only' },
              { id: 'Deeptech Only', label: 'Deeptech Only', tooltip: 'Deep Tech programs only (across all funders & RMs)' },
              { id: 'Diya and Deeptech', label: 'Diya and Deeptech', tooltip: 'Combined: Diya programs + Deep Tech designated cohort' },
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
          {/* RM / SH / ZH Multi-Select Filter with embedded Program selection */}
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

          {/* Student Status Select Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200 shadow-2xs">
            <UserCheck className="w-3.5 h-3.5 text-violet-600 shrink-0" />
            <span className="text-[11px] font-semibold text-slate-600 whitespace-nowrap">Student Status:</span>
            <select
              value={currentStudentStatus}
              onChange={(e) => handleStudentStatusChange(e.target.value)}
              className="bg-white border border-slate-300 rounded-md px-2 py-1 text-xs text-slate-800 font-medium focus:outline-hidden focus:ring-1 focus:ring-[#008C95] max-w-[210px] cursor-pointer"
              title='Formula: Enrollment Status = "enrolled" && Placement Type <> " " -> "Enrolled", Enrollment Status = "dropped out" -> "dropped out", otherwise Placement Type'
            >
              <option value="ALL">
                All Student Statuses {studentStatusOptions.length ? `(${studentStatusOptions.length})` : ''}
              </option>
              {studentStatusOptions.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 1. Exception KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Component 1: Total Students (including dropouts) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Students</span>
            <div className="text-2xl sm:text-3xl font-bold font-mono text-slate-900 mt-1.5 tabular-nums">
              {totalStudentsCount.toLocaleString()}
            </div>
            <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-slate-400"></span>
              <span>Enrolled Students (Excluding Dropouts)</span>
            </div>
          </div>
          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-slate-600">
            <Users className="w-6 h-6" />
          </div>
        </div>

        {/* Component: Total Trained Candidates */}
        <div className="bg-white p-5 rounded-2xl border border-blue-200/90 bg-blue-50/20 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wider">Trained Candidates</span>
            <div className="text-2xl sm:text-3xl font-bold font-mono text-blue-600 mt-1.5 tabular-nums">
              {totalTrainedCount.toLocaleString()}
            </div>
            <div className="text-xs text-blue-700/80 mt-1 flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-blue-500"></span>
              <span>Evaluated Cohort (Marks &ge; 50)</span>
            </div>
          </div>
          <div className="p-3 bg-blue-50 rounded-2xl border border-blue-100 text-blue-600">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        {/* Component 2: Total Exception (Excluding Special Cases) */}
        <div className="bg-white p-5 rounded-2xl border border-rose-200/90 bg-rose-50/20 shadow-xs flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wider">Total Exception</span>
              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                Excl. Special Cases
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-bold font-mono text-rose-600 mt-1.5 tabular-nums">
              {totalExceptionsCount.toLocaleString()}
            </div>
            <div className="text-xs text-rose-700/80 mt-1 flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-rose-500"></span>
              <span>Threshold Non-Compliant (Excludes Special Cases)</span>
            </div>
          </div>
          <div className="p-3 bg-rose-50 rounded-2xl border border-rose-100 text-rose-600">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

        {/* Component 3: Exception % */}
        <div className="bg-white p-5 rounded-2xl border border-rose-200/90 bg-rose-50/20 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wider">Exception %</span>
            <div className="text-2xl sm:text-3xl font-bold font-mono text-rose-600 mt-1.5 tabular-nums">
              {exceptionRateVal}%
            </div>
            <div className="text-xs text-rose-700/80 mt-1 flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-rose-500"></span>
              <span>Total Exception / Trained Candidates</span>
            </div>
          </div>
          <div className="p-3 bg-rose-50 rounded-2xl border border-rose-100 text-rose-600">
            <Percent className="w-6 h-6" />
          </div>
        </div>

        {/* Component 4: Special Case (1) Exempt */}
        <div className="bg-white p-5 rounded-2xl border border-amber-200/90 bg-amber-50/20 shadow-xs flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">Special Case (1)</span>
              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                Exempt
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-bold font-mono text-amber-700 mt-1.5 tabular-nums">
              {specialCasesCount.toLocaleString()}
            </div>
            <div className="text-xs text-amber-800/80 mt-1 flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-amber-500"></span>
              <span>Not Updated as Exception</span>
            </div>
          </div>
          <div className="p-3 bg-amber-50 rounded-2xl border border-amber-100 text-amber-600">
            <CheckCircle2 className="w-6 h-6" />
          </div>
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
            { id: 'trainer', label: 'Trainer Wise', icon: Briefcase, color: 'text-amber-600' },
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
            Exception Rate (%)
          </button>
          <button
            onClick={() => handleGlobalMetricChange('volume')}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer transition-all ${
              breakdownMetric === 'volume'
                ? 'bg-white text-slate-900 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Total Exception Count
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. BREAKDOWN CHARTS: RM WISE, CENTER WISE, PROGRAM WISE, TRAINER WISE      */}
      {/* ========================================================================= */}
      <div className="space-y-6">
        {/* --- RM WISE EXCEPTION CHART --- */}
        {(activeChartTab === 'all' || activeChartTab === 'rm') && (
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-indigo-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">RM Wise Exception Breakdown</h3>
                  <p className="text-[11px] text-slate-500">
                    Regional Manager distribution of Total Students, Total Exceptions &amp; Exception Rate %
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs font-medium flex-wrap">
                {rmMetric === 'rate' ? (
                  <span className="inline-flex items-center gap-1.5 text-sm text-rose-700 font-bold">
                    <span className="w-3 h-3 rounded-xs bg-rose-500" /> Exception %
                  </span>
                ) : (
                  <>
                    <span className="inline-flex items-center gap-1.5 text-sm text-blue-700 font-bold">
                      <span className="w-3 h-3 rounded-xs bg-blue-500" /> Total Student Count
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-sm text-emerald-700 font-bold">
                      <span className="w-3 h-3 rounded-xs bg-emerald-500" /> Total Trained Count
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-sm text-rose-700 font-bold">
                      <span className="w-3 h-3 rounded-xs bg-rose-500" /> Total Exception
                    </span>
                  </>
                )}
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
                    Exception Rate (%)
                  </button>
                  <button
                    onClick={() => setRmMetric('volume')}
                    className={`px-2 py-0.5 rounded-md text-[11px] font-semibold cursor-pointer transition-all ${
                      rmMetric === 'volume'
                        ? 'bg-white text-slate-900 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Total Exception Count
                  </button>
                </div>
                <button
                  onClick={() => handleExportChartExcel('rm', 'Exceptions_RM_Wise_Breakdown', sorted_by_rm)}
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
                  title="Open RM Exception Chart in Presentation Mode"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>Presentation Mode</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 h-[460px]">
                <ResponsiveContainer width="100%" height="100%">
                  {rmMetric === 'rate' ? (
                    <BarChart data={sorted_by_rm} margin={{ top: 32, right: 24, left: 6, bottom: 65 }} barGap={6} barCategoryGap="25%">
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis dataKey="name" interval={0} height={65} tick={renderRotatedTick} />
                      <YAxis unit="%" domain={[0, (dataMax: number) => Math.max(10, Math.ceil(dataMax * 1.35 + 2))]} tick={{ fontSize: 11, fill: '#64748B' }} />
                      <Tooltip formatter={(val: any, name: any) => [`${val}%`, 'Exception %']} contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #FECDD3', fontSize: '11px' }} />
                      <Legend iconSize={12} wrapperStyle={{ fontSize: '14px', fontWeight: 700, paddingTop: '12px' }} />
                      <Bar dataKey="exception_rate" name="Exception %" fill="#E11D48" barSize={24} radius={[4, 4, 0, 0]}>
                        <LabelList dataKey="exception_rate" position="top" formatter={(v: any) => (v && Number(v) > 0 ? `${v}%` : '')} fill="#BE123C" fontSize={10} fontWeight={700} offset={6} />
                      </Bar>
                    </BarChart>
                  ) : (
                    <BarChart data={sorted_by_rm} margin={{ top: 32, right: 24, left: 6, bottom: 65 }} barGap={3} barCategoryGap="20%">
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis dataKey="name" interval={0} height={65} tick={renderRotatedTick} />
                      <YAxis domain={[0, (dataMax: number) => Math.max(10, Math.ceil(dataMax * 1.3 + 2))]} tick={{ fontSize: 11, fill: '#64748B' }} />
                      <Tooltip formatter={(val: any, name: any) => [Number(val || 0).toLocaleString(), name]} contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #FECDD3', fontSize: '11px' }} />
                      <Legend iconSize={12} wrapperStyle={{ fontSize: '14px', fontWeight: 700, paddingTop: '12px' }} />
                      <Bar dataKey="students" name="Total Student Count" fill="#3B82F6" barSize={16} radius={[4, 4, 0, 0]}>
                        <LabelList dataKey="students" position="top" formatter={(v: any) => (v && Number(v) > 0 ? Number(v).toLocaleString() : '')} fill="#1D4ED8" fontSize={9} fontWeight={700} offset={5} />
                      </Bar>
                      <Bar dataKey="trained_students" name="Total Trained Count" fill="#10B981" barSize={16} radius={[4, 4, 0, 0]}>
                        <LabelList dataKey="trained_students" position="top" formatter={(v: any) => (v && Number(v) > 0 ? Number(v).toLocaleString() : '')} fill="#047857" fontSize={9} fontWeight={700} offset={5} />
                      </Bar>
                      <Bar dataKey="total_exceptions" name="Total Exception" fill="#E11D48" barSize={16} radius={[4, 4, 0, 0]}>
                        <LabelList dataKey="total_exceptions" position="top" formatter={(v: any) => (v && Number(v) > 0 ? Number(v).toLocaleString() : '')} fill="#BE123C" fontSize={9} fontWeight={700} offset={5} />
                      </Bar>
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>

              <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  RM Exception Ranking ({sorted_by_rm.length})
                </span>
                {sorted_by_rm.map((rm: any, idx: number) => (
                  <button
                    key={`${rm.name}_${idx}`}
                    onClick={() => handleRmShZhChange(rm.name === currentRmShZh ? 'ALL' : rm.name)}
                    className={`w-full text-left p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                      currentRmShZh === rm.name
                        ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-200'
                        : 'bg-slate-50/70 hover:bg-slate-100 border-slate-200/70'
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-900 truncate">{rm.name}</span>
                        {currentRmShZh === rm.name && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-600 text-white font-semibold">Active Filter</span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-2">
                        <span>Total: <b className="font-mono font-bold text-slate-700">{rm.students.toLocaleString()}</b></span>
                        <span>&bull;</span>
                        <span>Trained: <b className="font-mono font-bold text-blue-700">{rm.trained_students?.toLocaleString() || 0}</b></span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs font-mono font-bold text-rose-600">{rm.exception_rate}%</div>
                      <div className="text-[10px] text-slate-500 font-mono">{rm.total_exceptions.toLocaleString()} exceptions</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* --- CENTER WISE EXCEPTION CHART --- */}
        {(activeChartTab === 'all' || activeChartTab === 'center') && (
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-cyan-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Center Wise Exception Analysis</h3>
                  <p className="text-[11px] text-slate-500">
                    Highest exception centers with total student count, exception volume &amp; quick drill-down
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs font-medium flex-wrap">
                {centerMetric === 'rate' ? (
                  <span className="inline-flex items-center gap-1.5 text-sm text-cyan-800 font-bold">
                    <span className="w-3 h-3 rounded-xs bg-cyan-600" /> Exception %
                  </span>
                ) : (
                  <>
                    <span className="inline-flex items-center gap-1.5 text-sm text-blue-700 font-bold">
                      <span className="w-3 h-3 rounded-xs bg-blue-500" /> Total Student Count
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-sm text-emerald-700 font-bold">
                      <span className="w-3 h-3 rounded-xs bg-emerald-500" /> Total Trained Count
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-sm text-rose-700 font-bold">
                      <span className="w-3 h-3 rounded-xs bg-rose-500" /> Total Exception
                    </span>
                  </>
                )}
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
                    Exception Rate (%)
                  </button>
                  <button
                    onClick={() => setCenterMetric('volume')}
                    className={`px-2 py-0.5 rounded-md text-[11px] font-semibold cursor-pointer transition-all ${
                      centerMetric === 'volume'
                        ? 'bg-white text-slate-900 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Total Exception Count
                  </button>
                </div>
                <button
                  onClick={() => handleExportChartExcel('center', 'Exceptions_Center_Wise_Breakdown', sorted_by_center)}
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
                  title="Open Center Exception Chart in Presentation Mode"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>Presentation Mode</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 h-[460px]">
                <ResponsiveContainer width="100%" height="100%">
                  {centerMetric === 'rate' ? (
                    <BarChart data={sorted_by_center} margin={{ top: 32, right: 24, left: 6, bottom: 65 }} barGap={6} barCategoryGap="25%">
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis dataKey="name" interval={0} height={65} tick={renderRotatedTick} />
                      <YAxis unit="%" domain={[0, (dataMax: number) => Math.max(10, Math.ceil(dataMax * 1.35 + 2))]} tick={{ fontSize: 11, fill: '#64748B' }} />
                      <Tooltip formatter={(val: any, name: any) => [`${val}%`, 'Exception %']} contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #FECDD3', fontSize: '11px' }} />
                      <Legend iconSize={12} wrapperStyle={{ fontSize: '14px', fontWeight: 700, paddingTop: '12px' }} />
                      <Bar dataKey="exception_rate" name="Exception %" fill="#0284C7" barSize={24} radius={[4, 4, 0, 0]}>
                        <LabelList dataKey="exception_rate" position="top" formatter={(v: any) => (v && Number(v) > 0 ? `${v}%` : '')} fill="#0369A1" fontSize={10} fontWeight={700} offset={6} />
                      </Bar>
                    </BarChart>
                  ) : (
                    <BarChart data={sorted_by_center} margin={{ top: 32, right: 24, left: 6, bottom: 65 }} barGap={3} barCategoryGap="20%">
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis dataKey="name" interval={0} height={65} tick={renderRotatedTick} />
                      <YAxis domain={[0, (dataMax: number) => Math.max(10, Math.ceil(dataMax * 1.3 + 2))]} tick={{ fontSize: 11, fill: '#64748B' }} />
                      <Tooltip formatter={(val: any, name: any) => [Number(val || 0).toLocaleString(), name]} contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #BAE6FD', fontSize: '11px' }} />
                      <Legend iconSize={12} wrapperStyle={{ fontSize: '14px', fontWeight: 700, paddingTop: '12px' }} />
                      <Bar dataKey="students" name="Total Student Count" fill="#3B82F6" barSize={15} radius={[4, 4, 0, 0]}>
                        <LabelList dataKey="students" position="top" formatter={(v: any) => (v && Number(v) > 0 ? Number(v).toLocaleString() : '')} fill="#1D4ED8" fontSize={8.5} fontWeight={700} offset={5} />
                      </Bar>
                      <Bar dataKey="trained_students" name="Total Trained Count" fill="#10B981" barSize={15} radius={[4, 4, 0, 0]}>
                        <LabelList dataKey="trained_students" position="top" formatter={(v: any) => (v && Number(v) > 0 ? Number(v).toLocaleString() : '')} fill="#047857" fontSize={8.5} fontWeight={700} offset={5} />
                      </Bar>
                      <Bar dataKey="total_exceptions" name="Total Exception" fill="#E11D48" barSize={15} radius={[4, 4, 0, 0]}>
                        <LabelList dataKey="total_exceptions" position="top" formatter={(v: any) => (v && Number(v) > 0 ? Number(v).toLocaleString() : '')} fill="#BE123C" fontSize={8.5} fontWeight={700} offset={5} />
                      </Bar>
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>

              <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Top Exception Centers ({sorted_by_center.length})
                </span>
                {sorted_by_center.map((c: any) => (
                  <div
                    key={c.name}
                    className="p-2.5 rounded-xl border bg-slate-50/70 hover:bg-slate-100 border-slate-200/70 transition-all flex items-center justify-between"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => onSelectCenterDrilldown && onSelectCenterDrilldown(c.name)}
                          className="text-xs font-bold text-[#008C95] hover:underline truncate text-left cursor-pointer"
                          title="Drill down into Center Batches"
                        >
                          {c.name}
                        </button>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-2">
                        <span>Total: <b className="font-mono font-bold text-slate-700">{c.students.toLocaleString()}</b></span>
                        <span>&bull;</span>
                        <span>Trained: <b className="font-mono font-bold text-blue-700">{c.trained_students?.toLocaleString() || 0}</b></span>
                      </div>
                    </div>
                    <div className="text-right shrink-0 flex items-center gap-2">
                      <div>
                        <div className="text-xs font-mono font-bold text-rose-600">{c.exception_rate}%</div>
                        <div className="text-[10px] text-slate-500 font-mono">{c.total_exceptions.toLocaleString()} exceptions</div>
                      </div>
                      {onSelectCenterDrilldown && (
                        <button
                          onClick={() => onSelectCenterDrilldown(c.name)}
                          className="p-1 rounded-md text-slate-400 hover:text-[#008C95] hover:bg-white cursor-pointer"
                          title="Drill down"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* --- PROGRAM WISE EXCEPTION CHART --- */}
        {(activeChartTab === 'all' || activeChartTab === 'program') && (
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Program Wise Exception Breakdown</h3>
                  <p className="text-[11px] text-slate-500">
                    Total student count, exception volume and rates across skilling programs
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs font-medium flex-wrap">
                {programMetric === 'rate' ? (
                  <span className="inline-flex items-center gap-1.5 text-sm text-emerald-800 font-bold">
                    <span className="w-3 h-3 rounded-xs bg-emerald-500" /> Exception %
                  </span>
                ) : (
                  <>
                    <span className="inline-flex items-center gap-1.5 text-sm text-blue-700 font-bold">
                      <span className="w-3 h-3 rounded-xs bg-blue-500" /> Total Student Count
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-sm text-emerald-700 font-bold">
                      <span className="w-3 h-3 rounded-xs bg-emerald-500" /> Total Trained Count
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-sm text-rose-700 font-bold">
                      <span className="w-3 h-3 rounded-xs bg-rose-500" /> Total Exception
                    </span>
                  </>
                )}
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
                    Exception Rate (%)
                  </button>
                  <button
                    onClick={() => setProgramMetric('volume')}
                    className={`px-2 py-0.5 rounded-md text-[11px] font-semibold cursor-pointer transition-all ${
                      programMetric === 'volume'
                        ? 'bg-white text-slate-900 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Total Exception Count
                  </button>
                </div>
                <button
                  onClick={() => handleExportChartExcel('program', 'Exceptions_Program_Wise_Breakdown', sorted_by_program)}
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
                  title="Open Program Exception Chart in Presentation Mode"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>Presentation Mode</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 h-[460px]">
                <ResponsiveContainer width="100%" height="100%">
                  {programMetric === 'rate' ? (
                    <BarChart data={sorted_by_program} margin={{ top: 32, right: 24, left: 6, bottom: 65 }} barGap={6} barCategoryGap="25%">
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis dataKey="name" interval={0} height={65} tick={renderRotatedTick} />
                      <YAxis unit="%" domain={[0, (dataMax: number) => Math.max(10, Math.ceil(dataMax * 1.35 + 2))]} tick={{ fontSize: 11, fill: '#64748B' }} />
                      <Tooltip formatter={(val: any, name: any) => [`${val}%`, 'Exception %']} contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #BBF7D0', fontSize: '11px' }} />
                      <Legend iconSize={12} wrapperStyle={{ fontSize: '14px', fontWeight: 700, paddingTop: '12px' }} />
                      <Bar dataKey="exception_rate" name="Exception %" fill="#059669" barSize={24} radius={[4, 4, 0, 0]}>
                        <LabelList dataKey="exception_rate" position="top" formatter={(v: any) => (v && Number(v) > 0 ? `${v}%` : '')} fill="#047857" fontSize={10} fontWeight={700} offset={6} />
                      </Bar>
                    </BarChart>
                  ) : (
                    <BarChart data={sorted_by_program} margin={{ top: 32, right: 24, left: 6, bottom: 65 }} barGap={3} barCategoryGap="20%">
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis dataKey="name" interval={0} height={65} tick={renderRotatedTick} />
                      <YAxis domain={[0, (dataMax: number) => Math.max(10, Math.ceil(dataMax * 1.3 + 2))]} tick={{ fontSize: 11, fill: '#64748B' }} />
                      <Tooltip formatter={(val: any, name: any) => [Number(val || 0).toLocaleString(), name]} contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #BBF7D0', fontSize: '11px' }} />
                      <Legend iconSize={12} wrapperStyle={{ fontSize: '14px', fontWeight: 700, paddingTop: '12px' }} />
                      <Bar dataKey="students" name="Total Student Count" fill="#3B82F6" barSize={16} radius={[4, 4, 0, 0]}>
                        <LabelList dataKey="students" position="top" formatter={(v: any) => (v && Number(v) > 0 ? Number(v).toLocaleString() : '')} fill="#1D4ED8" fontSize={9} fontWeight={700} offset={5} />
                      </Bar>
                      <Bar dataKey="trained_students" name="Total Trained Count" fill="#10B981" barSize={16} radius={[4, 4, 0, 0]}>
                        <LabelList dataKey="trained_students" position="top" formatter={(v: any) => (v && Number(v) > 0 ? Number(v).toLocaleString() : '')} fill="#047857" fontSize={9} fontWeight={700} offset={5} />
                      </Bar>
                      <Bar dataKey="total_exceptions" name="Total Exception" fill="#E11D48" barSize={16} radius={[4, 4, 0, 0]}>
                        <LabelList dataKey="total_exceptions" position="top" formatter={(v: any) => (v && Number(v) > 0 ? Number(v).toLocaleString() : '')} fill="#BE123C" fontSize={9} fontWeight={700} offset={5} />
                      </Bar>
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>

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
                        ? 'bg-[#E6F4F5] border-[#008C95] ring-2 ring-[#CCECF0]'
                        : 'bg-slate-50/70 hover:bg-slate-100 border-slate-200/70'
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-900 truncate">{p.name}</span>
                        {currentProgramName === p.name && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#008C95] text-white font-semibold">Filtered</span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-2">
                        <span>Total: <b className="font-mono font-bold text-slate-700">{p.students.toLocaleString()}</b></span>
                        <span>&bull;</span>
                        <span>Trained: <b className="font-mono font-bold text-blue-700">{p.trained_students?.toLocaleString() || 0}</b></span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs font-mono font-bold text-rose-600">{p.exception_rate}%</div>
                      <div className="text-[10px] text-slate-500 font-mono">{p.total_exceptions.toLocaleString()} exceptions</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* --- TRAINER WISE EXCEPTION CHART --- */}
        {(activeChartTab === 'all' || activeChartTab === 'trainer') && (
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-amber-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Exceptions by Assigned Trainer</h3>
                  <p className="text-[11px] text-slate-500">
                    Highest exception volume trainers across assigned cohorts
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => handleExportChartExcel('trainer', 'Exceptions_Trainer_Wise_Breakdown', sorted_by_trainer)}
                  disabled={exportingChart === 'trainer'}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-600 hover:text-white transition-all cursor-pointer border border-emerald-200 disabled:opacity-60"
                  title="Export chart summary and underlying raw student records to Excel for manual verification"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{exportingChart === 'trainer' ? 'Exporting...' : 'Export Raw Data (Excel)'}</span>
                </button>
                <button
                  onClick={() => setFullscreenChart('trainer')}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-[#008C95] hover:text-white transition-all cursor-pointer border border-slate-200"
                  title="Open Trainer Exception Chart in Presentation Mode"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>Presentation Mode</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 h-[420px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sorted_by_trainer} layout="vertical" margin={{ top: 10, right: 30, left: 20, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#64748B' }} />
                    <YAxis dataKey="trainer" type="category" width={140} tick={{ fontSize: 11, fill: '#334155', fontWeight: 600 }} />
                    <Tooltip formatter={(val: any, name: any) => [`${val.toLocaleString()}`, 'Total Exception']} contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #FDE68A', fontSize: '11px' }} />
                    <Legend iconSize={12} wrapperStyle={{ fontSize: '14px', fontWeight: 700, paddingTop: '10px' }} />
                    <Bar dataKey="total_exceptions" name="Total Exception" fill="#D97706" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Trainers Overview ({sorted_by_trainer.length})
                </span>
                {sorted_by_trainer.map((tr: any) => (
                  <div
                    key={tr.trainer}
                    className="p-2.5 rounded-xl border bg-slate-50/70 hover:bg-slate-100 border-slate-200/70 transition-all flex items-center justify-between"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="text-xs font-bold text-slate-900 truncate">{tr.trainer}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-2">
                        <span>Total: <b className="font-mono font-bold text-slate-700">{tr.students?.toLocaleString() || 0}</b></span>
                        <span>&bull;</span>
                        <span>Trained: <b className="font-mono font-bold text-blue-700">{tr.trained_students?.toLocaleString() || 0}</b></span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs font-mono font-bold text-rose-600">{tr.exception_rate || 0}%</div>
                      <div className="text-[10px] text-slate-500 font-mono">{tr.total_exceptions.toLocaleString()} exceptions</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 3. Center Exception Summary Table with Drilldown & Search                  */}
      {/* ========================================================================= */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3 pb-2 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Center Exception Detailed Breakdown</h3>
            <p className="text-xs text-slate-500">
              Complete Total Students, Total Exception and Exception % metrics with batch drill-down
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
                <th className="px-3.5 py-3 text-right">Total Students</th>
                <th className="px-3.5 py-3 text-right">Trained Students</th>
                <th className="px-3.5 py-3 text-right">Total Exception</th>
                <th className="px-3.5 py-3 text-right">Exception % (vs Trained)</th>
                <th className="px-3.5 py-3 text-right">Batches</th>
                <th className="px-3.5 py-3 text-right">Drill-down</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCenters.map((c: any) => {
                const s = Number(c.students || c.total_students) || 0;
                const trSt = Number(c.trained_students) || 0;
                const totEx = Number(c.total_exceptions) || 0;
                const totRate = c.exception_rate ?? (trSt > 0 ? ((totEx / trSt) * 100).toFixed(1) : '0.0');

                return (
                  <tr key={c.center_code} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-3.5 py-2.5 font-bold text-slate-900">
                      {onSelectCenterDrilldown ? (
                        <button
                          onClick={() => onSelectCenterDrilldown(c.center_code)}
                          className="text-[#008C95] hover:underline font-bold"
                        >
                          {c.center_code}
                        </button>
                      ) : (
                        <span>{c.center_code}</span>
                      )}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-mono font-medium">{s.toLocaleString()}</td>
                    <td className="px-3.5 py-2.5 text-right font-mono font-bold text-blue-700">{trSt.toLocaleString()}</td>
                    <td className="px-3.5 py-2.5 text-right font-mono font-bold text-rose-600">{totEx.toLocaleString()}</td>
                    <td className="px-3.5 py-2.5 text-right">
                      <span className={`px-2 py-0.5 rounded font-mono font-bold text-xs ${
                        Number(totRate) > 10 ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {totRate}%
                      </span>
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-mono">{c.batches || 0}</td>
                    <td className="px-3.5 py-2.5 text-right">
                      {onSelectCenterDrilldown ? (
                        <button
                          onClick={() => onSelectCenterDrilldown(c.center_code)}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#008C95] hover:text-[#005F66]"
                        >
                          <span>Drill</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* FULLSCREEN EXCEPTION CHART MODAL OVERLAY                                   */}
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
                      {fullscreenChart === 'rm' && 'RM Wise Exception Breakdown'}
                      {fullscreenChart === 'center' && 'Center Wise Exception Analysis'}
                      {fullscreenChart === 'program' && 'Program Wise Exception Breakdown'}
                      {fullscreenChart === 'trainer' && 'Exceptions by Assigned Trainer'}
                    </span>
                    <span className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded bg-[#008C95]/20 text-[#38BDF8] border border-[#008C95]/40 font-mono font-semibold">
                      Presentation Mode
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    {fullscreenChart === 'rm' && 'Regional Manager comparison of Total Exceptions & Exception Rates'}
                    {fullscreenChart === 'center' && 'Highest exception centers with total student count & exception rates'}
                    {fullscreenChart === 'program' && 'Exception volume and rates across skilling programs'}
                    {fullscreenChart === 'trainer' && 'Highest exception volume trainers across assigned cohorts'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {['rm', 'center', 'program'].includes(fullscreenChart) && (() => {
                  const activeFsMetric =
                    fullscreenChart === 'rm'
                      ? rmMetric
                      : fullscreenChart === 'center'
                      ? centerMetric
                      : programMetric;
                  const setActiveFsMetric = (m: 'rate' | 'volume') => {
                    if (fullscreenChart === 'rm') setRmMetric(m);
                    else if (fullscreenChart === 'center') setCenterMetric(m);
                    else if (fullscreenChart === 'program') setProgramMetric(m);
                  };
                  return (
                    <div className="flex items-center gap-1 p-1 bg-slate-800 rounded-lg border border-slate-700 text-xs">
                      <span className="text-[11px] text-slate-400 px-1 font-medium">View Metric:</span>
                      <button
                        onClick={() => setActiveFsMetric('rate')}
                        className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer transition-all ${
                          activeFsMetric === 'rate'
                            ? 'bg-[#008C95] text-white shadow-xs'
                            : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        Exception Rate (%)
                      </button>
                      <button
                        onClick={() => setActiveFsMetric('volume')}
                        className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer transition-all ${
                          activeFsMetric === 'volume'
                            ? 'bg-[#008C95] text-white shadow-xs'
                            : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        Total Exception Count
                      </button>
                    </div>
                  );
                })()}

                <button
                  onClick={() =>
                    handleExportChartExcel(
                      fullscreenChart,
                      fullscreenChart === 'rm'
                        ? 'Exceptions_RM_Wise_Breakdown'
                        : fullscreenChart === 'center'
                        ? 'Exceptions_Center_Wise_Breakdown'
                        : fullscreenChart === 'program'
                        ? 'Exceptions_Program_Wise_Breakdown'
                        : 'Exceptions_Trainer_Wise_Breakdown',
                      fullscreenChart === 'rm'
                        ? sorted_by_rm
                        : fullscreenChart === 'center'
                        ? sorted_by_center
                        : fullscreenChart === 'program'
                        ? sorted_by_program
                        : sorted_by_trainer
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
              {fullscreenChart === 'rm' && (
                <div className="space-y-6">
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-indigo-600" />
                        <h4 className="text-sm font-bold text-slate-900">Regional Manager High-Resolution Chart ({sorted_by_rm.length} RMs)</h4>
                      </div>
                      <div className="flex items-center gap-4 text-sm font-bold">
                        {rmMetric === 'rate' ? (
                          <span className="inline-flex items-center gap-1.5 text-rose-700">
                            <span className="w-3.5 h-3.5 rounded-xs bg-rose-500" /> Exception %
                          </span>
                        ) : (
                          <>
                            <span className="inline-flex items-center gap-1.5 text-blue-700">
                              <span className="w-3.5 h-3.5 rounded-xs bg-blue-500" /> Total Student Count
                            </span>
                            <span className="inline-flex items-center gap-1.5 text-emerald-700">
                              <span className="w-3.5 h-3.5 rounded-xs bg-emerald-500" /> Total Trained Count
                            </span>
                            <span className="inline-flex items-center gap-1.5 text-rose-700">
                              <span className="w-3.5 h-3.5 rounded-xs bg-rose-500" /> Total Exception
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="h-[520px]">
                      <ResponsiveContainer width="100%" height="100%">
                        {rmMetric === 'rate' ? (
                          <BarChart data={sorted_by_rm} margin={{ top: 32, right: 24, left: 10, bottom: 85 }} barGap={8} barCategoryGap="20%">
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                            <XAxis dataKey="name" interval={0} height={85} tick={renderRotatedTick} />
                            <YAxis unit="%" domain={[0, (dataMax: number) => Math.max(10, Math.ceil(dataMax * 1.35 + 2))]} tick={{ fontSize: 12, fill: '#475569' }} />
                            <Tooltip formatter={(val: any, name: any) => [`${val}%`, 'Exception %']} contentStyle={{ backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #FECDD3', fontSize: '12px' }} />
                            <Legend iconSize={13} wrapperStyle={{ fontSize: '15px', fontWeight: 700, paddingTop: '15px' }} />
                            <Bar dataKey="exception_rate" name="Exception %" fill="#E11D48" barSize={32} radius={[6, 6, 0, 0]}>
                              <LabelList dataKey="exception_rate" position="top" formatter={(v: any) => (v && Number(v) > 0 ? `${v}%` : '')} fill="#BE123C" fontSize={11} fontWeight={700} offset={8} />
                            </Bar>
                          </BarChart>
                        ) : (
                          <BarChart data={sorted_by_rm} margin={{ top: 32, right: 24, left: 10, bottom: 85 }} barGap={5} barCategoryGap="18%">
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                            <XAxis dataKey="name" interval={0} height={85} tick={renderRotatedTick} />
                            <YAxis domain={[0, (dataMax: number) => Math.max(10, Math.ceil(dataMax * 1.3 + 2))]} tick={{ fontSize: 12, fill: '#475569' }} />
                            <Tooltip formatter={(val: any, name: any) => [Number(val || 0).toLocaleString(), name]} contentStyle={{ backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #FECDD3', fontSize: '12px' }} />
                            <Legend iconSize={13} wrapperStyle={{ fontSize: '15px', fontWeight: 700, paddingTop: '15px' }} />
                            <Bar dataKey="students" name="Total Student Count" fill="#3B82F6" barSize={20} radius={[6, 6, 0, 0]}>
                              <LabelList dataKey="students" position="top" formatter={(v: any) => (v && Number(v) > 0 ? Number(v).toLocaleString() : '')} fill="#1D4ED8" fontSize={10.5} fontWeight={700} offset={8} />
                            </Bar>
                            <Bar dataKey="trained_students" name="Total Trained Count" fill="#10B981" barSize={20} radius={[6, 6, 0, 0]}>
                              <LabelList dataKey="trained_students" position="top" formatter={(v: any) => (v && Number(v) > 0 ? Number(v).toLocaleString() : '')} fill="#047857" fontSize={10.5} fontWeight={700} offset={8} />
                            </Bar>
                            <Bar dataKey="total_exceptions" name="Total Exception" fill="#E11D48" barSize={20} radius={[6, 6, 0, 0]}>
                              <LabelList dataKey="total_exceptions" position="top" formatter={(v: any) => (v && Number(v) > 0 ? Number(v).toLocaleString() : '')} fill="#BE123C" fontSize={10.5} fontWeight={700} offset={8} />
                            </Bar>
                          </BarChart>
                        )}
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                    <h5 className="text-xs font-bold text-slate-900 uppercase tracking-wider">RM Exception Summary Table</h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      {sorted_by_rm.map((rm: any, idx: number) => (
                        <div key={`${rm.name}_${idx}`} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                          <div className="font-bold text-slate-900 text-xs truncate">{rm.name}</div>
                          <div className="flex items-center justify-between text-[11px] text-slate-600">
                            <span>Total: <b className="font-mono font-bold text-slate-700">{rm.students.toLocaleString()}</b> &bull; Trained: <b className="font-mono font-bold text-blue-700">{rm.trained_students?.toLocaleString() || 0}</b></span>
                            <span className="text-rose-600 font-bold font-mono">Rate: {rm.exception_rate}%</span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200">
                            <span className="text-slate-500 font-mono">Total Exceptions:</span>
                            <span className="text-rose-600 font-bold font-mono">{rm.total_exceptions.toLocaleString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {fullscreenChart === 'center' && (
                <div className="space-y-6">
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-cyan-600" />
                        <h4 className="text-sm font-bold text-slate-900">Center Wise High-Resolution Chart ({sorted_by_center.length} Centers)</h4>
                      </div>
                      <div className="flex items-center gap-4 text-sm font-bold">
                        {centerMetric === 'rate' ? (
                          <span className="inline-flex items-center gap-1.5 text-cyan-800">
                            <span className="w-3.5 h-3.5 rounded-xs bg-cyan-500" /> Exception %
                          </span>
                        ) : (
                          <>
                            <span className="inline-flex items-center gap-1.5 text-blue-700">
                              <span className="w-3.5 h-3.5 rounded-xs bg-blue-500" /> Total Student Count
                            </span>
                            <span className="inline-flex items-center gap-1.5 text-emerald-700">
                              <span className="w-3.5 h-3.5 rounded-xs bg-emerald-500" /> Total Trained Count
                            </span>
                            <span className="inline-flex items-center gap-1.5 text-rose-700">
                              <span className="w-3.5 h-3.5 rounded-xs bg-rose-500" /> Total Exception
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="h-[520px]">
                      <ResponsiveContainer width="100%" height="100%">
                        {centerMetric === 'rate' ? (
                          <BarChart data={sorted_by_center} margin={{ top: 32, right: 24, left: 10, bottom: 85 }} barGap={8} barCategoryGap="20%">
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                            <XAxis dataKey="name" interval={0} height={85} tick={renderRotatedTick} />
                            <YAxis unit="%" domain={[0, (dataMax: number) => Math.max(10, Math.ceil(dataMax * 1.35 + 2))]} tick={{ fontSize: 12, fill: '#475569' }} />
                            <Tooltip formatter={(val: any, name: any) => [`${val}%`, 'Exception %']} contentStyle={{ backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #BAE6FD', fontSize: '12px' }} />
                            <Legend iconSize={13} wrapperStyle={{ fontSize: '15px', fontWeight: 700, paddingTop: '15px' }} />
                            <Bar dataKey="exception_rate" name="Exception %" fill="#0284C7" barSize={32} radius={[6, 6, 0, 0]}>
                              <LabelList dataKey="exception_rate" position="top" formatter={(v: any) => (v && Number(v) > 0 ? `${v}%` : '')} fill="#0369A1" fontSize={11} fontWeight={700} offset={8} />
                            </Bar>
                          </BarChart>
                        ) : (
                          <BarChart data={sorted_by_center} margin={{ top: 32, right: 24, left: 10, bottom: 85 }} barGap={5} barCategoryGap="18%">
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                            <XAxis dataKey="name" interval={0} height={85} tick={renderRotatedTick} />
                            <YAxis domain={[0, (dataMax: number) => Math.max(10, Math.ceil(dataMax * 1.3 + 2))]} tick={{ fontSize: 12, fill: '#475569' }} />
                            <Tooltip formatter={(val: any, name: any) => [Number(val || 0).toLocaleString(), name]} contentStyle={{ backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #BAE6FD', fontSize: '12px' }} />
                            <Legend iconSize={13} wrapperStyle={{ fontSize: '15px', fontWeight: 700, paddingTop: '15px' }} />
                            <Bar dataKey="students" name="Total Student Count" fill="#3B82F6" barSize={18} radius={[6, 6, 0, 0]}>
                              <LabelList dataKey="students" position="top" formatter={(v: any) => (v && Number(v) > 0 ? Number(v).toLocaleString() : '')} fill="#1D4ED8" fontSize={10} fontWeight={700} offset={8} />
                            </Bar>
                            <Bar dataKey="trained_students" name="Total Trained Count" fill="#10B981" barSize={18} radius={[6, 6, 0, 0]}>
                              <LabelList dataKey="trained_students" position="top" formatter={(v: any) => (v && Number(v) > 0 ? Number(v).toLocaleString() : '')} fill="#047857" fontSize={10} fontWeight={700} offset={8} />
                            </Bar>
                            <Bar dataKey="total_exceptions" name="Total Exception" fill="#E11D48" barSize={18} radius={[6, 6, 0, 0]}>
                              <LabelList dataKey="total_exceptions" position="top" formatter={(v: any) => (v && Number(v) > 0 ? Number(v).toLocaleString() : '')} fill="#BE123C" fontSize={10} fontWeight={700} offset={8} />
                            </Bar>
                          </BarChart>
                        )}
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                    <h5 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Center Detailed Summary</h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      {sorted_by_center.map((c: any) => (
                        <div key={c.name} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-[#008C95] text-xs truncate">{c.name}</span>
                            <span className="font-mono text-xs font-bold text-rose-600">{c.exception_rate}%</span>
                          </div>
                          <div className="text-[11px] text-slate-600 flex items-center justify-between">
                            <span>Total: <b className="font-mono font-bold text-slate-700">{c.students.toLocaleString()}</b> &bull; Trained: <b className="font-mono font-bold text-blue-700">{c.trained_students?.toLocaleString() || 0}</b></span>
                            <span className="text-slate-500 font-mono">{c.total_exceptions.toLocaleString()} ex.</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {fullscreenChart === 'program' && (
                <div className="space-y-6">
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-emerald-600" />
                        <h4 className="text-sm font-bold text-slate-900">Program Wise High-Resolution Chart ({sorted_by_program.length} Programs)</h4>
                      </div>
                      <div className="flex items-center gap-4 text-sm font-bold">
                        {programMetric === 'rate' ? (
                          <span className="inline-flex items-center gap-1.5 text-emerald-800">
                            <span className="w-3.5 h-3.5 rounded-xs bg-emerald-500" /> Exception %
                          </span>
                        ) : (
                          <>
                            <span className="inline-flex items-center gap-1.5 text-blue-700">
                              <span className="w-3.5 h-3.5 rounded-xs bg-blue-500" /> Total Student Count
                            </span>
                            <span className="inline-flex items-center gap-1.5 text-emerald-700">
                              <span className="w-3.5 h-3.5 rounded-xs bg-emerald-500" /> Total Trained Count
                            </span>
                            <span className="inline-flex items-center gap-1.5 text-rose-700">
                              <span className="w-3.5 h-3.5 rounded-xs bg-rose-500" /> Total Exception
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="h-[520px]">
                      <ResponsiveContainer width="100%" height="100%">
                        {programMetric === 'rate' ? (
                          <BarChart data={sorted_by_program} margin={{ top: 32, right: 24, left: 10, bottom: 85 }} barGap={8} barCategoryGap="20%">
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                            <XAxis dataKey="name" interval={0} height={85} tick={renderRotatedTick} />
                            <YAxis unit="%" domain={[0, (dataMax: number) => Math.max(10, Math.ceil(dataMax * 1.35 + 2))]} tick={{ fontSize: 12, fill: '#475569' }} />
                            <Tooltip formatter={(val: any, name: any) => [`${val}%`, 'Exception %']} contentStyle={{ backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #BBF7D0', fontSize: '12px' }} />
                            <Legend iconSize={13} wrapperStyle={{ fontSize: '15px', fontWeight: 700, paddingTop: '15px' }} />
                            <Bar dataKey="exception_rate" name="Exception %" fill="#059669" barSize={32} radius={[6, 6, 0, 0]}>
                              <LabelList dataKey="exception_rate" position="top" formatter={(v: any) => (v && Number(v) > 0 ? `${v}%` : '')} fill="#047857" fontSize={11} fontWeight={700} offset={8} />
                            </Bar>
                          </BarChart>
                        ) : (
                          <BarChart data={sorted_by_program} margin={{ top: 32, right: 24, left: 10, bottom: 85 }} barGap={5} barCategoryGap="18%">
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                            <XAxis dataKey="name" interval={0} height={85} tick={renderRotatedTick} />
                            <YAxis domain={[0, (dataMax: number) => Math.max(10, Math.ceil(dataMax * 1.3 + 2))]} tick={{ fontSize: 12, fill: '#475569' }} />
                            <Tooltip formatter={(val: any, name: any) => [Number(val || 0).toLocaleString(), name]} contentStyle={{ backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #BBF7D0', fontSize: '12px' }} />
                            <Legend iconSize={13} wrapperStyle={{ fontSize: '15px', fontWeight: 700, paddingTop: '15px' }} />
                            <Bar dataKey="students" name="Total Student Count" fill="#3B82F6" barSize={20} radius={[6, 6, 0, 0]}>
                              <LabelList dataKey="students" position="top" formatter={(v: any) => (v && Number(v) > 0 ? Number(v).toLocaleString() : '')} fill="#1D4ED8" fontSize={10.5} fontWeight={700} offset={8} />
                            </Bar>
                            <Bar dataKey="trained_students" name="Total Trained Count" fill="#10B981" barSize={20} radius={[6, 6, 0, 0]}>
                              <LabelList dataKey="trained_students" position="top" formatter={(v: any) => (v && Number(v) > 0 ? Number(v).toLocaleString() : '')} fill="#047857" fontSize={10.5} fontWeight={700} offset={8} />
                            </Bar>
                            <Bar dataKey="total_exceptions" name="Total Exception" fill="#E11D48" barSize={20} radius={[6, 6, 0, 0]}>
                              <LabelList dataKey="total_exceptions" position="top" formatter={(v: any) => (v && Number(v) > 0 ? Number(v).toLocaleString() : '')} fill="#BE123C" fontSize={10.5} fontWeight={700} offset={8} />
                            </Bar>
                          </BarChart>
                        )}
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                    <h5 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Program Exception Summary</h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      {sorted_by_program.map((p: any) => (
                        <div key={p.name} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                          <div className="font-bold text-slate-900 text-xs truncate">{p.name}</div>
                          <div className="flex items-center justify-between text-[11px] text-slate-600">
                            <span>Total: <b className="font-mono font-bold text-slate-700">{p.students.toLocaleString()}</b> &bull; Trained: <b className="font-mono font-bold text-blue-700">{p.trained_students?.toLocaleString() || 0}</b></span>
                            <span className="text-rose-600 font-bold font-mono">Rate: {p.exception_rate}%</span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200">
                            <span className="text-slate-500 font-mono">Total Exceptions:</span>
                            <span className="text-rose-600 font-bold font-mono">{p.total_exceptions.toLocaleString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {fullscreenChart === 'trainer' && (
                <div className="space-y-6">
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <Briefcase className="w-4 h-4 text-amber-600" />
                        <h4 className="text-sm font-bold text-slate-900">Trainer Exception High-Resolution Chart ({sorted_by_trainer.length} Trainers)</h4>
                      </div>
                      <div className="flex items-center gap-4 text-sm font-bold">
                        <span className="inline-flex items-center gap-1.5 text-amber-800">
                          <span className="w-3.5 h-3.5 rounded-xs bg-amber-500" /> Total Exception
                        </span>
                      </div>
                    </div>

                    <div className="h-[500px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={sorted_by_trainer} layout="vertical" margin={{ top: 15, right: 35, left: 30, bottom: 15 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                          <XAxis type="number" tick={{ fontSize: 12, fill: '#475569' }} />
                          <YAxis dataKey="trainer" type="category" width={180} tick={{ fontSize: 12, fill: '#334155', fontWeight: 600 }} />
                          <Tooltip formatter={(val: any, name: any) => [`${val.toLocaleString()}`, 'Total Exception']} contentStyle={{ backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #FDE68A', fontSize: '12px' }} />
                          <Legend iconSize={13} wrapperStyle={{ fontSize: '15px', fontWeight: 700, paddingTop: '15px' }} />
                          <Bar dataKey="total_exceptions" name="Total Exception" fill="#D97706" barSize={22} radius={[0, 6, 6, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                    <h5 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Trainer Summary Breakdown</h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      {sorted_by_trainer.map((tr: any) => (
                        <div key={tr.trainer} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                          <div className="font-bold text-slate-900 text-xs truncate">{tr.trainer}</div>
                          <div className="flex items-center justify-between text-[11px] text-slate-600">
                            <span>Total: <b className="font-mono font-bold text-slate-700">{tr.students?.toLocaleString() || 0}</b> &bull; Trained: <b className="font-mono font-bold text-blue-700">{tr.trained_students?.toLocaleString() || 0}</b></span>
                            <span className="text-rose-600 font-bold font-mono">Rate: {tr.exception_rate || 0}%</span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200">
                            <span className="text-slate-500 font-mono">Total Exceptions:</span>
                            <span className="text-rose-600 font-bold font-mono">{tr.total_exceptions.toLocaleString()}</span>
                          </div>
                        </div>
                      ))}
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
