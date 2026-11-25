import React, { useState, useEffect } from 'react';
import {
  Settings2,
  Save,
  CheckCircle2,
  Sliders,
  AlertTriangle,
  Info,
  RotateCcw,
  Trash2,
  Database,
  RefreshCw,
  History,
  Download,
  Plus,
  HardDrive,
  Clock,
  ShieldCheck,
  FileText,
  Layers,
  ArrowRight,
  Server,
  Copy,
  Check,
  Eye,
  EyeOff,
  Terminal,
  ArrowRightLeft,
  Wifi,
  WifiOff,
  Code
} from 'lucide-react';
import { api } from '../api';
import {
  OperationalSettings,
  RestorePoint,
  DatabaseStatus,
  MysqlConfigInput,
  ConnectionTestResult,
  MigrationResult
} from '../types';

interface SettingsViewProps {
  onSettingsSaved: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onSettingsSaved }) => {
  const [settings, setSettings] = useState<OperationalSettings>({
    attendanceThreshold: 0.75,
    completionThreshold: 0.80,
    batchDelayThresholdDays: 0,
    dropoutAlertThreshold: 0.15,
    enableFacultyDeploymentIndex: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Restore Points State
  const [restorePoints, setRestorePoints] = useState<RestorePoint[]>([]);
  const [loadingPoints, setLoadingPoints] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPointName, setNewPointName] = useState('');
  const [newPointDesc, setNewPointDesc] = useState('');
  const [creatingPoint, setCreatingPoint] = useState(false);
  const [pointToRestore, setPointToRestore] = useState<RestorePoint | null>(null);
  const [restoringPoint, setRestoringPoint] = useState(false);
  const [pointToDelete, setPointToDelete] = useState<RestorePoint | null>(null);
  const [deletingPoint, setDeletingPoint] = useState(false);

  // Database & MySQL Management State
  const [dbStatus, setDbStatus] = useState<DatabaseStatus | null>(null);
  const [loadingDbStatus, setLoadingDbStatus] = useState(false);
  const [mysqlForm, setMysqlForm] = useState<MysqlConfigInput>({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: '',
    database: 'ae_insight',
    ssl: false,
    connectionLimit: 10,
    switchToMysql: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const [savingMysql, setSavingMysql] = useState(false);
  const [switchingEngine, setSwitchingEngine] = useState(false);
  const [migratingData, setMigratingData] = useState(false);
  const [syncingFromMysql, setSyncingFromMysql] = useState(false);
  const [migrationResult, setMigrationResult] = useState<MigrationResult | null>(null);
  const [showSchemaModal, setShowSchemaModal] = useState(false);
  const [schemaCode, setSchemaCode] = useState('');
  const [loadingSchema, setLoadingSchema] = useState(false);
  const [copiedSchema, setCopiedSchema] = useState(false);

  useEffect(() => {
    loadSettings();
    loadRestorePoints();
    loadDatabaseStatus();
  }, []);

  const loadDatabaseStatus = async () => {
    setLoadingDbStatus(true);
    try {
      const status = await api.getDatabaseStatus();
      setDbStatus(status);
      if (status.mysqlConfig) {
        setMysqlForm(prev => ({
          ...prev,
          host: status.mysqlConfig.host || 'localhost',
          port: status.mysqlConfig.port || 3306,
          user: status.mysqlConfig.user || 'root',
          database: status.mysqlConfig.database || 'ae_insight',
          ssl: Boolean(status.mysqlConfig.ssl),
          connectionLimit: status.mysqlConfig.connectionLimit || 10,
        }));
      }
    } catch (err) {
      console.error('Failed to load database status:', err);
    } finally {
      setLoadingDbStatus(false);
    }
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setTestResult(null);
    try {
      const result = await api.testMysqlConnection(mysqlForm);
      setTestResult(result);
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Connection test failed',
        latencyMs: 0,
        error: err.message,
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSaveMysqlConfig = async (andSwitch: boolean) => {
    setSavingMysql(true);
    try {
      const res = await api.updateDatabaseConfig({
        ...mysqlForm,
        switchToMysql: andSwitch,
      });
      setActionMessage({
        type: 'success',
        text: `MySQL configuration saved successfully! Active engine: ${res.activeEngine.toUpperCase()}`,
      });
      await loadDatabaseStatus();
      onSettingsSaved();
    } catch (err: any) {
      setActionMessage({
        type: 'error',
        text: `Failed to save MySQL configuration: ${err.message}`,
      });
    } finally {
      setSavingMysql(false);
    }
  };

  const handleSwitchEngine = async (engine: 'sqlite' | 'mysql') => {
    setSwitchingEngine(true);
    try {
      await api.switchDatabaseEngine(engine);
      setActionMessage({
        type: 'success',
        text: `Switched active database engine to ${engine.toUpperCase()}`,
      });
      await loadDatabaseStatus();
      onSettingsSaved();
    } catch (err: any) {
      setActionMessage({
        type: 'error',
        text: `Engine switch failed: ${err.message}`,
      });
    } finally {
      setSwitchingEngine(false);
    }
  };

  const handleMigrateToMysql = async () => {
    setMigratingData(true);
    setMigrationResult(null);
    try {
      const result = await api.migrateToMysql();
      setMigrationResult(result);
      setActionMessage({
        type: 'success',
        text: result.message,
      });
      await loadDatabaseStatus();
    } catch (err: any) {
      setActionMessage({
        type: 'error',
        text: `Migration failed: ${err.message}`,
      });
    } finally {
      setMigratingData(false);
    }
  };

  const handleSyncFromMysql = async () => {
    setSyncingFromMysql(true);
    try {
      const result = await api.syncFromMysql();
      setActionMessage({
        type: 'success',
        text: result.message,
      });
      await loadDatabaseStatus();
    } catch (err: any) {
      setActionMessage({
        type: 'error',
        text: `Sync failed: ${err.message}`,
      });
    } finally {
      setSyncingFromMysql(false);
    }
  };

  const handleOpenSchemaModal = async () => {
    setShowSchemaModal(true);
    if (!schemaCode) {
      setLoadingSchema(true);
      try {
        const res = await api.getDatabaseSchema();
        setSchemaCode(res.schema);
      } catch (err: any) {
        setSchemaCode('-- Error loading schema: ' + err.message);
      } finally {
        setLoadingSchema(false);
      }
    }
  };

  const handleCopySchema = () => {
    if (!schemaCode) return;
    navigator.clipboard.writeText(schemaCode);
    setCopiedSchema(true);
    setTimeout(() => setCopiedSchema(false), 2500);
  };

  const handleDownloadSchema = () => {
    if (!schemaCode) return;
    const blob = new Blob([schemaCode], { type: 'text/sql' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mysql_schema.sql';
    a.click();
    URL.revokeObjectURL(url);
  };

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await api.getSettings();
      setSettings(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadRestorePoints = async () => {
    setLoadingPoints(true);
    try {
      const list = await api.getRestorePoints();
      setRestorePoints(list);
    } catch (err) {
      console.error('Failed to load restore points:', err);
    } finally {
      setLoadingPoints(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateSettings(settings);
      setSavedSuccess(true);
      onSettingsSaved();
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleClearAllData = async () => {
    setActionLoading(true);
    try {
      await api.clearAllData();
      setActionMessage({ type: 'success', text: 'All sample and operational records have been permanently cleared from the portal.' });
      setShowClearConfirm(false);
      onSettingsSaved();
      await loadRestorePoints();
      setTimeout(() => setActionMessage(null), 5000);
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to clear data' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleSeedSampleData = async () => {
    setActionLoading(true);
    try {
      await api.seedSampleData();
      setActionMessage({ type: 'success', text: 'Sample Anudip operational dataset loaded into the portal.' });
      onSettingsSaved();
      setTimeout(() => setActionMessage(null), 5000);
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to load sample data' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateRestorePoint = async () => {
    setCreatingPoint(true);
    try {
      const res = await api.createRestorePoint({
        name: newPointName.trim() || undefined,
        description: newPointDesc.trim() || undefined,
        userEmail: 'aedevelopments@anudip.org',
      });
      setShowCreateModal(false);
      setNewPointName('');
      setNewPointDesc('');
      setActionMessage({
        type: 'success',
        text: `Restore point "${res.point.name}" created successfully with ${res.point.recordCount?.toLocaleString() || 0} records!`,
      });
      await loadRestorePoints();
      setTimeout(() => setActionMessage(null), 6000);
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to create restore point' });
    } finally {
      setCreatingPoint(false);
    }
  };

  const handleQuickCreateSnapshot = async () => {
    setActionLoading(true);
    try {
      const now = new Date();
      const res = await api.createRestorePoint({
        name: `Instant Checkpoint (${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`,
        description: `Manual quick restore point created from System Settings`,
        userEmail: 'aedevelopments@anudip.org',
      });
      setActionMessage({
        type: 'success',
        text: `Instant restore point "${res.point.name}" saved (${res.point.recordCount?.toLocaleString() || 0} records)!`,
      });
      await loadRestorePoints();
      setTimeout(() => setActionMessage(null), 6000);
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to create instant restore point' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleExecuteRestore = async () => {
    if (!pointToRestore) return;
    setRestoringPoint(true);
    try {
      const res = await api.restoreFromPoint(pointToRestore.id, 'aedevelopments@anudip.org');
      setPointToRestore(null);
      setActionMessage({
        type: 'success',
        text: `Database successfully reverted to "${res.restoredPoint.name}". Total active records: ${res.recordCount.toLocaleString()}.`,
      });
      onSettingsSaved();
      await loadRestorePoints();
      setTimeout(() => setActionMessage(null), 8000);
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to restore database from point' });
    } finally {
      setRestoringPoint(false);
    }
  };

  const handleExecuteDelete = async () => {
    if (!pointToDelete) return;
    setDeletingPoint(true);
    try {
      await api.deleteRestorePoint(pointToDelete.id, 'aedevelopments@anudip.org');
      setPointToDelete(null);
      setActionMessage({
        type: 'success',
        text: `Restore point "${pointToDelete.name}" deleted.`,
      });
      await loadRestorePoints();
      setTimeout(() => setActionMessage(null), 5000);
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to delete restore point' });
    } finally {
      setDeletingPoint(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-xs text-slate-500">
        <div className="animate-spin w-6 h-6 border-2 border-[#008C95] border-t-transparent rounded-full mx-auto mb-2" />
        Loading Operational Settings...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">Operational Configuration &amp; Governance</h2>
          <p className="text-xs text-slate-500">
            Configure dynamic KPI thresholds and manage system restore points and database integrity
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleQuickCreateSnapshot}
            disabled={actionLoading}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            title="Create an instant snapshot of current records"
          >
            <History className="w-3.5 h-3.5 text-[#008C95]" />
            <span>Quick Restore Point</span>
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#008C95] hover:bg-[#00747C] disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Saving...' : 'Save Configuration'}</span>
          </button>
        </div>
      </div>

      {savedSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>Operational thresholds updated and applied across all analytics dashboards!</span>
        </div>
      )}

      {actionMessage && (
        <div
          className={`p-3 border rounded-xl text-xs flex items-center gap-2 ${
            actionMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {actionMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span className="flex-1">{actionMessage.text}</span>
          <button
            onClick={() => setActionMessage(null)}
            className="text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* SECTION: SYSTEM RESTORE POINTS & SNAPSHOTS */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#E6F4F5] text-[#008C95] flex items-center justify-center font-bold">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">System Restore Points &amp; Database Snapshots</h3>
                <span className="px-2 py-0.5 text-[10px] font-bold bg-[#E6F4F5] text-[#005F66] rounded-full">
                  {restorePoints.length} Saved {restorePoints.length === 1 ? 'Point' : 'Points'}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Create point-in-time database snapshots to safely preserve current records, revert after test imports, or download offline backups.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const now = new Date();
                setNewPointName(`Restore Point - ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`);
                setNewPointDesc('Manual operational checkpoint before modifications');
                setShowCreateModal(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#008C95] hover:bg-[#00747C] text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Restore Point</span>
            </button>
            <button
              onClick={loadRestorePoints}
              disabled={loadingPoints}
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              title="Refresh restore points list"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingPoints ? 'animate-spin text-[#008C95]' : ''}`} />
            </button>
          </div>
        </div>

        {/* Restore Points List */}
        {loadingPoints && restorePoints.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            <div className="animate-spin w-5 h-5 border-2 border-[#008C95] border-t-transparent rounded-full mx-auto mb-2" />
            Loading saved restore points...
          </div>
        ) : restorePoints.length === 0 ? (
          <div className="p-8 text-center bg-slate-50/70 border border-dashed border-slate-200 rounded-xl space-y-2">
            <HardDrive className="w-8 h-8 text-slate-300 mx-auto" />
            <div className="text-xs font-bold text-slate-700">No restore points created yet</div>
            <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
              Create your first restore point to safely back up your active dataset. You can rollback to this exact state at any time.
            </p>
            <button
              onClick={() => {
                const now = new Date();
                setNewPointName(`Baseline Checkpoint - ${now.toLocaleDateString()}`);
                setNewPointDesc('Initial baseline dataset checkpoint');
                setShowCreateModal(true);
              }}
              className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#008C95] hover:bg-[#00747C] text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Baseline Restore Point</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-200/70 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3.5">Restore Point</th>
                  <th className="py-2.5 px-3.5">Created At</th>
                  <th className="py-2.5 px-3.5 text-center">Records</th>
                  <th className="py-2.5 px-3.5 text-center">Batches</th>
                  <th className="py-2.5 px-3.5 text-right">Size</th>
                  <th className="py-2.5 px-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {restorePoints.map((point, idx) => {
                  const isBaseline = point.isBaseline || idx === restorePoints.length - 1;
                  const isAuto = point.name.toLowerCase().includes('auto') || point.name.toLowerCase().includes('safety');
                  return (
                    <tr key={point.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-3.5">
                        <div className="flex items-start gap-2.5">
                          <div className={`mt-0.5 p-1.5 rounded-lg shrink-0 ${
                            isBaseline
                              ? 'bg-emerald-50 text-emerald-700'
                              : isAuto
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-cyan-50 text-[#008C95]'
                          }`}>
                            <HardDrive className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-slate-900">{point.name}</span>
                              {isBaseline && (
                                <span className="px-1.5 py-0.2 text-[9px] font-bold bg-emerald-100 text-emerald-800 rounded">
                                  Baseline
                                </span>
                              )}
                              {isAuto && (
                                <span className="px-1.5 py-0.2 text-[9px] font-bold bg-amber-100 text-amber-800 rounded">
                                  Pre-Restore Safety
                                </span>
                              )}
                            </div>
                            {point.description && (
                              <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{point.description}</p>
                            )}
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                              ID: {point.id} · By: {point.createdBy || 'Admin'}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3.5 text-slate-600 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>
                            {new Date(point.createdAt).toLocaleString('en-US', {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-3.5 text-center font-mono font-semibold text-slate-800 whitespace-nowrap">
                        <span className="px-2 py-0.5 bg-slate-100 rounded-md">
                          {point.recordCount?.toLocaleString() || 0}
                        </span>
                      </td>

                      <td className="py-3 px-3.5 text-center font-mono text-slate-600 whitespace-nowrap">
                        {point.batchCount?.toLocaleString() || 0}
                      </td>

                      <td className="py-3 px-3.5 text-right font-mono text-slate-500 whitespace-nowrap">
                        {point.fileSizeFormatted}
                      </td>

                      <td className="py-3 px-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Revert / Restore */}
                          <button
                            onClick={() => setPointToRestore(point)}
                            className="flex items-center gap-1 px-2.5 py-1 bg-cyan-50 hover:bg-cyan-100 text-[#00747C] border border-[#008C95]/20 rounded-md font-semibold text-xs transition-colors cursor-pointer"
                            title={`Revert current database back to this restore point`}
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Restore</span>
                          </button>

                          {/* Download Backup */}
                          <a
                            href={api.getRestorePointDownloadUrl(point.id)}
                            download
                            className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
                            title="Download raw SQLite snapshot for offline backup"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>

                          {/* Delete */}
                          <button
                            onClick={() => setPointToDelete(point)}
                            className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                            title="Delete this restore point"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Thresholds Form */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-6 text-xs">
        <div className="border-b border-slate-100 pb-3">
          <h3 className="text-sm font-bold text-slate-900">Operational KPI Thresholds</h3>
          <p className="text-xs text-slate-500">
            Define dynamic organizational KPI thresholds without modifying core code
          </p>
        </div>

        {/* 1. Attendance Threshold */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <div>
              <label className="font-bold text-slate-900">Attendance Attention Threshold</label>
              <p className="text-[11px] text-slate-500">
                Flags students whose running attendance falls below this percentage in the "Attention Areas" widget.
              </p>
            </div>
            <span className="font-mono font-bold text-[#008C95] text-sm">
              {(settings.attendanceThreshold * 100).toFixed(0)}%
            </span>
          </div>
          <input
            type="range"
            min="0.50"
            max="0.95"
            step="0.05"
            value={settings.attendanceThreshold}
            onChange={(e) =>
              setSettings({ ...settings, attendanceThreshold: parseFloat(e.target.value) })
            }
            className="w-full accent-[#008C95]"
          />
        </div>

        {/* 2. Completion Threshold */}
        <div className="space-y-2 pt-4 border-t border-slate-100">
          <div className="flex justify-between items-center">
            <div>
              <label className="font-bold text-slate-900">Module Completion Threshold</label>
              <p className="text-[11px] text-slate-500">
                Flags batches and students whose ILT or FM module completion is below this standard.
              </p>
            </div>
            <span className="font-mono font-bold text-[#008C95] text-sm">
              {(settings.completionThreshold * 100).toFixed(0)}%
            </span>
          </div>
          <input
            type="range"
            min="0.50"
            max="0.95"
            step="0.05"
            value={settings.completionThreshold}
            onChange={(e) =>
              setSettings({ ...settings, completionThreshold: parseFloat(e.target.value) })
            }
            className="w-full accent-[#008C95]"
          />
        </div>

        {/* 3. Batch Delay Threshold */}
        <div className="space-y-2 pt-4 border-t border-slate-100">
          <div className="flex justify-between items-center">
            <div>
              <label className="font-bold text-slate-900">Batch Delay Days Tolerance</label>
              <p className="text-[11px] text-slate-500">
                Grace period (in days) before a completed batch is categorized as "Delayed".
              </p>
            </div>
            <span className="font-mono font-bold text-[#008C95] text-sm">
              {settings.batchDelayThresholdDays} Days
            </span>
          </div>
          <input
            type="number"
            min="0"
            max="30"
            value={settings.batchDelayThresholdDays}
            onChange={(e) =>
              setSettings({ ...settings, batchDelayThresholdDays: parseInt(e.target.value) || 0 })
            }
            className="w-32 bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-slate-800 font-mono"
          />
        </div>

        {/* 4. Dropout Alert Threshold */}
        <div className="space-y-2 pt-4 border-t border-slate-100">
          <div className="flex justify-between items-center">
            <div>
              <label className="font-bold text-slate-900">Dropout Rate Alert Threshold</label>
              <p className="text-[11px] text-slate-500">
                Centers with dropout rates exceeding this limit are highlighted in red alert states.
              </p>
            </div>
            <span className="font-mono font-bold text-rose-600 text-sm">
              {(settings.dropoutAlertThreshold * 100).toFixed(0)}%
            </span>
          </div>
          <input
            type="range"
            min="0.05"
            max="0.30"
            step="0.01"
            value={settings.dropoutAlertThreshold}
            onChange={(e) =>
              setSettings({ ...settings, dropoutAlertThreshold: parseFloat(e.target.value) })
            }
            className="w-full accent-rose-500"
          />
        </div>

        {/* 5. Faculty Deployment Index Proxy Toggle */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
          <div>
            <label className="font-bold text-slate-900">Enable Faculty Deployment Index (Proxy)</label>
            <p className="text-[11px] text-slate-500">
              Shows the analytical allocation proxy score in Faculty Analytics until actual working hours become available.
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.enableFacultyDeploymentIndex}
              onChange={(e) =>
                setSettings({ ...settings, enableFacultyDeploymentIndex: e.target.checked })
              }
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#008C95]"></div>
          </label>
        </div>
      </div>

      {/* SECTION: MYSQL DATABASE BACKEND CONFIGURATION */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">MySQL Database Backend Configuration</h3>
                <span className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full flex items-center gap-1 ${
                  dbStatus?.activeEngine === 'mysql'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-slate-100 text-slate-700 border border-slate-200'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${dbStatus?.activeEngine === 'mysql' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></span>
                  Active Engine: {dbStatus?.activeEngine === 'mysql' ? 'MySQL' : 'SQLite'}
                </span>
                {dbStatus?.activeEngine === 'mysql' && dbStatus?.latencyMs !== undefined && (
                  <span className="text-[11px] font-mono text-slate-500">
                    ({dbStatus.latencyMs}ms ping)
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Connect external MySQL, AWS RDS, or Google Cloud SQL for high-throughput enterprise persistence, or run on local SQLite.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleOpenSchemaModal}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer border border-slate-200"
              title="View and copy the full MySQL SQL DDL statements"
            >
              <Code className="w-3.5 h-3.5 text-blue-600" />
              <span>View MySQL Schema SQL</span>
            </button>

            {dbStatus?.activeEngine === 'sqlite' ? (
              <button
                onClick={() => handleSwitchEngine('mysql')}
                disabled={switchingEngine}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                <ArrowRightLeft className={`w-3.5 h-3.5 ${switchingEngine ? 'animate-spin' : ''}`} />
                <span>Switch to MySQL</span>
              </button>
            ) : (
              <button
                onClick={() => handleSwitchEngine('sqlite')}
                disabled={switchingEngine}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${switchingEngine ? 'animate-spin' : ''}`} />
                <span>Switch to SQLite</span>
              </button>
            )}

            <button
              onClick={loadDatabaseStatus}
              disabled={loadingDbStatus}
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              title="Refresh database connection status"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingDbStatus ? 'animate-spin text-blue-600' : ''}`} />
            </button>
          </div>
        </div>

        {/* Database Metrics Stats Card */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/60">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Active Records</div>
            <div className="text-lg font-bold font-mono text-slate-800 mt-0.5">
              {(dbStatus?.activeRecordCount ?? 0).toLocaleString()}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              Live queries run against {dbStatus?.activeEngine?.toUpperCase()}
            </div>
          </div>

          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/60">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">SQLite Local Records</div>
            <div className="text-lg font-bold font-mono text-slate-800 mt-0.5">
              {(dbStatus?.sqliteRecordCount ?? 0).toLocaleString()}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Stored in database.sqlite disk file</div>
          </div>

          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/60">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">MySQL Server Status</div>
            <div className="text-lg font-bold font-mono text-slate-800 mt-0.5 flex items-center gap-1.5">
              {dbStatus?.isConnected ? (
                <>
                  <Wifi className="w-4 h-4 text-emerald-500" />
                  <span className="text-emerald-700 text-sm">
                    {dbStatus.mysqlRecordCount !== null ? `${dbStatus.mysqlRecordCount.toLocaleString()} Rows` : 'Connected'}
                  </span>
                </>
              ) : (
                <>
                  <WifiOff className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-500 text-xs">Unconnected</span>
                </>
              )}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              {dbStatus?.mysqlConfig?.database || 'ae_insight'} on {dbStatus?.mysqlConfig?.host || 'localhost'}:{dbStatus?.mysqlConfig?.port || 3306}
            </div>
          </div>
        </div>

        {/* MySQL Configuration Form */}
        <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/70 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-blue-600" />
              MySQL Connection Parameters
            </span>
            <span className="text-[11px] text-slate-500">
              Also configurable via environment variables in <code className="bg-slate-200/70 px-1 py-0.5 rounded text-[10px]">.env</code>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            {/* Host */}
            <div>
              <label className="font-bold text-slate-700 block mb-1">Host / Server IP</label>
              <input
                type="text"
                value={mysqlForm.host}
                onChange={(e) => setMysqlForm({ ...mysqlForm, host: e.target.value })}
                placeholder="e.g. localhost, 127.0.0.1, or RDS endpoint"
                className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 font-mono focus:outline-hidden focus:border-blue-500"
              />
            </div>

            {/* Port */}
            <div>
              <label className="font-bold text-slate-700 block mb-1">Port</label>
              <input
                type="number"
                value={mysqlForm.port}
                onChange={(e) => setMysqlForm({ ...mysqlForm, port: parseInt(e.target.value) || 3306 })}
                placeholder="3306"
                className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 font-mono focus:outline-hidden focus:border-blue-500"
              />
            </div>

            {/* Database Name */}
            <div>
              <label className="font-bold text-slate-700 block mb-1">Database Name</label>
              <input
                type="text"
                value={mysqlForm.database}
                onChange={(e) => setMysqlForm({ ...mysqlForm, database: e.target.value })}
                placeholder="ae_insight"
                className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 font-mono focus:outline-hidden focus:border-blue-500"
              />
            </div>

            {/* Username */}
            <div>
              <label className="font-bold text-slate-700 block mb-1">Username</label>
              <input
                type="text"
                value={mysqlForm.user}
                onChange={(e) => setMysqlForm({ ...mysqlForm, user: e.target.value })}
                placeholder="root"
                className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 font-mono focus:outline-hidden focus:border-blue-500"
              />
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-bold text-slate-700">Password</label>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-[11px] text-blue-600 hover:underline flex items-center gap-0.5 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={mysqlForm.password}
                onChange={(e) => setMysqlForm({ ...mysqlForm, password: e.target.value })}
                placeholder="Enter MySQL password"
                className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 font-mono focus:outline-hidden focus:border-blue-500"
              />
            </div>

            {/* Pool Limit & SSL */}
            <div className="flex items-center gap-4 pt-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={mysqlForm.ssl}
                  onChange={(e) => setMysqlForm({ ...mysqlForm, ssl: e.target.checked })}
                  className="accent-blue-600 w-4 h-4 rounded cursor-pointer"
                />
                <span className="font-semibold text-slate-700 text-xs">Enable SSL</span>
              </label>
            </div>
          </div>

          {/* Test Result Message Box */}
          {testResult && (
            <div className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 ${
              testResult.success
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}>
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <div className="font-bold">{testResult.message}</div>
                {testResult.success && (
                  <div className="text-[11px] text-emerald-700 flex items-center gap-3">
                    <span>Round-trip latency: <b>{testResult.latencyMs}ms</b></span>
                    <span>•</span>
                    <span>Tables detected: <b>{testResult.tables?.length || 0} / 6</b></span>
                    <span>•</span>
                    <span>{testResult.hasAllTables ? 'All tables present' : 'Some tables missing (will auto-create)'}</span>
                  </div>
                )}
                {testResult.error && (
                  <div className="text-[11px] font-mono text-rose-600">Error: {testResult.error}</div>
                )}
              </div>
            </div>
          )}

          {/* Form Actions */}
          <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-slate-200/60">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testingConnection}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                <Wifi className={`w-3.5 h-3.5 ${testingConnection ? 'animate-pulse text-blue-600' : ''}`} />
                <span>{testingConnection ? 'Testing...' : 'Test Connection'}</span>
              </button>

              <button
                type="button"
                onClick={() => handleSaveMysqlConfig(true)}
                disabled={savingMysql}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{savingMysql ? 'Saving & Connecting...' : 'Save & Connect to MySQL'}</span>
              </button>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Sync Live Data Button */}
              <button
                type="button"
                onClick={handleSyncFromMysql}
                disabled={syncingFromMysql}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#008C95] hover:bg-[#00747C] text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
                title="Synchronize records from MySQL into the live analytics engine"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncingFromMysql ? 'animate-spin' : ''}`} />
                <span>{syncingFromMysql ? 'Syncing...' : 'Sync Live Data from MySQL'}</span>
              </button>

              {/* Migrate Data Button */}
              <button
                type="button"
                onClick={handleMigrateToMysql}
                disabled={migratingData}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
                title="Copy all existing records from SQLite into the MySQL database"
              >
                <Database className={`w-3.5 h-3.5 ${migratingData ? 'animate-spin' : ''}`} />
                <span>{migratingData ? 'Migrating Records...' : 'Migrate SQLite Data to MySQL'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Data Management & Database Control */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
          <Database className="w-4 h-4 text-[#008C95]" />
          <h3>Database &amp; Storage Maintenance</h3>
        </div>
        <p className="text-xs text-slate-500">
          Manage stored records, wipe uploaded data for fresh real imports, or load sample benchmarking data.
        </p>

        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/60 flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="font-bold text-xs text-slate-900">Clear All Portal Data</div>
            <div className="text-[11px] text-slate-500">
              Removes all student records, batch metrics, and uploaded files from the database.
            </div>
          </div>
          <button
            onClick={() => setShowClearConfirm(true)}
            disabled={actionLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
            <span>Clear Portal Data</span>
          </button>
        </div>

        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/60 flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="font-bold text-xs text-slate-900">Load Anudip Sample Dataset</div>
            <div className="text-[11px] text-slate-500">
              Populate 2,480 representative Anudip operational records across 85 batches for demonstrations.
            </div>
          </div>
          <button
            onClick={handleSeedSampleData}
            disabled={actionLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-bold transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Load Sample Data</span>
          </button>
        </div>
      </div>

      {/* MODAL: Create Restore Point */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 border border-slate-200 shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-[#E6F4F5] rounded-xl text-[#008C95]">
                <HardDrive className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Create System Restore Point</h3>
                <p className="text-xs text-slate-500">Snapshot the live database and all active records</p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Restore Point Name</label>
                <input
                  type="text"
                  value={newPointName}
                  onChange={(e) => setNewPointName(e.target.value)}
                  placeholder="e.g. Pre-Upload Baseline Checkpoint"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 font-medium focus:outline-hidden focus:border-[#008C95]"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Description / Notes (Optional)</label>
                <textarea
                  value={newPointDesc}
                  onChange={(e) => setNewPointDesc(e.target.value)}
                  rows={3}
                  placeholder="Add context on why this restore point was created..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-hidden focus:border-[#008C95]"
                />
              </div>

              <div className="p-3 bg-cyan-50/70 border border-cyan-100 rounded-xl text-[11px] text-cyan-900 flex items-start gap-2">
                <Info className="w-4 h-4 text-[#008C95] shrink-0 mt-0.5" />
                <span>
                  This snapshot captures all operational student records, batch metrics, and configurations currently loaded. You can rollback to this exact state at any time.
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowCreateModal(false)}
                disabled={creatingPoint}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateRestorePoint}
                disabled={creatingPoint}
                className="px-4 py-1.5 bg-[#008C95] hover:bg-[#00747C] text-white text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                {creatingPoint ? (
                  <>
                    <div className="animate-spin w-3 h-3 border-2 border-white border-t-transparent rounded-full" />
                    <span>Saving Snapshot...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Create Snapshot</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Confirm Restore */}
      {pointToRestore && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 border border-slate-200 shadow-xl space-y-4">
            <div className="flex items-center gap-3 text-amber-600">
              <div className="p-2.5 bg-amber-100 rounded-xl">
                <RotateCcw className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Restore Database to Checkpoint</h3>
                <p className="text-xs text-slate-500">Rollback operational records</p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-slate-600">
              <p className="leading-relaxed">
                You are about to revert the platform database to the restore point:
              </p>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                <div className="font-bold text-slate-900 text-sm">{pointToRestore.name}</div>
                {pointToRestore.description && (
                  <p className="text-[11px] text-slate-500">{pointToRestore.description}</p>
                )}
                <div className="flex items-center gap-3 text-[11px] text-slate-600 pt-1 font-mono">
                  <span>Records: <strong>{pointToRestore.recordCount?.toLocaleString() || 0}</strong></span>
                  <span>·</span>
                  <span>Batches: <strong>{pointToRestore.batchCount?.toLocaleString() || 0}</strong></span>
                  <span>·</span>
                  <span>Size: <strong>{pointToRestore.fileSizeFormatted}</strong></span>
                </div>
              </div>

              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] text-emerald-900 flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Safety guarantee:</strong> A safety restore point of your current live database will be created automatically before reverting so nothing is lost.
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setPointToRestore(null)}
                disabled={restoringPoint}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteRestore}
                disabled={restoringPoint}
                className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
              >
                {restoringPoint ? (
                  <>
                    <div className="animate-spin w-3 h-3 border-2 border-white border-t-transparent rounded-full" />
                    <span>Reverting Database...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Yes, Restore Now</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Confirm Delete */}
      {pointToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 border border-slate-200 shadow-xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2.5 bg-rose-100 rounded-xl">
                <Trash2 className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Delete Restore Point</h3>
                <p className="text-xs text-slate-500">Remove snapshot file from disk</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to remove the restore point <strong className="text-slate-900">"{pointToDelete.name}"</strong>? This will permanently delete this backup snapshot.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setPointToDelete(null)}
                disabled={deletingPoint}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteDelete}
                disabled={deletingPoint}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{deletingPoint ? 'Deleting...' : 'Delete Restore Point'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Confirm Clear All Data */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 border border-slate-200 shadow-xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2.5 bg-rose-100 rounded-xl">
                <AlertTriangle className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Confirm Portal Data Removal</h3>
                <p className="text-xs text-slate-500">This action will clear all records</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to remove all operational records and upload histories from the portal? The platform will return to a clean state ready for your real Excel dataset.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleClearAllData}
                disabled={actionLoading}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{actionLoading ? 'Clearing...' : 'Yes, Clear All Data'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: MySQL Schema Code Viewer & Downloader */}
      {showSchemaModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 border border-slate-200 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                  <Code className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">MySQL Database Schema (DDL)</h3>
                  <p className="text-xs text-slate-500">
                    Complete schema code to create all 6 tables, primary keys, and indexes
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopySchema}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold transition-colors cursor-pointer border border-blue-200"
                >
                  {copiedSchema ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedSchema ? 'Copied to Clipboard!' : 'Copy SQL Code'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadSchema}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer border border-slate-200"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .sql</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowSchemaModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 font-mono text-[11px] bg-slate-950 text-slate-200 p-4 rounded-xl border border-slate-800 space-y-1 select-all">
              {loadingSchema ? (
                <div className="text-center py-12 text-slate-400">Loading schema script...</div>
              ) : (
                <pre className="whitespace-pre-wrap font-mono leading-relaxed">{schemaCode}</pre>
              )}
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100 shrink-0">
              <span>
                Compatible with MySQL 5.7+, 8.0+, MariaDB 10.3+, Google Cloud SQL, and AWS RDS (InnoDB, UTF-8 MB4)
              </span>
              <button
                type="button"
                onClick={() => setShowSchemaModal(false)}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-lg transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
