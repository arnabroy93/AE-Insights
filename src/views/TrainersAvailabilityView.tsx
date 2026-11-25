import React, { useState } from 'react';
import { UserCheck, Maximize2, Minimize2, RefreshCw } from 'lucide-react';

const EMBED_URL = '/trainers-availability-embed/?view=1';

export const TrainersAvailabilityView: React.FC = () => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-teal-50 text-teal-700 rounded-xl border border-teal-100">
              <UserCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Trainers Availability</h2>
              <p className="text-sm text-slate-500">
                Real-time trainer availability, allocation status, and scheduling dashboard
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setIframeKey((prev) => prev + 1)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-sm font-medium transition-colors shadow-xs cursor-pointer"
              title="Reload Trainers Availability View"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Reload</span>
            </button>
            <button
              onClick={() => setIsFullscreen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-600 text-white hover:bg-teal-700 text-sm font-medium transition-colors shadow-xs cursor-pointer"
            >
              <Maximize2 className="w-4 h-4" />
              <span>Expand View</span>
            </button>
          </div>
        </div>

        <iframe
          key={iframeKey}
          src={EMBED_URL}
          width="100%"
          height="700px"
          title="Trainers Availability Dashboard"
          className="w-full h-[700px] border-0 rounded-[12px] shadow-[0_4px_12px_rgba(0,0,0,0.1)]"
        />
      </div>

      {isFullscreen && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-xs flex flex-col p-4 sm:p-6">
          <div className="flex items-center justify-between bg-slate-900 text-white px-5 py-3.5 rounded-t-2xl border border-slate-800">
            <div className="flex items-center gap-3">
              <UserCheck className="w-5 h-5 text-teal-400" />
              <span className="font-semibold text-base">Trainers Availability — Fullscreen View</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIframeKey((prev) => prev + 1)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reload</span>
              </button>
              <button
                onClick={() => setIsFullscreen(false)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                <Minimize2 className="w-3.5 h-3.5" />
                <span>Exit Fullscreen</span>
              </button>
            </div>
          </div>
          <div className="flex-1 bg-white rounded-b-2xl overflow-hidden">
            <iframe
              key={`fullscreen-${iframeKey}`}
              src={EMBED_URL}
              width="100%"
              height="100%"
              title="Trainers Availability Fullscreen Dashboard"
              className="w-full h-full border-0"
            />
          </div>
        </div>
      )}
    </div>
  );
};
