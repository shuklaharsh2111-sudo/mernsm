import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import Admin from '../models/Admin.js';
import User, { ROLE_VALUES } from '../models/User.js';
<<<<<<< HEAD
import Company, { MAX_COMPANIES } from '../models/Company.js';
=======
>>>>>>> adc7900227aadaf9e0a6f9f972499593c8ff0896
import { nextSeq } from '../models/Counter.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CONTACT_RE = /^[0-9+\-\s()]{7,20}$/;
const PASSWORD_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

const validId = (id) => mongoose.Types.ObjectId.isValid(id);

const generatePassword = (len = 10) =>
  Array.from(crypto.randomBytes(len), (b) => PASSWORD_CHARS[b % PASSWORD_CHARS.length]).join('');

export const adminUserView = (u) => ({
  id: u._id,
  userId: u.userId,
  name: u.name,
  email: u.email,
  contact: u.contact,
  role: u.role,
  reportingManager: u.reportingManager,
<<<<<<< HEAD
  companies: (u.companies || []).map(String),
=======
  assignedCompanies: u.assignedCompanies,
>>>>>>> adc7900227aadaf9e0a6f9f972499593c8ff0896
  active: u.active,
  createdAt: u.createdAt,
});

<<<<<<< HEAD
// Company ids must be valid and exist. Returns { ids } or { error }.
const resolveCompanies = async (input) => {
  const list = Array.isArray(input) ? [...new Set(input.map(String))] : [];
  if (list.length > MAX_COMPANIES) return { error: `You can assign at most ${MAX_COMPANIES} companies` };
  if (list.some((id) => !validId(id))) return { error: 'Choose valid companies' };
  const found = await Company.countDocuments({ _id: { $in: list } });
  if (found !== list.length) return { error: 'One of the selected companies no longer exists' };
  return { ids: list };
};

const validateProfile = ({ name, email, contact, role, reportingManager }) => {
=======
// Accepts an array or a comma/newline separated string.
const normalizeCompanies = (input) => {
  const list = Array.isArray(input) ? input : String(input ?? '').split(/[,\n]/);
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const c = String(item).trim();
    if (!c || seen.has(c.toLowerCase())) continue;
    seen.add(c.toLowerCase());
    out.push(c);
  }
  return out;
};

const validateProfile = ({ name, email, contact, role, companies, reportingManager }) => {
>>>>>>> adc7900227aadaf9e0a6f9f972499593c8ff0896
  if (!name?.trim() || !email || !contact?.trim() || !role) {
    return 'Full name, email, contact and role are required';
  }
  if (!EMAIL_RE.test(email)) return 'Enter a valid email address';
  if (!CONTACT_RE.test(contact.trim())) return 'Enter a valid contact number';
  if (!ROLE_VALUES.includes(role)) return 'Choose a valid role';
<<<<<<< HEAD
=======
  if (companies.length > 20) return 'You can assign at most 20 companies';
  if (companies.some((c) => c.length > 80)) return 'Company names must be 80 characters or fewer';
>>>>>>> adc7900227aadaf9e0a6f9f972499593c8ff0896
  if (reportingManager && String(reportingManager).length > 80) return 'Reporting manager name is too long';
  return null;
};

const emailTaken = async (email, exceptUserId) => {
  const lower = email.toLowerCase();
  if (await Admin.findOne({ email: lower })) return true;
  const user = await User.findOne({ email: lower });
  return Boolean(user && String(user._id) !== String(exceptUserId));
};

