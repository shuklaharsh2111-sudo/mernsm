import express from 'express';
import mongoose from 'mongoose';
import { protect } from '../auth.js';
import Company from '../company/Company.js';
import Sme from '../sme/Sme.js';
import Task from '../sme/Tasks.js';
import SmiSopAssignment from '../sop/SmiSopAssignment.js';
import Influencer, { INFLUENCER_PLATFORMS, INFLUENCER_STATUSES, tierFor } from './Influencer.js';

const view = (i) => ({
  id: i._id,
  name: i.name,
  handle: i.handle,
  platform: i.platform,
  profileUrl: i.profileUrl,
  niche: i.niche,
  followers: i.followers,
  tier: tierFor(i.followers),
  engagementRate: i.engagementRate,
  avgViews: i.avgViews,
  location: i.location,
  contact: i.contact,
  campaign: i.campaign,
  deliverables: i.deliverables,
  fee: i.fee,
  status: i.status,
  postDate: i.postDate,
  postLink: i.postLink,
  reach: i.reach,
  notes: i.notes,
  company: i.company ? { id: i.company._id, name: i.company.name } : null,
  createdAt: i.createdAt,
  updatedAt: i.updatedAt
});

// Companies this person can attach an influencer to.
// SME: the companies assigned to them. SMI: every company they have an SOP or task for.
const companyIdsFor = async (role, userId) => {
  if (role === 'sme') {
    const me = await Sme.findById(userId).select('companies').lean();
    return (me?.companies || []).map(String);
  }
  const [sops, tasks] = await Promise.all([
    SmiSopAssignment.find({ smi: userId }).select('company').lean(),
    Task.find({ assignedSmi: userId }).select('company').lean()
  ]);
  return [...new Set([...sops, ...tasks].map((x) => String(x.company)))];
};

const num = (v, { min = 0, max = Infinity } = {}) => {
  if (v === '' || v === null || v === undefined) return 0;
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) return NaN;
  return n;
};
const str = (v) => String(v ?? '').trim();

// Validates the request body into a clean document; returns { error } or { data }.
const parseBody = async (body, role, userId) => {
  const name = str(body.name);
  if (!name) return { error: 'Influencer name is required' };
  if (name.length > 80) return { error: 'Name is too long' };
  if (!INFLUENCER_PLATFORMS.includes(body.platform)) return { error: 'Choose a valid platform' };
  const status = body.status || 'shortlisted';
  if (!INFLUENCER_STATUSES.includes(status)) return { error: 'Choose a valid status' };

  const followers = num(body.followers);
  const engagementRate = num(body.engagementRate, { max: 100 });
  const avgViews = num(body.avgViews);
  const fee = num(body.fee);
  const reach = num(body.reach);
  if ([followers, engagementRate, avgViews, fee, reach].some(Number.isNaN)) {
    return { error: 'Numbers must be positive (engagement rate is 0 to 100)' };
  }
  const postDate = str(body.postDate);
  if (postDate && !/^\d{4}-\d{2}-\d{2}$/.test(postDate)) return { error: 'Invalid post date' };

  let company = null;
  if (body.companyId) {
    if (!mongoose.Types.ObjectId.isValid(body.companyId)) return { error: 'Invalid company' };
    const allowed = await companyIdsFor(role, userId);
    if (!allowed.includes(String(body.companyId))) return { error: 'That company is not assigned to you' };
    company = body.companyId;
  }

  return {
    data: {
      name,
      handle: str(body.handle).slice(0, 60),
      platform: body.platform,
      profileUrl: str(body.profileUrl).slice(0, 300),
      niche: str(body.niche).slice(0, 60),
      followers,
      engagementRate,
      avgViews,
      location: str(body.location).slice(0, 60),
      contact: str(body.contact).slice(0, 120),
      campaign: str(body.campaign).slice(0, 120),
      deliverables: str(body.deliverables).slice(0, 300),
      fee,
      status,
      postDate,
      postLink: str(body.postLink).slice(0, 300),
      reach,
      notes: str(body.notes).slice(0, 1000),
      company
    }
  };
};

// One router per role, so SMEs and SMIs each see only the influencers they added.
export const buildInfluencerRouter = (role) => {
  const router = express.Router();
  router.use(protect([role]));
  const scope = (req) => ({ owner: req.user.id, ownerRole: role });

  router.get('/', async (req, res) => {
    try {
      const list = await Influencer.find(scope(req)).sort({ createdAt: -1 }).limit(500).populate('company', 'name');
      res.json({ influencers: list.map(view) });
    } catch (error) {
      console.error(`${role} fetch influencers error:`, error);
      res.status(500).json({ message: 'Unable to fetch influencers' });
    }
  });

  router.get('/companies', async (req, res) => {
    try {
      const ids = await companyIdsFor(role, req.user.id);
      const found = await Company.find({ _id: { $in: ids } }).select('name').lean();
      res.json({ companies: found.map((c) => ({ id: String(c._id), name: c.name })) });
    } catch (error) {
      console.error(`${role} influencer companies error:`, error);
      res.status(500).json({ message: 'Unable to fetch companies' });
    }
  });

  router.post('/', async (req, res) => {
    try {
      const { error, data } = await parseBody(req.body || {}, role, req.user.id);
      if (error) return res.status(400).json({ message: error });
      const created = await Influencer.create({ ...data, ...scope(req) });
      const saved = await Influencer.findById(created._id).populate('company', 'name');
      res.status(201).json({ influencer: view(saved) });
    } catch (error) {
      console.error(`${role} create influencer error:`, error);
      res.status(500).json({ message: 'Unable to save influencer' });
    }
  });

  router.put('/:id', async (req, res) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ message: 'Invalid influencer' });
      const doc = await Influencer.findOne({ _id: req.params.id, ...scope(req) });
      if (!doc) return res.status(404).json({ message: 'Influencer not found' });
      const { error, data } = await parseBody(req.body || {}, role, req.user.id);
      if (error) return res.status(400).json({ message: error });
      doc.set(data);
      await doc.save();
      const saved = await Influencer.findById(doc._id).populate('company', 'name');
      res.json({ influencer: view(saved) });
    } catch (error) {
      console.error(`${role} update influencer error:`, error);
      res.status(500).json({ message: 'Unable to update influencer' });
    }
  });

  // Quick status change from the pipeline (no full form).
  router.patch('/:id/status', async (req, res) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ message: 'Invalid influencer' });
      if (!INFLUENCER_STATUSES.includes(req.body?.status)) return res.status(400).json({ message: 'Choose a valid status' });
      const doc = await Influencer.findOneAndUpdate(
        { _id: req.params.id, ...scope(req) },
        { status: req.body.status },
        { new: true }
      ).populate('company', 'name');
      if (!doc) return res.status(404).json({ message: 'Influencer not found' });
      res.json({ influencer: view(doc) });
    } catch (error) {
      console.error(`${role} influencer status error:`, error);
      res.status(500).json({ message: 'Unable to update status' });
    }
  });

  router.delete('/:id', async (req, res) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ message: 'Invalid influencer' });
      const removed = await Influencer.findOneAndDelete({ _id: req.params.id, ...scope(req) });
      if (!removed) return res.status(404).json({ message: 'Influencer not found' });
      res.json({ message: 'Influencer removed' });
    } catch (error) {
      console.error(`${role} delete influencer error:`, error);
      res.status(500).json({ message: 'Unable to remove influencer' });
    }
  });

  return router;
};
