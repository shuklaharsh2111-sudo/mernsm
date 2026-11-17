import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Phone, CalendarDays, Palette, CalendarCheck, ListChecks, Search, X, Users } from 'lucide-react';
import api from '../api';
import { errMsg } from '../sopUtils';
import { roleName } from '../roleNames';
import '../style.css';
import '../styles/adminusers.css';

const initialsOf = (name = '') => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('') || 'U';
const fmtJoined = (d) => {
  const date = d ? new Date(d) : null;
  return date && !Number.isNaN(date.getTime())
    ? date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';
};

// Read-only list of the people who report to this manager.
const RmTeam = () => {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [q, setQ] = useState('');

  useEffect(() => {
    let cancelled = false;
    api.get('/rm/team')
      .then((r) => !cancelled && setMembers(r.data.members))
      .catch((err) => !cancelled && setError(errMsg(err)))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, []);

  const roles = useMemo(() => [...new Set(members.map((m) => m.role))], [members]);
  const counts = useMemo(() => {
    const c = {};
    members.forEach((m) => { c[m.role] = (c[m.role] || 0) + 1; });
    return c;
  }, [members]);

  const shown = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return members.filter((m) => {
      if (filter !== 'ALL' && m.role !== filter) return false;
      if (!words.length) return true;
      const hay = [m.name, m.email, m.contact, ...m.companies.map((c) => c.name)].join(' ').toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }, [members, filter, q]);

  return (
    <div className="dashboard-content scrollable au-page">
      <div className="page-header">
        <div>
          <span className="page-label">REPORTING MANAGER</span>
          <h1>My Team</h1>
          <p>The people who report to you, the companies they handle and what is waiting for your review.</p>
        </div>
      </div>

      {error && <p className="error-message" role="alert">{error}</p>}

      {!loading && members.length > 0 && (
        <>
          <div className="au-filters">
            <button type="button" className={filter === 'ALL' ? 'active' : ''} onClick={() => setFilter('ALL')}>
              All <em>{members.length}</em>
            </button>
            {roles.map((r) => (
              <button key={r} type="button" className={filter === r ? 'active' : ''} onClick={() => setFilter(r)}>
                {roleName(r)} <em>{counts[r]}</em>
              </button>
            ))}
          </div>
          <div className="acq-search" style={{ maxWidth: 420 }}>
            <Search size={15} />
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email or company…" aria-label="Search team" />
            {q && <button type="button" onClick={() => setQ('')} aria-label="Clear search"><X size={14} /></button>}
          </div>
        </>
      )}

      {loading ? (
        <p className="muted">Loading…</p>
      ) : members.length === 0 ? (
        <div className="au-empty">
          <Users size={30} />
          <p>Nobody reports to you yet. The admin can set you as the Reporting Manager when adding a user.</p>
        </div>
      ) : shown.length === 0 ? (
        <div className="au-empty"><Search size={26} /><p>No team member matches this search.</p></div>
      ) : (
        <div className="au-list">
          {shown.map((m) => (
            <div key={`${m.collection}-${m.id}`} className="au-card">
              <div className="au-card-top">
                <div className="au-avatar">
                  {m.profileImage ? <img src={m.profileImage} alt={m.name} /> : <span>{initialsOf(m.name)}</span>}
                </div>
                <div className="au-id">
                  <h3>{m.name}</h3>
                  <span className={`au-role ${m.role.toLowerCase()}`}>{roleName(m.role)}</span>
                </div>
              </div>
              <dl className="au-meta">
                <div><dt><Mail size={14} /> Email</dt><dd>{m.email}</dd></div>
                <div><dt><Phone size={14} /> Contact</dt><dd>{m.contact || '—'}</dd></div>
                <div><dt><CalendarDays size={14} /> Joined</dt><dd>{fmtJoined(m.createdAt)}</dd></div>
              </dl>

              {m.role === 'SME' && (
                <div className="au-card-actions">
                  <Link to="/rm/creatives" className="btn-ghost" title="Creatives waiting for review">
                    <Palette size={15} /> {m.pendingCreatives} creative{m.pendingCreatives === 1 ? '' : 's'}
                  </Link>
                  <Link to="/rm/meetings" className="btn-ghost" title="MOMs waiting for review">
                    <CalendarCheck size={15} /> {m.pendingMoms} MOM{m.pendingMoms === 1 ? '' : 's'}
                  </Link>
                  <span className="btn-ghost" style={{ cursor: 'default' }} title="Tasks not completed yet">
                    <ListChecks size={15} /> {m.openTasks} open task{m.openTasks === 1 ? '' : 's'}
                  </span>
                </div>
              )}

              {(m.role === 'SME' || m.role === 'SMI') && (
                <div className="au-companies">
                  <span>Companies ({m.companies.length})</span>
                  <div>
                    {m.companies.length === 0 ? (
                      <em>No companies assigned</em>
                    ) : (
                      m.companies.map((c) => <span key={c.id} className="au-chip" title={c.name}>{c.name}</span>)
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RmTeam;
