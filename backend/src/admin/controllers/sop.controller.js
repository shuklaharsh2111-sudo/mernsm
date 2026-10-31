import mongoose from 'mongoose';
import Sop, { SOP_STATUSES } from '../models/Sop.js';

const MIN_REASON = 5;
const REASON_REQUIRED = ['rejected', 'revision'];

const validId = (id) => mongoose.Types.ObjectId.isValid(id);

export const listSops = async (req, res, next) => {
  try {
    const { status } = req.query;
    const filter = SOP_STATUSES.includes(status) ? { status } : {};
    const [sops, grouped] = await Promise.all([
      Sop.find(filter).sort({ updatedAt: -1 }).limit(200),
      Sop.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    ]);
    const counts = { pending: 0, approved: 0, rejected: 0, revision: 0 };
    grouped.forEach((g) => (counts[g._id] = g.count));
    res.json({ sops, counts });
  } catch (err) {
    next(err);
  }
};

export const getSop = async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return res.status(404).json({ message: 'SOP not found' });
    const sop = await Sop.findById(req.params.id);
    if (!sop) return res.status(404).json({ message: 'SOP not found' });
    res.json({ sop });
  } catch (err) {
    next(err);
  }
};

export const createSop = async (req, res, next) => {
  try {
    const { title, department, description, content, submittedBy } = req.body;
    if (!title?.trim() || !content?.trim()) {
      return res.status(400).json({ message: 'Title and SOP content are required' });
    }
    const sop = await Sop.create({
      title,
      department,
      description,
      content,
      submittedBy: submittedBy?.trim() || req.admin.name,
      history: [{ status: 'pending', reason: 'Submitted for review', by: req.admin.name }],
    });
    res.status(201).json({ sop });
  } catch (err) {
    next(err);
  }
};

// Edit an SOP; if it was sent back for redo, editing resubmits it for review.
export const updateSop = async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return res.status(404).json({ message: 'SOP not found' });
    const sop = await Sop.findById(req.params.id);
    if (!sop) return res.status(404).json({ message: 'SOP not found' });
    if (sop.status === 'approved') {
      return res.status(409).json({ message: 'Approved SOPs cannot be edited' });
    }

    const { title, department, description, content } = req.body;
    if (title !== undefined) sop.title = title;
    if (department !== undefined) sop.department = department;
    if (description !== undefined) sop.description = description;
    if (content !== undefined) sop.content = content;
    if (!sop.title?.trim() || !sop.content?.trim()) {
      return res.status(400).json({ message: 'Title and SOP content are required' });
    }

    if (sop.status === 'revision' || sop.status === 'rejected') {
      sop.status = 'pending';
      sop.revisionCount += 1;
      sop.history.push({ status: 'pending', reason: 'Resubmitted after changes', by: req.admin.name });
    }
    await sop.save();
    res.json({ sop });
  } catch (err) {
    next(err);
  }
};

// Approve / reject / request revision. Reject + revision need a "why redo" reason.
export const reviewSop = async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return res.status(404).json({ message: 'SOP not found' });
    const { decision, reason } = req.body;
    const allowed = ['approved', 'rejected', 'revision'];
    if (!allowed.includes(decision)) {
      return res.status(400).json({ message: 'Decision must be approved, rejected or revision' });
    }
    const note = typeof reason === 'string' ? reason.trim() : '';
    if (REASON_REQUIRED.includes(decision) && note.length < MIN_REASON) {
      return res.status(400).json({
        message: `Please explain why (at least ${MIN_REASON} characters) when rejecting or requesting a redo`,
      });
    }

    const sop = await Sop.findById(req.params.id);
    if (!sop) return res.status(404).json({ message: 'SOP not found' });

    sop.status = decision;
    sop.reviewReason = note;
    sop.reviewedBy = req.admin._id;
    sop.reviewedByName = req.admin.name;
    sop.reviewedAt = new Date();
    sop.history.push({ status: decision, reason: note, by: req.admin.name });
    await sop.save();

    res.json({ sop });
  } catch (err) {
    next(err);
  }
};

export const deleteSop = async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return res.status(404).json({ message: 'SOP not found' });
    const sop = await Sop.findByIdAndDelete(req.params.id);
    if (!sop) return res.status(404).json({ message: 'SOP not found' });
    res.json({ message: 'SOP deleted' });
  } catch (err) {
    next(err);
  }
};
