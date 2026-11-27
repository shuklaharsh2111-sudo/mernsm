import { useEffect, useMemo, useState } from 'react';
import { Layers, Users, Ban } from 'lucide-react';
import api from '../api';
import { errMsg } from '../sopUtils';
import { roleName } from '../roleNames';
import '../style.css';
import '../styles/dashboard-glass.css';
import './superadmin.css';

// Super admin only: every department (role) with its people; move people between reporting managers.
const ManageDepartment = () => {
  const [data, setData] = useState(null);
  const [role, setRole] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [q, setQ] = useState('');

  const load = () => api.get('/superadmin/departments')
    .then((r) => { setData(r.data); setRole((cur) => cur || r.data.departments[0]?.role || ''); setError(''); })
    .catch((e) => setError(errMsg(e)));
  useEffect(() => { load(); }, []);

  const dept = data?.departments.find((d) => d.role === role);
  const managerName = useMemo(() => Object.fromEntries((data?.reportingManagers || []).map((m) => [m.id, m.name])), [data]);
  const members = useMemo(() => (dept?.members || []).filter((m) => (
    !q.trim() || `${m.name} ${m.email}`.toLowerCase().includes(q.trim().toLowerCase())
  )), [dept, q]);

  const setManager = async (m, managerId) => {
    try {
      await api.put(`/superadmin/departments/${role}/${m.id}/manager`, { managerId });
      setNotice(`${m.name} updated.`); setError(''); load();
    } catch (e) { setError(errMsg(e)); }
  };

  return (
    <div className="dash-glass">
      <div className="page-header">
        <div>
          <span className="page-label">SUPER ADMIN</span>
          <h1>Manage Department</h1>
          <p>All departments in one place. Pick a department to see its people and change who they report to.</p>
        </div>
      </div>
      {error && <p className="error-message" role="alert">{error}</p>}
      {notice && <p className="success-message" role="status" onClick={() => setNotice('')}>{notice}</p>}
      {!data && !error && <p className="muted">Loading…</p>}

      {data && (
        <>
          <div className="md-cards">
            {data.departments.map((d) => (
              <button type="button" key={d.role} className={`md-card glass-panel${d.role === role ? ' active' : ''}`} onClick={() => { setRole(d.role); setQ(''); setNotice(''); }}>
                <span className="md-card-name"><Layers size={15} /> {roleName(d.role)}</span>
                <strong>{d.total}</strong>
                <small>{d.total - d.banned} active{d.banned ? ` · ${d.banned} banned` : ''}</small>
              </button>
            ))}
          </div>

          {dept && (
            <div className="glass-panel md-panel">
              <div className="md-head">
                <h2><Users size={16} /> {roleName(dept.role)} · {dept.total}</h2>
                <input className="md-search" placeholder="Search name or email" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
              {members.length === 0 ? <p className="muted">No people found in this department.</p> : members.map((m) => (
                <div className="so-person md-row" key={m.id}>
                  <span className="so-avatar">{m.profileImage ? <img src={m.profileImage} alt="" /> : (m.name || 'U').slice(0, 2).toUpperCase()}</span>
                  <span className="so-person-text"><strong>{m.name}</strong><small>{m.email}{m.contact ? ` · ${m.contact}` : ''}</small></span>
                  {m.isBanned && <span className="so-tag md-banned"><Ban size={11} /> Banned</span>}
                  {dept.hasManager ? (
                    <select className="md-select" value={m.reportingManagerId || ''} onChange={(e) => setManager(m, e.target.value)} title="Reporting manager">
                      <option value="">No reporting manager</option>
                      {data.reportingManagers.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  ) : <span className="so-tag">{m.reportingManagerId ? managerName[m.reportingManagerId] : '—'}</span>}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ManageDepartment;
