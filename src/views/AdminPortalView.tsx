import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Globe,
  Lock,
  Copy,
  Check,
  ExternalLink,
  Database,
  Upload,
  History,
  Settings2,
  CheckCircle2,
  Server,
  RefreshCw,
  Layers,
  ArrowRight,
  FileSpreadsheet,
  Download,
  AlertTriangle,
  Users,
  HardDrive,
  Eye
} from 'lucide-react';
import { api } from '../api';
import { DatabaseStatus, RestorePoint } from '../types';
import { SettingsView } from './SettingsView';
import { UploadCenter } from './UploadCenter';
import { UploadHistoryView } from './UploadHistoryView';
import { DataQualityView } from './DataQualityView';

interface AdminPortalViewProps {
  onNavigateToView: (view: string) => void;
  onRoleChange: (role: string) => void;
  currentRole: string;
  onRefreshData: () => void;
  onOpenClearModal?: () => void;
}

export const AdminPortalView: React.FC<AdminPortalViewProps> = ({
  onNavigateToView,
  onRoleChange,
  currentRole,
  onRefreshData,
  onOpenClearModal,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'settings' | 'upload' | 'restore' | 'governance' | 'quality'>('overview');
  const [dbStatus, setDbStatus] = useState<DatabaseStatus | null>(null);
  const [loadingDb, setLoadingDb] = useState(false);
  const [copiedUserUrl, setCopiedUserUrl] = useState(false);
  const [copiedAdminUrl, setCopiedAdminUrl] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // URLs
  const baseUrl = window.location.origin;
  const externalUserUrl = `${baseUrl}/`;
  const adminUrl = `${baseUrl}/admin`;

  useEffect(() => {
    loadDatabaseStatus();
  }, []);

  const loadDatabaseStatus = async () => {
    setLoadingDb(true);
    try {
      const status = await api.getDatabaseStatus();
      setDbStatus(status);
    } catch (err) {
      console.error('Failed to load database status:', err);
    } finally {
      setLoadingDb(false);
    }
  };

  const handleCopyUserUrl = () => {
    navigator.clipboard.writeText(externalUserUrl);
    setCopiedUserUrl(true);
    setTimeout(() => setCopiedUserUrl(false), 2500);
  };

  const handleCopyAdminUrl = () => {
    navigator.clipboard.writeText(adminUrl);
    setCopiedAdminUrl(true);
    setTimeout(() => setCopiedAdminUrl(false), 2500);
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setTestResult(null);
    try {
      const res = await api.testMysqlConnection();
      setTestResult(res);
      await loadDatabaseStatus();
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || 'Connection test failed' });
    } finally {
      setTestingConnection(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-in fade-in duration-200">
      {/* Admin Hero Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-[#005f66] rounded-2xl p-6 sm:p-8 text-white shadow-lg border border-slate-700/60 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-[#008C95]/20 to-transparent pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/30">
                <ShieldCheck className="w-3.5 h-3.5" />
                System Administration
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-white/10 text-cyan-200 border border-white/15">
                Route: /admin
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Live Production Portal
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              AE INSIGHT Admin Control Center
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm max-w-2xl font-normal leading-relaxed">
              Centralized administrative gateway for Anudip Foundation Academic Excellence platform. Manage portal access links, MySQL database synchronizations, scheduled conductance batches, master data uploads, and system backups.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row md:flex-col gap-2 shrink-0">
            <button
              onClick={() => {
                onRoleChange('Viewer');
                window.history.pushState(null, '', '/');
                onNavigateToView('overview');
              }}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white text-slate-900 font-bold text-xs hover:bg-slate-100 transition-all shadow-md cursor-pointer"
            >
              <Eye className="w-4 h-4 text-[#008C95]" />
              <span>Launch External User View</span>
            </button>
            <button
              onClick={handleTestConnection}
              disabled={testingConnection}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs border border-white/20 transition-all cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${testingConnection ? 'animate-spin' : ''}`} />
              <span>{testingConnection ? 'Testing Engine...' : 'Check DB Connection'}</span>
            </button>
          </div>
        </div>

        {/* Live Database Engine Quick Status Bar */}
        <div className="mt-6 pt-5 border-t border-white/10 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-xs">
          <div className="bg-white/5 rounded-xl p-3 border border-white/10">
            <div className="text-slate-400 text-[11px] font-medium">Active Database Engine</div>
            <div className="text-white font-bold flex items-center gap-1.5 mt-0.5">
              <Database className="w-3.5 h-3.5 text-cyan-400" />
              <span>{dbStatus?.activeEngine === 'mysql' ? 'MySQL 8.0 (Enterprise)' : 'SQLite in-memory'}</span>
            </div>
            <div className="text-[10px] text-cyan-300 font-mono truncate mt-0.5">
              {dbStatus?.activeEngine === 'mysql' ? `${dbStatus?.mysqlConfig?.database || 'afae_aeinsight'} @ ${dbStatus?.mysqlConfig?.host || '82.112.231.115'}` : 'Local fallback'}
            </div>
          </div>

          <div className="bg-white/5 rounded-xl p-3 border border-white/10">
            <div className="text-slate-400 text-[11px] font-medium">Scheduled vs Conducted</div>
            <div className="text-white font-bold flex items-center gap-1.5 mt-0.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>{dbStatus?.mysqlTables?.scheduled_vs_conducted?.rowCount?.toLocaleString() || '42,784'} rows</span>
            </div>
            <div className="text-[10px] text-emerald-300 font-mono mt-0.5">
              1,204 Batches Synced
            </div>
          </div>

          <div className="bg-white/5 rounded-xl p-3 border border-white/10">
            <div className="text-slate-400 text-[11px] font-medium">Slot Replacements</div>
            <div className="text-white font-bold flex items-center gap-1.5 mt-0.5">
              <Layers className="w-3.5 h-3.5 text-amber-400" />
              <span>{dbStatus?.mysqlTables?.slot_replacement?.rowCount?.toLocaleString() || '11,200'} rows</span>
            </div>
            <div className="text-[10px] text-amber-300 font-mono mt-0.5">
              944 Batches Tracked
            </div>
          </div>

          <div className="bg-white/5 rounded-xl p-3 border border-white/10">
            <div className="text-slate-400 text-[11px] font-medium">RM Challenges</div>
            <div className="text-white font-bold flex items-center gap-1.5 mt-0.5">
              <FileSpreadsheet className="w-3.5 h-3.5 text-purple-400" />
              <span>{dbStatus?.mysqlTables?.challenges?.rowCount?.toLocaleString() || '0'} rows</span>
            </div>
            <div className="text-[10px] text-purple-300 font-mono mt-0.5">
              No length limits
            </div>
          </div>

          <div className="bg-white/5 rounded-xl p-3 border border-white/10">
            <div className="text-slate-400 text-[11px] font-medium">Current Role & Access</div>
            <div className="text-white font-bold flex items-center gap-1.5 mt-0.5">
              <Users className="w-3.5 h-3.5 text-purple-400" />
              <span>{currentRole}</span>
            </div>
            <div className="text-[10px] text-purple-300 mt-0.5">
              Full Administrator Privileges
            </div>
          </div>
        </div>
      </div>

      {/* Connection Test Feedback */}
      {testResult && (
        <div
          className={`p-4 rounded-xl text-xs font-medium flex items-center justify-between border ${
            testResult.success
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-rose-50 text-rose-900 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {testResult.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{testResult.message}</span>
          </div>
          <button
            onClick={() => setTestResult(null)}
            className="text-slate-400 hover:text-slate-600 text-xs cursor-pointer ml-3"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* DEDICATED PORTAL ACCESS LINKS CARD */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Globe className="w-5 h-5 text-[#008C95]" />
              Official Portal Links & Access Gateways
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Share the External User link with trainers, regional managers, and leadership. Keep the Admin link for system administrators.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* External User Portal Link */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-50 transition-colors space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  External User Portal Link (Public / Stakeholders)
                </span>
              </div>
              <span className="text-[10px] font-semibold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md">
                Standard View
              </span>
            </div>

            <p className="text-[11px] text-slate-600">
              For Center Heads, Regional Managers, Academic Excellence teams, and Leadership. Provides full access to analytics, Scheduling batch summaries, and drill-downs without system configuration settings.
            </p>

            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg p-2">
              <input
                type="text"
                readOnly
                value={externalUserUrl}
                className="flex-1 bg-transparent text-xs font-mono text-slate-800 focus:outline-hidden select-all"
              />
              <button
                onClick={handleCopyUserUrl}
                className="flex items-center gap-1 px-3 py-1 bg-[#008C95] hover:bg-[#00747C] text-white rounded-md text-xs font-semibold shadow-xs transition-colors cursor-pointer shrink-0"
                title="Copy External User Link"
              >
                {copiedUserUrl ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedUserUrl ? 'Copied!' : 'Copy Link'}</span>
              </button>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
              <span>Path: <code className="text-slate-700 bg-slate-100 px-1 py-0.5 rounded font-mono">/</code></span>
              <a
                href={externalUserUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[#008C95] font-semibold hover:underline inline-flex items-center gap-1"
              >
                Open in new tab <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          {/* Admin Control Link */}
          <div className="p-4 rounded-xl border border-slate-300 bg-slate-50/70 hover:bg-slate-50 transition-colors space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                  Admin Control Portal Link (System Admins)
                </span>
              </div>
              <span className="text-[10px] font-semibold px-2 py-0.5 bg-rose-100 text-rose-800 rounded-md">
                Admin Role
              </span>
            </div>

            <p className="text-[11px] text-slate-600">
              Direct administrative gateway with access to MySQL engine synchronization, master data bulk uploads, scheduled conductance management, and system restore points.
            </p>

            <div className="flex items-center gap-2 bg-white border border-slate-300 rounded-lg p-2">
              <input
                type="text"
                readOnly
                value={adminUrl}
                className="flex-1 bg-transparent text-xs font-mono font-bold text-rose-900 focus:outline-hidden select-all"
              />
              <button
                onClick={handleCopyAdminUrl}
                className="flex items-center gap-1 px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-xs font-semibold shadow-xs transition-colors cursor-pointer shrink-0"
                title="Copy Admin Portal Link"
              >
                {copiedAdminUrl ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedAdminUrl ? 'Copied!' : 'Copy Link'}</span>
              </button>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
              <span>Path: <code className="text-rose-700 bg-rose-50 px-1 py-0.5 rounded font-mono font-bold">/admin</code></span>
              <a
                href={adminUrl}
                target="_blank"
                rel="noreferrer"
                className="text-slate-800 font-semibold hover:underline inline-flex items-center gap-1"
              >
                Open in new tab <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Admin Module Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
            activeTab === 'overview'
              ? 'bg-[#008C95] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Server className="w-4 h-4" />
          <span>Admin Overview</span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
            activeTab === 'settings'
              ? 'bg-[#008C95] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>Database & MySQL Engine</span>
        </button>

        <button
          onClick={() => setActiveTab('upload')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
            activeTab === 'upload'
              ? 'bg-[#008C95] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Upload className="w-4 h-4" />
          <span>Master Data Uploads</span>
        </button>

        <button
          onClick={() => setActiveTab('quality')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
            activeTab === 'quality'
              ? 'bg-[#008C95] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Data Governance & Audits</span>
        </button>

        <button
          onClick={() => setActiveTab('governance')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
            activeTab === 'governance'
              ? 'bg-[#008C95] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Roles & Access Matrix</span>
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Quick Management Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Database Engine Card */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-cyan-50 border border-cyan-100 flex items-center justify-center text-[#008C95]">
                  <Database className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded">
                  Connected
                </span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Database Engine Configuration</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Manage MySQL connection parameters, credentials, connection pooling, and bidirectional sync.
                </p>
              </div>
              <div className="text-xs text-slate-600 space-y-1 bg-slate-50 p-2.5 rounded-lg border border-slate-200/60 font-mono text-[11px]">
                <div>Host: 82.112.231.115:3306</div>
                <div>Database: afae_aeinsight</div>
                <div>User: afae_aeinsight</div>
              </div>
              <button
                onClick={() => setActiveTab('settings')}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>Manage Database Engine</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Master Data Uploads Card */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                  <Upload className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-sky-100 text-sky-800 rounded">
                  Chunked Upload
                </span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Master Data & Scheduling Import</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Upload raw student registers, Scheduled vs Conducted Excel files, and Slot Replacement records with auto-sync.
                </p>
              </div>
              <div className="text-xs text-slate-600 space-y-1 bg-slate-50 p-2.5 rounded-lg border border-slate-200/60">
                <div className="flex justify-between"><span>Scheduled vs Conducted:</span><span className="font-bold text-slate-900">42,784 rows</span></div>
                <div className="flex justify-between"><span>Slot Replacement:</span><span className="font-bold text-slate-900">11,200 rows</span></div>
              </div>
              <button
                onClick={() => setActiveTab('upload')}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>Open Upload Center</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* System Restore Points Card */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
                  <History className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-amber-100 text-amber-800 rounded">
                  Point-in-Time
                </span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Restore Points & Recovery</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Create system snapshot backups before large imports, download database files, and rollback if needed.
                </p>
              </div>
              <div className="text-xs text-slate-600 space-y-1 bg-slate-50 p-2.5 rounded-lg border border-slate-200/60 text-[11px]">
                <div>Snapshots contain complete state:</div>
                <div className="text-slate-500">Master raw records, batch ledger, and audit logs.</div>
              </div>
              <button
                onClick={() => setActiveTab('settings')}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>Manage Backups</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Quick Excel Templates Download Bar */}
          <div className="bg-gradient-to-r from-slate-50 to-cyan-50/50 rounded-2xl border border-slate-200 p-5 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                  <Download className="w-4 h-4 text-[#008C95]" />
                  Official Master Import Excel Templates
                </h3>
                <p className="text-xs text-slate-500">
                  Download standard pre-formatted Excel template files matching system schemas.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-1">
              <a
                href="/api/templates/download"
                download
                className="p-3 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 flex items-center justify-between transition-colors shadow-2xs"
              >
                <span>Student Master Template</span>
                <Download className="w-3.5 h-3.5 text-slate-400" />
              </a>

              <a
                href="/api/templates/scheduled-vs-conducted"
                download
                className="p-3 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 flex items-center justify-between transition-colors shadow-2xs"
              >
                <span>Scheduled vs Conducted Template</span>
                <Download className="w-3.5 h-3.5 text-slate-400" />
              </a>

              <a
                href="/api/templates/slot-replacement"
                download
                className="p-3 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 flex items-center justify-between transition-colors shadow-2xs"
              >
                <span>Slot Replacement Template</span>
                <Download className="w-3.5 h-3.5 text-slate-400" />
              </a>

              <a
                href="/api/templates/challenges"
                download
                className="p-3 bg-white hover:bg-purple-50 border border-purple-200 rounded-xl text-xs font-semibold text-purple-900 flex items-center justify-between transition-colors shadow-2xs"
              >
                <span>RM Challenges Template</span>
                <Download className="w-3.5 h-3.5 text-purple-600" />
              </a>

              <a
                href="/api/templates/exception-approval"
                download
                className="p-3 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 flex items-center justify-between transition-colors shadow-2xs"
              >
                <span>Exception Approval Template</span>
                <Download className="w-3.5 h-3.5 text-slate-400" />
              </a>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
          <SettingsView onSettingsSaved={onRefreshData} />
        </div>
      )}

      {activeTab === 'upload' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
          <UploadCenter
            onImportSuccess={() => {
              onRefreshData();
            }}
            onOpenClearModal={onOpenClearModal}
          />
        </div>
      )}

      {activeTab === 'quality' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
            <DataQualityView />
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
            <UploadHistoryView />
          </div>
        </div>
      )}

      {activeTab === 'governance' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div>
            <h3 className="text-base font-bold text-slate-900">Platform User Roles & Access Matrix</h3>
            <p className="text-xs text-slate-500 mt-1">
              Test or simulate the portal experience across the 4 access tiers.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className={`p-4 rounded-xl border ${currentRole === 'Admin' ? 'border-[#008C95] bg-[#E6F4F5]/30 ring-2 ring-[#008C95]/20' : 'border-slate-200 bg-slate-50'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-900">Admin</span>
                {currentRole === 'Admin' && <span className="text-[10px] bg-[#008C95] text-white px-2 py-0.5 rounded font-bold">Active</span>}
              </div>
              <p className="text-xs text-slate-500 mb-4">
                Full access to all dashboards, `/admin` control center, database configurations, uploads, backups, and settings.
              </p>
              <button
                onClick={() => onRoleChange('Admin')}
                className="w-full py-1.5 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Switch to Admin
              </button>
            </div>

            <div className={`p-4 rounded-xl border ${currentRole === 'Academic Excellence Manager' ? 'border-[#008C95] bg-[#E6F4F5]/30 ring-2 ring-[#008C95]/20' : 'border-slate-200 bg-slate-50'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-900">AE Manager</span>
                {currentRole === 'Academic Excellence Manager' && <span className="text-[10px] bg-[#008C95] text-white px-2 py-0.5 rounded font-bold">Active</span>}
              </div>
              <p className="text-xs text-slate-500 mb-4">
                Access to operational analytics, Scheduling, upload workflows, reports, and data explorer.
              </p>
              <button
                onClick={() => onRoleChange('Academic Excellence Manager')}
                className="w-full py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                Switch to Manager
              </button>
            </div>

            <div className={`p-4 rounded-xl border ${currentRole === 'AE Member' ? 'border-[#008C95] bg-[#E6F4F5]/30 ring-2 ring-[#008C95]/20' : 'border-slate-200 bg-slate-50'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-900">AE Member</span>
                {currentRole === 'AE Member' && <span className="text-[10px] bg-[#008C95] text-white px-2 py-0.5 rounded font-bold">Active</span>}
              </div>
              <p className="text-xs text-slate-500 mb-4">
                Operational dashboards, student search, scheduling conductance, and center-level views.
              </p>
              <button
                onClick={() => onRoleChange('AE Member')}
                className="w-full py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                Switch to Member
              </button>
            </div>

            <div className={`p-4 rounded-xl border ${currentRole === 'Viewer' ? 'border-[#008C95] bg-[#E6F4F5]/30 ring-2 ring-[#008C95]/20' : 'border-slate-200 bg-slate-50'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-900">External Viewer</span>
                {currentRole === 'Viewer' && <span className="text-[10px] bg-[#008C95] text-white px-2 py-0.5 rounded font-bold">Active</span>}
              </div>
              <p className="text-xs text-slate-500 mb-4">
                Read-only executive analytics and scheduling dashboards. System management and upload controls are hidden.
              </p>
              <button
                onClick={() => onRoleChange('Viewer')}
                className="w-full py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                Switch to Viewer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
