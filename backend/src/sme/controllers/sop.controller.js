import mongoose from 'mongoose';
import Sop from '../../admin/models/Sop.js';

const validId = (id) => mongoose.Types.ObjectId.isValid(id);
const mine = (req) => ({ _id: req.params.id, submittedById: req.sme._id });

export const listMySops = async (req, res, next) => {
  try {
    const [sops, grouped] = await Promise.all([
      Sop.find({ submittedById: req.sme._id }).sort({ updatedAt: -1 }).limit(200),
      Sop.aggregate([
        { $match: { submittedById: req.sme._id } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ]);
    const counts = { pending: 0, approved: 0, rejected: 0, revision: 0 };
    grouped.forEach((g) => (counts[g._id] = g.count));
    res.json({ sops, counts });
  } catch (err) {
    next(err);
  }
};

export const createMySop = async (req, res, next) => {
  try {
    const { title, department, description, content } = req.body;
    if (!title?.trim() || !content?.trim()) {
      return res.status(400).json({ message: 'Title and SOP content are required' });
    }
    const sop = await Sop.create({
      title,
      department: department?.trim() || req.sme.department,
      description,
      content,
      submittedBy: req.sme.name,
      submittedById: req.sme._id,
      history: [{ status: 'pending', reason: 'Submitted for review', by: req.sme.name }],
    });
    res.status(201).json({ sop });
  } catch (err) {
    next(err);
  }
};

// Edit own SOP. If admin rejected it / asked for a redo, saving resubmits it.
export const updateMySop = async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return res.status(404).json({ message: 'SOP not found' });
    const sop = await Sop.findOne(mine(req));
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
      sop.history.push({ status: 'pending', reason: 'Resubmitted after changes', by: req.sme.name });
    }
    await sop.save();
    res.json({ sop });
  } catch (err) {
    next(err);
  }
};

// Withdraw: only while it is still waiting for review.
export const deleteMySop = async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return res.status(404).json({ message: 'SOP not found' });
    const sop = await Sop.findOne(mine(req));
    if (!sop) return res.status(404).json({ message: 'SOP not found' });
    if (sop.status !== 'pending') {
      return res.status(409).json({ message: 'Only SOPs waiting for review can be withdrawn' });
    }
    await sop.deleteOne();
    res.json({ message: 'SOP withdrawn' });
  } catch (err) {
    next(err);
  }
};
