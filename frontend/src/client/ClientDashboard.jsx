import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, CalendarDays, Video, CheckCircle2, Circle, RotateCcw, BadgeCheck, FileText, ArrowRight, Users, ListChecks } from 'lucide-react';
import api from '../api';
import { errMsg, todayStr } from '../sopUtils';
import '../styles/client.css';
import '../styles/clientdash.css';

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

// Round progress meter for the routine tasks.
const Ring = ({ value }) => {
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <svg className="cd-ring" width="64" height="64" viewBox="0 0 64 64" role="img" aria-label={`${value}% done`}>
      <circle cx="32" cy="32" r={r} className="cd-ring-bg" />
      <circle cx="32" cy="32" r={r} className="cd-ring-fg" strokeDasharray={c} strokeDashoffset={c - (c * value) / 100} />
      <text x="32" y="36" textAnchor="middle">{value}%</text>
    </svg>
  );
};

const ClientDashboard = () => {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('all');
  const [formsWaiting, setFormsWaiting] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api.get('/client/dashboard', { params: { today: todayStr() } })
      .then((res) => !cancelled && setData(res.data))
      .catch((e) => !cancelled && setError(errMsg(e)));
    // forms are optional here: if this fails the dashboard just hides the reminder
    api.get('/forms/received')
      .then((res) => !cancelled && setFormsWaiting((res.data.forms || []).filter((f) => f.status === 'pending').length))
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  if (error) return <div className="dashboard-content scrollable"><p className="error-message" role="alert">{error}</p></div>;
  if (!data) return <div className="dashboard-content scrollable"><p className="muted">Loading…</p></div>;

  const { company, team, sops, meetings } = data;
  const creatives = data.creatives || { approved: 0, redo: 0, redoList: [] };
  const list = tab === 'all' ? sops.list : sops.list.filter((s) => s.type === tab);
  const progress = pct(sops.done, sops.total);
  const nextMeeting = meetings.upcoming[0];
  const otherMeetings = meetings.upcoming.slice(1);

  return (
    <div className="dashboard-content scrollable cd-page">
      {/* WELCOME */}
      <header className="cd-hero">
        <div className="cd-logo">
          {company.logo ? <img src={company.logo} alt={`${company.name} logo`} /> : <Building2 size={30} />}
        </div>
        <div className="cd-hero-text">
          <span className="page-label">CLIENT DASHBOARD</span>
          <h1>Welcome, {company.name}</h1>
          <p>Here is a quick look at how your social media work is going.</p>
        </div>
        <Link to="/client/calendar" className="btn-primary cd-hero-btn"><CalendarDays size={15} /> Content calendar</Link>
      </header>

      {/* THINGS THAT NEED YOU */}
      {(formsWaiting > 0 || creatives.redo > 0) && (
        <div className="cd-alerts">
          {formsWaiting > 0 && (
            <Link to="/client/forms" className="cd-alert">
              <FileText size={18} />
              <span><b>{formsWaiting} form{formsWaiting > 1 ? 's' : ''} waiting for you</b><small>Your team needs your answers to get started.</small></span>
              <ArrowRight size={16} />
            </Link>
          )}
          {creatives.redo > 0 && (
            <Link to="/client/calendar?view=redo" className="cd-alert">
              <RotateCcw size={18} />
              <span><b>{creatives.redo} creative{creatives.redo > 1 ? 's' : ''} in redo</b><small>Your team is working on your changes.</small></span>
              <ArrowRight size={16} />
            </Link>
          )}
        </div>
      )}

      {/* AT A GLANCE */}
      <section className="cd-stats" aria-label="At a glance">
        <Link to="/client/calendar" className="cd-stat">
          <span className="cd-stat-icon ok"><BadgeCheck size={18} /></span>
          <strong>{creatives.approved}</strong>
          <small>Approved creatives</small>
        </Link>
        <Link to="/client/calendar?view=redo" className="cd-stat">
          <span className="cd-stat-icon warn"><RotateCcw size={18} /></span>
          <strong>{creatives.redo}</strong>
          <small>In redo</small>
        </Link>
        <div className="cd-stat">
          <span className="cd-stat-icon"><CalendarDays size={18} /></span>
          <strong>{meetings.upcoming.length}</strong>
          <small>Upcoming meetings</small>
        </div>
        <div className="cd-stat cd-stat-ring">
          <Ring value={progress} />
          <div>
            <strong>{sops.done}/{sops.total}</strong>
            <small>Routine tasks done</small>
          </div>
        </div>
      </section>

      <div className="cd-cols">
        <div className="cd-col">
          {/* REDO */}
          <section className="cd-card">
            <div className="cd-card-head">
              <h2>Creatives in redo</h2>
              <Link to="/client/calendar?view=redo" className="cd-link">Open redo <ArrowRight size={14} /></Link>
            </div>
            {creatives.redoList.length === 0 ? (
              <p className="cd-empty">Nothing in redo. When you send changes on a creative, it shows here until the new version is approved.</p>
            ) : (
              <ul className="cd-list">
                {creatives.redoList.map((r) => (
                  <li key={r.id}>
                    <div className="cd-date"><b>{fmtDate(r.date)}</b></div>
                    <div className="cd-grow">
                      <b>{r.title}</b>
                      <small>{r.platforms.join(', ')} · {r.pins} comment{r.pins === 1 ? '' : 's'} sent to your team</small>
                    </div>
                    <span className="cd-tag warn">Redo</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* ROUTINE TASKS */}
          <section className="cd-card">
            <div className="cd-card-head">
              <h2>Routine tasks</h2>
              <div className="cd-tabs" role="tablist">
                {TYPES.map((t) => (
                  <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
                    {t.label}{t.id !== 'all' && sops.byType[t.id] ? <i>{sops.byType[t.id].done}/{sops.byType[t.id].total}</i> : null}
                  </button>
                ))}
              </div>
            </div>
            {list.length === 0 ? <p className="cd-empty">Nothing to show here yet.</p> : (
              <ul className="cd-list">
                {list.map((s) => (
                  <li key={s.id} className={s.done ? 'done' : ''}>
                    <span className={`cd-check ${s.done ? 'ok' : ''}`}>{s.done ? <CheckCircle2 size={18} /> : <Circle size={18} />}</span>
                    <div className="cd-grow">
                      <b>{s.text}</b>
                      <small>{s.type} · {s.assignee}</small>
                    </div>
                    <span className={`cd-tag ${s.done ? 'ok' : ''}`}>{s.done ? 'Done' : 'Pending'}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="cd-col">
          {/* MEETINGS */}
          <section className="cd-card">
            <div className="cd-card-head"><h2>Meetings</h2></div>
            {!nextMeeting ? <p className="cd-empty">No meetings scheduled.</p> : (
              <div className="cd-next">
                <small>Next meeting</small>
                <b>{nextMeeting.subject}</b>
                <span>{fmtDate(nextMeeting.date)} · {fmtTime(nextMeeting.time)} · with {nextMeeting.host}</span>
                {nextMeeting.link && <a className="btn-primary" href={nextMeeting.link} target="_blank" rel="noreferrer"><Video size={14} /> Join meeting</a>}
              </div>
            )}
            {otherMeetings.length > 0 && (
              <ul className="cd-list compact">
                {otherMeetings.map((m) => (
                  <li key={m.id}>
                    <div className="cd-date"><b>{fmtDate(m.date)}</b><small>{fmtTime(m.time)}</small></div>
                    <div className="cd-grow"><b>{m.subject}</b><small>with {m.host}</small></div>
                    {m.link && <a className="cd-icon-btn" href={m.link} target="_blank" rel="noreferrer" aria-label="Join meeting"><Video size={14} /></a>}
                  </li>
                ))}
              </ul>
            )}
            {meetings.recent.length > 0 && (
              <>
                <h3 className="cd-sub">Recent</h3>
                <ul className="cd-list compact past">
                  {meetings.recent.map((m) => (
                    <li key={m.id}>
                      <div className="cd-date"><b>{fmtDate(m.date)}</b><small>{fmtTime(m.time)}</small></div>
                      <div className="cd-grow"><b>{m.subject}</b><small>with {m.host}</small></div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          {/* TEAM */}
          <section className="cd-card">
            <div className="cd-card-head"><h2>Your team</h2><span className="cd-count"><Users size={13} /> {team.length}</span></div>
            {team.length === 0 ? <p className="cd-empty">No one is assigned to your account yet.</p> : (
              <ul className="cd-team">
                {team.map((m) => (
                  <li key={m.id}>
                    {m.avatar ? <img src={m.avatar} alt="" /> : <span className="cd-av">{initials(m.name)}</span>}
                    <div>
                      <b>{m.name}</b>
                      <small>{m.role}</small>
                      {m.email && <a href={`mailto:${m.email}`}>{m.email}</a>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default ClientDashboard;
