import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  FileText,
  Search,
  RefreshCw,
  Download,
  Users,
  AlertCircle,
  Filter,
  CheckCircle2,
  Maximize2,
  Minimize2,
  X,
} from 'lucide-react';
import { ChallengeRecord, FilterParams } from '../types';
import { api } from '../api';

interface ChallengesViewProps {
  data?: { rows: ChallengeRecord[]; totalCount: number } | null;
  loading?: boolean;
  filters?: FilterParams;
  onRefresh?: () => void;
}

export const ChallengesView: React.FC<ChallengesViewProps> = ({
  data,
  loading: parentLoading = false,
  filters,
  onRefresh,
}) => {
  const [localRows, setLocalRows] = useState<ChallengeRecord[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [fetching, setFetching] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedRm, setSelectedRm] = useState<string>('ALL');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Close fullscreen on Escape key and prevent background scrolling
  useEffect(() => {
    if (!isFullscreen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsFullscreen(false);
      }
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFullscreen]);

  // Sync from parent data when provided
  useEffect(() => {
    if (data && Array.isArray(data.rows)) {
      setLocalRows(data.rows);
      setTotalCount(data.totalCount || data.rows.length);
    } else {
      fetchChallengesData();
    }
  }, [data]);

  // Sync with global RM filter if active
  useEffect(() => {
    if (filters?.rmShZh && filters.rmShZh !== 'ALL') {
      setSelectedRm(filters.rmShZh);
    } else {
      setSelectedRm('ALL');
    }
  }, [filters?.rmShZh]);

  const fetchChallengesData = async () => {
    setFetching(true);
    try {
      const res = await api.getChallenges(2000, 0, '');
      setLocalRows(res.rows || []);
      setTotalCount(res.totalCount || (res.rows ? res.rows.length : 0));
    } catch (err) {
      console.error('Failed to fetch challenges:', err);
    } finally {
      setFetching(false);
    }
  };

  const handleManualRefresh = () => {
    if (onRefresh) {
      onRefresh();
    } else {
      fetchChallengesData();
    }
  };

  const uniqueRmNames = useMemo(() => {
    const set = new Set<string>();
    localRows.forEach((r) => {
      if (r.rm_name && String(r.rm_name).trim() !== '') {
        set.add(String(r.rm_name).trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [localRows]);

  const filteredRows = useMemo(() => {
    return localRows.filter((row) => {
      if (selectedRm !== 'ALL') {
        const rowRm = String(row.rm_name || '').trim().toLowerCase();
        const targetRm = selectedRm.trim().toLowerCase();
        if (!rowRm.includes(targetRm) && !targetRm.includes(rowRm)) {
          return false;
        }
      }

      if (searchQuery.trim() !== '') {
        const q = searchQuery.trim().toLowerCase();
        const slMatch = String(row.sl_no || '').toLowerCase().includes(q);
        const rmMatch = String(row.rm_name || '').toLowerCase().includes(q);
        const chMatch = String(row.challenges || '').toLowerCase().includes(q);
        const impMatch = String(row.impact || '').toLowerCase().includes(q);
        return slMatch || rmMatch || chMatch || impMatch;
      }

      return true;
    });
  }, [localRows, selectedRm, searchQuery]);

  const isRmFiltered = selectedRm !== 'ALL';
  const isSearchFiltered = searchQuery.trim() !== '';

  const getDisplaySlNo = (row: ChallengeRecord, idx: number) => {
    // When RM Name is filtered (e.g. Sanjeev Kumar), dynamically arrange Sl No. starting from 1, 2, 3...
    if (isRmFiltered || isSearchFiltered) {
      return idx + 1;
    }
    return row.sl_no !== null && row.sl_no !== undefined && String(row.sl_no).trim() !== ''
      ? row.sl_no
      : idx + 1;
  };

  const exportToCsv = () => {
    const headers = ['Sl No.', 'RM Name', 'Challenges', 'Impact'];
    const csvRows = filteredRows.map((r, idx) => [
      `"${String(getDisplaySlNo(r, idx)).replace(/"/g, '""')}"`,
      `"${String(r.rm_name ?? '').replace(/"/g, '""')}"`,
      `"${String(r.challenges ?? '').replace(/"/g, '""')}"`,
      `"${String(r.impact ?? '').replace(/"/g, '""')}"`,
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...csvRows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `RM_Challenges_Impact_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isLoading = parentLoading || fetching;

  const renderTableContent = (inModal = false) => (
    <table className="w-full text-left border-collapse">
      <thead className="sticky top-0 z-10">
        <tr className="bg-slate-100 border-b border-slate-200 text-xs font-extrabold text-slate-800 uppercase tracking-wider">
          <th className="py-3.5 px-4 w-20 text-center border-r border-slate-200/70">
            Sl No.
          </th>
          <th className="py-3.5 px-5 w-56 border-r border-slate-200/70">
            RM Name
          </th>
          <th className="py-3.5 px-5 w-[42%] border-r border-slate-200/70">
            Challenges
          </th>
          <th className="py-3.5 px-5">
            Impact
          </th>
        </tr>
      </thead>
      <tbody className={`divide-y divide-slate-200 ${inModal ? 'text-sm' : 'text-xs'} text-slate-900`}>
        {isLoading ? (
          <tr>
            <td colSpan={4} className="py-16 text-center text-slate-500">
              <div className="flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-[#008C95]" />
                <span>Loading challenges records...</span>
              </div>
            </td>
          </tr>
        ) : filteredRows.length === 0 ? (
          <tr>
            <td colSpan={4} className="py-16 text-center">
              <div className="max-w-sm mx-auto space-y-2">
                <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div className="text-sm font-bold text-slate-700">
                  No Challenges Records Found
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {totalCount === 0
                    ? 'No records have been uploaded yet. Upload an RM Challenges file from the Admin Upload Center (/admin).'
                    : 'No records match your current search or RM filter criteria.'}
                </p>
              </div>
            </td>
          </tr>
        ) : (
          filteredRows.map((row, idx) => (
            <tr
              key={row.id || idx}
              className="hover:bg-teal-50/40 transition-colors align-top"
            >
              <td className="py-3.5 px-4 font-mono font-bold text-slate-900 text-center border-r border-slate-100 whitespace-nowrap">
                {getDisplaySlNo(row, idx)}
              </td>
              <td className="py-3.5 px-5 font-bold text-slate-900 border-r border-slate-100">
                <div className="break-words">{row.rm_name || '—'}</div>
              </td>
              <td className="py-3.5 px-5 font-bold text-slate-900 border-r border-slate-100 whitespace-pre-wrap break-words leading-relaxed">
                {row.challenges || '—'}
              </td>
              <td className="py-3.5 px-5 font-bold text-slate-900 whitespace-pre-wrap break-words leading-relaxed">
                {row.impact || '—'}
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
              RM Challenges &amp; Impact Dashboard
            </h1>
          </div>
          <p className="text-xs text-slate-500">
            Regional Manager operational challenges and impact analysis for Academic Excellence operations.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <button
            onClick={handleManualRefresh}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-[#008C95]' : ''}`} />
            <span>Refresh Data</span>
          </button>

          <button
            onClick={exportToCsv}
            disabled={filteredRows.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#008C95] hover:bg-[#00747C] text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Total Challenges
            </div>
            <div className="text-2xl font-extrabold font-mono text-slate-900 mt-1">
              {totalCount.toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Total records logged
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#E6F4F5] text-[#008C95] flex items-center justify-center">
            <FileText className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Distinct RMs
            </div>
            <div className="text-2xl font-extrabold font-mono text-indigo-700 mt-1">
              {uniqueRmNames.length.toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Regional Managers represented
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Filtered Records
            </div>
            <div className="text-2xl font-extrabold font-mono text-emerald-700 mt-1">
              {filteredRows.length.toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Matching active search/filter
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter & Search Controls */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Sl No., RM Name, Challenges, or Impact..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#008C95]"
            />
          </div>

          {/* RM Name Filter */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 shrink-0">
              <Filter className="w-3.5 h-3.5 text-[#008C95]" />
              <span>RM Name:</span>
            </div>
            <select
              value={selectedRm}
              onChange={(e) => setSelectedRm(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#008C95]"
            >
              <option value="ALL">All Regional Managers ({uniqueRmNames.length})</option>
              {uniqueRmNames.map((rm) => (
                <option key={rm} value={rm}>
                  {rm}
                </option>
              ))}
            </select>
          </div>
        </div>

        {(selectedRm !== 'ALL' || searchQuery.trim() !== '') && (
          <button
            onClick={() => {
              setSelectedRm('ALL');
              setSearchQuery('');
            }}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer shrink-0"
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* Main Challenges Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/60 flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Challenges &amp; Impact Table
            </h2>
            <p className="text-xs text-slate-500">
              Showing {filteredRows.length} of {totalCount} records
              {isRmFiltered && (
                <span className="ml-1.5 font-semibold text-[#008C95]">
                  &bull; Filtered by RM: {selectedRm} (Sl No. 1 to {filteredRows.length})
                </span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsFullscreen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-[#008C95] hover:text-white transition-all cursor-pointer border border-slate-200 shadow-2xs"
              title="Open Challenges & Impact Table in Presentation Mode"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Presentation Mode</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          {renderTableContent(false)}
        </div>
      </div>

      {/* Fullscreen Modal for Challenges & Impact Table */}
      {isFullscreen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 md:p-6 animate-in fade-in duration-200"
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsFullscreen(false);
            }}
          >
            <div className="bg-white w-full h-full max-w-[1650px] max-h-[96vh] rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
              {/* Modal Top Header */}
              <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0 gap-3 flex-wrap border-b border-slate-800 relative z-20">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-800 rounded-lg text-[#38BDF8]">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <span>Challenges &amp; Impact Table</span>
                      <span className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded bg-[#008C95]/20 text-[#38BDF8] border border-[#008C95]/40 font-mono font-semibold">
                        Presentation Mode
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      Showing {filteredRows.length} of {totalCount} records
                      {isRmFiltered && ` • Filtered by RM: ${selectedRm}`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                  {/* Search in Fullscreen */}
                  <div className="relative w-56 sm:w-64">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search Challenges or Impact..."
                      className="w-full pl-8 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#008C95]"
                    />
                  </div>

                  {/* RM Filter in Fullscreen */}
                  <select
                    value={selectedRm}
                    onChange={(e) => setSelectedRm(e.target.value)}
                    className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-semibold text-white focus:outline-hidden focus:ring-2 focus:ring-[#008C95]"
                  >
                    <option value="ALL">All RMs ({uniqueRmNames.length})</option>
                    {uniqueRmNames.map((rm) => (
                      <option key={rm} value={rm}>
                        {rm}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={exportToCsv}
                    disabled={filteredRows.length === 0}
                    className="px-3 py-1.5 text-emerald-300 hover:text-white bg-emerald-950/60 hover:bg-emerald-700 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-semibold border border-emerald-700/60 disabled:opacity-60"
                  >
                    <Download className="w-4 h-4" />
                    <span>Export CSV</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsFullscreen(false)}
                    className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-bold shadow-sm border border-rose-500"
                    title="Exit Presentation Mode (Esc)"
                  >
                    <Minimize2 className="w-4 h-4" />
                    <span>Exit Presentation Mode</span>
                  </button>
                </div>
              </div>

              {/* Modal Table Body */}
              <div className="flex-1 overflow-auto bg-white">
                {renderTableContent(true)}
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

