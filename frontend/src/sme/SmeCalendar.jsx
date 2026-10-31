import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../api';
import { CompanyBadge } from '../components/CompanyBadge';
import { InstagramIcon, FacebookIcon, LinkedinIcon, XIcon, YoutubeIcon } from '../components/SocialIcons';
import { errMsg, todayStr } from '../sopUtils';
import '../style.css';
import '../styles/smedashboard.css';
import '../styles/calendar.css';

const PLATFORMS = [
  { key: 'instagram', label: 'Instagram', icon: InstagramIcon },
  { key: 'facebook', label: 'Facebook', icon: FacebookIcon },
  { key: 'linkedin', label: 'LinkedIn', icon: LinkedinIcon },
  { key: 'x', label: 'X', icon: XIcon },
  { key: 'youtube', label: 'YouTube', icon: YoutubeIcon },
];

const WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const p2 = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;

// 6 rows x 7 cols, weeks start on Monday.
const buildGrid = (year, month) => {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, i) => new Date(year, month, 1 - offset + i));
};

const SmeCalendar = () => {
  const [companies, setCompanies] = useState([]);
  const [error, setError] = useState('');
  const [activeId, setActiveId] = useState('');
  // platforms switched on, kept separately for each brand
  const [platformsByBrand, setPlatformsByBrand] = useState({});
  const now = new Date();
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() });

  useEffect(() => {
    let cancelled = false;
    api.get('/sme/companies')
      .then((c) => {
        if (cancelled) return;
        setCompanies(c.data.companies);
        setActiveId((id) => id || c.data.companies[0]?.id || '');
      })
      .catch((err) => !cancelled && setError(errMsg(err)));
    return () => {
      cancelled = true;
    };
  }, []);

  const active = companies.find((c) => c.id === activeId) || null;
  const activePlatforms = platformsByBrand[activeId] || PLATFORMS.map((p) => p.key);

  const togglePlatform = (key) =>
    setPlatformsByBrand((prev) => {
      const cur = prev[activeId] || PLATFORMS.map((p) => p.key);
      const next = cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key];
      return { ...prev, [activeId]: next };
    });

  const grid = buildGrid(cursor.y, cursor.m);
  const today = todayStr();
  const monthLabel = new Date(cursor.y, cursor.m, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const shift = (delta) => {
    const d = new Date(cursor.y, cursor.m + delta, 1);
    setCursor({ y: d.getFullYear(), m: d.getMonth() });
  };

  return (
    <div className="dashboard-content scrollable">
      {/* Brand selector (same circles as the dashboard) + brand toggle in the top-right corner */}
      <div className="cal-brand-bar">
        <div className="company-row cal-company-row" aria-label="Brands">
          {companies.map((c) => {
            const isActive = c.id === activeId;
            return (
              <div key={c.id} className={`cal-brand ${isActive ? 'active' : ''}`}>
                <button
                  type="button"
                  className="cal-brand-btn"
                  onClick={() => setActiveId(c.id)}
                  aria-pressed={isActive}
                  title={`Show ${c.name}'s calendar`}
                >
                  <CompanyBadge company={c} size={72} showName />
                </button>
                {/* social platforms under the logo */}
                <div className="cal-platforms" aria-label={`${c.name} platforms`}>
                  {PLATFORMS.map(({ key, label, icon: Icon }) => {
                    const on = isActive && activePlatforms.includes(key);
                    return (
                      <button
                        key={key}
                        type="button"
                        className={`cal-platform ${on ? 'on' : ''}`}
                        title={label}
                        aria-label={label}
                        aria-pressed={on}
                        disabled={!isActive}
                        onClick={() => togglePlatform(key)}
                      >
                        <Icon size={20} />
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {companies.length > 0 && (
          <div className="cal-toggle" role="tablist" aria-label="Switch calendar between brands">
            {companies.map((c) => (
              <button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={c.id === activeId}
                className={c.id === activeId ? 'active' : ''}
                onClick={() => setActiveId(c.id)}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && <p className="error-message" role="alert">{error}</p>}

      <div className="cal-header">
        <h2>Calendar{active ? ` · ${active.name}` : ''}</h2>
        <div className="cal-nav">
          <button type="button" onClick={() => shift(-1)} aria-label="Previous month"><ChevronLeft size={16} /></button>
          <span className="cal-month">{monthLabel}</span>
          <button type="button" onClick={() => shift(1)} aria-label="Next month"><ChevronRight size={16} /></button>
          <button type="button" onClick={() => setCursor({ y: now.getFullYear(), m: now.getMonth() })}>Today</button>
        </div>
      </div>

      {companies.length === 0 && !error ? (
        <p className="muted">No brands are assigned to you yet.</p>
      ) : (
        <div className="cal-grid">
          {WEEKDAYS.map((d) => (
            <div key={d} className="cal-dow">{d}</div>
          ))}
          {grid.map((d) => {
            const key = ymd(d);
            return (
              <div
                key={key}
                className={`cal-cell ${d.getMonth() !== cursor.m ? 'other' : ''} ${key === today ? 'today' : ''}`}
              >
                <span className="cal-day">{d.getDate()}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SmeCalendar;
