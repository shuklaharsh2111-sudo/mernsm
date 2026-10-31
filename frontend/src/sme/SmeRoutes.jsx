import { Navigate, Route, Routes } from 'react-router-dom';
import { SmeAuthProvider } from './context/SmeAuthContext';
import SmeProtectedRoute from './components/SmeProtectedRoute';
import SmeLayout from './components/SmeLayout';
import SmeRegister from './pages/SmeRegister';
import SmeDashboard from './pages/SmeDashboard';
import SmeSops from './pages/SmeSops';
import '../admin/admin.css';

export default function SmeRoutes() {
  return (
    <SmeAuthProvider>
      <Routes>
        <Route path="register" element={<SmeRegister />} />
        <Route
          element={
            <SmeProtectedRoute>
              <SmeLayout />
            </SmeProtectedRoute>
          }
        >
          <Route path="dashboard" element={<SmeDashboard />} />
          <Route path="sops" element={<SmeSops />} />
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </SmeAuthProvider>
  );
}
