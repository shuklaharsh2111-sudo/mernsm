import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Image as ImageIcon, Layers } from 'lucide-react';
import CreativeStatusBadge from './CreativeStatusBadge';
import { fmtDay } from '../sopUtils';

const initials = (name = '') =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

// ---------- Instagram profile grid: 3 square tiles per row, newest first ----------
export function InstagramGrid({ creatives, company, onOpen }) {
  const posts = [...creatives].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <div className="ig-phone-wrap">
      <div className="ig-profile">
        <div className="ig-avatar">{initials(company?.name)}</div>
        <div className="ig-profile-text">
          <b>{company?.name}</b>
          <span>{posts.length} {posts.length === 1 ? 'post' : 'posts'}</span>
        </div>
      </div>
      {posts.length === 0 ? (
        <p className="muted ig-empty">No approved Instagram creatives yet.</p>
      ) : (
        <div className="ig-grid" role="list" aria-label="Instagram grid">
          {posts.map((c) => (
            <button key={c.id} type="button" role="listitem" className="ig-tile" onClick={() => onOpen(c)} title={c.contentPillar.title}>
              {c.uploads[0] ? <img src={c.uploads[0].url} alt="" /> : (
                <span className="ig-tile-empty"><ImageIcon size={20} /><small>{c.contentPillar.title}</small></span>
              )}
              <span className="ig-tile-status"><CreativeStatusBadge status={c.status} compact /></span>
              {c.uploads.length > 1 && <Layers size={15} className="ig-tile-multi" aria-label="Multiple images" />}
              <span className="ig-tile-over"><b>{c.contentPillar.title}</b><small>{fmtDay(c.date)}</small></span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- Instagram stories: 9:16 frame, progress bars, tap left/right ----------
export function InstagramStories({ creatives, company, onOpen }) {
  const stories = [...creatives].sort((a, b) => a.date.localeCompare(b.date));
  const [index, setIndex] = useState(0);
  const i = Math.min(index, Math.max(stories.length - 1, 0));
  const cur = stories[i];

  const go = (d) => setIndex(Math.min(Math.max(i + d, 0), stories.length - 1));

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea')) return;
      if (e.key === 'ArrowRight') setIndex((n) => Math.min(n + 1, stories.length - 1));
      if (e.key === 'ArrowLeft') setIndex((n) => Math.max(n - 1, 0));
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [stories.length]);

  if (!cur) return <p className="muted ig-empty">No approved Instagram creatives yet.</p>;
  const { title, caption, hashtags } = cur.contentPillar;

  return (
    <div className="ig-stories">
      {/* story rail: one ring per creative */}
      <div className="ig-rail" role="tablist" aria-label="Stories">
        {stories.map((c, n) => (
          <button key={c.id} type="button" role="tab" aria-selected={n === i} className={`ig-ring ${n === i ? 'on' : ''}`} onClick={() => setIndex(n)} title={c.contentPillar.title}>
            <span className="ig-ring-img">
              {c.uploads[0] ? <img src={c.uploads[0].url} alt="" /> : <ImageIcon size={18} />}
            </span>
            <small>{fmtDay(c.date)}</small>
          </button>
        ))}
      </div>

      <div className="ig-story-stage">
        <button type="button" className="ig-nav" aria-label="Previous story" disabled={i === 0} onClick={() => go(-1)}><ChevronLeft size={20} /></button>

        <div className="ig-story">
          {cur.uploads[0] ? <img className="ig-story-bg" src={cur.uploads[0].url} alt="" /> : <div className="ig-story-bg ig-story-blank" />}
          <div className="ig-story-shade" />
          <div className="ig-bars" aria-hidden="true">
            {stories.map((c, n) => <span key={c.id} className={n < i ? 'done' : n === i ? 'now' : ''} />)}
          </div>
          <div className="ig-story-head">
            <span className="ig-avatar sm">{initials(company?.name)}</span>
            <b>{company?.name}</b>
            <CreativeStatusBadge status={cur.status} compact />
            <small>{fmtDay(cur.date)}</small>
          </div>
          <button type="button" className="ig-tap left" aria-label="Previous story" onClick={() => go(-1)} />
          <button type="button" className="ig-tap right" aria-label="Next story" onClick={() => go(1)} />
          <div className="ig-story-foot">
            <b>{title}</b>
            {caption && <p>{caption}</p>}
            {hashtags?.length > 0 && <span>{hashtags.join(' ')}</span>}
          </div>
        </div>

        <button type="button" className="ig-nav" aria-label="Next story" disabled={i === stories.length - 1} onClick={() => go(1)}><ChevronRight size={20} /></button>
      </div>

      <button type="button" className="ig-open" onClick={() => onOpen(cur)}>View full creative details</button>
    </div>
  );
}
