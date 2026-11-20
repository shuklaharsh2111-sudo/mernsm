import express from 'express';
import mongoose from 'mongoose';
import RoleSkill from './RoleSkill.js';
import { splitSkills } from './skillMatch.js';

const router = express.Router();
const validId = (id) => mongoose.Types.ObjectId.isValid(id);

const view = (r) => ({
  id: String(r._id),
  role: r.role,
  skills: r.skills || [],
  minMatch: r.minMatch ?? 60,
  autoShortlist: r.autoShortlist !== false,
  updatedAt: r.updatedAt
});

const cleanList = (value) => {
  const seen = new Set();
  return splitSkills(value)
    .map((s) => s.replace(/\s+/g, ' ').slice(0, 40))
    .filter((s) => s && !seen.has(s.toLowerCase()) && seen.add(s.toLowerCase()))
    .slice(0, 40);
};
const cleanMin = (v) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(100, Math.max(10, n)) : 60;
};
const sameRole = (a, b) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase();

router.get('/', async (req, res) => {
  const list = await RoleSkill.find().sort({ role: 1 });
  res.json({ roles: list.map(view) });
});

router.post('/', async (req, res) => {
  const role = String(req.body.role || '').trim().replace(/\s+/g, ' ').slice(0, 80);
  const skills = cleanList(req.body.skills);
  if (!role) return res.status(400).json({ message: 'Role name is required.' });
  if (!skills.length) return res.status(400).json({ message: 'Add at least one base skill for this role.' });
  const all = await RoleSkill.find().select('role').lean();
  if (all.some((r) => sameRole(r.role, role))) return res.status(409).json({ message: `${role} already has base skills. Edit it instead.` });
  const doc = await RoleSkill.create({
    role, skills,
    minMatch: cleanMin(req.body.minMatch ?? 60),
    autoShortlist: req.body.autoShortlist !== false,
    createdBy: req.user.id
  });
  res.status(201).json({ role: view(doc) });
});

router.put('/:id', async (req, res) => {
  if (!validId(req.params.id)) return res.status(404).json({ message: 'Role not found.' });
  const doc = await RoleSkill.findById(req.params.id);
  if (!doc) return res.status(404).json({ message: 'Role not found.' });
  const b = req.body || {};
  if ('role' in b) {
    const role = String(b.role || '').trim().replace(/\s+/g, ' ').slice(0, 80);
    if (!role) return res.status(400).json({ message: 'Role name is required.' });
    const all = await RoleSkill.find({ _id: { $ne: doc._id } }).select('role').lean();
    if (all.some((r) => sameRole(r.role, role))) return res.status(409).json({ message: `${role} already has base skills.` });
    doc.role = role;
  }
  if ('skills' in b) {
    const skills = cleanList(b.skills);
    if (!skills.length) return res.status(400).json({ message: 'A role needs at least one base skill.' });
    doc.skills = skills;
  }
  if ('minMatch' in b) doc.minMatch = cleanMin(b.minMatch);
  if ('autoShortlist' in b) doc.autoShortlist = !!b.autoShortlist;
  await doc.save();
  res.json({ role: view(doc) });
});

router.delete('/:id', async (req, res) => {
  if (!validId(req.params.id)) return res.status(404).json({ message: 'Role not found.' });
  const doc = await RoleSkill.findByIdAndDelete(req.params.id);
  if (!doc) return res.status(404).json({ message: 'Role not found.' });
  res.json({ message: 'Role removed.' });
});

export default router;
