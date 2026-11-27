import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import Login from './Login';
import BannedScreen from './BannedScreen';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import AdminDashboard from './admin/AdminDashboard';
import AdminUsers from './admin/AdminUsers';
import { SuperRoute, SuperOverview, CreateAdmin, ManageAdmins, ManageDepartment } from './superadmin';
import AdminCompanies from './admin/AdminCompanies';
import AdminMeetings from './admin/AdminMeetings';
import AdminCreatives from './admin/AdminCreatives';
import AdminAttendance from './admin/AdminAttendance';
// ON HOLD (device tracking): import AdminDevices from './admin/AdminDevices';
// ON HOLD (device tracking): import DeviceTracker from './DeviceTracker';
import AdminCalendar from './admin/AdminCalendar';
import RmDashboard from './rm/RmDashboard';
import RmTeam from './rm/RmTeam';
import SmeDashboard from './sme/SmeDashboard';
import SmeSaved from './sme/SmeSaved';
import SmeRecords from './sme/SmeRecords';
import SmeCalendar from './sme/SmeCalendar';
import Invoices from './components/Invoice';
import SmePendingCreatives from './sme/SmePendingCreatives';
import SmeSettings from './sme/SmeSettings';
import ProfileSettings from './settings/ProfileSettings';
import SmeAnalytics from './sme/SmeAnalytics';
import SmeMonthlyReports from './sme/SmeMonthlyReports';
import DesDashboard from './des/desdashboard';
import SmiDashboard from './smi/SmiDashboard';
import SmiSaved from './smi/SmiSaved';
import DesHome from './des/desHome';
import DesMonthlyReports from './des/desMonthlyReports';
import DesCalendar from './des/DesCalendar';
import HrEmployees from './hr/HrEmployees';
import HrOnline from './hr/HrOnline';
import HrAttendance from './hr/HrAttendance';
import HrRecruitment from './hr/HrRecruitment';
import HrBaseSkills from './hr/HrBaseSkills';
import InfluencerPage from './components/InfluencerPage';
import SuggestionsPage from './components/SuggestionsPage';
import PlaylistPage from './music/PlaylistPage';
import { MusicProvider } from './music/MusicContext';
import MiniPlayer from './music/MiniPlayer';
import { NotificationProvider } from './notifications/NotificationContext';
import { ThemeProvider } from './theme/ThemeContext';
import AskAI from './components/AskAI';
import ClientDashboard from './client/ClientDashboard';
import ClientCalendar from './client/ClientCalendar';
import ClientForms from './client/ClientForms';
import CompanyForms from './components/CompanyForms';

