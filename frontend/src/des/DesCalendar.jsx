import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Image as ImageIcon, Clock, Check, RotateCcw } from 'lucide-react';
import api from '../api';
import { CompanyBadge } from '../components/CompanyBadge';
import CreativeViewModal from '../components/CreativeViewModal';
import DayCreativesModal from '../components/DayCreativesModal';
import { PLATFORMS } from '../components/creativePlatforms';
import { LinePlatformIcon } from '../components/SocialIcons';
import { errMsg, todayStr } from '../sopUtils';
import { workflowOf } from './desWorkflow';
import '../style.css';
import '../styles/smedashboard.css';
import '../styles/calendar.css';
import '../styles/calendar-layout.css';

const MAX_CHIPS = 2; // creatives shown inside one day box; the rest collapse into "+N more"
const WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const p2 = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;

// 6 rows x 7 cols, weeks start on Monday.
const buildGrid = (year, month) => {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, i) => new Date(year, month, 1 - offset + i));
};

// The designer's own status of a creative, drawn with the same pill + chip colours as the other calendars.
// To do / In review share the amber "pending" look, Approved is green, Redo is red.
const FLOW_VIEW = {
  todo: { cls: 'pending', label: 'To do', icon: Clock },
  review: { cls: 'pending', label: 'In review', icon: Clock },
  approved: { cls: 'approved', label: 'Approved', icon: Check },
  redo: { cls: 'rejected', label: 'Redo', icon: RotateCcw },
};
const flowOf = (c) => FLOW_VIEW[workflowOf(c).key];

function FlowBadge({ creative, compact = false }) {
  const f = flowOf(creative);
  const Icon = f.icon;
  return (
    <span className={`cstatus ${f.cls} ${compact ? 'compact' : ''}`} title={`Design status: ${f.label}`}>
      <Icon size={compact ? 10 : 13} aria-hidden="true" />
      {f.label}
    </span>
  );
}

// The API sends raw records; the shared calendar pieces expect the SME/admin shape.
const toView = (c) => ({
  ...c,
  id: String(c._id),
  date: String(c.date || '').slice(0, 10),
  uploads: (c.uploads || []).map((u) => ({ url: u.url, name: u.originalName || u.name || '' })),
  referenceLinks: c.referenceLinks || [],
  contentPillar: {
    title: c.contentPillar?.title || 'Untitled creative',
    caption: c.contentPillar?.caption || '',
    hashtags: c.contentPillar?.hashtags || [],
    keywords: c.contentPillar?.keywords || [],
    platforms: c.contentPillar?.platforms || [],
  },
});

