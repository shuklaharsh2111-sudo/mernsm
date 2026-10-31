import { Navigate, Route, Routes } from 'react-router-dom';
import { AdminAuthProvider } from './context/AdminAuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AdminLayout from './components/AdminLayout';
import AdminDashboard from './pages/AdminDashboard';
import AdminSops from './pages/AdminSops';
import AdminUsers from './pages/AdminUsers';
import AdminCompanies from './pages/AdminCompanies';
import './admin.css';

export default function AdminRoutes() {
  return (
    <AdminAuthProvider>
      <Routes>
        <Route path="login" element={<Navigate to="/login" replace />} />
        <Route
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="sops" element={<AdminSops />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="companies" element={<AdminCompanies />} />
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </AdminAuthProvider>
  );
}
