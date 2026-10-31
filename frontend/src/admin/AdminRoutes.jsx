import { Navigate, Route, Routes } from 'react-router-dom';
import { AdminAuthProvider } from './context/AdminAuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AdminLayout from './components/AdminLayout';
import AdminDashboard from './pages/AdminDashboard';
import AdminSops from './pages/AdminSops';
import AdminUsers from './pages/AdminUsers';
<<<<<<< HEAD
import AdminCompanies from './pages/AdminCompanies';
=======
<<<<<<< HEAD
import AdminCompanies from './pages/AdminCompanies';
=======
>>>>>>> adc7900227aadaf9e0a6f9f972499593c8ff0896
>>>>>>> c86954fd1b281ba1f0f38af41524f26256ebf5f0
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
<<<<<<< HEAD
          <Route path="companies" element={<AdminCompanies />} />
=======
<<<<<<< HEAD
          <Route path="companies" element={<AdminCompanies />} />
=======
>>>>>>> adc7900227aadaf9e0a6f9f972499593c8ff0896
>>>>>>> c86954fd1b281ba1f0f38af41524f26256ebf5f0
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </AdminAuthProvider>
  );
}
