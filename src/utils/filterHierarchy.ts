import { FilterOptions, FilterParams } from '../types';

export function extractSelectedList(arrayVal?: string[], singleVal?: string): string[] {
  if (arrayVal && Array.isArray(arrayVal) && arrayVal.length > 0) {
    return arrayVal.map(v => v.trim()).filter(v => v && v !== 'ALL');
  }
  if (singleVal && singleVal !== 'ALL') {
    return singleVal
      .split(',')
      .map(v => v.trim())
      .filter(v => v && v !== 'ALL');
  }
  return [];
}

export function getCleanRmOptions(rmShZhs?: string[]): string[] {
  const set = new Set<string>();
  (rmShZhs || []).forEach(r => {
    if (!r || typeof r !== 'string') return;
    const trimmed = r.trim();
    if (!trimmed || trimmed === 'ALL' || trimmed === 'N/A') return;
    if (trimmed.toLowerCase().includes('upvan')) {
      set.add('Krishna Prasad');
      return;
    }
    set.add(trimmed);
  });
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

export function getScopedFilterOptions(
  filterOptions: FilterOptions | undefined,
  filters: FilterParams | undefined,
  fallbackCenters?: string[],
  fallbackPrograms?: string[]
): {
  selectedRms: string[];
  selectedCenters: string[];
  selectedPrograms: string[];
  rmOptions: string[];
  centerOptions: string[];
  programOptions: string[];
} {
  const selectedRms = extractSelectedList(filters?.rmShZhs, filters?.rmShZh);
  const selectedCenters = extractSelectedList(filters?.centerCodes, filters?.centerCode);
  const selectedPrograms = extractSelectedList(filters?.programNames, filters?.programName);

  const rmOptions = getCleanRmOptions(filterOptions?.rmShZhs);
  const baseCentersSet = new Set<string>([
    ...(filterOptions?.centers || []),
    ...(fallbackCenters || []),
  ]);
  const baseCenters = Array.from(baseCentersSet).filter(Boolean).sort((a, b) => a.localeCompare(b));

  const baseProgramsSet = new Set<string>([
    ...(filterOptions?.programs || []),
    ...(fallbackPrograms || []),
  ]);
  (filterOptions?.hierarchy || []).forEach(item => {
    if (item.program) baseProgramsSet.add(item.program);
  });
  selectedPrograms.forEach(p => baseProgramsSet.add(p));
  const basePrograms = Array.from(baseProgramsSet).filter(Boolean).sort((a, b) => a.localeCompare(b));

  const hierarchy = filterOptions?.hierarchy || [];

  // Scope Centers by selected RMs if any RM is selected
  let centerOptions = baseCenters;
  if (selectedRms.length > 0 && hierarchy.length > 0) {
    const lowerRms = new Set(selectedRms.map(r => r.toLowerCase().trim()));
    const matchedCenters = new Set<string>();
    hierarchy.forEach(item => {
      if (item.rm && lowerRms.has(item.rm.toLowerCase().trim()) && item.center) {
        matchedCenters.add(item.center);
      }
    });
    selectedCenters.forEach(c => matchedCenters.add(c));
    if (matchedCenters.size > 0) {
      centerOptions = Array.from(matchedCenters).sort((a, b) => a.localeCompare(b));
    }
  }

  // Scope Programs by selected RMs and/or selected Centers
  let programOptions = basePrograms;
  if ((selectedRms.length > 0 || selectedCenters.length > 0) && hierarchy.length > 0) {
    const lowerRms = new Set(selectedRms.map(r => r.toLowerCase().trim()));
    const lowerCenters = new Set(selectedCenters.map(c => c.toLowerCase().trim()));
    const matchedPrograms = new Set<string>();

    hierarchy.forEach(item => {
      const rmMatch = lowerRms.size === 0 || (item.rm && lowerRms.has(item.rm.toLowerCase().trim()));
      const centerMatch = lowerCenters.size === 0 || (item.center && lowerCenters.has(item.center.toLowerCase().trim()));
      if (rmMatch && centerMatch && item.program) {
        matchedPrograms.add(item.program);
      }
    });
    selectedPrograms.forEach(p => matchedPrograms.add(p));
    if (matchedPrograms.size > 0) {
      programOptions = Array.from(matchedPrograms).sort((a, b) => a.localeCompare(b));
    }
  }

  return {
    selectedRms,
    selectedCenters,
    selectedPrograms,
    rmOptions,
    centerOptions,
    programOptions,
  };
}
