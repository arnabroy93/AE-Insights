import React, { useState, useEffect } from 'react';
import {
  Maximize2,
  Minimize2,
  X,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  Tv,
  MessageSquare,
  Sparkles,
  Download,
  Info,
  Sliders,
  Sun,
  Moon,
  FileText,
  Video,
  Share2
} from 'lucide-react';

export interface PresentableChartItem {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  chartComponent: React.ReactNode;
  summaryMetrics?: { label: string; value: string | number; subtext?: string; color?: string }[];
  insights?: string[];
  filtersContext?: string;
}

interface MeetingPresenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  charts: PresentableChartItem[];
  activeChartIndex: number;
  onSelectChartIndex: (index: number) => void;
}

export const MeetingPresenterModal: React.FC<MeetingPresenterModalProps> = ({
  isOpen,
  onClose,
  charts,
  activeChartIndex,
  onSelectChartIndex,
}) => {
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [copiedNotes, setCopiedNotes] = useState(false);
  const [meetingNotes, setMeetingNotes] = useState<string>('');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<number>(100);

  const currentChart = charts[activeChartIndex] || charts[0];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight' && activeChartIndex < charts.length - 1) {
        onSelectChartIndex(activeChartIndex + 1);
      } else if (e.key === 'ArrowLeft' && activeChartIndex > 0) {
        onSelectChartIndex(activeChartIndex - 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, activeChartIndex, charts.length, onClose, onSelectChartIndex]);

  if (!isOpen || !currentChart) return null;

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
      }
    }
  };

  const handleCopySummaryForChat = () => {
    let text = `📊 Google Meet Focus: ${currentChart.title}\n`;
    if (currentChart.subtitle) text += `📌 ${currentChart.subtitle}\n`;
    if (currentChart.filtersContext) text += `🔍 Context: ${currentChart.filtersContext}\n`;
    text += `----------------------------------------\n`;

    if (currentChart.summaryMetrics && currentChart.summaryMetrics.length > 0) {
      text += `Key Metrics:\n`;
      currentChart.summaryMetrics.forEach((m) => {
        text += `• ${m.label}: ${m.value}${m.subtext ? ` (${m.subtext})` : ''}\n`;
      });
      text += `\n`;
    }

    if (currentChart.insights && currentChart.insights.length > 0) {
      text += `Executive Insights:\n`;
      currentChart.insights.forEach((ins) => {
        text += `• ${ins}\n`;
      });
    }

    navigator.clipboard.writeText(text);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2500);
  };

  const handleCopyNotes = () => {
    if (!meetingNotes.trim()) return;
    navigator.clipboard.writeText(`📝 Action Items / Meeting Notes (${currentChart.title}):\n${meetingNotes}`);
    setCopiedNotes(true);
    setTimeout(() => setCopiedNotes(false), 2500);
  };

  const isDarkMode = theme === 'dark';

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col font-sans transition-colors duration-200 ${
        isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-900'
      }`}
    >
      {/* 1. Google Meeting Top Presentation Header */}
      <header
        className={`px-6 py-3 flex items-center justify-between border-b shrink-0 ${
          isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-500 text-[11px] font-bold tracking-wide uppercase animate-pulse">
            <span className="w-2 h-2 rounded-full bg-red-500"></span>
            <span>Google Meet Focus Mode</span>
          </div>

          <div className="h-4 w-px bg-slate-700/40" />

          <div>
            <h1 className="text-base font-extrabold tracking-tight flex items-center gap-2">
              <span>{currentChart.title}</span>
              <span className="text-xs font-normal text-slate-400">
                ({activeChartIndex + 1} of {charts.length})
              </span>
            </h1>
            {currentChart.subtitle && (
              <p className="text-xs text-slate-400 font-medium">{currentChart.subtitle}</p>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Active Filter Context pill */}
          {currentChart.filtersContext && (
            <div className={`hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono ${
              isDarkMode ? 'bg-slate-800/80 text-slate-300 border border-slate-700' : 'bg-slate-100 text-slate-700 border border-slate-200'
            }`}>
              <Sliders className="w-3.5 h-3.5 text-[#008C95]" />
              <span className="truncate max-w-xs">{currentChart.filtersContext}</span>
            </div>
          )}

          {/* Copy Meeting Chat Summary Button */}
          <button
            onClick={handleCopySummaryForChat}
            className="px-3 py-1.5 rounded-lg bg-[#008C95] hover:bg-[#00747C] text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
            title="Copy formatted chart summary text to paste in Google Meet chat"
          >
            {copiedSummary ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
            <span>{copiedSummary ? 'Copied to Chat!' : 'Copy Summary for Meet Chat'}</span>
          </button>

          {/* Theme Toggle */}
          <button
            onClick={() => setTheme(isDarkMode ? 'light' : 'dark')}
            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
              isDarkMode ? 'border-slate-800 hover:bg-slate-800 text-slate-300' : 'border-slate-300 hover:bg-slate-200 text-slate-700'
            }`}
            title="Toggle Light/Dark backdrop"
          >
            {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Presentation Mode Toggle */}
          <button
            onClick={toggleFullscreen}
            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
              isDarkMode ? 'border-slate-800 hover:bg-slate-800 text-slate-300' : 'border-slate-300 hover:bg-slate-200 text-slate-700'
            }`}
            title="Toggle Presentation Mode"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Close button */}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 transition-colors cursor-pointer"
            title="Exit Presentation Mode (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* 2. Main Body Content (Focused Chart + Presenter Intelligence Panel) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left/Main Area: Enlarged Focused Chart */}
        <div className="flex-1 flex flex-col p-6 overflow-y-auto">
          {/* Quick Metrics Bar if available */}
          {currentChart.summaryMetrics && currentChart.summaryMetrics.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 shrink-0">
              {currentChart.summaryMetrics.map((metric, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-xl border ${
                    isDarkMode
                      ? 'bg-slate-900/80 border-slate-800/80'
                      : 'bg-white border-slate-200 shadow-2xs'
                  }`}
                >
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    {metric.label}
                  </div>
                  <div className={`text-xl font-bold font-mono mt-0.5 ${metric.color || (isDarkMode ? 'text-teal-400' : 'text-[#008C95]')}`}>
                    {metric.value}
                  </div>
                  {metric.subtext && (
                    <div className="text-[10px] text-slate-400 mt-0.5">{metric.subtext}</div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Main Focused Chart View Container */}
          <div
            className={`flex-1 min-h-[420px] rounded-2xl border p-6 flex flex-col justify-center relative transition-transform duration-150 ${
              isDarkMode
                ? 'bg-slate-900/60 border-slate-800 shadow-2xl'
                : 'bg-white border-slate-200 shadow-lg'
            }`}
            style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}
          >
            {/* Chart Render */}
            <div className="w-full h-full flex-1 min-h-[380px]">
              {currentChart.chartComponent}
            </div>
          </div>
        </div>

        {/* Right Sidebar: Presenter Notes & Executive Talking Points */}
        <aside
          className={`w-80 lg:w-96 border-l flex flex-col shrink-0 ${
            isDarkMode ? 'bg-slate-900/70 border-slate-800' : 'bg-white border-slate-200'
          }`}
        >
          {/* Top Tabs / Header */}
          <div className="p-4 border-b border-slate-800/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Presenter Intelligence
              </span>
            </div>
            <div className="text-[11px] text-slate-400 font-mono">
              Press ← → to navigate
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            {/* Executive Insights Bullet Points */}
            <div>
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-[#008C95]" />
                <span>Key Talking Points</span>
              </h3>
              {currentChart.insights && currentChart.insights.length > 0 ? (
                <ul className="space-y-2">
                  {currentChart.insights.map((ins, i) => (
                    <li
                      key={i}
                      className={`text-xs p-2.5 rounded-lg border leading-relaxed ${
                        isDarkMode
                          ? 'bg-slate-800/50 border-slate-700/50 text-slate-200'
                          : 'bg-slate-50 border-slate-200 text-slate-800'
                      }`}
                    >
                      • {ins}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-xs text-slate-500 italic p-3 rounded-lg border border-dashed border-slate-700/50">
                  Data points dynamically updated based on active filters. Use chart tooltips for individual data values.
                </div>
              )}
            </div>

            {/* Interactive Meeting Action Items / Presenter Scratchpad */}
            <div className="flex flex-col flex-1">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-amber-400" />
                  <span>Meeting Action Items / Notes</span>
                </h3>
                {meetingNotes.trim() && (
                  <button
                    onClick={handleCopyNotes}
                    className="text-[11px] text-teal-400 hover:text-teal-300 flex items-center gap-1 cursor-pointer"
                  >
                    {copiedNotes ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedNotes ? 'Copied' : 'Copy Notes'}</span>
                  </button>
                )}
              </div>
              <textarea
                value={meetingNotes}
                onChange={(e) => setMeetingNotes(e.target.value)}
                placeholder="Type real-time meeting decisions, questions, or action items here..."
                rows={6}
                className={`w-full p-3 text-xs rounded-xl border resize-none focus:outline-none focus:ring-1 ${
                  isDarkMode
                    ? 'bg-slate-950 border-slate-800 text-slate-200 placeholder-slate-600 focus:ring-teal-500'
                    : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:ring-[#008C95]'
                }`}
              />
            </div>
          </div>
        </aside>
      </div>

      {/* 3. Bottom Meeting Navigation & Carousel Bar */}
      <footer
        className={`px-6 py-2.5 border-t flex items-center justify-between shrink-0 ${
          isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200'
        }`}
      >
        {/* Previous Chart Button */}
        <button
          onClick={() => onSelectChartIndex(activeChartIndex - 1)}
          disabled={activeChartIndex === 0}
          className="px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer border-slate-700 hover:bg-slate-800 text-slate-200"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Previous Chart</span>
        </button>

        {/* Thumbnail Selector Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto max-w-xl py-1 px-2 no-scrollbar">
          {charts.map((c, idx) => (
            <button
              key={c.id || idx}
              onClick={() => onSelectChartIndex(idx)}
              className={`px-3 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all cursor-pointer ${
                idx === activeChartIndex
                  ? 'bg-[#008C95] text-white shadow-xs font-bold scale-105'
                  : isDarkMode
                  ? 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                  : 'bg-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-300'
              }`}
            >
              {idx + 1}. {c.title}
            </button>
          ))}
        </div>

        {/* Next Chart Button */}
        <button
          onClick={() => onSelectChartIndex(activeChartIndex + 1)}
          disabled={activeChartIndex === charts.length - 1}
          className="px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer border-slate-700 hover:bg-slate-800 text-slate-200"
        >
          <span>Next Chart</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </footer>
    </div>
  );
};
