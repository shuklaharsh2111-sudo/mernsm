
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet
} from 'react-router-dom';

import { AuthProvider, useAuth } from './AuthContext';

import Login from './Login';
import Sidebar from './Sidebar';

import AdminDashboard from './admin/AdminDashboard';
import AdminUsers from './admin/AdminUsers';
import AdminCompanies from './admin/AdminCompanies';
import AdminMeetings from './admin/AdminMeetings';
import SmeDashboard from './sme/SmeDashboard';
import SmeSaved from './sme/SmeSaved';
import SmeRecords from './sme/SmeRecords';
import SmeCalendar from './sme/SmeCalendar';

const ProtectedRoute = ({ role }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="loading-screen">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== role) {
    return (
      <Navigate
        to={user.role === 'admin' ? '/admin' : '/sme'}
        replace
      />
    );
  }

  return <Outlet />;
};

const DashboardLayout = () => {
  return (
    <div className="dashboard-layout">
      <Sidebar />

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
};

const AppRoutes = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="loading-screen">Loading...</div>;
  }

  return (
    <Routes>

      <Route
        path="/login"
        element={
          user
            ? <Navigate to={user.role === 'admin' ? '/admin' : '/sme'} replace />
            : <Login />
        }
      />

      <Route element={<ProtectedRoute role="admin" />}>
        <Route element={<DashboardLayout />}>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/admin/companies" element={<AdminCompanies />} />
          <Route path="/admin/meetings" element={<AdminMeetings />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute role="sme" />}>
        <Route element={<DashboardLayout />}>
          <Route path="/sme" element={<SmeDashboard />} />
          <Route path="/sme/calendar" element={<SmeCalendar />} />
          <Route path="/sme/saved" element={<SmeSaved />} />
          <Route path="/sme/records" element={<SmeRecords />} />
        </Route>
      </Route>

      <Route
        path="/"
        element={
          <Navigate
            to={
              user
                ? user.role === 'admin' ? '/admin' : '/sme'
                : '/login'
            }
            replace
          />
        }
      />

      <Route
        path="*"
        element={
          <Navigate
            to={
              user
                ? user.role === 'admin' ? '/admin' : '/sme'
                : '/login'
            }
            replace
          />
        }
      />

    </Routes>
  );
};

const App = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
