import React from 'react';
import { FilterParams, FilterOptions } from '../types';
import { X, RotateCcw, Filter, CheckSquare, Square } from 'lucide-react';
import { ProgramMultiSelect } from './ProgramMultiSelect';
import { RmMultiSelect } from './RmMultiSelect';
import { CenterMultiSelect } from './CenterMultiSelect';
import { getScopedFilterOptions } from '../utils/filterHierarchy';

interface GlobalFilterBarProps {
  filters: FilterParams;
  options: FilterOptions;
  onChange: (newFilters: FilterParams) => void;
  onReset: () => void;
  isOpen: boolean;
  onClose: () => void;
}

export const GlobalFilterBar: React.FC<GlobalFilterBarProps> = ({
  filters,
  options,
  onChange,
  onReset,
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const handleSelect = (key: keyof FilterParams, value: string) => {
    onChange({
      ...filters,
      [key]: value === 'ALL' ? undefined : value,
    });
  };

  const handleToggleException = () => {
    onChange({
      ...filters,
      hasException: !filters.hasException,
    });
  };

  const scopedOptions = getScopedFilterOptions(options, filters);
  const activeCount = Object.entries(filters).filter(([k, v]) => v !== undefined && v !== '' && v !== 'ALL' && v !== false && (!Array.isArray(v) || v.length > 0)).length;

  return (
    <div className="bg-white border-b border-slate-200 shadow-md px-4 sm:px-6 lg:px-8 py-4 transition-all duration-200">
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-[#008C95]" />
          <h3 className="text-sm font-bold text-slate-900">Executive Global Filters</h3>
          <span className="text-xs text-slate-500">
            (Applies across all analytical dashboards and reports)
          </span>
          {activeCount > 0 && (
            <span className="ml-2 text-xs font-semibold px-2 py-0.5 bg-[#E6F4F5] text-[#005F66] rounded-full border border-[#CCECF0]">
              {activeCount} Active Filter{activeCount > 1 ? 's' : ''}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {activeCount > 0 && (
            <button
              onClick={onReset}
              className="flex items-center gap-1 px-2.5 py-1 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset All</span>
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 rounded-md transition-colors cursor-pointer"
            title="Close filter panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Grid of filters */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 text-xs">
        {/* Center Code Multi-Select */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Center</label>
          <CenterMultiSelect
            options={scopedOptions.centerOptions}
            selectedCenters={filters.centerCodes}
            selectedCenter={filters.centerCode}
            onChange={(selected) => {
              onChange({
                ...filters,
                centerCodes: selected.length > 0 ? selected : undefined,
                centerCode: selected.length === 1 ? selected[0] : (selected.length > 1 ? selected.join(',') : undefined),
              });
            }}
            programOptions={scopedOptions.programOptions}
            selectedPrograms={filters.programNames}
            selectedProgram={filters.programName}
            onProgramsChange={(selected) => {
              onChange({
                ...filters,
                programNames: selected.length > 0 ? selected : undefined,
                programName: selected.length === 1 ? selected[0] : (selected.length > 1 ? selected.join(',') : undefined),
              });
            }}
            className="w-full"
          />
        </div>

        {/* Funder Name */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Funder</label>
          <select
            value={filters.funderName || 'ALL'}
            onChange={(e) => handleSelect('funderName', e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-md px-2 py-1.5 text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-[#008C95]"
          >
            <option value="ALL">All Funders ({options.funders.length})</option>
            {options.funders.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>

        {/* Program Multi-Select */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Program</label>
          <ProgramMultiSelect
            options={scopedOptions.programOptions}
            selectedPrograms={filters.programNames}
            selectedProgram={filters.programName}
            onChange={(selected) => {
              onChange({
                ...filters,
                programNames: selected.length > 0 ? selected : undefined,
                programName: selected.length === 1 ? selected[0] : (selected.length > 1 ? selected.join(',') : undefined),
              });
            }}
            className="w-full"
          />
        </div>

        {/* Program Type (Diya / Deeptech filter) */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Program Type</label>
          <select
            value={filters.programType || 'ALL'}
            onChange={(e) => handleSelect('programType', e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-md px-2 py-1.5 text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-[#008C95]"
          >
            <option value="ALL">All Program Types</option>
            <option value="Diya and Deeptech">Diya and Deeptech</option>
            <option value="Diya Only">Diya Only</option>
            <option value="Deeptech Only">Deeptech Only</option>
          </select>
        </div>

        {/* Batch Code */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Batch Code</label>
          <select
            value={filters.batchCode || 'ALL'}
            onChange={(e) => handleSelect('batchCode', e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-md px-2 py-1.5 text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-[#008C95]"
          >
            <option value="ALL">All Batches ({options.batches.length})</option>
            {options.batches.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>

        {/* Assigned Trainer */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Assigned Trainer</label>
          <select
            value={filters.assignedTrainer || 'ALL'}
            onChange={(e) => handleSelect('assignedTrainer', e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-md px-2 py-1.5 text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-[#008C95]"
          >
            <option value="ALL">All Trainers ({options.trainers.length})</option>
            {options.trainers.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {/* RM / SH / ZH Multi-Select */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-600 mb-1">RM / SH / ZH</label>
          <RmMultiSelect
            options={scopedOptions.rmOptions}
            selectedRms={filters.rmShZhs}
            selectedRm={filters.rmShZh}
            onChange={(selected) => {
              onChange({
                ...filters,
                rmShZhs: selected.length > 0 ? selected : undefined,
                rmShZh: selected.length === 1 ? selected[0] : (selected.length > 1 ? selected.join(',') : undefined),
              });
            }}
            programOptions={scopedOptions.programOptions}
            selectedPrograms={filters.programNames}
            selectedProgram={filters.programName}
            onProgramsChange={(selected) => {
              onChange({
                ...filters,
                programNames: selected.length > 0 ? selected : undefined,
                programName: selected.length === 1 ? selected[0] : (selected.length > 1 ? selected.join(',') : undefined),
              });
            }}
            className="w-full"
          />
        </div>

        {/* Batch Status */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Batch Status</label>
          <select
            value={filters.batchStatus || 'ALL'}
            onChange={(e) => handleSelect('batchStatus', e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-md px-2 py-1.5 text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-[#008C95]"
          >
            <option value="ALL">All Batch Statuses</option>
            {options.batchStatuses.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Enrollment Status */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Enrollment Status</label>
          <select
            value={filters.enrollmentStatus || 'ALL'}
            onChange={(e) => handleSelect('enrollmentStatus', e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-md px-2 py-1.5 text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-[#008C95]"
          >
            <option value="ALL">All Enrollment Statuses</option>
            {options.enrollmentStatuses.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Student Status */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Student Status</label>
          <select
            value={filters.studentStatus || 'ALL'}
            onChange={(e) => handleSelect('studentStatus', e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-md px-2 py-1.5 text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-[#008C95]"
            title='Formula: Enrollment Status = "enrolled" && Placement Type <> " " -> "Enrolled", Enrollment Status = "dropped out" -> "dropped out", otherwise Placement Type'
          >
            <option value="ALL">All Student Statuses</option>
            {(options.studentStatuses || ['Enrolled', 'dropped out', 'Placed By Anudip CRD', 'Self Placed', 'Placed By Anudip Center/Local', 'Placed By College/Campus']).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Dropout Type */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Dropout Type</label>
          <select
            value={filters.dropoutType || 'ALL'}
            onChange={(e) => handleSelect('dropoutType', e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-md px-2 py-1.5 text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-[#008C95]"
          >
            <option value="ALL">All Dropout Types</option>
            {options.dropoutTypes.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        {/* Student Validation Status */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Student Validation</label>
          <select
            value={filters.studentValidationStatus || 'ALL'}
            onChange={(e) => handleSelect('studentValidationStatus', e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-md px-2 py-1.5 text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-[#008C95]"
          >
            <option value="ALL">All Student Validations</option>
            {options.studentValidationStatuses.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </div>

        {/* Batch Validation Status */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Batch Validation</label>
          <select
            value={filters.batchValidationStatus || 'ALL'}
            onChange={(e) => handleSelect('batchValidationStatus', e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-md px-2 py-1.5 text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-[#008C95]"
          >
            <option value="ALL">All Batch Validations</option>
            {options.batchValidationStatuses.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </div>

        {/* Date Range: Start Date */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Start Date (From)</label>
          <input
            type="date"
            value={filters.startDate || ''}
            onChange={(e) => handleSelect('startDate', e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-md px-2 py-1.5 text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-[#008C95]"
          />
        </div>

        {/* Date Range: End Date */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Start Date (To)</label>
          <input
            type="date"
            value={filters.endDate || ''}
            onChange={(e) => handleSelect('endDate', e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-md px-2 py-1.5 text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-[#008C95]"
          />
        </div>

        {/* Special Case Filter */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Special Case</label>
          <select
            value={filters.specialCase || 'ALL'}
            onChange={(e) => handleSelect('specialCase', e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-md px-2 py-1.5 text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-[#008C95]"
          >
            <option value="ALL">All Special Cases</option>
            <option value="1">Special Case (1)</option>
            <option value="0">Standard / Blank (0)</option>
          </select>
        </div>

        {/* Exception Only Toggle */}
        <div className="flex items-end">
          <button
            type="button"
            onClick={handleToggleException}
            className={`w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-semibold cursor-pointer transition-colors ${
              filters.hasException
                ? 'bg-amber-50 text-amber-900 border-amber-300'
                : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
            }`}
          >
            {filters.hasException ? (
              <CheckSquare className="w-4 h-4 text-amber-600" />
            ) : (
              <Square className="w-4 h-4 text-slate-400" />
            )}
            <span>Exceptions Only</span>
          </button>
        </div>
      </div>
    </div>
  );
};
