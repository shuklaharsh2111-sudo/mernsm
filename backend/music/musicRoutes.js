import express from 'express';
import mongoose from 'mongoose';
import { protect } from '../auth.js';
import Playlist from './Playlist.js';

const router = express.Router();
// Every signed-in role (admin, sme, des, smi, hr ...) gets its own playlists.
router.use(protect([]));

const validId = (id) => mongoose.Types.ObjectId.isValid(id);
const str = (v, max = 300) => String(v ?? '').slice(0, max);

/* ---------------------------- YouTube ---------------------------- */
// Songs come from the YouTube Data API v3 (YOUTUBE_API_KEY in backend/.env).
// The frontend plays only the audio: the YouTube player is kept hidden and just the cover art is shown.
const getJson = async (url) => {
  const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    const reason = body?.error?.errors?.[0]?.reason || '';
    const err = new Error(`YouTube returned ${r.status} ${reason}`);
    err.reason = reason;
    throw err;
  }
  return r.json();
};

const decode = (s = '') =>
  s.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

// "PT4M13S" -> 253
const isoToSeconds = (iso = '') => {
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  return m ? (Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0)) : 0;
};

// A search costs 100 quota units (10,000 free per day), so remember results for 10 minutes.
const cache = new Map();
const CACHE_MS = 10 * 60 * 1000;

const searchYoutube = async (q) => {
  const hit = cache.get(q);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.tracks;

  const key = process.env.YOUTUBE_API_KEY;
  const found = await getJson(`https://www.googleapis.com/youtube/v3/search?${new URLSearchParams({
    part: 'snippet', type: 'video', videoCategoryId: '10', videoEmbeddable: 'true',
    maxResults: '25', q, key
  })}`);
  const ids = (found.items || []).map((v) => v.id.videoId).filter(Boolean);
  if (!ids.length) return [];

  // Second call (1 unit) for the song lengths, and to drop anything that cannot be played.
  const details = await getJson(`https://www.googleapis.com/youtube/v3/videos?${new URLSearchParams({
    part: 'contentDetails,status', id: ids.join(','), key
  })}`);
  const info = new Map((details.items || []).map((v) => [v.id, v]));

  const tracks = (found.items || [])
    .filter((v) => info.get(v.id.videoId)?.status?.embeddable !== false)
    .map((v) => ({
      trackId: `youtube:${v.id.videoId}`,
      provider: 'youtube',
      title: decode(v.snippet.title),
      artist: decode(v.snippet.channelTitle).replace(/ - Topic$/, ''),
      artwork: v.snippet.thumbnails?.high?.url || v.snippet.thumbnails?.medium?.url || '',
      audioUrl: '',
      videoId: v.id.videoId,
      duration: isoToSeconds(info.get(v.id.videoId)?.contentDetails?.duration)
    }));
  cache.set(q, { at: Date.now(), tracks });
  if (cache.size > 100) cache.delete(cache.keys().next().value);
  return tracks;
};

const DEFAULT_QUERIES = ['top hits', 'bollywood hits', 'lofi chill', 'workout songs', 'focus instrumental music', 'punjabi hits'];

router.get('/sources', (req, res) => res.json({ youtube: !!process.env.YOUTUBE_API_KEY }));

router.get('/search', async (req, res) => {
  try {
    if (!process.env.YOUTUBE_API_KEY) {
      return res.status(400).json({ code: 'NO_KEY', message: 'YouTube is not set up. Add YOUTUBE_API_KEY to backend/.env and restart the server.' });
    }
    let q = str(req.query.q, 100).trim();
    if (!q) q = DEFAULT_QUERIES[Math.floor(Math.random() * DEFAULT_QUERIES.length)];
    const tracks = await searchYoutube(q);
    res.json({ tracks, query: q });
  } catch (err) {
    console.error('YouTube search error:', err.message);
    if (err.reason === 'quotaExceeded' || err.reason === 'dailyLimitExceeded') {
      return res.status(429).json({ message: 'The daily YouTube search limit has been reached. Try again tomorrow, or play songs from your playlists.' });
    }
    if (/keyInvalid|accessNotConfigured|forbidden/i.test(err.reason || '') || /\b(400|403)\b/.test(err.message)) {
      return res.status(502).json({ message: 'YouTube rejected the API key. Check that YouTube Data API v3 is enabled for it.' });
    }
    res.status(502).json({ message: 'Could not load songs right now. Please try again.' });
  }
});

/* ---------------------------- playlists ---------------------------- */
const mine = (req) => ({ ownerId: req.user.id, role: req.user.role });

