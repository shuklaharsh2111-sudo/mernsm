import multer from 'multer';
import cloudinary from '../config/cloudinary.js';
import express from 'express';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { protect } from '../auth.js';
import Sme from './Sme.js';
import Company from '../company/Company.js';
import SopAssignment from '../sop/SopAssignment.js';
import Meeting from '../meeting/Meeting.js';
import { momView, buildMom, generateMeetingLink } from '../meeting/momHelpers.js';
import { periodKey, resolveToday } from '../sop/period.js';
import TaskAttachment from './TaskAttachment.js';
import Task from './Tasks.js';
import Creative, { CREATIVE_PLATFORMS, CREATIVE_STATUSES } from './Creative.js';
import SocialMetrics from './SocialMetrics.js';
import Admin from '../admin/Admin.js';
const taskImageUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, files: 5 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (allowedTypes.includes(file.mimetype)) return cb(null, true);
        cb(new Error('Only JPG, PNG and WEBP images are allowed.'));
    }
});
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
  fileFilter: (req, file, cb) => {
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimetype)) {
      return cb(new Error('Only JPG, PNG, WEBP and GIF images are allowed'));
    }
    cb(null, true);
  }
});
const uploadToCloudinary = (buffer, folder = 'creative-manager/tasks') => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({
      folder,
      resource_type: 'image'
    }, (error, result) => {
      if (error) return reject(error);
      resolve(result);
    });
    stream.end(buffer);
  });
};
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
// TASK MANAGER APIs
// GET: Logged-in SME ke saare tasks
router.get('/tasks', async (req, res) => {
  try {
    const tasks = await Task.find({
      user: req.user.id
    })
      .populate('company', 'name')
      .sort({ createdAt: -1 });
    res.json({ tasks });
  } catch (error) {
    console.error('Fetch Tasks Error:', error);
    res.status(500).json({
      message: 'Unable to fetch tasks'
    });
  }
});
// POST: Create a new task
router.post('/tasks', async (req, res) => {
  try {
    const {
      companyId,
      title,
      category,
      frequencyDays,
      tatDays,
      taskType,
      objective,
      customObjective,
      priority,
      brief,
      assignedTo
    } = req.body;
    // Required fields
    if (
      !companyId ||
      !title?.trim() ||
      !category ||
      !taskType ||
      !objective ||
      !priority
    ) {
      return res.status(400).json({
        message: 'Please fill all required fields'
      });
    }
    // Validate company ID
    if (!mongoose.Types.ObjectId.isValid(companyId)) {
      return res.status(400).json({
        message: 'Invalid company selected'
      });
    }
    // Verify logged-in SME
    const me = await Sme.findById(req.user.id);
    if (!me) {
      return res.status(401).json({
        message: 'SME account not found'
      });
    }
    // Check whether company is assigned to this SME
    const isAssigned = (me.companies || []).some(
      (id) => String(id) === String(companyId)
    );
    if (!isAssigned) {
      return res.status(403).json({
        message: 'You are not assigned to this company'
      });
    }
    // Validate category
    if (!['one-time', 'recurring'].includes(category)) {
      return res.status(400).json({
        message: 'Invalid task category'
      });
    }
    // Validate frequency
    let selectedFrequency = null;
    if (category === 'recurring') {
      selectedFrequency = Number(frequencyDays);
      if (![7, 15, 30].includes(selectedFrequency)) {
        return res.status(400).json({
          message: 'Select a valid recurring frequency'
        });
      }
    }
    // Validate TAT (required for recurring tasks only)
    let selectedTat = null;
    if (category === 'recurring') {
      selectedTat = Number(tatDays);
      if (
        !Number.isInteger(selectedTat) ||
        selectedTat < 1 ||
        selectedTat > 3650
      ) {
        return res.status(400).json({
          message: 'TAT must be a valid number of days'
        });
      }
    }
    // Validate task type
    const allowedTaskTypes = [
      'Strategy/Pitch Deck',
      'Mood Board',
      'Shoots',
      'Content Planning',
      'Content Writing',
      'Influencer Collaboration'
    ];
    if (!allowedTaskTypes.includes(taskType)) {
      return res.status(400).json({
        message: 'Invalid task type'
      });
    }
    // Validate objective
    const allowedObjectives = [
      'Brand Awareness',
      'Lead Generation',
      'Brand Positioning',
      'Others'
    ];
    if (!allowedObjectives.includes(objective)) {
      return res.status(400).json({
        message: 'Invalid objective'
      });
    }
    if (
      objective === 'Others' &&
      !customObjective?.trim()
    ) {
      return res.status(400).json({
        message: 'Please enter your custom objective'
      });
    }
    // Validate priority
    if (!['High', 'Low', 'Critical'].includes(priority)) {
      return res.status(400).json({
        message: 'Invalid priority'
      });
    }
    // Validate assignee (optional)
    const selectedAssignee = assignedTo || '';
    if (!['', 'Admin', 'SME', 'SMI', 'Designer'].includes(selectedAssignee)) {
      return res.status(400).json({
        message: 'Invalid assignee'
      });
    }
    const cleanBrief = typeof brief === 'string' ? brief.trim() : '';
    if (cleanBrief.length > 1000) {
      return res.status(400).json({
        message: 'Brief must be 1000 characters or less'
      });
    }
    // Create task
    const task = await Task.create({
      user: req.user.id,
      company: companyId,
      title: title.trim(),
      category,
      frequencyDays: selectedFrequency,
      tatDays: selectedTat,
      taskType,
      objective,
      customObjective: objective === 'Others' ? customObjective.trim() : '',
      priority,
      brief: cleanBrief,
      dueDate: req.body.dueDate || null,
      assignedTo: selectedAssignee,
      status: 'new'
    });
    await task.populate('company', 'name');
    return res.status(201).json({
      message: 'Task created successfully',
      task
    });
  } catch (error) {
    console.error('Create Task Error:', error);
    res.status(500).json({
      message: 'Unable to create task'
    });
  }
});
// Start task
router.patch('/tasks/:id/start', async (req, res) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, user: req.user.id, status: 'new' });
    if (!task) return res.status(404).json({ message: 'Task not found or already started' });
    task.status = 'in-progress';
    task.startedAt = new Date();
    await task.save();
    const updatedTask = await Task.findById(task._id).populate('company', 'name');
    res.json({ message: 'Task started successfully', task: updatedTask });
  } catch (error) {
    console.error('Start task error:', error);
    res.status(500).json({ message: 'Unable to start task' });
  }
});
// End task
router.patch('/tasks/:id/end', async (req, res) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, user: req.user.id, status: 'in-progress' });
    if (!task) return res.status(404).json({ message: 'Task not found or not in progress' });
    task.status = 'completed';
    task.endedAt = new Date();
    await task.save();
    const updatedTask = await Task.findById(task._id).populate('company', 'name');
    res.json({ message: 'Task completed successfully', task: updatedTask });
  } catch (error) {
    console.error('End task error:', error);
    res.status(500).json({ message: 'Unable to complete task' });
  }
});
// Upload task images to Cloudinary
router.post('/tasks/:id/attachments', (req, res) => {
  upload.array('files', 5)(req, res, async (uploadError) => {
    if (uploadError) {
      return res.status(400).json({ message: uploadError.message });
    }
    const uploadedImages = [];
    try {
      const files = req.files || [];
      if (!files.length) {
        return res.status(400).json({ message: 'Please select at least one image' });
      }
      const task = await Task.findOne({
        _id: req.params.id,
        user: req.user.id
      });
      if (!task) {
        return res.status(404).json({ message: 'Task not found' });
      }
      for (const file of files) {
        const result = await uploadToCloudinary(file.buffer);
        uploadedImages.push({
          url: result.secure_url,
          publicId: result.public_id,
          originalName: file.originalname,
          uploadedAt: new Date()
        });
      }
      task.attachments.push(...uploadedImages);
      await task.save();
      const updatedTask = await Task.findById(task._id).populate('company', 'name');
      return res.json({
        message: 'Images uploaded successfully',
        task: updatedTask
      });
    } catch (error) {
      await Promise.all(
        uploadedImages.map((image) =>
          cloudinary.uploader.destroy(image.publicId).catch(() => null)
        )
      );
      console.error('Task attachment error:', error);
      return res.status(500).json({ message: 'Unable to upload images' });
    }
  });
});
// =========================================
// CALENDAR: REFERENCE CREATIVES
// =========================================
const creativeView = (c) => ({
  id: c._id,
  companyId: String(c.company?._id || c.company),
  companyName: c.company?.name || '',
  status: c.status,
  reviewNote: c.reviewNote || '',
  reviewedAt: c.reviewedAt,
  createdAt: c.createdAt,
  rejectionCount: c.rejectionCount || 0,
  date: c.date,
  referenceLinks: c.referenceLinks || [],
  uploads: (c.uploads || []).map((u) => ({ url: u.url, name: u.originalName })),
  contentPillar: {
    title: c.contentPillar?.title || '',
    caption: c.contentPillar?.caption || '',
    hashtags: c.contentPillar?.hashtags || [],
    keywords: c.contentPillar?.keywords || [],
    platforms: c.contentPillar?.platforms || [],
  },
});
// My creatives. Optional ?company=<id> and ?status=pending|approved|rejected (default: all).
// The calendar asks for status=approved: a creative only lands there once the admin approves it.
router.get('/creatives', async (req, res) => {
  try {
    const filter = { user: req.user.id };
    if (req.query.company) {
      if (!mongoose.Types.ObjectId.isValid(req.query.company)) return res.status(400).json({ message: 'Invalid company' });
      filter.company = req.query.company;
    }
    if (req.query.status && req.query.status !== 'all') {
      if (!CREATIVE_STATUSES.includes(req.query.status)) return res.status(400).json({ message: 'Invalid status' });
      filter.status = req.query.status;
    }
    const list = await Creative.find(filter).sort({ date: 1, createdAt: 1 }).limit(1000).populate('company', 'name');
    res.json({ creatives: list.map(creativeView) });
  } catch (error) {
    console.error('Fetch creatives error:', error);
    res.status(500).json({ message: 'Unable to fetch creatives' });
  }
});
// list fields arrive as JSON arrays inside multipart/form-data
const parseList = (v) => {
  if (typeof v === 'string') {
    try { v = JSON.parse(v); } catch { v = [v]; }
  }
  return Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : [];
};
// Shared by "save" and "edit again": check and clean the text fields of a creative.
// Returns { error } or { fields }.
const readCreativeFields = (body) => {
  const { title = '', caption = '' } = body;
  const platforms = [...new Set(parseList(body.platforms))];
  const hashtags = [...new Set(parseList(body.hashtags).map((h) => (h.startsWith('#') ? h : `#${h}`)))];
  const keywords = [...new Set(parseList(body.keywords))];
  const referenceLinks = parseList(body.referenceLinks);
  if (!title.trim()) return { error: 'Content pillar title is required' };
  if (!platforms.length || platforms.some((p) => !CREATIVE_PLATFORMS.includes(p))) return { error: 'Select at least one valid platform' };
  if (caption.length > 2200) return { error: 'Caption is too long (max 2200 characters)' };
  if (hashtags.length > 30 || hashtags.some((h) => h.length > 60 || /\s/.test(h))) return { error: 'Use up to 30 hashtags without spaces' };
  if (keywords.length > 20 || keywords.some((k) => k.length > 60)) return { error: 'Use up to 20 keywords (60 characters each)' };
  if (referenceLinks.length > 5 || referenceLinks.some((l) => !/^https?:\/\/\S+\.\S+$/i.test(l))) {
    return { error: 'Add up to 5 valid links starting with http:// or https://' };
  }
  return { fields: { title: title.trim(), caption: caption.trim(), hashtags, keywords, platforms, referenceLinks } };
};
// Save a creative. It starts as 'pending' and waits for the admin. multipart/form-data: companyId, date, title, caption,
// hashtags / keywords / referenceLinks / platforms (each a JSON array), files (reference images, max 5).
router.post('/creatives', (req, res) => {
  upload.array('files', 5)(req, res, async (uploadError) => {
    if (uploadError) return res.status(400).json({ message: uploadError.message });
    const uploaded = [];
    try {
      const { companyId, date } = req.body;
      if (!mongoose.Types.ObjectId.isValid(companyId)) return res.status(400).json({ message: 'Please select a brand' });
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return res.status(400).json({ message: 'Invalid date' });
      const { error, fields } = readCreativeFields(req.body);
      if (error) return res.status(400).json({ message: error });
      // the brand must be one assigned to this SME
      const me = await Sme.findById(req.user.id);
      if (!me) return res.status(401).json({ message: 'User not found' });
      if (!(me.companies || []).map(String).includes(String(companyId))) {
        return res.status(403).json({ message: 'This brand is not assigned to you' });
      }
      for (const file of req.files || []) {
        const result = await uploadToCloudinary(file.buffer, 'creative-manager/creatives');
        uploaded.push({ url: result.secure_url, publicId: result.public_id, originalName: file.originalname });
      }
      const creative = await Creative.create({
        user: req.user.id,
        company: companyId,
        date,
        status: 'pending',
        referenceLinks: fields.referenceLinks,
        uploads: uploaded,
        contentPillar: { title: fields.title, caption: fields.caption, hashtags: fields.hashtags, keywords: fields.keywords, platforms: fields.platforms },
      });
      res.status(201).json({ creative: creativeView(creative), message: 'Sent to the admin for approval' });
    } catch (error) {
      await Promise.all(uploaded.map((u) => cloudinary.uploader.destroy(u.publicId).catch(() => null)));
      console.error('Save creative error:', error);
      res.status(500).json({ message: 'Unable to save creative' });
    }
  });
});
// Edit the SAME creative again after the admin asked for a redo (status 'rejected'), then send it back for approval.
// multipart/form-data like the save route, plus keepUploads: JSON array of the image urls to keep (new images go in `files`).
router.put('/creatives/:id', (req, res) => {
  upload.array('files', 5)(req, res, async (uploadError) => {
    if (uploadError) return res.status(400).json({ message: uploadError.message });
    const uploaded = [];
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ message: 'Invalid id' });
      const creative = await Creative.findOne({ _id: req.params.id, user: req.user.id });
      if (!creative) return res.status(404).json({ message: 'Creative not found' });
      if (creative.status !== 'rejected') {
        return res.status(409).json({ message: 'Only a creative the admin asked to redo can be edited' });
      }
      const { error, fields } = readCreativeFields(req.body);
      if (error) return res.status(400).json({ message: error });
      // images: keep the ones still listed, add the new ones (max 5 in total)
      const keepUrls = parseList(req.body.keepUploads);
      const kept = creative.uploads.filter((u) => keepUrls.includes(u.url));
      const removed = creative.uploads.filter((u) => !keepUrls.includes(u.url));
      if (kept.length + (req.files || []).length > 5) return res.status(400).json({ message: 'You can have up to 5 images' });
      for (const file of req.files || []) {
        const result = await uploadToCloudinary(file.buffer, 'creative-manager/creatives');
        uploaded.push({ url: result.secure_url, publicId: result.public_id, originalName: file.originalname });
      }
      creative.uploads = [...kept, ...uploaded];
      creative.referenceLinks = fields.referenceLinks;
      creative.contentPillar = { title: fields.title, caption: fields.caption, hashtags: fields.hashtags, keywords: fields.keywords, platforms: fields.platforms };
      // back to the admin
      creative.status = 'pending';
      creative.reviewNote = '';
      creative.reviewedAt = null;
      await creative.save();
      await Promise.all(removed.map((u) => u.publicId && cloudinary.uploader.destroy(u.publicId).catch(() => null)));
      res.json({ creative: creativeView(creative), message: 'Sent back to the admin for approval' });
    } catch (error) {
      await Promise.all(uploaded.map((u) => cloudinary.uploader.destroy(u.publicId).catch(() => null)));
      console.error('Edit creative error:', error);
      res.status(500).json({ message: 'Unable to update creative' });
    }
  });
});
router.delete('/creatives/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ message: 'Invalid id' });
    const c = await Creative.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!c) return res.status(404).json({ message: 'Creative not found' });
    await Promise.all((c.uploads || []).map((u) => u.publicId && cloudinary.uploader.destroy(u.publicId).catch(() => null)));
    res.json({ ok: true });
  } catch (error) {
    console.error('Delete creative error:', error);
    res.status(500).json({ message: 'Unable to delete creative' });
  }
});
// =========================================
// COMPANY HEALTH
// =========================================
// Health rules (any ONE matching number puts the company in that level; the worst level wins).
//   healthy  = no delays, redo, rejections or overdue at all
//   risk     = 2 delays, 4 redo, 2 rejections or 2 overdue
//   critical = 3 delays, 5 redo, 3 rejections or 3 overdue
// Any other problem (below the risk numbers) is still not healthy, so it counts as risk.
const HEALTH_RULES = {
  risk: { delays: 2, redo: 4, rejected: 2, overdue: 2 },
  critical: { delays: 3, redo: 5, rejected: 3, overdue: 3 },
};
const healthOf = (m) => {
  const hit = (rule) =>
    m.delays >= rule.delays || m.redo >= rule.redo || m.rejected >= rule.rejected || m.overdue >= rule.overdue;
  if (hit(HEALTH_RULES.critical)) return 'critical';
  if (hit(HEALTH_RULES.risk)) return 'risk';
  if (m.delays || m.redo || m.rejected || m.overdue) return 'risk';
  return 'healthy';
};
// Per assigned company: total, approved, pending, redo (waiting for the SME to redo), rejected (times the admin
// rejected, even if fixed since), delays (sent for approval after its planned date) and overdue (planned date
// passed and not approved yet).
router.get('/company-health', async (req, res) => {
  try {
    const me = await Sme.findById(req.user.id);
    if (!me) return res.status(401).json({ message: 'User not found' });
    const ids = (me.companies || []).map(String);
    const found = await Company.find({ _id: { $in: ids } });
    const byId = Object.fromEntries(found.map((c) => [String(c._id), c]));
    const today = resolveToday(req.query.today);
    const creatives = await Creative.find({ user: req.user.id, company: { $in: ids } })
      .select('company date status createdAt rejectionCount')
      .lean();
    const stats = {};
    ids.forEach((id) => {
      stats[id] = { total: 0, approved: 0, pending: 0, redo: 0, rejected: 0, delays: 0, overdue: 0 };
    });
    for (const c of creatives) {
      const m = stats[String(c.company)];
      if (!m) continue;
      m.total += 1;
      if (c.status === 'approved') m.approved += 1;
      else if (c.status === 'pending') m.pending += 1;
      else if (c.status === 'rejected') m.redo += 1;
      // old rejected creatives were saved before the counter existed, so count them at least once
      m.rejected += Math.max(c.rejectionCount || 0, c.status === 'rejected' ? 1 : 0);
      if (c.createdAt && c.createdAt.toISOString().slice(0, 10) > c.date) m.delays += 1;
      if (c.status !== 'approved' && c.date < today) m.overdue += 1;
    }
    const companies = ids
      .filter((id) => byId[id])
      .map((id) => {
        const m = stats[id];
        return {
          id,
          name: byId[id].name,
          ...m,
          approvalRate: m.total ? Math.round((m.approved / m.total) * 100) : 0,
          health: healthOf(m),
        };
      });
    res.json({ companies, rules: HEALTH_RULES });
  } catch (error) {
    console.error('Company health error:', error);
    res.status(500).json({ message: 'Unable to load company health' });
  }
});
// =========================================
// MONTHLY SOCIAL METRICS (typed in by the SME from platform insights)
// =========================================
const NUM_FIELDS = [
  'followersStart', 'newFollowers', 'unfollowers', 'followersEnd',
  'accountsReached', 'accountsEngaged', 'views', 'profileVisits', 'websiteVisits',
  'posts', 'reels', 'stories',
  'ovPrevFollowers', 'ovPrevReach', 'ovPrevEngagement', 'ovEarlierFollowers', 'ovEarlierReach', 'ovEarlierEngagement',
];
const MONTH_RE = /^\d{4}-\d{2}$/;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const prevMonthOf = (m) => {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(y, mo - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const metricsView = (d) => {
  if (!d) return null;
  const o = d.toObject ? d.toObject() : d;
  return {
    id: o._id,
    company: String(o.company),
    month: o.month,
    platform: o.platform,
    periodFrom: o.periodFrom || '',
    periodTo: o.periodTo || '',
    ...Object.fromEntries(NUM_FIELDS.map((f) => [f, o[f] ?? null])),
    nonFollowerInteractionPct: o.nonFollowerInteractionPct ?? null,
    paidPromotion: !!o.paidPromotion,
    paidNote: o.paidNote || '',
    bestContent: o.bestContent || [],
    keyInsights: o.keyInsights || [],
    improvements: o.improvements || [],
    summaryNote: o.summaryNote || '',
    updatedAt: o.updatedAt,
  };
};
const cleanNum = (v) => {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(String(v).replace(/,/g, ''));
  if (!Number.isFinite(n) || n < 0) throw new Error('Numbers must be 0 or more');
  return Math.round(n);
};
const cleanLines = (arr) =>
  (Array.isArray(arr) ? arr : []).map((t) => String(t || '').trim()).filter(Boolean).slice(0, 10);
// GET /social-metrics?company=<id>&month=YYYY-MM  ->  { current, previous, earlier }
// "previous" is the month before, "earlier" the one before that (for the 3-month overview).
router.get('/social-metrics', async (req, res) => {
  try {
    const { company, month } = req.query;
    if (!mongoose.isValidObjectId(company)) return res.status(400).json({ message: 'Choose a company' });
    if (!MONTH_RE.test(String(month || ''))) return res.status(400).json({ message: 'Invalid month' });
    const me = await Sme.findById(req.user.id);
    if (!me || !(me.companies || []).map(String).includes(String(company))) {
      return res.status(403).json({ message: 'This company is not assigned to you' });
    }
    const m1 = prevMonthOf(month);
    const m2 = prevMonthOf(m1);
    const docs = await SocialMetrics.find({ user: req.user.id, company, month: { $in: [month, m1, m2] } });
    const by = Object.fromEntries(docs.map((d) => [d.month, d]));
    // Content output = the creatives the admin approved for this company, counted per month and platform.
    const approved = await Creative.find({
      user: req.user.id,
      company,
      status: 'approved',
      date: { $gte: `${m2}-01`, $lt: `${monthAfter(month)}-01` },
    })
      .select('date contentPillar.platforms')
      .lean();
    const output = { [month]: { total: 0, platforms: {} }, [m1]: { total: 0, platforms: {} }, [m2]: { total: 0, platforms: {} } };
    for (const c of approved) {
      const o = output[c.date.slice(0, 7)];
      if (!o) continue;
      o.total += 1;
      for (const pf of c.contentPillar?.platforms || []) o.platforms[pf] = (o.platforms[pf] || 0) + 1;
    }
    res.json({
      current: metricsView(by[month]),
      previous: metricsView(by[m1]),
      earlier: metricsView(by[m2]),
      output,
    });
  } catch (error) {
    console.error('Social metrics load error:', error);
    res.status(500).json({ message: 'Unable to load social metrics' });
  }
});
// PUT /social-metrics  { company, month, ...fields }  -> creates or updates that month
router.put('/social-metrics', async (req, res) => {
  try {
    const b = req.body || {};
    if (!mongoose.isValidObjectId(b.company)) return res.status(400).json({ message: 'Choose a company' });
    if (!MONTH_RE.test(String(b.month || ''))) return res.status(400).json({ message: 'Invalid month' });
    const me = await Sme.findById(req.user.id);
    if (!me || !(me.companies || []).map(String).includes(String(b.company))) {
      return res.status(403).json({ message: 'This company is not assigned to you' });
    }
    const set = {
      platform: String(b.platform || 'Instagram').trim().slice(0, 30) || 'Instagram',
      periodFrom: DAY_RE.test(b.periodFrom || '') ? b.periodFrom : '',
      periodTo: DAY_RE.test(b.periodTo || '') ? b.periodTo : '',
      paidPromotion: !!b.paidPromotion,
      paidNote: String(b.paidNote || '').trim().slice(0, 400),
      summaryNote: String(b.summaryNote || '').trim().slice(0, 1000),
      keyInsights: cleanLines(b.keyInsights),
      improvements: cleanLines(b.improvements),
    };
    for (const f of NUM_FIELDS) set[f] = cleanNum(b[f]);
    const pctRaw = cleanNum(b.nonFollowerInteractionPct);
    if (pctRaw !== null && pctRaw > 100) return res.status(400).json({ message: 'Percentage cannot be above 100' });
    set.nonFollowerInteractionPct = pctRaw;
    if (set.periodFrom && set.periodTo && set.periodFrom > set.periodTo) {
      return res.status(400).json({ message: 'Period start must be before the end' });
    }
    set.bestContent = (Array.isArray(b.bestContent) ? b.bestContent : [])
      .map((x) => ({
        title: String(x?.title || '').trim().slice(0, 150),
        note: String(x?.note || '').trim().slice(0, 400),
        views: cleanNum(x?.views),
        boosted: !!x?.boosted,
      }))
      .filter((x) => x.title)
      .slice(0, 5);
    const doc = await SocialMetrics.findOneAndUpdate(
      { user: req.user.id, company: b.company, month: b.month },
      { $set: set },
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
    );
    res.json({ metrics: metricsView(doc) });
  } catch (error) {
    if (error.message === 'Numbers must be 0 or more') return res.status(400).json({ message: error.message });
    console.error('Social metrics save error:', error);
    res.status(500).json({ message: 'Unable to save social metrics' });
  }
});
// =========================================
// MONTHLY PERFORMANCE REPORT (read-only, calculated from the database)
// =========================================
// Same data the old PHP monthly report showed: creative stats with last-month comparison, company-wise and
// platform-wise results, SOP schedule + ticks, meetings, every creative of the month and the health of each company.
const monthAfter = (m) => {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(y, mo, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const blankStats = () => ({ total: 0, approved: 0, pending: 0, redo: 0, rejected: 0, delays: 0, overdue: 0 });
const isDelayed = (c) => !!c.createdAt && c.createdAt.toISOString().slice(0, 10) > c.date;
// same counting rules as /company-health
const addToStats = (m, c, today) => {
  m.total += 1;
  if (c.status === 'approved') m.approved += 1;
  else if (c.status === 'pending') m.pending += 1;
  else if (c.status === 'rejected') m.redo += 1;
  m.rejected += Math.max(c.rejectionCount || 0, c.status === 'rejected' ? 1 : 0);
  if (isDelayed(c)) m.delays += 1;
  if (c.status !== 'approved' && c.date < today) m.overdue += 1;
};
const withHealth = (m) => ({ ...m, health: m.total ? healthOf(m) : 'nodata' });
const pctOf = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);
// GET /monthly-report?month=YYYY-MM&today=YYYY-MM-DD
router.get('/monthly-report', async (req, res) => {
  try {
    const today = resolveToday(req.query.today);
    const month = MONTH_RE.test(String(req.query.month || '')) ? req.query.month : today.slice(0, 7);
    const prevMonth = prevMonthOf(month);
    const start = `${month}-01`;
    const end = `${monthAfter(month)}-01`;
    const prevStart = `${prevMonth}-01`;
    const me = await Sme.findById(req.user.id);
    if (!me) return res.status(401).json({ message: 'User not found' });
    const ids = (me.companies || []).map(String);
    const found = await Company.find({ _id: { $in: ids } });
    const byId = Object.fromEntries(found.map((c) => [String(c._id), c]));
    const companyIds = ids.filter((id) => byId[id]);
    // Reporting manager (the admin the SME reports to)
    let manager = '';
    if (me.reportingManagerId) {
      const adm = await Admin.findById(me.reportingManagerId).select('name fullname email').lean();
      manager = adm?.name || adm?.fullname || adm?.email || '';
    }
    // ---- creatives: this month + previous month
    const [creatives, prevCreatives] = await Promise.all([
      Creative.find({ user: req.user.id, company: { $in: companyIds }, date: { $gte: start, $lt: end } })
        .sort({ date: 1, createdAt: 1 })
        .lean(),
      Creative.find({ user: req.user.id, company: { $in: companyIds }, date: { $gte: prevStart, $lt: start } })
        .select('company date status createdAt rejectionCount')
        .lean(),
    ]);
    const stats = blankStats();
    const previousStats = blankStats();
    const perCompany = Object.fromEntries(companyIds.map((id) => [id, blankStats()]));
    const perPlatform = {};
    for (const c of creatives) {
      addToStats(stats, c, today);
      const m = perCompany[String(c.company)];
      if (m) addToStats(m, c, today);
      // one creative can go to several platforms, so it counts once for each
      for (const p of c.contentPillar?.platforms || []) {
        perPlatform[p] = perPlatform[p] || blankStats();
        addToStats(perPlatform[p], c, today);
      }
    }
    for (const c of prevCreatives) addToStats(previousStats, c, today);
    const companyReports = companyIds
      .map((id) => ({ id, name: byId[id].name, ...withHealth(perCompany[id]), approvalRate: pctOf(perCompany[id].approved, perCompany[id].total) }))
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
    const platformReports = Object.entries(perPlatform)
      .map(([platform, m]) => ({ platform, ...m }))
      .sort((a, b) => b.total - a.total || a.platform.localeCompare(b.platform));
    const creativeList = creatives.slice(0, 300).map((c) => ({
      id: c._id,
      date: c.date,
      title: c.contentPillar?.title || '',
      company: byId[String(c.company)]?.name || 'Removed company',
      platforms: c.contentPillar?.platforms || [],
      status: c.status,
      delayed: isDelayed(c),
      overdue: c.status !== 'approved' && c.date < today,
      remark: c.status === 'rejected' ? c.reviewNote || '' : '',
    }));
    // ---- SOPs: scheduled (start date inside the month) + ticks saved during the month
    const sops = await SopAssignment.find({ user: req.user.id, company: { $in: companyIds } })
      .select('type date completions')
      .lean();
    const monthStartAt = new Date(`${start}T00:00:00+05:30`);
    const monthEndAt = new Date(`${end}T00:00:00+05:30`);
    const sopStats = { total: 0, daily: 0, weekly: 0, monthly: 0, ticks: 0 };
    for (const sp of sops) {
      if (sp.date >= start && sp.date < end) {
        sopStats.total += 1;
        if (sopStats[sp.type] !== undefined) sopStats[sp.type] += 1;
      }
      sopStats.ticks += (sp.completions || []).filter((c) => c.at >= monthStartAt && c.at < monthEndAt).length;
    }
    // ---- meetings of the month (done = the SME joined it)
    const meetings = await Meeting.find({ user: req.user.id, company: { $in: companyIds }, date: { $gte: start, $lt: end } })
      .sort({ date: 1, time: 1 })
      .limit(200)
      .lean();
    const meetingStats = { total: 0, done: 0, notDone: 0 };
    const perMeetingCompany = Object.fromEntries(companyIds.map((id) => [id, { total: 0, done: 0, notDone: 0 }]));
    for (const m of meetings) {
      const done = !!m.joinedAt;
      meetingStats.total += 1;
      meetingStats[done ? 'done' : 'notDone'] += 1;
      const pc = perMeetingCompany[String(m.company)];
      if (pc) {
        pc.total += 1;
        pc[done ? 'done' : 'notDone'] += 1;
      }
    }
    const meetingReports = companyIds
      .map((id) => ({ name: byId[id].name, ...perMeetingCompany[id] }))
      .sort((a, b) => a.name.localeCompare(b.name));
    const meetingList = meetings.map((m) => ({
      id: m._id,
      date: m.date,
      time: m.time,
      company: byId[String(m.company)]?.name || 'Removed company',
      subject: m.subject,
      done: !!m.joinedAt,
      momStatus: m.mom?.status || 'not_sent',
    }));
    res.json({
      month,
      previousMonth: prevMonth,
      periodFrom: start,
      periodTo: new Date(new Date(`${end}T00:00:00Z`) - 86400000).toISOString().slice(0, 10),
      sme: {
        name: me.name || me.fullname || me.email || '',
        email: me.email || '',
        position: 'Social Media Executive (SME)',
        department: 'Social Media',
        manager,
      },
      companyCount: companyIds.length,
      overallHealth: stats.total ? healthOf(stats) : 'nodata',
      stats,
      previousStats,
      approvalRate: pctOf(stats.approved, stats.total),
      previousApprovalRate: pctOf(previousStats.approved, previousStats.total),
      creativeChange: previousStats.total ? Math.round(((stats.total - previousStats.total) / previousStats.total) * 1000) / 10 : null,
      companyReports,
      platformReports,
      creatives: creativeList,
      sopStats,
      meetingStats,
      meetingReports,
      meetingList,
    });
  } catch (error) {
    console.error('Monthly report error:', error);
    res.status(500).json({ message: 'Unable to generate the monthly report' });
  }
});
// =========================================
// SETTINGS: PROFILE + PASSWORD
// =========================================
const profileView = (u) => ({
  id: u._id,
  name: u.name || u.fullname || u.email,
  email: u.email,
  avatar: u.avatar || u.profileImage || '',
  role: 'sme'
});
router.get('/profile', async (req, res) => {
  try {
    const me = await Sme.findById(req.user.id);
    if (!me) return res.status(401).json({ message: 'User not found' });
    res.json({ user: profileView(me) });
  } catch (error) {
    console.error('Fetch profile error:', error);
    res.status(500).json({ message: 'Unable to load profile' });
  }
});
// Change name and/or profile image. multipart/form-data: name, avatar (file), removeAvatar ('true' to delete it).
router.put('/profile', (req, res) => {
  upload.single('avatar')(req, res, async (uploadError) => {
    if (uploadError) return res.status(400).json({ message: uploadError.message });
    let uploaded = null;
    try {
      // plain (lean) read + plain write: old records may hold badly stored dates that make Mongoose documents fail
      const me = await Sme.findById(req.user.id).lean();
      if (!me) return res.status(401).json({ message: 'User not found' });
      const changes = {};
      if (req.body.name !== undefined) {
        const name = String(req.body.name).trim();
        if (name.length < 2 || name.length > 60) {
          return res.status(400).json({ message: 'Name must be 2 to 60 characters' });
        }
        changes.name = name;
      }
      const oldPublicId = me.avatarPublicId || '';
      let replaced = false;
      if (req.file) {
        const result = await uploadToCloudinary(req.file.buffer, 'creative-manager/avatars');
        uploaded = result;
        changes.avatar = result.secure_url;
        changes.profileImage = result.secure_url;
        changes.avatarPublicId = result.public_id;
        replaced = true;
      } else if (req.body.removeAvatar === 'true') {
        changes.avatar = '';
        changes.profileImage = '';
        changes.avatarPublicId = '';
        replaced = true;
      }
      if (Object.keys(changes).length) {
        await Sme.collection.updateOne({ _id: me._id }, { $set: changes });
      }
      if (replaced && oldPublicId) cloudinary.uploader.destroy(oldPublicId).catch(() => null);
      res.json({ user: profileView({ ...me, ...changes }), message: 'Profile updated' });
    } catch (error) {
      if (uploaded) cloudinary.uploader.destroy(uploaded.public_id).catch(() => null);
      console.error('Update profile error:', error);
      res.status(500).json({ message: 'Unable to update profile' });
    }
  });
});
router.put('/password', async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Enter your current and new password' });
    }
    if (typeof newPassword !== 'string' || newPassword.length < 8 || newPassword.length > 72) {
      return res.status(400).json({ message: 'New password must be 8 to 72 characters' });
    }
    const me = await Sme.findById(req.user.id).select('+password').lean();
    if (!me || !me.password) return res.status(401).json({ message: 'User not found' });
    if (!(await bcrypt.compare(currentPassword, me.password))) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }
    if (await bcrypt.compare(newPassword, me.password)) {
      return res.status(400).json({ message: 'New password must be different from the current one' });
    }
    const hashed = await bcrypt.hash(newPassword, 10);
    // write straight to MongoDB so nothing else on the record is validated or touched
    await Sme.collection.updateOne({ _id: me._id }, { $set: { password: hashed } });
    res.json({ message: 'Password changed' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Unable to change password' });
  }
});
const meetingView = (m) => ({
  id: m._id,
  subject: m.subject,
  date: m.date,
  time: m.time,
  link: m.link || '',
  joined: Boolean(m.joinedAt),
  priority: m.priority || '',
  fromMom: Boolean(m.fromMeeting),
  attendees: (m.attendees || []).map((a) => ({ name: a.name, designation: a.designation || '' })),
  company: m.company ? { id: m.company._id, name: m.company.name } : { id: '', name: 'Removed company' },
  mom: momView(m.mom),
});
// My meetings, soonest first.
router.get('/meetings', async (req, res) => {
  const list = await Meeting.find({ user: req.user.id }).sort({ date: 1, time: 1 }).limit(300).populate('company', 'name');
  res.json({ meetings: list.map(meetingView) });
});
// Create a meeting: { subject, company, date, time, link?, attendees: [{ name, designation }] }
router.post('/meetings', async (req, res) => {
  const { subject, company, date, time, link } = req.body || {};
  const subj = String(subject || '').trim();
  if (subj.length < 3) return res.status(400).json({ message: 'Subject must be at least 3 characters' });
  if (!mongoose.Types.ObjectId.isValid(company)) return res.status(400).json({ message: 'Select a company' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return res.status(400).json({ message: 'Date is required' });
  if (!/^\d{2}:\d{2}$/.test(time || '')) return res.status(400).json({ message: 'Time is required' });
  // The company must be one the admin assigned to me.
  const me = await Sme.findById(req.user.id);
  if (!me) return res.status(401).json({ message: 'User not found' });
  if (!(me.companies || []).map(String).includes(String(company))) {
    return res.status(400).json({ message: 'That company is not assigned to you' });
  }
  const cleanLink = String(link || '').trim();
  if (cleanLink && !/^https?:\/\/\S+$/i.test(cleanLink)) {
    return res.status(400).json({ message: 'Meeting link must start with http:// or https://' });
  }
  const rawAttendees = Array.isArray(req.body.attendees) ? req.body.attendees.slice(0, 50) : [];
  const attendees = rawAttendees.map((a) => ({
    name: String(a?.name || '').trim(),
    designation: String(a?.designation || '').trim(),
  }));
  if (attendees.length === 0) return res.status(400).json({ message: 'Add at least one attendee' });
  if (attendees.some((a) => !a.name || !a.designation)) {
    return res.status(400).json({ message: 'Every attendee needs a name and a designation' });
  }
  const created = await Meeting.create({ user: req.user.id, company, subject: subj, date, time, link: cleanLink || generateMeetingLink(subj), attendees });
  await created.populate('company', 'name');
  res.status(201).json({ meeting: meetingView(created) });
});
// Add more attendees to a meeting: { attendees: [{ name, designation }] } (appended to the existing ones).
// Locked once a MOM exists, because the MOM's attendance list is built from the attendees.
router.put('/meetings/:id/attendees', async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ message: 'Invalid meeting' });
  const meeting = await Meeting.findOne({ _id: req.params.id, user: req.user.id }).populate('company', 'name');
  if (!meeting) return res.status(404).json({ message: 'Meeting not found' });
  if (meeting.mom?.submittedAt) {
    return res.status(400).json({ message: 'Attendees cannot be changed after the MOM is submitted' });
  }
  const incoming = (Array.isArray(req.body?.attendees) ? req.body.attendees : []).slice(0, 50).map((a) => ({
    name: String(a?.name || '').trim(),
    designation: String(a?.designation || '').trim(),
  }));
  if (incoming.length === 0) return res.status(400).json({ message: 'Add at least one attendee' });
  if (incoming.some((a) => !a.name || !a.designation)) {
    return res.status(400).json({ message: 'Every attendee needs a name and a designation' });
  }
  if (meeting.attendees.length + incoming.length > 50) {
    return res.status(400).json({ message: 'A meeting can have at most 50 attendees' });
  }
  const key = (a) => `${a.name.toLowerCase()}|${a.designation.toLowerCase()}`;
  const existing = new Set(meeting.attendees.map(key));
  for (const a of incoming) {
    if (existing.has(key(a))) return res.status(400).json({ message: `${a.name} (${a.designation}) is already an attendee` });
    existing.add(key(a));
  }
  meeting.attendees.push(...incoming);
  await meeting.save();
  res.json({ meeting: meetingView(meeting) });
});
// Records: every meeting whose MOM the admin approved, newest first.
router.get('/records', async (req, res) => {
  const list = await Meeting.find({ user: req.user.id, 'mom.status': 'approved' })
    .sort({ 'mom.reviewedAt': -1 })
    .limit(300)
    .populate('company', 'name');
  res.json({ records: list.map(meetingView) });
});
// Join Now: only allowed from the meeting's date + time. Body: { now: 'YYYY-MM-DDTHH:mm' } (the user's local time).
router.put('/meetings/:id/join', async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ message: 'Invalid meeting' });
  const meeting = await Meeting.findOne({ _id: req.params.id, user: req.user.id }).populate('company', 'name');
  if (!meeting) return res.status(404).json({ message: 'Meeting not found' });
  const now = String(req.body?.now || '');
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(now)) return res.status(400).json({ message: 'Invalid time' });
  if (now < `${meeting.date}T${meeting.time}`) {
    return res.status(400).json({ message: 'This meeting has not started yet' });
  }
  if (!meeting.joinedAt) {
    meeting.joinedAt = new Date();
    await meeting.save();
  }
  res.json({ meeting: meetingView(meeting) });
});
// Submit the minutes of a meeting for the admin's approval (re-submit after a rejection).
router.put('/meetings/:id/mom', async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ message: 'Invalid meeting' });
  const meeting = await Meeting.findOne({ _id: req.params.id, user: req.user.id }).populate('company', 'name');
  if (!meeting) return res.status(404).json({ message: 'Meeting not found' });
  if (!meeting.joinedAt) return res.status(400).json({ message: 'Join the meeting before sending the MOM' });
  if (meeting.mom?.submittedAt && ['approved', 'rejected'].includes(meeting.mom.status)) {
    return res.status(400).json({ message: `This MOM is already ${meeting.mom.status} and cannot be changed` });
  }
  const { error, mom } = buildMom(req.body, meeting);
  if (error) return res.status(400).json({ message: error });
  meeting.mom = mom;
  await meeting.save();
  res.json({ meeting: meetingView(meeting) });
});
router.get('/tasks/:taskId/image-attachments', async (req, res) => {
    try {
        const task = await Task.findOne({
            _id: req.params.taskId,
            user: req.user.id
        });
        if (!task) {
            return res.status(404).json({ message: 'Task not found.' });
        }
        const attachments = await TaskAttachment.find({
            task: task._id,
            user: req.user.id
        })
            .select('_id originalName mimeType size imageUrl publicId createdAt')
            .sort({ createdAt: -1 })
            .lean();
        res.json({ attachments });
    } catch (error) {
        console.error('Fetch task images error:', error);
        res.status(500).json({
            message: 'Unable to load task images.'
        });
    }
});
router.post('/tasks/:taskId/image-attachments', (req, res, next) => {
    taskImageUpload.array('images', 5)(req, res, err => {
        if (err) return res.status(400).json({ message: err.message });
        next();
    });
}, async (req, res) => {
    const uploadedImages = [];
    try {
        const { taskId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(taskId)) {
            return res.status(400).json({ message: 'Invalid task ID.' });
        }
        const task = await Task.findOne({ _id: taskId, user: req.user.id });
        if (!task) {
            return res.status(404).json({ message: 'Task not found.' });
        }
        if (!req.files?.length) {
            return res.status(400).json({ message: 'Please select at least one image.' });
        }
        const existingCount = await TaskAttachment.countDocuments({
            task: taskId,
            user: req.user.id
        });
        if (existingCount + req.files.length > 5) {
            return res.status(400).json({
                message: `You can upload only ${5 - existingCount} more image(s).`
            });
        }
        for (const file of req.files) {
            const result = await uploadToCloudinary(file.buffer, 'creative-manager/tasks');
            uploadedImages.push({
                task: taskId,
                user: req.user.id,
                originalName: file.originalname,
                mimeType: file.mimetype,
                size: file.size,
                imageUrl: result.secure_url,
                publicId: result.public_id
            });
        }
        const savedImages = await TaskAttachment.insertMany(uploadedImages);
        res.status(201).json({
            message: 'Images uploaded successfully.',
            attachments: savedImages.map(item => ({
                _id: item._id,
                originalName: item.originalName,
                mimeType: item.mimeType,
                size: item.size,
                imageUrl: item.imageUrl,
                createdAt: item.createdAt
            }))
        });
    } catch (error) {
        await Promise.all(
            uploadedImages.map(item =>
                cloudinary.uploader.destroy(item.publicId).catch(() => {})
            )
        );
        console.error('Task Image Upload Error:', error);
        res.status(500).json({ message: error.message || 'Image upload failed.' });
    }
});
router.delete('/tasks/:taskId/attachments/:attachmentId', async (req, res) => {
    try {
        const task = await Task.findOne({
            _id: req.params.taskId,
            user: req.user.id
        });
        if (!task) {
            return res.status(404).json({ message: 'Task not found.' });
        }
        const attachment = await TaskAttachment.findOne({
            _id: req.params.attachmentId,
            task: task._id,
            user: req.user.id
        });
        if (!attachment) {
            return res.status(404).json({ message: 'Image not found.' });
        }
        if (attachment.publicId) {
            await cloudinary.uploader.destroy(attachment.publicId, {
                resource_type: 'image'
            });
        }
        await TaskAttachment.deleteOne({
            _id: attachment._id
        });
        res.json({
            message: 'Image deleted successfully.'
        });
    } catch (error) {
        console.error('Delete task image error:', error);
        res.status(500).json({
            message: 'Unable to delete image.'
        });
    }
});
export default router;
