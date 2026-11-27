import { useEffect, useMemo, useState } from 'react';
import { Building2, CheckCircle2, Clock3, HeartPulse, Search, AlertTriangle } from 'lucide-react';
import api from '../api';
import { errMsg, todayStr } from '../sopUtils';
import '../style.css';
import '../styles/dashboard-glass.css';
import './superadmin.css';

const HEALTH = {
  healthy: 'Healthy',
  risk: 'Risk',
  critical: 'Critical',
  nodata: 'No creatives',
};
const FILTERS = ['all', 'critical', 'risk', 'healthy', 'nodata'];

const initialsOf = (name = '') => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('') || 'U';

// What is wrong with a company, in words (the numbers behind the health level).
const issuesOf = (c) => [
  c.delays && `${c.delays} delayed`,
  c.overdue && `${c.overdue} overdue`,
  c.redo && `${c.redo} waiting for redo`,
  c.rejected && `${c.rejected} rejection${c.rejected > 1 ? 's' : ''}`,
].filter(Boolean);

const healthSummary = (c) => {
  if (!c.total) return 'No creatives yet.';
  const issues = issuesOf(c);
  return issues.length ? issues.join(' · ') : `All clear · ${c.approvalRate}% approved`;
};

const People = ({ list, empty }) => (
  list.length === 0 ? <span className="muted">{empty}</span> : (
    <div className="co-people">
      {list.map((p) => (
        <span className="co-person" key={p.id} title={p.email}>
          <span className="so-avatar co-avatar">{p.profileImage ? <img src={p.profileImage} alt="" /> : initialsOf(p.name)}</span>
          <span>{p.name}{p.isBanned ? <small> · banned</small> : null}</span>
        </span>
      ))}
    </div>
  )
);

// Super admin only: every company with its SME, SMI, creative counts and health.
const CompanyOverview = () => {
  const [companies, setCompanies] = useState(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    let cancelled = false;
    api.get('/superadmin/company-overview', { params: { today: todayStr() } })
      .then((r) => !cancelled && setCompanies(r.data.companies))
      .catch((e) => !cancelled && setError(errMsg(e)));
    return () => { cancelled = true; };
  }, []);

  const shown = useMemo(() => (companies || []).filter((c) => (
    (filter === 'all' || c.health === filter)
    && (!q.trim() || `${c.name} ${c.smes.map((p) => p.name).join(' ')} ${c.smis.map((p) => p.name).join(' ')}`.toLowerCase().includes(q.trim().toLowerCase()))
  )), [companies, q, filter]);

  const totals = useMemo(() => (companies || []).reduce((t, c) => ({
    approved: t.approved + c.approved,
    pending: t.pending + c.pending,
    unassigned: t.unassigned + (!c.smes.length || !c.smis.length ? 1 : 0),
  }), { approved: 0, pending: 0, unassigned: 0 }), [companies]);

  const countOf = (f) => (f === 'all' ? companies?.length : companies?.filter((c) => c.health === f).length) || 0;

  return (
    <div className="dashboard-content scrollable dash-glass">
      <div className="page-header">
        <div>
          <span className="page-label">SUPER ADMIN</span>
          <h1>Company Overview</h1>
          <p>Each company with its SME and SMI, approved and pending creatives, and how healthy the account is.</p>
        </div>
      </div>

      {error && <p className="error-message" role="alert">{error}</p>}

      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-top"><span className="kpi-label">Companies</span><span className="kpi-icon"><Building2 size={17} /></span></div>
          <strong className="kpi-value">{companies ? companies.length : '–'}</strong>
          <span className="kpi-sub">Client accounts</span>
        </div>
        <div className="kpi-card green">
          <div className="kpi-top"><span className="kpi-label">Approved</span><span className="kpi-icon"><CheckCircle2 size={17} /></span></div>
          <strong className="kpi-value">{companies ? totals.approved : '–'}</strong>
          <span className="kpi-sub">Creatives approved</span>
        </div>
        <div className="kpi-card amber">
          <div className="kpi-top"><span className="kpi-label">Pending</span><span className="kpi-icon"><Clock3 size={17} /></span></div>
          <strong className="kpi-value">{companies ? totals.pending : '–'}</strong>
          <span className="kpi-sub">Waiting for approval</span>
        </div>
        <div className="kpi-card red">
          <div className="kpi-top"><span className="kpi-label">Needs a SME / SMI</span><span className="kpi-icon"><AlertTriangle size={17} /></span></div>
          <strong className="kpi-value">{companies ? totals.unassigned : '–'}</strong>
          <span className="kpi-sub">Companies missing one of them</span>
        </div>
      </div>

      <div className="glass-panel">
        <div className="co-toolbar">
          <label className="co-search">
            <Search size={16} />
            <input type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search company, SME or SMI…" />
          </label>
          <div className="co-filters">
            {FILTERS.map((f) => (
              <button type="button" key={f} className={`co-chip${filter === f ? ' on' : ''}`} onClick={() => setFilter(f)}>
                {f === 'all' ? 'All' : HEALTH[f]} <small>{countOf(f)}</small>
              </button>
            ))}
          </div>
        </div>

        <div className="co-table-wrap">
          <table className="co-table">
            <thead>
              <tr>
                <th>Company</th>
                <th>SME</th>
                <th>SMI</th>
                <th className="num">Approved</th>
                <th className="num">Pending</th>
                <th>Health</th>
              </tr>
            </thead>
            <tbody>
              {!companies && !error ? (
                <tr><td colSpan={6} className="co-empty">Loading…</td></tr>
              ) : shown.length === 0 ? (
                <tr><td colSpan={6} className="co-empty">{companies?.length ? 'No companies match.' : 'No companies yet.'}</td></tr>
              ) : shown.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div className="co-name">
                      <span className="so-avatar">{c.logo ? <img src={c.logo} alt="" /> : initialsOf(c.name)}</span>
                      <strong>{c.name}</strong>
                    </div>
                  </td>
                  <td><People list={c.smes} empty="Not assigned" /></td>
                  <td><People list={c.smis} empty="Not assigned" /></td>
                  <td className={`num${c.approved ? ' good' : ''}`}>{c.approved}<small> / {c.total}</small></td>
                  <td className={`num${c.pending ? ' warn' : ''}`}>{c.pending}</td>
                  <td>
                    <span className={`co-health ${c.health}`}><HeartPulse size={13} /> {HEALTH[c.health]}</span>
                    <small className="co-health-note">{healthSummary(c)}</small>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CompanyOverview;
