import { useEffect, useRef, useState } from 'react';
import { Heart, ListMusic, Pause, Pencil, Play, Plus, Search, Trash2, X, Music2 } from 'lucide-react';
import api from '../api';
import { useMusic } from './MusicContext';
import { fmtTime } from './MiniPlayer';
import '../styles/music.css';

const errText = (e, fb) => e?.response?.data?.message || fb;

const AddMenu = ({ track, m, onClose }) => {
  const [name, setName] = useState('');
  const [msg, setMsg] = useState('');
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose]);
  const custom = m.playlists.filter((p) => !p.isFavorite);
  const add = async (p) => {
    try {
      const added = await m.addToPlaylist(p._id, track);
      setMsg(added ? `Added to ${p.name}` : 'Already in that playlist');
      setTimeout(onClose, 700);
    } catch (e) { setMsg(errText(e, 'Could not add')); }
  };
  const create = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      const p = await m.createPlaylist(name.trim());
      await add(p);
    } catch (er) { setMsg(errText(er, 'Could not create')); }
  };
  return (
    <div className="pl-menu" ref={ref}>
      <p className="pl-menu-h">Add to playlist</p>
      {custom.length === 0 && <p className="pl-menu-empty">No playlists yet</p>}
      {custom.map((p) => (
        <button type="button" key={p._id} onClick={() => add(p)}>{p.name}<small>{p.tracks.length}</small></button>
      ))}
      <form onSubmit={create} className="pl-menu-new">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New playlist…" maxLength={60} />
        <button type="submit" aria-label="Create"><Plus size={14} /></button>
      </form>
      {msg && <p className="pl-menu-msg">{msg}</p>}
    </div>
  );
};

const TrackRow = ({ track, list, m, onRemove }) => {
  const [menu, setMenu] = useState(false);
  const active = m.current?.trackId === track.trackId;
  const faved = m.favIds.has(track.trackId);
  const onPlay = () => (active ? m.toggle() : m.playTrack(track, list));
  return (
    <li className={`pl-row ${active ? 'active' : ''}`}>
      <button type="button" className="pl-art" onClick={onPlay} aria-label={`Play ${track.title}`}>
        {track.artwork ? <img src={track.artwork} alt="" loading="lazy" /> : <Music2 size={20} />}
        <span className="pl-art-over">{active && m.playing ? <Pause size={18} /> : <Play size={18} />}</span>
      </button>
      <div className="pl-info">
        <strong title={track.title}>{track.title}</strong>
        <span>{track.artist}</span>
      </div>
      <span className="pl-dur">{track.duration ? fmtTime(track.duration) : ''}</span>
      <button type="button" className={`pl-btn ${faved ? 'on' : ''}`} onClick={() => m.toggleFav(track)} aria-label={faved ? 'Remove from favourites' : 'Add to favourites'} title="Favourite">
        <Heart size={16} fill={faved ? 'currentColor' : 'none'} />
      </button>
      <div className="pl-add">
        <button type="button" className="pl-btn" onClick={() => setMenu((v) => !v)} aria-label="Add to playlist" title="Add to playlist"><Plus size={16} /></button>
        {menu && <AddMenu track={track} m={m} onClose={() => setMenu(false)} />}
      </div>
      {onRemove && (
        <button type="button" className="pl-btn danger" onClick={() => onRemove(track)} aria-label="Remove from playlist" title="Remove"><X size={16} /></button>
      )}
    </li>
  );
};

