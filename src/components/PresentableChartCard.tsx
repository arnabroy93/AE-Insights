import React from 'react';
import { Tv, Video, Sparkles, Info, Maximize2 } from 'lucide-react';

interface PresentableChartCardProps {
  title: string;
  subtitle?: string;
  description?: string;
  onPresent?: () => void;
  onFullscreen?: () => void;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  badge?: string;
}

export const PresentableChartCard: React.FC<PresentableChartCardProps> = ({
  title,
  subtitle,
  description,
  onPresent,
  onFullscreen,
  headerActions,
  children,
  className = '',
  badge
}) => {
  const handleFullscreen = onFullscreen || onPresent;

  return (
    <div className={`bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col relative group transition-all duration-200 hover:border-slate-300 ${className}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
              <span>{title}</span>
            </h3>
            {badge && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#008C95]/10 text-[#008C95]">
                {badge}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-xs text-slate-500 font-medium mt-0.5">{subtitle}</p>
          )}
          {description && (
            <p className="text-[11px] text-slate-400 mt-1">{description}</p>
          )}
        </div>

        {/* Right side controls & Google Meet / Fullscreen buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          {headerActions}

          {handleFullscreen && (
            <button
              onClick={handleFullscreen}
              className="p-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 text-xs font-semibold flex items-center gap-1 transition-all duration-150 cursor-pointer shadow-2xs"
              title="Open chart in Presentation Mode"
            >
              <Maximize2 className="w-3.5 h-3.5 text-slate-700" />
              <span className="hidden sm:inline text-[11px]">Presentation Mode</span>
            </button>
          )}

          {onPresent && (
            <button
              onClick={onPresent}
              className="px-2.5 py-1.5 rounded-lg bg-[#008C95]/10 hover:bg-[#008C95] text-[#008C95] hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all duration-150 cursor-pointer shadow-2xs group/btn border border-[#008C95]/20"
              title="Present this chart in Google Meeting (Focus Mode)"
            >
              <Video className="w-3.5 h-3.5 text-[#008C95] group-hover/btn:text-white transition-colors" />
              <span className="hidden sm:inline text-[11px]">Present in Meet</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Chart Content */}
      <div className="flex-1 min-h-[280px] w-full">
        {children}
      </div>
    </div>
  );
};
