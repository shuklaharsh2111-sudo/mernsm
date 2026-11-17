import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Palette, Clock3, CheckCircle2, AlertCircle, Hourglass, ArrowRight, Building2,
  RefreshCw, CalendarDays, FileBarChart
} from 'lucide-react';
import api from '../api';
import { CompanyBadge } from '../components/CompanyBadge';
import { errMsg } from '../sopUtils';
import { workflowOf, byPriority, countByWorkflow, formatDate } from './desWorkflow';
import '../style.css';
import '../styles/dashboard-glass.css';

const ATTENTION_LIMIT = 5;

// same KPI cards as the admin / SME dashboards; each one opens that list
const STAT_CARDS = [
  { key: 'todo', label: 'To do', sub: 'Not delivered yet', icon: Clock3, tone: 'amber' },
  { key: 'redo', label: 'Redo requested', sub: 'Sent back by the SME', icon: AlertCircle, tone: 'red' },
  { key: 'review', label: 'Awaiting review', sub: 'Waiting for the SME', icon: Hourglass, tone: '' },
  { key: 'approved', label: 'Approved', sub: 'Final designs', icon: CheckCircle2, tone: 'green' },
];

const QUICK = [
  { title: 'My Creatives', text: 'Upload designs and track every creative', path: '/des/creatives', icon: Palette },
  { title: 'Calendar', text: 'See what is scheduled, day by day', path: '/des/calendar', icon: CalendarDays },
  { title: 'Monthly Reports', text: 'Review your month at a glance', path: '/des/monthly-reports', icon: FileBarChart },
];

const linkStyle = { textDecoration: 'none', color: 'inherit' };

const DesHome = () => {
  const [creatives, setCreatives] = useState(null);
  const [companies, setCompanies] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    setError('');
    const [cRes, coRes] = await Promise.allSettled([api.get('/des/creatives'), api.get('/des/companies')]);
    setCreatives(cRes.status === 'fulfilled' ? cRes.value.data?.creatives || [] : []);
    setCompanies(coRes.status === 'fulfilled' ? (Array.isArray(coRes.value.data) ? coRes.value.data : coRes.value.data?.companies || []) : []);
    const failed = [cRes, coRes].find((r) => r.status === 'rejected');
    if (failed) setError(errMsg(failed.reason));
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const loading = creatives === null;
  const list = creatives || [];
  const counts = useMemo(() => countByWorkflow(list), [list]);

  // what the designer has to act on: redo requests first, then work not delivered yet
  const attention = useMemo(
    () => list.filter((c) => ['redo', 'todo'].includes(workflowOf(c).key)).sort(byPriority),
    [list]
  );
  const val = (n) => (loading ? '–' : n);
  const deliveredPct = list.length ? Math.round(((counts.review + counts.approved) / list.length) * 100) : 0;

  return (
    <div className="dashboard-content scrollable dash-glass">
      {error && <p className="error-message" role="alert">{error}</p>}

      <div className="dash-section-title">My assigned companies</div>
      <div className="company-row" aria-label="Assigned companies">
        {companies === null ? <p className="muted">Loading…</p> : companies.length === 0 ? (
          <p className="muted">Companies will appear here when creatives are assigned to you.</p>
        ) : companies.map((co) => (
          <Link to="/des/calendar" key={co._id || co.id} style={linkStyle} title={`${co.name} · ${co.creativeCount || 0} creatives${co.todoCount > 0 ? ` · ${co.todoCount} to do` : ''}`}>
            <CompanyBadge company={co} size={72} showName />
          </Link>
        ))}
      </div>

      <div className="kpi-grid">
        {STAT_CARDS.map(({ key, label, sub, icon: Icon, tone }) => (
          <Link to={`/des/creatives?filter=${key}`} className={`kpi-card ${tone}`} key={key} style={linkStyle}>
            <div className="kpi-top"><span className="kpi-label">{label}</span><span className="kpi-icon"><Icon size={17} /></span></div>
            <strong className="kpi-value">{val(counts[key])}</strong>
            <span className="kpi-sub">{sub}</span>
          </Link>
        ))}
        <div className="kpi-card green">
          <div className="kpi-top"><span className="kpi-label">Delivered</span><span className="kpi-icon"><Palette size={17} /></span></div>
          <strong className="kpi-value">{loading ? '–' : `${deliveredPct}%`}</strong>
          <div className="kpi-bar"><i style={{ width: `${deliveredPct}%` }} /></div>
        </div>
      </div>

      <div className="dash-section-title">Waiting for you</div>
      <div>
        <div className="glass-panel">
          <h2>Needs your attention</h2>
          {loading ? <p className="muted">Loading…</p> : attention.length === 0 ? (
            <p className="muted">{list.length === 0
              ? 'Creatives will appear here once an SME assigns them to you.'
              : 'Nothing pending. You are all caught up.'}</p>
          ) : (
            <div className="meeting-list">
              {attention.slice(0, ATTENTION_LIMIT).map((c) => {
                const flow = workflowOf(c);
                return (
                  <Link to={`/des/creatives?filter=${flow.key}`} className="meeting-item clickable" key={c._id} style={linkStyle}>
                    <div className="meeting-item-top">
                      <div className="meeting-item-main">
                        <span className="meeting-company">{c.company?.name || 'Company'}</span>
                        <h3 className="meeting-title">{c.contentPillar?.title || 'Untitled creative'}</h3>
                      </div>
                      <div className="meeting-item-when">
                        <span>{flow.label}</span>
                        <span>{formatDate(c.date)}</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
            <Link to="/des/creatives" className="dash-btn">Open creatives <ArrowRight size={15} /></Link>
            <button type="button" className="dash-btn" onClick={() => load(true)} disabled={refreshing}>
              <RefreshCw size={15} /> {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </div>

      </div>

      <div className="dash-section-title">Quick access</div>
      <div className="quick-grid">
        {QUICK.map(({ title, text, path, icon: Icon }) => (
          <Link to={path} className="quick-card" key={path}>
            <span className="kpi-icon"><Icon size={19} /></span>
            <div><strong>{title}</strong><span>{text}</span></div>
            <ArrowRight size={16} />
          </Link>
        ))}
      </div>
    </div>
  );
};

export default DesHome;
