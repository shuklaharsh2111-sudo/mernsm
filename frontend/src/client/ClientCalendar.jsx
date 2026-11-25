import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Play, X, ExternalLink, Image as ImageIcon, Check, RotateCcw } from 'lucide-react';
import api from '../api';
import { CompanyBadge } from '../components/CompanyBadge';
import DayCreativesModal from '../components/DayCreativesModal';
import CreativeDetails from '../components/CreativeDetails';
import { PLATFORMS } from '../components/creativePlatforms';
import { LinePlatformIcon } from '../components/SocialIcons';
import PinpointViewer from './PinpointViewer';
import { errMsg, todayStr } from '../sopUtils';
import '../style.css';
import '../styles/smedashboard.css';
import '../styles/calendar.css';
import '../styles/calendar-layout.css';
import '../styles/client.css';

const MAX_CHIPS = 2; // creatives shown inside one day box; the rest collapse into "+N more"
const WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const p2 = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const longDate = (s) => new Date(`${s}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

// 6 rows x 7 cols, weeks start on Monday.
const buildGrid = (year, month) => {
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, i) => new Date(year, month, 1 - offset + i));
};

const Media = ({ file, controls = false }) => (file.isVideo
  ? <video src={controls ? file.url : `${file.url}#t=0.1`} controls={controls} muted={!controls} playsInline preload="metadata" />
  : <img src={file.url} alt={file.name || 'Final creative'} loading="lazy" />);

// Every creative the client sees is a final, approved one.
// While the client has open improvement pins on it, it reads "Redo" instead.
const FinalBadge = ({ compact = false, redo = false }) => (
  <span className={`cstatus ${redo ? 'rejected' : 'approved'} ${compact ? 'compact' : ''}`} title={redo ? 'Revision sent to your team' : 'Final creative'}>
    {redo ? <RotateCcw size={compact ? 10 : 13} aria-hidden="true" /> : <Check size={compact ? 10 : 13} aria-hidden="true" />}
    {redo ? 'Redo' : 'Final'}
  </span>
);

