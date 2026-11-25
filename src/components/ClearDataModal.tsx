import React, { useState } from 'react';
import { Trash2, AlertTriangle, X, CheckCircle2, RefreshCw } from 'lucide-react';

interface ClearDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export const ClearDataModal: React.FC<ClearDataModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
}) => {
  const [isClearing, setIsClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleClear = async () => {
    setIsClearing(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to clear portal data. Please try again.');
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 border border-slate-200 shadow-2xl space-y-5 relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={isClearing}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-lg hover:bg-slate-100 disabled:opacity-50 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0 text-rose-600">
            <Trash2 className="w-5 h-5 text-rose-600" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Clear All Data from Portal
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Reset database and remove all stored records
            </p>
          </div>
        </div>

        {/* Warning Details */}
        <div className="bg-rose-50/70 border border-rose-200/80 rounded-xl p-3.5 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-rose-900">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>This action cannot be undone:</span>
          </div>
          <ul className="text-xs text-rose-800 space-y-1.5 pl-6 list-disc">
            <li>Clears student & enrollment data (<code className="bg-rose-100 px-1 rounded">raw_records</code>)</li>
            <li>Clears class schedule logs (<code className="bg-rose-100 px-1 rounded">scheduled_vs_conducted</code>)</li>
            <li>Clears slot replacement requests (<code className="bg-rose-100 px-1 rounded">slot_replacement</code>)</li>
            <li>Clears audit logs (<code className="bg-rose-100 px-1 rounded">audit_logs</code>) & upload history (<code className="bg-rose-100 px-1 rounded">uploads</code>)</li>
          </ul>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          The portal will be completely cleared and prepared for fresh Excel/CSV data uploads. Are you sure you want to proceed?
        </p>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <button
            onClick={onClose}
            disabled={isClearing}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleClear}
            disabled={isClearing}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-2 disabled:opacity-70"
          >
            {isClearing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Clearing All Data...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>Yes, Clear All Data</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
