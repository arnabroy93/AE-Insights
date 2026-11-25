import React, { useState, useEffect } from 'react';
import {
  Table,
  Search,
  Download,
  Filter,
  Columns,
  ChevronLeft,
  ChevronRight,
  Eye,
  SlidersHorizontal,
  CheckSquare,
  Square,
  Trash2
} from 'lucide-react';
import { api } from '../api';
import { SourceRow, FilterParams } from '../types';

interface DataExplorerProps {
  filters: FilterParams;
  onSelectRecord: (record: SourceRow) => void;
  onOpenClearModal?: () => void;
}

const ALL_30_COLUMNS = [
  { key: 'center_code', label: 'Center Code', defaultVisible: true },
  { key: 'funder_name', label: 'Funder Name', defaultVisible: true },
  { key: 'program_name', label: 'Program Name', defaultVisible: true },
  { key: 'assigned_trainers', label: 'Assigned Trainer', defaultVisible: true },
  { key: 'assigned_ae', label: 'Assigned AE', defaultVisible: true },
  { key: 'rm_sh_zh', label: 'RM / SH / ZH', defaultVisible: false },
  { key: 'batch_code', label: 'Batch Code', defaultVisible: true },
  { key: 'course_code', label: 'Course Code', defaultVisible: false },
  { key: 'batch_start_date', label: 'Batch Start Date', defaultVisible: true },
  { key: 'batch_initial_start_date', label: 'Initial Start Date', defaultVisible: false },
  { key: 'batch_initial_end_date', label: 'Initial End Date', defaultVisible: false },
  { key: 'batch_end_date', label: 'Planned End Date', defaultVisible: true },
  { key: 'batch_actual_end_date', label: 'Actual End Date', defaultVisible: false },
  { key: 'batch_status', label: 'Batch Status', defaultVisible: true },
  { key: 'batch_validation_status', label: 'Batch Val Status', defaultVisible: false },
  { key: 'student_code', label: 'Student Code', defaultVisible: true },
  { key: 'enrollment_status', label: 'Enrollment Status', defaultVisible: true },
  { key: 'dropout_type', label: 'Dropout Type', defaultVisible: true },
  { key: 'email_verification_status', label: 'Email Verif', defaultVisible: false },
  { key: 'final_exam_marks', label: 'Final Exam Marks', defaultVisible: true },
  { key: 'placement_type', label: 'Placement Type', defaultVisible: true },
  { key: 'exam_schedule_date', label: 'Exam Date', defaultVisible: false },
  { key: 'ilt_completion', label: 'ILT Completion %', defaultVisible: true },
  { key: 'fm_class_completion', label: 'FM Completion %', defaultVisible: true },
  { key: 'running_attendance', label: 'Running Attendance %', defaultVisible: true },
  { key: 'beneficiary_class_attendance', label: 'Beneficiary Attendance %', defaultVisible: false },
  { key: 'is_exception', label: 'Exception Flag', defaultVisible: true },
  { key: 'validation_status', label: 'Student Val Status', defaultVisible: true },
  { key: 'validation_done_by', label: 'Validation By', defaultVisible: false },
  { key: 'special_case', label: 'Special Case', defaultVisible: true },
  { key: 'joining_date', label: 'Joining Date', defaultVisible: true },
];

