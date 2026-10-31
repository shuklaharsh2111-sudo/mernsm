import express from 'express';
import mongoose from 'mongoose';
import { protect } from '../auth.js';
import Sme from './Sme.js';
import Company from '../company/Company.js';
import SopAssignment from '../sop/SopAssignment.js';
import { periodKey, resolveToday } from '../sop/period.js';

const router = express.Router();
router.use(protect(['sme']));

// Companies the admin assigned to the logged-in SME (max 5), in the order assigned.
router.get('/companies', async (req, res) => {
  const me = await Sme.findById(req.user.id);
  if (!me) return res.status(401).json({ message: 'User not found' });
  const ids = (me.companies || []).map(String);
  const found = await Company.find({ _id: { $in: ids } });
  const byId = Object.fromEntries(found.map((c) => [String(c._id), c]));
  const companies = ids.filter((id) => byId[id]).map((id) => ({ id, name: byId[id].name }));
  res.json({ companies });
});

const view = (a, today) => {
  const key = periodKey(a.type, today);
  return {
    id: a._id,
    type: a.type,
    text: a.text,
    date: a.date,
    active: a.date <= today, // not started yet -> can't be ticked
    period: key,
    done: (a.completions || []).some((c) => c.period === key),
    completions: (a.completions || []).map((c) => ({ period: c.period, at: c.at })),
    company: a.company ? { id: a.company._id, name: a.company.name } : { id: '', name: 'Removed company' },
  };
};

const listFor = async (userId, today) => {
  const list = await SopAssignment.find({ user: userId })
    .sort({ date: -1, createdAt: -1 })
    .limit(300)
    .populate('company', 'name');
  return list.map((a) => view(a, today));
};

// SOPs the admin assigned to me, with this period's tick state.
router.get('/sop-assignments', async (req, res) => {
  const today = resolveToday(req.query.today);
  res.json({ assignments: await listFor(req.user.id, today), today });
});

// Save ticks: body = { today, changes: [{ id, done }] }. A tick is saved for the
// current period only (today / this week / this month, by the SOP's type).
router.put('/sop-assignments/completions', async (req, res) => {
  const today = resolveToday(req.body.today);
  const changes = Array.isArray(req.body.changes) ? req.body.changes.slice(0, 200) : [];
  if (changes.some((c) => !mongoose.Types.ObjectId.isValid(c?.id) || typeof c.done !== 'boolean')) {
    return res.status(400).json({ message: 'Invalid changes' });
  }

  for (const { id, done } of changes) {
    const sop = await SopAssignment.findOne({ _id: id, user: req.user.id });
    if (!sop || sop.date > today) continue; // not mine, or hasn't started yet
    const key = periodKey(sop.type, today);
    const has = sop.completions.some((c) => c.period === key);
    if (done && !has) sop.completions.push({ period: key, at: new Date() });
    if (!done && has) sop.completions = sop.completions.filter((c) => c.period !== key);
    if (done !== has) await sop.save();
  }

  res.json({ assignments: await listFor(req.user.id, today), today });
});

export default router;
