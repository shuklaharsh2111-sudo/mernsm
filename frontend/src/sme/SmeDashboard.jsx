import { useEffect, useState } from 'react';
import api from '../api';
import AddMeetingModal from '../components/AddMeetingModal';
import SendMomModal from '../components/SendMomModal';
import MeetingDetailsModal from '../components/MeetingDetailsModal';
import { CompanyBadge, EmptyBadge } from '../components/CompanyBadge';
import TaskManager from '../components/TaskManager';
import CompanyHealth from '../components/CompanyHealth';
import {
  PERIOD_WORD,
  SOP_TYPES,
  errMsg,
  fmtDay,
  todayStr,
  typeLabel
} from '../sopUtils';
import "../style.css";
import "../styles/smedashboard.css";
import "../styles/dashboard-glass.css";
import {
  Clock3,
  Video,
  Flag,
  Plus,

  FileText,
  CheckCircle2,
  XCircle,
  Undo2
} from 'lucide-react';
// Send MoM button: label / icon / tooltip by MoM status ('none' = not sent yet).
const MOM_BTN = {
  none: { label: 'Send MoM', icon: <FileText size={15} />, title: 'Send the minutes of this meeting to admin' },
  pending: { label: 'MoM Pending', icon: <Clock3 size={15} />, title: 'Waiting for admin to review' },
  approved: { label: 'MoM Approved', icon: <CheckCircle2 size={15} />, title: 'Admin approved this MoM' },
  sent_back: { label: 'Edit MoM', icon: <Undo2 size={15} />, title: 'Admin asked for changes. Edit and resubmit' },
  rejected: { label: 'MoM Rejected', icon: <XCircle size={15} />, title: 'Admin rejected this MoM' }
};
const MAX_AVATARS = 4;

const AVATAR_COLORS = ['#f26b0f', '#d92d0a', '#ffb04d', '#c2410c', '#e0709a', '#a16207'];
const initials = (name) =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('');
const avatarColor = (name) => AVATAR_COLORS[[...name].reduce((n, ch) => n + ch.charCodeAt(0), 0) % AVATAR_COLORS.length];

const SLOTS = 5; // a user can have at most 5 companies

