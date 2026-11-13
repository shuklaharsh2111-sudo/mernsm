import { useEffect, useMemo, useState } from 'react';
import { Search, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import api from '../api';
import { errMsg } from '../sopUtils';
import { roleName } from '../roleNames';
import { initialsOf, fmtTime } from './hrUtils';
import '../style.css';
import '../styles/dashboard-glass.css';
import '../styles/hr.css';

const REFRESH_MS = 30000;

const Avatar = ({ name, src }) => (
  <div className="hr-avatar">{src ? <img src={src} alt={name} /> : initialsOf(name)}</div>
);

const HrOnline = () => {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  // load now, on Refresh, and every 30 seconds while the page is open
  useEffect(() => {
    let cancelled = false;
    const load = () =>
      api.get('/hr/presence')
        .then((res) => { if (!cancelled) { setData(res.data); setError(''); } })
        .catch((err) => { if (!cancelled) setError(errMsg(err)); })
        .finally(() => { if (!cancelled) setLoading(false); });
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => { cancelled = true; clearInterval(timer); };
  }, [reloadKey]);

  const { online, offline } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const people = (data?.people || []).filter((p) => !q || p.name.toLowerCase().includes(q));
    return { online: people.filter((p) => p.online), offline: people.filter((p) => !p.online) };
  }, [data, query]);

  const s = data?.summary;

  return (
    <div className="dashboard-content scrollable dash-glass hr-page">
      <div className="page-header">
        <div>
          <span className="page-label">HUMAN RESOURCES</span>
          <h1>Online / Offline</h1>
          <p>Who is signed in right now. Updates every 30 seconds.</p>
        </div>
        <button type="button" className="dash-btn" onClick={() => { setLoading(true); setReloadKey((k) => k + 1); }} disabled={loading}>
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      {error && <p className="error-message" role="alert">{error}</p>}

      <div className="kpi-grid">
        <div className="kpi-card green">
          <div className="kpi-top"><span className="kpi-label">Online</span><span className="kpi-icon"><Wifi size={17} /></span></div>
          <div className="kpi-value">{s ? s.online : '–'}</div>
          <div className="kpi-sub">Signed in right now</div>
        </div>
        <div className="kpi-card red">
          <div className="kpi-top"><span className="kpi-label">Offline</span><span className="kpi-icon"><WifiOff size={17} /></span></div>
          <div className="kpi-value">{s ? s.offline : '–'}</div>
          <div className="kpi-sub">Signed out or not in yet today</div>
        </div>
      </div>

      <div className="hr-toolbar">
        <div className="hr-search">
          <Search size={15} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name" />
        </div>
      </div>

      <div className="hr-grid even">
        <section className="hr-card">
          <div className="hr-card-head"><h3>Online</h3><small>{online.length} people</small></div>
          <div className="hr-list">
            {data && online.length === 0 && <p className="hr-empty">Nobody is online.</p>}
            {online.map((p) => (
              <div className="hr-person" key={p.id}>
                <Avatar name={p.name} src={p.profileImage} />
                <div className="hr-person-main"><strong>{p.name}</strong><span>{roleName(p.role)}</span></div>
                <span className="hr-pill online">Online</span>
                <span className="hr-person-time">since {fmtTime(p.firstLogin)}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="hr-card">
          <div className="hr-card-head"><h3>Offline</h3><small>{offline.length} people</small></div>
          <div className="hr-list">
            {data && offline.length === 0 && <p className="hr-empty">Everyone is online.</p>}
            {offline.map((p) => (
              <div className="hr-person" key={p.id}>
                <Avatar name={p.name} src={p.profileImage} />
                <div className="hr-person-main"><strong>{p.name}</strong><span>{roleName(p.role)}</span></div>
                <span className={`hr-pill ${p.lastLogout ? 'left' : 'absent'}`}>{p.lastLogout ? 'Left' : 'Not in yet'}</span>
                {p.lastLogout && <span className="hr-person-time">{fmtTime(p.lastLogout)}</span>}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default HrOnline;
