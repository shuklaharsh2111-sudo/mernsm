
import { useAuth } from '../AuthContext';
import {
  LayoutDashboard,
  Briefcase,
  Activity
} from 'lucide-react';

const SmeDashboard = () => {
  const { user } = useAuth();

  return (
    <div className="dashboard-content">

      <div className="page-header">
        <div>
          <span className="page-label">SME WORKSPACE</span>
          <h1>Welcome, {user?.name}</h1>
          <p>Manage your assigned work and activities.</p>
        </div>

        <span className="header-role sme-role">SME</span>
      </div>

      <div className="stats-grid">

        <div className="stat-card">
          <div className="stat-icon purple">
            <LayoutDashboard />
          </div>
          <span>Dashboard</span>
          <h2>SME</h2>
        </div>

        <div className="stat-card">
          <div className="stat-icon blue">
            <Briefcase />
          </div>
          <span>Workspace</span>
          <h2>Active</h2>
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
        <h2>SME Dashboard</h2>
        <p>
          Your SME workspace is ready.
          Your future modules will be added here.
        </p>
      </div>

    </div>
  );
};

export default SmeDashboard;
