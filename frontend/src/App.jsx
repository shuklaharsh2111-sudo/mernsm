import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import Login from './Login';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import AdminDashboard from './admin/AdminDashboard';
import AdminUsers from './admin/AdminUsers';
import AdminCompanies from './admin/AdminCompanies';
import AdminMeetings from './admin/AdminMeetings';
import AdminCreatives from './admin/AdminCreatives';
import AdminAttendance from './admin/AdminAttendance';
import SmeDashboard from './sme/SmeDashboard';
import SmeSaved from './sme/SmeSaved';
import SmeRecords from './sme/SmeRecords';
import SmeCalendar from './sme/SmeCalendar';
import Invoices from './components/Invoice';
import SmePendingCreatives from './sme/SmePendingCreatives';
import SmeSettings from './sme/SmeSettings';
import SmeAnalytics from './sme/SmeAnalytics';
import SmeMonthlyReports from './sme/SmeMonthlyReports';
import DesDashboard from './des/desdashboard';
import SmiDashboard from './smi/SmiDashboard';
import SmiSaved from './smi/SmiSaved';
import DesHome from './des/desHome';
import DesMonthlyReports from './des/desMonthlyReports';

const getDashboardPath = (role) => {
  if (role === 'admin') return '/admin';
  if (role === 'sme') return '/sme';
  if (role === 'des') return '/des';
  if (role === 'smi') return '/smi';
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
    <div className={`app-shell ${collapsed ? 'collapsed' : ''}`}>
      <Sidebar collapsed={collapsed} onToggle={toggleSidebar} mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      {mobileOpen && <div className="app-scrim" onClick={() => setMobileOpen(false)} />}
      <div className="app-main">
        <Topbar onMenu={() => setMobileOpen(true)} />
        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
const AppRoutes = () => {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-screen">Loading...</div>;
  const dashboardPath = getDashboardPath(user?.role);
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={dashboardPath} replace /> : <Login />} />
      <Route element={<ProtectedRoute role="admin" />}>
        <Route element={<DashboardLayout />}>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/admin/companies" element={<AdminCompanies />} />
          <Route path="/admin/meetings" element={<AdminMeetings />} />
          <Route path="/admin/invoices" element={<Invoices />} />
          <Route path="/admin/creatives" element={<AdminCreatives />} />
          <Route path="/admin/attendance" element={<AdminAttendance />} />
        </Route>
      </Route>
      <Route element={<ProtectedRoute role="sme" />}>
        <Route element={<DashboardLayout />}>
          <Route path="/sme" element={<SmeDashboard />} />
          <Route path="/sme/calendar" element={<SmeCalendar />} />
          <Route path="/sme/saved" element={<SmeSaved />} />
          <Route path="/sme/records" element={<SmeRecords />} />
          <Route path="/sme/pending-creatives" element={<SmePendingCreatives />} />
          <Route path="/sme/settings" element={<SmeSettings />} />
          <Route path="/sme/analytics" element={<SmeAnalytics />} />
          <Route path="/sme/monthly-reports" element={<SmeMonthlyReports />} />
        </Route>
      </Route>
      <Route element={<ProtectedRoute role="des" />}>
        <Route element={<DashboardLayout />}>
          <Route path="/des" element={<DesHome />} />
          <Route path="/des/creatives" element={<DesDashboard />} />
          <Route path="/des/monthly-reports" element={<DesMonthlyReports />} />
        </Route>
      </Route>
      <Route element={<ProtectedRoute role="smi" />}>
        <Route element={<DashboardLayout />}>
          <Route path="/smi" element={<SmiDashboard />} />
          <Route path="/smi/saved" element={<SmiSaved />} />
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
      <AppRoutes />
    </AuthProvider>
  </BrowserRouter>
);
export default App;