// Designer view of the same calendar the SMEs and the admin use: pick a brand you are assigned to,
// pick a platform, see every creative scheduled on each day with where your design stands.
const DesCalendar = () => {
  const [companies, setCompanies] = useState([]);
  const [creatives, setCreatives] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState('');
  const [platformByBrand, setPlatformByBrand] = useState({}); // remember the open platform per brand
  const [viewing, setViewing] = useState(null); // creative open in the preview
  const [dayOpen, setDayOpen] = useState(''); // day box clicked: lists that day's creatives
  const now = new Date();
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() });

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.get('/des/companies'), api.get('/des/creatives')])
      .then(([c, cr]) => {
        if (cancelled) return;
        const list = (Array.isArray(c.data) ? c.data : c.data?.companies || []).map((co) => ({
          ...co,
          id: String(co.id || co._id),
        }));
        setCompanies(list);
        setCreatives((cr.data?.creatives || []).map(toView));
        setActiveId((id) => id || list[0]?.id || '');
      })
      .catch((err) => !cancelled && setError(errMsg(err)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const active = companies.find((c) => c.id === activeId) || null;
  const activePlatform = platformByBrand[activeId] || PLATFORMS[0].key;
  const activePlatformMeta = PLATFORMS.find((p) => p.key === activePlatform) || PLATFORMS[0];
  const brandIndex = Math.max(companies.findIndex((c) => c.id === activeId), 0);
  const MetaIcon = activePlatformMeta.icon;

  // creatives of the selected brand; each platform calendar only shows its own
  const brandCreatives = creatives.filter((c) => String(c.company?._id || c.company?.id || c.company) === activeId);
  const visibleCreatives = brandCreatives.filter((c) => c.contentPillar.platforms.includes(activePlatform));
  const dayCreatives = (key) => visibleCreatives.filter((c) => c.date === key);
  const countFor = (key) => brandCreatives.filter((c) => c.contentPillar.platforms.includes(key)).length;

  const grid = buildGrid(cursor.y, cursor.m);
  const today = todayStr();
  const monthLabel = new Date(cursor.y, cursor.m, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const monthPrefix = `${cursor.y}-${p2(cursor.m + 1)}`;
  const monthCreatives = visibleCreatives.filter((c) => c.date.startsWith(monthPrefix));
  const stat = (cls) => monthCreatives.filter((c) => flowOf(c).cls === cls).length;
  const shift = (delta) => {
    const d = new Date(cursor.y, cursor.m + delta, 1);
    setCursor({ y: d.getFullYear(), m: d.getMonth() });
  };

  return (
    <div className="dashboard-content scrollable cx">
      {/* 1 · Brand selector (the companies assigned to this designer) */}
      <header className="cx-toolbar">
        <div className="cx-brands company-row cal-company-row" role="group" aria-label="Brands">
          {companies.map((c) => {
            const isActive = c.id === activeId;
            return (
              <div key={c.id} className={`cal-brand ${isActive ? 'active' : ''}`}>
                <button type="button" className="cal-brand-btn" onClick={() => setActiveId(c.id)} aria-pressed={isActive} title={`Show ${c.name}'s calendar`}>
                  <CompanyBadge company={c} size={64} showName />
                </button>
              </div>
            );
          })}
        </div>
      </header>

      {error && <p className="error-message" role="alert">{error}</p>}

      {/* 2 · Platform calendars of the selected brand */}
      {active && (
        <nav className="cx-platforms" role="tablist" aria-label={`${active.name} platform calendars`}>
          {PLATFORMS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              role="tab"
              data-platform={key}
              aria-selected={activePlatform === key}
              className={`cx-plat ${activePlatform === key ? 'active' : ''}`}
              onClick={() => setPlatformByBrand((prev) => ({ ...prev, [activeId]: key }))}
            >
              <span className="cx-plat-icon"><LinePlatformIcon platform={key} size={18} /></span>
              <span className="cx-plat-name">{label}</span>
              <span className="cx-plat-count">{countFor(key)}</span>
            </button>
          ))}
        </nav>
      )}

      {/* 3 · The calendar itself */}
      <section className="cx-board" data-platform={activePlatform} style={{ '--brand-hue': (brandIndex * 57 + 225) % 360 }}>
        <div className="cx-board-head">
          <div className="cx-board-title">
            <span className="cx-board-icon"><MetaIcon size={16} /></span>
            <div>
              <h2>{activePlatformMeta.label} calendar</h2>
              <p>{active ? active.name : 'No brand selected'}</p>
            </div>
          </div>

          <div className="cx-stats" aria-label={`${monthLabel} summary`}>
            <span className="cx-stat pending"><b>{stat('pending')}</b> Pending</span>
            <span className="cx-stat approved"><b>{stat('approved')}</b> Approved</span>
            <span className="cx-stat rejected"><b>{stat('rejected')}</b> Redo</span>
          </div>

          <div className="cx-controls">
            <div className="cal-nav">
              <button type="button" onClick={() => shift(-1)} aria-label="Previous month"><ChevronLeft size={16} /></button>
              <span className="cal-month">{monthLabel}</span>
              <button type="button" onClick={() => shift(1)} aria-label="Next month"><ChevronRight size={16} /></button>
              <button type="button" className="cx-today" onClick={() => setCursor({ y: now.getFullYear(), m: now.getMonth() })}>Today</button>
            </div>
          </div>
        </div>

        <div className="cx-board-body">
          {loading ? (
            <p className="muted">Loading…</p>
          ) : companies.length === 0 && !error ? (
            <p className="muted">No companies are assigned to you yet.</p>
          ) : (
            <div className="cal-grid" data-platform={activePlatform}>
              {WEEKDAYS.map((d) => (
                <div key={d} className="cal-dow">{d}</div>
              ))}
              {grid.map((d) => {
                const key = ymd(d);
                const list = dayCreatives(key);
                return (
                  <div
                    key={key}
                    className={`cal-cell clickable ${d.getMonth() !== cursor.m ? 'other' : ''} ${key === today ? 'today' : ''}`}
                    role="button"
                    tabIndex={0}
                    aria-label={`Open ${key}`}
                    onClick={() => setDayOpen(key)}
                    onKeyDown={(e) => e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setDayOpen(key))}
                  >
                    <div className="cal-cell-top">
                      <span className="cal-day">{d.getDate()}</span>
                    </div>
                    {list.slice(0, MAX_CHIPS).map((c) => (
                      <div key={c.id} className={`cal-creative ${flowOf(c).cls}`} title={`${c.contentPillar.title} · ${flowOf(c).label}`}>
                        <span className="cal-creative-open">
                          <span className="cal-creative-thumb">
                            {c.uploads[0] ? <img src={c.uploads[0].url} alt="" /> : <ImageIcon size={14} />}
                          </span>
                          <span className="cal-creative-text">
                            <span className="cal-creative-title">{c.contentPillar.title}</span>
                            <span className="cal-creative-meta">
                              <FlowBadge creative={c} compact />
                            </span>
                          </span>
                        </span>
                      </div>
                    ))}
                    {list.length > MAX_CHIPS && <span className="cal-more">+{list.length - MAX_CHIPS} more</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {dayOpen && active && (
        <DayCreativesModal
          company={active}
          platformLabel={activePlatformMeta.label}
          date={dayOpen}
          creatives={dayCreatives(dayOpen)}
          platforms={PLATFORMS}
          paused={!!viewing}
          onOpen={setViewing}
          onClose={() => setDayOpen('')}
          renderStatus={(c) => <FlowBadge creative={c} />}
          itemClass={(c) => flowOf(c).cls}
        />
      )}

      {viewing && (
        <CreativeViewModal creative={viewing} company={active} platforms={PLATFORMS} onClose={() => setViewing(null)} />
      )}
    </div>
  );
};

export default DesCalendar;
