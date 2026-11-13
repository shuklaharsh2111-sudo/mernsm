import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import api from '../api';
import { errMsg } from '../sopUtils';
import { roleName } from '../roleNames';
import { initialsOf, fmtDate } from './hrUtils';
import '../style.css';
import '../styles/dashboard-glass.css';
import '../styles/hr.css';

const STATUS_LABEL = { online: 'Online', left: 'Left', absent: 'Absent' };

const HrEmployees = () => {
  const [employees, setEmployees] = useState([]);
  const [workingDays, setWorkingDays] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('ALL');

  useEffect(() => {
    let cancelled = false;
    api.get('/hr/employees')
      .then((res) => {
        if (cancelled) return;
        setEmployees(res.data.employees || []);
        setWorkingDays(res.data.workingDays || 0);
      })
      .catch((err) => !cancelled && setError(errMsg(err)))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, []);

  const counts = useMemo(
    () => employees.reduce((acc, e) => ({ ...acc, [e.role]: (acc[e.role] || 0) + 1 }), {}),
    [employees]
  );
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return employees.filter((e) =>
      (role === 'ALL' || e.role === role) &&
      (!q || e.name.toLowerCase().includes(q) || e.email.toLowerCase().includes(q))
    );
  }, [employees, query, role]);

  return (
    <div className="dashboard-content scrollable dash-glass hr-page">
      <div className="page-header">
        <div>
          <span className="page-label">HUMAN RESOURCES</span>
          <h1>Employees</h1>
          <p>Everyone on the team, with this month's attendance. New accounts are created by an admin.</p>
        </div>
      </div>

      {error && <p className="error-message" role="alert">{error}</p>}

      <div className="hr-toolbar">
        <div className="hr-search">
          <Search size={15} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name or email" />
        </div>
      </div>
      <div className="hr-chips">
        {['ALL', ...Object.keys(counts)].map((r) => (
          <button key={r} type="button" className={role === r ? 'active' : ''} onClick={() => setRole(r)}>
            {r === 'ALL' ? 'All' : roleName(r)}<em>{r === 'ALL' ? employees.length : counts[r]}</em>
          </button>
        ))}
      </div>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : (
        <div className="hr-table-wrap">
          <table className="hr-table">
            <thead>
              <tr>
                <th>Employee</th><th>Role</th><th>Contact</th><th>Reporting manager</th>
                <th>Joined</th><th>Present this month</th><th>Today</th>
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 && (
                <tr><td colSpan={7}><p className="hr-empty">No employees match.</p></td></tr>
              )}
              {shown.map((e) => {
                const pct = workingDays ? Math.min(100, Math.round((e.daysPresent / workingDays) * 100)) : 0;
                return (
                  <tr key={`${e.role}-${e.id}`}>
                    <td>
                      <div className="hr-cell-user">
                        <div className="hr-avatar">{e.profileImage ? <img src={e.profileImage} alt={e.name} /> : initialsOf(e.name)}</div>
                        <div><strong>{e.name}</strong><span>{e.email}</span></div>
                      </div>
                    </td>
                    <td>{roleName(e.role)}</td>
                    <td>{e.contact || '—'}</td>
                    <td>{e.reportingManager || '—'}</td>
                    <td>{fmtDate(e.joinedAt)}</td>
                    <td>
                      <div className="hr-mini-bar">
                        <div><i style={{ width: `${pct}%` }} /></div>
                        <small>{e.daysPresent}/{workingDays} days</small>
                      </div>
                    </td>
                    <td><span className={`hr-pill ${e.todayStatus}`}>{STATUS_LABEL[e.todayStatus]}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default HrEmployees;
