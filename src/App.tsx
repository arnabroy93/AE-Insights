import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  UserX,
  AlertTriangle,
  Clock,
  Briefcase,
  CheckCircle2,
  CheckSquare,
  Award,
  Building2,
  BookOpen,
  UserCheck,
  Table,
  Upload,
  Sparkles,
  FileText,
  ShieldCheck,
  History,
  Settings2,
  ChevronRight,
  Menu,
  X,
  CalendarDays,
  Activity,
} from 'lucide-react';
import { Header } from './components/Header';
import { GlobalFilterBar } from './components/GlobalFilterBar';
import { RecordDetailModal } from './components/RecordDetailModal';
import { DrilldownModal } from './components/DrilldownModal';
import { MeetingPresenterModal, PresentableChartItem } from './components/MeetingPresenterModal';
import { ClearDataModal } from './components/ClearDataModal';

// Views
import { ExecutiveOverview } from './views/ExecutiveOverview';
import { DropoutAnalytics } from './views/DropoutAnalytics';
import { ExceptionAnalytics } from './views/ExceptionAnalytics';
import { BatchClosureAnalytics } from './views/BatchClosureAnalytics';
import { RunningBatchAnalytics } from './views/RunningBatchAnalytics';
import { ClosedBatchAnalytics } from './views/ClosedBatchAnalytics';
import { SchedulingAnalytics } from './views/SchedulingAnalytics';
import { TrainedAnalytics } from './views/TrainedAnalytics';
import { FacultyAnalytics } from './views/FacultyAnalytics';
import { StudentValidationAnalytics } from './views/StudentValidationAnalytics';
import { AcademicProgressAnalytics } from './views/AcademicProgressAnalytics';
import { PlacementAnalytics } from './views/PlacementAnalytics';
import { CenterAnalytics } from './views/CenterAnalytics';
import { ProgramFunderAnalytics } from './views/ProgramFunderAnalytics';
import { AeAnalytics } from './views/AeAnalytics';
import { DataExplorer } from './views/DataExplorer';
import { UploadCenter } from './views/UploadCenter';
import { AiInsights } from './views/AiInsights';
import { ReportsCenter } from './views/ReportsCenter';
import { DataQualityView } from './views/DataQualityView';
import { UploadHistoryView } from './views/UploadHistoryView';
import { SettingsView } from './views/SettingsView';
import { AdminPortalView } from './views/AdminPortalView';
import { ChallengesView } from './views/ChallengesView';
import { HiringConcernsView } from './views/HiringConcernsView';
import { UserGuideView } from './views/UserGuideView';

import { api } from './api';
import {
  FilterParams,
  FilterOptions,
  SourceRow,
  UploadRecord,
  TrainedAnalyticsData,
  SchedulingAnalyticsData,
  RunningBatchAnalyticsData,
  ClosedBatchAnalyticsData,
  ChallengeRecord,
} from './types';

