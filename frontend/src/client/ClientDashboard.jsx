import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Users, ListChecks, CalendarDays, Video, CheckCircle2, Circle } from 'lucide-react';
import api from '../api';
import { errMsg, todayStr } from '../sopUtils';
import '../styles/client.css';

const TYPES = [
  { id: 'all', label: 'All' },
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' }
];

const fmtDate = (s) => new Date(`${s}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' });
const fmtTime = (t) => {
  const [h, m] = t.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};
const initials = (name) => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('');
const pct = (done, total) => (total ? Math.round((done / total) * 100) : 0);

const ClientDashboard = () => {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('all');

  useEffect(() => {
    let cancelled = false;
    api.get('/client/dashboard', { params: { today: todayStr() } })
      .then((res) => !cancelled && setData(res.data))
      .catch((e) => !cancelled && setError(errMsg(e)));
    return () => { cancelled = true; };
  }, []);

  if (error) return <div className="dashboard-content scrollable"><p className="error-message" role="alert">{error}</p></div>;
  if (!data) return <div className="dashboard-content scrollable"><p className="muted">Loading…</p></div>;

  const { company, team, sops, meetings } = data;
  const list = tab === 'all' ? sops.list : sops.list.filter((s) => s.type === tab);
  const progress = pct(sops.done, sops.total);

  return (
    <div className="dashboard-content scrollable cl-page">
      <div className="cl-hero">
        <div className="cl-logo">
          {company.logo ? <img src={company.logo} alt={`${company.name} logo`} /> : <Building2 size={30} />}
        </div>
        <div>
          <span className="page-label">CLIENT DASHBOARD</span>
          <h1>Welcome, {company.name}</h1>
          <p>Here is how your social media work is going.</p>
        </div>
        <Link to="/client/calendar" className="btn-primary cl-hero-btn"><CalendarDays size={15} /> Content calendar</Link>
      </div>

      <div className="cl-kpis">
        <div className="cl-kpi">
          <Users size={18} />
          <strong>{team.length}</strong>
          <span>Team members on your account</span>
        </div>
        <div className="cl-kpi">
          <ListChecks size={18} />
          <strong>{sops.done}/{sops.total}</strong>
          <span>Routine tasks done this period</span>
          <div className="cl-bar" aria-label={`${progress}% done`}><i style={{ width: `${progress}%` }} /></div>
        </div>
        <div className="cl-kpi">
          <CalendarDays size={18} />
          <strong>{meetings.upcoming.length}</strong>
          <span>Upcoming meetings</span>
        </div>
      </div>

      <div className="cl-grid">
        <section className="glass-panel cl-card">
          <h2>Your team</h2>
          {team.length === 0 ? <p className="muted">No one is assigned to your account yet.</p> : (
            <ul className="cl-team">
              {team.map((m) => (
                <li key={m.id}>
                  {m.avatar ? <img src={m.avatar} alt="" /> : <span className="cl-av">{initials(m.name)}</span>}
                  <div><b>{m.name}</b><small>{m.role}</small>{m.email && <small><a href={`mailto:${m.email}`} style={{ color: 'inherit' }}>{m.email}</a></small>}</div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="glass-panel cl-card">
          <h2>Upcoming meetings</h2>
          {meetings.upcoming.length === 0 ? <p className="muted">No meetings scheduled.</p> : (
            <ul className="cl-meet">
              {meetings.upcoming.map((m) => (
                <li key={m.id}>
                  <div className="cl-when"><b>{fmtDate(m.date)}</b><small>{fmtTime(m.time)}</small></div>
                  <div className="cl-what"><b>{m.subject}</b><small>with {m.host}</small></div>
                  {m.link && <a className="btn-ghost" href={m.link} target="_blank" rel="noreferrer"><Video size={14} /> Join</a>}
                </li>
              ))}
            </ul>
          )}
          {meetings.recent.length > 0 && (
            <>
              <h3>Recent</h3>
              <ul className="cl-meet past">
                {meetings.recent.map((m) => (
                  <li key={m.id}>
                    <div className="cl-when"><b>{fmtDate(m.date)}</b><small>{fmtTime(m.time)}</small></div>
                    <div className="cl-what"><b>{m.subject}</b><small>with {m.host}</small></div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>

      <section className="glass-panel cl-card">
        <div className="cl-head">
          <h2>Routine task progress</h2>
          <div className="cl-tabs">
            {TYPES.map((t) => (
              <button key={t.id} type="button" className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
                {t.label}{t.id !== 'all' && sops.byType[t.id] ? ` ${sops.byType[t.id].done}/${sops.byType[t.id].total}` : ''}
              </button>
            ))}
          </div>
        </div>
        {list.length === 0 ? <p className="muted">Nothing to show here yet.</p> : (
          <ul className="cl-sops">
            {list.map((s) => (
              <li key={s.id} className={s.done ? 'done' : ''}>
                {s.done ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                <div><b>{s.text}</b><small>{s.type} · {s.assignee}</small></div>
                <span className={`cl-chip ${s.done ? 'ok' : ''}`}>{s.done ? 'Done' : 'Pending'}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

export default ClientDashboard;
