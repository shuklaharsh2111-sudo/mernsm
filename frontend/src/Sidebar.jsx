import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, useNavigate } from 'react-router-dom';
import { LogOut, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import { useAuth } from './AuthContext';
import { navFor } from './navConfig';
const initialsOf = (name = 'User') =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('') || 'U';
const Sidebar = ({ collapsed = false, onToggle, mobileOpen = false, onClose }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isSME = user?.role === 'sme';
  const groups = navFor(user?.role);
  const manager =
    user?.reportingManager || user?.reporting_manager || user?.defaultAdmin || user?.adminDetails || null;
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  // Close the confirmation with Esc (unless the logout is already running)
  useEffect(() => {
    if (!confirmOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape' && !loggingOut) setConfirmOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirmOpen, loggingOut]);
  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      navigate('/login', { replace: true });
    } finally {
      setLoggingOut(false);
      setConfirmOpen(false);
    }
  };
  return (
    <aside className={`app-sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'open' : ''}`} aria-label="Main navigation">
      {/* 1. Brand */}
      <div className="side-brand">
        <div className="side-logo">N</div>
        <div className="side-brand-text">
          <strong>Neuro</strong>
          <span>Complete Social Media Management</span>
        </div>
        <button type="button" className="side-close" onClick={onClose} aria-label="Close menu"><X size={18} /></button>
      </div>
      {/* 2. Navigation (the only part that scrolls) */}
      <nav className="side-nav">
        {groups.map((g) => (
          <div className="side-group" key={g.heading}>
            <p className="side-heading">{g.heading}</p>
            {g.items.map(({ title, path, icon: Icon }) => (
              <NavLink
                key={path}
                to={path}
                end={['/admin', '/sme', '/des', '/smi', '/hr'].includes(path)}
                title={collapsed ? title : undefined}
                className={({ isActive }) => `side-link ${isActive ? 'active' : ''}`}
              >
                <Icon size={18} />
                <span>{title}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      {/* 3. Account: collapse, profile, logout */}
      <div className="side-footer">
        <button
          type="button"
          className="side-collapse"
          onClick={onToggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
          <span>Collapse</span>
        </button>
        <div className="side-user">
          {user?.avatar
            ? <img src={user.avatar} alt="" />
            : <div className="side-avatar">{initialsOf(user?.name)}</div>}
          <div className="side-user-info">
            <strong>{user?.name}</strong>
            <span>{user?.email}</span>
            <em className={`side-role ${user?.role}`}>{user?.role?.toUpperCase()}</em>
          </div>
        </div>
        {isSME && (
          <div className="side-manager">
            <span>Reporting manager</span>
            <strong>{manager?.name || 'Admin'}</strong>
          </div>
        )}
        <button type="button" className="side-logout" onClick={() => setConfirmOpen(true)} title={collapsed ? 'Logout' : undefined}>
          <LogOut size={18} />
          <span>Logout</span>
        </button>
      </div>
      {confirmOpen && createPortal(
        <div
          className="logout-confirm-backdrop"
          onClick={() => { if (!loggingOut) setConfirmOpen(false); }}
        >
          <div
            className="logout-confirm-card"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="logout-confirm-title"
            aria-describedby="logout-confirm-text"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="logout-confirm-icon"><LogOut size={22} /></div>
            <h3 id="logout-confirm-title">Log out?</h3>
            <p id="logout-confirm-text">Are you sure you want to log out of your account?</p>
            <div className="logout-confirm-actions">
              <button type="button" className="logout-confirm-cancel" onClick={() => setConfirmOpen(false)} disabled={loggingOut} autoFocus>
                Cancel
              </button>
              <button type="button" className="logout-confirm-yes" onClick={handleLogout} disabled={loggingOut}>
                {loggingOut ? 'Logging out…' : 'Yes, log out'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </aside>
  );
};
export default Sidebar;
