import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Building2, ChevronDown, Search, X, CheckSquare, Square } from 'lucide-react';

export interface CenterMultiSelectProps {
  options: string[];
  selectedCenters?: string[];
  selectedCenter?: string;
  onChange: (selected: string[]) => void;
  programOptions?: string[];
  selectedPrograms?: string[];
  selectedProgram?: string;
  onProgramsChange?: (selectedPrograms: string[]) => void;
  placeholder?: string;
  className?: string;
  compact?: boolean;
}

export const CenterMultiSelect: React.FC<CenterMultiSelectProps> = ({
  options = [],
  selectedCenters,
  selectedCenter,
  onChange,
  placeholder = 'All Centers',
  className = '',
  compact = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const currentSelection = useMemo<string[]>(() => {
    if (selectedCenters && Array.isArray(selectedCenters) && selectedCenters.length > 0) {
      return selectedCenters.filter(c => c && c !== 'ALL');
    }
    if (selectedCenter && selectedCenter !== 'ALL') {
      return selectedCenter
        .split(',')
        .map(c => c.trim())
        .filter(c => c && c !== 'ALL');
    }
    return [];
  }, [selectedCenters, selectedCenter]);

  const cleanOptions = useMemo(() => {
    const set = new Set<string>();
    options.forEach(opt => {
      if (opt && typeof opt === 'string' && opt.trim() !== '' && opt !== 'ALL' && opt !== 'N/A') {
        set.add(opt.trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [options]);

  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return cleanOptions;
    const term = searchTerm.toLowerCase().trim();
    return cleanOptions.filter(opt => opt.toLowerCase().includes(term));
  }, [cleanOptions, searchTerm]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  const handleToggleOption = (option: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const isSelected = currentSelection.includes(option);
    const updated = isSelected
      ? currentSelection.filter(c => c !== option)
      : [...currentSelection, option];
    onChange(updated);
  };

  const handleSelectOnly = (option: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([option]);
  };

  const handleSelectAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (searchTerm.trim() && filteredOptions.length > 0) {
      const merged = Array.from(new Set([...currentSelection, ...filteredOptions]));
      onChange(merged);
    } else {
      onChange([...cleanOptions]);
    }
  };

  const handleClearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  const isAllSelected = cleanOptions.length > 0 && currentSelection.length === cleanOptions.length;
  const isFiltered = currentSelection.length > 0 && !isAllSelected;

  const triggerLabel = useMemo(() => {
    if (currentSelection.length === 0 || isAllSelected) {
      return `${placeholder} (${cleanOptions.length})`;
    }
    if (currentSelection.length === 1) {
      return currentSelection[0];
    }
    return `${currentSelection.length} Centers Selected`;
  }, [currentSelection, isAllSelected, cleanOptions.length, placeholder]);

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsOpen(!isOpen);
          }
        }}
        className={`flex items-center gap-1.5 bg-white border rounded-lg px-2.5 py-1 text-xs font-semibold cursor-pointer transition-all select-none shadow-2xs hover:border-[#008C95] ${
          isFiltered
            ? 'border-cyan-400 bg-cyan-50/30 text-cyan-900 ring-1 ring-cyan-300'
            : 'border-slate-300 text-slate-800 hover:bg-slate-50'
        } ${compact ? 'py-1 text-xs' : 'py-1.5'}`}
      >
        <Building2 className={`w-3.5 h-3.5 shrink-0 ${isFiltered ? 'text-cyan-700' : 'text-cyan-600'}`} />
        <span className="text-[11px] font-bold text-slate-500 uppercase whitespace-nowrap">Center:</span>
        <span
          className="truncate max-w-[140px] sm:max-w-[180px] font-medium text-slate-800"
          title={currentSelection.length > 0 ? currentSelection.join(', ') : 'All Centers'}
        >
          {triggerLabel}
        </span>

        {isFiltered && (
          <span className="bg-cyan-600 text-white text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full shrink-0">
            {currentSelection.length}
          </span>
        )}

        {isFiltered && (
          <button
            type="button"
            onClick={handleClearAll}
            title="Reset to All Centers"
            className="p-0.5 hover:bg-cyan-200/60 rounded text-cyan-800 transition-colors ml-0.5"
          >
            <X className="w-3 h-3" />
          </button>
        )}

        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-150 ${
            isOpen ? 'rotate-180 text-[#008C95]' : ''
          }`}
        />
      </div>

      {isOpen && (
        <div className="absolute left-0 mt-1.5 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          {/* Header */}
          <div className="p-2.5 bg-slate-50 border-b border-slate-200/80">
            <div className="flex items-center justify-between gap-1 mb-2">
              <div className="flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-cyan-600" />
                <span className="text-xs font-bold text-slate-900">Center Filter (Individual / Multiple)</span>
              </div>
              <span className="text-[10px] text-slate-500 font-medium">
                {currentSelection.length === 0
                  ? 'Showing All'
                  : `${currentSelection.length} of ${cleanOptions.length} selected`}
              </span>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search centers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-7 py-1 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:border-[#008C95] focus:ring-1 focus:ring-[#008C95]"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Quick Actions Bar */}
            <div className="flex items-center justify-between gap-1 mt-2 pt-1.5 border-t border-slate-200/60 text-[11px]">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleClearAll}
                  className={`px-2 py-0.5 rounded font-medium transition-colors cursor-pointer ${
                    currentSelection.length === 0
                      ? 'bg-slate-200 text-slate-800 font-bold'
                      : 'text-slate-600 hover:bg-slate-200/70'
                  }`}
                >
                  All Centers
                </button>
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="px-2 py-0.5 rounded text-[#008C95] hover:bg-teal-50 font-medium transition-colors cursor-pointer"
                >
                  Select All
                </button>
              </div>

              {currentSelection.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="px-2 py-0.5 rounded text-rose-600 hover:bg-rose-50 font-medium transition-colors cursor-pointer"
                >
                  Clear Selection
                </button>
              )}
            </div>
          </div>

          {/* Scrollable Centers List */}
          <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 p-1">
            {filteredOptions.length === 0 ? (
              <div className="p-3 text-center text-xs text-slate-400">
                No centers matching &quot;{searchTerm}&quot;
              </div>
            ) : (
              filteredOptions.map((center) => {
                const isSelected = currentSelection.includes(center);
                return (
                  <div
                    key={center}
                    onClick={(e) => handleToggleOption(center, e)}
                    className={`group flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-cyan-50/80 text-cyan-950 font-medium'
                        : 'text-slate-700 hover:bg-slate-100/80'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <div className="shrink-0 text-slate-400 group-hover:text-slate-600">
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-cyan-600" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-300" />
                        )}
                      </div>
                      <span className="truncate" title={center}>
                        {center}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handleSelectOnly(center, e)}
                      title={`Select ONLY "${center}"`}
                      className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-[10px] font-bold px-1.5 py-0.5 rounded bg-white hover:bg-cyan-600 hover:text-white text-cyan-700 border border-cyan-200 transition-all shrink-0 cursor-pointer shadow-2xs"
                    >
                      Only
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="p-2 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between text-xs">
            <span className="text-[11px] text-slate-500 font-medium">
              Select individual (&quot;Only&quot;) or multiple Centers
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-3 py-1 bg-[#008C95] hover:bg-[#00737a] text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
