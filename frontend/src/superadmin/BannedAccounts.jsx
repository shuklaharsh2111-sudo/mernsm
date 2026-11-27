import { useEffect, useMemo, useState } from 'react';
import { Ban, ShieldOff } from 'lucide-react';
import api from '../api';
import { errMsg } from '../sopUtils';
import { roleName } from '../roleNames';
import '../style.css';
import '../styles/dashboard-glass.css';
import './superadmin.css';

const fmt = (d) => {
  const date = d ? new Date(d) : null;
  return date && !Number.isNaN(date.getTime())
    ? date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';
};

// Super admin only: every banned account in every department, with a one-click unban.
const BannedAccounts = () => {
  const [accounts, setAccounts] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [busy, setBusy] = useState('');

  const load = () => api.get('/superadmin/banned')
    .then((r) => { setAccounts(r.data.accounts); setError(''); })
    .catch((e) => setError(errMsg(e)));
  useEffect(() => { load(); }, []);

  const roles = useMemo(() => [...new Set((accounts || []).map((a) => a.role))].sort(), [accounts]);
  const shown = useMemo(() => (accounts || []).filter((a) => (
    (!role || a.role === role)
    && (!q.trim() || `${a.name} ${a.email}`.toLowerCase().includes(q.trim().toLowerCase()))
  )), [accounts, q, role]);

  const unban = async (a) => {
    if (!window.confirm(`Unban ${a.name}? They will be able to sign in again.`)) return;
    setBusy(a.id);
    try {
      await api.put(`/admin/users/${a.id}/unban`, { collection: a.collection });
      setNotice(`${a.name} was unbanned.`); setError(''); await load();
    } catch (e) { setError(errMsg(e)); } finally { setBusy(''); }
  };

  return (
    <div className="dash-glass">
      <div className="page-header">
        <div>
          <span className="page-label">SUPER ADMIN</span>
          <h1>Banned Accounts</h1>
          <p>Everyone who is currently blocked from signing in, with the reason they were given.</p>
        </div>
        {accounts && <span className="so-tag">{accounts.length} banned</span>}
      </div>
      {error && <p className="error-message" role="alert">{error}</p>}
      {notice && <p className="success-message" role="status" onClick={() => setNotice('')}>{notice}</p>}
      {!accounts && !error && <p className="muted">Loading…</p>}

      {accounts && (
        <div className="glass-panel">
          <div className="md-head">
            <h2><Ban size={16} /> Blocked accounts</h2>
            <div className="sa-filters">
              <select className="md-select" value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="">All departments</option>
                {roles.map((r) => <option key={r} value={r}>{roleName(r)}</option>)}
              </select>
              <input className="md-search" placeholder="Search name or email" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </div>
          {shown.length === 0 ? <p className="muted">{accounts.length ? 'No accounts match your search.' : 'No one is banned right now.'}</p> : shown.map((a) => (
            <div className="so-person ba-row" key={`${a.collection}-${a.id}`}>
              <span className="so-avatar">{a.profileImage ? <img src={a.profileImage} alt="" /> : (a.name || 'U').slice(0, 2).toUpperCase()}</span>
              <span className="so-person-text">
                <strong>{a.name}</strong>
                <small>{a.email} · {roleName(a.role)}</small>
                <small className="ba-reason">“{a.banReason || 'No reason given'}” — banned {fmt(a.bannedAt)}{a.bannedByName ? ` by ${a.bannedByName}` : ''}</small>
              </span>
              <button type="button" className="btn-ghost" disabled={busy === a.id} onClick={() => unban(a)}><ShieldOff size={14} /> Unban</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BannedAccounts;
