import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { Mail, Phone, CalendarDays, Palette, CalendarCheck, ListChecks, Search, X, Users, UserPlus, Check, BarChart3 } from 'lucide-react';
import api from '../api';
import { errMsg } from '../sopUtils';
import { roleName } from '../roleNames';
import '../style.css';
import '../styles/adminusers.css';
import '../styles/rmteam.css';

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

  // "Add team" popup
  const [addOpen, setAddOpen] = useState(false);
  const [pool, setPool] = useState([]);
  const [poolLoading, setPoolLoading] = useState(false);
  const [poolError, setPoolError] = useState('');
  const [poolRole, setPoolRole] = useState('ALL');
  const [poolQ, setPoolQ] = useState('');
  const [picked, setPicked] = useState({}); // key -> { id, collection }
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState('');

  const loadTeam = () => api.get('/rm/team')
    .then((r) => setMembers(r.data.members))
    .catch((err) => setError(errMsg(err)))
    .finally(() => setLoading(false));

  useEffect(() => { loadTeam(); }, []);

  const keyOf = (u) => `${u.collection}-${u.id}`;

  // "Work details" popup
  const [workFor, setWorkFor] = useState(null);
  const [workRange, setWorkRange] = useState('month');
  const [work, setWork] = useState(null);
  const [workLoading, setWorkLoading] = useState(false);
  const [workError, setWorkError] = useState('');

  useEffect(() => {
    if (!workFor) return undefined;
    let cancelled = false;
    setWorkLoading(true);
    setWorkError('');
    api.get(`/rm/team/${workFor.collection}/${workFor.id}/work`, { params: { range: workRange } })
      .then((r) => !cancelled && setWork(r.data))
      .catch((err) => !cancelled && setWorkError(errMsg(err)))
      .finally(() => !cancelled && setWorkLoading(false));
    return () => { cancelled = true; };
  }, [workFor, workRange]);

  const openWork = (m) => { setWork(null); setWorkRange('month'); setWorkFor(m); };
  const closeWork = () => { setWorkFor(null); setWork(null); };

  const openAdd = () => {
    setAddOpen(true);
    setPicked({});
    setPoolQ('');
    setPoolRole('ALL');
    setPoolError('');
    setPoolLoading(true);
    api.get('/rm/available-users')
      .then((r) => setPool(r.data.users))
      .catch((err) => setPoolError(errMsg(err)))
      .finally(() => setPoolLoading(false));
  };
  const closeAdd = () => { if (!adding) setAddOpen(false); };

  const togglePick = (u) => {
    if (u.reportsTo) return;
    setPicked((p) => {
      const next = { ...p };
      const k = keyOf(u);
      if (next[k]) delete next[k]; else next[k] = { id: u.id, collection: u.collection };
      return next;
    });
  };

  const pickedCount = Object.keys(picked).length;

  const confirmAdd = async () => {
    if (!pickedCount) return;
    setAdding(true);
    setPoolError('');
    try {
      const r = await api.post('/rm/team/add', { members: Object.values(picked) });
      setNotice(r.data.message);
      setAddOpen(false);
      await loadTeam();
      setTimeout(() => setNotice(''), 4000);
    } catch (err) {
      setPoolError(errMsg(err));
    } finally {
      setAdding(false);
    }
  };

  const poolRoles = useMemo(() => [...new Set(pool.map((u) => u.role))], [pool]);
  const poolShown = useMemo(() => {
    const words = poolQ.toLowerCase().split(/\s+/).filter(Boolean);
    return pool.filter((u) => {
      if (poolRole !== 'ALL' && u.role !== poolRole) return false;
      if (!words.length) return true;
      const hay = [u.name, u.email, u.contact].join(' ').toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }, [pool, poolRole, poolQ]);
  // grouped department-wise
  const poolGroups = useMemo(() => {
    const g = {};
    poolShown.forEach((u) => { (g[u.role] = g[u.role] || []).push(u); });
    return Object.entries(g);
  }, [poolShown]);

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
        <button type="button" className="btn-primary" onClick={openAdd}>
          <UserPlus size={16} /> Add team
        </button>
      </div>

      {notice && <p className="rm-add-notice" role="status"><Check size={14} /> {notice}</p>}

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
          <p>Nobody reports to you yet. Use “Add team” to bring people from any department into your team.</p>
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

              <button type="button" className="btn-ghost rm-work-btn" onClick={() => openWork(m)}>
                <BarChart3 size={15} /> View work details
              </button>

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

      {addOpen && createPortal(
        <div className="modal-overlay" onClick={closeAdd}>
          <div className="modal-card rm-add-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Add team members">
            <div className="rm-add-head">
              <div>
                <h3>Add team members</h3>
                <p>Pick people from any department. They will report to you.</p>
              </div>
              <button type="button" className="rm-add-close" onClick={closeAdd} aria-label="Close" disabled={adding}><X size={16} /></button>
            </div>

            {poolError && <p className="error-message" role="alert">{poolError}</p>}

            <div className="au-filters">
              <button type="button" className={poolRole === 'ALL' ? 'active' : ''} onClick={() => setPoolRole('ALL')}>
                All <em>{pool.length}</em>
              </button>
              {poolRoles.map((r) => (
                <button key={r} type="button" className={poolRole === r ? 'active' : ''} onClick={() => setPoolRole(r)}>
                  {roleName(r)} <em>{pool.filter((u) => u.role === r).length}</em>
                </button>
              ))}
            </div>
            <div className="rm-add-search">
              <Search size={15} />
              <input type="search" value={poolQ} onChange={(e) => setPoolQ(e.target.value)} placeholder="Search name or email…" aria-label="Search people" />
              {poolQ && <button type="button" onClick={() => setPoolQ('')} aria-label="Clear search"><X size={14} /></button>}
            </div>

            <div className="rm-add-body">
              {poolLoading ? (
                <p className="muted">Loading…</p>
              ) : poolGroups.length === 0 ? (
                <div className="au-empty"><Users size={26} /><p>No one available to add.</p></div>
              ) : (
                poolGroups.map(([role, list]) => (
                  <section key={role} className="rm-add-group">
                    <h4>{roleName(role)} <em>{list.length}</em></h4>
                    {list.map((u) => {
                      const locked = !!u.reportsTo;
                      const on = !!picked[keyOf(u)];
                      return (
                        <label key={keyOf(u)} className={`rm-add-row${on ? ' on' : ''}${locked ? ' locked' : ''}`}>
                          <input type="checkbox" checked={on} disabled={locked} onChange={() => togglePick(u)} />
                          <span className="rm-add-avatar">
                            {u.profileImage ? <img src={u.profileImage} alt="" /> : <span>{initialsOf(u.name)}</span>}
                          </span>
                          <span className="rm-add-text">
                            <strong>{u.name}</strong>
                            <small>{u.email}</small>
                          </span>
                          {locked && <span className="rm-add-tag" title="Already has a reporting manager">Reports to {u.reportsTo.name}</span>}
                        </label>
                      );
                    })}
                  </section>
                ))
              )}
            </div>

            <div className="rm-add-foot">
              <span>{pickedCount} selected</span>
              <div>
                <button type="button" className="btn-ghost" onClick={closeAdd} disabled={adding}>Cancel</button>
                <button type="button" className="btn-primary" onClick={confirmAdd} disabled={adding || !pickedCount}>
                  {adding ? 'Adding…' : `Add ${pickedCount || ''} to team`.replace('  ', ' ')}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {workFor && createPortal(
        <div className="modal-overlay" onClick={closeWork}>
          <div className="modal-card rm-add-modal rm-work-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Work details">
            <div className="rm-add-head">
              <div>
                <h3>{workFor.name}</h3>
                <p>{roleName(workFor.role)} · work done</p>
              </div>
              <button type="button" className="rm-add-close" onClick={closeWork} aria-label="Close"><X size={16} /></button>
            </div>

            <div className="au-filters">
              {[['week', 'Last 7 days'], ['month', 'Last 30 days'], ['all', 'All time']].map(([k, label]) => (
                <button key={k} type="button" className={workRange === k ? 'active' : ''} onClick={() => setWorkRange(k)}>{label}</button>
              ))}
            </div>

            <div className="rm-add-body">
              {workError && <p className="error-message" role="alert">{workError}</p>}
              {workLoading && !work ? (
                <p className="muted">Loading…</p>
              ) : work && (
                <>
                  {work.sections.map((sec) => (
                    <section key={sec.title} className="rm-add-group">
                      <h4>{sec.title}</h4>
                      <div className="rm-work-tiles">
                        {sec.stats.map((st) => (
                          <div key={st.label} className={`rm-work-tile ${st.tone}`}>
                            <strong>{st.value}</strong>
                            <span>{st.label}</span>
                          </div>
                        ))}
                      </div>
                    </section>
                  ))}
                  <section className="rm-add-group">
                    <h4>Recent work <em>{work.recent.length}</em></h4>
                    {work.recent.length === 0 ? (
                      <p className="muted">No work recorded in this period.</p>
                    ) : work.recent.map((r, i) => (
                      <div key={`${r.kind}-${i}`} className="rm-work-row">
                        <span className="rm-work-kind">{r.kind}</span>
                        <span className="rm-add-text">
                          <strong>{r.title}</strong>
                          <small>{[r.sub, r.at ? fmtJoined(r.at) : ''].filter(Boolean).join(' · ')}</small>
                        </span>
                        <span className={`rm-work-status ${String(r.status).toLowerCase().replace(/[^a-z]+/g, '-')}`}>{r.status}</span>
                      </div>
                    ))}
                  </section>
                </>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default RmTeam;