// Favourites always exists; created the first time the user opens Playlist.
router.get('/playlists', async (req, res) => {
  try {
    let fav = await Playlist.findOne({ ...mine(req), isFavorite: true });
    if (!fav) fav = await Playlist.create({ ...mine(req), name: 'Favourites', isFavorite: true });
    const playlists = await Playlist.find(mine(req)).sort({ isFavorite: -1, createdAt: 1 });
    res.json({ playlists });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not load playlists' });
  }
});

router.post('/playlists', async (req, res) => {
  try {
    const name = str(req.body.name, 60).trim();
    if (!name) return res.status(400).json({ message: 'Playlist name is required' });
    const count = await Playlist.countDocuments(mine(req));
    if (count >= 30) return res.status(400).json({ message: 'You can have up to 30 playlists' });
    const playlist = await Playlist.create({ ...mine(req), name });
    res.status(201).json({ playlist });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not create playlist' });
  }
});

router.patch('/playlists/:id', async (req, res) => {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid playlist' });
    const name = str(req.body.name, 60).trim();
    if (!name) return res.status(400).json({ message: 'Playlist name is required' });
    const playlist = await Playlist.findOneAndUpdate(
      { _id: req.params.id, ...mine(req), isFavorite: false },
      { $set: { name } },
      { new: true }
    );
    if (!playlist) return res.status(404).json({ message: 'Playlist not found' });
    res.json({ playlist });
  } catch (err) {
    res.status(500).json({ message: 'Could not rename playlist' });
  }
});

router.delete('/playlists/:id', async (req, res) => {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid playlist' });
    const r = await Playlist.deleteOne({ _id: req.params.id, ...mine(req), isFavorite: false });
    if (!r.deletedCount) return res.status(404).json({ message: 'Playlist not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Could not delete playlist' });
  }
});

const cleanTrack = (t = {}) => {
  const provider = ['youtube', 'jamendo', 'itunes'].includes(t.provider) ? t.provider : null;
  const trackId = str(t.trackId, 120);
  if (!provider || !trackId.startsWith(`${provider}:`)) return null;
  const audioUrl = str(t.audioUrl, 500);
  if (audioUrl && !/^https:\/\//i.test(audioUrl)) return null;
  const artwork = str(t.artwork, 500);
  return {
    trackId, provider,
    title: str(t.title, 200), artist: str(t.artist, 200),
    artwork: /^https:\/\//i.test(artwork) ? artwork : '',
    audioUrl, videoId: str(t.videoId, 20),
    duration: Math.max(0, Number(t.duration) || 0)
  };
};

router.post('/playlists/:id/tracks', async (req, res) => {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid playlist' });
    const track = cleanTrack(req.body.track);
    if (!track) return res.status(400).json({ message: 'Invalid song' });
    const playlist = await Playlist.findOneAndUpdate(
      { _id: req.params.id, ...mine(req), 'tracks.trackId': { $ne: track.trackId } },
      { $push: { tracks: track } },
      { new: true }
    );
    if (!playlist) {
      const exists = await Playlist.findOne({ _id: req.params.id, ...mine(req) });
      if (!exists) return res.status(404).json({ message: 'Playlist not found' });
      return res.json({ playlist: exists, duplicate: true });
    }
    res.json({ playlist });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not add song' });
  }
});

router.delete('/playlists/:id/tracks/:trackId', async (req, res) => {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid playlist' });
    const playlist = await Playlist.findOneAndUpdate(
      { _id: req.params.id, ...mine(req) },
      { $pull: { tracks: { trackId: req.params.trackId } } },
      { new: true }
    );
    if (!playlist) return res.status(404).json({ message: 'Playlist not found' });
    res.json({ playlist });
  } catch (err) {
    res.status(500).json({ message: 'Could not remove song' });
  }
});

// Heart button: add to / remove from Favourites in one call.
router.post('/favorites/toggle', async (req, res) => {
  try {
    const track = cleanTrack(req.body.track);
    if (!track) return res.status(400).json({ message: 'Invalid song' });
    let fav = await Playlist.findOne({ ...mine(req), isFavorite: true });
    if (!fav) fav = await Playlist.create({ ...mine(req), name: 'Favourites', isFavorite: true });
    const has = fav.tracks.some((t) => t.trackId === track.trackId);
    if (has) fav.tracks = fav.tracks.filter((t) => t.trackId !== track.trackId);
    else fav.tracks.push(track);
    await fav.save();
    res.json({ playlist: fav, favorited: !has });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not update favourites' });
  }
});

export default router;