const PlaylistPage = ({ workspace = 'WORKSPACE' }) => {
  const m = useMusic();
  const [tab, setTab] = useState('discover');         // 'discover' | playlist id
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState(null);
  const [editName, setEditName] = useState('');

  const search = async (q = query) => {
    setSearching(true); setError('');
    try {
      const res = await api.get('/music/search', { params: { q } });
      setResults(res.data.tracks);
      if (!res.data.tracks.length) setError('No songs found. Try another search.');
    } catch (e) {
      setResults([]); setError(errText(e, 'Search failed'));
    } finally { setSearching(false); }
  };
  useEffect(() => { search(''); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const active = m.playlists.find((p) => p._id === tab);
  useEffect(() => { if (tab !== 'discover' && !active && m.playlists.length) setTab('discover'); }, [tab, active, m.playlists]);

  const create = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try { const p = await m.createPlaylist(newName.trim()); setNewName(''); setTab(p._id); }
    catch (er) { setError(errText(er, 'Could not create playlist')); }
  };
  const rename = async (e) => {
    e.preventDefault();
    if (!editName.trim()) return;
    try { await m.renamePlaylist(editing, editName.trim()); setEditing(null); }
    catch (er) { setError(errText(er, 'Could not rename')); }
  };
  const remove = async (p) => {
    if (!window.confirm(`Delete playlist "${p.name}"?`)) return;
    try { await m.deletePlaylist(p._id); setTab('discover'); } catch (er) { setError(errText(er, 'Could not delete')); }
  };

  return (
    <div className="dashboard-content scrollable">
      <div className="page-header">
        <div>
          <span className="page-label">{workspace}</span>
          <h1>Playlist</h1>
          <p>Search songs on YouTube and play just the audio, right here. Keep your favourites; music keeps playing while you move between pages.</p>
        </div>
      </div>

      <div className="pl-layout">
        <aside className="pl-side">
          <button type="button" className={`pl-tab ${tab === 'discover' ? 'active' : ''}`} onClick={() => setTab('discover')}>
            <Search size={16} /> Discover
          </button>
          <p className="pl-side-h">Your library</p>
          {m.playlists.map((p) => (
            <button type="button" key={p._id} className={`pl-tab ${tab === p._id ? 'active' : ''}`} onClick={() => setTab(p._id)}>
              {p.isFavorite ? <Heart size={16} fill="currentColor" /> : <ListMusic size={16} />}
              <span className="pl-tab-name">{p.name}</span>
              <small>{p.tracks.length}</small>
            </button>
          ))}
          <form className="pl-newform" onSubmit={create}>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New playlist" maxLength={60} />
            <button type="submit" aria-label="Create playlist"><Plus size={16} /></button>
          </form>
        </aside>

        <section className="pl-main">
          {tab === 'discover' ? (
            <>
              <form className="pl-search" onSubmit={(e) => { e.preventDefault(); search(); }}>
                <Search size={16} />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search songs, artists or moods…" />
                <button type="submit" className="btn-primary">Search</button>
              </form>
              {error && <p className="pl-error">{error}</p>}
              {searching ? <p className="pl-empty">Loading songs…</p> : (
                <ul className="pl-list">
                  {results.map((t) => <TrackRow key={t.trackId} track={t} list={results} m={m} />)}
                </ul>
              )}
            </>
          ) : active ? (
            <>
              <div className="pl-head">
                {editing === active._id ? (
                  <form onSubmit={rename} className="pl-rename">
                    <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={60} />
                    <button type="submit" className="btn-primary">Save</button>
                    <button type="button" className="pl-btn" onClick={() => setEditing(null)}>Cancel</button>
                  </form>
                ) : (
                  <>
                    <h2>{active.name}</h2>
                    <span className="pl-count">{active.tracks.length} song{active.tracks.length === 1 ? '' : 's'}</span>
                    <div className="pl-head-actions">
                      {active.tracks.length > 0 && (
                        <button type="button" className="btn-primary" onClick={() => m.playTrack(active.tracks[0], active.tracks)}><Play size={15} /> Play all</button>
                      )}
                      {!active.isFavorite && (
                        <>
                          <button type="button" className="pl-btn" onClick={() => { setEditing(active._id); setEditName(active.name); }} aria-label="Rename"><Pencil size={16} /></button>
                          <button type="button" className="pl-btn danger" onClick={() => remove(active)} aria-label="Delete playlist"><Trash2 size={16} /></button>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
              {active.tracks.length === 0 ? (
                <p className="pl-empty">{active.isFavorite ? 'Tap the heart on any song to save it here.' : 'Empty playlist. Use the + button on a song in Discover to add it.'}</p>
              ) : (
                <ul className="pl-list">
                  {active.tracks.map((t) => (
                    <TrackRow key={t.trackId} track={t} list={active.tracks} m={m} onRemove={(tr) => m.removeFromPlaylist(active._id, tr.trackId)} />
                  ))}
                </ul>
              )}
            </>
          ) : null}
        </section>
      </div>
    </div>
  );
};
export default PlaylistPage;
