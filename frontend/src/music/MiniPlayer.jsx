import { Heart, Loader2, Pause, Play, SkipBack, SkipForward, Volume2 } from 'lucide-react';
import { useMusic } from './MusicContext';

export const fmtTime = (s) => {
  if (!s || !Number.isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
};

const MiniPlayer = () => {
  const m = useMusic();
  if (!m || !m.current) return null;
  const { current: t, playing, loading, progress, duration, volume, error } = m;
  const faved = m.favIds.has(t.trackId);
  return (
    <div className="mp-bar" role="region" aria-label="Music player">
      <div className="mp-track">
        {t.artwork ? <img src={t.artwork} alt="" /> : <div className="mp-art-fallback" />}
        <div className="mp-meta">
          <strong title={t.title}>{t.title}</strong>
          <span>{error || t.artist}</span>
        </div>
        <button type="button" className={`mp-icon ${faved ? 'on' : ''}`} onClick={() => m.toggleFav(t)} aria-label={faved ? 'Remove from favourites' : 'Add to favourites'}>
          <Heart size={17} fill={faved ? 'currentColor' : 'none'} />
        </button>
      </div>
      <div className="mp-center">
        <div className="mp-controls">
          <button type="button" className="mp-icon" onClick={m.prev} aria-label="Previous"><SkipBack size={18} /></button>
          <button type="button" className="mp-play" onClick={m.toggle} aria-label={playing ? 'Pause' : 'Play'}>
            {loading ? <Loader2 size={20} className="spin" /> : playing ? <Pause size={20} /> : <Play size={20} />}
          </button>
          <button type="button" className="mp-icon" onClick={m.next} aria-label="Next"><SkipForward size={18} /></button>
        </div>
        <div className="mp-seek">
          <span>{fmtTime(progress)}</span>
          <input type="range" min="0" max={duration || 0} step="1" value={Math.min(progress, duration || 0)} onChange={(e) => m.seek(Number(e.target.value))} aria-label="Seek" />
          <span>{fmtTime(duration)}</span>
        </div>
      </div>
      <div className="mp-vol">
        <Volume2 size={16} />
        <input type="range" min="0" max="1" step="0.05" value={volume} onChange={(e) => m.setVolume(Number(e.target.value))} aria-label="Volume" />
      </div>
    </div>
  );
};
export default MiniPlayer;
