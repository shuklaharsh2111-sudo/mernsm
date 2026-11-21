import express from 'express';
import mongoose from 'mongoose';
import { protect } from '../auth.js';
import Notification from './Notification.js';

const router = express.Router();
router.use(protect([]));

const view = (n) => ({
  id: String(n._id),
  topic: n.topic,
  tone: n.tone,
  title: n.title,
  message: n.message,
  link: n.link,
  actorName: n.actorName,
  actorRole: n.actorRole,
  read: Boolean(n.readAt),
  createdAt: n.createdAt
});

// GET /api/notifications  -> the latest 40 + how many are unread (the app polls this)
router.get('/', async (req, res) => {
  const [list, unreadCount] = await Promise.all([
    Notification.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(40).lean(),
    Notification.countDocuments({ userId: req.user.id, readAt: null })
  ]);
  res.json({ notifications: list.map(view), unreadCount });
});

router.put('/read-all', async (req, res) => {
  await Notification.updateMany({ userId: req.user.id, readAt: null }, { $set: { readAt: new Date() } });
  res.json({ ok: true });
});

router.put('/:id/read', async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ message: 'Not found' });
  await Notification.updateOne({ _id: req.params.id, userId: req.user.id, readAt: null }, { $set: { readAt: new Date() } });
  res.json({ ok: true });
});

router.delete('/', async (req, res) => {
  await Notification.deleteMany({ userId: req.user.id });
  res.json({ ok: true });
});

export default router;
