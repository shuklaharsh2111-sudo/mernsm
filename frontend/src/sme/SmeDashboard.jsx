
import { useAuth } from '../AuthContext';
import { useEffect, useState } from 'react';
import api from '../api';
import { CompanyBadge, EmptyBadge } from '../components/CompanyBadge';
import { PERIOD_WORD, SOP_TYPES, errMsg, fmtDay, todayStr, typeLabel } from '../sopUtils';
import "../style.css";
import {
  LayoutDashboard,
  Briefcase,
  Activity,
  Clock3
} from 'lucide-react';

const SLOTS = 5; // a user can have at most 5 companies

const SmeDashboard = () => {
  const { user } = useAuth();

  const [companies, setCompanies] = useState([]);
  const [assigned, setAssigned] = useState(null); // SOPs the admin assigned to me
  const [error, setError] = useState('');
  const [typeTab, setTypeTab] = useState('all');
  const [savingIds, setSavingIds] = useState([]); // ticks being written right now

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.get('/sme/companies'), api.get('/sme/sop-assignments', { params: { today: todayStr() } })])
      .then(([c, a]) => {
        if (cancelled) return;
        setCompanies(c.data.companies);
        setAssigned(a.data.assignments);
      })
      .catch((err) => !cancelled && setError(errMsg(err)));
    return () => {
      cancelled = true;
    };
  }, []);

  const slots = Array.from({ length: SLOTS }, (_, i) => companies[i] || null);
  const shownSops = (assigned || []).filter((a) => typeTab === 'all' || a.type === typeTab);

  // Ticking saves straight away (shown instantly, rolled back if the save fails).
  const toggleTick = async (a) => {
    if (savingIds.includes(a.id)) return;
    const want = !a.done;
    setError('');
    setSavingIds((ids) => [...ids, a.id]);
    setAssigned((list) => list.map((x) => (x.id === a.id ? { ...x, done: want } : x)));
    try {
      const res = await api.put('/sme/sop-assignments/completions', {
        today: todayStr(),
        changes: [{ id: a.id, done: want }],
      });
      setAssigned(res.data.assignments);
    } catch (err) {
      setAssigned((list) => list.map((x) => (x.id === a.id ? { ...x, done: !want } : x)));
      setError(errMsg(err));
    } finally {
      setSavingIds((ids) => ids.filter((id) => id !== a.id));
    }
  };

  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDate(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const hour = currentDate.getHours();

  const greeting =
    hour < 12
      ? 'Good Morning'
      : hour < 17
      ? 'Good Afternoon'
      : 'Good Evening';

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

  return (
    <div className="dashboard-content scrollable">

      {/* Dashboard Top Header */}
      <div className="dashboard-topbar">

        <div className="dashboard-greeting">
          <span className="page-label">SME WORKSPACE</span>

          <h1>
            {greeting}, {user?.name || 'User'}!
          </h1>

          <p>Welcome back! Here's your workspace overview.</p>
        </div>

        <div className="dashboard-live-clock">

          <div className="live-date">
            {formattedDate}
          </div>

          <div className="live-time-row">
            <Clock3 size={17} />

            <span className="live-time">
              {formattedTime}
            </span>

            <span className="live-indicator">
              <span className="live-dot"></span>
              LIVE
            </span>
          </div>

        </div>

      </div>

      {/* My companies: only the ones the admin assigned (max 5) */}
      <div className="company-row" aria-label="Your companies">
        {slots.map((c, i) =>
          c ? <CompanyBadge key={c.id} company={c} size={72} showName /> : <EmptyBadge key={`empty-${i}`} size={72} showName />
        )}
      </div>

      {error && <p className="error-message" role="alert">{error}</p>}

      {/* Statistics */}
      <div className="stats-grid">

        <div className="stat-card">
          <div className="stat-icon purple">
            <LayoutDashboard />
          </div>

          <span>Dashboard</span>
          <h2>SME</h2>
        </div>

        <div className="stat-card">
          <div className="stat-icon blue">
            <Briefcase />
          </div>

          <span>Workspace</span>
          <h2>Active</h2>
        </div>

        <div className="stat-card">
          <div className="stat-icon green">
            <Activity />
          </div>

          <span>Account Status</span>
          <h2>Active</h2>
        </div>

      </div>

      {/* SOPs assigned by the admin: tick to save */}
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
                <input
                  type="checkbox"
                  checked={a.done}
                  disabled={!a.active || savingIds.includes(a.id)}
                  onChange={() => toggleTick(a)}
                />
                <div className="sme-sop-body">
                  <div className="sop-item-top">
                    <span className={`sop-pill ${a.type}`}>{typeLabel(a.type)}</span>
                    <b>{a.company.name}</b>
                    <span className="muted">
                      {a.active ? `Done ${PERIOD_WORD[a.type]}?` : `Starts ${fmtDay(a.date)}`}
                    </span>
                  </div>
                  <p className="sop-item-text">{a.text}</p>
                </div>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Welcome Card */}
      <div className="welcome-card">
        <h2>SME Dashboard</h2>

        <p>
          Your SME workspace is ready.
          Your future modules will be added here.
        </p>
      </div>

    </div>
  );
};

export default SmeDashboard;