const getDashboardPath = (role) => {
  if (role === 'admin') return '/admin';
  if (role === 'operation_manager') return '/om';
  if (role === 'reporting_manager') return '/rm';
  if (role === 'sme') return '/sme';
  if (role === 'des') return '/des';
  if (role === 'smi') return '/smi';
  if (role === 'hr') return '/hr/recruitment';
  if (role === 'clients') return '/client';
  return '/login';
};
const ProtectedRoute = ({ role }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-screen">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== role) return <Navigate to={getDashboardPath(user.role)} replace />;
  return <Outlet />;
};
const DashboardLayout = () => {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('sidebarCollapsed') === '1';
    } catch {
      return false;
    }
  });
  const toggleSidebar = () => setCollapsed((v) => {
    try {
      localStorage.setItem('sidebarCollapsed', v ? '0' : '1');
    } catch { }
    return !v;
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);
  return (
    <MusicProvider>
      <NotificationProvider>
      <div className={`app-shell ${collapsed ? 'collapsed' : ''}`}>
        <Sidebar collapsed={collapsed} onToggle={toggleSidebar} mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
        {mobileOpen && <div className="app-scrim" onClick={() => setMobileOpen(false)} />}
        <div className="app-main">
          <Topbar onMenu={() => setMobileOpen(true)} />
          <main className="app-content">
            <Outlet />
          </main>
          <MiniPlayer />
          <AskAI />
        </div>
      </div>
      </NotificationProvider>
    </MusicProvider>
  );
};
// Client companies get a lean shell: no music player and no AI assistant.
const ClientLayout = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);
  return (
    <NotificationProvider>
      <div className={`app-shell ${collapsed ? 'collapsed' : ''}`}>
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
        {mobileOpen && <div className="app-scrim" onClick={() => setMobileOpen(false)} />}
        <div className="app-main">
          <Topbar onMenu={() => setMobileOpen(true)} />
          <main className="app-content">
            <Outlet />
          </main>
        </div>
      </div>
    </NotificationProvider>
  );
};
const AppRoutes = () => {
  const { user, loading, banned } = useAuth();
  if (loading) return <div className="loading-screen">Loading...</div>;
  if (banned) return <BannedScreen />;
  const dashboardPath = getDashboardPath(user?.role);
  return (
    <Routes>
      {/* ON HOLD: <Route path="/track" element={<DeviceTracker />} /> */}
      <Route path="/login" element={user ? <Navigate to={dashboardPath} replace /> : <Login />} />
      <Route element={<ProtectedRoute role="admin" />}>
        <Route element={<DashboardLayout />}>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route element={<SuperRoute />}>
            <Route path="/superadmin" element={<SuperOverview />} />
            <Route path="/superadmin/create-admin" element={<CreateAdmin />} />
            <Route path="/superadmin/manage-admins" element={<ManageAdmins />} />
            <Route path="/superadmin/departments" element={<ManageDepartment />} />
          </Route>
          <Route path="/admin/companies" element={<AdminCompanies />} />
          <Route path="/admin/meetings" element={<AdminMeetings />} />
          <Route path="/admin/invoices" element={<Invoices />} />
          <Route path="/admin/creatives" element={<AdminCreatives />} />
          <Route path="/admin/attendance" element={<AdminAttendance />} />
          {/* ON HOLD: <Route path="/admin/devices" element={<AdminDevices />} /> */}
          <Route path="/admin/calendar" element={<AdminCalendar />} />
          <Route path="/admin/playlist" element={<PlaylistPage workspace="ADMIN WORKSPACE" />} />
          <Route path="/admin/suggestions" element={<SuggestionsPage />} />
          <Route path="/admin/settings" element={<ProfileSettings workspace="ADMIN WORKSPACE" />} />
        </Route>
      </Route>
      <Route element={<ProtectedRoute role="operation_manager" />}>
        <Route element={<DashboardLayout />}>
          <Route path="/om" element={<AdminDashboard base="/om" />} />
          <Route path="/om/meetings" element={<AdminMeetings label="OPERATION MANAGER" />} />
          <Route path="/om/invoices" element={<Invoices />} />
          <Route path="/om/creatives" element={<AdminCreatives label="OPERATION MANAGER" />} />
          <Route path="/om/attendance" element={<AdminAttendance label="OPERATION MANAGER" />} />
          {/* ON HOLD: <Route path="/om/devices" element={<AdminDevices canEdit={false} label="OPERATION MANAGER" />} /> */}
          <Route path="/om/calendar" element={<AdminCalendar />} />
          <Route path="/om/playlist" element={<PlaylistPage workspace="OPERATION MANAGER WORKSPACE" />} />
          <Route path="/om/suggestions" element={<SuggestionsPage />} />
          <Route path="/om/settings" element={<ProfileSettings workspace="OPERATION MANAGER WORKSPACE" />} />
        </Route>
      </Route>
      <Route element={<ProtectedRoute role="reporting_manager" />}>
        <Route element={<DashboardLayout />}>
          <Route path="/rm" element={<RmDashboard />} />
          <Route path="/rm/team" element={<RmTeam />} />
          <Route path="/rm/attendance" element={<AdminAttendance base="/rm" label="REPORTING MANAGER" />} />
          <Route path="/rm/creatives" element={<AdminCreatives base="/rm" label="REPORTING MANAGER" scopeText="your team’s SMEs" />} />
          <Route path="/rm/meetings" element={<AdminMeetings base="/rm" label="REPORTING MANAGER" scopeText="your team’s SMEs" />} />
          <Route path="/rm/playlist" element={<PlaylistPage workspace="REPORTING MANAGER WORKSPACE" />} />
          <Route path="/rm/suggestions" element={<SuggestionsPage />} />
          <Route path="/rm/settings" element={<ProfileSettings workspace="REPORTING MANAGER WORKSPACE" />} />
        </Route>
      </Route>
      <Route element={<ProtectedRoute role="sme" />}>
        <Route element={<DashboardLayout />}>
          <Route path="/sme" element={<SmeDashboard />} />
          <Route path="/sme/calendar" element={<SmeCalendar />} />
          <Route path="/sme/companies" element={<CompanyForms workspace="SME WORKSPACE" />} />
          <Route path="/sme/saved" element={<SmeSaved />} />
          <Route path="/sme/records" element={<SmeRecords />} />
          <Route path="/sme/pending-creatives" element={<SmePendingCreatives />} />
          <Route path="/sme/suggestions" element={<SuggestionsPage />} />
          <Route path="/sme/settings" element={<SmeSettings />} />
          <Route path="/sme/analytics" element={<SmeAnalytics />} />
          <Route path="/sme/monthly-reports" element={<SmeMonthlyReports />} />
          <Route path="/sme/influencers" element={<InfluencerPage role="sme" />} />
          <Route path="/sme/playlist" element={<PlaylistPage workspace="SME WORKSPACE" />} />
        </Route>
      </Route>
      <Route element={<ProtectedRoute role="des" />}>
        <Route element={<DashboardLayout />}>
          <Route path="/des" element={<DesHome />} />
          <Route path="/des/creatives" element={<DesDashboard />} />
          <Route path="/des/calendar" element={<DesCalendar />} />
          <Route path="/des/monthly-reports" element={<DesMonthlyReports />} />
          <Route path="/des/playlist" element={<PlaylistPage workspace="DESIGNER WORKSPACE" />} />
          <Route path="/des/suggestions" element={<SuggestionsPage />} />
          <Route path="/des/settings" element={<ProfileSettings workspace="DESIGNER WORKSPACE" />} />
        </Route>
      </Route>
      <Route element={<ProtectedRoute role="smi" />}>
        <Route element={<DashboardLayout />}>
          <Route path="/smi" element={<SmiDashboard />} />
          <Route path="/smi/saved" element={<SmiSaved />} />
          <Route path="/smi/companies" element={<CompanyForms workspace="SMI WORKSPACE" />} />
          <Route path="/smi/influencers" element={<InfluencerPage role="smi" />} />
          <Route path="/smi/playlist" element={<PlaylistPage workspace="SMI WORKSPACE" />} />
          <Route path="/smi/suggestions" element={<SuggestionsPage />} />
          <Route path="/smi/settings" element={<ProfileSettings workspace="SMI WORKSPACE" />} />
        </Route>
      </Route>
      <Route element={<ProtectedRoute role="hr" />}>
        <Route element={<DashboardLayout />}>
          <Route path="/hr" element={<Navigate to="/hr/recruitment" replace />} />
          <Route path="/hr/recruitment" element={<HrRecruitment />} />
          <Route path="/hr/base-skills" element={<HrBaseSkills />} />
          <Route path="/hr/employees" element={<HrEmployees />} />
          <Route path="/hr/online" element={<HrOnline />} />
          <Route path="/hr/attendance" element={<HrAttendance />} />
          <Route path="/hr/playlist" element={<PlaylistPage workspace="HR WORKSPACE" />} />
          <Route path="/hr/suggestions" element={<SuggestionsPage />} />
          <Route path="/hr/settings" element={<ProfileSettings workspace="HR WORKSPACE" />} />
        </Route>
      </Route>
      <Route element={<ProtectedRoute role="clients" />}>
        <Route element={<ClientLayout />}>
          <Route path="/client" element={<ClientDashboard />} />
          <Route path="/client/calendar" element={<ClientCalendar />} />
          <Route path="/client/forms" element={<ClientForms />} />
          <Route path="/client/settings" element={<ProfileSettings workspace="CLIENT WORKSPACE" />} />
        </Route>
      </Route>
      <Route path="/" element={<Navigate to={dashboardPath} replace />} />
      <Route path="*" element={<Navigate to={dashboardPath} replace />} />
    </Routes>
  );
};
const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <ThemeProvider>
        <AppRoutes />
      </ThemeProvider>
    </AuthProvider>
  </BrowserRouter>
);
export default App;
