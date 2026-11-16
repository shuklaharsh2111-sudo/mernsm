import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Search, X, Users, LogIn, LogOut, Clock, ChevronDown, ChevronUp, Building2, CalendarDays } from 'lucide-react';
import api from '../api';
import { errMsg } from '../sopUtils';
import { roleName } from '../roleNames';
import '../styles/adminattendance.css';

const fmtTime = (v) =>
  new Date(v).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
const fmtDayLong = (v) =>
  new Date(v).toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' });
const fmtDayShort = (v) =>
  new Date(v).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' });

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
const monthRange = (offset) => {
  const d = new Date();
  const first = new Date(d.getFullYear(), d.getMonth() + offset, 1);
  const last = offset === 0 ? d : new Date(d.getFullYear(), d.getMonth() + offset + 1, 0);
  return [dayKey(first), dayKey(last)];
};

const QUICK = [
  { id: 'today', label: 'Today', get: () => [today(), today()] },
  { id: 'yesterday', label: 'Last day', get: () => [daysAgo(1), daysAgo(1)] },
  { id: 'month', label: 'This month', get: () => monthRange(0) },
  { id: 'lastmonth', label: 'Last month', get: () => monthRange(-1) },
];

// Departments, in the order they are listed. Each role is one department.
const DEPTS = ['admin', 'reporting_manager', 'sme', 'smi', 'des', 'hr', 'clients'];

const STATUSES = [
  { value: 'all', label: 'All' },
  { value: 'in', label: 'No logout yet' },
  { value: 'out', label: 'Logged out' },
];

const mins = (a, b) => (b ? Math.max(0, Math.round((new Date(b) - new Date(a)) / 60000)) : null);
const hm = (m) => (m == null ? null : `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`);

// One group = one user on one day: first login of the day and last logout of the day.
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
    return { key, dayKey: dayKey(first.loginAt), day: first.loginAt, user: first, first, last, minutes: mins(first.loginAt, last.logoutAt) };
  });
};

// header of a table of days / people
const Head = ({ cols }) => (
  <div className="aa-tr aa-th" role="row">
    {cols.map((c) => <span key={c} role="columnheader">{c}</span>)}
  </div>
);

// one day of one person: first login, last logout, time in, status
const DayCells = ({ g }) => {
  const done = !!g.last.logoutAt;
  return (
    <>
      <span className="aa-time" role="cell" data-label="First login">{fmtTime(g.first.loginAt)}</span>
      <span className="aa-time" role="cell" data-label="Last logout">{done ? fmtTime(g.last.logoutAt) : <em>—</em>}</span>
      <span className="aa-time" role="cell" data-label="Time in">{hm(g.minutes) || <em>—</em>}</span>
      <span role="cell"><span className={`aa-pill ${done ? 'out' : 'in'}`}>{done ? 'Logged out' : 'No logout yet'}</span></span>
    </>
  );
};

