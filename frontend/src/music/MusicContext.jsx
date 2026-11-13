import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import api from '../api';

const MusicContext = createContext(null);
export const useMusic = () => useContext(MusicContext);

let ytLoading = null;
const loadYouTube = () => {
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
  if (ytLoading) return ytLoading;
  ytLoading = new Promise((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (prev) prev();
      resolve(window.YT);
    };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(s);
  });
  return ytLoading;
};

export const MusicProvider = ({ children }) => {
  const audioRef = useRef(null);
  const ytRef = useRef(null);
  const ytHostRef = useRef(null);
  const queueRef = useRef([]);
  const indexRef = useRef(-1);
  const volumeRef = useRef(0.8);

  const [queue, setQueue] = useState([]);
  const [index, setIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.8);
  const [error, setError] = useState('');
  const [playlists, setPlaylists] = useState([]);

  const current = index >= 0 ? queue[index] : null;

  /* ---------- playlists / favourites ---------- */
  const reloadPlaylists = useCallback(async () => {
    try {
      const res = await api.get('/music/playlists');
      setPlaylists(res.data.playlists || []);
    } catch {
      /* the Playlist page shows its own error */
    }
  }, []);
  useEffect(() => { reloadPlaylists(); }, [reloadPlaylists]);

  const replacePlaylist = (pl) =>
    setPlaylists((list) => (list.some((p) => p._id === pl._id) ? list.map((p) => (p._id === pl._id ? pl : p)) : [...list, pl]));

  const favorites = playlists.find((p) => p.isFavorite);
  const favIds = useMemo(() => new Set((favorites?.tracks || []).map((t) => t.trackId)), [favorites]);

  const toggleFav = async (track) => {
    const res = await api.post('/music/favorites/toggle', { track });
    replacePlaylist(res.data.playlist);
    return res.data.favorited;
  };
  const addToPlaylist = async (playlistId, track) => {
    const res = await api.post(`/music/playlists/${playlistId}/tracks`, { track });
    replacePlaylist(res.data.playlist);
    return !res.data.duplicate;
  };
  const removeFromPlaylist = async (playlistId, trackId) => {
    const res = await api.delete(`/music/playlists/${playlistId}/tracks/${encodeURIComponent(trackId)}`);
    replacePlaylist(res.data.playlist);
  };
  const createPlaylist = async (name) => {
    const res = await api.post('/music/playlists', { name });
    replacePlaylist(res.data.playlist);
    return res.data.playlist;
  };
  const renamePlaylist = async (id, name) => {
    const res = await api.patch(`/music/playlists/${id}`, { name });
    replacePlaylist(res.data.playlist);
  };
  const deletePlaylist = async (id) => {
    await api.delete(`/music/playlists/${id}`);
    setPlaylists((list) => list.filter((p) => p._id !== id));
  };

  /* ---------- playback engines ---------- */
  const stopAll = () => {
    const a = audioRef.current;
    if (a) { a.pause(); }
    try { ytRef.current?.pauseVideo?.(); } catch { /* player not ready */ }
  };

  const startTrack = useCallback(async (track) => {
    setError('');
    setProgress(0);
    setDuration(track.duration || 0);
    stopAll();
    if (track.provider === 'youtube') {
      setLoading(true);
      try {
        const YT = await loadYouTube();
        if (!ytRef.current) {
          await new Promise((resolve) => {
            ytRef.current = new YT.Player(ytHostRef.current, {
              width: '200', height: '200', videoId: track.videoId,
              playerVars: { autoplay: 1, playsinline: 1, controls: 0 },
              events: {
                onReady: (e) => { e.target.setVolume(volumeRef.current * 100); e.target.playVideo(); resolve(); },
                onStateChange: (e) => {
                  if (e.data === YT.PlayerState.PLAYING) { setPlaying(true); setLoading(false); setDuration(e.target.getDuration() || 0); }
                  else if (e.data === YT.PlayerState.PAUSED) setPlaying(false);
                  else if (e.data === YT.PlayerState.BUFFERING) setLoading(true);
                  else if (e.data === YT.PlayerState.ENDED) window.dispatchEvent(new Event('music-ended'));
                },
                onError: () => {
                  setError('This video cannot be played here. Skipping…');
                  setLoading(false);
                  setTimeout(() => window.dispatchEvent(new Event('music-ended')), 1200);
                }
              }
            });
          });
        } else {
          ytRef.current.loadVideoById(track.videoId);
          ytRef.current.setVolume(volumeRef.current * 100);
        }
      } catch {
        setError('Could not load the YouTube player.');
        setLoading(false);
      }
    } else {
      const a = audioRef.current;
      a.src = track.audioUrl;
      a.volume = volumeRef.current;
      setLoading(true);
      try {
        await a.play();
      } catch (e) {
        if (e.name !== 'AbortError') setError('Could not play this song.');
        setLoading(false);
      }
    }
  }, []);

  const playTrack = useCallback((track, list) => {
    const q = list && list.length ? list : [track];
    const i = Math.max(0, q.findIndex((t) => t.trackId === track.trackId));
    queueRef.current = q; indexRef.current = i;
    setQueue(q); setIndex(i);
    startTrack(q[i]);
  }, [startTrack]);

  const goTo = useCallback((i) => {
    const q = queueRef.current;
    if (!q.length) return;
    const n = (i + q.length) % q.length;
    indexRef.current = n; setIndex(n);
    startTrack(q[n]);
  }, [startTrack]);

  const next = useCallback(() => goTo(indexRef.current + 1), [goTo]);
  const prev = useCallback(() => {
    const t = audioRef.current?.currentTime || 0;
    if (t > 3 && current?.provider !== 'youtube') { audioRef.current.currentTime = 0; return; }
    goTo(indexRef.current - 1);
  }, [goTo, current]);

  const toggle = () => {
    if (!current) return;
    if (current.provider === 'youtube') {
      const yt = ytRef.current;
      if (!yt) return;
      if (playing) yt.pauseVideo(); else yt.playVideo();
    } else {
      const a = audioRef.current;
      if (a.paused) a.play().catch(() => {}); else a.pause();
    }
  };

  const seek = (sec) => {
    if (!current) return;
    if (current.provider === 'youtube') ytRef.current?.seekTo?.(sec, true);
    else if (audioRef.current) audioRef.current.currentTime = sec;
    setProgress(sec);
  };

  const setVolume = (v) => {
    volumeRef.current = v; setVolumeState(v);
    if (audioRef.current) audioRef.current.volume = v;
    try { ytRef.current?.setVolume?.(v * 100); } catch { /* not ready */ }
  };

  useEffect(() => {
    const onEnd = () => next();
    window.addEventListener('music-ended', onEnd);
    return () => window.removeEventListener('music-ended', onEnd);
  }, [next]);

  // YouTube has no timeupdate event, so poll while it plays.
  useEffect(() => {
    if (current?.provider !== 'youtube' || !playing) return undefined;
    const id = setInterval(() => {
      try {
        setProgress(ytRef.current.getCurrentTime() || 0);
        setDuration(ytRef.current.getDuration() || 0);
      } catch { /* not ready */ }
    }, 500);
    return () => clearInterval(id);
  }, [current, playing]);

  const value = {
    queue, index, current, playing, loading, progress, duration, volume, error,
    playTrack, next, prev, toggle, seek, setVolume,
    playlists, favIds, reloadPlaylists, toggleFav, addToPlaylist, removeFromPlaylist,
    createPlaylist, renamePlaylist, deletePlaylist
  };

  return (
    <MusicContext.Provider value={value}>
      {children}
      <audio
        ref={audioRef}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPlaying={() => setLoading(false)}
        onPause={() => setPlaying(false)}
        onWaiting={() => setLoading(true)}
        onTimeUpdate={(e) => setProgress(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
        onEnded={() => next()}
        onError={() => { if (audioRef.current?.src) { setError('Could not play this song. Skipping…'); setLoading(false); setTimeout(next, 1200); } }}
      />
      <div className="yt-offscreen" aria-hidden="true"><div ref={ytHostRef} /></div>
    </MusicContext.Provider>
  );
};
