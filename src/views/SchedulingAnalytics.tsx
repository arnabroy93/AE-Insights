import React, { useState, useMemo, useEffect } from 'react';
import { consolidateUpvanDharClient } from '../utils/diyaConsolidation';
import {
  CalendarDays,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Search,
  Download,
  Filter,
  RotateCcw,
  Building2,
  Layers,
  ChevronDown,
  ChevronRight,
  ArrowUpDown,
  BookOpen,
  Mail,
  Copy,
  Check,
  ExternalLink,
  X,
  FileSpreadsheet,
  TrendingUp,
  Info,
  CalendarClock,
  ListTree,
  Maximize2,
  Minimize2,
  Users
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
import { SchedulingAnalyticsData, SchedulingBatchItem, FilterParams, FilterOptions, ScheduledVsConductedRecord } from '../types';
import { api } from '../api';
import { ProgramMultiSelect } from '../components/ProgramMultiSelect';
import { RmMultiSelect } from '../components/RmMultiSelect';
import { CenterMultiSelect } from '../components/CenterMultiSelect';
import { getScopedFilterOptions } from '../utils/filterHierarchy';

interface SchedulingAnalyticsProps {
  data: SchedulingAnalyticsData | null;
  loading: boolean;
  filters?: FilterParams;
  filterOptions?: FilterOptions;
  onFilterChange?: (filters: FilterParams) => void;
  onRefresh?: () => void;
}

export const SchedulingAnalytics: React.FC<SchedulingAnalyticsProps> = ({
  data,
  loading,
  filters = {},
  filterOptions,
  onFilterChange,
  onRefresh,
}) => {


  // Chart Breakdown Controls
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
    chartType: string,
    chartTitle: string,
    chartSummary: any[]
  ) => {
    try {
      setExportingChart(chartType);
      await api.exportChartRawExcel({
        module: 'scheduling',
        chartType,
        chartTitle,
        filters: filters || {},
        chartSummary,
      });
    } catch (err) {
      console.error('Failed to export Scheduling chart raw data:', err);
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

  const handleProgramTypeSelect = (type: string) => {
    if (onFilterChange) {
      onFilterChange({
        ...filters,
        programType: type,
      });
    }
  };

  const sorted_by_rm = useMemo(() => {
    const rawArr = (data?.by_rm || []).filter(
      (item: any) => item && String(item.name || item.rm_sh_zh || '').trim().toLowerCase() !== 'unassigned'
    );
    const arr = consolidateUpvanDharClient(rawArr, currentProgramType).filter(
      (item: any) => item && String(item.name || item.rm_sh_zh || '').trim().toLowerCase() !== 'unassigned'
    );
    return [...arr].map((r: any) => {
      const totalScheduled = Number(r.total_scheduled) || 0;
      const sessionsRescheduled = Number(r.sessions_rescheduled) || 0;
      const rescheduledPct =
        r.rescheduled_pct !== undefined
          ? Number(r.rescheduled_pct)
          : totalScheduled > 0
          ? Number(((sessionsRescheduled / totalScheduled) * 100).toFixed(1))
          : 0;
      return {
        ...r,
        sessions_rescheduled: sessionsRescheduled,
        rescheduled_pct: rescheduledPct,
      };
    }).sort((a: any, b: any) => {
      if (rmMetric === 'volume') {
        return (b.sessions_not_conducted || 0) - (a.sessions_not_conducted || 0);
      }
      return (b.missed_pct || 0) - (a.missed_pct || 0);
    });
  }, [data?.by_rm, rmMetric, currentProgramType]);

  const sorted_by_center = useMemo(() => {
    const arr = data?.by_center || [];
    return [...arr].map((c: any) => {
      const totalScheduled = Number(c.total_scheduled) || 0;
      const sessionsRescheduled = Number(c.sessions_rescheduled) || 0;
      const rescheduledPct =
        c.rescheduled_pct !== undefined
          ? Number(c.rescheduled_pct)
          : totalScheduled > 0
          ? Number(((sessionsRescheduled / totalScheduled) * 100).toFixed(1))
          : 0;
      return {
        ...c,
        name: c.name || c.center_code || 'Unknown',
        sessions_rescheduled: sessionsRescheduled,
        rescheduled_pct: rescheduledPct,
      };
    }).sort((a: any, b: any) => {
      if (centerMetric === 'volume') {
        return (b.sessions_not_conducted || 0) - (a.sessions_not_conducted || 0);
      }
      return (b.missed_pct || 0) - (a.missed_pct || 0);
    }).slice(0, 10);
  }, [data?.by_center, centerMetric]);

  const sorted_by_program = useMemo(() => {
    const arr = data?.by_program || [];
    return [...arr].map((p: any) => {
      const totalScheduled = Number(p.total_scheduled) || 0;
      const sessionsRescheduled = Number(p.sessions_rescheduled) || 0;
      const rescheduledPct =
        p.rescheduled_pct !== undefined
          ? Number(p.rescheduled_pct)
          : totalScheduled > 0
          ? Number(((sessionsRescheduled / totalScheduled) * 100).toFixed(1))
          : 0;
      return {
        ...p,
        name: p.name || p.program_name || 'Unknown',
        sessions_rescheduled: sessionsRescheduled,
        rescheduled_pct: rescheduledPct,
      };
    }).sort((a: any, b: any) => {
      if (programMetric === 'volume') {
        return (b.sessions_not_conducted || 0) - (a.sessions_not_conducted || 0);
      }
      return (b.missed_pct || 0) - (a.missed_pct || 0);
    }).slice(0, 10);
  }, [data?.by_program, programMetric]);

  // Common Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  useEffect(() => {
    if (!searchTerm.trim()) {
      setDebouncedSearchTerm('');
      return;
    }
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 200);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const areStringArraysEqual = (a: string[], b: string[]) =>
    a.length === b.length && a.every((v, idx) => v === b[idx]);

  const [selectedCenter, setSelectedCenter] = useState<string>('ALL');
  const [selectedCenters, setSelectedCenters] = useState<string[]>(() => {
    if (filters?.centerCodes && filters.centerCodes.length > 0) return filters.centerCodes;
    if (filters?.centerCode && filters.centerCode !== 'ALL') return filters.centerCode.split(',').map(s => s.trim()).filter(Boolean);
    return [];
  });
  const [selectedRms, setSelectedRms] = useState<string[]>(() => {
    if (filters?.rmShZhs && filters.rmShZhs.length > 0) return filters.rmShZhs;
    if (filters?.rmShZh && filters.rmShZh !== 'ALL') return filters.rmShZh.split(',').map(s => s.trim()).filter(Boolean);
    return [];
  });
  const [selectedProgram, setSelectedProgram] = useState<string>(() => {
    if (filters?.programNames && filters.programNames.length > 0) return filters.programNames.join(',');
    if (filters?.programName && filters.programName !== 'ALL') return filters.programName;
    return 'ALL';
  });
  const [selectedPrograms, setSelectedPrograms] = useState<string[]>(() => {
    if (filters?.programNames && filters.programNames.length > 0) return filters.programNames;
    if (filters?.programName && filters.programName !== 'ALL') return filters.programName.split(',').map(s => s.trim()).filter(Boolean);
    return [];
  });

  useEffect(() => {
    let next: string[] = [];
    let nextSingle = 'ALL';
    if (filters?.programNames && Array.isArray(filters.programNames)) {
      next = filters.programNames;
      nextSingle = filters.programNames.length === 1 ? filters.programNames[0] : (filters.programNames.length > 1 ? filters.programNames.join(',') : 'ALL');
    } else if (filters?.programName && filters.programName !== 'ALL') {
      next = filters.programName.split(',').map(s => s.trim()).filter(Boolean);
      nextSingle = filters.programName;
    }
    setSelectedPrograms(prev => (areStringArraysEqual(prev, next) ? prev : next));
    setSelectedProgram(prev => (prev === nextSingle ? prev : nextSingle));
  }, [filters?.programNames, filters?.programName]);

  useEffect(() => {
    let next: string[] = [];
    let nextSingle = 'ALL';
    if (filters?.centerCodes && Array.isArray(filters.centerCodes)) {
      next = filters.centerCodes;
      nextSingle = filters.centerCodes.length === 1 ? filters.centerCodes[0] : (filters.centerCodes.length > 1 ? filters.centerCodes.join(',') : 'ALL');
    } else if (filters?.centerCode && filters.centerCode !== 'ALL') {
      next = filters.centerCode.split(',').map(s => s.trim()).filter(Boolean);
      nextSingle = filters.centerCode;
    }
    setSelectedCenters(prev => (areStringArraysEqual(prev, next) ? prev : next));
    setSelectedCenter(prev => (prev === nextSingle ? prev : nextSingle));
  }, [filters?.centerCodes, filters?.centerCode]);

  useEffect(() => {
    let next: string[] = [];
    if (filters?.rmShZhs && Array.isArray(filters.rmShZhs)) {
      next = filters.rmShZhs;
    } else if (filters?.rmShZh && filters.rmShZh !== 'ALL') {
      next = filters.rmShZh.split(',').map(s => s.trim()).filter(Boolean);
    }
    setSelectedRms(prev => (areStringArraysEqual(prev, next) ? prev : next));
  }, [filters?.rmShZhs, filters?.rmShZh]);

  const handleProgramsChange = (newSelected: string[]) => {
    setSelectedPrograms(newSelected);
    setSelectedProgram(newSelected.length === 1 ? newSelected[0] : (newSelected.length > 1 ? newSelected.join(',') : 'ALL'));
    setCurrentPage(1);
    if (onFilterChange) {
      onFilterChange({
        ...filters,
        programNames: newSelected.length > 0 ? newSelected : undefined,
        programName: newSelected.length === 1 ? newSelected[0] : (newSelected.length > 1 ? newSelected.join(',') : undefined),
      });
    }
  };

  const currentRmShZh = filters?.rmShZh || 'ALL';
  const handleRmsChange = (newSelected: string[]) => {
    setSelectedRms(newSelected);
    setCurrentPage(1);
    if (onFilterChange) {
      onFilterChange({
        ...filters,
        rmShZhs: newSelected.length > 0 ? newSelected : undefined,
        rmShZh: newSelected.length === 1 ? newSelected[0] : (newSelected.length > 1 ? newSelected.join(',') : undefined),
      });
    }
  };

  const handleRmShZhChange = (val: string) => {
    handleRmsChange(val === 'ALL' || !val ? [] : [val]);
  };

  const handleCentersChange = (newSelected: string[]) => {
    setSelectedCenters(newSelected);
    setSelectedCenter(newSelected.length === 1 ? newSelected[0] : (newSelected.length > 1 ? newSelected.join(',') : 'ALL'));
    setCurrentPage(1);
    if (onFilterChange) {
      onFilterChange({
        ...filters,
        centerCodes: newSelected.length > 0 ? newSelected : undefined,
        centerCode: newSelected.length === 1 ? newSelected[0] : (newSelected.length > 1 ? newSelected.join(',') : undefined),
      });
    }
  };

  const handleCenterSelectChange = (val: string) => {
    handleCentersChange(val === 'ALL' || !val ? [] : [val]);
  };

  const [selectedBatchStatus, setSelectedBatchStatus] = useState<string>('ALL');
  const [statusFilterTab, setStatusFilterTab] = useState<'all' | 'missed_only' | 'zero_missed'>('all');

  // Batch Summary View State
  const [sortField, setSortField] = useState<keyof SchedulingBatchItem>('sessions_not_conducted');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);

  // Inline Batch Expand State
  const [expandedBatches, setExpandedBatches] = useState<Record<string, boolean>>({});
  const [batchDetailsCache, setBatchDetailsCache] = useState<Record<string, any[]>>({});
  const [loadingBatchMap, setLoadingBatchMap] = useState<Record<string, boolean>>({});
  const [isAllExpanded, setIsAllExpanded] = useState<boolean>(false);



  // Drilldown Modal
  const [activeBatchModal, setActiveBatchModal] = useState<SchedulingBatchItem | null>(null);
  const [batchSessions, setBatchSessions] = useState<any[]>([]);
  const [loadingBatchDetails, setLoadingBatchDetails] = useState<boolean>(false);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  const batches = useMemo(() => data?.batches || [], [data?.batches]);

  // Options
  const centerOptions = useMemo(() => {
    if (data?.center_options && data.center_options.length > 0) {
      return data.center_options;
    }
    const set = new Set<string>();
    batches.forEach(b => {
      if (b.center_code && b.center_code !== 'N/A') set.add(b.center_code);
    });
    return Array.from(set).sort();
  }, [data?.center_options, batches]);

  const programOptions = useMemo(() => {
    if (data?.program_options && data.program_options.length > 0) {
      return data.program_options;
    }
    const set = new Set<string>();
    batches.forEach(b => {
      if (b.program_name && b.program_name !== 'N/A') set.add(b.program_name);
    });
    return Array.from(set).sort();
  }, [data?.program_options, batches]);

  const batchStatusOptions = useMemo(() => {
    const set = new Set<string>();
    batches.forEach(b => {
      if (b.batch_status && b.batch_status.trim() !== '' && b.batch_status !== 'N/A') {
        set.add(b.batch_status);
      }
    });
    if (set.size === 0) {
      return ['Complete', 'Running', 'Hold'];
    }
    return Array.from(set).sort();
  }, [batches]);

  const scopedOptions = useMemo(
    () => getScopedFilterOptions(filterOptions, filters, centerOptions, programOptions),
    [filterOptions, filters, centerOptions, programOptions]
  );



  // Base filtered batches (before statusFilterTab: All / With Missed / 100% Conducted)
  const baseFilteredBatches = useMemo(() => {
    return batches.filter(item => {
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matches =
          (item.batch_code && item.batch_code.toLowerCase().includes(term)) ||
          (item.center_code && item.center_code.toLowerCase().includes(term)) ||
          (item.program_name && item.program_name.toLowerCase().includes(term)) ||
          (item.fm_email_id && item.fm_email_id.toLowerCase().includes(term));
        if (!matches) return false;
      }

      if (selectedCenters.length > 0) {
        const lowerCenters = selectedCenters.map(c => c.toLowerCase().trim());
        const itemCenter = (item.center_code || '').toLowerCase().trim();
        if (!lowerCenters.includes(itemCenter)) return false;
      } else if (selectedCenter !== 'ALL') {
        if (item.center_code.toLowerCase() !== selectedCenter.toLowerCase()) return false;
      }

      if (selectedPrograms.length > 0) {
        const lowerSelected = selectedPrograms.map(p => p.toLowerCase().trim());
        const itemProg = (item.program_name || '').toLowerCase().trim();
        if (!lowerSelected.includes(itemProg)) return false;
      } else if (selectedProgram !== 'ALL') {
        if (item.program_name.toLowerCase() !== selectedProgram.toLowerCase()) return false;
      }

      if (selectedBatchStatus !== 'ALL') {
        if ((item.batch_status || '').toLowerCase() !== selectedBatchStatus.toLowerCase()) return false;
      }

      return true;
    });
  }, [batches, searchTerm, selectedCenters, selectedCenter, selectedProgram, selectedPrograms, selectedBatchStatus]);

  const tabCounts = useMemo(() => {
    const uniqueAll = new Set(baseFilteredBatches.map(b => b.batch_code)).size;
    const withMissedRows = baseFilteredBatches.filter(b => b.sessions_not_conducted > 0);
    const zeroMissedRows = baseFilteredBatches.filter(b => b.sessions_not_conducted <= 0);
    return {
      allRows: baseFilteredBatches.length,
      uniqueAll,
      withMissedRows: withMissedRows.length,
      zeroMissedRows: zeroMissedRows.length,
    };
  }, [baseFilteredBatches]);

  // Filtered batches for summary view
  const filteredBatches = useMemo(() => {
    return baseFilteredBatches.filter(item => {
      if (statusFilterTab === 'missed_only' && item.sessions_not_conducted <= 0) {
        return false;
      }
      if (statusFilterTab === 'zero_missed' && item.sessions_not_conducted > 0) {
        return false;
      }
      return true;
    });
  }, [baseFilteredBatches, statusFilterTab]);

  // Sorted batches
  const sortedBatches = useMemo(() => {
    return [...filteredBatches].sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (typeof aVal === 'string') {
        aVal = (aVal || '').toLowerCase();
        bVal = ((bVal as string) || '').toLowerCase();
        return sortOrder === 'asc' ? aVal.localeCompare(bVal as string) : (bVal as string).localeCompare(aVal);
      }

      aVal = Number(aVal) || 0;
      bVal = Number(bVal) || 0;
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [filteredBatches, sortField, sortOrder]);

  // Pagination for Batch Summary
  const totalPages = Math.ceil(sortedBatches.length / pageSize) || 1;
  const paginatedBatches = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedBatches.slice(start, start + pageSize);
  }, [sortedBatches, currentPage, pageSize]);

  const handleSort = (field: keyof SchedulingBatchItem) => {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
    setCurrentPage(1);
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedCenter('ALL');
    setSelectedCenters([]);
    setSelectedRms([]);
    setSelectedProgram('ALL');
    setSelectedPrograms([]);
    setSelectedBatchStatus('ALL');
    setStatusFilterTab('all');
    setCurrentPage(1);
    if (onFilterChange) {
      onFilterChange({
        ...filters,
        rmShZh: undefined,
        rmShZhs: undefined,
        centerCode: undefined,
        centerCodes: undefined,
        programNames: undefined,
        programName: undefined,
        assignedAe: undefined,
        assignedAes: undefined,
        startDate: undefined,
        endDate: undefined,
      });
    }
  };

  const handleCopyEmail = (email: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(email);
    setCopiedEmail(email);
    setTimeout(() => setCopiedEmail(null), 2000);
  };

  // Toggle single batch expansion
  const toggleExpandBatch = async (batchCode: string, fmEmailId?: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const rowKey = fmEmailId ? `${batchCode}___${fmEmailId}` : batchCode;
    const nextState = !expandedBatches[rowKey];
    setExpandedBatches(prev => ({ ...prev, [rowKey]: nextState }));

    if (nextState && !batchDetailsCache[rowKey]) {
      setLoadingBatchMap(prev => ({ ...prev, [rowKey]: true }));
      try {
        const details = await api.getBatchSessionDetails(batchCode, fmEmailId);
        setBatchDetailsCache(prev => ({ ...prev, [rowKey]: details }));
      } catch (err) {
        console.error('Failed to load sessions for ' + batchCode, err);
      } finally {
        setLoadingBatchMap(prev => ({ ...prev, [rowKey]: false }));
      }
    }
  };

  // Toggle all visible batches expansion
  const handleToggleExpandAll = async () => {
    const nextState = !isAllExpanded;
    setIsAllExpanded(nextState);

    const newMap: Record<string, boolean> = {};
    paginatedBatches.forEach(b => {
      const rowKey = `${b.batch_code}___${b.fm_email_id || ''}`;
      newMap[rowKey] = nextState;
    });
    setExpandedBatches(newMap);

    if (nextState) {
      const unvisited = paginatedBatches.filter(b => {
        const rowKey = `${b.batch_code}___${b.fm_email_id || ''}`;
        return !batchDetailsCache[rowKey];
      });
      if (unvisited.length > 0) {
        const loadingMap: Record<string, boolean> = {};
        unvisited.forEach(b => {
          const rowKey = `${b.batch_code}___${b.fm_email_id || ''}`;
          loadingMap[rowKey] = true;
        });
        setLoadingBatchMap(prev => ({ ...prev, ...loadingMap }));

        await Promise.all(
          unvisited.map(async (b) => {
            const rowKey = `${b.batch_code}___${b.fm_email_id || ''}`;
            try {
              const details = await api.getBatchSessionDetails(b.batch_code, b.fm_email_id);
              setBatchDetailsCache(prev => ({ ...prev, [rowKey]: details }));
            } catch (err) {}
          })
        );

        const doneMap: Record<string, boolean> = {};
        unvisited.forEach(b => {
          const rowKey = `${b.batch_code}___${b.fm_email_id || ''}`;
          doneMap[rowKey] = false;
        });
        setLoadingBatchMap(prev => ({ ...prev, ...doneMap }));
      }
    }
  };

  const handleOpenBatchDrilldown = async (batch: SchedulingBatchItem) => {
    setActiveBatchModal(batch);
    setLoadingBatchDetails(true);
    try {
      const details = await api.getBatchSessionDetails(batch.batch_code, batch.fm_email_id);
      setBatchSessions(details);
    } catch (err) {
      console.error('Failed to load batch sessions:', err);
      setBatchSessions([]);
    } finally {
      setLoadingBatchDetails(false);
    }
  };

  const handleExportCsv = () => {
    const headers = [
      'Center Code',
      'Batch Code',
      'Program Name',
      'FM Email ID',
      'Total Scheduled (Slot Count)',
      'No. of Sessions Not Conducted',
      'No. of Rescheduled',
      'Sessions Conducted',
      'Conductance %',
      'Batch Status',
      'Earliest Slot Date',
      'Latest Slot Date'
    ];
    const rows = filteredBatches.map(b => [
      `"${b.center_code}"`,
      `"${b.batch_code}"`,
      `"${b.program_name}"`,
      `"${b.fm_email_id}"`,
      b.total_scheduled,
      b.sessions_not_conducted,
      b.sessions_rescheduled || 0,
      b.sessions_conducted,
      `"${b.conducted_pct}%"`,
      `"${b.batch_status || 'Running'}"`,
      `"${b.earliest_slot_date || ''}"`,
      `"${b.latest_slot_date || ''}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `scheduling_batches_summary_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // KPI Calculations
  const summary = data?.summary || {
    total_batches: batches.length,
    total_scheduled_sessions: batches.reduce((acc, b) => acc + b.total_scheduled, 0),
    total_sessions_not_conducted: batches.reduce((acc, b) => acc + b.sessions_not_conducted, 0),
    total_sessions_conducted: batches.reduce((acc, b) => acc + b.sessions_conducted, 0),
    overall_conducted_pct: 0,
    batches_with_missed_sessions: batches.filter(b => b.sessions_not_conducted > 0).length,
    zero_missed_batches: batches.filter(b => b.sessions_not_conducted === 0).length,
  };

  const overallPct = summary.total_scheduled_sessions > 0
    ? Number(((summary.total_sessions_conducted / summary.total_scheduled_sessions) * 100).toFixed(1))
    : 100;

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs relative z-30">
        <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-teal-50/80 via-emerald-50/40 to-transparent rounded-full -mr-20 -mt-20" />
        </div>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
              <div className="p-2 bg-[#008C95]/10 rounded-xl text-[#008C95]">
                <CalendarDays className="w-5 h-5 text-[#008C95]" />
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Batch Scheduling &amp; Conductance
              </h1>
              <span className="px-2.5 py-0.5 text-[11px] font-bold bg-[#008C95]/10 text-[#008C95] rounded-full uppercase tracking-wider">
                Core Operations
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>{summary.total_batches.toLocaleString()} Batches Monitored ({summary.total_scheduled_sessions.toLocaleString()} Scheduled Slots)</span>
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 max-w-3xl leading-relaxed">
              Monitoring scheduled batch conductance, faculty assignments, session slots, missed classes, and rescheduled sessions across centers.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2.5 self-start lg:self-auto shrink-0">
            {/* Program Type Segmented Filter Selector */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200">
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

            <button
              onClick={handleExportCsv}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-2xs cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Export Batches CSV</span>
            </button>
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl bg-[#008C95] text-white hover:bg-[#00737a] transition-colors shadow-2xs cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Refresh</span>
              </button>
            )}
          </div>
        </div>

        {/* Multi-Filter Controls Bar: Date Range, RM wise, Center, Program (single/multi) */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center gap-2.5 relative z-30">
          {/* Date Range Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200 shadow-2xs">
            <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span className="text-[11px] font-semibold text-slate-600 whitespace-nowrap">From:</span>
            <input
              type="date"
              value={filters?.startDate || ''}
              onChange={(e) => {
                setCurrentPage(1);
                onFilterChange?.({ ...filters, startDate: e.target.value || undefined });
              }}
              className="bg-white border border-slate-300 rounded-md px-2 py-1 text-xs text-slate-800 font-medium focus:outline-hidden focus:ring-1 focus:ring-[#008C95] cursor-pointer"
            />
            <span className="text-[11px] font-semibold text-slate-600 whitespace-nowrap">To:</span>
            <input
              type="date"
              value={filters?.endDate || ''}
              onChange={(e) => {
                setCurrentPage(1);
                onFilterChange?.({ ...filters, endDate: e.target.value || undefined });
              }}
              className="bg-white border border-slate-300 rounded-md px-2 py-1 text-xs text-slate-800 font-medium focus:outline-hidden focus:ring-1 focus:ring-[#008C95] cursor-pointer"
            />
            {(filters?.startDate || filters?.endDate) && (
              <button
                onClick={() => {
                  setCurrentPage(1);
                  onFilterChange?.({ ...filters, startDate: undefined, endDate: undefined });
                }}
                className="ml-0.5 p-0.5 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                title="Clear Date Filter"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <RmMultiSelect
            options={scopedOptions.rmOptions}
            selectedRms={selectedRms}
            selectedRm={selectedRms.join(',')}
            onChange={handleRmsChange}
            programOptions={scopedOptions.programOptions}
            selectedPrograms={selectedPrograms}
            selectedProgram={selectedPrograms.join(',')}
            onProgramsChange={handleProgramsChange}
          />

          <CenterMultiSelect
            options={scopedOptions.centerOptions}
            selectedCenters={selectedCenters}
            selectedCenter={selectedCenters.join(',')}
            onChange={handleCentersChange}
            programOptions={scopedOptions.programOptions}
            selectedPrograms={selectedPrograms}
            selectedProgram={selectedPrograms.join(',')}
            onProgramsChange={handleProgramsChange}
          />

          <ProgramMultiSelect
            options={scopedOptions.programOptions}
            selectedPrograms={selectedPrograms}
            selectedProgram={selectedPrograms.join(',')}
            onChange={handleProgramsChange}
          />

          {(selectedRms.length > 0 || selectedCenters.length > 0 || selectedPrograms.length > 0 || filters?.startDate || filters?.endDate) && (
            <button
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>

        {/* KPI Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 mt-4 pt-4 border-t border-slate-100 relative z-10">
          <div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-200/60">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Batches Monitored</span>
              <Building2 className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-slate-900">
              {summary.total_batches.toLocaleString()}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              Across all training centers
            </div>
          </div>

          <div className="bg-sky-50/70 rounded-xl p-3.5 border border-sky-100">
            <div className="flex items-center justify-between text-sky-700 mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Total Scheduled Slots</span>
              <CalendarClock className="w-4 h-4 text-sky-600" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-sky-950">
              {summary.total_scheduled_sessions.toLocaleString()}
            </div>
            <div className="text-[10px] text-sky-700 mt-0.5">
              Count of all session records
            </div>
          </div>

          <div className="bg-emerald-50/70 rounded-xl p-3.5 border border-emerald-100">
            <div className="flex items-center justify-between text-emerald-700 mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Conducted Sessions</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-emerald-950">
              {summary.total_sessions_conducted.toLocaleString()}
            </div>
            <div className="text-[10px] text-emerald-700 mt-0.5 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              <span>{overallPct}% conductance rate</span>
            </div>
          </div>

          <div className="bg-amber-50/70 rounded-xl p-3.5 border border-amber-200/80">
            <div className="flex items-center justify-between text-amber-800 mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Not Conducted</span>
              <AlertTriangle className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-amber-950">
              {summary.total_sessions_not_conducted.toLocaleString()}
            </div>
            <div className="text-[10px] text-amber-800 mt-0.5">
              CMIS not started / ended &amp; no form
            </div>
          </div>

          <div className="bg-indigo-50/70 rounded-xl p-3.5 border border-indigo-100 col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between text-indigo-700 mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Batches With Gaps</span>
              <Layers className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-indigo-950">
              {summary.batches_with_missed_sessions.toLocaleString()}
            </div>
            <div className="text-[10px] text-indigo-700 mt-0.5">
              {summary.zero_missed_batches} batches 100% conducted
            </div>
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

        {/* Rate vs Volume Switcher (Global) */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200 text-xs font-medium">
          <span className="text-[11px] text-slate-500 px-1 font-semibold">View Metric (All):</span>
          <button
            onClick={() => handleGlobalMetricChange('rate')}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer transition-all ${
              rmMetric === 'rate' && centerMetric === 'rate' && programMetric === 'rate'
                ? 'bg-white text-slate-900 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Percentage (%)
          </button>
          <button
            onClick={() => handleGlobalMetricChange('volume')}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer transition-all ${
              rmMetric === 'volume' && centerMetric === 'volume' && programMetric === 'volume'
                ? 'bg-white text-slate-900 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Session Volume
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
                  <h3 className="text-sm font-bold text-slate-900">RM Wise Scheduling &amp; Conductance Breakdown</h3>
                  <p className="text-[11px] text-slate-500">
                    Regional Manager distribution of missed and rescheduled session slots
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs font-medium flex-wrap">
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200 text-xs font-medium">
                  <span className="text-[11px] text-slate-500 px-1 font-semibold">View Metric:</span>
                  <button
                    onClick={() => setRmMetric('rate')}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer transition-all ${
                      rmMetric === 'rate'
                        ? 'bg-white text-slate-900 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Percentage (%)
                  </button>
                  <button
                    onClick={() => setRmMetric('volume')}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer transition-all ${
                      rmMetric === 'volume'
                        ? 'bg-white text-slate-900 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Session Volume
                  </button>
                </div>
                <button
                  onClick={() => handleExportChartExcel('rm', 'Scheduling_RM_Wise_Breakdown', sorted_by_rm)}
                  disabled={exportingChart === 'rm'}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-600 hover:text-white transition-all cursor-pointer border border-emerald-200 disabled:opacity-60"
                  title="Export chart summary, batch summary, and underlying raw session slot records to Excel for manual verification"
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
                  <BarChart data={sorted_by_rm} margin={{ top: 32, right: 24, left: 6, bottom: 65 }} barGap={6} barCategoryGap="22%">
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="name" interval={0} height={65} tick={renderRotatedTick} />
                    <YAxis unit="%" domain={[0, (dataMax: number) => Math.max(20, Math.ceil((dataMax || 0) * 1.15))]} tick={{ fontSize: 11, fill: '#64748B' }} />
                    <Tooltip
                      formatter={(val: any, name: any) => [`${Number(val || 0).toFixed(1)}%`, name]}
                      contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #BFDBFE', fontSize: '11px' }}
                    />
                    <Legend iconSize={12} wrapperStyle={{ fontSize: '14px', fontWeight: 700, paddingTop: '12px' }} />
                    <Bar dataKey="missed_pct" name="Missed / Not Conducted %" fill="#EF4444" barSize={18} radius={[4, 4, 0, 0]} isAnimationActive={false}>
                      <LabelList dataKey="missed_pct" position="top" formatter={(v: any) => (v !== undefined && v !== null ? `${Number(v).toFixed(1)}%` : '')} fill="#B91C1C" fontSize={9.5} fontWeight={700} offset={6} />
                    </Bar>
                    <Bar dataKey="rescheduled_pct" name="No. of Rescheduled" fill="#8B5CF6" barSize={18} radius={[4, 4, 0, 0]} isAnimationActive={false}>
                      <LabelList dataKey="rescheduled_pct" position="top" formatter={(v: any) => (v !== undefined && v !== null ? `${Number(v).toFixed(1)}%` : '')} fill="#6D28D9" fontSize={9.5} fontWeight={700} offset={6} />
                    </Bar>
                  </BarChart>
                ) : (
                  <BarChart data={sorted_by_rm} margin={{ top: 32, right: 24, left: 6, bottom: 65 }} barGap={5} barCategoryGap="22%">
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="name" interval={0} height={65} tick={renderRotatedTick} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                    <Tooltip
                      formatter={(val: any, name: any) =>
                        name === 'No. of Rescheduled'
                          ? [`${Number(val || 0).toLocaleString()} rescheduled`, name]
                          : [`${Number(val || 0).toLocaleString()} sessions`, name]
                      }
                      contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #BFDBFE', fontSize: '11px' }}
                    />
                    <Legend iconSize={12} wrapperStyle={{ fontSize: '14px', fontWeight: 700, paddingTop: '12px' }} />
                    <Bar dataKey="sessions_not_conducted" name="Not Conducted Sessions" fill="#EF4444" barSize={16} radius={[4, 4, 0, 0]} isAnimationActive={false}>
                      <LabelList dataKey="sessions_not_conducted" position="top" formatter={(v: any) => (v !== undefined && v !== null ? v : '')} fill="#B91C1C" fontSize={9} fontWeight={700} offset={6} />
                    </Bar>
                    <Bar dataKey="sessions_rescheduled" name="No. of Rescheduled" fill="#8B5CF6" barSize={16} radius={[4, 4, 0, 0]} isAnimationActive={false}>
                      <LabelList dataKey="sessions_rescheduled" position="top" formatter={(v: any) => (v !== undefined && v !== null ? v : '')} fill="#6D28D9" fontSize={9} fontWeight={700} offset={6} />
                    </Bar>
                    <Bar dataKey="total_scheduled" name="Total Scheduled Slots" fill="#3B82F6" barSize={16} radius={[4, 4, 0, 0]} isAnimationActive={false}>
                      <LabelList dataKey="total_scheduled" position="top" formatter={(v: any) => (v ? v : '')} fill="#1D4ED8" fontSize={9} fontWeight={700} offset={6} />
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
                  <h3 className="text-sm font-bold text-slate-900">Center Wise Scheduling &amp; Conductance Breakdown (Top 10)</h3>
                  <p className="text-[11px] text-slate-500">
                    Top 10 centers comparison of missed and rescheduled session slots
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs font-medium flex-wrap">
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200 text-xs font-medium">
                  <span className="text-[11px] text-slate-500 px-1 font-semibold">View Metric:</span>
                  <button
                    onClick={() => setCenterMetric('rate')}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer transition-all ${
                      centerMetric === 'rate'
                        ? 'bg-white text-slate-900 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Percentage (%)
                  </button>
                  <button
                    onClick={() => setCenterMetric('volume')}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer transition-all ${
                      centerMetric === 'volume'
                        ? 'bg-white text-slate-900 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Session Volume
                  </button>
                </div>
                <button
                  onClick={() => handleExportChartExcel('center', 'Scheduling_Center_Wise_Top10_Breakdown', sorted_by_center)}
                  disabled={exportingChart === 'center'}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-600 hover:text-white transition-all cursor-pointer border border-emerald-200 disabled:opacity-60"
                  title="Export chart summary, batch summary, and underlying raw session slot records to Excel for manual verification"
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
                  <BarChart data={sorted_by_center} margin={{ top: 32, right: 24, left: 6, bottom: 65 }} barGap={6} barCategoryGap="22%">
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="name" interval={0} height={65} tick={renderRotatedTick} />
                    <YAxis unit="%" domain={[0, (dataMax: number) => Math.max(20, Math.ceil((dataMax || 0) * 1.15))]} tick={{ fontSize: 11, fill: '#64748B' }} />
                    <Tooltip
                      formatter={(val: any, name: any) => [`${Number(val || 0).toFixed(1)}%`, name]}
                      contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #BFDBFE', fontSize: '11px' }}
                    />
                    <Legend iconSize={12} wrapperStyle={{ fontSize: '14px', fontWeight: 700, paddingTop: '12px' }} />
                    <Bar dataKey="missed_pct" name="Missed / Not Conducted %" fill="#EF4444" barSize={18} radius={[4, 4, 0, 0]} isAnimationActive={false}>
                      <LabelList dataKey="missed_pct" position="top" formatter={(v: any) => (v !== undefined && v !== null ? `${Number(v).toFixed(1)}%` : '')} fill="#B91C1C" fontSize={9.5} fontWeight={700} offset={6} />
                    </Bar>
                    <Bar dataKey="rescheduled_pct" name="No. of Rescheduled" fill="#8B5CF6" barSize={18} radius={[4, 4, 0, 0]} isAnimationActive={false}>
                      <LabelList dataKey="rescheduled_pct" position="top" formatter={(v: any) => (v !== undefined && v !== null ? `${Number(v).toFixed(1)}%` : '')} fill="#6D28D9" fontSize={9.5} fontWeight={700} offset={6} />
                    </Bar>
                  </BarChart>
                ) : (
                  <BarChart data={sorted_by_center} margin={{ top: 32, right: 24, left: 6, bottom: 65 }} barGap={5} barCategoryGap="22%">
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="name" interval={0} height={65} tick={renderRotatedTick} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                    <Tooltip
                      formatter={(val: any, name: any) =>
                        name === 'No. of Rescheduled'
                          ? [`${Number(val || 0).toLocaleString()} rescheduled`, name]
                          : [`${Number(val || 0).toLocaleString()} sessions`, name]
                      }
                      contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #BFDBFE', fontSize: '11px' }}
                    />
                    <Legend iconSize={12} wrapperStyle={{ fontSize: '14px', fontWeight: 700, paddingTop: '12px' }} />
                    <Bar dataKey="sessions_not_conducted" name="Not Conducted Sessions" fill="#EF4444" barSize={16} radius={[4, 4, 0, 0]} isAnimationActive={false}>
                      <LabelList dataKey="sessions_not_conducted" position="top" formatter={(v: any) => (v !== undefined && v !== null ? v : '')} fill="#B91C1C" fontSize={9} fontWeight={700} offset={6} />
                    </Bar>
                    <Bar dataKey="sessions_rescheduled" name="No. of Rescheduled" fill="#8B5CF6" barSize={16} radius={[4, 4, 0, 0]} isAnimationActive={false}>
                      <LabelList dataKey="sessions_rescheduled" position="top" formatter={(v: any) => (v !== undefined && v !== null ? v : '')} fill="#6D28D9" fontSize={9} fontWeight={700} offset={6} />
                    </Bar>
                    <Bar dataKey="total_scheduled" name="Total Scheduled Slots" fill="#3B82F6" barSize={16} radius={[4, 4, 0, 0]} isAnimationActive={false}>
                      <LabelList dataKey="total_scheduled" position="top" formatter={(v: any) => (v ? v : '')} fill="#1D4ED8" fontSize={9} fontWeight={700} offset={6} />
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
                  <h3 className="text-sm font-bold text-slate-900">Program Wise Scheduling &amp; Conductance Breakdown (Top 10)</h3>
                  <p className="text-[11px] text-slate-500">
                    Top 10 programs comparison of missed and rescheduled session slots
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs font-medium flex-wrap">
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200 text-xs font-medium">
                  <span className="text-[11px] text-slate-500 px-1 font-semibold">View Metric:</span>
                  <button
                    onClick={() => setProgramMetric('rate')}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer transition-all ${
                      programMetric === 'rate'
                        ? 'bg-white text-slate-900 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Percentage (%)
                  </button>
                  <button
                    onClick={() => setProgramMetric('volume')}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer transition-all ${
                      programMetric === 'volume'
                        ? 'bg-white text-slate-900 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Session Volume
                  </button>
                </div>
                <button
                  onClick={() => handleExportChartExcel('program', 'Scheduling_Program_Wise_Top10_Breakdown', sorted_by_program)}
                  disabled={exportingChart === 'program'}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-600 hover:text-white transition-all cursor-pointer border border-emerald-200 disabled:opacity-60"
                  title="Export chart summary, batch summary, and underlying raw session slot records to Excel for manual verification"
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
                  <BarChart data={sorted_by_program} margin={{ top: 32, right: 24, left: 6, bottom: 65 }} barGap={6} barCategoryGap="22%">
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="name" interval={0} height={65} tick={renderRotatedTick} />
                    <YAxis unit="%" domain={[0, (dataMax: number) => Math.max(20, Math.ceil((dataMax || 0) * 1.15))]} tick={{ fontSize: 11, fill: '#64748B' }} />
                    <Tooltip
                      formatter={(val: any, name: any) => [`${Number(val || 0).toFixed(1)}%`, name]}
                      contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #BFDBFE', fontSize: '11px' }}
                    />
                    <Legend iconSize={12} wrapperStyle={{ fontSize: '14px', fontWeight: 700, paddingTop: '12px' }} />
                    <Bar dataKey="missed_pct" name="Missed / Not Conducted %" fill="#EF4444" barSize={18} radius={[4, 4, 0, 0]} isAnimationActive={false}>
                      <LabelList dataKey="missed_pct" position="top" formatter={(v: any) => (v !== undefined && v !== null ? `${Number(v).toFixed(1)}%` : '')} fill="#B91C1C" fontSize={9.5} fontWeight={700} offset={6} />
                    </Bar>
                    <Bar dataKey="rescheduled_pct" name="No. of Rescheduled" fill="#8B5CF6" barSize={18} radius={[4, 4, 0, 0]} isAnimationActive={false}>
                      <LabelList dataKey="rescheduled_pct" position="top" formatter={(v: any) => (v !== undefined && v !== null ? `${Number(v).toFixed(1)}%` : '')} fill="#6D28D9" fontSize={9.5} fontWeight={700} offset={6} />
                    </Bar>
                  </BarChart>
                ) : (
                  <BarChart data={sorted_by_program} margin={{ top: 32, right: 24, left: 6, bottom: 65 }} barGap={5} barCategoryGap="22%">
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="name" interval={0} height={65} tick={renderRotatedTick} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                    <Tooltip
                      formatter={(val: any, name: any) =>
                        name === 'No. of Rescheduled'
                          ? [`${Number(val || 0).toLocaleString()} rescheduled`, name]
                          : [`${Number(val || 0).toLocaleString()} sessions`, name]
                      }
                      contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #BFDBFE', fontSize: '11px' }}
                    />
                    <Legend iconSize={12} wrapperStyle={{ fontSize: '14px', fontWeight: 700, paddingTop: '12px' }} />
                    <Bar dataKey="sessions_not_conducted" name="Not Conducted Sessions" fill="#EF4444" barSize={16} radius={[4, 4, 0, 0]} isAnimationActive={false}>
                      <LabelList dataKey="sessions_not_conducted" position="top" formatter={(v: any) => (v !== undefined && v !== null ? v : '')} fill="#B91C1C" fontSize={9} fontWeight={700} offset={6} />
                    </Bar>
                    <Bar dataKey="sessions_rescheduled" name="No. of Rescheduled" fill="#8B5CF6" barSize={16} radius={[4, 4, 0, 0]} isAnimationActive={false}>
                      <LabelList dataKey="sessions_rescheduled" position="top" formatter={(v: any) => (v !== undefined && v !== null ? v : '')} fill="#6D28D9" fontSize={9} fontWeight={700} offset={6} />
                    </Bar>
                    <Bar dataKey="total_scheduled" name="Total Scheduled Slots" fill="#3B82F6" barSize={16} radius={[4, 4, 0, 0]} isAnimationActive={false}>
                      <LabelList dataKey="total_scheduled" position="top" formatter={(v: any) => (v ? v : '')} fill="#1D4ED8" fontSize={9} fontWeight={700} offset={6} />
                    </Bar>
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* PRESENTATION MODE MODAL FOR CHARTS */}
      {fullscreenChart && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs z-[9999] flex items-center justify-center p-4 sm:p-6 animate-fadeIn">
          <div className="bg-white w-full max-w-6xl h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
            <div className="flex items-center justify-between p-4 px-6 border-b border-slate-200 bg-slate-50 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <div className={`w-3.5 h-3.5 rounded-full ${fullscreenChart === 'rm' ? 'bg-indigo-600' : fullscreenChart === 'center' ? 'bg-cyan-600' : 'bg-emerald-600'}`} />
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span>
                    {fullscreenChart === 'rm' && 'RM Wise Scheduling & Conductance Breakdown'}
                    {fullscreenChart === 'center' && 'Center Wise Scheduling & Conductance Breakdown'}
                    {fullscreenChart === 'program' && 'Program Wise Scheduling & Conductance Breakdown'}
                  </span>
                  <span className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded bg-[#008C95]/10 text-[#008C95] border border-[#008C95]/30 font-mono font-semibold">
                    Presentation Mode
                  </span>
                </h3>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200 text-xs font-medium">
                  <span className="text-[11px] text-slate-500 px-1 font-semibold">View Metric:</span>
                  <button
                    onClick={() => {
                      if (fullscreenChart === 'rm') setRmMetric('rate');
                      else if (fullscreenChart === 'center') setCenterMetric('rate');
                      else setProgramMetric('rate');
                    }}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer transition-all ${
                      (fullscreenChart === 'rm' ? rmMetric : fullscreenChart === 'center' ? centerMetric : programMetric) === 'rate'
                        ? 'bg-white text-slate-900 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Percentage (%)
                  </button>
                  <button
                    onClick={() => {
                      if (fullscreenChart === 'rm') setRmMetric('volume');
                      else if (fullscreenChart === 'center') setCenterMetric('volume');
                      else setProgramMetric('volume');
                    }}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer transition-all ${
                      (fullscreenChart === 'rm' ? rmMetric : fullscreenChart === 'center' ? centerMetric : programMetric) === 'volume'
                        ? 'bg-white text-slate-900 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Session Volume
                  </button>
                </div>
                <button
                  onClick={() =>
                    handleExportChartExcel(
                      fullscreenChart,
                      fullscreenChart === 'rm'
                        ? 'Scheduling_RM_Wise_Breakdown'
                        : fullscreenChart === 'center'
                        ? 'Scheduling_Center_Wise_Top10_Breakdown'
                        : 'Scheduling_Program_Wise_Top10_Breakdown',
                      fullscreenChart === 'rm'
                        ? sorted_by_rm
                        : fullscreenChart === 'center'
                        ? sorted_by_center
                        : sorted_by_program
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
                {(fullscreenChart === 'rm' ? rmMetric : fullscreenChart === 'center' ? centerMetric : programMetric) === 'rate' ? (
                  <BarChart data={fullscreenChart === 'rm' ? sorted_by_rm : fullscreenChart === 'center' ? sorted_by_center : sorted_by_program} margin={{ top: 32, right: 24, left: 6, bottom: 85 }} barGap={6} barCategoryGap="22%">
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="name" interval={0} height={85} tick={renderRotatedTick} />
                    <YAxis unit="%" domain={[0, (dataMax: number) => Math.max(20, Math.ceil((dataMax || 0) * 1.15))]} tick={{ fontSize: 11, fill: '#64748B' }} />
                    <Tooltip
                      formatter={(val: any, name: any) => [`${Number(val || 0).toFixed(1)}%`, name]}
                      contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #BFDBFE', fontSize: '11px' }}
                    />
                    <Legend iconSize={13} wrapperStyle={{ fontSize: '15px', fontWeight: 700, paddingTop: '15px' }} />
                    <Bar dataKey="missed_pct" name="Missed / Not Conducted %" fill="#EF4444" barSize={22} radius={[4, 4, 0, 0]} isAnimationActive={false}>
                      <LabelList dataKey="missed_pct" position="top" formatter={(v: any) => (v !== undefined && v !== null ? `${Number(v).toFixed(1)}%` : '')} fill="#B91C1C" fontSize={10} fontWeight={700} offset={6} />
                    </Bar>
                    <Bar dataKey="rescheduled_pct" name="No. of Rescheduled" fill="#8B5CF6" barSize={22} radius={[4, 4, 0, 0]} isAnimationActive={false}>
                      <LabelList dataKey="rescheduled_pct" position="top" formatter={(v: any) => (v !== undefined && v !== null ? `${Number(v).toFixed(1)}%` : '')} fill="#6D28D9" fontSize={10} fontWeight={700} offset={6} />
                    </Bar>
                  </BarChart>
                ) : (
                  <BarChart data={fullscreenChart === 'rm' ? sorted_by_rm : fullscreenChart === 'center' ? sorted_by_center : sorted_by_program} margin={{ top: 32, right: 24, left: 6, bottom: 85 }} barGap={6} barCategoryGap="22%">
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="name" interval={0} height={85} tick={renderRotatedTick} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                    <Tooltip
                      formatter={(val: any, name: any) =>
                        name === 'No. of Rescheduled'
                          ? [`${Number(val || 0).toLocaleString()} rescheduled`, name]
                          : [`${Number(val || 0).toLocaleString()} sessions`, name]
                      }
                      contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #BFDBFE', fontSize: '11px' }}
                    />
                    <Legend iconSize={13} wrapperStyle={{ fontSize: '15px', fontWeight: 700, paddingTop: '15px' }} />
                    <Bar dataKey="sessions_not_conducted" name="Not Conducted Sessions" fill="#EF4444" barSize={20} radius={[4, 4, 0, 0]} isAnimationActive={false}>
                      <LabelList dataKey="sessions_not_conducted" position="top" formatter={(v: any) => (v !== undefined && v !== null ? v : '')} fill="#B91C1C" fontSize={10} fontWeight={700} offset={6} />
                    </Bar>
                    <Bar dataKey="sessions_rescheduled" name="No. of Rescheduled" fill="#8B5CF6" barSize={20} radius={[4, 4, 0, 0]} isAnimationActive={false}>
                      <LabelList dataKey="sessions_rescheduled" position="top" formatter={(v: any) => (v !== undefined && v !== null ? v : '')} fill="#6D28D9" fontSize={10} fontWeight={700} offset={6} />
                    </Bar>
                    <Bar dataKey="total_scheduled" name="Total Scheduled Slots" fill="#3B82F6" barSize={20} radius={[4, 4, 0, 0]} isAnimationActive={false}>
                      <LabelList dataKey="total_scheduled" position="top" formatter={(v: any) => (v ? v : '')} fill="#1D4ED8" fontSize={10} fontWeight={700} offset={6} />
                    </Bar>
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Main Table Container Card */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs relative">
        
        {/* BATCHES SUMMARY HEADER TOOLBAR */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/70 rounded-t-2xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#008C95]/10 rounded-xl text-[#008C95]">
              <ListTree className="w-5 h-5 text-[#008C95]" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight">
                Batches Summary
              </h2>
              <p className="text-[11px] text-slate-500 font-medium">
                Aggregated conductance, faculty assignments, and rescheduled classes per batch
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap self-start md:self-auto">
            <button
              type="button"
              onClick={() =>
                handleExportChartExcel(
                  'batch_summary',
                  'Scheduling_Batch_Summary_Raw_Data',
                  sortedBatches
                )
              }
              disabled={exportingChart === 'batch_summary'}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-600 hover:text-white transition-all shadow-2xs cursor-pointer disabled:opacity-60"
              title="Export Batch Summary along with underlying raw session slot records and slot replacements to Excel for manual verification"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{exportingChart === 'batch_summary' ? 'Exporting Raw Data...' : 'Export Raw Data (Excel)'}</span>
            </button>

            <button
              type="button"
              onClick={handleToggleExpandAll}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
            >
              {isAllExpanded ? <Minimize2 className="w-3.5 h-3.5 text-slate-500" /> : <Maximize2 className="w-3.5 h-3.5 text-[#008C95]" />}
              <span>{isAllExpanded ? 'Collapse All Batches' : 'Expand All Batches (Show Sessions)'}</span>
            </button>
          </div>
        </div>

        {/* Table Filter Toolbar */}
        <div className="p-4 sm:p-5 border-b border-slate-200/70 space-y-3.5 relative z-20">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by Batch Code, Center, Program, Faculty Email, or Date..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:border-[#008C95] focus:bg-white transition-all"
              />
              {searchTerm && (
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setCurrentPage(1);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Quick Segment Filter Tabs */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold text-slate-600 shrink-0 self-start md:self-auto overflow-x-auto">
              <button
                onClick={() => { setStatusFilterTab('all'); setCurrentPage(1); }}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  statusFilterTab === 'all'
                    ? 'bg-white text-slate-900 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title={`${tabCounts.uniqueAll.toLocaleString()} unique batches (${tabCounts.allRows.toLocaleString()} faculty-batch schedules)`}
              >
                All Batches ({tabCounts.uniqueAll.toLocaleString()} Batches / {tabCounts.allRows.toLocaleString()} Rows)
              </button>
              <button
                onClick={() => { setStatusFilterTab('missed_only'); setCurrentPage(1); }}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  statusFilterTab === 'missed_only'
                    ? 'bg-white text-amber-900 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-amber-800'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                With Missed ({tabCounts.withMissedRows.toLocaleString()})
              </button>
              <button
                onClick={() => { setStatusFilterTab('zero_missed'); setCurrentPage(1); }}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  statusFilterTab === 'zero_missed'
                    ? 'bg-white text-emerald-900 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-emerald-800'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                100% Conducted ({tabCounts.zeroMissedRows.toLocaleString()})
              </button>
            </div>
          </div>

          {/* Secondary Dropdown Selectors */}
          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
              <Filter className="w-3.5 h-3.5" />
              <span>Filters:</span>
            </div>

            {/* RM Wise Multi-Select */}
            <RmMultiSelect
              options={scopedOptions.rmOptions}
              selectedRms={selectedRms}
              selectedRm={selectedRms.join(',')}
              onChange={handleRmsChange}
              programOptions={scopedOptions.programOptions}
              selectedPrograms={selectedPrograms}
              selectedProgram={selectedPrograms.join(',')}
              onProgramsChange={handleProgramsChange}
              compact
            />

            {/* Center Code Multi-Select */}
            <CenterMultiSelect
              options={scopedOptions.centerOptions}
              selectedCenters={selectedCenters}
              selectedCenter={selectedCenters.join(',')}
              onChange={handleCentersChange}
              programOptions={scopedOptions.programOptions}
              selectedPrograms={selectedPrograms}
              selectedProgram={selectedPrograms.join(',')}
              onProgramsChange={handleProgramsChange}
              compact
            />

            {/* Program Multi-Select Filter */}
            <ProgramMultiSelect
              options={scopedOptions.programOptions}
              selectedPrograms={selectedPrograms}
              selectedProgram={selectedPrograms.join(',')}
              onChange={handleProgramsChange}
              compact
            />

            {/* Batch Status Select */}
            <select
              value={selectedBatchStatus}
              onChange={(e) => {
                setSelectedBatchStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 font-medium hover:border-slate-300 focus:outline-hidden focus:border-[#008C95] cursor-pointer"
            >
              <option value="ALL">All Batch Statuses ({batchStatusOptions.length})</option>
              {batchStatusOptions.map(st => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>

            {/* Date Range Filter (Compact) */}
            <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200">
              <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span className="text-[11px] font-semibold text-slate-600 whitespace-nowrap">From:</span>
              <input
                type="date"
                value={filters?.startDate || ''}
                onChange={(e) => {
                  setCurrentPage(1);
                  onFilterChange?.({ ...filters, startDate: e.target.value || undefined });
                }}
                className="bg-white border border-slate-300 rounded px-1.5 py-0.5 text-xs text-slate-800 font-medium focus:outline-hidden focus:ring-1 focus:ring-[#008C95] cursor-pointer"
              />
              <span className="text-[11px] font-semibold text-slate-600 whitespace-nowrap">To:</span>
              <input
                type="date"
                value={filters?.endDate || ''}
                onChange={(e) => {
                  setCurrentPage(1);
                  onFilterChange?.({ ...filters, endDate: e.target.value || undefined });
                }}
                className="bg-white border border-slate-300 rounded px-1.5 py-0.5 text-xs text-slate-800 font-medium focus:outline-hidden focus:ring-1 focus:ring-[#008C95] cursor-pointer"
              />
              {(filters?.startDate || filters?.endDate) && (
                <button
                  onClick={() => {
                    setCurrentPage(1);
                    onFilterChange?.({ ...filters, startDate: undefined, endDate: undefined });
                  }}
                  className="p-0.5 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                  title="Clear Date Filter"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {(searchTerm || selectedRms.length > 0 || selectedCenters.length > 0 || selectedCenter !== 'ALL' || selectedPrograms.length > 0 || selectedProgram !== 'ALL' || selectedBatchStatus !== 'ALL' || statusFilterTab !== 'all' || filters?.startDate || filters?.endDate) && (
              <button
                onClick={handleResetFilters}
                className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 px-2 py-1 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            )}

            <div className="ml-auto text-xs text-slate-500 font-medium">
              <span>Showing <strong className="text-slate-900">{filteredBatches.length}</strong> matching batches</span>
            </div>
          </div>
        </div>

        {/* BATCH SUMMARY TABLE WITH INLINE EXPAND RECORDS */}
        <div className="overflow-x-auto min-h-[300px]">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <div className="w-8 h-8 border-3 border-[#008C95] border-t-transparent rounded-full animate-spin mb-3" />
                <p className="text-xs font-semibold">Loading batch scheduling records...</p>
              </div>
            ) : filteredBatches.length === 0 ? (
              <div className="text-center py-16 px-4">
                <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto text-slate-400 mb-3">
                  <CalendarDays className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-slate-800 mb-1">No Scheduling Records Found</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
                  No batches match the selected criteria. Try adjusting your search query, center filter, or program selection.
                </p>
                <button
                  onClick={handleResetFilters}
                  className="text-xs font-semibold text-[#008C95] hover:underline cursor-pointer"
                >
                  Clear all filters
                </button>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200/80 bg-slate-50/75 text-[11px] font-bold text-slate-600 uppercase tracking-wider select-none">
                    <th className="py-3 px-3 w-10 text-center"></th>
                    <th
                      onClick={() => handleSort('center_code')}
                      className="py-3 px-4 cursor-pointer hover:bg-slate-100/80 transition-colors"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Center Code</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('batch_code')}
                      className="py-3 px-4 cursor-pointer hover:bg-slate-100/80 transition-colors"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Batch Code</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('program_name')}
                      className="py-3 px-4 cursor-pointer hover:bg-slate-100/80 transition-colors"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Program Name</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('fm_email_id')}
                      className="py-3 px-4 cursor-pointer hover:bg-slate-100/80 transition-colors"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>FM Email ID</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('batch_status')}
                      className="py-3 px-4 text-center cursor-pointer hover:bg-slate-100/80 transition-colors"
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        <span>Status</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('total_scheduled')}
                      className="py-3 px-4 text-center cursor-pointer hover:bg-slate-100/80 transition-colors"
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        <span>Total Scheduled</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('sessions_not_conducted')}
                      className="py-3 px-4 text-center cursor-pointer hover:bg-slate-100/80 transition-colors"
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        <span>No. of Session Not Conducted</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('sessions_rescheduled')}
                      className="py-3 px-4 text-center cursor-pointer hover:bg-slate-100/80 transition-colors"
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        <span>No. of Rescheduled</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('conducted_pct')}
                      className="py-3 px-4 text-right cursor-pointer hover:bg-slate-100/80 transition-colors"
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        <span>Conducted %</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>
                    <th className="py-3 px-4 text-center">
                      <span>Action</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {paginatedBatches.map((batch, batchIdx) => {
                    const rowKey = `${batch.batch_code}___${batch.fm_email_id || ''}`;
                    const isExpanded = !!expandedBatches[rowKey];
                    const hasMissed = batch.sessions_not_conducted > 0;
                    const isComplete = batch.batch_status?.toLowerCase() === 'complete';
                    const pct = batch.conducted_pct;
                    const details = batchDetailsCache[rowKey] || [];
                    const isLoadingDetails = !!loadingBatchMap[rowKey];

                    return (
                      <React.Fragment key={`${rowKey}___${batchIdx}`}>
                        <tr
                          onClick={() => toggleExpandBatch(batch.batch_code, batch.fm_email_id)}
                          className={`hover:bg-teal-50/40 transition-colors cursor-pointer group ${
                            isExpanded ? 'bg-teal-50/20 font-medium' : ''
                          }`}
                        >
                          {/* Expand Arrow */}
                          <td className="py-3 px-3 text-center">
                            <button
                              type="button"
                              onClick={(e) => toggleExpandBatch(batch.batch_code, batch.fm_email_id, e)}
                              className="p-1 rounded hover:bg-slate-200/70 text-slate-500 hover:text-slate-900 transition-colors"
                              title={isExpanded ? 'Collapse records' : 'Expand all session records for this batch'}
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-[#008C95]" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-700" />
                              )}
                            </button>
                          </td>

                          {/* Center Code */}
                          <td className="py-3 px-4 font-mono font-semibold text-slate-800">
                            <span className="inline-block px-2.5 py-0.5 rounded-md bg-slate-100 border border-slate-200/80 text-slate-700 font-mono text-[11px]">
                              {batch.center_code || '—'}
                            </span>
                          </td>

                          {/* Batch Code */}
                          <td className="py-3 px-4 font-mono font-bold text-slate-900 group-hover:text-[#008C95] transition-colors">
                            <div className="flex items-center gap-1.5">
                              <span>{batch.batch_code}</span>
                              {isComplete && (
                                <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-slate-100 text-slate-500 font-sans font-semibold">
                                  closed
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Program Name */}
                          <td className="py-3 px-4 text-slate-700">
                            <div className="inline-flex items-center gap-1.5 font-medium">
                              <BookOpen className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="truncate max-w-[180px]">{batch.program_name || '—'}</span>
                            </div>
                          </td>

                          {/* FM Email ID */}
                          <td className="py-3 px-4 text-slate-600">
                            <div className="flex items-center gap-1.5 max-w-[220px]">
                              <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="truncate text-slate-700 font-medium" title={batch.fm_email_id}>
                                {batch.fm_email_id || '—'}
                              </span>
                              {batch.fm_email_id && batch.fm_email_id !== '—' && (
                                <button
                                  onClick={(e) => handleCopyEmail(batch.fm_email_id, e)}
                                  className="text-slate-400 hover:text-slate-700 p-0.5 rounded transition-colors"
                                  title="Copy email"
                                >
                                  {copiedEmail === batch.fm_email_id ? (
                                    <Check className="w-3 h-3 text-emerald-600" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                              )}
                            </div>
                          </td>

                          {/* Batch Status */}
                          <td className="py-3 px-4 text-center">
                            <span className={`inline-block px-2.5 py-0.5 rounded-full font-mono text-[11px] font-semibold ${
                              batch.batch_status?.toLowerCase() === 'complete'
                                ? 'bg-slate-100 text-slate-700 border border-slate-200'
                                : batch.batch_status?.toLowerCase() === 'running'
                                ? 'bg-teal-50 text-teal-800 border border-teal-200'
                                : 'bg-amber-50 text-amber-800 border border-amber-200'
                            }`}>
                              {batch.batch_status || 'Running'}
                            </span>
                          </td>

                          {/* Total Scheduled */}
                          <td className="py-3 px-4 text-center font-bold text-slate-800">
                            <span className="inline-block px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-800 font-mono text-[11px] font-bold">
                              {batch.total_scheduled} slots
                            </span>
                          </td>

                          {/* No. of Session Not Conducted */}
                          <td className="py-3 px-4 text-center">
                            {hasMissed ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100/90 text-amber-900 border border-amber-200 font-mono text-[11px] font-extrabold">
                                <AlertTriangle className="w-3 h-3 text-amber-700" />
                                <span>{batch.sessions_not_conducted} missed</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 font-mono text-[11px] font-semibold">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>0 missed</span>
                              </span>
                            )}
                          </td>

                          {/* No. of Rescheduled */}
                          <td className="py-3 px-4 text-center font-bold text-slate-800">
                            {(batch.sessions_rescheduled || 0) > 0 ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-purple-100/90 text-purple-900 border border-purple-200 font-mono text-[11px] font-extrabold">
                                <CalendarDays className="w-3 h-3 text-purple-700" />
                                <span>{batch.sessions_rescheduled} rescheduled</span>
                              </span>
                            ) : (
                              <span className="inline-block px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-mono text-[11px] font-medium">
                                0
                              </span>
                            )}
                          </td>

                          {/* Conducted % */}
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    pct >= 90
                                      ? 'bg-emerald-500'
                                      : pct >= 70
                                      ? 'bg-sky-500'
                                      : 'bg-amber-500'
                                  }`}
                                  style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                                />
                              </div>
                              <span className="font-mono font-bold text-slate-800 min-w-[42px] text-right">
                                {pct}%
                              </span>
                            </div>
                          </td>

                          {/* Action */}
                          <td className="py-3 px-4 text-center">
                            <button
                              type="button"
                              onClick={(e) => toggleExpandBatch(batch.batch_code, batch.fm_email_id, e)}
                              className="px-2.5 py-1 text-[11px] font-semibold text-[#008C95] hover:text-[#005F66] hover:bg-[#008C95]/10 rounded-lg transition-colors cursor-pointer"
                            >
                              {isExpanded ? 'Hide Records' : `Show All ${batch.total_scheduled} Records`}
                            </button>
                          </td>
                        </tr>

                        {/* NESTED EXPANDED ROW SHOWING ALL SESSION RECORDS FOR THIS BATCH */}
                        {isExpanded && (
                          <tr className="bg-slate-50/80 border-b-2 border-[#008C95]/20">
                            <td colSpan={11} className="p-3 sm:p-4">
                              <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4 shadow-2xs space-y-3">
                                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                                  <div className="flex items-center gap-2">
                                    <CalendarClock className="w-4 h-4 text-[#008C95]" />
                                    <span className="font-bold text-slate-900 text-xs">
                                      All {batch.total_scheduled} Session Records for Batch {batch.batch_code}
                                    </span>
                                    <span className="text-[11px] text-slate-500">
                                      ({batch.sessions_not_conducted} missed, {batch.sessions_conducted} conducted)
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2.5 flex-wrap">
                                    <span className="text-[11px] text-slate-500 font-mono">
                                      Faculty: {batch.fm_email_id}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleExportChartExcel(
                                          `batch_summary_${batch.batch_code}`,
                                          `Scheduling_Batch_${batch.batch_code}_Raw_Data`,
                                          [batch]
                                        );
                                      }}
                                      disabled={exportingChart === `batch_summary_${batch.batch_code}`}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-600 hover:text-white border border-emerald-200 transition-all cursor-pointer disabled:opacity-60"
                                      title="Export this batch's summary and all underlying raw session slot records to Excel"
                                    >
                                      <Download className="w-3 h-3" />
                                      <span>
                                        {exportingChart === `batch_summary_${batch.batch_code}`
                                          ? 'Exporting...'
                                          : 'Export Raw Data (Excel)'}
                                      </span>
                                    </button>
                                  </div>
                                </div>

                                {isLoadingDetails ? (
                                  <div className="py-6 text-center text-slate-400">
                                    <div className="w-5 h-5 border-2 border-[#008C95] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                                    <p className="text-[11px] font-semibold">Loading session records...</p>
                                  </div>
                                ) : details.length === 0 ? (
                                  <div className="py-4 text-center text-xs text-slate-500">
                                    No detailed session records available for this batch.
                                  </div>
                                ) : (
                                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                                    <table className="w-full text-left text-[11px] border-collapse">
                                      <thead>
                                        <tr className="bg-slate-100/90 text-slate-700 font-bold uppercase border-b border-slate-200">
                                          <th className="py-2 px-3">Slot Date</th>
                                          <th className="py-2 px-3">Schedule Time</th>
                                          <th className="py-2 px-3">Actual Time</th>
                                          <th className="py-2 px-3">Actual Status</th>
                                          <th className="py-2 px-3">Form Status</th>
                                          <th className="py-2 px-3">Meet Link</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100">
                                        {details.map((s, idx) => {
                                          const actStatus = (s.actual_status || '').toLowerCase();
                                          const frmStatus = (s.form_status || '').toLowerCase();
                                          const isNotConducted =
                                            (actStatus.includes('not started') || actStatus.includes('not ended')) &&
                                            (frmStatus.includes('no form') || frmStatus.includes('not filled'));

                                          return (
                                            <tr
                                              key={s.id || idx}
                                              className={`hover:bg-slate-50 transition-colors ${
                                                isNotConducted ? 'bg-amber-50/50' : ''
                                              }`}
                                            >
                                              <td className="py-2 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                                                {s.slot_date || '—'}
                                              </td>
                                              <td className="py-2 px-3 text-slate-600 whitespace-nowrap">
                                                {s.schedule_class_start_time || '—'} - {s.schedule_class_end_time || '—'}
                                              </td>
                                              <td className="py-2 px-3 text-slate-600 whitespace-nowrap">
                                                {s.actual_class_started ? (
                                                  <span>{s.actual_class_started} - {s.actual_class_ended || '—'}</span>
                                                ) : (
                                                  <span className="text-slate-400 italic">Not recorded</span>
                                                )}
                                              </td>
                                              <td className="py-2 px-3 whitespace-nowrap">
                                                {isNotConducted ? (
                                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-bold text-[10px]">
                                                    <AlertTriangle className="w-2.5 h-2.5 text-amber-700" />
                                                    <span>{s.actual_status}</span>
                                                  </span>
                                                ) : (
                                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 font-semibold text-[10px]">
                                                    <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                                                    <span>{s.actual_status || 'Conducted'}</span>
                                                  </span>
                                                )}
                                              </td>
                                              <td className="py-2 px-3 whitespace-nowrap">
                                                <span
                                                  className={`inline-block px-1.5 py-0.5 rounded font-mono text-[10px] ${
                                                    frmStatus.includes('no form')
                                                      ? 'bg-rose-50 text-rose-800 font-bold border border-rose-200'
                                                      : 'bg-slate-100 text-slate-700'
                                                  }`}
                                                >
                                                  {s.form_status || '—'}
                                                </span>
                                              </td>
                                              <td className="py-2 px-3 max-w-[140px] truncate">
                                                {s.class_link ? (
                                                  <a
                                                    href={s.class_link}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-[#008C95] hover:underline flex items-center gap-1 truncate"
                                                    title={s.class_link}
                                                  >
                                                    <ExternalLink className="w-3 h-3 shrink-0" />
                                                    <span className="truncate">{s.gmeet_id || 'Meet Link'}</span>
                                                  </a>
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
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        {/* PAGINATION FOOTER */}
        <div className="p-3.5 sm:p-4 border-t border-slate-200/80 bg-slate-50/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
          <div className="flex items-center gap-2 flex-wrap">
            <span>Show</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-700 font-medium cursor-pointer"
            >
              <option value={15}>15 rows</option>
              <option value={20}>20 rows</option>
              <option value={50}>50 rows</option>
              <option value={100}>100 rows</option>
              <option value={250}>250 rows</option>
              <option value={500}>500 rows</option>
              <option value={1000}>1,000 rows</option>
              <option value={2370}>2,370 rows (All Report Records)</option>
              <option value={10000}>All ({filteredBatches.length} records)</option>
            </select>
            <span>per page</span>
            <span className="text-slate-400">|</span>
            <span>
              Showing {(currentPage - 1) * pageSize + 1} to{' '}
              {Math.min(currentPage * pageSize, filteredBatches.length)} of {filteredBatches.length} batches
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              First
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              Previous
            </button>
            <span className="px-2.5 py-1 font-semibold text-slate-800">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              Next
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              Last
            </button>
          </div>
        </div>

      </div>

      {/* Drilldown Modal: Batch Session Ledger */}
      {activeBatchModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/80 flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-md bg-[#008C95]/10 text-[#008C95] font-mono text-xs font-bold">
                    {activeBatchModal.batch_code}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-200/80 text-slate-700 font-mono text-xs font-semibold">
                    Center: {activeBatchModal.center_code}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-xs font-medium">
                    {activeBatchModal.program_name}
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 mt-1">
                  Batch Session Scheduling Ledger
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Assigned Faculty: <span className="font-semibold text-slate-700">{activeBatchModal.fm_email_id}</span> • Total Scheduled: <span className="font-bold text-sky-800">{activeBatchModal.total_scheduled}</span> • Missed / Not Conducted: <span className="font-bold text-amber-800">{activeBatchModal.sessions_not_conducted}</span>
                </p>
              </div>

              <button
                onClick={() => {
                  setActiveBatchModal(null);
                  setBatchSessions([]);
                }}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Table Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5">
              {loadingBatchDetails ? (
                <div className="py-16 text-center text-slate-400">
                  <div className="w-8 h-8 border-3 border-[#008C95] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-xs font-semibold">Fetching session slot breakdown...</p>
                </div>
              ) : batchSessions.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs">
                  No detailed session slot records found for this batch.
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-[11px] font-bold text-slate-600 uppercase border-b border-slate-200">
                        <th className="py-2.5 px-3">Slot Date</th>
                        <th className="py-2.5 px-3">Scheduled Time</th>
                        <th className="py-2.5 px-3">Actual Time</th>
                        <th className="py-2.5 px-3">Actual Status</th>
                        <th className="py-2.5 px-3">Form Status</th>
                        <th className="py-2.5 px-3">Meet Link</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {batchSessions.map((session, idx) => {
                        const actStatus = (session.actual_status || '').toLowerCase();
                        const frmStatus = (session.form_status || '').toLowerCase();
                        const isNotConducted =
                          (actStatus.includes('not started') || actStatus.includes('not ended')) &&
                          (frmStatus.includes('no form') || frmStatus.includes('not filled'));

                        return (
                          <tr
                            key={session.id || idx}
                            className={`hover:bg-slate-50/70 transition-colors ${
                              isNotConducted ? 'bg-amber-50/40' : ''
                            }`}
                          >
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                              {session.slot_date || '—'}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                              {session.schedule_class_start_time || '—'} - {session.schedule_class_end_time || '—'}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                              {session.actual_class_started ? (
                                <span>{session.actual_class_started} - {session.actual_class_ended || '—'}</span>
                              ) : (
                                <span className="text-slate-400 italic">Not recorded</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              {isNotConducted ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-semibold text-[11px]">
                                  <AlertTriangle className="w-3 h-3 text-amber-700" />
                                  <span>{session.actual_status}</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 font-semibold text-[11px]">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  <span>{session.actual_status || 'Conducted'}</span>
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <span
                                className={`inline-block px-2 py-0.5 rounded-md font-mono text-[10px] ${
                                  frmStatus.includes('no form')
                                    ? 'bg-rose-50 text-rose-800 font-bold border border-rose-200'
                                    : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {session.form_status || '—'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 max-w-[150px] truncate">
                              {session.class_link ? (
                                <a
                                  href={session.class_link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[#008C95] hover:underline flex items-center gap-1 truncate"
                                  title={session.class_link}
                                >
                                  <ExternalLink className="w-3 h-3 shrink-0" />
                                  <span className="truncate">{session.gmeet_id || 'Link'}</span>
                                </a>
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
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 sm:p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
              <span>{batchSessions.length} total scheduled slots tracked for {activeBatchModal.batch_code}</span>
              <button
                onClick={() => {
                  setActiveBatchModal(null);
                  setBatchSessions([]);
                }}
                className="px-4 py-1.5 rounded-xl bg-slate-800 text-white font-semibold hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
