import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Search, CalendarClock, History, CalendarDays, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import api from '../api';
import { errMsg } from '../sopUtils';
import { roleName } from '../roleNames';
import { initialsOf, fmtTime, fmtDuration, dayKey } from './hrUtils';
import '../style.css';
import '../styles/dashboard-glass.css';
import '../styles/hr.css';
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return dayKey(d); };
const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const ROLES = ['reporting_manager', 'sme', 'smi', 'des', 'hr'];
const REFRESH_MS = 30000;
const Avatar = ({ name, src }) => (
  <div className="hr-avatar">{src ? <img src={src} alt={name} /> : initialsOf(name)}</div>
);
const toMinutes = (hhmm = '10:30') => {
  const [h, m] = String(hhmm).split(':').map((n) => parseInt(n, 10));
  return (Number.isNaN(h) ? 10 : h) * 60 + (Number.isNaN(m) ? 30 : m);
};
const fmtMins = (mins) => (mins > 0 ? `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m` : '—');
const formatAverageTime = (minutes) => {
  if (minutes === null || minutes === undefined) return '—';
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${suffix}`;
};
const formatDay = (value) => new Date(`${value}T12:00:00`).toLocaleDateString('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  weekday: 'short'
});
/* CURRENT DAY */
const CurrentDay = () => {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('all');
  const [updated, setUpdated] = useState(null);
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      const today = dayKey(new Date());
      return Promise.all([
        api.get('/hr/presence'),
        api.get('/hr/attendance', { params: { from: today, to: today, limit: 2000 } })
      ])
        .then(([p, a]) => {
          if (cancelled) return;
          setData({ people: p.data.people || [], records: a.data.records || [], lateAfter: a.data.lateAfter });
          setUpdated(new Date());
          setError('');
        })
        .catch((err) => { if (!cancelled) setError(errMsg(err)); })
        .finally(() => { if (!cancelled) setLoading(false); });
    };
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => { cancelled = true; clearInterval(timer); };
  }, [reloadKey]);
  const rows = useMemo(() => {
    if (!data) return [];
    const lateMin = toMinutes(data.lateAfter);
    const byUser = new Map();
    data.records.forEach((r) => {
      const key = String(r.userId);
      if (!byUser.has(key)) byUser.set(key, []);
      byUser.get(key).push(r);
    });
    return data.people.map((p) => {
      const sessions = (byUser.get(String(p.id)) || []).slice()
        .sort((a, b) => new Date(a.loginAt) - new Date(b.loginAt));
      const first = sessions[0];
      let total = 0;
      sessions.forEach((s) => {
        const end = s.logoutAt ? new Date(s.logoutAt) : new Date();
        total += Math.max(0, Math.round((end - new Date(s.loginAt)) / 60000));
      });
      let state = 'absent';
      if (p.online) state = 'online';
      else if (sessions.length) state = 'left';
      const fl = first ? new Date(first.loginAt) : null;
      const late = !!fl && fl.getHours() * 60 + fl.getMinutes() > lateMin;
      return {
        ...p,
        state,
        late,
        sessions: sessions.length,
        first: first?.loginAt || null,
        lastOut: p.online ? null : p.lastLogout,
        total
      };
    });
  }, [data, reloadKey, updated]);
  const counts = useMemo(() => ({
    present: rows.filter((r) => r.state !== 'absent').length,
    online: rows.filter((r) => r.state === 'online').length,
    late: rows.filter((r) => r.late).length,
    absent: rows.filter((r) => r.state === 'absent').length
  }), [rows]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (q && !r.name.toLowerCase().includes(q)) return false;
      if (role && r.role !== role) return false;
      if (status === 'late') return r.late;
      if (status !== 'all' && r.state !== status) return false;
      return true;
    });
  }, [rows, query, role, status]);
  const chips = [
    ['all', 'All', rows.length],
    ['online', 'Online', counts.online],
    ['left', 'Signed out', counts.present - counts.online],
    ['late', 'Late', counts.late],
    ['absent', 'Not in yet', counts.absent]
  ];
  return (
    <>
      <div className="hr-subhead">
        <strong>{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</strong>
        <span>{updated ? `Updated ${fmtTime(updated)} · refreshes every 30 seconds` : 'Loading…'}</span>
        <button type="button" className="btn-primary" onClick={() => { setLoading(true); setReloadKey((k) => k + 1); }} disabled={loading}>
          <RefreshCw size={15} /> Refresh
        </button>
      </div>
      {error && <p className="error-message" role="alert">{error}</p>}
      <div className="kpi-grid">
        <div className="kpi-card green"><span className="kpi-label">Present today</span><div className="kpi-value">{data ? counts.present : '–'}</div></div>
        <div className="kpi-card"><span className="kpi-label">Online now</span><div className="kpi-value">{data ? counts.online : '–'}</div></div>
        <div className="kpi-card amber"><span className="kpi-label">Late (after {data?.lateAfter || '10:30'})</span><div className="kpi-value">{data ? counts.late : '–'}</div></div>
        <div className="kpi-card red"><span className="kpi-label">Not in yet</span><div className="kpi-value">{data ? counts.absent : '–'}</div></div>
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
        <div className="hr-chips">
          {chips.map(([k, label, n]) => (
            <button key={k} type="button" className={status === k ? 'active' : ''} onClick={() => setStatus(k)}>
              {label}<em>{n}</em>
            </button>
          ))}
        </div>
      </div>
      {loading && !data ? (
        <p className="muted">Loading…</p>
      ) : (
        <div className="hr-table-wrap">
          <table className="hr-table">
            <thead>
              <tr><th>Employee</th><th>Role</th><th>Status</th><th>First login</th><th>Last logout</th><th>Time today</th></tr>
            </thead>
            <tbody>
              {shown.length === 0 && <tr><td colSpan={6}><p className="hr-empty">No one matches.</p></td></tr>}
              {shown.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div className="hr-cell-user">
                      <Avatar name={r.name} src={r.profileImage} />
                      <div><strong>{r.name}</strong>{r.sessions > 1 && <span>{r.sessions} sessions</span>}</div>
                    </div>
                  </td>
                  <td>{roleName(r.role)}</td>
                  <td>
                    {r.state === 'online' && <span className="hr-pill online">Online</span>}
                    {r.state === 'left' && <span className="hr-pill left">Signed out</span>}
                    {r.state === 'absent' && <span className="hr-pill absent">Not in yet</span>}
                    {r.late && <span className="hr-pill late" style={{ marginLeft: 6 }}>Late</span>}
                  </td>
                  <td>{fmtTime(r.first)}</td>
                  <td>{r.state === 'online' ? <span className="hr-pill online">Active</span> : fmtTime(r.lastOut)}</td>
                  <td>{fmtMins(r.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
};
/* DAILY HISTORY */
const History_ = () => {
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
    api.get('/hr/attendance', { params: { from: date, to: date, role: role || undefined, limit: 2000 } })
      .then((res) => {
        if (!cancelled) {
          setRecords(res.data.records || []);
          setError('');
        }
      })
      .catch((err) => { if (!cancelled) setError(errMsg(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [date, role, reloadKey]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? records.filter((r) => (r.name || '').toLowerCase().includes(q)) : records;
  }, [records, query]);
  const stats = useMemo(() => {
    const people = new Set(shown.map((r) => String(r.userId)));
    return { sessions: shown.length, people: people.size, open: shown.filter((r) => !r.logoutAt).length };
  }, [shown]);
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
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name" />
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
              <tr><th>Employee</th><th>Role</th><th>Login</th><th>Logout</th><th>Duration</th></tr>
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
/* MONTHLY ATTENDANCE */
const MonthlyAttendance = () => {
  const [month, setMonth] = useState(currentMonth());
  const [role, setRole] = useState('');
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [expandedId, setExpandedId] = useState('');
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.get('/hr/attendance/monthly', {
      params: { month, role: role || undefined }
    })
      .then((res) => {
        if (!cancelled) {
          setRows(res.data.rows || []);
          setError('');
          setExpandedId('');
        }
      })
      .catch((err) => {
        if (!cancelled) setError(errMsg(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [month, role, reloadKey]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (!q) return true;
      return (r.name || '').toLowerCase().includes(q) || (r.email || '').toLowerCase().includes(q);
    });
  }, [rows, query]);
  const totals = useMemo(() => ({
    employees: shown.length,
    working: shown.reduce((sum, r) => sum + r.workingDays, 0),
    absent: shown.reduce((sum, r) => sum + r.absentDays, 0)
  }), [shown]);
  const monthLabel = month
    ? new Date(`${month}-15T12:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
    : '';
  return (
    <>
      <div className="hr-subhead">
        <strong>{monthLabel} Attendance</strong>
        <span>Sunday is excluded · Monday to Saturday are counted</span>
        <button type="button" className="btn-primary" onClick={() => { setLoading(true); setReloadKey((k) => k + 1); }} disabled={loading}>
          <RefreshCw size={15} /> Refresh
        </button>
      </div>
      {error && <p className="error-message" role="alert">{error}</p>}
      <div className="hr-toolbar">
        <div className="hr-daypick">
          <CalendarDays size={16} />
          <input type="month" value={month} max={currentMonth()} onChange={(e) => e.target.value && setMonth(e.target.value)} aria-label="Select month" />
        </div>
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">Everyone</option>
          {ROLES.map((r) => <option key={r} value={r}>{roleName(r)}</option>)}
        </select>
        <div className="hr-search">
          <Search size={15} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search employee" />
        </div>
      </div>
      <div className="kpi-grid">
        <div className="kpi-card"><span className="kpi-label">Employees</span><div className="kpi-value">{totals.employees}</div></div>
        <div className="kpi-card green"><span className="kpi-label">Total working days</span><div className="kpi-value">{totals.working}</div></div>
        <div className="kpi-card red"><span className="kpi-label">Total absent days</span><div className="kpi-value">{totals.absent}</div></div>
      </div>
      {loading ? (
        <p className="muted">Loading monthly attendance…</p>
      ) : (
        <div className="hr-table-wrap">
          <table className="hr-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Role</th>
                <th>Avg. Login</th>
                <th>Avg. Logout</th>
                <th>Working Days</th>
                <th>Absent Days</th>
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 && (
                <tr><td colSpan={6}><p className="hr-empty">No employees found.</p></td></tr>
              )}
              {shown.map((r) => {
                const expanded = expandedId === r.id;
                return (
                  <>
                    <tr key={r.id}>
                      <td>
                        <button
                          type="button"
                          onClick={() => setExpandedId(expanded ? '' : r.id)}
                          style={{ display: 'flex', alignItems: 'center', gap: 9, border: 0, background: 'transparent', color: 'inherit', padding: 0, cursor: 'pointer', textAlign: 'left' }}
                        >
                          {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                          <Avatar name={r.name} src={r.profileImage} />
                          <span>
                            <strong>{r.name}</strong>
                            <span style={{ display: 'block', opacity: 0.65, fontSize: 11 }}>{r.email}</span>
                          </span>
                        </button>
                      </td>
                      <td>{roleName(r.role)}</td>
                      <td>{formatAverageTime(r.login)}</td>
                      <td>{formatAverageTime(r.logout)}</td>
                      <td><span className="hr-pill online">{r.workingDays}</span></td>
                      <td><span className={`hr-pill ${r.absentDays > 0 ? 'absent' : 'online'}`}>{r.absentDays}</span></td>
                    </tr>
                    {expanded && (
                      <tr key={`${r.id}-details`}>
                        <td colSpan={6}>
                          <div style={{ padding: '12px 8px' }}>
                            <strong style={{ display: 'block', marginBottom: 10 }}>Daily attendance — {monthLabel}</strong>
                            <div className="hr-table-wrap">
                              <table className="hr-table">
                                <thead>
                                  <tr><th>Date</th><th>Status</th><th>First Login</th><th>Last Logout</th></tr>
                                </thead>
                                <tbody>
                                  {r.daily.length === 0 && (
                                    <tr><td colSpan={4}>No working days in this period.</td></tr>
                                  )}
                                  {r.daily.map((d) => (
                                    <tr key={d.date}>
                                      <td>{formatDay(d.date)}</td>
                                      <td>
                                        {d.status === 'present'
                                          ? <span className="hr-pill online">Present</span>
                                          : <span className="hr-pill absent">Absent</span>}
                                      </td>
                                      <td>{d.firstLogin ? fmtTime(d.firstLogin) : '—'}</td>
                                      <td>{d.lastLogout ? fmtTime(d.lastLogout) : '—'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
};
/* MAIN ATTENDANCE PAGE */
const HrAttendance = () => {
  const [tab, setTab] = useState('current');
  return (
    <div className="dashboard-content scrollable dash-glass hr-page">
      <div className="page-header">
        <div>
          <span className="page-label">HUMAN RESOURCES</span>
          <h1>Attendance</h1>
          <p>Track daily, historical and monthly employee attendance.</p>
        </div>
      </div>
      <div className="hr-tabs" role="tablist" aria-label="Attendance view">
        <button type="button" role="tab" aria-selected={tab === 'current'} className={tab === 'current' ? 'active' : ''} onClick={() => setTab('current')}>
          <CalendarClock size={15} /> Current day
        </button>
        <button type="button" role="tab" aria-selected={tab === 'history'} className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>
          <History size={15} /> History
        </button>
        <button type="button" role="tab" aria-selected={tab === 'monthly'} className={tab === 'monthly' ? 'active' : ''} onClick={() => setTab('monthly')}>
          <CalendarDays size={15} /> Monthly Attendance
        </button>
      </div>
      {tab === 'current' && <CurrentDay />}
      {tab === 'history' && <History_ />}
      {tab === 'monthly' && <MonthlyAttendance />}
    </div>
  );
};
export default HrAttendance;