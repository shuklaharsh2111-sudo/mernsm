import { useAuth } from '../AuthContext';
import { useEffect, useState } from 'react';
import api from '../api';
import AddMeetingModal from '../components/AddMeetingModal';
import SendMomModal from '../components/SendMomModal';
import MeetingDetailsModal from '../components/MeetingDetailsModal';
import { CompanyBadge, EmptyBadge } from '../components/CompanyBadge';
import TaskManager from "../components/TaskManager";
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
import {
  Clock3,
  Video,
  FileText,
  Check,
  XCircle,
  Undo2,
  Flag
} from 'lucide-react';

const SLOTS = 5;
const MOM_BTN = {
  none: { label: 'Send MOM', icon: <FileText size={15} />, title: 'Write the minutes of meeting' },
  pending: { label: 'MOM Pending', icon: <Clock3 size={15} />, title: 'Waiting for admin approval — click to view or edit' },
  approved: { label: 'MOM Approved', icon: <Check size={15} />, title: 'Approved by admin — click to view' },
  sent_back: { label: 'Changes Needed', icon: <Undo2 size={15} />, title: 'The admin sent this back — click to edit and resubmit' },
  rejected: { label: 'MOM Rejected', icon: <XCircle size={15} />, title: 'Rejected by admin — click to view' }
};

const MAX_AVATARS = 4;
const AVATAR_COLORS = ['#7c5cff', '#2bb3a3', '#e0709a', '#e69b3a', '#4f8cff', '#8f6bd6'];
const initials = (name) => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('');
const avatarColor = (name) => AVATAR_COLORS[[...name].reduce((n, ch) => n + ch.charCodeAt(0), 0) % AVATAR_COLORS.length];

