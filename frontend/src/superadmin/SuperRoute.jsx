import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../AuthContext';

// Pages only a super admin can open; everyone else goes back to the normal admin dashboard.
const SuperRoute = () => {
  const { user } = useAuth();
  if (!user?.isSuperAdmin) return <Navigate to="/admin" replace />;
  return <Outlet />;
};

export default SuperRoute;
