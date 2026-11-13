import { useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import api from '../api';
import { errMsg } from '../sopUtils';
import { roleName } from '../roleNames';
import { initialsOf, fmtTime, fmtDate, fmtDuration, dayKey } from './hrUtils';
import '../style.css';
import '../styles/dashboard-glass.css';
import '../styles/hr.css';

const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return dayKey(d); };
const ROLES = ['reporting_manager', 'sme', 'smi', 'des', 'hr'];
const HrAttendance = () => {
  const [from, setFromRaw] = useState(daysAgo(6));
  const [to, setToRaw] = useState(dayKey(new Date()));
  const [role, setRoleRaw] = useState('');
  const setFrom = (v) => { setLoading(true); setFromRaw(v); };
  const setTo = (v) => { setLoading(true); setToRaw(v); };
  const setRole = (v) => { setLoading(true); setRoleRaw(v); };
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api.get('/hr/attendance', { params: { from, to, role: role || undefined } })
      .then((res) => { if (!cancelled) { setRecords(res.data.records || []); setError(''); } })
      .catch((err) => { if (!cancelled) setError(errMsg(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [from, to, role, reloadKey]);

  const stats = useMemo(() => {
    const people = new Set(records.map((r) => String(r.userId)));
    const open = records.filter((r) => !r.logoutAt).length;
    return { sessions: records.length, people: people.size, open };
  }, [records]);

  return (
    <div className="dashboard-content scrollable dash-glass hr-page">
      <div className="page-header">
        <div>
          <span className="page-label">HUMAN RESOURCES</span>
          <h1>Attendance</h1>
          <p>Login and logout sessions for every employee.</p>
        </div>
        <button type="button" className="btn-primary" onClick={() => { setLoading(true); setReloadKey((k) => k + 1); }}>
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      {error && <p className="error-message" role="alert">{error}</p>}

      <div className="hr-toolbar">
        <label>From <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></label>
        <label>To <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></label>
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">Everyone</option>
          {ROLES.map((r) => <option key={r} value={r}>{roleName(r)}</option>)}
        </select>
        <div className="hr-chips">
          <button type="button" onClick={() => { setFrom(dayKey(new Date())); setTo(dayKey(new Date())); }}>Today</button>
          <button type="button" onClick={() => { setFrom(daysAgo(6)); setTo(dayKey(new Date())); }}>Last 7 days</button>
          <button type="button" onClick={() => { const d = new Date(); setFrom(dayKey(new Date(d.getFullYear(), d.getMonth(), 1))); setTo(dayKey(d)); }}>This month</button>
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
              <tr><th>Employee</th><th>Role</th><th>Date</th><th>Login</th><th>Logout</th><th>Duration</th></tr>
            </thead>
            <tbody>
              {records.length === 0 && <tr><td colSpan={6}><p className="hr-empty">No sessions in this range.</p></td></tr>}
              {records.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div className="hr-cell-user">
                      <div className="hr-avatar">{initialsOf(r.name)}</div>
                      <div><strong>{r.name}</strong><span>{r.email}</span></div>
                    </div>
                  </td>
                  <td>{roleName(r.role)}</td>
                  <td>{fmtDate(r.loginAt)}</td>
                  <td>{fmtTime(r.loginAt)}</td>
                  <td>{r.logoutAt ? fmtTime(r.logoutAt) : <span className="hr-pill online">Active</span>}</td>
                  <td>{fmtDuration(r.loginAt, r.logoutAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default HrAttendance;
