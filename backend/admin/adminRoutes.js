import express from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { protect } from '../auth.js';
import Admin from './Admin.js';
import Sme from '../sme/Sme.js';
import Company, { MAX_ASSIGNED } from '../company/Company.js';
import SopAssignment, { SOP_TYPE_VALUES } from '../sop/SopAssignment.js';
import { isRealDate } from '../sop/period.js';
import Meeting from '../meeting/Meeting.js';
import { momView, generateMeetingLink } from '../meeting/momHelpers.js';

const router = express.Router();
router.use(protect(['admin']));

const validId = (id) => mongoose.Types.ObjectId.isValid(id);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const userView = (u) => ({
  id: u._id,
  name: u.name || u.fullname || u.email,
  email: u.email,
  companies: (u.companies || []).map(String),
  createdAt: u.createdAt,
});
const companyView = (c) => ({ id: c._id, name: c.name });
const sopView = (a) => ({
  id: a._id,
  company: String(a.company),
  type: a.type,
  text: a.text,
  date: a.date,
  doneCount: (a.completions || []).length,
});

// ---------------- Users (SMEs) ----------------
router.get('/users', async (req, res) => {
  const users = await Sme.find().sort({ createdAt: -1 });
  res.json({ users: users.map(userView), maxAssigned: MAX_ASSIGNED });
});

