import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Image as ImageIcon, CalendarDays, LayoutGrid, Smartphone } from 'lucide-react';
import api from '../api';
import { CompanyBadge } from '../components/CompanyBadge';
import ReferenceCreativeModal from '../components/ReferenceCreativeModal';
import CreativeViewModal from '../components/CreativeViewModal';
import DayCreativesModal from '../components/DayCreativesModal';
import CreativeStatusBadge from '../components/CreativeStatusBadge';
import { PLATFORMS } from '../components/creativePlatforms';
import { LinePlatformIcon } from '../components/SocialIcons';
import { InstagramGrid, InstagramStories } from '../components/InstagramViews';
import { errMsg, todayStr } from '../sopUtils';
import '../style.css';
import '../styles/smedashboard.css';
import '../styles/calendar.css';
import '../styles/calendar-layout.css';


const MAX_CHIPS = 2; // creatives shown inside one day box; the rest collapse into "+N more"
const HEALTH_LABELS = { healthy: 'Healthy', risk: 'Risk', critical: 'Critical' };
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
  const [healthById, setHealthById] = useState({}); // company id -> 'healthy' | 'risk' | 'critical'
  const [error, setError] = useState('');
  const [activeId, setActiveId] = useState('');
  // each brand has its own set of platform calendars; remember which one is open per brand
  const [platformByBrand, setPlatformByBrand] = useState({});
  // Instagram has two extra views besides the month calendar: profile grid and stories
  const [igView, setIgView] = useState('calendar'); // 'calendar' | 'grid' | 'story'
  const [creatives, setCreatives] = useState([]);
  const [notice, setNotice] = useState('');
  const [viewing, setViewing] = useState(null); // saved creative open in the preview
  const [modalDate, setModalDate] = useState(''); // day the 'reference creative' modal is open for
  const [editing, setEditing] = useState(null); // creative sent back for a redo, open in the edit form
  const [dayOpen, setDayOpen] = useState(''); // day box clicked: lists that day's creatives
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

  // company health (same numbers as the Company Health page) for the badge + logo border
  useEffect(() => {
    let cancelled = false;
    api.get('/sme/company-health', { params: { today: todayStr() } })
      .then((r) => {
        if (cancelled) return;
        setHealthById(Object.fromEntries((r.data.companies || []).map((c) => [c.id, c.health])));
      })
      .catch(() => {}); // health is decoration here; the calendar still works without it
    return () => {
      cancelled = true;
    };
  }, []);

  // creatives of the selected brand: pending, approved and redo all show on the calendar
  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    api.get('/sme/creatives', { params: { company: activeId } })
      .then((r) => !cancelled && setCreatives(r.data.creatives))
      .catch((err) => !cancelled && setError(errMsg(err)));
    return () => {
      cancelled = true;
    };
  }, [activeId]);

  const removeCreative = async (id) => {
    if (!window.confirm('Delete this creative?')) return;
    try {
      await api.delete(`/sme/creatives/${id}`);
      setCreatives((list) => list.filter((c) => c.id !== id));
    } catch (err) {
      setError(errMsg(err));
    }
  };

  const active = companies.find((c) => c.id === activeId) || null;
  const activePlatform = platformByBrand[activeId] || PLATFORMS[0].key;
  const activePlatformMeta = PLATFORMS.find((p) => p.key === activePlatform) || PLATFORMS[0];
  const brandIndex = Math.max(companies.findIndex((c) => c.id === activeId), 0);

  // open one platform calendar of one brand (also switches to that brand)
  const openCalendar = (brandId, key) => {
    setActiveId(brandId);
    setPlatformByBrand((prev) => ({ ...prev, [brandId]: key }));
  };

  // each calendar only shows the creatives planned for its platform
  const visibleCreatives = creatives.filter((c) => c.contentPillar.platforms.includes(activePlatform));
  const dayCreatives = (key) => visibleCreatives.filter((c) => c.date === key);
  const isInstagram = activePlatform === 'instagram';
  const view = isInstagram ? igView : 'calendar';
  const countFor = (key) => creatives.filter((c) => c.contentPillar.platforms.includes(key)).length;

  const grid = buildGrid(cursor.y, cursor.m);
  const today = todayStr();
  const monthLabel = new Date(cursor.y, cursor.m, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const shift = (delta) => {
    const d = new Date(cursor.y, cursor.m + delta, 1);
    setCursor({ y: d.getFullYear(), m: d.getMonth() });
  };

  const MetaIcon = activePlatformMeta.icon;
  const monthPrefix = `${cursor.y}-${p2(cursor.m + 1)}`;
  const monthCreatives = visibleCreatives.filter((c) => c.date.startsWith(monthPrefix));
  const stat = (status) => monthCreatives.filter((c) => c.status === status).length;

  return (
    <div className="dashboard-content scrollable cx">
      {/* 1 · Brand selector (colored by health) + the selected brand's health, top-right */}
      <header className="cx-toolbar">
        <div className="cx-brands company-row cal-company-row" role="group" aria-label="Brands">
          {companies.map((c) => {
            const isActive = c.id === activeId;
            const health = healthById[c.id];
            return (
              <div key={c.id} className={`cal-brand ${isActive ? 'active' : ''} ${health ? `health-${health}` : ''}`}>
                <button
                  type="button"
                  className="cal-brand-btn"
                  onClick={() => setActiveId(c.id)}
                  aria-pressed={isActive}
                  title={`Show ${c.name}'s calendar`}
                >
                  <CompanyBadge company={c} size={64} showName />
                </button>
              </div>
            );
          })}
        </div>

        {active && healthById[activeId] && (
          <div className="cx-health" role="status" aria-label={`${active.name} health: ${HEALTH_LABELS[healthById[activeId]]}`}>
            <small>Brand health</small>
            <div className="cx-health-opts">
              {['critical', 'risk', 'healthy'].map((h) => (
                <span key={h} className={`cx-health-opt ${h} ${healthById[activeId] === h ? 'on' : ''}`}>
                  {HEALTH_LABELS[h]}
                </span>
              ))}
            </div>
          </div>
        )}
      </header>

      {error && <p className="error-message" role="alert">{error}</p>}
      {notice && <p className="success-message" role="status">{notice}</p>}

      {/* 2 · Platform calendars of the selected brand, one line, fixed order */}
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
              onClick={() => openCalendar(activeId, key)}
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
            {isInstagram && (
              <div className="cal-views" role="tablist" aria-label="Instagram views">
                {[
                  { key: 'calendar', label: 'Calendar', icon: CalendarDays },
                  { key: 'grid', label: 'Grid', icon: LayoutGrid },
                  { key: 'story', label: 'Stories', icon: Smartphone },
                ].map(({ key, label, icon: Icon }) => (
                  <button key={key} type="button" role="tab" aria-selected={igView === key} className={igView === key ? 'active' : ''} onClick={() => setIgView(key)}>
                    <Icon size={15} />{label}
                  </button>
                ))}
              </div>
            )}
            {view === 'calendar' && (
              <div className="cal-nav">
                <button type="button" onClick={() => shift(-1)} aria-label="Previous month"><ChevronLeft size={16} /></button>
                <span className="cal-month">{monthLabel}</span>
                <button type="button" onClick={() => shift(1)} aria-label="Next month"><ChevronRight size={16} /></button>
                <button type="button" className="cx-today" onClick={() => setCursor({ y: now.getFullYear(), m: now.getMonth() })}>Today</button>
              </div>
            )}
          </div>
        </div>

        <div className="cx-board-body">
          {companies.length === 0 && !error ? (
            <p className="muted">No brands are assigned to you yet.</p>
          ) : view === 'grid' ? (
            <InstagramGrid creatives={visibleCreatives} company={active} onOpen={setViewing} />
          ) : view === 'story' ? (
            <InstagramStories creatives={visibleCreatives} company={active} onOpen={setViewing} />
          ) : (
            <div className="cal-grid" data-platform={activePlatform}>
              {WEEKDAYS.map((d) => (
                <div key={d} className="cal-dow">{d}</div>
              ))}
              {grid.map((d) => {
                const key = ymd(d);
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
                      {active && (
                        <button
                          type="button"
                          className="cal-add"
                          title={`Add ${activePlatformMeta.label} creative`}
                          aria-label={`Add reference creative on ${key}`}
                          onClick={(e) => { e.stopPropagation(); setModalDate(key); }}
                        >
                          <Plus size={14} />
                        </button>
                      )}
                    </div>
                    {dayCreatives(key).slice(0, MAX_CHIPS).map((c) => (
                      <div key={c.id} className={`cal-creative ${c.status}`} title={`${c.contentPillar.title} · ${c.status === 'rejected' ? 'Redo' : c.status}`}>
                        <span className="cal-creative-open">
                          <span className="cal-creative-thumb">
                            {c.uploads[0] ? <img src={c.uploads[0].url} alt="" /> : <ImageIcon size={14} />}
                          </span>
                          <span className="cal-creative-text">
                            <span className="cal-creative-title">{c.contentPillar.title}</span>
                            <span className="cal-creative-meta">
                              <CreativeStatusBadge status={c.status} compact />
                            </span>
                          </span>
                        </span>
                      </div>
                    ))}
                    {dayCreatives(key).length > MAX_CHIPS && (
                      <span className="cal-more">+{dayCreatives(key).length - MAX_CHIPS} more</span>
                    )}
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
          onEdit={(c) => { setDayOpen(''); setEditing(c); }}
          onAdd={() => { setModalDate(dayOpen); setDayOpen(''); }}
          onDelete={removeCreative}
          onClose={() => setDayOpen('')}
        />
      )}

      {viewing && (
        <CreativeViewModal
          creative={viewing}
          company={active}
          platforms={PLATFORMS}
          onEdit={(c) => { setViewing(null); setDayOpen(''); setEditing(c); }}
          onClose={() => setViewing(null)}
        />
      )}

      {editing && active && (
        <ReferenceCreativeModal
          company={active}
          date={editing.date}
          platforms={PLATFORMS}
          editing={editing}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            // same creative, updated: it goes back to Pending for the admin
            setCreatives((list) => list.map((c) => (c.id === saved.id ? saved : c)));
            setNotice('Creative updated and sent back to the admin. It shows as Pending again.');
            setEditing(null);
          }}
        />
      )}

      {modalDate && active && (
        <ReferenceCreativeModal
          company={active}
          date={modalDate}
          platforms={PLATFORMS}
          defaultPlatform={activePlatform}
          onClose={() => setModalDate('')}
          onSaved={(saved) => {
            // it shows on the calendar straight away, marked Pending until the admin reviews it
            if (saved && saved.companyId === activeId) setCreatives((list) => [...list, saved]);
            setNotice('Creative sent to the admin for approval. It shows on the calendar as Pending until the admin approves it or asks for a redo.');
            setModalDate('');
          }}
        />
      )}
    </div>
  );
};

export default SmeCalendar;