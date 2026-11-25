import React, { useState, useRef, useEffect, useMemo } from 'react';
import { BookOpen, Check, ChevronDown, Search, X, CheckSquare, Square, RotateCcw } from 'lucide-react';

export interface ProgramMultiSelectProps {
  options: string[];
  selectedPrograms?: string[];
  selectedProgram?: string; // backwards compatibility fallback
  onChange: (selected: string[]) => void;
  placeholder?: string;
  className?: string;
  compact?: boolean;
}

export const ProgramMultiSelect: React.FC<ProgramMultiSelectProps> = ({
  options = [],
  selectedPrograms,
  selectedProgram,
  onChange,
  placeholder = 'All Programs',
  className = '',
  compact = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Normalize current selected programs list from props
  const currentSelection = useMemo<string[]>(() => {
    if (selectedPrograms && Array.isArray(selectedPrograms)) {
      return selectedPrograms.filter(p => p && p !== 'ALL');
    }
    if (selectedProgram && selectedProgram !== 'ALL') {
      return selectedProgram
        .split(',')
        .map(p => p.trim())
        .filter(p => p && p !== 'ALL');
    }
    return [];
  }, [selectedPrograms, selectedProgram]);

  // Local pending selection state while dropdown is open
  // This allows selecting/deselecting multiple programs without premature server reloads on every click!
  const [pendingSelection, setPendingSelection] = useState<string[]>(currentSelection);

  // Sync pendingSelection whenever dropdown opens or when currentSelection changes while closed
  useEffect(() => {
    if (!isOpen) {
      setPendingSelection(currentSelection);
    }
  }, [currentSelection, isOpen]);

  // Clean and unique options, always including any selected programs
  const cleanOptions = useMemo(() => {
    const set = new Set<string>();
    (options || []).forEach(opt => {
      if (opt && typeof opt === 'string' && opt.trim() !== '' && opt !== 'ALL' && opt !== 'N/A') {
        set.add(opt.trim());
      }
    });
    // Ensure selected programs always appear in the list so they can be viewed and deselected
    currentSelection.forEach(p => {
      if (p && typeof p === 'string' && p.trim() !== '' && p !== 'ALL') {
        set.add(p.trim());
      }
    });
    pendingSelection.forEach(p => {
      if (p && typeof p === 'string' && p.trim() !== '' && p !== 'ALL') {
        set.add(p.trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [options, currentSelection, pendingSelection]);

  // Filtered options by search term
  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return cleanOptions;
    const term = searchTerm.toLowerCase().trim();
    return cleanOptions.filter(opt => opt.toLowerCase().includes(term));
  }, [cleanOptions, searchTerm]);

  // Check if pendingSelection differs from currentSelection
  const isSelectionChanged = useMemo(() => {
    if (pendingSelection.length !== currentSelection.length) return true;
    const setA = new Set(pendingSelection);
    return currentSelection.some(p => !setA.has(p));
  }, [pendingSelection, currentSelection]);

  // Commit and close
  const commitSelection = (newSelection: string[]) => {
    setIsOpen(false);
    setSearchTerm('');
    onChange(newSelection);
  };

  // Close on outside click and commit changes if any were made
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        if (isSelectionChanged) {
          onChange(pendingSelection);
        }
        setIsOpen(false);
        setSearchTerm('');
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
  }, [isOpen, pendingSelection, isSelectionChanged, onChange]);

  // Toggle single item in multi-select mode inside local pending state
  const handleToggleOption = (option: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setPendingSelection(prev => {
      if (prev.includes(option)) {
        return prev.filter(p => p !== option);
      } else {
        return [...prev, option];
      }
    });
  };

  // Select ONLY this individual program with one click and apply immediately
  const handleSelectOnly = (option: string, e: React.MouseEvent) => {
    e.stopPropagation();
    commitSelection([option]);
  };

  // Select All programs
  const handleSelectAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (searchTerm.trim() && filteredOptions.length > 0) {
      const merged = Array.from(new Set([...pendingSelection, ...filteredOptions]));
      setPendingSelection(merged);
    } else {
      setPendingSelection([...cleanOptions]);
    }
  };

  // Reset to All Programs (clears filter)
  const handleClearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPendingSelection([]);
  };

  // Clear directly from trigger button
  const handleDirectReset = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPendingSelection([]);
    commitSelection([]);
  };

  const isAllSelected = cleanOptions.length > 0 && currentSelection.length === cleanOptions.length;
  const isFiltered = currentSelection.length > 0 && !isAllSelected;

  // Determine button trigger label
  const triggerLabel = useMemo(() => {
    if (currentSelection.length === 0 || isAllSelected) {
      return `All Programs (${cleanOptions.length})`;
    }
    if (currentSelection.length === 1) {
      return currentSelection[0];
    }
    return `${currentSelection.length} Programs Selected`;
  }, [currentSelection, isAllSelected, cleanOptions.length]);

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      {/* Trigger Button */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => {
          if (!isOpen) {
            setPendingSelection(currentSelection);
            setSearchTerm('');
          }
          setIsOpen(!isOpen);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (!isOpen) {
              setPendingSelection(currentSelection);
              setSearchTerm('');
            }
            setIsOpen(!isOpen);
          }
        }}
        className={`flex items-center gap-1.5 bg-white border rounded-lg px-2.5 py-1 text-xs font-semibold cursor-pointer transition-all select-none shadow-2xs hover:border-[#008C95] ${
          isFiltered
            ? 'border-emerald-400 bg-emerald-50/40 text-emerald-900 ring-1 ring-emerald-300'
            : 'border-slate-300 text-slate-800 hover:bg-slate-50'
        } ${compact ? 'py-1 text-xs' : 'py-1.5'}`}
      >
        <BookOpen className={`w-3.5 h-3.5 shrink-0 ${isFiltered ? 'text-emerald-700' : 'text-slate-500'}`} />
        <span className="text-[11px] font-bold text-slate-500 uppercase whitespace-nowrap">Program:</span>
        <span
          className="truncate max-w-[150px] sm:max-w-[210px] font-medium text-slate-800"
          title={currentSelection.length > 0 ? currentSelection.join(', ') : 'All Programs'}
        >
          {triggerLabel}
        </span>

        {isFiltered && (
          <span className="bg-emerald-600 text-white text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full shrink-0">
            {currentSelection.length}
          </span>
        )}

        {isFiltered && (
          <button
            type="button"
            onClick={handleDirectReset}
            title="Reset to All Programs"
            className="p-0.5 hover:bg-emerald-200/60 rounded text-emerald-800 transition-colors ml-0.5"
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
        <div className="absolute left-0 mt-1.5 w-76 sm:w-88 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          {/* Header */}
          <div className="p-2.5 bg-slate-50 border-b border-slate-200/80">
            <div className="flex items-center justify-between gap-1 mb-2">
              <div className="flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-[#008C95]" />
                <span className="text-xs font-bold text-slate-900">Program Filter (Multi-Select)</span>
              </div>
              <span className="text-[10px] text-slate-500 font-semibold px-2 py-0.5 rounded-full bg-slate-200/70">
                {pendingSelection.length === 0
                  ? 'All Programs'
                  : `${pendingSelection.length} of ${cleanOptions.length} selected`}
              </span>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search programs..."
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
                    pendingSelection.length === 0
                      ? 'bg-slate-200 text-slate-800 font-bold'
                      : 'text-slate-600 hover:bg-slate-200/70'
                  }`}
                >
                  All Programs
                </button>
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="px-2 py-0.5 rounded text-[#008C95] hover:bg-teal-50 font-medium transition-colors cursor-pointer"
                >
                  Select All
                </button>
              </div>

              {pendingSelection.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="px-2 py-0.5 rounded text-rose-600 hover:bg-rose-50 font-medium transition-colors cursor-pointer flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Clear ({pendingSelection.length})</span>
                </button>
              )}
            </div>
          </div>

          {/* Scrollable Programs List */}
          <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 p-1">
            {filteredOptions.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400">
                No programs matching &quot;{searchTerm}&quot;
              </div>
            ) : (
              filteredOptions.map((program) => {
                const isSelected = pendingSelection.includes(program);
                return (
                  <div
                    key={program}
                    onClick={(e) => handleToggleOption(program, e)}
                    className={`group flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-emerald-50/90 text-emerald-950 font-medium'
                        : 'text-slate-700 hover:bg-slate-100/80'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <div className="shrink-0 text-slate-400 group-hover:text-slate-600">
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-300" />
                        )}
                      </div>
                      <span className="truncate" title={program}>
                        {program}
                      </span>
                    </div>

                    {/* Quick "Only" action to pick just this single program and apply */}
                    <button
                      type="button"
                      onClick={(e) => handleSelectOnly(program, e)}
                      title={`Select ONLY "${program}"`}
                      className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-[10px] font-bold px-1.5 py-0.5 rounded bg-white hover:bg-teal-600 hover:text-white text-[#008C95] border border-teal-200 transition-all shrink-0 cursor-pointer shadow-2xs"
                    >
                      Only
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer with Apply and Cancel buttons */}
          <div className="p-2.5 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between gap-2 text-xs">
            <button
              type="button"
              onClick={() => {
                setPendingSelection(currentSelection);
                setIsOpen(false);
                setSearchTerm('');
              }}
              className="px-2.5 py-1 text-slate-600 hover:bg-slate-200/80 font-medium rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => commitSelection(pendingSelection)}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg shadow-2xs transition-all cursor-pointer ${
                  isSelectionChanged
                    ? 'bg-[#008C95] hover:bg-[#00747C] text-white ring-2 ring-[#008C95]/30'
                    : 'bg-[#008C95] hover:bg-[#00747C] text-white'
                }`}
              >
                <Check className="w-3.5 h-3.5" />
                <span>
                  {pendingSelection.length === 0
                    ? 'Apply (All Programs)'
                    : pendingSelection.length === 1
                    ? `Apply (1 Program)`
                    : `Apply (${pendingSelection.length} Programs)`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
