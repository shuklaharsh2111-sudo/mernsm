import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, UserCheck, UserX, Wifi, Clock, UserPlus, ArrowRight, RefreshCw } from 'lucide-react';
import api from '../api';
import { useAuth } from '../AuthContext';
import { errMsg } from '../sopUtils';
import { roleName } from '../roleNames';
import { initialsOf, fmtTime, fmtDate, dayKey } from './hrUtils';
import '../style.css';
import '../styles/dashboard-glass.css';
import '../styles/hr.css';

const Avatar = ({ name, src }) => (
  <div className="hr-avatar">{src ? <img src={src} alt={name} /> : initialsOf(name)}</div>
);

const HrDashboard = () => {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api.get('/hr/dashboard')
      .then((res) => { if (!cancelled) { setData(res.data); setError(''); } })
      .catch((err) => { if (!cancelled) setError(errMsg(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [reloadKey]);

  const s = data?.summary;
  const val = (n) => (s ? n : '–');
  const maxPresent = Math.max(1, ...(data?.trend || []).map((t) => t.present));
  const roleEntries = Object.entries(data?.roleCounts || {}).sort((a, b) => b[1] - a[1]);
  const maxRole = Math.max(1, ...roleEntries.map(([, n]) => n));
  const todayKey = dayKey(new Date());
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="dashboard-content scrollable dash-glass hr-page">
      <div className="dash-hero">
        <div>
          <span className="page-label">HUMAN RESOURCES</span>
          <h1>{greeting}, {user?.name?.split(' ')[0] || 'HR'}</h1>
          <p>Track headcount and today's attendance across the team.</p>
        </div>
        <button type="button" className="dash-btn" onClick={() => { setLoading(true); setReloadKey((k) => k + 1); }} disabled={loading}>
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      {error && <p className="error-message" role="alert">{error}</p>}

      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-top"><span className="kpi-label">Total employees</span><span className="kpi-icon"><Users size={17} /></span></div>
          <div className="kpi-value">{val(s?.totalEmployees)}</div>
          <div className="kpi-sub">{val(s?.newThisMonth)} joined in the last 30 days</div>
        </div>
        <div className="kpi-card green">
          <div className="kpi-top"><span className="kpi-label">Present today</span><span className="kpi-icon"><UserCheck size={17} /></span></div>
          <div className="kpi-value">{val(s?.presentToday)}</div>
          <div className="kpi-sub">{val(s?.attendanceRate)}% attendance</div>
          <div className="kpi-bar"><i style={{ width: `${s?.attendanceRate || 0}%` }} /></div>
        </div>
        <div className="kpi-card red">
          <div className="kpi-top"><span className="kpi-label">Absent today</span><span className="kpi-icon"><UserX size={17} /></span></div>
          <div className="kpi-value">{val(s?.absentToday)}</div>
          <div className="kpi-sub">No login recorded yet</div>
        </div>
        <div className="kpi-card green">
          <div className="kpi-top"><span className="kpi-label">Online now</span><span className="kpi-icon"><Wifi size={17} /></span></div>
          <div className="kpi-value">{val(s?.onlineNow)}</div>
          <div className="kpi-sub">Logged in, not signed out</div>
        </div>
        <div className="kpi-card amber">
          <div className="kpi-top"><span className="kpi-label">Late today</span><span className="kpi-icon"><Clock size={17} /></span></div>
          <div className="kpi-value">{val(s?.lateToday)}</div>
          <div className="kpi-sub">First login after {data?.lateAfter || '10:30'}</div>
        </div>
      </div>

      <div className="hr-grid">
        <section className="hr-card">
          <div className="hr-card-head">
            <h3>Attendance — last 7 days</h3>
            <small>Employees who logged in</small>
          </div>
          <div className="hr-bars">
            {(data?.trend || []).map((t) => (
              <div key={t.date} className={`hr-bar ${t.date === todayKey ? 'today' : ''}`} title={`${t.present} present · avg ${t.avgHours}h`}>
                <b>{t.present}</b>
                <i style={{ height: `${(t.present / maxPresent) * 100}%` }} />
                <span>{new Date(`${t.date}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short' })}</span>
              </div>
            ))}
            {!data && <p className="hr-empty">{loading ? 'Loading…' : 'No data'}</p>}
          </div>
        </section>

        <section className="hr-card">
          <div className="hr-card-head"><h3>Headcount by role</h3><small>{s?.totalEmployees ?? 0} total</small></div>
          <div className="hr-roles">
            {roleEntries.length === 0 && <p className="hr-empty">{loading ? 'Loading…' : 'No employees yet'}</p>}
            {roleEntries.map(([role, n]) => (
              <div key={role} className="hr-role-row">
                <span>{roleName(role)}</span>
                <div className="hr-role-track"><i style={{ width: `${(n / maxRole) * 100}%` }} /></div>
                <em>{n}</em>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="hr-grid even">
        <section className="hr-card">
          <div className="hr-card-head"><h3>In today</h3><small>{data?.presentToday.length ?? 0} people</small></div>
          <div className="hr-list">
            {data && data.presentToday.length === 0 && <p className="hr-empty">Nobody has logged in yet today.</p>}
            {(data?.presentToday || []).map((p) => (
              <div className="hr-person" key={p.id}>
                <Avatar name={p.name} src={p.profileImage} />
                <div className="hr-person-main">
                  <strong>{p.name}</strong>
                  <span>{roleName(p.role)}</span>
                </div>
                {p.late && <span className="hr-pill late">Late</span>}
                <span className={`hr-pill ${p.online ? 'online' : 'left'}`}>{p.online ? 'Online' : 'Left'}</span>
                <span className="hr-person-time">{fmtTime(p.firstLogin)}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="hr-card">
          <div className="hr-card-head"><h3>Not in yet</h3><small>{data?.absentToday.length ?? 0} people</small></div>
          <div className="hr-list">
            {data && data.absentToday.length === 0 && <p className="hr-empty">Everyone has logged in today. 🎉</p>}
            {(data?.absentToday || []).map((p) => (
              <div className="hr-person" key={p.id}>
                <Avatar name={p.name} src={p.profileImage} />
                <div className="hr-person-main">
                  <strong>{p.name}</strong>
                  <span>{roleName(p.role)}</span>
                </div>
                <span className="hr-pill absent">Absent</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="hr-card">
        <div className="hr-card-head">
          <h3><UserPlus size={15} style={{ verticalAlign: '-2px', marginRight: 6 }} />New joiners</h3>
          <Link to="/hr/employees" className="dash-btn">View all employees <ArrowRight size={14} /></Link>
        </div>
        <div className="hr-list">
          {data && data.newJoiners.length === 0 && <p className="hr-empty">No one has joined in the last 30 days.</p>}
          {(data?.newJoiners || []).map((p) => (
            <div className="hr-person" key={p.id}>
              <Avatar name={p.name} src={p.profileImage} />
              <div className="hr-person-main"><strong>{p.name}</strong><span>{roleName(p.role)}</span></div>
              <span className="hr-person-time">{fmtDate(p.joinedAt)}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default HrDashboard;