router.post('/users', async (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (!name || !email || !password) return res.status(400).json({ message: 'Name, email and password are required' });
  if (!EMAIL_RE.test(email)) return res.status(400).json({ message: 'Enter a valid email address' });
  if (password.length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters' });
  if ((await Sme.exists({ email })) || (await Admin.exists({ email }))) {
    return res.status(409).json({ message: 'That email is already in use' });
  }
  const user = await Sme.create({ name, email, password: await bcrypt.hash(password, 10), companies: [] });
  res.status(201).json({ user: userView(user) });
});

router.put('/users/:id/companies', async (req, res) => {
  if (!validId(req.params.id)) return res.status(404).json({ message: 'User not found' });
  const ids = Array.isArray(req.body.companies) ? [...new Set(req.body.companies.map(String))] : null;
  if (!ids || ids.some((id) => !validId(id))) return res.status(400).json({ message: 'Invalid companies' });
  if (ids.length > MAX_ASSIGNED) {
    return res.status(400).json({ message: `You can assign at most ${MAX_ASSIGNED} companies` });
  }
  if ((await Company.countDocuments({ _id: { $in: ids } })) !== ids.length) {
    return res.status(400).json({ message: 'One of the companies no longer exists' });
  }
  const user = await Sme.findByIdAndUpdate(req.params.id, { companies: ids }, { new: true });
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json({ user: userView(user) });
});

router.delete('/users/:id', async (req, res) => {
  if (!validId(req.params.id)) return res.status(404).json({ message: 'User not found' });
  const user = await Sme.findByIdAndDelete(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  await SopAssignment.deleteMany({ user: user._id });
  res.json({ message: 'User deleted' });
});

// ---------------- Companies ----------------
router.get('/companies', async (req, res) => {
  const list = await Company.find().sort({ name: 1 });
  res.json({ companies: list.map(companyView) });
});

router.post('/companies', async (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name) return res.status(400).json({ message: 'Company name is required' });
  if (name.length > 60) return res.status(400).json({ message: 'Company name is too long (max 60)' });
  const nameKey = name.toLowerCase();
  if (await Company.exists({ nameKey })) return res.status(409).json({ message: 'That company already exists' });
  const company = await Company.create({ name, nameKey });
  res.status(201).json({ company: companyView(company) });
});

router.delete('/companies/:id', async (req, res) => {
  if (!validId(req.params.id)) return res.status(404).json({ message: 'Company not found' });
  const company = await Company.findByIdAndDelete(req.params.id);
  if (!company) return res.status(404).json({ message: 'Company not found' });
  await Sme.updateMany({ companies: company._id }, { $pull: { companies: company._id } });
  await SopAssignment.deleteMany({ company: company._id });
  res.json({ message: 'Company deleted' });
});

// ---------------- Manage SOPs (assigned to a user) ----------------
const findUser = async (req, res) => {
  if (!validId(req.params.id)) {
    res.status(404).json({ message: 'User not found' });
    return null;
  }
  const user = await Sme.findById(req.params.id);
  if (!user) res.status(404).json({ message: 'User not found' });
  return user;
};

// Returns an error message, or null when the body is fine for this user.
const validateSop = (user, { company, type, text, date }) => {
  if (!company || !type || !String(text || '').trim() || !date) {
    return 'Company, SOP type, SOP text and SOP date are required';
  }
  if (!validId(company) || !(user.companies || []).some((id) => String(id) === String(company))) {
    return 'Choose one of the companies assigned to this user';
  }
  if (!SOP_TYPE_VALUES.includes(type)) return 'Choose Daily, Weekly or Monthly';
  if (String(text).trim().length > 5000) return 'SOP text is too long (max 5000 characters)';
  if (!isRealDate(date)) return 'Enter a valid SOP date';
  return null;
};

router.get('/users/:id/sop-assignments', async (req, res) => {
  const user = await findUser(req, res);
  if (!user) return;
  const list = await SopAssignment.find({ user: user._id }).sort({ date: -1, createdAt: -1 }).limit(300);
  res.json({ assignments: list.map(sopView) });
});

router.post('/users/:id/sop-assignments', async (req, res) => {
  const user = await findUser(req, res);
  if (!user) return;
  const problem = validateSop(user, req.body);
  if (problem) return res.status(400).json({ message: problem });
  const { company, type, text, date } = req.body;
  const doc = await SopAssignment.create({ user: user._id, company, type, text, date, createdBy: req.user.id });
  res.status(201).json({ assignment: sopView(doc) });
});

router.put('/users/:id/sop-assignments/:sopId', async (req, res) => {
  const user = await findUser(req, res);
  if (!user) return;
  if (!validId(req.params.sopId)) return res.status(404).json({ message: 'SOP not found' });
  const doc = await SopAssignment.findOne({ _id: req.params.sopId, user: user._id });
  if (!doc) return res.status(404).json({ message: 'SOP not found' });
  const problem = validateSop(user, req.body);
  if (problem) return res.status(400).json({ message: problem });
  const { company, type, text, date } = req.body;
  Object.assign(doc, { company, type, text, date });
  await doc.save();
  res.json({ assignment: sopView(doc) });
});

router.delete('/users/:id/sop-assignments/:sopId', async (req, res) => {
  const user = await findUser(req, res);
  if (!user) return;
  if (!validId(req.params.sopId)) return res.status(404).json({ message: 'SOP not found' });
  const doc = await SopAssignment.findOneAndDelete({ _id: req.params.sopId, user: user._id });
  if (!doc) return res.status(404).json({ message: 'SOP not found' });
  res.json({ message: 'SOP deleted' });
});

// ---------------- MOM approvals ----------------
const momItemView = (m) => ({
  id: m._id,
  subject: m.subject,
  date: m.date,
  time: m.time,
  company: m.company ? { id: m.company._id, name: m.company.name } : { id: '', name: 'Removed company' },
  sme: m.user ? { id: m.user._id, name: m.user.name || m.user.fullname || m.user.email, email: m.user.email } : { id: '', name: 'Removed user', email: '' },
  mom: momView(m.mom),
});

// Every MOM an SME has submitted, newest first.
router.get('/moms', async (req, res) => {
  const list = await Meeting.find({ 'mom.submittedAt': { $exists: true } })
    .sort({ 'mom.submittedAt': -1 })
    .limit(300)
    .populate('company', 'name')
    .populate('user', 'name fullname email');
  res.json({ moms: list.map(momItemView) });
});

// action: 'approve' | 'send-back' | 'reject'. Send back / reject need a reason.
const REVIEW = {
  approve: { status: 'approved', needsNote: false },
  'send-back': { status: 'sent_back', needsNote: true },
  reject: { status: 'rejected', needsNote: true },
};

const reviewMom = async (req, res, action) => {
  const { status, needsNote } = REVIEW[action];
  if (!validId(req.params.id)) return res.status(404).json({ message: 'MOM not found' });
  const meeting = await Meeting.findOne({ _id: req.params.id, 'mom.submittedAt': { $exists: true } })
    .populate('company', 'name')
    .populate('user', 'name fullname email');
  if (!meeting) return res.status(404).json({ message: 'MOM not found' });
  if (meeting.mom.status !== 'pending') {
    return res.status(400).json({ message: `This MOM is not waiting for review (it is ${meeting.mom.status.replace('_', ' ')})` });
  }

  const note = String(req.body?.note || '').trim();
  if (needsNote && note.length < 3) {
    return res.status(400).json({ message: 'Give a reason (at least 3 characters)' });
  }

  // Approving schedules the next meeting for the SME, so it shows up active on their dashboard.
  let nextScheduled = false;
  if (status === 'approved' && meeting.company && meeting.user && meeting.mom.nextMeeting) {
    if (!(await Meeting.exists({ fromMeeting: meeting._id }))) {
      const nm = meeting.mom.nextMeeting;
      await Meeting.create({
        user: meeting.user._id,
        company: meeting.company._id,
        subject: String(nm.agenda).slice(0, 200),
        date: nm.date,
        time: nm.time,
        link: generateMeetingLink(nm.agenda),
        attendees: meeting.attendees.map((a) => ({ name: a.name, designation: a.designation })),
        priority: nm.priority,
        fromMeeting: meeting._id,
      });
    }
    nextScheduled = true;
  }

  meeting.mom.status = status;
  meeting.mom.reviewedAt = new Date();
  meeting.mom.reviewNote = needsNote ? note : '';
  await meeting.save();
  res.json({ mom: momItemView(meeting), nextScheduled });
};

router.put('/moms/:id/approve', (req, res) => reviewMom(req, res, 'approve'));
router.put('/moms/:id/send-back', (req, res) => reviewMom(req, res, 'send-back'));
router.put('/moms/:id/reject', (req, res) => reviewMom(req, res, 'reject'));

export default router;
