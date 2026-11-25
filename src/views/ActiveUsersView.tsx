import React, { useState } from 'react';
import {
  Users,
  Radio,
  Mail,
  Monitor,
  Shield,
  Clock,
  RefreshCw,
  CheckCircle2,
  Edit3,
  Globe,
  Sparkles,
  Activity,
  Laptop,
  UserCheck,
  Search,
  Maximize2,
  X,
} from 'lucide-react';
import { LivePresenceData, LiveUserPresenceItem } from '../types';
import { BrowserUserProfile, formatNameFromGmail } from '../utils/browserPresence';

interface ActiveUsersViewProps {
  presenceData: LivePresenceData | null;
  currentUserProfile: BrowserUserProfile;
  currentSessionId: string;
  onUpdateBrowserUser: (email: string, userName?: string) => void;
  onRefreshPresence: () => Promise<void>;
  isRefreshing?: boolean;
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds < 5) return 'Just started';
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins < 60) return `${mins}m ${secs}s`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hrs}h ${remMins}m`;
}

function formatPingAgo(seconds: number): string {
  if (seconds <= 3) return 'Just now (Live)';
  if (seconds < 60) return `${seconds}s ago`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

export const ActiveUsersView: React.FC<ActiveUsersViewProps> = ({
  presenceData,
  currentUserProfile,
  currentSessionId,
  onUpdateBrowserUser,
  onRefreshPresence,
  isRefreshing = false,
}) => {
  const [isEditingIdentity, setIsEditingIdentity] = useState(false);
  const [emailInput, setEmailInput] = useState(currentUserProfile.email);
  const [nameInput, setNameInput] = useState(currentUserProfile.userName);
  const [searchTerm, setSearchTerm] = useState('');
  const [isPresentationMode, setIsPresentationMode] = useState(false);

  const activeUsers: LiveUserPresenceItem[] = presenceData?.activeUsers || [];
  const recentUsers: LiveUserPresenceItem[] = presenceData?.recentUsers || [];

  // Deduplicate unique Gmail accounts currently online while also showing all live browser sessions
  const uniqueOnlineEmails = Array.from(new Set(activeUsers.map((u) => u.email.toLowerCase())));

  const filteredActiveUsers = activeUsers.filter((u) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      u.email.toLowerCase().includes(q) ||
      u.user_name.toLowerCase().includes(q) ||
      u.current_view_label.toLowerCase().includes(q) ||
      u.user_role.toLowerCase().includes(q) ||
      u.portal_mode.toLowerCase().includes(q)
    );
  });

  const handleSaveIdentity = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedEmail = emailInput.trim().toLowerCase();
    if (!cleanedEmail) return;
    const finalEmail = cleanedEmail.includes('@') ? cleanedEmail : `${cleanedEmail}@gmail.com`;
    const finalName = nameInput.trim() || formatNameFromGmail(finalEmail);
    onUpdateBrowserUser(finalEmail, finalName);
    setIsEditingIdentity(false);
  };

  const renderContent = (inModal = false) => (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs relative overflow-hidden">
        <div className="absolute top-0 right-0 w-72 h-72 bg-gradient-to-bl from-teal-500/10 via-emerald-500/5 to-transparent rounded-full blur-2xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 relative z-10">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                <span className="w-2 h-2 rounded-full bg-emerald-500 -ml-3.5" />
                Live Telemetry Active
              </span>
              <span className="text-xs font-semibold text-slate-500">
                Intelligence &amp; Reports · Real-Time Browser Gmail Presence
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
              <Users className="w-6 h-6 text-[#008C95]" />
              Active Users Currently on Platform (Live)
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 max-w-3xl">
              Real-time visibility of users actively browsing AE INSIGHT across the Main Dashboard and Admin Portal, automatically identified via their logged-in browser Gmail session.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap shrink-0">
            <button
              onClick={() => {
                setEmailInput(currentUserProfile.email);
                setNameInput(currentUserProfile.userName);
                setIsEditingIdentity(!isEditingIdentity);
              }}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200/80 text-slate-800 border border-slate-200/80 transition-all cursor-pointer"
              title="Verify or switch your browser Gmail identity"
            >
              <Mail className="w-3.5 h-3.5 text-[#008C95]" />
              <span>Browser Gmail: {currentUserProfile.email}</span>
              <Edit3 className="w-3 h-3 text-slate-500" />
            </button>

            <button
              onClick={() => onRefreshPresence()}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-[#008C95] hover:bg-[#00747C] text-white shadow-xs transition-all cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Sync Now</span>
            </button>

            {!inModal && (
              <button
                onClick={() => setIsPresentationMode(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white shadow-xs transition-all cursor-pointer"
                title="Open in Presentation Mode"
              >
                <Maximize2 className="w-3.5 h-3.5 text-teal-400" />
                <span>Presentation Mode</span>
              </button>
            )}
          </div>
        </div>

        {/* Inline Browser Gmail Switcher / Confirmation Drawer */}
        {isEditingIdentity && (
          <form
            onSubmit={handleSaveIdentity}
            className="mt-4 pt-4 border-t border-slate-200/80 bg-slate-50/80 p-4 rounded-xl border flex flex-col sm:flex-row items-stretch sm:items-end gap-3 animate-in fade-in duration-150"
          >
            <div className="flex-1 space-y-1">
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                Logged-in Browser Gmail ID
              </label>
              <input
                type="email"
                required
                value={emailInput}
                onChange={(e) => {
                  setEmailInput(e.target.value);
                  if (!nameInput || nameInput === formatNameFromGmail(emailInput)) {
                    setNameInput(formatNameFromGmail(e.target.value));
                  }
                }}
                placeholder="yourname@gmail.com"
                className="w-full px-3 py-2 text-xs font-medium bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#008C95]"
              />
            </div>
            <div className="flex-1 space-y-1">
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                Display Name (Derived from Gmail)
              </label>
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Your Full Name"
                className="w-full px-3 py-2 text-xs font-medium bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#008C95]"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="px-4 py-2 bg-[#008C95] hover:bg-[#00747C] text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer"
              >
                Update Live Identity
              </button>
              <button
                type="button"
                onClick={() => setIsEditingIdentity(false)}
                className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-600 text-xs font-semibold rounded-lg border border-slate-200 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      {/* KPI Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Live Active Sessions
            </div>
            <div className="text-2xl font-extrabold text-slate-900 flex items-baseline gap-2">
              <span>{activeUsers.length}</span>
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                {uniqueOnlineEmails.length} Unique {uniqueOnlineEmails.length === 1 ? 'Gmail' : 'Gmails'}
              </span>
            </div>
            <div className="text-[11px] text-slate-500">
              Real-time browser heartbeats active
            </div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs flex items-center justify-between">
          <div className="space-y-1 min-w-0 pr-2">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Your Browser Gmail (Live)
            </div>
            <div className="text-sm font-extrabold text-slate-900 truncate" title={currentUserProfile.userName}>
              {currentUserProfile.userName}
            </div>
            <div className="text-xs font-mono font-semibold text-[#008C95] truncate" title={currentUserProfile.email}>
              {currentUserProfile.email}
            </div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-[#008C95] shrink-0">
            <UserCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Active Portals Breakdown
            </div>
            <div className="text-lg font-extrabold text-slate-900">
              {activeUsers.filter((u) => !u.portal_mode.toLowerCase().includes('admin')).length} Dashboard ·{' '}
              {activeUsers.filter((u) => u.portal_mode.toLowerCase().includes('admin')).length} Admin
            </div>
            <div className="text-[11px] text-slate-500">
              Synced across Shared &amp; Dev URLs
            </div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shrink-0">
            <Globe className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Last Telemetry Sync
            </div>
            <div className="text-lg font-extrabold text-slate-900">
              {presenceData?.serverTimestamp
                ? new Date(presenceData.serverTimestamp).toLocaleTimeString('en-IN', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })
                : 'Live'}
            </div>
            <div className="text-[11px] text-emerald-600 font-semibold">
              Auto-updating every 10 seconds
            </div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
            <Activity className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Live Active Users Cards & Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50/60">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
              Currently Active Users on Platform ({filteredActiveUsers.length})
            </h3>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter by Gmail, name, or tab..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#008C95]"
            />
          </div>
        </div>

        {/* Live Cards Grid */}
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredActiveUsers.map((user) => {
            const isCurrentSession = user.session_id === currentSessionId;
            const initials = (user.user_name || user.email || 'U')
              .split(/\s+/)
              .map((w) => w[0])
              .join('')
              .slice(0, 2)
              .toUpperCase();

            return (
              <div
                key={user.session_id}
                className={`rounded-xl border p-4 transition-all relative overflow-hidden ${
                  isCurrentSession
                    ? 'bg-gradient-to-br from-teal-50/70 via-white to-emerald-50/40 border-[#008C95]/50 shadow-xs ring-1 ring-[#008C95]/20'
                    : 'bg-white border-slate-200/90 hover:border-slate-300 shadow-2xs'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative shrink-0">
                      {user.avatar_url ? (
                        <img
                          src={user.avatar_url}
                          alt={user.user_name}
                          className="w-11 h-11 rounded-full object-cover border-2 border-emerald-400"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#008C95] to-teal-700 text-white font-extrabold text-sm flex items-center justify-center shadow-xs">
                          {initials}
                        </div>
                      )}
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${
                          user.status === 'online' ? 'bg-emerald-500' : 'bg-amber-400'
                        }`}
                        title={user.status === 'online' ? 'Live Now' : 'Idle'}
                      />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-extrabold text-slate-900 text-sm truncate">
                          {user.user_name}
                        </span>
                        {isCurrentSession && (
                          <span className="text-[10px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#008C95] text-white">
                            You (This Browser)
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-xs font-mono font-semibold text-[#00747C] truncate mt-0.5">
                        <Mail className="w-3 h-3 shrink-0" />
                        <span className="truncate" title={user.email}>
                          {user.email}
                        </span>
                      </div>
                    </div>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider shrink-0 ${
                      user.status === 'online'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-amber-100 text-amber-800 border border-amber-300'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        user.status === 'online' ? 'bg-emerald-600 animate-ping' : 'bg-amber-600'
                      }`}
                    />
                    {user.status === 'online' ? 'LIVE NOW' : 'IDLE'}
                  </span>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2.5 text-xs">
                  <div className="bg-slate-50/90 rounded-lg p-2 border border-slate-100">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Viewing Tab</div>
                    <div className="font-bold text-slate-800 truncate mt-0.5 flex items-center gap-1">
                      <Monitor className="w-3 h-3 text-[#008C95] shrink-0" />
                      <span className="truncate">{user.current_view_label}</span>
                    </div>
                  </div>

                  <div className="bg-slate-50/90 rounded-lg p-2 border border-slate-100">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Portal &amp; Role</div>
                    <div className="font-bold text-slate-800 truncate mt-0.5 flex items-center gap-1">
                      <Shield className="w-3 h-3 text-indigo-600 shrink-0" />
                      <span className="truncate">
                        {user.portal_mode.includes('Admin') ? 'Admin Portal' : 'Dashboard'} · {user.user_role}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
                  <div className="flex items-center gap-1.5 truncate">
                    <Laptop className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">
                      {user.browser_info} · {user.device_os}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 font-medium text-slate-600 shrink-0">
                    <Clock className="w-3 h-3 text-emerald-600" />
                    <span>{formatPingAgo(user.seconds_since_ping)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Detailed Live Sessions Table */}
        <div className="overflow-x-auto border-t border-slate-200/80">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold text-slate-600 uppercase tracking-wider">
                <th className="py-3 px-4">Live Status</th>
                <th className="py-3 px-4">User Name (Browser Gmail)</th>
                <th className="py-3 px-4">Logged-In Gmail ID</th>
                <th className="py-3 px-4">Active Module / View</th>
                <th className="py-3 px-4">Portal &amp; Role</th>
                <th className="py-3 px-4">Browser &amp; OS</th>
                <th className="py-3 px-4">Session Duration</th>
                <th className="py-3 px-4">Last Heartbeat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 text-xs">
              {filteredActiveUsers.map((u) => {
                const isMe = u.session_id === currentSessionId;
                return (
                  <tr
                    key={`row_${u.session_id}`}
                    className={isMe ? 'bg-teal-50/40 font-medium' : 'hover:bg-slate-50/80'}
                  >
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        {u.status === 'online' ? 'Online (Live)' : 'Idle'}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span>{u.user_name}</span>
                        {isMe && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#008C95]/15 text-[#005F66] font-extrabold">
                            Current Browser
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold text-[#00747C] whitespace-nowrap">
                      {u.email}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 font-bold">
                        {u.current_view_label}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-slate-700">
                      <span className="font-semibold">{u.portal_mode}</span>
                      <span className="text-slate-400 mx-1">·</span>
                      <span className="text-slate-600">{u.user_role}</span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-slate-600">
                      {u.browser_info} ({u.device_os})
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap font-mono text-slate-700">
                      {formatDuration(u.active_seconds)}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-emerald-700 font-semibold">
                      {formatPingAgo(u.seconds_since_ping)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recently Active Users (Offline / Closed Tab within Last 24h) */}
      {recentUsers.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200/80 bg-slate-50/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-500" />
              <h3 className="text-xs sm:text-sm font-extrabold text-slate-800 uppercase tracking-wider">
                Recently Active Browser Sessions (Last 24 Hours)
              </h3>
            </div>
            <span className="text-xs font-semibold text-slate-500">
              {recentUsers.length} recent {recentUsers.length === 1 ? 'session' : 'sessions'}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase">
                  <th className="py-2.5 px-4">User Name</th>
                  <th className="py-2.5 px-4">Logged-In Gmail</th>
                  <th className="py-2.5 px-4">Last Viewed Module</th>
                  <th className="py-2.5 px-4">Browser &amp; OS</th>
                  <th className="py-2.5 px-4">Last Active Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-600">
                {recentUsers.map((u) => (
                  <tr key={`recent_${u.session_id}`} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4 font-bold text-slate-800">{u.user_name}</td>
                    <td className="py-2.5 px-4 font-mono text-slate-700">{u.email}</td>
                    <td className="py-2.5 px-4">{u.current_view_label}</td>
                    <td className="py-2.5 px-4">
                      {u.browser_info} · {u.device_os}
                    </td>
                    <td className="py-2.5 px-4">
                      {new Date(u.last_seen_at).toLocaleString('en-IN', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
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

  return (
    <>
      {renderContent(false)}

      {/* Presentation Mode Modal */}
      {isPresentationMode && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex flex-col p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
          <div className="max-w-[1680px] w-full mx-auto bg-slate-50 rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col flex-1">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#008C95] flex items-center justify-center font-extrabold text-sm">
                  AE
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-extrabold tracking-tight">
                      Active Users Currently on Platform (Live) — Presentation Mode
                    </h2>
                    <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full">
                      Live Feed
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Logged-in Browser Gmail: {currentUserProfile.email} ({currentUserProfile.userName})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsPresentationMode(false)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
                <span>Exit Presentation Mode</span>
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">{renderContent(true)}</div>
          </div>
        </div>
      )}
    </>
  );
};
