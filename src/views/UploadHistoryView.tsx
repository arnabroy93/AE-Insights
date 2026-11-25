import React, { useState, useEffect } from 'react';
import {
  History,
  FileSpreadsheet,
  ShieldAlert,
  Clock,
  User,
  CheckCircle2,
  RefreshCw,
  Search
} from 'lucide-react';
import { api } from '../api';
import { UploadRecord, AuditLogEntry } from '../types';

export const UploadHistoryView: React.FC = () => {
  const [uploads, setUploads] = useState<UploadRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [activeTab, setActiveTab] = useState<'uploads' | 'audit'>('uploads');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [u, a] = await Promise.all([api.getUploadHistory(), api.getAuditLogs(100)]);
      setUploads(u);
      setAuditLogs(a);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">Upload History &amp; Audit Trail</h2>
          <p className="text-xs text-slate-500">
            Immutable versioned dataset history, upload IDs &amp; analytical audit logs
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg text-xs">
          <button
            onClick={() => setActiveTab('uploads')}
            className={`px-3 py-1.5 rounded-md font-semibold transition-colors cursor-pointer ${
              activeTab === 'uploads' ? 'bg-white text-[#008C95] shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Upload Versions ({uploads.length})
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-3 py-1.5 rounded-md font-semibold transition-colors cursor-pointer ${
              activeTab === 'audit' ? 'bg-white text-[#008C95] shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Audit Trail ({auditLogs.length})
          </button>
        </div>
      </div>

      {loading && (
        <div className="p-8 text-center text-xs text-slate-500">
          <div className="animate-spin w-6 h-6 border-2 border-[#008C95] border-t-transparent rounded-full mx-auto mb-2" />
          Loading logs...
        </div>
      )}

      {/* Uploads Tab */}
      {!loading && activeTab === 'uploads' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-100 text-[11px] font-bold text-slate-600 uppercase border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Upload ID</th>
                  <th className="px-4 py-3">File Name</th>
                  <th className="px-4 py-3">Sheet</th>
                  <th className="px-4 py-3 text-right">Rows</th>
                  <th className="px-4 py-3">Uploaded By</th>
                  <th className="px-4 py-3">Date &amp; Time</th>
                  <th className="px-4 py-3 text-right">Duration</th>
                  <th className="px-4 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {uploads.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-mono font-bold text-slate-900">{u.id}</td>
                    <td className="px-4 py-2.5 font-medium text-slate-800 flex items-center gap-1.5">
                      <FileSpreadsheet className="w-3.5 h-3.5 text-[#008C95]" />
                      <span>{u.file_name}</span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{u.sheet_name}</td>
                    <td className="px-4 py-2.5 text-right font-mono font-semibold">{u.valid_row_count.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-slate-600">{u.uploaded_by}</td>
                    <td className="px-4 py-2.5 text-slate-500 font-mono text-[11px]">
                      {new Date(u.uploaded_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono">{u.processing_duration_ms}ms</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 capitalize">
                        {u.processing_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Audit Trail Tab */}
      {!loading && activeTab === 'audit' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-100 text-[11px] font-bold text-slate-600 uppercase border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Details</th>
                  <th className="px-4 py-3 text-center">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-mono text-[11px] text-slate-500">
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-slate-800">{log.user_email}</td>
                    <td className="px-4 py-2.5 text-slate-600">{log.user_role}</td>
                    <td className="px-4 py-2.5 font-bold text-slate-900">{log.action}</td>
                    <td className="px-4 py-2.5 text-slate-600">{log.details}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold capitalize ${
                        log.result === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                      }`}>
                        {log.result}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