const AdminAttendance = () => {
  const [records, setRecords] = useState([]);
  const [office, setOffice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const [range, setRange] = useState({ from: today(), to: today() });
  const [userId, setUserId] = useState('');
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [collapsed, setCollapsed] = useState({}); // department -> hidden
  const [openPerson, setOpenPerson] = useState({}); // userId -> days shown (month view)

  const oneDay = range.from === range.to;

  useEffect(() => {
    let cancelled = false;
    api
      .get('/admin/users')
      .then((res) => !cancelled && setUsers(res.data.users.map((u) => ({ ...u, role: String(u.role || '').toLowerCase() }))))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get('/admin/attendance', { params: { from: range.from, to: range.to, userId: userId || undefined, limit: 2000 } })
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
  }, [range, userId, reloadKey]);

  const activeQuick = QUICK.find((q) => {
    const [f, t] = q.get();
    return f === range.from && t === range.to;
  })?.id;

  // matches the search box (before the status filter, so the chip counts stay meaningful)
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

  const people = useMemo(() => new Set(searched.map((g) => g.user.userId)).size, [searched]);

  const visible = useMemo(
    () => searched.filter((g) => status === 'all' || (status === 'in' ? !g.last.logoutAt : !!g.last.logoutAt)),
    [searched, status]
  );

  // Departments -> people. Each person carries their days (newest first) and totals.
  const depts = useMemo(() => {
    const byDept = new Map();
    visible.forEach((g) => {
      const d = g.user.role;
      if (!byDept.has(d)) byDept.set(d, { key: d, label: roleName(d), people: new Map() });
      const dep = byDept.get(d);
      const id = String(g.user.userId);
      if (!dep.people.has(id)) dep.people.set(id, { id, user: g.user, days: [] });
      dep.people.get(id).days.push(g);
    });
    const order = (k) => (DEPTS.includes(k) ? DEPTS.indexOf(k) : 99);
    return [...byDept.values()]
      .map((dep) => ({
        ...dep,
        people: [...dep.people.values()]
          .map((p) => {
            const days = p.days.sort((a, b) => b.dayKey.localeCompare(a.dayKey));
            const done = days.filter((x) => x.minutes != null);
            const total = done.reduce((t, x) => t + x.minutes, 0);
            return { ...p, days, total, avg: done.length ? Math.round(total / done.length) : null, hasTime: done.length > 0 };
          })
          .sort((a, b) => a.user.name.localeCompare(b.user.name)),
      }))
      .sort((a, b) => order(a.key) - order(b.key));
  }, [visible]);

  const pickedUser = users.find((u) => u.id === userId) || null;
  const pickable = useMemo(() => {
    const list = [...users].sort((a, b) => a.name.localeCompare(b.name));
    return DEPTS.map((d) => ({ dept: d, list: list.filter((u) => u.role === d) })).filter((g) => g.list.length);
  }, [users]);

  // totals of the one picked user over the period
  const mine = useMemo(() => {
    if (!userId) return null;
    const days = visible.filter((g) => String(g.user.userId) === userId).sort((a, b) => b.dayKey.localeCompare(a.dayKey));
    const done = days.filter((g) => g.minutes != null);
    const total = done.reduce((t, g) => t + g.minutes, 0);
    return { days, total, avg: done.length ? Math.round(total / done.length) : null };
  }, [visible, userId]);

  const scope = oneDay
    ? fmtDayLong(range.from)
    : `${new Date(range.from).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} – ${new Date(range.to).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`;

  const filtered = search.trim() || userId || status !== 'all';
  const clearFilters = () => { setSearch(''); setStatus('all'); setUserId(''); };

  return (
    <div className="dashboard-content scrollable">
      <div className="page-header">
        <div>
          <span className="page-label">ADMINISTRATION</span>
          <h1>Attendance</h1>
          <p>
            Pick a period and, if you like, one person. Only the first login and last logout of each day are shown.
            {office?.configured
              ? ` Staff can log in only within ${office.radius} m of the office.`
              : ' Office location is not configured yet (set OFFICE_LAT / OFFICE_LNG in backend/.env).'}
          </p>
        </div>
        <button type="button" className="btn-ghost" onClick={() => setReloadKey((k) => k + 1)}>
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      {/* ---- filters: 1 When, 2 Who ---- */}
      <div className="aa-filters">
        <div className="aa-row">
          <span className="aa-label">When</span>
          <div className="aa-chips" role="group" aria-label="Period">
            {QUICK.map((q) => (
              <button key={q.id} type="button" className={activeQuick === q.id ? 'active' : ''} onClick={() => { const [f, t] = q.get(); setRange({ from: f, to: t }); }}>{q.label}</button>
            ))}
          </div>
          <label className="aa-dates">
            <span>or a date</span>
            <input type="date" value={oneDay ? range.from : ''} max={today()} onChange={(e) => e.target.value && setRange({ from: e.target.value, to: e.target.value })} />
          </label>
        </div>

        <div className="aa-row">
          <span className="aa-label">Who</span>
          <select className="aa-user-select" value={userId} onChange={(e) => setUserId(e.target.value)} aria-label="Particular user">
            <option value="">Everyone</option>
            {pickable.map((g) => (
              <optgroup key={g.dept} label={roleName(g.dept)}>
                {g.list.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </optgroup>
            ))}
          </select>
          <div className="aa-search">
            <Search size={15} />
            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or email…" aria-label="Search name or email" />
            {search && <button type="button" onClick={() => setSearch('')} aria-label="Clear search"><X size={14} /></button>}
          </div>
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

      {/* what is on screen */}
      <p className="aa-scope">
        <CalendarDays size={15} /> <b>{scope}</b> · {pickedUser ? pickedUser.name : 'Everyone'}
        {!loading && <span> · {people} {people === 1 ? 'person' : 'people'}, {counts.all} {counts.all === 1 ? 'day' : 'days'} logged in</span>}
      </p>

      {error && <p className="error-message" role="alert">{error}</p>}

      {loading ? (
        <p className="muted">Loading…</p>
      ) : visible.length === 0 ? (
        <div className="glass-panel aa-empty">
          <Clock size={26} />
          <h3>No logins found</h3>
          <p className="muted">{filtered ? 'Nothing matches these filters for this period.' : 'Nobody logged in during this period.'}</p>
          {filtered && <button type="button" className="btn-ghost" onClick={clearFilters}>Clear filters</button>}
        </div>
      ) : pickedUser && mine ? (
        /* ===== ONE PERSON: a simple list of their days ===== */
        <section className="aa-dept">
          <div className="aa-user-card">
            <span className="aa-user-avatar">{(pickedUser.name || '?').trim().charAt(0).toUpperCase()}</span>
            <div className="aa-user-card-info">
              <b>{pickedUser.name}</b>
              <small>{pickedUser.email}</small>
            </div>
            <span className={`role-tag ${pickedUser.role}`}>{roleName(pickedUser.role)}</span>
            <div className="aa-user-card-stats">
              <div><strong>{mine.days.length}</strong><span>Days present</span></div>
              <div><strong>{hm(mine.avg) || '—'}</strong><span>Avg. time per day</span></div>
              <div><strong>{mine.days.length ? hm(mine.total) : '—'}</strong><span>Total time in</span></div>
            </div>
          </div>
          <div className="aa-table" role="table">
            <Head cols={['Date', 'First login', 'Last logout', 'Time in', 'Status']} />
            {mine.days.map((g) => (
              <div key={g.key} className="aa-group" role="rowgroup">
                <div className="aa-tr" role="row">
                  <span className="aa-user" role="cell"><b>{fmtDayShort(g.day)}</b></span>
                  <DayCells g={g} />
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : (
        /* ===== EVERYONE: one table per department ===== */
        <div className="aa-depts">
          {records.length >= 2000 && <p className="muted aa-limit">Showing the latest 2000 records for this period. Pick a person or a shorter period to see the rest.</p>}
          {depts.map((dep) => {
            const hidden = Boolean(collapsed[dep.key]);
            return (
              <section key={dep.key} className="aa-dept">
                <button type="button" className="aa-dept-head" aria-expanded={!hidden} onClick={() => setCollapsed((c) => ({ ...c, [dep.key]: !c[dep.key] }))}>
                  <span className="aa-dept-icon"><Building2 size={17} /></span>
                  <span className="aa-dept-title">
                    <strong>{dep.label}</strong>
                    <small>{dep.people.length} {dep.people.length === 1 ? 'person' : 'people'}</small>
                  </span>
                  {hidden ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
                </button>

                {!hidden && (
                  <div className="aa-table" role="table">
                    <Head cols={oneDay ? ['Person', 'First login', 'Last logout', 'Time in', 'Status'] : ['Person', 'Days present', 'Avg. per day', 'Total time in', '']} />
                    {dep.people.map((p) => {
                      if (oneDay) {
                        return (
                          <div key={p.id} className="aa-group" role="rowgroup">
                            <div className="aa-tr" role="row">
                              <span className="aa-user" role="cell"><b>{p.user.name}</b><small>{p.user.email}</small></span>
                              <DayCells g={p.days[0]} />
                            </div>
                          </div>
                        );
                      }
                      const open = Boolean(openPerson[p.id]);
                      return (
                        <div key={p.id} className="aa-group" role="rowgroup">
                          <div className="aa-tr" role="row">
                            <span className="aa-user" role="cell"><b>{p.user.name}</b><small>{p.user.email}</small></span>
                            <span className="aa-time" role="cell" data-label="Days present">{p.days.length}</span>
                            <span className="aa-time" role="cell" data-label="Avg. per day">{hm(p.avg) || <em>—</em>}</span>
                            <span className="aa-time" role="cell" data-label="Total time in">{p.hasTime ? hm(p.total) : <em>—</em>}</span>
                            <span role="cell">
                              <button type="button" className="aa-toggle" aria-expanded={open} onClick={() => setOpenPerson((o) => ({ ...o, [p.id]: !o[p.id] }))}>
                                {open ? <>Hide days <ChevronUp size={14} /></> : <>View days <ChevronDown size={14} /></>}
                              </button>
                            </span>
                          </div>
                          {open && (
                            <div className="aa-sub">
                              {p.days.map((g) => (
                                <div key={g.key} className="aa-tr aa-sub-row" role="row">
                                  <span className="aa-user" role="cell"><b>{fmtDayShort(g.day)}</b></span>
                                  <DayCells g={g} />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminAttendance;
