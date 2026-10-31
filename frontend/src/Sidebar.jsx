
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Settings,
  LogOut,
  Briefcase
} from 'lucide-react';

import { useAuth } from './AuthContext';

const Sidebar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const isAdmin = user?.role === 'admin';

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const menuItems = isAdmin
    ? [
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
          title: 'Settings',
          path: '/admin/settings',
          icon: Settings
        }
      ]
    : [
        {
          title: 'Dashboard',
          path: '/sme',
          icon: LayoutDashboard
        },
        {
          title: 'Companies',
          path: '/sme/companies',
          icon: Briefcase
        },
        {
          title: 'Settings',
          path: '/sme/settings',
          icon: Settings
        }
      ];

  return (
    <aside className="sidebar">

      <div className="sidebar-brand">
        <div className="brand-icon">CM</div>
        <div>
          <h2>Creative Manager</h2>
          <span>Management Portal</span>
        </div>
      </div>

      <div className="sidebar-profile">
        <img
          src={
            user?.avatar ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'User')}&background=6366f1&color=fff`
          }
          alt="Profile"
        />

        <div className="profile-info">
          <h3>{user?.name}</h3>
          <p>{user?.email}</p>
          <span className={`role-tag ${user?.role}`}>
            {user?.role?.toUpperCase()}
          </span>
        </div>
      </div>

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
