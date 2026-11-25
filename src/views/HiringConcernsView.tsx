import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Briefcase, Maximize2, Minimize2, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

export const HiringConcernsView: React.FC = () => {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [zoom, setZoom] = useState(100);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullScreen) {
        setIsFullScreen(false);
        setZoom(100);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullScreen]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0 border border-teal-100">
            <Briefcase size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Hiring Concerns</h1>
            <p className="text-sm text-slate-500 mt-1">
              Regional hiring requirements, RFR aging status, and associated operational impact across locations and projects.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 self-start md:self-center">
          <button
            onClick={() => {
              setZoom(100);
              setIsFullScreen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-xl transition-colors border border-teal-200 shadow-2xs cursor-pointer"
            title="Enter Presentation Mode"
          >
            <Maximize2 size={15} />
            <span>Presentation Mode</span>
          </button>
        </div>
      </div>

      {/* Main Card displaying the Hiring Concerns Image */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-800">Hiring Concerns & Operational Impact</h2>
            <p className="text-xs text-slate-500 mt-0.5">Summary of pending RFR positions, aging duration, and delivery impact</p>
          </div>
          <button
            onClick={() => {
              setZoom(100);
              setIsFullScreen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-lg transition-colors border border-teal-200 cursor-pointer"
            title="Presentation Mode"
          >
            <Maximize2 size={14} />
            <span>Presentation Mode</span>
          </button>
        </div>

        <div className="p-4 sm:p-6 bg-white flex items-center justify-center overflow-x-auto">
          <img
            src="/assets/aistudio/image_8168f35c.png"
            alt="Hiring Concerns Table - Region Lead, Location / Project, Role Required, RFR Date / Aging, and Operational Impact"
            className="w-full max-w-6xl h-auto object-contain rounded-lg border border-slate-200/80 shadow-2xs"
          />
        </div>
      </div>

      {/* Presentation Mode Modal */}
      {isFullScreen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] bg-slate-950/90 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 md:p-6 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full h-full flex flex-col overflow-hidden">
            {/* Top Presentation Bar */}
            <div className="px-6 py-4 border-b border-slate-800 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-teal-500/20 text-teal-300 flex items-center justify-center border border-teal-400/30">
                  <Briefcase size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-lg font-bold text-white">Hiring Concerns</h2>
                    <span className="px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider bg-teal-500/20 text-teal-300 rounded-full border border-teal-400/30">
                      Presentation Mode
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Region Lead, Location / Project, Role Required, RFR Date / Aging & Operational Impact
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* Zoom Controls */}
                <div className="hidden sm:flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-xl px-2 py-1">
                  <button
                    onClick={() => setZoom(prev => Math.max(60, prev - 10))}
                    className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                    title="Zoom Out"
                  >
                    <ZoomOut size={15} />
                  </button>
                  <span className="text-xs font-bold text-slate-200 min-w-[3rem] text-center">
                    {zoom}%
                  </span>
                  <button
                    onClick={() => setZoom(prev => Math.min(180, prev + 10))}
                    className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                    title="Zoom In"
                  >
                    <ZoomIn size={15} />
                  </button>
                  <button
                    onClick={() => setZoom(100)}
                    className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors cursor-pointer ml-0.5"
                    title="Reset Zoom"
                  >
                    <RotateCcw size={14} />
                  </button>
                </div>

                {/* Exit Presentation Mode Button */}
                <button
                  onClick={() => {
                    setIsFullScreen(false);
                    setZoom(100);
                  }}
                  className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-xl transition-colors shadow-md cursor-pointer"
                  title="Exit Presentation Mode (Esc)"
                >
                  <Minimize2 size={16} />
                  <span>Exit Presentation Mode</span>
                </button>
              </div>
            </div>

            {/* Presentation Content Area */}
            <div className="flex-1 overflow-auto p-4 sm:p-8 bg-slate-50 flex items-center justify-center">
              <div
                style={{ width: `${zoom}%`, maxWidth: zoom > 100 ? 'none' : '1400px' }}
                className="transition-all duration-150 flex items-center justify-center m-auto"
              >
                <img
                  src="/assets/aistudio/image_8168f35c.png"
                  alt="Hiring Concerns Table - Presentation Mode"
                  className="w-full h-auto object-contain rounded-xl bg-white shadow-lg border border-slate-200"
                />
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
