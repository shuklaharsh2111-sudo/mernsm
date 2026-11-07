import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, RefreshCw, Search, X, Users, LogIn, LogOut, Clock } from 'lucide-react';
import api from '../api';
import { errMsg } from '../sopUtils';
import { roleName } from '../roleNames';
import '../styles/adminattendance.css';

const fmtTime = (v) =>
  new Date(v).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

const fmtDayLong = (v) =>
  new Date(v).toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' });

// local calendar day, e.g. "2026-11-03"
const dayKey = (v) => {
  const d = new Date(v);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const today = () => dayKey(new Date());
const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return dayKey(d);
};
const monthStart = () => {
  const d = new Date();
  return dayKey(new Date(d.getFullYear(), d.getMonth(), 1));
};

const RANGES = [
  { id: 'today', label: 'Today', get: () => [today(), today()] },
  { id: 'yesterday', label: 'Yesterday', get: () => [daysAgo(1), daysAgo(1)] },
  { id: '7', label: 'Last 7 days', get: () => [daysAgo(6), today()] },
  { id: 'month', label: 'This month', get: () => [monthStart(), today()] },
];

const ROLES = [
  { value: '', label: 'Everyone' },
  { value: 'sme', label: roleName('sme') },
  { value: 'smi', label: roleName('smi') },
  { value: 'des', label: roleName('des') },
  { value: 'admin', label: roleName('admin') },
];

const STATUSES = [
  { value: 'all', label: 'All' },
  { value: 'in', label: 'No logout yet' },
  { value: 'out', label: 'Logged out' },
];

