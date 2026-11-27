import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck, Users, Building2, Wifi, LogIn, Palette, CalendarCheck, ListChecks,
  UserPlus, Crown, ArrowRight
} from 'lucide-react';
import api from '../api';
import { errMsg } from '../sopUtils';
import { roleName } from '../roleNames';
import '../style.css';
import '../styles/dashboard-glass.css';
import './superadmin.css';

const initialsOf = (name = '') => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('') || 'U';
const fmtJoined = (d) => {
  const date = d ? new Date(d) : null;
  return date && !Number.isNaN(date.getTime())
    ? date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';
};

const QUICK = [
  { title: 'Create Admin', text: 'Add a new admin account', path: '/superadmin/create-admin', icon: UserPlus },
  { title: 'Manage Admins', text: 'Super admin rights, passwords, removal', path: '/superadmin/manage-admins', icon: Crown },
  { title: 'All Users', text: 'Everyone, department by department', path: '/admin/users', icon: Users },
];

// Super admin only: numbers for the whole system.
const SuperOverview = () => {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    api.get('/superadmin/overall')
      .then((r) => !cancelled && setData(r.data))
      .catch((err) => !cancelled && setError(errMsg(err)));
    return () => { cancelled = true; };
  }, []);

  const v = (n) => (data ? n : '–');
  const maxDept = data ? Math.max(1, ...data.departments.map((d) => d.total)) : 1;

  return (
    <div className="dashboard-content scrollable dash-glass">
      <div className="page-header">
        <div>
          <span className="page-label">SUPER ADMIN</span>
          <h1>Overall Dashboard</h1>
          <p>Everything across all admins, departments and companies in one place.</p>
        </div>
      </div>

      {error && <p className="error-message" role="alert">{error}</p>}

      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-top"><span className="kpi-label">Admins</span><span className="kpi-icon"><ShieldCheck size={17} /></span></div>
          <strong className="kpi-value">{v(data?.admins.total)}</strong>
          <span className="kpi-sub">{data ? `${data.admins.superAdmins} super · ${data.admins.normal} normal` : 'Loading…'}</span>
        </div>
        <div className="kpi-card">
          <div className="kpi-top"><span className="kpi-label">Employees</span><span className="kpi-icon"><Users size={17} /></span></div>
          <strong className="kpi-value">{v(data?.employees)}</strong>
          <span className="kpi-sub">Across all departments</span>
        </div>
        <div className="kpi-card">
          <div className="kpi-top"><span className="kpi-label">Companies</span><span className="kpi-icon"><Building2 size={17} /></span></div>
          <strong className="kpi-value">{v(data?.companies)}</strong>
          <span className="kpi-sub">Client accounts</span>
        </div>
        <div className="kpi-card green">
          <div className="kpi-top"><span className="kpi-label">Online now</span><span className="kpi-icon"><Wifi size={17} /></span></div>
          <strong className="kpi-value">{v(data?.activity.onlineNow)}</strong>
          <span className="kpi-sub">Signed in, not logged out</span>
        </div>
        <div className="kpi-card amber">
          <div className="kpi-top"><span className="kpi-label">Logins today</span><span className="kpi-icon"><LogIn size={17} /></span></div>
          <strong className="kpi-value">{v(data?.activity.loginsToday)}</strong>
          <span className="kpi-sub">People who signed in today</span>
        </div>
        <div className="kpi-card red">
          <div className="kpi-top"><span className="kpi-label">Creatives to review</span><span className="kpi-icon"><Palette size={17} /></span></div>
          <strong className="kpi-value">{v(data?.creatives.pending)}</strong>
          <span className="kpi-sub">Waiting for approval</span>
        </div>
      </div>

      <div className="dash-section-title">People by department</div>
      <div className="glass-panel">
        {!data ? <p className="muted">Loading…</p> : (
          <div className="so-bars">
            {data.departments.map((d) => (
              <Link to="/admin/users" className="so-bar-row" key={d.role}>
                <span className="so-bar-label">{roleName(d.role)}</span>
                <span className="so-bar-track"><i style={{ width: `${(d.total / maxDept) * 100}%` }} /></span>
                <span className="so-bar-count">{d.total}{d.banned ? <small> · {d.banned} banned</small> : null}</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="dash-section-title">Work across the system</div>
      <div className="so-work-row">
        <div className="glass-panel">
          <h2><Palette size={16} /> Creatives</h2>
          <div className="so-stats">
            <div><strong>{v(data?.creatives.total)}</strong><span>Total</span></div>
            <div className="good"><strong>{v(data?.creatives.approved)}</strong><span>Approved</span></div>
            <div className="warn"><strong>{v(data?.creatives.pending)}</strong><span>Pending</span></div>
            <div className="bad"><strong>{v(data?.creatives.rejected)}</strong><span>Rejected</span></div>
          </div>
        </div>
        <div className="glass-panel">
          <h2><CalendarCheck size={16} /> Meeting MOMs</h2>
          <div className="so-stats">
            <div className="good"><strong>{v(data?.moms.approved)}</strong><span>Approved</span></div>
            <div className="warn"><strong>{v(data?.moms.pending)}</strong><span>Pending</span></div>
          </div>
        </div>
        <div className="glass-panel">
          <h2><ListChecks size={16} /> Tasks</h2>
          <div className="so-stats">
            <div><strong>{v(data?.tasks.new)}</strong><span>New</span></div>
            <div className="warn"><strong>{v(data?.tasks.inProgress)}</strong><span>In progress</span></div>
            <div className="good"><strong>{v(data?.tasks.completed)}</strong><span>Completed</span></div>
          </div>
        </div>
      </div>

      <div className="sop-meeting-row">
        <div className="glass-panel">
          <h2>Latest admins</h2>
          {!data ? <p className="muted">Loading…</p> : data.recentAdmins.map((a) => (
            <div className="so-person" key={a.id}>
              <span className="so-avatar">{a.profileImage ? <img src={a.profileImage} alt="" /> : initialsOf(a.name)}</span>
              <span className="so-person-text"><strong>{a.name}</strong><small>{a.email}</small></span>
              <span className={`so-tag${a.isSuperAdmin ? ' super' : ''}`}>{a.isSuperAdmin ? 'Super Admin' : 'Admin'}</span>
            </div>
          ))}
          <Link to="/superadmin/manage-admins" className="dash-btn" style={{ marginTop: 14 }}>Manage admins <ArrowRight size={15} /></Link>
        </div>
        <div className="glass-panel">
          <h2>Recently added employees</h2>
          {!data ? <p className="muted">Loading…</p> : data.recentUsers.length === 0 ? (
            <p className="muted">No employees yet.</p>
          ) : data.recentUsers.map((u) => (
            <div className="so-person" key={`${u.collection}-${u.id}`}>
              <span className="so-avatar">{u.profileImage ? <img src={u.profileImage} alt="" /> : initialsOf(u.name)}</span>
              <span className="so-person-text"><strong>{u.name}</strong><small>{roleName(u.role)} · {fmtJoined(u.createdAt)}</small></span>
            </div>
          ))}
          <Link to="/admin/users" className="dash-btn" style={{ marginTop: 14 }}>Open users <ArrowRight size={15} /></Link>
        </div>
      </div>

      <div className="dash-section-title">Quick access</div>
      <div className="quick-grid">
        {QUICK.map(({ title, text, path, icon: Icon }) => (
          <Link to={path} className="quick-card" key={path}>
            <span className="kpi-icon"><Icon size={19} /></span>
            <div><strong>{title}</strong><span>{text}</span></div>
            <ArrowRight size={16} />
          </Link>
        ))}
      </div>
    </div>
  );
};

export default SuperOverview;
