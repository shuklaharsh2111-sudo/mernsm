import express from 'express';
import mongoose from 'mongoose';
import { protect } from '../auth.js';
import { roleModels } from '../admin/UserModels.js';
import { notifyRoles } from '../notifications/notify.js';
import Suggestion, { SUGGESTION_STATUSES, SUGGESTION_CATEGORIES } from './Suggestion.js';

const router = express.Router();
const REVIEWERS = ['admin', 'hr'];

const view = (s) => ({
  id: String(s._id),
  role: s.role,
  name: s.name,
  email: s.email,
  title: s.title,
  message: s.message,
  category: s.category,
  page: s.page,
  status: s.status,
  reviewNote: s.reviewNote,
  reviewedBy: s.reviewedBy,
  reviewedAt: s.reviewedAt,
  createdAt: s.createdAt
});

const isId = (id) => mongoose.Types.ObjectId.isValid(id);
const escapeRegex = (v) => String(v).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// POST /api/suggestions  -> any signed-in role sends a suggestion
router.post('/', protect([]), async (req, res) => {
  try {
    const title = String(req.body.title || '').trim();
    const message = String(req.body.message || '').trim();
    const category = SUGGESTION_CATEGORIES.includes(req.body.category) ? req.body.category : 'general';
    const page = String(req.body.page || '').slice(0, 200);
    if (!title) return res.status(400).json({ message: 'Please add a short title' });
    if (!message) return res.status(400).json({ message: 'Please describe your suggestion' });
    if (title.length > 120) return res.status(400).json({ message: 'Title can be at most 120 characters' });
    if (message.length > 2000) return res.status(400).json({ message: 'Suggestion can be at most 2000 characters' });

    const Model = roleModels[req.user.role];
    const me = Model ? await Model.findById(req.user.id).select('name fullname email').lean() : null;
    const created = await Suggestion.create({
      userId: req.user.id,
      role: req.user.role,
      name: me?.name || me?.fullname || me?.email || '',
      email: me?.email || '',
      title,
      message,
      category,
      page
    });
    // admins and HR get a notification (a sender who is admin/HR themselves is skipped automatically)
    await notifyRoles(REVIEWERS, {
      topic: 'suggestions',
      tone: 'info',
      title: 'New suggestion',
      message: `{actor}: ${title}`
    }, { id: req.user.id, role: req.user.role });
    return res.status(201).json({ suggestion: view(created) });
  } catch (error) {
    console.error('Suggestion create error:', error);
    return res.status(500).json({ message: 'Could not send your suggestion' });
  }
});

// GET /api/suggestions/mine  -> what the signed-in person has sent
router.get('/mine', protect([]), async (req, res) => {
  const list = await Suggestion.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(100).lean();
  res.json({ suggestions: list.map(view) });
});

// GET /api/suggestions  -> admin + HR: everything, newest first (?role= ?status= ?category= ?q=)
router.get('/', protect(REVIEWERS), async (req, res) => {
  const filter = {};
  if (req.query.role) filter.role = String(req.query.role);
  if (SUGGESTION_STATUSES.includes(req.query.status)) filter.status = req.query.status;
  if (SUGGESTION_CATEGORIES.includes(req.query.category)) filter.category = req.query.category;
  const q = String(req.query.q || '').trim();
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ title: rx }, { message: rx }, { name: rx }];
  }
  const [list, byStatus] = await Promise.all([
    Suggestion.find(filter).sort({ createdAt: -1 }).limit(500).lean(),
    Suggestion.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }])
  ]);
  const counts = Object.fromEntries(SUGGESTION_STATUSES.map((s) => [s, 0]));
  byStatus.forEach((row) => { if (row._id in counts) counts[row._id] = row.n; });
  res.json({ suggestions: list.map(view), counts });
});

// PATCH /api/suggestions/:id  -> admin + HR: set the status and/or leave a note
router.patch('/:id', protect(REVIEWERS), async (req, res) => {
  if (!isId(req.params.id)) return res.status(404).json({ message: 'Not found' });
  const update = {};
  if (req.body.status !== undefined) {
    if (!SUGGESTION_STATUSES.includes(req.body.status)) return res.status(400).json({ message: 'Invalid status' });
    update.status = req.body.status;
  }
  if (req.body.reviewNote !== undefined) update.reviewNote = String(req.body.reviewNote).trim().slice(0, 1000);
  if (!Object.keys(update).length) return res.status(400).json({ message: 'Nothing to update' });

  const Model = roleModels[req.user.role];
  const me = Model ? await Model.findById(req.user.id).select('name fullname email').lean() : null;
  update.reviewedBy = me?.name || me?.fullname || me?.email || '';
  update.reviewedAt = new Date();

  const doc = await Suggestion.findByIdAndUpdate(req.params.id, { $set: update }, { new: true }).lean();
  if (!doc) return res.status(404).json({ message: 'Suggestion not found' });
  return res.json({ suggestion: view(doc) });
});

// DELETE /api/suggestions/:id  -> admin + HR
router.delete('/:id', protect(REVIEWERS), async (req, res) => {
  if (!isId(req.params.id)) return res.status(404).json({ message: 'Not found' });
  const doc = await Suggestion.findByIdAndDelete(req.params.id).lean();
  if (!doc) return res.status(404).json({ message: 'Suggestion not found' });
  return res.json({ ok: true });
});

export default router;
