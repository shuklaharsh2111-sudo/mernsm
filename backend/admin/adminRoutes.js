import multer from 'multer';
import cloudinary from '../config/cloudinary.js';
import express from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { protect } from '../auth.js';
import Admin from './Admin.js';
import Sme from '../sme/Sme.js';
import Company, { MAX_ASSIGNED } from '../company/Company.js';
import SopAssignment, { SOP_TYPE_VALUES } from '../sop/SopAssignment.js';
import SmiSopAssignment from '../sop/SmiSopAssignment.js';
import { isRealDate } from '../sop/period.js';
import Meeting from '../meeting/Meeting.js';
import { momItemView, creativeItemView, reviewMom, reviewCreative } from '../review/reviewCore.js';
import { mountIntegrationRoutes } from '../meeting/integrationRoutes.js';
import Creative from '../sme/Creative.js';
import Attendance from '../attendance/Attendance.js';
import { getOfficeConfig } from '../attendance/geo.js';
import { ReportingManager, Smi, roleModels } from './UserModels.js';
import { notifyUsers } from '../notifications/notify.js';
const router = express.Router();
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    cb(new Error('Only JPG, PNG and WEBP images are allowed'));
  }
});
const uploadToCloudinary = (file, folder = 'creative-manager/profiles') => new Promise((resolve, reject) => {
  cloudinary.uploader.upload_stream(
    { folder, resource_type: 'image' },
    (error, result) => {
      if (error) return reject(error);
      resolve(result);
    }
  ).end(file.buffer);
});
const deleteFromCloudinary = async (publicId) => {
  if (!publicId) return;
  await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
};
// The Operation Manager panel reuses every admin endpoint, so both roles are allowed here.
router.use(protect(['admin', 'operation_manager']));
// Operation managers can read users/companies (dashboard, calendar, attendance) but never add, change or delete them.
router.use((req, res, next) => {
  if (req.user.role === 'operation_manager' && req.method !== 'GET' && /^\/(users|companies)(\/|$)/.test(req.path)) {
    return res.status(403).json({ message: 'Operation managers cannot add or change users and companies.' });
  }
  next();
});
mountIntegrationRoutes(router);
const validId = (id) => mongoose.Types.ObjectId.isValid(id);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const companyView = (c) => ({
  id: String(c._id),
  name: c.name,
  logo: c.logo || '',
  logoPublicId: c.logoPublicId || ''
});
const sopView = (a) => ({
  id: a._id,
  company: String(a.company),
  type: a.type,
  text: a.text,
  date: a.date,
  doneCount: (a.completions || []).length,
});
// ---------------- Users ----------------
const userView = (u, collection) => ({
  id: String(u._id),
  name: u.name || u.fullname || u.email,
  email: u.email,
  role: String(u.role || collection).toUpperCase(),
  collection,
  contact: u.contact || '',
  reportingManagerId: u.reportingManagerId ? String(u.reportingManagerId) : '',
  profileImage: u.profileImage || u.avatar || '',
  companies: ['smes', 'smis'].includes(collection) ? (u.companies || []).map(String) : [],
  createdAt: u.createdAt
});
const getRoleCollection = (role) => roleModels[role]?.collection?.collectionName || '';
router.get('/users', async (req, res) => {
  const collections = Object.entries(roleModels);
  const results = await Promise.all(
    collections.map(async ([role, Model]) => {
      const collection = getRoleCollection(role);
      const users = await Model.find().sort({ createdAt: -1 }).lean();
      return users.map((u) => userView(u, collection));
    })
  );
  const users = results.flat().sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  res.json({ users, maxAssigned: MAX_ASSIGNED });
});
router.get('/reporting-managers', async (req, res) => {
  const managers = await ReportingManager.find()
    .select('name fullname email profileImage')
    .sort({ name: 1 })
    .lean();
  res.json({
    reportingManagers: managers.map((m) => ({
      id: String(m._id),
      name: m.name || m.fullname || m.email,
      email: m.email,
      profileImage: m.profileImage || ''
    }))
  });
});
router.post('/users', imageUpload.single('image'), async (req, res) => {
  const name = String(req.body.name || '').trim();
  const contact = String(req.body.contact || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const role = String(req.body.role || '').trim().toLowerCase();
  if (!name || !contact || !email || !password || !role) {
    return res.status(400).json({ message: 'Name, contact, email, password and role are required' });
  }
  if (!EMAIL_RE.test(email)) return res.status(400).json({ message: 'Enter a valid email address' });
  if (password.length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters' });
  const UserModel = roleModels[role];
  if (!UserModel) return res.status(400).json({ message: 'Invalid user role' });
  const duplicateChecks = await Promise.all(
    Object.values(roleModels).map((Model) => Model.exists({ email }))
  );
  if (duplicateChecks.some(Boolean)) {
    return res.status(409).json({ message: 'That email is already in use' });
  }
  let reportingManagerId = null;
  if (req.body.reportingManagerId) {
    if (!validId(req.body.reportingManagerId)) {
      return res.status(400).json({ message: 'Invalid reporting manager' });
    }
    const managerExists = await ReportingManager.exists({ _id: req.body.reportingManagerId });
    if (!managerExists) {
      return res.status(400).json({ message: 'Selected reporting manager does not exist' });
    }
    reportingManagerId = req.body.reportingManagerId;
  }
  let imageUrl = '';
  if (req.file) {
    const uploadedImage = await uploadToCloudinary(req.file);
    imageUrl = uploadedImage.secure_url;
  }
  const userData = {
    name,
    fullname: name,
    contact,
    email,
    password: await bcrypt.hash(password, 10),
    role,
    profileImage: imageUrl,
    avatar: imageUrl,
    reportingManagerId
  };
  if (role === 'sme' || role === 'smi') userData.companies = [];
  const user = await UserModel.create(userData);
  if (reportingManagerId) {
    notifyUsers([{ id: reportingManagerId, role: 'reporting_manager' }], { topic: 'team', tone: 'info', title: 'New team member', message: `${name} was added to your team.` }, req.user);
  }
  res.status(201).json({
    user: userView(user, getRoleCollection(role))
  });
});
// Companies can be assigned to SME and SMI users.
const ASSIGNABLE = [
  { Model: Sme, role: 'sme', collection: 'smes' },
  { Model: Smi, role: 'smi', collection: 'smis' },
];
// Some old records stored createdAt/updatedAt as { $date: ... } objects, which breaks save(). Repair them first.
const repairTimestamps = (Model, userId) => Model.collection.updateOne(
  {
    _id: userId,
    $or: [
      { createdAt: { $type: 'object' } },
      { updatedAt: { $type: 'object' } }
    ]
  },
  [
    {
      $set: {
        createdAt: {
          $cond: [
            { $eq: [{ $type: '$createdAt' }, 'object'] },
            {
              $convert: {
                input: { $getField: { field: { $literal: '$date' }, input: '$createdAt' } },
                to: 'date',
                onError: '$$NOW',
                onNull: '$$NOW'
              }
            },
            '$createdAt'
          ]
        },
        updatedAt: {
          $cond: [
            { $eq: [{ $type: '$updatedAt' }, 'object'] },
            {
              $convert: {
                input: { $getField: { field: { $literal: '$date' }, input: '$updatedAt' } },
                to: 'date',
                onError: '$$NOW',
                onNull: '$$NOW'
              }
            },
            '$updatedAt'
          ]
        }
      }
    }
  ]
);
// Finds the SME or SMI with this id. Sends the error response itself and returns null when there is none.
const findAssignable = async (req, res) => {
  if (!validId(req.params.id)) {
    res.status(404).json({ message: 'User not found' });
    return null;
  }
  const userId = new mongoose.Types.ObjectId(req.params.id);
  for (const entry of ASSIGNABLE) {
    await repairTimestamps(entry.Model, userId);
    const user = await entry.Model.findById(userId);
    if (!user) continue;
    if (String(user.role || '').toLowerCase() !== entry.role) {
      res.status(403).json({ message: 'Companies and SOPs can only be assigned to SME and SMI users.' });
      return null;
    }
    return { user, ...entry };
  }
  res.status(404).json({ message: 'User not found' });
  return null;
};
router.put('/users/:id/companies', async (req, res) => {
  const ids = Array.isArray(req.body.companies)
    ? [...new Set(req.body.companies.map(String))]
    : null;
  if (!ids || ids.some(id => !validId(id))) {
    return res.status(400).json({ message: 'Invalid companies' });
  }
  if (ids.length > MAX_ASSIGNED) {
    return res.status(400).json({ message: `You can assign at most ${MAX_ASSIGNED} companies` });
  }
  if ((await Company.countDocuments({ _id: { $in: ids } })) !== ids.length) {
    return res.status(400).json({ message: 'One of the companies no longer exists' });
  }
  const found = await findAssignable(req, res);
  if (!found) return;
  found.user.companies = ids;
  await found.user.save();
  notifyUsers([{ id: found.user._id, role: found.role }], { topic: 'home', tone: 'info', title: 'Companies updated', message: '{actor} updated the companies assigned to you.' }, req.user);
  res.json({ user: userView(found.user, found.collection) });
});
router.delete('/users/:id', async (req, res) => {
  if (!validId(req.params.id)) return res.status(404).json({ message: 'User not found' });
  const collection = String(req.query.collection || '').toLowerCase();
  const entry = Object.entries(roleModels).find(([role]) => getRoleCollection(role).toLowerCase() === collection);
  if (!entry) return res.status(400).json({ message: 'Valid user collection is required' });
  const [, UserModel] = entry;
  // An admin can never delete the account they are signed in with, and the last admin can never be deleted.
  if (String(req.user.id) === String(req.params.id)) {
    return res.status(403).json({ message: 'You cannot delete your own account.' });
  }
  if (collection === 'admins' && (await Admin.countDocuments()) <= 1) {
    return res.status(403).json({ message: 'The last admin account cannot be deleted.' });
  }
  const user = await UserModel.findByIdAndDelete(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found in selected collection' });
  if (collection === 'smes') {
    await SopAssignment.deleteMany({ user: user._id });
    await SmiSopAssignment.deleteMany({ assignedBy: user._id });
  }
  if (collection === 'smis') await SmiSopAssignment.deleteMany({ smi: user._id });
  res.json({ message: 'User deleted' });
});
// ---------------- Attendance (login / logout times) ----------------
// GET /api/admin/attendance?from=YYYY-MM-DD&to=YYYY-MM-DD&userId=<id>&role=sme|admin
router.get('/attendance', async (req, res) => {
  const filter = {};
  if (req.query.userId) {
    if (!validId(req.query.userId)) return res.status(400).json({ message: 'Invalid user' });
    filter.userId = req.query.userId;
  }
  if (['admin', 'operation_manager', 'reporting_manager', 'sme', 'smi', 'des', 'hr', 'clients'].includes(req.query.role)) filter.role = req.query.role;
  const range = {};
  if (req.query.from) {
    const d = new Date(`${req.query.from}T00:00:00`);
    if (!isNaN(d)) range.$gte = d;
  }
  if (req.query.to) {
    const d = new Date(`${req.query.to}T23:59:59.999`);
    if (!isNaN(d)) range.$lte = d;
  }
  if (Object.keys(range).length) filter.loginAt = range;
  const limit = Math.min(parseInt(req.query.limit, 10) || 500, 2000);
  const records = await Attendance.find(filter).sort({ loginAt: -1 }).limit(limit).lean();
  const office = getOfficeConfig();
  res.json({
    office: { configured: office.configured, radius: office.radius },
    records: records.map((r) => ({
      id: r._id,
      userId: r.userId,
      name: r.name,
      email: r.email,
      role: r.role,
      loginAt: r.loginAt,
      logoutAt: r.logoutAt,
      distance: r.loginLocation?.distance ?? null,
      accuracy: r.loginLocation?.accuracy ?? null
    }))
  });
});
// ---------------- Companies ----------------
router.get('/companies', async (req, res) => {
  const list = await Company.find().sort({ name: 1 });
  res.json({ companies: list.map(companyView) });
});
router.post('/companies', imageUpload.single('logo'), async (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name) return res.status(400).json({ message: 'Company name is required' });
  if (name.length > 60) return res.status(400).json({ message: 'Company name is too long (max 60)' });
  if (!req.file) return res.status(400).json({ message: 'Company logo is required' });
  const nameKey = name.toLowerCase();
  if (await Company.exists({ nameKey })) {
    return res.status(409).json({ message: 'That company already exists' });
  }
  const uploadedLogo = await uploadToCloudinary(req.file, 'creative-manager/company-logos');
  try {
    const company = await Company.create({
      name,
      nameKey,
      logo: uploadedLogo.secure_url,
      logoPublicId: uploadedLogo.public_id
    });
    res.status(201).json({ company: companyView(company) });
  } catch (error) {
    await deleteFromCloudinary(uploadedLogo.public_id).catch(() => { });
    throw error;
  }
});
router.delete('/companies/:id', async (req, res) => {
  if (!validId(req.params.id)) return res.status(404).json({ message: 'Company not found' });
  const company = await Company.findById(req.params.id);
  if (!company) return res.status(404).json({ message: 'Company not found' });
  await Sme.updateMany({ companies: company._id }, { $pull: { companies: company._id } });
  await Smi.updateMany({ companies: company._id }, { $pull: { companies: company._id } });
  await SopAssignment.deleteMany({ company: company._id });
  await SmiSopAssignment.deleteMany({ company: company._id });
  await Company.deleteOne({ _id: company._id });
  if (company.logoPublicId) {
    await deleteFromCloudinary(company.logoPublicId).catch((error) => {
      console.error('Company logo deletion failed:', error.message);
    });
  }
  res.json({ message: 'Company deleted' });
});
// ---------------- Manage SOPs (assigned to a user) ----------------
// SME SOPs live in SopAssignment (field "user"); SMI SOPs live in SmiSopAssignment (field "smi").
const sopStoreFor = (found) => (found.role === 'smi'
  ? { Model: SmiSopAssignment, field: 'smi' }
  : { Model: SopAssignment, field: 'user' });
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
  const found = await findAssignable(req, res);
  if (!found) return;
  const { Model, field } = sopStoreFor(found);
  const filter = { [field]: found.user._id };
  // For an SMI, only the SOPs the admin assigned are managed here (SME-assigned ones belong to that SME).
  if (found.role === 'smi') filter.createdBy = { $ne: null };
  const list = await Model.find(filter).sort({ date: -1, createdAt: -1 }).limit(300);
  res.json({ assignments: list.map(sopView) });
});
router.post('/users/:id/sop-assignments', async (req, res) => {
  const found = await findAssignable(req, res);
  if (!found) return;
  const problem = validateSop(found.user, req.body);
  if (problem) return res.status(400).json({ message: problem });
  const { company, type, text, date } = req.body;
  const { Model, field } = sopStoreFor(found);
  const doc = await Model.create({ [field]: found.user._id, company, type, text, date, createdBy: req.user.id });
  notifyUsers([{ id: found.user._id, role: found.role }], { topic: 'sops', tone: 'info', title: 'New SOP assigned', message: '{actor} assigned you a new SOP.' }, req.user);
  res.status(201).json({ assignment: sopView(doc) });
});
router.put('/users/:id/sop-assignments/:sopId', async (req, res) => {
  const found = await findAssignable(req, res);
  if (!found) return;
  if (!validId(req.params.sopId)) return res.status(404).json({ message: 'SOP not found' });
  const { Model, field } = sopStoreFor(found);
  const filter = { _id: req.params.sopId, [field]: found.user._id };
  if (found.role === 'smi') filter.createdBy = { $ne: null };
  const doc = await Model.findOne(filter);
  if (!doc) return res.status(404).json({ message: 'SOP not found' });
  const problem = validateSop(found.user, req.body);
  if (problem) return res.status(400).json({ message: problem });
  const { company, type, text, date } = req.body;
  Object.assign(doc, { company, type, text, date });
  await doc.save();
  res.json({ assignment: sopView(doc) });
});
router.delete('/users/:id/sop-assignments/:sopId', async (req, res) => {
  const found = await findAssignable(req, res);
  if (!found) return;
  if (!validId(req.params.sopId)) return res.status(404).json({ message: 'SOP not found' });
  const { Model, field } = sopStoreFor(found);
  const filter = { _id: req.params.sopId, [field]: found.user._id };
  if (found.role === 'smi') filter.createdBy = { $ne: null };
  const doc = await Model.findOneAndDelete(filter);
  if (!doc) return res.status(404).json({ message: 'SOP not found' });
  res.json({ message: 'SOP deleted' });
});
// ---------------- MOM approvals ----------------
// The review logic is shared with the reporting manager panel (review/reviewCore.js).
// Every MOM an SME has submitted, newest first.
router.get('/moms', async (req, res) => {
  const list = await Meeting.find({ 'mom.submittedAt': { $exists: true } })
    .sort({ 'mom.submittedAt': -1 })
    .limit(300)
    .populate('company', 'name')
    .populate('user', 'name fullname email');
  res.json({ moms: list.map(momItemView) });
});
router.put('/moms/:id/approve', (req, res) => reviewMom(req, res, 'approve'));
router.put('/moms/:id/send-back', (req, res) => reviewMom(req, res, 'send-back'));
router.put('/moms/:id/reject', (req, res) => reviewMom(req, res, 'reject'));
// ---------------- Creative approvals ----------------
// Every creative an SME has submitted, newest first.
router.get('/creatives', async (req, res) => {
  const list = await Creative.find({})
    .sort({ createdAt: -1 })
    .limit(500)
    .populate('company', 'name')
    .populate('user', 'name fullname email')
    .populate('assignedDesigner', 'name email');
  res.json({ creatives: list.map(creativeItemView) });
});
router.put('/creatives/:id/approve', (req, res) => reviewCreative(req, res, 'approve'));
router.put('/creatives/:id/reject', (req, res) => reviewCreative(req, res, 'reject'));
export default router;
