import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  BookOpen,
  GraduationCap,
  Check,
  ChevronDown,
  Search,
  X,
  CheckSquare,
  Square,
  RotateCcw,
} from 'lucide-react';
import { isCollegeModelProgram } from '../utils/filterHierarchy';

export interface ProgramMultiSelectProps {
  options: string[];
  selectedPrograms?: string[];
  selectedProgram?: string; // backwards compatibility fallback
  onChange: (selected: string[]) => void;
  placeholder?: string;
  className?: string;
  compact?: boolean;
  /**
   * 'both' (default): renders Program (Own) and Program (College Model Only) side-by-side.
   * 'own': renders only Program (Own).
   * 'college': renders only Program (College Model Only).
   */
  mode?: 'both' | 'own' | 'college';
}

interface SingleProgramDropdownProps {
  variant: 'own' | 'college';
  options: string[];
  selectedItems: string[];
  onCommit: (nextItems: string[]) => void;
  className?: string;
  compact?: boolean;
}

const SingleProgramDropdown: React.FC<SingleProgramDropdownProps> = ({
  variant,
  options,
  selectedItems,
  onCommit,
  className = '',
  compact = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [pendingSelection, setPendingSelection] = useState<string[]>(selectedItems);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const isCollege = variant === 'college';
  const labelText = isCollege ? 'Program (College Model Only)' : 'Program (Own)';
  const IconComp = isCollege ? GraduationCap : BookOpen;

  useEffect(() => {
    if (!isOpen) {
      setPendingSelection(selectedItems);
    }
  }, [selectedItems, isOpen]);

  const cleanOptions = useMemo(() => {
    const set = new Set<string>();
    (options || []).forEach((opt) => {
      if (opt && typeof opt === 'string' && opt.trim() !== '' && opt !== 'ALL' && opt !== 'N/A') {
        set.add(opt.trim());
      }
    });
    selectedItems.forEach((p) => {
      if (p && typeof p === 'string' && p.trim() !== '' && p !== 'ALL') {
        set.add(p.trim());
      }
    });
    pendingSelection.forEach((p) => {
      if (p && typeof p === 'string' && p.trim() !== '' && p !== 'ALL') {
        set.add(p.trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [options, selectedItems, pendingSelection]);

  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return cleanOptions;
    const term = searchTerm.toLowerCase().trim();
    return cleanOptions.filter((opt) => opt.toLowerCase().includes(term));
  }, [cleanOptions, searchTerm]);

  const isSelectionChanged = useMemo(() => {
    if (pendingSelection.length !== selectedItems.length) return true;
    const setA = new Set(pendingSelection);
    return selectedItems.some((p) => !setA.has(p));
  }, [pendingSelection, selectedItems]);

  const commitSelection = (newSelection: string[]) => {
    setIsOpen(false);
    setSearchTerm('');
    onCommit(newSelection);
  };

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        if (isSelectionChanged) {
          onCommit(pendingSelection);
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
  }, [isOpen, pendingSelection, isSelectionChanged, onCommit]);

  const handleToggleOption = (option: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setPendingSelection((prev) =>
      prev.includes(option) ? prev.filter((p) => p !== option) : [...prev, option]
    );
  };

  const handleSelectOnly = (option: string, e: React.MouseEvent) => {
    e.stopPropagation();
    commitSelection([option]);
  };

  const handleSelectAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (searchTerm.trim() && filteredOptions.length > 0) {
      const merged = Array.from(new Set([...pendingSelection, ...filteredOptions]));
      setPendingSelection(merged);
    } else {
      setPendingSelection([...cleanOptions]);
    }
  };

  const handleClearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPendingSelection([]);
  };

  const handleDirectReset = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPendingSelection([]);
    commitSelection([]);
  };

  // In split Own / College Model Only filters, ANY selection (including selecting all items in this bucket)
  // actively filters the dataset to this bucket's programs.
  const isFiltered = selectedItems.length > 0;

  const triggerLabel = useMemo(() => {
    if (selectedItems.length === 0) {
      return `All (${cleanOptions.length})`;
    }
    if (selectedItems.length === 1) {
      return selectedItems[0];
    }
    if (cleanOptions.length > 0 && selectedItems.length === cleanOptions.length) {
      return `All ${selectedItems.length} Selected`;
    }
    return `${selectedItems.length} Selected`;
  }, [selectedItems, cleanOptions.length]);

  const activeStyles = isCollege
    ? 'border-indigo-400 bg-indigo-50/50 text-indigo-900 ring-1 ring-indigo-300'
    : 'border-emerald-400 bg-emerald-50/40 text-emerald-900 ring-1 ring-emerald-300';

  const iconColor = isFiltered
    ? isCollege
      ? 'text-indigo-700'
      : 'text-emerald-700'
    : isCollege
    ? 'text-indigo-500'
    : 'text-slate-500';

  const badgeBg = isCollege ? 'bg-indigo-600' : 'bg-emerald-600';
  const resetHover = isCollege
    ? 'hover:bg-indigo-200/60 text-indigo-800'
    : 'hover:bg-emerald-200/60 text-emerald-800';
  const selectedRowBg = isCollege
    ? 'bg-indigo-50/90 text-indigo-950 font-medium'
    : 'bg-emerald-50/90 text-emerald-950 font-medium';
  const checkIconColor = isCollege ? 'text-indigo-600' : 'text-emerald-600';

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      {/* Trigger Button */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => {
          if (!isOpen) {
            setPendingSelection(selectedItems);
            setSearchTerm('');
          }
          setIsOpen(!isOpen);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (!isOpen) {
              setPendingSelection(selectedItems);
              setSearchTerm('');
            }
            setIsOpen(!isOpen);
          }
        }}
        className={`flex items-center gap-1.5 bg-white border rounded-lg px-2.5 py-1 text-xs font-semibold cursor-pointer transition-all select-none shadow-2xs hover:border-[#008C95] ${
          isFiltered ? activeStyles : 'border-slate-300 text-slate-800 hover:bg-slate-50'
        } ${compact ? 'py-1 text-xs' : 'py-1.5'} ${className.includes('w-full') ? 'w-full justify-between' : ''}`}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <IconComp className={`w-3.5 h-3.5 shrink-0 ${iconColor}`} />
          <span className="text-[11px] font-bold text-slate-500 uppercase whitespace-nowrap">
            {labelText}:
          </span>
          <span
            className="truncate max-w-[140px] sm:max-w-[190px] font-medium text-slate-800"
            title={selectedItems.length > 0 ? selectedItems.join(', ') : `All ${labelText}`}
          >
            {triggerLabel}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {isFiltered && (
            <span className={`${badgeBg} text-white text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full shrink-0`}>
              {selectedItems.length}
            </span>
          )}

          {isFiltered && (
            <button
              type="button"
              onClick={handleDirectReset}
              title={`Reset ${labelText}`}
              className={`p-0.5 rounded transition-colors ml-0.5 ${resetHover}`}
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
      </div>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute left-0 mt-1.5 w-76 sm:w-88 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          {/* Header */}
          <div className="p-2.5 bg-slate-50 border-b border-slate-200/80">
            <div className="flex items-center justify-between gap-1 mb-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <IconComp className={`w-4 h-4 shrink-0 ${isCollege ? 'text-indigo-600' : 'text-[#008C95]'}`} />
                <span className="text-xs font-bold text-slate-900 truncate">{labelText}</span>
              </div>
              <span className="text-[10px] text-slate-500 font-semibold px-2 py-0.5 rounded-full bg-slate-200/70 shrink-0">
                {pendingSelection.length === 0
                  ? `All (${cleanOptions.length})`
                  : `${pendingSelection.length} of ${cleanOptions.length} selected`}
              </span>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder={isCollege ? 'Search College Model programs...' : 'Search Program (Own)...'}
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
                  Reset
                </button>
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="px-2 py-0.5 rounded text-[#008C95] hover:bg-teal-50 font-medium transition-colors cursor-pointer"
                >
                  Select All ({cleanOptions.length})
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
                {searchTerm
                  ? `No programs matching "${searchTerm}"`
                  : `No ${labelText} programs in current scope`}
              </div>
            ) : (
              filteredOptions.map((program) => {
                const isSelected = pendingSelection.includes(program);
                return (
                  <div
                    key={program}
                    onClick={(e) => handleToggleOption(program, e)}
                    className={`group flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                      isSelected ? selectedRowBg : 'text-slate-700 hover:bg-slate-100/80'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <div className="shrink-0 text-slate-400 group-hover:text-slate-600">
                        {isSelected ? (
                          <CheckSquare className={`w-4 h-4 ${checkIconColor}`} />
                        ) : (
                          <Square className="w-4 h-4 text-slate-300" />
                        )}
                      </div>
                      <span className="truncate" title={program}>
                        {program}
                      </span>
                    </div>

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
                setPendingSelection(selectedItems);
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
                    ? 'Apply (All)'
                    : pendingSelection.length === 1
                    ? 'Apply (1 Program)'
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

export const ProgramMultiSelect: React.FC<ProgramMultiSelectProps> = ({
  options = [],
  selectedPrograms,
  selectedProgram,
  onChange,
  className = '',
  compact = false,
  mode = 'both',
}) => {
  // Normalize combined selected programs from props
  const currentSelection = useMemo<string[]>(() => {
    if (selectedPrograms && Array.isArray(selectedPrograms)) {
      return selectedPrograms.filter((p) => p && p !== 'ALL');
    }
    if (selectedProgram && selectedProgram !== 'ALL') {
      return selectedProgram
        .split(',')
        .map((p) => p.trim())
        .filter((p) => p && p !== 'ALL');
    }
    return [];
  }, [selectedPrograms, selectedProgram]);

  const { ownOptions, collegeOptions } = useMemo(() => {
    const own: string[] = [];
    const college: string[] = [];
    (options || []).forEach((opt) => {
      if (!opt || typeof opt !== 'string') return;
      const trimmed = opt.trim();
      if (!trimmed || trimmed === 'ALL' || trimmed === 'N/A') return;
      if (isCollegeModelProgram(trimmed)) {
        college.push(trimmed);
      } else {
        own.push(trimmed);
      }
    });
    return { ownOptions: own, collegeOptions: college };
  }, [options]);

  const selectedOwn = useMemo(
    () => currentSelection.filter((p) => !isCollegeModelProgram(p)),
    [currentSelection]
  );

  const selectedCollege = useMemo(
    () => currentSelection.filter((p) => isCollegeModelProgram(p)),
    [currentSelection]
  );

  const handleOwnCommit = (nextOwn: string[]) => {
    onChange(Array.from(new Set([...nextOwn, ...selectedCollege])));
  };

  const handleCollegeCommit = (nextCollege: string[]) => {
    onChange(Array.from(new Set([...selectedOwn, ...nextCollege])));
  };

  if (mode === 'own') {
    return (
      <SingleProgramDropdown
        variant="own"
        options={ownOptions}
        selectedItems={selectedOwn}
        onCommit={handleOwnCommit}
        className={className}
        compact={compact}
      />
    );
  }

  if (mode === 'college') {
    return (
      <SingleProgramDropdown
        variant="college"
        options={collegeOptions}
        selectedItems={selectedCollege}
        onCommit={handleCollegeCommit}
        className={className}
        compact={compact}
      />
    );
  }

  return (
    <div className={`inline-flex flex-wrap items-center gap-2 ${className}`}>
      <SingleProgramDropdown
        variant="own"
        options={ownOptions}
        selectedItems={selectedOwn}
        onCommit={handleOwnCommit}
        compact={compact}
      />
      <SingleProgramDropdown
        variant="college"
        options={collegeOptions}
        selectedItems={selectedCollege}
        onCommit={handleCollegeCommit}
        compact={compact}
      />
    </div>
  );
};
