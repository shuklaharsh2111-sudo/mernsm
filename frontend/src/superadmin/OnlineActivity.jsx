import { useEffect, useMemo, useState } from 'react';
import { Search, RefreshCw, Wifi, WifiOff, History, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../api';
import { errMsg } from '../sopUtils';
import { roleName, ROLE_NAMES } from '../roleNames';
import { initialsOf, fmtTime, fmtDuration, dayKey } from '../hr/hrUtils';
import '../style.css';
import '../styles/dashboard-glass.css';
import '../styles/hr.css';
import './superadmin.css';

const ROLES = Object.keys(ROLE_NAMES);
const REFRESH_MS = 30000;
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return dayKey(d); };

const Avatar = ({ name, src }) => (
  <div className="hr-avatar">{src ? <img src={src} alt={name} /> : initialsOf(name)}</div>
);

/* ONLINE NOW */
const OnlineNow = () => {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = () => api.get('/superadmin/presence')
      .then((res) => { if (!cancelled) { setData(res.data); setError(''); } })
      .catch((err) => { if (!cancelled) setError(errMsg(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => { cancelled = true; clearInterval(timer); };
  }, [reloadKey]);

  const { online, offline } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const people = (data?.people || []).filter((p) => (!q || p.name.toLowerCase().includes(q)) && (!role || p.role === role));
    return { online: people.filter((p) => p.online), offline: people.filter((p) => !p.online) };
  }, [data, query, role]);
  const s = data?.summary;

  return (
    <>
      <div className="hr-subhead">
        <strong>Who is signed in right now</strong>
        <span>Everyone across all departments. Updates every 30 seconds.</span>
        <button type="button" className="btn-primary" onClick={() => { setLoading(true); setReloadKey((k) => k + 1); }} disabled={loading}>
          <RefreshCw size={15} /> Refresh
        </button>
      </div>
      {error && <p className="error-message" role="alert">{error}</p>}
      <div className="kpi-grid">
        <div className="kpi-card green">
          <div className="kpi-top"><span className="kpi-label">Online</span><span className="kpi-icon"><Wifi size={17} /></span></div>
          <div className="kpi-value">{s ? s.online : '–'}</div>
          <div className="kpi-sub">Signed in right now</div>
        </div>
        <div className="kpi-card red">
          <div className="kpi-top"><span className="kpi-label">Offline</span><span className="kpi-icon"><WifiOff size={17} /></span></div>
          <div className="kpi-value">{s ? s.offline : '–'}</div>
          <div className="kpi-sub">Signed out or not in yet today</div>
        </div>
      </div>
      <div className="hr-toolbar">
        <div className="hr-search">
          <Search size={15} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name" />
        </div>
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">Everyone</option>
          {ROLES.map((r) => <option key={r} value={r}>{roleName(r)}</option>)}
        </select>
      </div>
      <div className="hr-grid even">
        <section className="hr-card">
          <div className="hr-card-head"><h3>Online</h3><small>{online.length} people</small></div>
          <div className="hr-list">
            {data && online.length === 0 && <p className="hr-empty">Nobody is online.</p>}
            {online.map((p) => (
              <div className="hr-person" key={`${p.role}-${p.id}`}>
                <Avatar name={p.name} src={p.profileImage} />
                <div className="hr-person-main"><strong>{p.name}</strong><span>{roleName(p.role)}</span></div>
                <span className="hr-pill online">Online</span>
                <span className="hr-person-time">since {fmtTime(p.firstLogin)}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="hr-card">
          <div className="hr-card-head"><h3>Offline</h3><small>{offline.length} people</small></div>
          <div className="hr-list">
            {data && offline.length === 0 && <p className="hr-empty">Everyone is online.</p>}
            {offline.map((p) => (
              <div className="hr-person" key={`${p.role}-${p.id}`}>
                <Avatar name={p.name} src={p.profileImage} />
                <div className="hr-person-main"><strong>{p.name}</strong><span>{roleName(p.role)}</span></div>
                <span className={`hr-pill ${p.lastLogout ? 'left' : 'absent'}`}>{p.lastLogout ? 'Left' : 'Not in yet'}</span>
                {p.lastLogout && <span className="hr-person-time">{fmtTime(p.lastLogout)}</span>}
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
};

/* LOGIN HISTORY (pick a day, see every login and logout) */
const LoginHistory = () => {
  const [date, setDateRaw] = useState(daysAgo(1));
  const [role, setRoleRaw] = useState('');
  const [query, setQuery] = useState('');
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const today = dayKey(new Date());
  const setDate = (v) => { if (v) { setLoading(true); setDateRaw(v); } };
  const setRole = (v) => { setLoading(true); setRoleRaw(v); };
  const shiftDay = (n) => {
    const d = new Date(`${date}T12:00:00`);
    d.setDate(d.getDate() + n);
    setDate(dayKey(d));
  };

  useEffect(() => {
    let cancelled = false;
    api.get('/superadmin/login-history', { params: { from: date, to: date, role: role || undefined, limit: 2000 } })
      .then((res) => { if (!cancelled) { setRecords(res.data.records || []); setError(''); } })
      .catch((err) => { if (!cancelled) setError(errMsg(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [date, role, reloadKey]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? records.filter((r) => `${r.name || ''} ${r.email || ''}`.toLowerCase().includes(q)) : records;
  }, [records, query]);
  const stats = useMemo(() => ({
    sessions: shown.length,
    people: new Set(shown.map((r) => r.userId)).size,
    open: shown.filter((r) => !r.logoutAt).length,
  }), [shown]);

  return (
    <>
      <div className="hr-subhead">
        <strong>{new Date(`${date}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</strong>
        <span>Pick a day to see every login and logout on that day.</span>
        <button type="button" className="btn-primary" onClick={() => { setLoading(true); setReloadKey((k) => k + 1); }}>
          <RefreshCw size={15} /> Refresh
        </button>
      </div>
      {error && <p className="error-message" role="alert">{error}</p>}
      <div className="hr-toolbar">
        <div className="hr-daypick">
          <button type="button" onClick={() => shiftDay(-1)} aria-label="Previous day"><ChevronLeft size={16} /></button>
          <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} aria-label="Date" />
          <button type="button" onClick={() => shiftDay(1)} disabled={date >= today} aria-label="Next day"><ChevronRight size={16} /></button>
        </div>
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">Everyone</option>
          {ROLES.map((r) => <option key={r} value={r}>{roleName(r)}</option>)}
        </select>
        <div className="hr-search">
          <Search size={15} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name or email" />
        </div>
        <div className="hr-chips">
          <button type="button" className={date === today ? 'active' : ''} onClick={() => setDate(today)}>Today</button>
          <button type="button" className={date === daysAgo(1) ? 'active' : ''} onClick={() => setDate(daysAgo(1))}>Yesterday</button>
        </div>
      </div>
      <div className="kpi-grid">
        <div className="kpi-card"><span className="kpi-label">Sessions</span><div className="kpi-value">{stats.sessions}</div></div>
        <div className="kpi-card green"><span className="kpi-label">People</span><div className="kpi-value">{stats.people}</div></div>
        <div className="kpi-card amber"><span className="kpi-label">No logout yet</span><div className="kpi-value">{stats.open}</div></div>
      </div>
      {loading ? (
        <p className="muted">Loading…</p>
      ) : (
        <div className="hr-table-wrap">
          <table className="hr-table">
            <thead>
              <tr><th>User</th><th>Role</th><th>Login</th><th>Logout</th><th>Duration</th></tr>
            </thead>
            <tbody>
              {shown.length === 0 && <tr><td colSpan={5}><p className="hr-empty">No sessions on this day.</p></td></tr>}
              {shown.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div className="hr-cell-user">
                      <div className="hr-avatar">{initialsOf(r.name)}</div>
                      <div><strong>{r.name}</strong><span>{r.email}</span></div>
                    </div>
                  </td>
                  <td>{roleName(r.role)}</td>
                  <td>{fmtTime(r.loginAt)}</td>
                  <td>{r.logoutAt ? fmtTime(r.logoutAt) : <span className="hr-pill online">Active</span>}</td>
                  <td>{fmtDuration(r.loginAt, r.logoutAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
};

// Super admin only: who is online now + login history, for every role (same layout as the HR pages).
const OnlineActivity = () => {
  const [tab, setTab] = useState('online');
  return (
    <div className="dashboard-content scrollable dash-glass hr-page">
      <div className="page-header">
        <div>
          <span className="page-label">SUPER ADMIN</span>
          <h1>Online &amp; Login History</h1>
          <p>See who is signed in right now and look back at every login and logout.</p>
        </div>
      </div>
      <div className="hr-tabs" role="tablist" aria-label="Activity view">
        <button type="button" role="tab" aria-selected={tab === 'online'} className={tab === 'online' ? 'active' : ''} onClick={() => setTab('online')}>
          <Wifi size={15} /> Online now
        </button>
        <button type="button" role="tab" aria-selected={tab === 'history'} className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>
          <History size={15} /> Login history
        </button>
      </div>
      {tab === 'online' && <OnlineNow />}
      {tab === 'history' && <LoginHistory />}
    </div>
  );
};

export default OnlineActivity;