export const DataExplorer: React.FC<DataExplorerProps> = ({ filters, onSelectRecord, onOpenClearModal }) => {
  const [selectedDataset, setSelectedDataset] = useState<'students' | 'challenges' | 'scheduled_vs_conducted' | 'slot_replacement'>('students');
  const [records, setRecords] = useState<any[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [search, setSearch] = useState('');
  const [sortColumn, setSortColumn] = useState('id');
  const [sortDirection, setSortDirection] = useState<'ASC' | 'DESC'>('DESC');
  const [loading, setLoading] = useState(true);

  // Column visibility state for Master Students
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    ALL_30_COLUMNS.forEach((c) => {
      map[c.key] = c.defaultVisible;
    });
    return map;
  });

  const [columnPickerOpen, setColumnPickerOpen] = useState(false);

  useEffect(() => {
    setPage(1);
  }, [filters, search, selectedDataset]);

  useEffect(() => {
    fetchRecords();
  }, [filters, page, pageSize, search, sortColumn, sortDirection, selectedDataset]);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      if (selectedDataset === 'challenges') {
        const res = await api.getChallenges(pageSize, (page - 1) * pageSize, search);
        setRecords(res.rows || []);
        setTotalRecords(res.totalCount || 0);
        setTotalPages(Math.ceil((res.totalCount || 0) / pageSize) || 1);
      } else if (selectedDataset === 'scheduled_vs_conducted') {
        const res = await api.getScheduledVsConducted(pageSize, (page - 1) * pageSize, search);
        setRecords(res.rows || []);
        setTotalRecords(res.totalCount || 0);
        setTotalPages(Math.ceil((res.totalCount || 0) / pageSize) || 1);
      } else if (selectedDataset === 'slot_replacement') {
        const res = await api.getSlotReplacements(pageSize, (page - 1) * pageSize, search);
        setRecords(res.rows || []);
        setTotalRecords(res.totalCount || 0);
        setTotalPages(Math.ceil((res.totalCount || 0) / pageSize) || 1);
      } else {
        const data = await api.getRecords(filters, page, pageSize, search, sortColumn, sortDirection);
        setRecords(data.records || []);
        setTotalRecords(data.pagination.totalRecords || 0);
        setTotalPages(data.pagination.totalPages || 1);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const toggleColumn = (key: string) => {
    setVisibleColumns((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSort = (colKey: string) => {
    if (sortColumn === colKey) {
      setSortDirection(sortDirection === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSortColumn(colKey);
      setSortDirection('ASC');
    }
  };

  const formatCellValue = (key: string, val: any) => {
    if (val === null || val === undefined || val === '') return '—';
    if (['ilt_completion', 'fm_class_completion', 'running_attendance', 'beneficiary_class_attendance'].includes(key)) {
      return `${(Number(val) * 100).toFixed(0)}%`;
    }
    if (key === 'is_exception') {
      return val === 1 ? 'Yes' : 'No';
    }
    if (key === 'special_case') {
      return (String(val).trim() === '1' || val === 1) ? '1' : String(val);
    }
    return String(val);
  };

  const exportCurrentCsv = () => {
    let headers: string[] = [];
    let rows: string[][] = [];

    if (selectedDataset === 'challenges') {
      headers = ['Sl No.', 'RM Name', 'Challenges', 'Impact'];
      rows = records.map((r: any, idx: number) => [
        `"${r.sl_no || idx + 1}"`,
        `"${(r.rm_name || '').replace(/"/g, '""')}"`,
        `"${(r.challenges || '').replace(/"/g, '""')}"`,
        `"${(r.impact || '').replace(/"/g, '""')}"`,
      ]);
    } else {
      const activeCols = ALL_30_COLUMNS.filter((c) => visibleColumns[c.key]);
      headers = activeCols.map((c) => c.label);
      rows = records.map((r: any) =>
        activeCols.map((c) => `"${formatCellValue(c.key, r[c.key])}"`)
      );
    }

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `AE_INSIGHT_${selectedDataset}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const activeCols = ALL_30_COLUMNS.filter((c) => visibleColumns[c.key]);

  return (
    <div className="space-y-4">
      {/* Top Controls */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Dataset Dropdown Selector */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <span className="text-[11px] font-bold text-slate-500 pl-2 uppercase tracking-wide">Dataset:</span>
            <select
              value={selectedDataset}
              onChange={(e) => setSelectedDataset(e.target.value as any)}
              className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-[#008C95]"
            >
              <option value="students">Master Operational Students (30 Cols)</option>
              <option value="challenges">RM Challenges &amp; Impact</option>
              <option value="scheduled_vs_conducted">Scheduled vs Conducted Sessions</option>
              <option value="slot_replacement">Slot Replacement Records</option>
            </select>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={
                selectedDataset === 'challenges'
                  ? 'Search by RM Name, Challenges, Impact...'
                  : 'Search across records...'
              }
              className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs w-56 sm:w-72 focus:outline-hidden focus:ring-1 focus:ring-[#008C95]"
            />
          </div>

          <span className="text-xs text-slate-500 font-medium">
            Showing <strong className="text-slate-900">{records.length}</strong> of{' '}
            <strong className="text-slate-900">{totalRecords.toLocaleString()}</strong> records
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Column Picker Button (Students only) */}
          {selectedDataset === 'students' && (
            <div className="relative">
              <button
                onClick={() => setColumnPickerOpen(!columnPickerOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                <Columns className="w-3.5 h-3.5" />
                <span>Columns ({activeCols.length}/30)</span>
              </button>

              {columnPickerOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-white border border-slate-200 rounded-xl shadow-xl p-3 z-50 max-h-96 overflow-y-auto">
                  <div className="text-xs font-bold text-slate-800 mb-2 pb-1 border-b border-slate-100 flex items-center justify-between">
                    <span>Visible Columns</span>
                    <button
                      onClick={() => {
                        const allVisible: Record<string, boolean> = {};
                        ALL_30_COLUMNS.forEach((c) => (allVisible[c.key] = true));
                        setVisibleColumns(allVisible);
                      }}
                      className="text-[11px] text-[#008C95] hover:underline"
                    >
                      Select All
                    </button>
                  </div>
                  <div className="space-y-1 text-xs">
                    {ALL_30_COLUMNS.map((c) => (
                      <label key={c.key} className="flex items-center gap-2 p-1 hover:bg-slate-50 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!visibleColumns[c.key]}
                          onChange={() => toggleColumn(c.key)}
                          className="rounded text-[#008C95] focus:ring-0"
                        />
                        <span className="text-slate-700 truncate">{c.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Clear All Data Button */}
          {onOpenClearModal && (
            <button
              onClick={onOpenClearModal}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-800 border border-rose-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              title="Clear all portal records from database"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
              <span>Clear Data</span>
            </button>
          )}

          {/* Export CSV Button */}
          <button
            onClick={exportCurrentCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#008C95] hover:bg-[#00747C] text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Dataset Table Render */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          {selectedDataset === 'challenges' ? (
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-100 text-[11px] font-bold text-slate-600 uppercase border-b border-slate-200 select-none">
                <tr>
                  <th className="px-4 py-3 w-16">Sl No.</th>
                  <th className="px-4 py-3 w-56">RM Name</th>
                  <th className="px-4 py-3">Challenges</th>
                  <th className="px-4 py-3">Impact</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading && (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-xs text-slate-400">
                      Loading RM challenges records...
                    </td>
                  </tr>
                )}
                {!loading && records.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-xs text-slate-400">
                      No RM challenges records found.
                    </td>
                  </tr>
                )}
                {!loading &&
                  records.map((r: any, idx) => (
                    <tr key={r.id || idx} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3 font-mono font-medium text-slate-900 whitespace-nowrap">
                        {r.sl_no || (page - 1) * pageSize + idx + 1}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900 whitespace-nowrap">
                        {r.rm_name || '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-800 whitespace-pre-wrap leading-relaxed max-w-xl">
                        {r.challenges || '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-800 whitespace-pre-wrap leading-relaxed max-w-xl">
                        {r.impact || '—'}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left text-xs text-slate-700 whitespace-nowrap">
              <thead className="bg-slate-100 text-[11px] font-bold text-slate-600 uppercase border-b border-slate-200 select-none">
                <tr>
                  <th className="px-3 py-3 w-10 text-center">#</th>
                  <th className="px-3 py-3 w-10 text-center">Inspect</th>
                  {activeCols.map((c) => (
                    <th
                      key={c.key}
                      onClick={() => handleSort(c.key)}
                      className="px-3 py-3 hover:bg-slate-200/60 cursor-pointer transition-colors"
                    >
                      {c.label} {sortColumn === c.key ? (sortDirection === 'ASC' ? '▲' : '▼') : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading && (
                  <tr>
                    <td colSpan={activeCols.length + 2} className="p-8 text-center text-xs text-slate-400">
                      Loading records...
                    </td>
                  </tr>
                )}
                {!loading && records.length === 0 && (
                  <tr>
                    <td colSpan={activeCols.length + 2} className="p-8 text-center text-xs text-slate-400">
                      No data available for the selected filters.
                    </td>
                  </tr>
                )}
                {!loading &&
                  records.map((r: any, idx) => (
                    <tr key={r.id || idx} className="hover:bg-slate-50/80">
                      <td className="px-3 py-2 text-center text-slate-400 font-mono text-[10px]">
                        {(page - 1) * pageSize + idx + 1}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          onClick={() => onSelectRecord(r)}
                          className="p-1 text-[#008C95] hover:bg-[#E6F4F5] rounded transition-colors"
                          title="Inspect full 30-column record"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                      {activeCols.map((c) => {
                        const val = r[c.key];
                        const formatted = formatCellValue(c.key, val);
                        const isStudentCode = c.key === 'student_code';
                        const isDropout = c.key === 'enrollment_status' && val === 'dropped out';
                        return (
                          <td
                            key={c.key}
                            className={`px-3 py-2 ${
                              isStudentCode
                                ? 'font-mono font-bold text-slate-900 cursor-pointer hover:underline'
                                : isDropout
                                ? 'font-semibold text-rose-600'
                                : ''
                            }`}
                            onClick={isStudentCode ? () => onSelectRecord(r) : undefined}
                          >
                            {formatted}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination Bar */}
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span>Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="bg-white border border-slate-300 rounded px-2 py-1 text-xs"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span>
              Page <strong>{page}</strong> of <strong>{totalPages}</strong>
            </span>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1 bg-white border border-slate-200 rounded disabled:opacity-40 hover:bg-slate-100"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1 bg-white border border-slate-200 rounded disabled:opacity-40 hover:bg-slate-100"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
