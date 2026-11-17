import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Palette, Clock3, CheckCircle2, AlertCircle, Hourglass, ArrowRight, Building2,
  LoaderCircle, RefreshCw, CalendarDays, FileBarChart
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { WORKFLOW, workflowOf, byPriority, countByWorkflow, formatDate } from './desWorkflow';
import '../styles/desdashboard.css';

const ATTENTION_LIMIT = 6;

const STAT_CARDS = [
  { key: 'todo', label: 'To do', icon: Clock3, tone: 'pending' },
  { key: 'redo', label: 'Redo requested', icon: AlertCircle, tone: 'rejected' },
  { key: 'review', label: 'Awaiting review', icon: Hourglass, tone: 'total' },
  { key: 'approved', label: 'Approved', icon: CheckCircle2, tone: 'approved' }
];

const QUICK_LINKS = [
  { title: 'My Creatives', text: 'Upload designs and track every creative.', path: '/des/creatives', icon: Palette },
  { title: 'Calendar', text: 'See what is scheduled, day by day.', path: '/des/calendar', icon: CalendarDays },
  { title: 'Monthly Reports', text: 'Review your month at a glance.', path: '/des/monthly-reports', icon: FileBarChart }
];

const DesHome = () => {
  const navigate = useNavigate();
  const [creatives, setCreatives] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    const [cRes, coRes] = await Promise.allSettled([
      api.get('/des/creatives'),
      api.get('/des/companies')
    ]);
    if (cRes.status === 'fulfilled') setCreatives(cRes.value.data?.creatives || []);
    else setError(cRes.reason?.response?.data?.message || 'Failed to load your creatives.');
    if (coRes.status === 'fulfilled') setCompanies(Array.isArray(coRes.value.data) ? coRes.value.data : []);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => countByWorkflow(creatives), [creatives]);

  // what the designer has to act on: redo requests first, then work not delivered yet
  const attention = useMemo(
    () => creatives
      .filter((c) => ['redo', 'todo'].includes(workflowOf(c).key))
      .sort(byPriority),
    [creatives]
  );

  const goTo = (filter) => navigate(filter ? `/des/creatives?filter=${filter}` : '/des/creatives');

  if (loading) {
    return (
      <div className="des-loading">
        <LoaderCircle className="des-spinner" size={35} />
        <p>Loading your workspace...</p>
      </div>
    );
  }

  return (
    <div className="des-page">
      <div className="des-header des-home-header">
        <div>
          <div className="des-eyebrow">
            <Palette size={15} />
            DESIGN WORKSPACE
          </div>
          <h1>Dashboard</h1>
          <p>
            {counts.todo + counts.redo > 0
              ? `You have ${counts.todo + counts.redo} ${counts.todo + counts.redo === 1 ? 'creative' : 'creatives'} waiting for your design.`
              : 'You are all caught up. Nothing is waiting for your design.'}
          </p>
        </div>
        <button className="des-refresh" onClick={() => load(true)} disabled={refreshing}>
          <RefreshCw size={17} className={refreshing ? 'des-spin' : ''} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="des-error">
          <AlertCircle size={18} />
          <span>{error}</span>
          <button onClick={() => load()}>Retry</button>
        </div>
      )}

      {/* 1. Where everything stands */}
      <section className="des-section">
        <div className="des-section-head">
          <div>
            <h2>Overview</h2>
            <p>Your creatives by stage. Click a card to open that list.</p>
          </div>
        </div>
        <div className="des-stats">
          {STAT_CARDS.map(({ key, label, icon: Icon, tone }) => (
            <button type="button" key={key} className="des-stat-card des-stat-link" onClick={() => goTo(key)}>
              <div className={`des-stat-icon ${tone}`}>
                <Icon size={21} />
              </div>
              <div>
                <span>{label}</span>
                <h2>{counts[key]}</h2>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* 2. What to do next */}
      <section className="des-section">
        <div className="des-section-head">
          <div>
            <h2>Needs your attention</h2>
            <p>Redo requests first, then creatives you have not delivered yet.</p>
          </div>
          {attention.length > ATTENTION_LIMIT && (
            <button type="button" className="des-link-btn" onClick={() => goTo('todo')}>
              View all {attention.length} <ArrowRight size={15} />
            </button>
          )}
        </div>
        {attention.length === 0 ? (
          <div className="des-companies-empty">
            <CheckCircle2 size={30} />
            <h3>Nothing pending</h3>
            <p>{creatives.length === 0
              ? 'Creatives will appear here once an SME assigns them to you.'
              : 'Every assigned creative has been delivered.'}</p>
          </div>
        ) : (
          <ul className="des-attention-list">
            {attention.slice(0, ATTENTION_LIMIT).map((creative) => {
              const flow = workflowOf(creative);
              return (
                <li key={creative._id}>
                  <button type="button" className="des-attention-row" onClick={() => goTo(flow.key)}>
                    <span className="des-attention-logo">
                      {creative.company?.logo
                        ? <img src={creative.company.logo} alt="" />
                        : <Building2 size={18} />}
                    </span>
                    <span className="des-attention-main">
                      <b>{creative.contentPillar?.title || 'Untitled Creative'}</b>
                      <small>{creative.company?.name || 'Company'} · {formatDate(creative.date)}</small>
                    </span>
                    <span className={`des-status ${flow.badge}`}>{flow.label}</span>
                    <ArrowRight size={16} className="des-attention-arrow" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* 3. Companies */}
      <section className="des-section">
        <div className="des-section-head">
          <div>
            <h2>My Assigned Companies</h2>
            <p>Companies whose creatives have been assigned to you.</p>
          </div>
          <span className="des-company-total">
            {companies.length} {companies.length === 1 ? 'Company' : 'Companies'}
          </span>
        </div>
        {companies.length === 0 ? (
          <div className="des-companies-empty">
            <Building2 size={30} />
            <h3>No Companies Assigned</h3>
            <p>Companies will appear here when creatives are assigned to you.</p>
          </div>
        ) : (
          <div className="des-companies-grid">
            {companies.map((company) => (
              <div className="des-company-card" key={company._id}>
                <div className="des-company-logo">
                  {company.logo ? <img src={company.logo} alt={company.name} /> : <Building2 size={32} />}
                </div>
                <h3>{company.name}</h3>
                <span className="des-company-count">
                  {company.creativeCount} {company.creativeCount === 1 ? 'creative' : 'creatives'}
                  {company.todoCount > 0 && <em> · {company.todoCount} to do</em>}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 4. Where to go */}
      <section className="des-section">
        <div className="des-section-head">
          <div>
            <h2>Quick access</h2>
          </div>
        </div>
        <div className="des-quick-grid">
          {QUICK_LINKS.map(({ title, text, path, icon: Icon }) => (
            <button type="button" key={path} className="des-quick-card" onClick={() => navigate(path)}>
              <span className="des-quick-icon"><Icon size={20} /></span>
              <span className="des-quick-text">
                <b>{title}</b>
                <small>{text}</small>
              </span>
              <ArrowRight size={16} />
            </button>
          ))}
        </div>
      </section>
    </div>
  );
};

export default DesHome;
