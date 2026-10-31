
import { useAuth } from '../AuthContext';
import {
  LayoutDashboard,
  Users,
  Activity
} from 'lucide-react';

const AdminDashboard = () => {
  const { user } = useAuth();

  return (
    <div className="dashboard-content">

      <div className="page-header">
        <div>
          <span className="page-label">ADMINISTRATION</span>
          <h1>Welcome, {user?.name}</h1>
          <p>Manage your organization from one place.</p>
        </div>

        <span className="header-role">ADMIN</span>
      </div>

      <div className="stats-grid">

        <div className="stat-card">
          <div className="stat-icon purple">
            <LayoutDashboard />
          </div>
          <span>Total Modules</span>
          <h2>01</h2>
        </div>

        <div className="stat-card">
          <div className="stat-icon blue">
            <Users />
          </div>
          <span>Management</span>
          <h2>Admin</h2>
        </div>

        <div className="stat-card">
          <div className="stat-icon green">
            <Activity />
          </div>
          <span>Account Status</span>
          <h2>Active</h2>
        </div>

      </div>

      <div className="welcome-card">
        <h2>Admin Dashboard</h2>
        <p>
          Your administrator workspace is ready.
          New management modules can be added here.
        </p>
      </div>

    </div>
  );
};

export default AdminDashboard;
