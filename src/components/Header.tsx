import React from 'react';
import {
  Search,
  Sparkles,
  SlidersHorizontal,
  UserCheck,
  Building2,
  Calendar,
  Layers,
  FileSpreadsheet,
  ChevronDown,
  RefreshCw,
  Clock,
  Trash2,
  History,
  ShieldCheck,
  Globe,
} from 'lucide-react';
import { UploadRecord } from '../types';

interface HeaderProps {
  currentRole: string;
  onRoleChange: (role: string) => void;
  onOpenAi?: () => void;
  isFilterOpen: boolean;
  onToggleFilter: () => void;
  activeFilterCount: number;
  latestUpload: UploadRecord | null;
  onRefreshData: () => void;
  isRefreshing: boolean;
  onOpenPresenter?: () => void;
  onOpenClearModal?: () => void;
  onOpenRestore?: () => void;
  onOpenUserGuide?: () => void;
  isAdminPortal?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentRole,
  onRoleChange,
  onOpenAi,
  isFilterOpen,
  onToggleFilter,
  activeFilterCount,
  latestUpload,
  onRefreshData,
  isRefreshing,
  onOpenClearModal,
  onOpenRestore,
  isAdminPortal,
}) => {
  const [roleDropdownOpen, setRoleDropdownOpen] = React.useState(false);

  const roles = [
    { name: 'Admin', desc: 'Full System & Config Access' },
    { name: 'Academic Excellence Manager', desc: 'Analytics, Uploads, Reports' },
    { name: 'AE Member', desc: 'Operational Dashboards & Search' },
    { name: 'Viewer', desc: 'Read-Only Executive View' },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
      {/* Top Banner with Brand Identity */}
      <div className="px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
        {/* Logo & Product Title */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-[#008C95] flex items-center justify-center text-white font-bold text-xl shadow-xs shrink-0 tracking-tight">
            AE
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold tracking-tight text-slate-900 leading-tight">
                AE INSIGHT
              </h1>
              <span className="hidden md:inline-block text-xs font-semibold px-2 py-0.5 bg-[#E6F4F5] text-[#005F66] rounded border border-[#CCECF0]">
                {isAdminPortal ? 'Admin Control Portal (/admin)' : 'Academic Excellence'}
              </span>
              <span className="hidden lg:inline-block text-xs text-slate-500 font-medium">
                Anudip Foundation
              </span>
            </div>
            <p className="text-xs text-slate-500 truncate hidden sm:block">
              Turning Academic Data into Actionable Insights
            </p>
          </div>
        </div>



        {/* Right: Data Info, Filters, Clear Data, Refresh, User Role */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">

          {/* Restore Points Button */}
          {onOpenRestore && (
            <button
              onClick={onOpenRestore}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#E6F4F5] hover:bg-[#d5edf0] text-[#005F66] border border-[#008C95]/30 rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              title="Manage and create database restore points"
            >
              <History className="w-3.5 h-3.5 text-[#008C95] shrink-0" />
              <span className="hidden sm:inline">Restore Points</span>
            </button>
          )}

          {/* Clear All Data Button */}
          {onOpenClearModal && (
            <button
              onClick={onOpenClearModal}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-800 border border-rose-200 rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              title="Clear all portal records, batches, and uploads"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-600 shrink-0" />
              <span className="hidden sm:inline">Clear All Data</span>
            </button>
          )}

          {/* Refresh Action */}
          <button
            onClick={onRefreshData}
            disabled={isRefreshing}
            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
            title="Refresh analytics data"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#008C95]' : ''}`} />
          </button>

          {/* Filter Toggle Button */}
          <button
            onClick={onToggleFilter}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
              isFilterOpen || activeFilterCount > 0
                ? 'bg-[#E6F4F5] text-[#005F66] border-[#008C95]/30 shadow-xs'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-[#008C95]" />
            <span className="hidden sm:inline">Filters</span>
            {activeFilterCount > 0 && (
              <span className="inline-flex items-center justify-center px-1.5 py-0.2 text-[10px] font-bold bg-[#008C95] text-white rounded-full">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* User Role Switcher */}
          <div className="relative">
            <button
              onClick={() => setRoleDropdownOpen(!roleDropdownOpen)}
              className="flex items-center gap-2 px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs transition-colors cursor-pointer text-left"
            >
              <div className="w-6 h-6 rounded-full bg-[#008C95]/15 text-[#008C95] font-bold flex items-center justify-center text-xs">
                {currentRole.charAt(0)}
              </div>
              <div className="hidden xl:block">
                <div className="font-semibold text-slate-800 leading-tight truncate max-w-[120px]">
                  {currentRole}
                </div>
              </div>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {roleDropdownOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-xl shadow-lg py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="px-3 py-1.5 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Switch Active Role
                </div>
                {roles.map((r) => (
                  <button
                    key={r.name}
                    onClick={() => {
                      onRoleChange(r.name);
                      setRoleDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs transition-colors hover:bg-slate-50 flex items-start gap-2 ${
                      currentRole === r.name ? 'bg-[#E6F4F5]/50 text-[#005F66] font-semibold' : 'text-slate-700'
                    }`}
                  >
                    <UserCheck className={`w-4 h-4 mt-0.5 ${currentRole === r.name ? 'text-[#008C95]' : 'text-slate-400'}`} />
                    <div>
                      <div className="font-medium text-slate-900">{r.name}</div>
                      <div className="text-[11px] text-slate-500">{r.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Subheader: Active Dataset Metadata & Status */}
      <div className="bg-slate-50/90 border-t border-slate-200/80 px-4 sm:px-6 lg:px-8 py-1.5 text-xs text-slate-600 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <FileSpreadsheet className="w-3.5 h-3.5 text-[#008C95]" />
            <span className="font-medium text-slate-700">Source:</span>
            <span className="font-semibold text-slate-900">
              {latestUpload ? latestUpload.file_name : 'No Data Uploaded (Portal Empty)'}
            </span>
            {latestUpload && (
              <>
                <span className="text-slate-400">·</span>
                <span className="text-slate-500">Sheet: {latestUpload.sheet_name}</span>
              </>
            )}
          </div>

          {latestUpload ? (
            <div className="hidden sm:flex items-center gap-1.5 text-slate-500">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>Updated:</span>
              <span className="font-medium text-slate-700">
                {new Date(latestUpload.uploaded_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
              </span>
            </div>
          ) : (
            <span className="text-slate-400 hidden sm:inline text-[11px]">
              Ready for Excel / CSV upload
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 text-[11px] text-slate-500">
          <span>Operational Grains: Students · Batches · Centers · Trainers · AEs</span>
        </div>
      </div>
    </header>
  );
};