// Same calendar the SMEs, designers and admin use (brand, platform tabs, month board),
// read-only and limited to the final creatives of this client's company.
const ClientCalendar = () => {
  const now = new Date();
  const [company, setCompany] = useState(null);
  const [creatives, setCreatives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [platform, setPlatform] = useState('');
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [dayOpen, setDayOpen] = useState(''); // day box clicked: lists that day's creatives
  const [viewing, setViewing] = useState(null); // { id } creative open in the full preview
  const [view, setView] = useState(() => (new URLSearchParams(window.location.search).get('view') === 'redo' ? 'redo' : 'approved')); // 'approved' = final creatives, 'redo' = revisions sent back to the team
  const [notice, setNotice] = useState('');
  const today = todayStr();

  useEffect(() => {
    let cancelled = false;
    api.get('/client/creatives')
      .then((res) => {
        if (cancelled) return;
        setCompany(res.data.company || null);
        setCreatives((res.data.creatives || []).map((c) => ({
          ...c,
          // the shared day list shows images only; videos fall back to the placeholder icon
          uploads: c.file?.isVideo ? [] : [{ url: c.file?.url, name: c.file?.name || '' }],
          referenceLinks: [],
          contentPillar: { title: c.title, caption: c.caption || '', hashtags: c.hashtags || [], keywords: [], platforms: c.platforms || [] },
        })));
      })
      .catch((e) => !cancelled && setError(errMsg(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, []);

  const inView = (c) => (view === 'redo' ? c.revisionSent : !c.revisionSent);
  const approvedTotal = creatives.filter((c) => !c.revisionSent).length;
  const redoTotal = creatives.length - approvedTotal;
  const countFor = (key) => creatives.filter((c) => inView(c) && c.platforms.includes(key)).length;
  // open on the first platform that has something, otherwise Facebook
  const activePlatform = platform || (PLATFORMS.find((p) => countFor(p.key) > 0) || PLATFORMS[0]).key;
  const meta = PLATFORMS.find((p) => p.key === activePlatform) || PLATFORMS[0];
  const MetaIcon = meta.icon;

  const visible = useMemo(() => creatives.filter((c) => (view === 'redo' ? c.revisionSent : !c.revisionSent) && c.platforms.includes(activePlatform)), [creatives, activePlatform, view]);
  const dayCreatives = (key) => visible.filter((c) => c.date === key);

  const grid = useMemo(() => buildGrid(cursor.y, cursor.m), [cursor]);
  const monthLabel = new Date(cursor.y, cursor.m, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const monthPrefix = `${cursor.y}-${p2(cursor.m + 1)}`;
  const monthCount = visible.filter((c) => c.date.startsWith(monthPrefix)).length;
  const shift = (delta) => {
    const d = new Date(cursor.y, cursor.m + delta, 1);
    setCursor({ y: d.getFullYear(), m: d.getMonth() });
  };

  // full preview with previous / next across the creatives of the opened day
  const dayList = viewing ? visible.filter((c) => c.date === viewing.date) : [];
  const idx = viewing ? Math.max(dayList.findIndex((c) => c.id === viewing.id), 0) : 0;
  const current = viewing ? dayList[idx] : null;
  const step = (n) => dayList.length > 1 && setViewing({ date: viewing.date, id: dayList[(idx + n + dayList.length) % dayList.length].id });

  useEffect(() => {
    if (!viewing) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setViewing(null);
      if (e.key === 'ArrowRight') step(1);
      if (e.key === 'ArrowLeft') step(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="dashboard-content scrollable cx">
      {/* 1 · The company this account belongs to */}
      <header className="cx-toolbar">
        <div className="cx-brands company-row cal-company-row" role="group" aria-label="Brand">
          {company && (
            <div className="cal-brand active">
              <span className="cal-brand-btn">
                <CompanyBadge company={company} size={64} showName />
              </span>
            </div>
          )}
        </div>
      </header>

      {error && <p className="error-message" role="alert">{error}</p>}
      {notice && <p className="muted cc-empty" role="status">{notice}</p>}

      {/* Final creatives, and a Redo section for the revisions this client sent back */}
      {company && (
        <div className="cl-tabs cx-views" role="tablist" aria-label="Creative status">
          <button type="button" role="tab" aria-selected={view === 'approved'} className={view === 'approved' ? 'active' : ''} onClick={() => { setView('approved'); setNotice(''); }}>
            Approved {approvedTotal}
          </button>
          <button type="button" role="tab" aria-selected={view === 'redo'} className={view === 'redo' ? 'active' : ''} onClick={() => { setView('redo'); setNotice(''); }}>
            Redo {redoTotal}
          </button>
        </div>
      )}

      {/* 2 · Platform calendars */}
      {company && (
        <nav className="cx-platforms" role="tablist" aria-label={`${company.name} platform calendars`}>
          {PLATFORMS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              role="tab"
              data-platform={key}
              aria-selected={activePlatform === key}
              className={`cx-plat ${activePlatform === key ? 'active' : ''}`}
              onClick={() => setPlatform(key)}
            >
              <span className="cx-plat-icon"><LinePlatformIcon platform={key} size={18} /></span>
              <span className="cx-plat-name">{label}</span>
              <span className="cx-plat-count">{countFor(key)}</span>
            </button>
          ))}
        </nav>
      )}

      {/* 3 · The calendar itself */}
      <section className="cx-board" data-platform={activePlatform} style={{ '--brand-hue': 225 }}>
        <div className="cx-board-head">
          <div className="cx-board-title">
            <span className="cx-board-icon"><MetaIcon size={16} /></span>
            <div>
              <h2>{meta.label} calendar</h2>
              <p>{company ? company.name : 'Your company'}</p>
            </div>
          </div>

          <div className="cx-stats" aria-label={`${monthLabel} summary`}>
            <span className={`cx-stat ${view === 'redo' ? 'rejected' : 'approved'}`}><b>{monthCount}</b> {view === 'redo' ? 'In redo this month' : 'Final this month'}</span>
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
          ) : (
            <div className="cal-grid" data-platform={activePlatform}>
              {WEEKDAYS.map((d) => <div key={d} className="cal-dow">{d}</div>)}
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
                      <div key={c.id} className="cal-creative approved" title={c.title}>
                        <span className="cal-creative-open">
                          <span className="cal-creative-thumb">
                            {c.file?.url ? <Media file={c.file} /> : <ImageIcon size={14} />}
                            {c.file?.isVideo && <span className="cc-play"><Play size={9} /></span>}
                          </span>
                          <span className="cal-creative-text">
                            <span className="cal-creative-title">{c.title}</span>
                            <span className="cal-creative-meta"><FinalBadge compact redo={c.revisionSent} /></span>
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

      {!loading && !error && creatives.length > 0 && view === 'redo' && redoTotal === 0 && (
        <p className="muted cc-empty">Nothing is in redo. When you send a revision on a creative, it moves here until the new version is approved.</p>
      )}
      {!loading && !error && creatives.length === 0 && (
        <p className="muted cc-empty">No final creatives are ready yet. They will appear here once your team’s designs are approved.</p>
      )}

      {dayOpen && company && (
        <DayCreativesModal
          company={company}
          platformLabel={meta.label}
          date={dayOpen}
          creatives={dayCreatives(dayOpen)}
          platforms={PLATFORMS}
          paused={!!viewing}
          onOpen={(c) => setViewing({ date: c.date, id: c.id })}
          onClose={() => setDayOpen('')}
          renderStatus={(c) => <FinalBadge redo={c.revisionSent} />}
          itemClass={() => 'approved'}
        />
      )}

      {current && createPortal(
        <div className="modal-overlay cv-overlay" onMouseDown={(e) => e.target === e.currentTarget && setViewing(null)}>
          <div className="modal-card cx-modal creative-wide" role="dialog" aria-modal="true" aria-labelledby="client-view-title">
            <div className="modal-head">
              <div>
                <h2 id="client-view-title">{current.title}</h2>
                <p className="creative-sub">
                  {company?.name} · {longDate(current.date)} <FinalBadge redo={current.revisionSent} />
                </p>
              </div>
              <button type="button" className="modal-close" aria-label="Close" onClick={() => setViewing(null)}><X size={16} /></button>
            </div>

            <div className="modal-body">
              {/* key = creative id so every creative starts with its own pins and an empty text box */}
              <PinpointViewer
                key={current.id}
                creative={current}
                onRevisionSent={(cid) => {
                  setCreatives((list) => list.map((x) => (x.id === cid ? { ...x, revisionSent: true } : x)));
                  setViewing(null);
                  setNotice('Revision sent to your team. You can follow it under Redo until the new version is approved.');
                }}
                onOpenCount={(cid, n) => setCreatives((list) => list.map((x) => (x.id === cid && x.openFeedback !== n ? { ...x, openFeedback: n } : x)))}
                arrows={dayList.length > 1 && (
                  <>
                    <button type="button" className="cv-arrow prev" onClick={() => step(-1)} aria-label="Previous creative"><ChevronLeft size={18} /></button>
                    <button type="button" className="cv-arrow next" onClick={() => step(1)} aria-label="Next creative"><ChevronRight size={18} /></button>
                  </>
                )}
                info={(
                  <>
                    {dayList.length > 1 && <span className="cv-pos">{idx + 1} of {dayList.length} on this day</span>}
                    {current.platforms.length > 0 && (
                      <div className="creative-tags">
                        {current.platforms.map((pk) => {
                          const P = PLATFORMS.find((x) => x.key === pk);
                          return <span key={pk} className="tag-chip static">{P ? P.label : pk}</span>;
                        })}
                      </div>
                    )}
                    <CreativeDetails creative={current} />
                  </>
                )}
              />
            </div>

            <div className="modal-foot">
              <a className="btn-ghost" href={current.file.url} target="_blank" rel="noreferrer noopener">
                <ExternalLink size={14} /> Open full size
              </a>
              <button type="button" className="btn-ghost" onClick={() => setViewing(null)}>Close</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default ClientCalendar;