const SmeDashboard = () => {
  const { user } = useAuth();
  const [companies, setCompanies] = useState([]);
  const [assigned, setAssigned] = useState(null);
  const [error, setError] = useState('');
  const [typeTab, setTypeTab] = useState('all');
  const [savingIds, setSavingIds] = useState([]);
  const [meetings, setMeetings] = useState(null);
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [joiningIds, setJoiningIds] = useState([]);
  const [detailId, setDetailId] = useState(null);
  const [momMeeting, setMomMeeting] = useState(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.get('/sme/companies'),
      api.get('/sme/sop-assignments', { params: { today: todayStr() } }),
      api.get('/sme/meetings')
    ])
      .then(([c, a, m]) => {
        if (cancelled) return;
        setCompanies(c.data.companies || []);
        setAssigned(a.data.assignments || []);
        setMeetings(m.data.meetings || []);
      })
      .catch((err) => !cancelled && setError(errMsg(err)));
    return () => {
      cancelled = true;
    };
  }, []);

  const slots = Array.from({ length: SLOTS }, (_, i) => companies[i] || null);
  const shownSops = (assigned || []).filter((a) => typeTab === 'all' || a.type === typeTab);

  const toggleTick = async (a) => {
    if (savingIds.includes(a.id)) return;
    const want = !a.done;
    setError('');
    setSavingIds((ids) => [...ids, a.id]);
    setAssigned((list) => list.map((x) => x.id === a.id ? { ...x, done: want } : x));
    try {
      const res = await api.put('/sme/sop-assignments/completions', {
        today: todayStr(),
        changes: [{ id: a.id, done: want }]
      });
      setAssigned(res.data.assignments);
    } catch (err) {
      setAssigned((list) => list.map((x) => x.id === a.id ? { ...x, done: !want } : x));
      setError(errMsg(err));
    } finally {
      setSavingIds((ids) => ids.filter((id) => id !== a.id));
    }
  };

  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentDate(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const hour = currentDate.getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  const formattedDate = currentDate.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

  const formattedTime = currentDate.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });

  const handleAddMeeting = () => setShowMeetingModal(true);
  const activeMeetings = (meetings || []).filter((m) => m.mom?.status !== 'approved');

  const onMeetingSaved = (meeting) => {
    setMeetings((list) => [...(list || []), meeting].sort((x, y) => `${x.date} ${x.time}`.localeCompare(`${y.date} ${y.time}`)));
    setShowMeetingModal(false);
  };

  const onMeetingUpdated = (meeting) => setMeetings((list) => list.map((m) => m.id === meeting.id ? meeting : m));

  const detailMeeting = (meetings || []).find((m) => m.id === detailId) || null;

  const onMomSaved = (meeting) => {
    setMeetings((list) => list.map((m) => m.id === meeting.id ? meeting : m));
    setMomMeeting(null);
  };

  const handleJoin = async (m) => {
    if (!hasStarted(m) || joiningIds.includes(m.id)) return;
    window.open(m.link, '_blank', 'noopener,noreferrer');
    setError('');
    setJoiningIds((ids) => [...ids, m.id]);
    try {
      const p = (x) => String(x).padStart(2, '0');
      const n = new Date();
      const now = `${todayStr()}T${p(n.getHours())}:${p(n.getMinutes())}`;
      const res = await api.put(`/sme/meetings/${m.id}/join`, { now });
      setMeetings((list) => list.map((x) => x.id === m.id ? res.data.meeting : x));
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setJoiningIds((ids) => ids.filter((id) => id !== m.id));
    }
  };

  const hasStarted = (m) => currentDate >= new Date(`${m.date}T${m.time}:00`);

  const fmtTime = (t) => {
    const [h, m] = t.split(':').map(Number);
    return new Date(2000, 0, 1, h, m).toLocaleTimeString('en-IN', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <div className="dashboard-content scrollable">
      <div className="dashboard-topbar">
        <div className="dashboard-greeting">
          <span className="page-label">SME WORKSPACE</span>
          <h1>{greeting}, {user?.name || 'User'}!</h1>
          <p>Welcome back! Here's your workspace overview.</p>
        </div>
        <div className="dashboard-live-clock">
          <div className="live-date">{formattedDate}</div>
          <div className="live-time-row">
            <Clock3 size={17} />
            <span className="live-time">{formattedTime}</span>
            <span className="live-indicator">
              <span className="live-dot"></span>
              LIVE
            </span>
          </div>
        </div>
      </div>

      <div className="company-row" aria-label="Your companies">
        {slots.map((c, i) => c ? (
          <CompanyBadge key={c.id} company={c} size={72} showName />
        ) : (
          <EmptyBadge key={`empty-${i}`} size={72} showName />
        ))}
      </div>

      {error && <p className="error-message" role="alert">{error}</p>}

      <div className="sop-meeting-row">
        <div className="glass-panel sop-panel">
          <h2>My assigned SOPs</h2>
          <div className="sop-tabs">
            {[{ value: 'all', label: 'All' }, ...SOP_TYPES].map((t) => (
              <button key={t.value} type="button" className={typeTab === t.value ? 'active' : ''} onClick={() => setTypeTab(t.value)}>
                {t.label}
              </button>
            ))}
          </div>

          {!assigned ? (
            <p className="muted">Loading…</p>
          ) : shownSops.length === 0 ? (
            <p className="muted">No SOPs assigned{typeTab === 'all' ? '' : ` (${typeLabel(typeTab)})`} yet.</p>
          ) : (
            <div className="sop-list">
              {shownSops.map((a) => (
                <label key={a.id} className={`sme-sop tick ${a.done ? 'done' : ''} ${a.active ? '' : 'upcoming'}`}>
                  <input type="checkbox" checked={a.done} disabled={!a.active || savingIds.includes(a.id)} onChange={() => toggleTick(a)} />
                  <div className="sme-sop-body">
                    <div className="sop-item-top">
                      <span className={`sop-pill ${a.type}`}>{typeLabel(a.type)}</span>
                      <b>{a.company.name}</b>
                      <span className="muted">{a.active ? `Done ${PERIOD_WORD[a.type]}?` : `Starts ${fmtDay(a.date)}`}</span>
                    </div>
                    <p className="sop-item-text">{a.text}</p>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="glass-panel meeting-panel">
          <div className="meeting-header">
            <h2>Meetings</h2>
            <button type="button" className="add-meeting-btn" onClick={handleAddMeeting}>
              <span>Add Meeting</span>
            </button>
          </div>

          {!meetings ? (
            <p className="muted">Loading…</p>
          ) : activeMeetings.length === 0 ? (
            <p className="muted">No meetings scheduled yet.</p>
          ) : (
            <div className="meeting-list">
              {activeMeetings.map((m) => (
                <div className="meeting-item clickable" key={m.id} role="button" tabIndex={0} title="Click to view details or add attendees" onClick={() => setDetailId(m.id)} onKeyDown={(e) => {
                  if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    setDetailId(m.id);
                  }
                }}>
                  <div className="meeting-item-top">
                    <div className="meeting-item-main">
                      <span className="meeting-company">{m.company.name}</span>
                      {m.priority && <span className={`prio-pill ${m.priority}`} title="Scheduled from the previous meeting's MOM"><Flag size={11} /> {m.priority}</span>}
                      <h3 className="meeting-title">{m.subject}</h3>
                    </div>
                    <div className="meeting-item-when">
                      <span>{fmtDay(m.date)}</span>
                      <span>{fmtTime(m.time)}</span>
                    </div>
                  </div>

                  <div className="meeting-item-bottom">
                    <button type="button" className="join-now-btn" disabled={!hasStarted(m) || joiningIds.includes(m.id)} title={hasStarted(m) ? 'Join the meeting' : `Available from ${fmtDay(m.date)}, ${fmtTime(m.time)}`} onClick={(e) => {
                      e.stopPropagation();
                      handleJoin(m);
                    }}>
                      <Video size={15} /> Join Now
                    </button>

                    {m.joined && (
                      <button type="button" className={`send-mom-btn ${m.mom ? m.mom.status : ''}`} onClick={(e) => {
                        e.stopPropagation();
                        setMomMeeting(m);
                      }} title={MOM_BTN[m.mom?.status || 'none'].title}>
                        {MOM_BTN[m.mom?.status || 'none'].icon}
                        {MOM_BTN[m.mom?.status || 'none'].label}
                      </button>
                    )}

                    <div className="avatar-stack" aria-label="Attendees">
                      {m.attendees.slice(0, MAX_AVATARS).map((a, i) => (
                        <span key={`${a.name}-${i}`} className="avatar" style={{ background: avatarColor(a.name) }} title={a.designation ? `${a.name} — ${a.designation}` : a.name}>
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
              ))}
            </div>
          )}
        </div>
      </div>

      {showMeetingModal && <AddMeetingModal companies={companies} onSaved={onMeetingSaved} onClose={() => setShowMeetingModal(false)} />}
      {detailMeeting && <MeetingDetailsModal meeting={detailMeeting} onUpdated={onMeetingUpdated} onClose={() => setDetailId(null)} />}
      {momMeeting && <SendMomModal meeting={momMeeting} onSaved={onMomSaved} onClose={() => setMomMeeting(null)} />}
      <TaskManager />  
    </div>
  );
};

export default SmeDashboard;