
import { useAuth } from '../AuthContext';
import { useEffect, useState } from 'react';
import "../style.css";
import {
  LayoutDashboard,
  Users,
  Activity,
  Clock3
} from 'lucide-react';

const AdminDashboard = () => {
  const { user } = useAuth();

  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDate(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const hour = currentDate.getHours();

  const greeting =
    hour < 12
      ? 'Good Morning'
      : hour < 17
      ? 'Good Afternoon'
      : 'Good Evening';

  const formattedDate = currentDate.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

  const formattedTime = currentDate.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });

  return (
    <div className="dashboard-content">

      {/* Dashboard Top Header */}
      <div className="dashboard-topbar">

        <div className="dashboard-greeting">
          <span className="page-label">ADMINISTRATION</span>

          <h1>
            {greeting}, {user?.name || 'Admin'}!
          </h1>

          <p>Welcome back! Here's your overview.</p>
        </div>

        <div className="dashboard-live-clock">

          <div className="live-date">
            {formattedDate}
          </div>

          <div className="live-time-row">
            <Clock3 size={17} />

            <span className="live-time">
              {formattedTime}
            </span>

            <span className="live-indicator">
              <span className="live-dot"></span>
              LIVE
            </span>
          </div>

        </div>

      </div>

      {/* Statistics */}
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

      {/* Welcome Card */}
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
