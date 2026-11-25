import React, { useState, useRef, useEffect, useMemo } from 'react';
import { UserCheck, ChevronDown, Search, X, CheckSquare, Square } from 'lucide-react';

export interface AeMultiSelectProps {
  options: string[];
  selectedAes?: string[];
  selectedAe?: string; // backwards compatibility fallback
  onChange: (selected: string[]) => void;
  placeholder?: string;
  className?: string;
  compact?: boolean;
}

export const AeMultiSelect: React.FC<AeMultiSelectProps> = ({
  options = [],
  selectedAes,
  selectedAe,
  onChange,
  placeholder = 'All AE Members',
  className = '',
  compact = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Normalize current selected AE list
  const currentSelection = useMemo<string[]>(() => {
    if (selectedAes && Array.isArray(selectedAes)) {
      return selectedAes.filter(a => a && a !== 'ALL');
    }
    if (selectedAe && selectedAe !== 'ALL') {
      return selectedAe
        .split(',')
        .map(a => a.trim())
        .filter(a => a && a !== 'ALL');
    }
    return [];
  }, [selectedAes, selectedAe]);

  // Clean and unique options
  const cleanOptions = useMemo(() => {
    const set = new Set<string>();
    options.forEach(opt => {
      if (opt && typeof opt === 'string' && opt.trim() !== '' && opt !== 'ALL' && opt !== 'N/A') {
        set.add(opt.trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [options]);

  // Filtered options by search term
  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return cleanOptions;
    const term = searchTerm.toLowerCase().trim();
    return cleanOptions.filter(opt => opt.toLowerCase().includes(term));
  }, [cleanOptions, searchTerm]);

  // Close on outside click
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

  // Toggle single item in multi-select mode
  const handleToggleOption = (option: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const isSelected = currentSelection.includes(option);
    let updated: string[];
    if (isSelected) {
      updated = currentSelection.filter(a => a !== option);
    } else {
      updated = [...currentSelection, option];
    }
    onChange(updated);
  };

  // Select ONLY this individual AE with one click
  const handleSelectOnly = (option: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([option]);
  };

  // Select All AEs
  const handleSelectAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (searchTerm.trim() && filteredOptions.length > 0) {
      const merged = Array.from(new Set([...currentSelection, ...filteredOptions]));
      onChange(merged);
    } else {
      onChange([...cleanOptions]);
    }
  };

  // Reset to All AEs (clears filter)
  const handleClearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  const isAllSelected = cleanOptions.length > 0 && currentSelection.length === cleanOptions.length;
  const isFiltered = currentSelection.length > 0 && !isAllSelected;

  // Determine button trigger label
  const triggerLabel = useMemo(() => {
    if (currentSelection.length === 0 || isAllSelected) {
      return `All AE Members (${cleanOptions.length})`;
    }
    if (currentSelection.length === 1) {
      return currentSelection[0];
    }
    return `${currentSelection.length} AEs Selected`;
  }, [currentSelection, isAllSelected, cleanOptions.length]);

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      {/* Trigger Button */}
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
            ? 'border-indigo-400 bg-indigo-50/30 text-indigo-900 ring-1 ring-indigo-300'
            : 'border-slate-300 text-slate-800 hover:bg-slate-50'
        } ${compact ? 'py-1 text-xs' : 'py-1.5'}`}
      >
        <UserCheck className={`w-3.5 h-3.5 shrink-0 ${isFiltered ? 'text-indigo-700' : 'text-slate-500'}`} />
        <span className="text-[11px] font-bold text-slate-500 uppercase whitespace-nowrap">AE wise:</span>
        <span
          className="truncate max-w-[140px] sm:max-w-[200px] font-medium text-slate-800"
          title={currentSelection.length > 0 ? currentSelection.join(', ') : 'All AE Members'}
        >
          {triggerLabel}
        </span>

        {isFiltered && (
          <span className="bg-indigo-600 text-white text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full shrink-0">
            {currentSelection.length}
          </span>
        )}

        {isFiltered && (
          <button
            type="button"
            onClick={handleClearAll}
            title="Reset to All AEs"
            className="p-0.5 hover:bg-indigo-200/60 rounded text-indigo-800 transition-colors ml-0.5"
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

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute left-0 mt-1.5 w-72 sm:w-80 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          {/* Header */}
          <div className="p-2.5 bg-slate-50 border-b border-slate-200/80">
            <div className="flex items-center justify-between gap-1 mb-2">
              <div className="flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-[#008C95]" />
                <span className="text-xs font-bold text-slate-900">Academic Excellence (AE) Filter</span>
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
                placeholder="Search AE members..."
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
                  All AEs
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

          {/* Scrollable List */}
          <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 p-1">
            {filteredOptions.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400">
                No AE member matching &quot;{searchTerm}&quot;
              </div>
            ) : (
              filteredOptions.map((ae) => {
                const isSelected = currentSelection.includes(ae);
                return (
                  <div
                    key={ae}
                    onClick={(e) => handleToggleOption(ae, e)}
                    className={`group flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-indigo-50/80 text-indigo-950 font-medium'
                        : 'text-slate-700 hover:bg-slate-100/80'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <div className="shrink-0 text-slate-400 group-hover:text-slate-600">
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-indigo-600" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-300" />
                        )}
                      </div>
                      <span className="truncate" title={ae}>
                        {ae}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handleSelectOnly(ae, e)}
                      title={`Select ONLY "${ae}"`}
                      className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-[10px] font-bold px-1.5 py-0.5 rounded bg-white hover:bg-indigo-600 hover:text-white text-indigo-600 border border-indigo-200 transition-all shrink-0 cursor-pointer shadow-2xs"
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
              Tip: Click &quot;Only&quot; to isolate single AE
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