export const listUsers = async (req, res, next) => {
  try {
<<<<<<< HEAD
    const [users, admins, companies] = await Promise.all([
      User.find().sort({ createdAt: -1 }).limit(500),
      Admin.find().select('name'),
      Company.find().sort({ createdAt: 1 }),
=======
    const [users, admins] = await Promise.all([
      User.find().sort({ createdAt: -1 }).limit(500),
      Admin.find().select('name'),
>>>>>>> adc7900227aadaf9e0a6f9f972499593c8ff0896
    ]);
    const managers = [
      ...admins.map((a) => ({ id: String(a._id), name: a.name, label: `${a.name} (Admin)` })),
      ...users.map((u) => ({ id: String(u._id), name: u.name, label: `${u.name} (${u.userId})` })),
    ];
<<<<<<< HEAD
    res.json({
      users: users.map(adminUserView),
      managers,
      companies: companies.map((c) => ({ id: c._id, name: c.name, logo: c.logo || '' })),
    });
=======
    res.json({ users: users.map(adminUserView), managers });
>>>>>>> adc7900227aadaf9e0a6f9f972499593c8ff0896
  } catch (err) {
    next(err);
  }
};

export const createUser = async (req, res, next) => {
  try {
    const { name, email, contact, role, reportingManager, password } = req.body;
<<<<<<< HEAD
    const problem = validateProfile({ name, email, contact, role, reportingManager });
    if (problem) return res.status(400).json({ message: problem });
    const picked = await resolveCompanies(req.body.companies ?? []);
    if (picked.error) return res.status(400).json({ message: picked.error });
=======
    const assignedCompanies = normalizeCompanies(req.body.assignedCompanies);

    const problem = validateProfile({ name, email, contact, role, companies: assignedCompanies, reportingManager });
    if (problem) return res.status(400).json({ message: problem });
>>>>>>> adc7900227aadaf9e0a6f9f972499593c8ff0896
    if (password && String(password).length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }
    if (await emailTaken(email)) {
      return res.status(409).json({ message: 'An account with this email already exists' });
    }

    const plain = password || generatePassword();
    const seq = await nextSeq('user');
    const user = await User.create({
      userId: `USR-${String(seq).padStart(4, '0')}`,
      name,
      email,
      contact: contact.trim(),
      role,
      reportingManager: reportingManager?.trim() || '',
<<<<<<< HEAD
      companies: picked.ids,
=======
      assignedCompanies,
>>>>>>> adc7900227aadaf9e0a6f9f972499593c8ff0896
      password: await bcrypt.hash(plain, 12),
      createdBy: req.admin._id,
    });

    res.status(201).json({
      user: adminUserView(user),
      // Only returned when the system generated it, and only this once.
      tempPassword: password ? undefined : plain,
    });
  } catch (err) {
    next(err);
  }
};

export const updateUser = async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return res.status(404).json({ message: 'User not found' });
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const merged = {
      name: req.body.name ?? user.name,
      email: req.body.email ?? user.email,
      contact: req.body.contact ?? user.contact,
      role: req.body.role ?? user.role,
      reportingManager: req.body.reportingManager ?? user.reportingManager,
<<<<<<< HEAD
=======
      companies:
        req.body.assignedCompanies !== undefined
          ? normalizeCompanies(req.body.assignedCompanies)
          : user.assignedCompanies,
>>>>>>> adc7900227aadaf9e0a6f9f972499593c8ff0896
    };
    const problem = validateProfile(merged);
    if (problem) return res.status(400).json({ message: problem });
    if (merged.email.toLowerCase() !== user.email && (await emailTaken(merged.email, user._id))) {
      return res.status(409).json({ message: 'An account with this email already exists' });
    }

    user.name = merged.name;
    user.email = merged.email;
    user.contact = merged.contact.trim();
    user.role = merged.role;
    user.reportingManager = String(merged.reportingManager || '').trim();
<<<<<<< HEAD
    if (req.body.companies !== undefined) {
      const picked = await resolveCompanies(req.body.companies);
      if (picked.error) return res.status(400).json({ message: picked.error });
      user.companies = picked.ids;
    }
=======
    user.assignedCompanies = merged.companies;
>>>>>>> adc7900227aadaf9e0a6f9f972499593c8ff0896
    await user.save();

    res.json({ user: adminUserView(user) });
  } catch (err) {
    next(err);
  }
};

export const resetUserPassword = async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return res.status(404).json({ message: 'User not found' });
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const plain = generatePassword();
    user.password = await bcrypt.hash(plain, 12);
    await user.save();
    res.json({ user: adminUserView(user), tempPassword: plain });
  } catch (err) {
    next(err);
  }
};

export const setUserActive = async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return res.status(404).json({ message: 'User not found' });
    if (typeof req.body.active !== 'boolean') {
      return res.status(400).json({ message: 'active must be true or false' });
    }
    const user = await User.findByIdAndUpdate(req.params.id, { active: req.body.active }, { new: true });
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ user: adminUserView(user) });
  } catch (err) {
    next(err);
  }
};

export const deleteUser = async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return res.status(404).json({ message: 'User not found' });
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ message: 'User deleted' });
  } catch (err) {
    next(err);
  }
};
