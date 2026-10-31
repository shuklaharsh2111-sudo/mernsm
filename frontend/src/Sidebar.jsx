import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Settings,
  LogOut,
  CalendarDays,
  FolderOpen,
  Bookmark,
  ChartNoAxesCombined,
  FileBarChart,
  Clock,
  Building2,
  Receipt,
  CalendarCheck,
  Palette
} from 'lucide-react';

import { useAuth } from './AuthContext';

const Sidebar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const isAdmin = user?.role === 'admin';
  const isSME = user?.role === 'sme';

  // Reporting Manager with Admin fallback
  const reportingManager =
    user?.reportingManager ||
    user?.reporting_manager ||
    user?.defaultAdmin ||
    user?.adminDetails ||
    null;

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  // Admin Menu
const adminMenuItems = [
  {
    title: 'Dashboard',
    path: '/admin',
    icon: LayoutDashboard
  },
  {
    title: 'Users',
    path: '/admin/users',
    icon: Users
  },
  {
    title: 'Companies',
    path: '/admin/companies',
    icon: Building2
  },
  {
    title: 'Invoices',
    path: '/admin/invoices',
    icon: Receipt
  },
  {
    title: 'Meetings',
    path: '/admin/meetings',
    icon: CalendarCheck
  },
  {
    title: 'Creatives',
    path: '/admin/creatives',
    icon: Palette
  },
  {
    title: 'Calendar',
    path: '/admin/calendar',
    icon: CalendarDays
  }
];

  // SME Menu
  const smeMenuItems = [
    {
      title: 'Dashboard',
      path: '/sme',
      icon: LayoutDashboard
    },
    {
      title: 'Calendar',
      path: '/sme/calendar',
      icon: CalendarDays
    },
    {
      title: 'Records',
      path: '/sme/records',
      icon: FolderOpen
    },
    {
      title: 'Saved',
      path: '/sme/saved',
      icon: Bookmark
    },
    {
      title: 'Analytics',
      path: '/sme/analytics',
      icon: ChartNoAxesCombined
    },
    {
      title: 'Settings',
      path: '/sme/settings',
      icon: Settings
    },
    {
      title: 'Monthly Reports',
      path: '/sme/monthly-reports',
      icon: FileBarChart
    },
    {
      title: 'Pending Creative',
      path: '/sme/pending-creatives',
      icon: Clock
    }
  ];

  const menuItems = isAdmin ? adminMenuItems : smeMenuItems;

  return (
    <aside className="sidebar">

      {/* Sidebar Brand */}
      <div className="sidebar-brand">
        <div className="brand-icon">CM</div>

        <div>
          <h2>Unstoppable Solutions</h2>
          <span>Social Media Manager</span>
        </div>
      </div>

      {/* User Profile */}
      <div className="sidebar-profile">
        <img
          src={
            user?.avatar ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(
              user?.name || 'User'
            )}&background=6366f1&color=fff`
          }
          alt="Profile"
        />

        <div className="profile-info">
          <h3>{user?.name}</h3>
          <p>{user?.email}</p>

          <span className={`role-tag ${user?.role}`}>
            {user?.role?.toUpperCase()}
          </span>

          {/* Reporting Manager - SME Only */}
          {isSME && (
            <div className="reporting-manager-info">
              <span className="reporting-manager-label">
                Reporting Manager
              </span>

              <h4>
                {reportingManager?.name || 'Admin'}
              </h4>

              <p>
                {reportingManager?.email || 'Admin email unavailable'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Sidebar Navigation */}
      <div className="sidebar-menu">
        <p className="menu-heading">MAIN MENU</p>

        {menuItems.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/admin' || item.path === '/sme'}
              className={({ isActive }) =>
                `menu-link ${isActive ? 'active' : ''}`
              }
            >
              <Icon size={19} />
              <span>{item.title}</span>
            </NavLink>
          );
        })}
      </div>

      {/* Logout */}
      <div className="sidebar-bottom">
        <button
          className="logout-button"
          onClick={handleLogout}
        >
          <LogOut size={19} />
          <span>Logout</span>
        </button>
      </div>

    </aside>
  );
};

export default Sidebar;