export default function App() {
  const checkIsAdminPath = () =>
    typeof window !== 'undefined' &&
    (window.location.pathname.startsWith('/admin') ||
      window.location.hash.startsWith('#/admin'));

  const [isAdminPortal, setIsAdminPortal] = useState<boolean>(checkIsAdminPath);
  const [currentView, setCurrentView] = useState<string>(() =>
    checkIsAdminPath() ? 'explorer' : 'overview'
  );
  const [currentRole, setCurrentRole] = useState<string>(() =>
    checkIsAdminPath() ? 'Admin' : 'Viewer'
  );
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<SourceRow | null>(null);
  const [drilldownCenter, setDrilldownCenter] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navigateToView = (view: string) => {
    setCurrentView(view);
    setIsMobileMenuOpen(false);
  };

  useEffect(() => {
    const handlePopState = () => {
      const isAdmin = checkIsAdminPath();
      setIsAdminPortal(isAdmin);
      if (isAdmin) {
        setCurrentRole('Admin');
        setCurrentView((prev) =>
          ['explorer', 'upload', 'challenges', 'quality', 'history', 'settings', 'user_guide'].includes(prev) ? prev : 'explorer'
        );
      } else {
        setCurrentView((prev) =>
          ['overview', 'trained', 'dropouts', 'exceptions', 'closure', 'running_batch_progress', 'closed_batch_progress', 'scheduling', 'hiring_concerns', 'attendance', 'placement', 'ai', 'reports', 'user_guide'].includes(prev)
            ? prev
            : 'overview'
        );
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Filters state
  const [filters, setFilters] = useState<FilterParams>({});
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    centers: [],
    funders: [],
    programs: [],
    courses: [],
    batches: [],
    trainers: [],
    aes: [],
    rmShZhs: [],
    batchStatuses: [],
    enrollmentStatuses: [],
    studentStatuses: [],
    dropoutTypes: [],
    batchValidationStatuses: [],
    studentValidationStatuses: [],
    placementTypes: [],
  });

  // Analytics data
  const [executiveData, setExecutiveData] = useState<any | null>(null);
  const [trainedData, setTrainedData] = useState<TrainedAnalyticsData | null>(null);
  const [dropoutData, setDropoutData] = useState<any | null>(null);
  const [exceptionData, setExceptionData] = useState<any | null>(null);
  const [closureData, setClosureData] = useState<any | null>(null);
  const [runningBatchData, setRunningBatchData] = useState<RunningBatchAnalyticsData | null>(null);
  const [closedBatchData, setClosedBatchData] = useState<ClosedBatchAnalyticsData | null>(null);
  const [schedulingData, setSchedulingData] = useState<SchedulingAnalyticsData | null>(null);
  const [challengesData, setChallengesData] = useState<{ rows: ChallengeRecord[]; totalCount: number } | null>(null);
  const [facultyData, setFacultyData] = useState<any | null>(null);
  const [validationData, setValidationData] = useState<any | null>(null);
  const [attendanceData, setAttendanceData] = useState<any | null>(null);
  const [placementData, setPlacementData] = useState<any | null>(null);
  const [centersData, setCentersData] = useState<any[]>([]);
  const [aesData, setAesData] = useState<any[]>([]);
  const [latestUpload, setLatestUpload] = useState<UploadRecord | null>(null);
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [clearSuccessNotification, setClearSuccessNotification] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Google Meet Presentation Focus Mode state
  const [meetingPresenterState, setMeetingPresenterState] = useState<{
    isOpen: boolean;
    charts: PresentableChartItem[];
    activeChartIndex: number;
  }>({
    isOpen: false,
    charts: [],
    activeChartIndex: 0,
  });

  const handleOpenPresenter = (charts?: PresentableChartItem[], startIndex: number = 0) => {
    if (charts && charts.length > 0) {
      setMeetingPresenterState({
        isOpen: true,
        charts,
        activeChartIndex: startIndex,
      });
    } else {
      const defaultCharts: PresentableChartItem[] = [];
      if (dropoutData && dropoutData.kpis) {
        defaultCharts.push({
          id: 'dropout-kpi-summary',
          title: 'Student Attrition & Training Overview',
          subtitle: `Active Filter: ${filters.programType || 'Diya and Deeptech'}`,
          description: 'Overall student enrollment vs completion and dropouts',
          chartComponent: (
            <div className="p-8 text-center bg-slate-900 text-white rounded-2xl border border-slate-800">
              <div className="text-4xl font-extrabold font-mono text-cyan-400">
                {dropoutData.kpis.total_students?.toLocaleString()} Total Students
              </div>
              <div className="text-xl font-bold font-mono text-rose-400 mt-3">
                {dropoutData.kpis.total_dropouts?.toLocaleString()} Total Dropouts ({dropoutData.kpis.dropout_rate}%)
              </div>
              <div className="grid grid-cols-2 gap-4 mt-6 text-left max-w-lg mx-auto">
                <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700">
                  <div className="text-xs text-slate-400">Initial Dropouts</div>
                  <div className="text-lg font-bold text-sky-400 font-mono">
                    {dropoutData.kpis.initial_session_dropouts?.toLocaleString()} ({dropoutData.kpis.initial_dropout_rate}%)
                  </div>
                </div>
                <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700">
                  <div className="text-xs text-slate-400">Regular Dropouts</div>
                  <div className="text-lg font-bold text-blue-400 font-mono">
                    {dropoutData.kpis.regular_session_dropouts?.toLocaleString()} ({dropoutData.kpis.regular_dropout_rate}%)
                  </div>
                </div>
              </div>
            </div>
          ),
          summaryMetrics: [
            { label: 'Total Students', value: dropoutData.kpis.total_students?.toLocaleString() || '0' },
            { label: 'Total Trained', value: dropoutData.kpis.total_trained?.toLocaleString() || '0' },
            { label: 'Total Dropouts', value: dropoutData.kpis.total_dropouts?.toLocaleString() || '0' },
            { label: 'Dropout Rate', value: `${dropoutData.kpis.dropout_rate}%` },
          ],
          insights: [
            `Total student enrollments in scope: ${dropoutData.kpis.total_students?.toLocaleString()}`,
            `Overall dropout rate: ${dropoutData.kpis.dropout_rate}%`,
            `Initial Session Dropouts: ${dropoutData.kpis.initial_session_dropouts?.toLocaleString()}`,
            `Regular Session Dropouts: ${dropoutData.kpis.regular_session_dropouts?.toLocaleString()}`,
          ],
          filtersContext: `Program Type: ${filters.programType || 'Diya and Deeptech'} | RM: ${filters.rmShZh || 'ALL'} | Center: ${filters.centerCode || 'ALL'}`
        });
      }
      setMeetingPresenterState({
        isOpen: true,
        charts: defaultCharts.length > 0 ? defaultCharts : [{
          id: 'ae-overview-spotlight',
          title: 'AE INSIGHT Google Meet Presentation Mode',
          subtitle: 'Spotlight & Focus view for Google Meeting presentations',
          chartComponent: (
            <div className="p-10 text-center text-slate-200 bg-slate-900 rounded-2xl">
              <h2 className="text-2xl font-bold text-teal-400">Ready for Live Meeting Presentation</h2>
              <p className="text-xs text-slate-400 mt-2 max-w-md mx-auto">
                Click "Present in Meet" on any individual chart card across the dashboard to isolate that chart with enlarged labels and live meeting notes!
              </p>
            </div>
          )
        }],
        activeChartIndex: 0,
      });
    }
  };

  // Load filter options on mount
  useEffect(() => {
    loadFilterOptions();
  }, []);

  // Reload active view data when filters or view changes
  useEffect(() => {
    loadViewData();
  }, [currentView, filters]);

  const loadFilterOptions = async () => {
    try {
      const [options, history] = await Promise.all([
        api.getFilterOptions(),
        api.getUploadHistory().catch(() => []),
      ]);
      setFilterOptions(options);
      if (Array.isArray(history) && history.length > 0) {
        setLatestUpload(history[0]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadViewData = async (force: boolean = false) => {
    setLoading(true);
    try {
      if (currentView === 'overview') {
        const data = await api.getExecutiveAnalytics(filters);
        setExecutiveData(data);
        if (data.latest_upload) setLatestUpload(data.latest_upload);
      } else if (currentView === 'trained') {
        const data = await api.getTrainedAnalytics(filters);
        setTrainedData(data);
      } else if (currentView === 'dropouts') {
        const data = await api.getDropoutAnalytics(filters);
        setDropoutData(data);
      } else if (currentView === 'exceptions') {
        const data = await api.getExceptionAnalytics(filters);
        setExceptionData(data);
      } else if (currentView === 'closure') {
        const data = await api.getBatchClosureAnalytics(filters);
        setClosureData(data);
      } else if (currentView === 'running_batch_progress') {
        const data = await api.getRunningBatchAnalytics(filters);
        setRunningBatchData(data);
      } else if (currentView === 'closed_batch_progress') {
        const data = await api.getClosedBatchAnalytics(filters);
        setClosedBatchData(data);
      } else if (currentView === 'scheduling') {
        const data = await api.getSchedulingAnalytics(filters);
        setSchedulingData(data);
      } else if (currentView === 'challenges') {
        const data = await api.getChallenges(2000, 0, '');
        setChallengesData(data);
      } else if (currentView === 'faculty') {
        const data = await api.getFacultyAnalytics(filters);
        setFacultyData(data);
      } else if (currentView === 'validation') {
        const data = await api.getStudentValidationAnalytics(filters);
        setValidationData(data);
      } else if (currentView === 'attendance') {
        const data = await api.getAttendanceAnalytics(filters);
        setAttendanceData(data);
      } else if (currentView === 'placement') {
        const data = await api.getPlacementAnalytics(filters);
        setPlacementData(data);
      } else if (currentView === 'centers') {
        const data = await api.getCenterAnalytics(filters);
        setCentersData(data);
      } else if (currentView === 'aes') {
        const data = await api.getAeAnalytics(filters);
        setAesData(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshData = async () => {
    setIsRefreshing(true);
    await Promise.all([loadFilterOptions(), loadViewData(true)]);
    setIsRefreshing(false);
  };

  const handleClearAllData = async () => {
    await api.clearAllData('arnab.roy@anudip.org');
    setExecutiveData(null);
    setTrainedData(null);
    setDropoutData(null);
    setExceptionData(null);
    setClosureData(null);
    setRunningBatchData(null);
    setClosedBatchData(null);
    setSchedulingData(null);
    setChallengesData(null);
    setFacultyData(null);
    setValidationData(null);
    setAttendanceData(null);
    setPlacementData(null);
    setCentersData([]);
    setAesData([]);
    setLatestUpload(null);
    setSelectedRecord(null);
    setDrilldownCenter(null);
    setFilters({});

    await Promise.all([loadFilterOptions(), loadViewData(true)]);
    setClearSuccessNotification('All data from the portal has been permanently cleared. The platform is ready for a fresh dataset.');
    setTimeout(() => {
      setClearSuccessNotification(null);
    }, 6000);
  };

  const activeFilterCount = Object.entries(filters).filter(
    ([_, v]) => v !== undefined && v !== '' && v !== 'ALL' && v !== false
  ).length;

  const navigationItems = isAdminPortal
    ? [
        { id: 'explorer', label: 'Data Explorer', icon: Table, section: 'Data & Tools' },
        { id: 'upload', label: 'Upload Center', icon: Upload, section: 'Data & Tools' },
        { id: 'challenges', label: 'Challenges & Impact', icon: FileText, section: 'Data & Tools' },
        { id: 'quality', label: 'Data Quality', icon: ShieldCheck, section: 'Governance' },
        { id: 'history', label: 'Upload History', icon: History, section: 'Governance' },
        { id: 'settings', label: 'Settings & Restore', icon: Settings2, section: 'Governance' },
        { id: 'user_guide', label: 'User Guide (PDF)', icon: BookOpen, section: 'Governance' },
      ]
    : [
        { id: 'overview', label: 'Dashboard', icon: LayoutDashboard, section: 'Core Dashboards' },
        { id: 'trained', label: 'Assessment Status', icon: CheckCircle2, section: 'Core Dashboards' },
        { id: 'dropouts', label: 'Dropout Status', icon: UserX, section: 'Core Dashboards' },
        { id: 'exceptions', label: 'Exception Status', icon: AlertTriangle, section: 'Core Dashboards' },
        { id: 'closure', label: 'Batch Closure Progress', icon: Clock, section: 'Core Dashboards' },
        { id: 'running_batch_progress', label: 'Running Batch Progress', icon: Activity, section: 'Core Dashboards' },
        { id: 'closed_batch_progress', label: 'Closed Batch Progress', icon: CheckSquare, section: 'Core Dashboards' },
        { id: 'scheduling', label: 'Class Conduction Adherence', icon: CalendarDays, section: 'Core Dashboards' },
        { id: 'hiring_concerns', label: 'Hiring Concerns', icon: Briefcase, section: 'Core Dashboards' },
        { id: 'ai', label: 'AI Insights', icon: Sparkles, section: 'Intelligence & Reports' },
        { id: 'reports', label: 'Reports', icon: FileText, section: 'Intelligence & Reports' },
        { id: 'user_guide', label: 'User Guide (PDF)', icon: BookOpen, section: 'Intelligence & Reports' },
      ];

  const visibleSections = isAdminPortal
    ? ['Data & Tools', 'Governance']
    : ['Core Dashboards', 'Intelligence & Reports'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100/70 to-teal-50/20 text-slate-900 flex flex-col font-sans relative overflow-hidden">
      {/* Live Ambient Animated Background & Floating Particles */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        {/* Subtle Geometric Dot Grid Pattern */}
        <div className="absolute inset-0 bg-grid-dots opacity-40" />

        {/* Floating Glowing Orbs */}
        <div className="absolute -top-32 -left-32 w-[30rem] h-[30rem] bg-teal-400/20 rounded-full blur-3xl animate-float-slow mix-blend-multiply" />
        <div className="absolute top-1/4 -right-32 w-[32rem] h-[32rem] bg-indigo-400/15 rounded-full blur-3xl animate-float-reverse mix-blend-multiply" />
        <div className="absolute -bottom-32 left-1/4 w-[36rem] h-[36rem] bg-cyan-300/20 rounded-full blur-3xl animate-pulse-glow mix-blend-multiply" />
        <div className="absolute top-2/3 right-1/4 w-80 h-80 bg-emerald-300/15 rounded-full blur-3xl animate-float-fast mix-blend-multiply" />

        {/* Continuous Rising Light Particles */}
        <div className="absolute left-[15%] w-2 h-2 bg-[#008C95]/30 rounded-full blur-xs animate-particle-1" />
        <div className="absolute left-[45%] w-2.5 h-2.5 bg-indigo-400/30 rounded-full blur-xs animate-particle-2" />
        <div className="absolute left-[70%] w-2 h-2 bg-emerald-400/30 rounded-full blur-xs animate-particle-3" />
        <div className="absolute left-[88%] w-3 h-3 bg-cyan-400/25 rounded-full blur-xs animate-particle-4" />
      </div>

      {/* Top Header */}
      <Header
        currentRole={currentRole}
        onRoleChange={setCurrentRole}
        onOpenAi={isAdminPortal ? undefined : () => navigateToView('ai')}
        isFilterOpen={isFilterOpen}
        onToggleFilter={() => setIsFilterOpen(!isFilterOpen)}
        activeFilterCount={activeFilterCount}
        latestUpload={latestUpload}
        onRefreshData={handleRefreshData}
        isRefreshing={isRefreshing}
        onOpenPresenter={() => handleOpenPresenter()}
        onOpenClearModal={isAdminPortal ? () => setIsClearModalOpen(true) : undefined}
        onOpenRestore={isAdminPortal ? () => navigateToView('settings') : undefined}
        onOpenUserGuide={() => navigateToView('user_guide')}
        isAdminPortal={isAdminPortal}
      />

      {/* Global Filter Bar */}
      <GlobalFilterBar
        filters={filters}
        options={filterOptions}
        onChange={setFilters}
        onReset={() => setFilters({})}
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
      />

      {/* Main Container with Sidebar + Content */}
      <div className="flex-1 flex flex-col lg:flex-row max-w-[1760px] w-full mx-auto relative">
        {/* Mobile Navigation Toggle */}
        <div className="lg:hidden bg-white px-4 py-2.5 border-b border-slate-200 flex items-center justify-between shadow-2xs">
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="flex items-center gap-2 text-xs font-bold text-slate-900 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200"
          >
            {isMobileMenuOpen ? <X className="w-4 h-4 text-rose-600" /> : <Menu className="w-4 h-4 text-[#008C95]" />}
            <span>Menu: {navigationItems.find((n) => n.id === currentView)?.label}</span>
          </button>
          <span className="text-[11px] font-bold text-[#008C95]">Tap to switch view</span>
        </div>

        {/* Sidebar Navigation */}
        <aside
          className={`${
            isMobileMenuOpen ? 'block' : 'hidden'
          } lg:block w-full lg:w-[270px] bg-white border-r border-slate-200 px-3 py-3 space-y-3 shrink-0 lg:sticky lg:top-[68px] lg:h-[calc(100vh-68px)] overflow-y-auto shadow-xs`}
        >
          {visibleSections.map((sectionName) => {
            const items = navigationItems.filter((i) => i.section === sectionName);
            return (
              <div key={sectionName} className="space-y-1">
                <div className="px-2.5 py-1 bg-slate-100/90 rounded-lg border border-slate-200/60 flex items-center justify-between">
                  <span className="text-[10px] font-extrabold text-slate-700 uppercase tracking-wider">
                    {sectionName}
                  </span>
                  <span className="text-[10px] font-bold text-slate-500 font-mono">{items.length}</span>
                </div>
                <div className="space-y-0.5 pt-0.5">
                  {items.map((item) => {
                    const Icon = item.icon;
                    const isActive = currentView === item.id;

                    return (
                      <div
                        key={item.id}
                        onClick={() => {
                          navigateToView(item.id);
                        }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            navigateToView(item.id);
                          }
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-[13px] font-bold transition-all text-left cursor-pointer group/nav select-none ${
                          isActive
                            ? 'bg-[#008C95] text-white shadow-xs ring-1 ring-[#00747C]'
                            : 'text-slate-800 hover:text-[#008C95] hover:bg-teal-50/70'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 pointer-events-none">
                          <Icon
                            className={`w-4 h-4 shrink-0 ${
                              isActive
                                ? 'text-white'
                                : 'text-[#008C95] group-hover/nav:scale-110 transition-transform'
                            }`}
                          />
                          <span className="leading-snug">{item.label}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {isActive && <ChevronRight className="w-3.5 h-3.5 text-white shrink-0" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </aside>

        {/* Main Analytical Canvas */}
        <main className="flex-1 p-4 sm:p-6 lg:p-7 overflow-y-auto min-w-0">
          {currentView === 'overview' && (
            <ExecutiveOverview
              data={executiveData}
              loading={loading}
              onNavigateToView={setCurrentView}
              onSelectCenterDrilldown={(c) => setDrilldownCenter(c)}
              onOpenPresenter={handleOpenPresenter}
            />
          )}

          {currentView === 'trained' && (
            <TrainedAnalytics
              data={trainedData}
              loading={loading}
              filters={filters}
              filterOptions={filterOptions}
              onFilterChange={setFilters}
              onSelectCenterDrilldown={(c) => setDrilldownCenter(c)}
              onOpenPresenter={handleOpenPresenter}
            />
          )}

          {currentView === 'dropouts' && (
            <DropoutAnalytics
              data={dropoutData}
              loading={loading}
              filters={filters}
              filterOptions={filterOptions}
              onFilterChange={setFilters}
              onSelectCenterDrilldown={(c) => setDrilldownCenter(c)}
              onSelectRecord={setSelectedRecord}
            />
          )}

          {currentView === 'exceptions' && (
            <ExceptionAnalytics
              data={exceptionData}
              loading={loading}
              filters={filters}
              filterOptions={filterOptions}
              onFilterChange={setFilters}
              onSelectCenterDrilldown={(c) => setDrilldownCenter(c)}
              onSelectRecord={setSelectedRecord}
              onOpenPresenter={handleOpenPresenter}
              onNavigateToUpload={() => setCurrentView('upload')}
            />
          )}

          {currentView === 'closure' && (
            <BatchClosureAnalytics 
              data={closureData} 
              loading={loading} 
              filters={filters}
              filterOptions={filterOptions}
              onFilterChange={setFilters}
            />
          )}

          {currentView === 'running_batch_progress' && (
            <RunningBatchAnalytics
              data={runningBatchData}
              loading={loading}
              filters={filters}
              filterOptions={filterOptions}
              onFilterChange={setFilters}
              onSelectCenterDrilldown={(c) => setDrilldownCenter(c)}
            />
          )}

          {currentView === 'closed_batch_progress' && (
            <ClosedBatchAnalytics
              data={closedBatchData}
              loading={loading}
              filters={filters}
              filterOptions={filterOptions}
              onFilterChange={setFilters}
              onSelectCenterDrilldown={(c) => setDrilldownCenter(c)}
            />
          )}

          {currentView === 'scheduling' && (
            <SchedulingAnalytics
              data={schedulingData}
              loading={loading}
              filters={filters}
              filterOptions={filterOptions}
              onFilterChange={setFilters}
              onRefresh={() => loadViewData(true)}
            />
          )}

          {currentView === 'hiring_concerns' && (
            <HiringConcernsView />
          )}

          {currentView === 'challenges' && (
            <ChallengesView
              data={challengesData}
              loading={loading}
              filters={filters}
              onRefresh={() => loadViewData(true)}
            />
          )}

          {currentView === 'faculty' && (
            <FacultyAnalytics data={facultyData} loading={loading} />
          )}

          {currentView === 'validation' && (
            <StudentValidationAnalytics data={validationData} loading={loading} />
          )}

          {currentView === 'attendance' && (
            <AcademicProgressAnalytics
              data={attendanceData}
              loading={loading}
              onSelectRecord={setSelectedRecord}
            />
          )}

          {currentView === 'placement' && (
            <PlacementAnalytics data={placementData} loading={loading} />
          )}

          {currentView === 'centers' && (
            <CenterAnalytics
              data={centersData}
              loading={loading}
              onSelectCenterDrilldown={(c) => setDrilldownCenter(c)}
            />
          )}

          {currentView === 'programs' && (
            <ProgramFunderAnalytics onSelectRecord={setSelectedRecord} />
          )}

          {currentView === 'aes' && (
            <AeAnalytics data={aesData} loading={loading} />
          )}

          {currentView === 'explorer' && (
            <DataExplorer
              filters={filters}
              onSelectRecord={setSelectedRecord}
              onOpenClearModal={() => setIsClearModalOpen(true)}
            />
          )}

          {currentView === 'upload' && (
            <UploadCenter
              onImportSuccess={() => {
                setCurrentView(isAdminPortal ? 'explorer' : 'overview');
                handleRefreshData();
              }}
              onOpenClearModal={() => setIsClearModalOpen(true)}
            />
          )}

          {currentView === 'ai' && <AiInsights filters={filters} />}

          {currentView === 'reports' && <ReportsCenter filters={filters} />}

          {currentView === 'user_guide' && <UserGuideView />}

          {currentView === 'quality' && <DataQualityView />}

          {currentView === 'history' && <UploadHistoryView />}

          {currentView === 'admin' && (
            <AdminPortalView
              onNavigateToView={navigateToView}
              onRoleChange={setCurrentRole}
              currentRole={currentRole}
              onRefreshData={handleRefreshData}
              onOpenClearModal={() => setIsClearModalOpen(true)}
            />
          )}

          {currentView === 'settings' && (
            <SettingsView onSettingsSaved={handleRefreshData} />
          )}
        </main>
      </div>

      {/* Clear Success Notification Toast */}
      {clearSuccessNotification && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl border border-slate-750 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-200 max-w-md">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xs flex-1 text-slate-200 leading-snug">
            {clearSuccessNotification}
          </div>
          <button
            onClick={() => setClearSuccessNotification(null)}
            className="text-slate-400 hover:text-white p-1 rounded-md transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Clear All Data Confirmation Modal */}
      <ClearDataModal
        isOpen={isClearModalOpen}
        onClose={() => setIsClearModalOpen(false)}
        onConfirm={handleClearAllData}
      />

      {/* 30-Column Record Detail Modal */}
      <RecordDetailModal
        record={selectedRecord}
        onClose={() => setSelectedRecord(null)}
      />

      {/* Center Drilldown Modal */}
      <DrilldownModal
        initialCenter={drilldownCenter}
        onClose={() => setDrilldownCenter(null)}
        onSelectRecord={setSelectedRecord}
      />

      {/* Google Meeting Presentation Focus Mode Modal */}
      <MeetingPresenterModal
        isOpen={meetingPresenterState.isOpen}
        onClose={() => setMeetingPresenterState((prev) => ({ ...prev, isOpen: false }))}
        charts={meetingPresenterState.charts}
        activeChartIndex={meetingPresenterState.activeChartIndex}
        onSelectChartIndex={(index) => setMeetingPresenterState((prev) => ({ ...prev, activeChartIndex: index }))}
      />

      {/* Application Footer (Section 80) */}
      <footer className="bg-white border-t border-slate-200 px-4 sm:px-6 lg:px-8 py-4 text-center text-xs text-slate-500">
        <div className="font-bold text-slate-800">AE INSIGHT</div>
        <div className="text-[11px] text-slate-500">Academic Excellence Intelligence &amp; Insights Platform</div>
        <div className="text-[11px] text-slate-400 mt-0.5">
          Developed by Academic Excellence Team | Anudip Foundation
        </div>
      </footer>
    </div>
  );
}
