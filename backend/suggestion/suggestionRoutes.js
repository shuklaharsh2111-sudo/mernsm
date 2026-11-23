import express from 'express';
import mongoose from 'mongoose';
import { protect } from '../auth.js';
import { notifyRoles } from '../notifications/notify.js';
import Suggestion from './Suggestion.js';

const router = express.Router();
const REVIEWERS = ['admin', 'hr'];

// Only these fields ever leave the server, so a sender can never be identified from the response.
const view = (s) => ({
  id: String(s._id),
  message: s.message,
  createdAt: s.createdAt
});

const isId = (id) => mongoose.Types.ObjectId.isValid(id);
const escapeRegex = (v) => String(v).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Spam guard. Lives only in memory (never saved with the suggestion), so anonymity is kept.
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 10;
const recent = new Map();
const tooMany = (userId) => {
  const now = Date.now();
  const hits = (recent.get(userId) || []).filter((t) => now - t < WINDOW_MS);
  if (hits.length >= MAX_PER_WINDOW) { recent.set(userId, hits); return true; }
  hits.push(now);
  recent.set(userId, hits);
  return false;
};

// POST /api/suggestions  -> any signed-in role sends one anonymous suggestion
router.post('/', protect([]), async (req, res) => {
  try {
    const message = String(req.body.message || '').trim();
    if (!message) return res.status(400).json({ message: 'Please type your suggestion' });
    if (message.length > 2000) return res.status(400).json({ message: 'Suggestion can be at most 2000 characters' });
    if (tooMany(String(req.user.id))) return res.status(429).json({ message: 'You have sent a lot of suggestions. Please try again later.' });

    await Suggestion.create({ message });
    // no actor is passed on purpose: the notification must not name the sender
    await notifyRoles(REVIEWERS, {
      topic: 'suggestions',
      tone: 'info',
      title: 'New suggestion',
      message: message.length > 90 ? `${message.slice(0, 90)}…` : message
    });
    return res.status(201).json({ ok: true });
  } catch (error) {
    console.error('Suggestion create error:', error);
    return res.status(500).json({ message: 'Could not send your suggestion' });
  }
});

// GET /api/suggestions  -> admin + HR (?q= search, ?sort=oldest)
router.get('/', protect(REVIEWERS), async (req, res) => {
  const filter = {};
  const q = String(req.query.q || '').trim();
  if (q) filter.message = new RegExp(escapeRegex(q), 'i');
  const order = req.query.sort === 'oldest' ? 1 : -1;
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [list, total, thisWeek] = await Promise.all([
    Suggestion.find(filter).select('message createdAt').sort({ createdAt: order }).limit(500).lean(),
    Suggestion.countDocuments(),
    Suggestion.countDocuments({ createdAt: { $gte: weekAgo } })
  ]);
  res.json({ suggestions: list.map(view), total, thisWeek });
});

// DELETE /api/suggestions/:id  -> admin + HR
router.delete('/:id', protect(REVIEWERS), async (req, res) => {
  if (!isId(req.params.id)) return res.status(404).json({ message: 'Not found' });
  const doc = await Suggestion.findByIdAndDelete(req.params.id).lean();
  if (!doc) return res.status(404).json({ message: 'Suggestion not found' });
  return res.json({ ok: true });
});

export default router;
