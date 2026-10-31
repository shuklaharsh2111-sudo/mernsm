import { Navigate } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';

export default function ProtectedRoute({ children }) {
  const { admin, token, loading } = useAdminAuth();
  if (loading) return <p className="admin-loading">Loading…</p>;
  if (!token || !admin) return <Navigate to="/login" replace />;
  return children;
}
