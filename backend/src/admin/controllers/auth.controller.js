import bcrypt from 'bcryptjs';
import Admin from '../models/Admin.js';
import { signToken } from '../utils/token.js';
import { isValidAdminCode } from '../utils/adminCode.js';
import Sme from '../../sme/models/Sme.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const publicAdmin = (admin) => ({
  id: admin._id,
  name: admin.name,
  email: admin.email,
  role: admin.role,
  avatar: admin.avatar || '',
});

export const register = async (req, res, next) => {
  try {
    const { name, email, password, adminCode } = req.body;

    if (!name?.trim() || !email || !password || !adminCode) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ message: 'Enter a valid email address' });
    }
    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }
    if (!isValidAdminCode(adminCode)) {
      return res.status(403).json({ message: 'Invalid admin code' });
    }

    const exists =
      (await Admin.findOne({ email: email.toLowerCase() })) ||
      (await Sme.findOne({ email: email.toLowerCase() }));
    if (exists) {
      return res.status(409).json({ message: 'An account with this email already exists' });
    }

    const hashed = await bcrypt.hash(password, 12);
    const admin = await Admin.create({ name, email, password: hashed });

    res.status(201).json({ token: signToken(admin._id), admin: publicAdmin(admin) });
  } catch (err) {
    next(err);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const admin = await Admin.findOne({ email: String(email).toLowerCase() }).select('+password');
    const ok = admin && (await bcrypt.compare(password, admin.password));
    if (!ok) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    res.json({ token: signToken(admin._id), admin: publicAdmin(admin) });
  } catch (err) {
    next(err);
  }
};

export const me = (req, res) => {
  res.json({ admin: publicAdmin(req.admin) });
};

const AVATAR_RE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;

export const updateAvatar = async (req, res, next) => {
  try {
    const { avatar } = req.body;
    if (typeof avatar !== 'string' || avatar.length > 150000 || !AVATAR_RE.test(avatar)) {
      return res.status(400).json({ message: 'Upload a valid png, jpeg or webp image' });
    }
    req.admin.avatar = avatar;
    await req.admin.save();
    res.json({ admin: publicAdmin(req.admin) });
  } catch (err) {
    next(err);
  }
};
