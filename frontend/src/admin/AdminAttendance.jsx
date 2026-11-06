import { Fragment, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, MapPin, RefreshCw } from 'lucide-react';
import api from '../api';
import { errMsg } from '../sopUtils';

const fmtTime = (v) =>
  new Date(v).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

const fmtDay = (v) =>
  new Date(v).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });

// local calendar day, e.g. "2026-11-03"
const dayKey = (v) => {
  const d = new Date(v);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const fmtMins = (mins) => {
  if (!mins) return '—';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
};

const sessionMins = (s) =>
  s.logoutAt ? Math.max(0, Math.round((new Date(s.logoutAt) - new Date(s.loginAt)) / 60000)) : 0;

const today = () => dayKey(new Date());

const cell = { padding: '10px 12px' };
const subCell = { padding: '6px 12px', fontSize: 13 };

// One group = one user on one day.
//  - first login of the day  -> the main login (with location details)
//  - last session's logout   -> the main logout (or "still logged in")
//  - every other session     -> listed as a plain extra session
const buildGroups = (records) => {
  const map = new Map();

  records.forEach((r) => {
    const key = `${r.userId}|${dayKey(r.loginAt)}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(r);
  });

  return [...map.entries()]
    .map(([key, sessions]) => {
      sessions.sort((a, b) => new Date(a.loginAt) - new Date(b.loginAt));
      const first = sessions[0];
      const last = sessions[sessions.length - 1];
      return {
        key,
        day: first.loginAt,
        user: first,
        first,
        last,
        extras: sessions.slice(1),
        totalMins: sessions.reduce((sum, s) => sum + sessionMins(s), 0)
      };
    })
    .sort((a, b) => new Date(b.day) - new Date(a.day) || a.user.name.localeCompare(b.user.name));
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

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? records.filter((r) => `${r.name} ${r.email}`.toLowerCase().includes(q))
      : records;
    return buildGroups(filtered);
  }, [records, search]);

  const toggle = (key) => setOpen((o) => ({ ...o, [key]: !o[key] }));

  return (
    <div className="dashboard-content scrollable">
      <div className="page-header">
        <div>
          <span className="page-label">ADMINISTRATION</span>
          <h1>Attendance</h1>
          <p>
            One row per user per day: the first login and the last logout of the day count.
            Any other logins that day are listed under “more sessions”.
            {office?.configured
              ? ` Staff can log in only within ${office.radius} m of the office.`
              : ' Office location is not configured yet (set OFFICE_LAT / OFFICE_LNG in backend/.env).'}
          </p>
        </div>
        <button type="button" className="btn-ghost" onClick={() => setReloadKey((k) => k + 1)}>
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      {error && <p className="error-message" role="alert">{error}</p>}

      <div className="glass-panel add-form" style={{ marginBottom: 16 }}>
        <label className="x-field">
          <span>From</span>
          <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="x-field">
          <span>To</span>
          <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
        </label>
        <label className="x-field">
          <span>Role</span>
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">Everyone</option>
            <option value="sme">SME</option>
            <option value="smi">SMI</option>
            <option value="des">DES</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        <label className="x-field">
          <span>Search name / email</span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Type to filter" />
        </label>
      </div>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : groups.length === 0 ? (
        <div className="glass-panel"><p className="muted">No logins found for this period.</p></div>
      ) : (
        <div className="glass-panel" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr>
                {['Date', 'User', 'Role', 'First login', 'Last logout', 'Time worked', 'Login location'].map((h) => (
                  <th key={h} style={{ padding: '10px 12px', fontSize: 12, opacity: 0.7 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => {
                const expanded = !!open[g.key];
                const hasExtras = g.extras.length > 0;
                const { first, last } = g;

                return (
                  <Fragment key={g.key}>
                    <tr style={{ borderTop: '1px solid rgba(128,128,128,.2)' }}>
                      <td style={cell}>{fmtDay(g.day)}</td>
                      <td style={cell}>
                        <strong>{g.user.name}</strong>
                        <div className="muted" style={{ fontSize: 12 }}>{g.user.email}</div>
                      </td>
                      <td style={cell}>
                        <span className={`role-tag ${g.user.role}`}>{g.user.role.toUpperCase()}</span>
                      </td>
                      <td style={cell}><strong>{fmtTime(first.loginAt)}</strong></td>
                      <td style={cell}>
                        {last.logoutAt
                          ? <strong>{fmtTime(last.logoutAt)}</strong>
                          : <span className="muted">Still logged in / not logged out</span>}
                      </td>
                      <td style={cell}>{fmtMins(g.totalMins)}</td>
                      <td style={cell}>
                        {first.distance !== null ? (
                          <span title={first.accuracy ? `GPS accuracy ±${first.accuracy} m` : ''}>
                            <MapPin size={13} style={{ verticalAlign: '-2px' }} /> {first.distance} m from office
                          </span>
                        ) : (
                          <span className="muted">Not recorded</span>
                        )}
                      </td>
                    </tr>

                    {hasExtras && (
                      <tr>
                        <td colSpan={7} style={{ padding: '0 12px 8px' }}>
                          <button
                            type="button"
                            className="btn-ghost"
                            style={{ fontSize: 12, padding: '4px 8px' }}
                            onClick={() => toggle(g.key)}
                            aria-expanded={expanded}
                          >
                            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            {' '}{g.extras.length} more session{g.extras.length > 1 ? 's' : ''} this day
                          </button>
                        </td>
                      </tr>
                    )}

                    {hasExtras && expanded && g.extras.map((s) => (
                      <tr key={s.id} className="muted">
                        <td style={subCell} />
                        <td style={subCell} colSpan={2}>↳ Extra login</td>
                        <td style={subCell}>{fmtTime(s.loginAt)}</td>
                        <td style={subCell}>
                          {s.logoutAt ? fmtTime(s.logoutAt) : 'Not logged out'}
                        </td>
                        <td style={subCell}>{fmtMins(sessionMins(s))}</td>
                        <td style={subCell}>
                          {s.distance !== null ? `${s.distance} m from office` : '—'}
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminAttendance;
