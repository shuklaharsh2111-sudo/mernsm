import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Play, X, ExternalLink } from 'lucide-react';
import api from '../api';
import { errMsg, todayStr } from '../sopUtils';
import '../styles/client.css';

const WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const MAX_THUMBS = 2;
const p2 = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const monthName = (y, m) => new Date(y, m, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
const longDate = (s) => new Date(`${s}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

// 6 rows x 7 columns, weeks start on Monday.
const buildGrid = (year, month) => {
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, i) => new Date(year, month, 1 - offset + i));
};

const Media = ({ file, controls = false }) => (file.isVideo
  ? <video src={controls ? file.url : `${file.url}#t=0.1`} controls={controls} muted={!controls} playsInline preload="metadata" />
  : <img src={file.url} alt={file.name || 'Final creative'} loading="lazy" />);

const ClientCalendar = () => {
  const now = new Date();
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [creatives, setCreatives] = useState(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(null); // { date, index }
  const today = todayStr();

  useEffect(() => {
    let cancelled = false;
    api.get('/client/creatives')
      .then((res) => !cancelled && setCreatives(res.data.creatives))
      .catch((e) => !cancelled && setError(errMsg(e)));
    return () => { cancelled = true; };
  }, []);

  const byDate = useMemo(() => {
    const map = new Map();
    (creatives || []).forEach((c) => {
      if (!map.has(c.date)) map.set(c.date, []);
      map.get(c.date).push(c);
    });
    return map;
  }, [creatives]);

  const grid = useMemo(() => buildGrid(cursor.y, cursor.m), [cursor]);
  const monthKey = `${cursor.y}-${p2(cursor.m + 1)}`;
  const monthCount = (creatives || []).filter((c) => c.date.startsWith(monthKey)).length;

  const shift = (n) => setCursor(({ y, m }) => {
    const d = new Date(y, m + n, 1);
    return { y: d.getFullYear(), m: d.getMonth() };
  });

  const dayList = open ? byDate.get(open.date) || [] : [];
  const current = open ? dayList[open.index] : null;
  const step = (n) => setOpen((o) => ({ ...o, index: (o.index + n + dayList.length) % dayList.length }));

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(null);
      if (e.key === 'ArrowRight' && dayList.length > 1) step(1);
      if (e.key === 'ArrowLeft' && dayList.length > 1) step(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <div className="dashboard-content scrollable"><p className="error-message" role="alert">{error}</p></div>;

  return (
    <div className="dashboard-content scrollable cl-page">
      <div className="page-header">
        <div>
          <span className="page-label">CLIENT DASHBOARD</span>
          <h1>Content calendar</h1>
          <p>The final, approved creatives for your brand, on the day each one is planned to go out.</p>
        </div>
      </div>

      <div className="cc-bar">
        <div className="cc-nav">
          <button type="button" onClick={() => shift(-1)} aria-label="Previous month"><ChevronLeft size={18} /></button>
          <h2>{monthName(cursor.y, cursor.m)}</h2>
          <button type="button" onClick={() => shift(1)} aria-label="Next month"><ChevronRight size={18} /></button>
          <button type="button" className="btn-ghost" style={{ width: 'auto', padding: '0 12px' }} onClick={() => setCursor({ y: now.getFullYear(), m: now.getMonth() })}>Today</button>
        </div>
        <span className="cc-count">{creatives === null ? 'Loading…' : `${monthCount} final creative${monthCount === 1 ? '' : 's'} this month`}</span>
      </div>

      <div className="cc-grid" role="grid" aria-label={monthName(cursor.y, cursor.m)}>
        {WEEKDAYS.map((w) => <div key={w} className="cc-wd">{w}</div>)}
        {grid.map((d) => {
          const key = ymd(d);
          const items = byDate.get(key) || [];
          const other = d.getMonth() !== cursor.m;
          return (
            <div
              key={key}
              className={`cc-day ${other ? 'other' : ''} ${key === today ? 'today' : ''} ${items.length ? 'has' : ''}`}
              onClick={() => items.length && setOpen({ date: key, index: 0 })}
            >
              <span className="cc-num">{d.getDate()}</span>
              {items.length > 0 && (
                <div className="cc-thumbs">
                  {items.slice(0, MAX_THUMBS).map((c, i) => (
                    <button key={c.id} type="button" className="cc-thumb" title={c.title} onClick={(e) => { e.stopPropagation(); setOpen({ date: key, index: i }); }}>
                      <Media file={c.file} />
                      {c.file.isVideo && <span className="cc-play"><Play size={11} /></span>}
                    </button>
                  ))}
                  {items.length > MAX_THUMBS && <span className="cc-more">+{items.length - MAX_THUMBS} more</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {creatives && creatives.length === 0 && <p className="muted cc-empty">No final creatives are ready yet. They will appear here once your team’s designs are approved.</p>}

      {current && (
        <div className="cc-modal-back" onClick={() => setOpen(null)}>
          <div className="cc-modal" role="dialog" aria-modal="true" aria-label={current.title} onClick={(e) => e.stopPropagation()}>
            <div className="cc-media">
              <Media key={current.id} file={current.file} controls />
              {dayList.length > 1 && (
                <>
                  <button type="button" className="cc-arrow prev" onClick={() => step(-1)} aria-label="Previous creative"><ChevronLeft size={18} /></button>
                  <button type="button" className="cc-arrow next" onClick={() => step(1)} aria-label="Next creative"><ChevronRight size={18} /></button>
                </>
              )}
            </div>
            <div className="cc-info">
              <div className="cc-info-top">
                <div>
                  <h3>{current.title}</h3>
                  <span className="cc-date">{longDate(current.date)}</span>
                </div>
                <button type="button" className="cc-close" onClick={() => setOpen(null)} aria-label="Close"><X size={16} /></button>
              </div>
              {dayList.length > 1 && <span className="cc-pos">{open.index + 1} of {dayList.length} on this day</span>}
              {current.platforms.length > 0 && <div className="cc-chips">{current.platforms.map((p) => <span key={p}>{p}</span>)}</div>}
              {current.caption && <p className="cc-caption">{current.caption}</p>}
              {current.hashtags.length > 0 && <div className="cc-chips tags">{current.hashtags.map((h) => <span key={h}>{h.startsWith('#') ? h : `#${h}`}</span>)}</div>}
              <a className="btn-ghost" href={current.file.url} target="_blank" rel="noreferrer" style={{ alignSelf: 'flex-start', display: 'inline-flex', gap: 6, alignItems: 'center', textDecoration: 'none' }}>
                <ExternalLink size={14} /> Open full size
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientCalendar;
