import { Navigate } from 'react-router-dom';
import { useSmeAuth } from '../context/SmeAuthContext';

export default function SmeProtectedRoute({ children }) {
  const { sme, token, loading } = useSmeAuth();
  if (loading) return <p className="admin-loading">Loading…</p>;
  if (!token || !sme) return <Navigate to="/login" replace />;
  return children;
}