// One group = one user on one day.
//  - first login of the day  -> shown as "First login"
//  - last session's logout   -> shown as "Last logout" (or "No logout yet")
//  - every other session     -> listed under "more sessions"
const buildGroups = (records) => {
  const map = new Map();
  records.forEach((r) => {
    const key = `${r.userId}|${dayKey(r.loginAt)}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(r);
  });

  return [...map.entries()].map(([key, sessions]) => {
    sessions.sort((a, b) => new Date(a.loginAt) - new Date(b.loginAt));
    const first = sessions[0];
    const last = sessions[sessions.length - 1];
    return { key, dayKey: dayKey(first.loginAt), day: first.loginAt, user: first, first, last, extras: sessions.slice(1) };
  });
};

const AdminAttendance = () => {
  const [records, setRecords] = useState([]);
  const [office, setOffice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [open, setOpen] = useState({}); // group key -> expanded?

  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(today());
  const [role, setRole] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get('/admin/attendance', { params: { from, to, role } })
      .then((res) => {
        if (cancelled) return;
        setRecords(res.data.records);
        setOffice(res.data.office);
        setError('');
      })
      .catch((err) => !cancelled && setError(errMsg(err)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [from, to, role, reloadKey]);

  const activeRange = RANGES.find((r) => {
    const [f, t] = r.get();
    return f === from && t === to;
  })?.id;

  // everything that matches the search box (before the status filter, so the chip counts stay meaningful)
  const searched = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q ? records.filter((r) => `${r.name} ${r.email}`.toLowerCase().includes(q)) : records;
    return buildGroups(list);
  }, [records, search]);

  const counts = useMemo(() => {
    const c = { all: searched.length, in: 0, out: 0 };
    searched.forEach((g) => (g.last.logoutAt ? (c.out += 1) : (c.in += 1)));
    return c;
  }, [searched]);

  const stats = useMemo(() => {
    const people = new Set(searched.map((g) => g.user.userId)).size;
    const earliest = searched.length ? searched.reduce((a, b) => (new Date(a.first.loginAt) < new Date(b.first.loginAt) ? a : b)) : null;
    return { people, earliest };
  }, [searched]);

  const days = useMemo(() => {
    const visible = searched.filter((g) => status === 'all' || (status === 'in' ? !g.last.logoutAt : !!g.last.logoutAt));
    const map = new Map();
    visible.forEach((g) => {
      if (!map.has(g.dayKey)) map.set(g.dayKey, { key: g.dayKey, day: g.day, rows: [] });
      map.get(g.dayKey).rows.push(g);
    });
    return [...map.values()]
      .map((d) => ({ ...d, rows: d.rows.sort((a, b) => new Date(a.first.loginAt) - new Date(b.first.loginAt)) }))
      .sort((a, b) => b.key.localeCompare(a.key));
  }, [searched, status]);

  const toggle = (key) => setOpen((o) => ({ ...o, [key]: !o[key] }));
  const pickRange = (r) => {
    const [f, t] = r.get();
    setFrom(f);
    setTo(t);
  };

  const filtered = search.trim() || role || status !== 'all';
  const clearFilters = () => { setSearch(''); setRole(''); setStatus('all'); };

  return (
    <div className="dashboard-content scrollable">
      <div className="page-header">
        <div>
          <span className="page-label">ADMINISTRATION</span>
          <h1>Attendance</h1>
          <p>
            One row per person per day, using the first login and the last logout. Extra logins that day sit under “more sessions”.
            {office?.configured
              ? ` Staff can log in only within ${office.radius} m of the office.`
              : ' Office location is not configured yet (set OFFICE_LAT / OFFICE_LNG in backend/.env).'}
          </p>
        </div>
        <button type="button" className="btn-ghost" onClick={() => setReloadKey((k) => k + 1)}>
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      {/* ---- summary ---- */}
      <div className="aa-stats">
        <div className="aa-stat">
          <span className="aa-stat-icon"><Users size={17} /></span>
          <div><strong>{loading ? '–' : stats.people}</strong><span>People</span></div>
        </div>
        <div className="aa-stat in">
          <span className="aa-stat-icon"><LogIn size={17} /></span>
          <div><strong>{loading ? '–' : counts.all}</strong><span>Check-ins</span></div>
        </div>
        <div className="aa-stat warn">
          <span className="aa-stat-icon"><Clock size={17} /></span>
          <div><strong>{loading ? '–' : counts.in}</strong><span>No logout yet</span></div>
        </div>
        <div className="aa-stat out">
          <span className="aa-stat-icon"><LogOut size={17} /></span>
          <div><strong>{loading ? '–' : counts.out}</strong><span>Logged out</span></div>
        </div>
      </div>

      {/* ---- filters ---- */}
      <div className="aa-filters">
        <div className="aa-row">
          <div className="aa-chips" role="group" aria-label="Quick date range">
            {RANGES.map((r) => (
              <button key={r.id} type="button" className={activeRange === r.id ? 'active' : ''} onClick={() => pickRange(r)}>{r.label}</button>
            ))}
          </div>
          <div className="aa-dates">
            <label><span>From</span><input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></label>
            <label><span>To</span><input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></label>
          </div>
        </div>

        <div className="aa-row">
          <div className="aa-search">
            <Search size={15} />
            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or email…" aria-label="Search name or email" />
            {search && <button type="button" onClick={() => setSearch('')} aria-label="Clear search"><X size={14} /></button>}
          </div>
          <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Role">
            {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          <div className="aa-chips" role="group" aria-label="Status">
            {STATUSES.map((s) => (
              <button key={s.value} type="button" className={status === s.value ? 'active' : ''} onClick={() => setStatus(s.value)}>
                {s.label} <i>{counts[s.value]}</i>
              </button>
            ))}
          </div>
          {filtered && <button type="button" className="aa-clear" onClick={clearFilters}>Clear filters</button>}
        </div>
      </div>

      {error && <p className="error-message" role="alert">{error}</p>}

      {loading ? (
        <p className="muted">Loading…</p>
      ) : days.length === 0 ? (
        <div className="glass-panel aa-empty">
          <Clock size={26} />
          <h3>No logins found</h3>
          <p className="muted">{filtered ? 'Nothing matches these filters for this period.' : 'Nobody logged in during this period.'}</p>
          {filtered && <button type="button" className="btn-ghost" onClick={clearFilters}>Clear filters</button>}
        </div>
      ) : (
        <div className="aa-days">
          {days.map((d) => (
            <section key={d.key} className="aa-day">
              <header className="aa-day-head">
                <h2>{fmtDayLong(d.day)}</h2>
                <span>{d.rows.length} {d.rows.length === 1 ? 'person' : 'people'}</span>
              </header>

              <div className="aa-table" role="table">
                <div className="aa-tr aa-th" role="row">
                  <span role="columnheader">User</span>
                  <span role="columnheader">Role</span>
                  <span role="columnheader">First login</span>
                  <span role="columnheader">Last logout</span>
                  <span role="columnheader">Status</span>
                </div>

                {d.rows.map((g) => {
                  const expanded = !!open[g.key];
                  const hasExtras = g.extras.length > 0;
                  const done = !!g.last.logoutAt;
                  return (
                    <div key={g.key} className="aa-group" role="rowgroup">
                      <div className="aa-tr" role="row">
                        <span className="aa-user" role="cell">
                          <b>{g.user.name}</b>
                          <small>{g.user.email}</small>
                        </span>
                        <span role="cell"><span className={`role-tag ${g.user.role}`}>{roleName(g.user.role)}</span></span>
                        <span className="aa-time" role="cell" data-label="First login">{fmtTime(g.first.loginAt)}</span>
                        <span className="aa-time" role="cell" data-label="Last logout">{done ? fmtTime(g.last.logoutAt) : <em>—</em>}</span>
                        <span role="cell"><span className={`aa-pill ${done ? 'out' : 'in'}`}>{done ? 'Logged out' : 'No logout yet'}</span></span>
                      </div>

                      {hasExtras && (
                        <div className="aa-extra-bar">
                          <button type="button" onClick={() => toggle(g.key)} aria-expanded={expanded}>
                            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            {g.extras.length} more session{g.extras.length > 1 ? 's' : ''} this day
                          </button>
                        </div>
                      )}

                      {hasExtras && expanded && (
                        <ul className="aa-extras">
                          {g.extras.map((s) => (
                            <li key={s.id}>
                              <span>↳ Extra login</span>
                              <b>{fmtTime(s.loginAt)}</b>
                              <span>to</span>
                              <b>{s.logoutAt ? fmtTime(s.logoutAt) : 'not logged out'}</b>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminAttendance;