const SmeDashboard = () => {
  const [companies, setCompanies] = useState([]);
  const [assigned, setAssigned] = useState(null);
  const [error, setError] = useState('');
  const [typeTab, setTypeTab] = useState('all');
  const [meetings, setMeetings] = useState(null);
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [joiningIds, setJoiningIds] = useState([]);
  const [detailId, setDetailId] = useState(null); // meeting whose details are open
  const [momMeeting, setMomMeeting] = useState(null); // meeting whose MOM is being written
  const [savingIds, setSavingIds] = useState([]); // ticks being written right now

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.get('/sme/companies'),
      api.get('/sme/sop-assignments', { params: { today: todayStr() } }),
      api.get('/sme/meetings'),
    ])
      .then(([c, a, m]) => {
        if (cancelled) return;
        setCompanies(c.data.companies);
        setAssigned(a.data.assignments);
        setMeetings(m.data.meetings);
      })
      .catch((err) => !cancelled && setError(errMsg(err)));
    return () => {
      cancelled = true;
    };
  }, []);
  const slots = Array.from(
    { length: SLOTS },
    (_, i) => companies[i] || null
  );
  const shownSops = (assigned || []).filter(
    (a) => typeTab === 'all' || a.type === typeTab
  );
  // SOP TICK
  const toggleTick = async (a) => {
    if (savingIds.includes(a.id)) return;
    const want = !a.done;
    setError('');
    setSavingIds((ids) => [...ids, a.id]);
    setAssigned((list) =>
      list.map((x) =>
        x.id === a.id ? { ...x, done: want } : x
      )
    );
    try {
      const res = await api.put(
        '/sme/sop-assignments/completions',
        {
          today: todayStr(),
          changes: [{ id: a.id, done: want }]
        }
      );
      setAssigned(res.data.assignments);
    } catch (err) {
      setAssigned((list) =>
        list.map((x) =>
          x.id === a.id ? { ...x, done: !want } : x
        )
      );
      setError(errMsg(err));
    } finally {
      setSavingIds((ids) =>
        ids.filter((id) => id !== a.id)
      );
    }
  };
  // LIVE CLOCK
  const [currentDate, setCurrentDate] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDate(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);
  const handleAddMeeting = () => setShowMeetingModal(true);

  // Meetings whose MOM is approved are saved under Records; the rest stay active here.
  const activeMeetings = (meetings || []).filter((m) => m.mom?.status !== 'approved');

  const sopActive = (assigned || []).filter((a) => a.active);
  const sopDone = sopActive.filter((a) => a.done).length;
  const sopPct = sopActive.length ? Math.round((sopDone / sopActive.length) * 100) : 0;
  const countFor = (t) => (assigned || []).filter((a) => t === 'all' || a.type === t).length;
  // group the visible SOPs by company so each client's checklist reads together
  const sopGroups = Object.values(
    shownSops.reduce((acc, a) => {
      const k = a.company.id || a.company.name;
      (acc[k] = acc[k] || { name: a.company.name, items: [] }).items.push(a);
      return acc;
    }, {})
  );

  const onMeetingSaved = (meeting) => {
    setMeetings((list) =>
      [...(list || []), meeting].sort((x, y) => `${x.date} ${x.time}`.localeCompare(`${y.date} ${y.time}`))
    );
    setShowMeetingModal(false);
  };

  const onMeetingUpdated = (meeting) => setMeetings((list) => list.map((m) => (m.id === meeting.id ? meeting : m)));
  const detailMeeting = (meetings || []).find((m) => m.id === detailId) || null;

  const onMomSaved = (meeting) => {
    setMeetings((list) => list.map((m) => (m.id === meeting.id ? meeting : m)));
    setMomMeeting(null);
  };

  // Join Now: open the meeting, then remember that I joined (this shows the Send MOM button).
  const handleJoin = async (m) => {
    if (!hasStarted(m) || joiningIds.includes(m.id)) return;
    window.open(m.link, '_blank', 'noopener,noreferrer'); // opened straight from the click so it isn't popup-blocked
    setError('');
    setJoiningIds((ids) => [...ids, m.id]);
    try {
      const p = (x) => String(x).padStart(2, '0');
      const n = new Date();
      const now = `${todayStr()}T${p(n.getHours())}:${p(n.getMinutes())}`;
      const res = await api.put(`/sme/meetings/${m.id}/join`, { now });
      setMeetings((list) => list.map((x) => (x.id === m.id ? res.data.meeting : x)));
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setJoiningIds((ids) => ids.filter((id) => id !== m.id));
    }
  };

  // A meeting has started once its date + time has passed (clock ticks every second).
  const hasStarted = (m) => currentDate >= new Date(`${m.date}T${m.time}:00`);

  const fmtTime = (t) => {
    const [h, m] = t.split(':').map(Number);
    return new Date(2000, 0, 1, h, m).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
  };
  const dateParts = (dateStr) => {
    const d = new Date(`${dateStr}T00:00:00`);
    return {
      day: String(d.getDate()).padStart(2, '0'),
      mon: d.toLocaleDateString('en-IN', { month: 'short' }),
      wk: d.toLocaleDateString('en-IN', { weekday: 'short' })
    };
  };
  return (
    <div className="dashboard-content scrollable dash-glass">
      {/* MY COMPANIES */}
      <div className="dash-section-title">My companies</div>
      <div className="company-row" aria-label="Your companies">
        {slots.map((c, i) =>
          c ? (
            <CompanyBadge
              key={c.id}
              company={c}
              size={72}
              showName
            />
          ) : (
            <EmptyBadge
              key={`empty-${i}`}
              size={72}
              showName
            />
          )
        )}
      </div>
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      <div className="dash-section-title">Today's work</div>
      <div className="sop-meeting-row">
        {/* SOP PANEL */}
        <div className="glass-panel sop-panel">
          <div className="sop-head">
            <div>
              <h2>My assigned SOPs</h2>
              <p className="sop-sub">
                {assigned ? `${sopDone} of ${sopActive.length} completed` : 'Loading…'}
              </p>
            </div>
            <div className="sop-progress" aria-label={`${sopPct}% complete`}>
              <strong>{sopPct}%</strong>
              <div className="kpi-bar"><i style={{ width: `${sopPct}%` }} /></div>
            </div>
          </div>
          <div className="sop-tabs">
            {[{ value: 'all', label: 'All' }, ...SOP_TYPES].map((t) => (
              <button
                key={t.value}
                type="button"
                className={typeTab === t.value ? 'active' : ''}
                onClick={() => setTypeTab(t.value)}
              >
                {t.label}
                <span className="sop-tab-count">{countFor(t.value)}</span>
              </button>
            ))}
          </div>
          {!assigned ? (
            <p className="muted">Loading…</p>
          ) : shownSops.length === 0 ? (
            <p className="muted">
              No SOPs assigned{typeTab === 'all' ? '' : ` (${typeLabel(typeTab)})`} yet.
            </p>
          ) : (
            <div className="sop-list">
              {sopGroups.map((g) => {
                const gDone = g.items.filter((x) => x.done).length;
                return (
                  <div className="sop-group" key={g.name}>
                    <div className="sop-group-head">
                      <span className="sop-co">{g.name}</span>
                      <span className="sop-count">{gDone}/{g.items.length}</span>
                    </div>
                    {g.items.map((a) => (
                      <label
                        key={a.id}
                        className={`sme-sop tick ${a.done ? 'done' : ''} ${a.active ? '' : 'upcoming'}`}
                      >
                        <input
                          type="checkbox"
                          checked={a.done}
                          disabled={!a.active || savingIds.includes(a.id)}
                          onChange={() => toggleTick(a)}
                        />
                        <div className="sme-sop-body">
                          <div className="sop-item-top">
                            <span className={`sop-pill ${a.type}`}>{typeLabel(a.type)}</span>
                            <span className="muted">
                              {a.active ? `Done ${PERIOD_WORD[a.type]}?` : `Starts ${fmtDay(a.date)}`}
                            </span>
                            <span className={`sop-status ${a.done ? 'done' : a.active ? 'todo' : 'later'}`}>
                              {a.done ? 'Done' : a.active ? 'To do' : 'Upcoming'}
                            </span>
                          </div>
                          <p className="sop-item-text">{a.text}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        {/* MEETINGS */}
        <div className="glass-panel meeting-panel">
          <div className="meeting-header">
            <div className="meeting-header-title">
              <h2>Meetings</h2>
              <span className="meeting-count">{meetings ? String(activeMeetings.length).padStart(2, '0') : '--'}</span>
            </div>
            <button
              type="button"
              className="add-meeting-btn"
              onClick={handleAddMeeting}
            >
              <Plus size={16} />
              Add Meeting
            </button>
          </div>
        {!meetings ? (
          <p className="muted">Loading…</p>
        ) : activeMeetings.length === 0 ? (
          <p className="muted">No meetings scheduled yet.</p>
        ) : (
          <div className="meeting-list">
            {activeMeetings.map((m) => (
              <div
                className="meeting-item clickable"
                key={m.id}
                role="button"
                tabIndex={0}
                title="Click to view details or add attendees"
                onClick={() => setDetailId(m.id)}
                onKeyDown={(e) => {
                  if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    setDetailId(m.id);
                  }
                }}
              >
                <div className="mt-date" aria-hidden="true">
                  <b>{dateParts(m.date).day}</b>
                  <span>{dateParts(m.date).mon}</span>
                </div>

                <div className="mt-body">
                  <div className="mt-top">
                    <span className="meeting-company">{m.company.name}</span>
                    {m.priority && (
                      <span className={`prio-pill ${m.priority}`} title="Scheduled from the previous meeting's MOM">
                        <Flag size={11} /> {m.priority}
                      </span>
                    )}
                  </div>
                  <h3 className="meeting-title">{m.subject}</h3>
                  <div className="mt-meta">
                    <span className="mt-time">
                      <Clock3 size={13} />
                      {dateParts(m.date).wk}, {fmtTime(m.time)}
                    </span>
                    <span className={`mt-state ${hasStarted(m) ? 'live' : ''}`}>{hasStarted(m) ? 'Started' : 'Upcoming'}</span>
                    <div className="avatar-stack" aria-label="Attendees">
                      {m.attendees.slice(0, MAX_AVATARS).map((a, i) => (
                        <span
                          key={`${a.name}-${i}`}
                          className="avatar"
                          style={{ background: avatarColor(a.name) }}
                          title={a.designation ? `${a.name} — ${a.designation}` : a.name}
                        >
                          {initials(a.name)}
                        </span>
                      ))}
                      {m.attendees.length > MAX_AVATARS && (
                        <span className="avatar avatar-more" title={m.attendees.slice(MAX_AVATARS).map((a) => a.name).join(', ')}>
                          +{m.attendees.length - MAX_AVATARS}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-actions">
                  <button
                    type="button"
                    className="join-now-btn"
                    disabled={!hasStarted(m) || joiningIds.includes(m.id)}
                    title={hasStarted(m) ? 'Join the meeting' : `Available from ${fmtDay(m.date)}, ${fmtTime(m.time)}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleJoin(m);
                    }}
                  >
                    <Video size={15} /> Join Now
                  </button>
                  {m.joined && (
                    <button
                      type="button"
                      className={`send-mom-btn ${m.mom?.status || ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setMomMeeting(m);
                      }}
                      title={MOM_BTN[m.mom?.status] ? MOM_BTN[m.mom.status].title : MOM_BTN.none.title}
                    >
                      {MOM_BTN[m.mom?.status]?.icon || MOM_BTN.none.icon}
                      {MOM_BTN[m.mom?.status]?.label || MOM_BTN.none.label}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      </div>

      {showMeetingModal && (
        <AddMeetingModal companies={companies} onSaved={onMeetingSaved} onClose={() => setShowMeetingModal(false)} />
      )}

      {detailMeeting && <MeetingDetailsModal meeting={detailMeeting} onUpdated={onMeetingUpdated} onClose={() => setDetailId(null)} />}

      {momMeeting && <SendMomModal meeting={momMeeting} onSaved={onMomSaved} onClose={() => setMomMeeting(null)} />}

      <TaskManager />
      <CompanyHealth />
    </div>
  );
};
export default SmeDashboard;