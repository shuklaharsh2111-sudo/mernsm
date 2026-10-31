import bcrypt from 'bcryptjs';
import Sme from '../models/Sme.js';
import Admin from '../../admin/models/Admin.js';
import { signSmeToken } from '../utils/token.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const AVATAR_RE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;

export const publicSme = (sme) => ({
  id: sme._id,
  name: sme.name,
  email: sme.email,
  role: sme.role,
  department: sme.department,
  expertise: sme.expertise,
  employeeId: sme.employeeId,
  avatar: sme.avatar || '',
});

export const register = async (req, res, next) => {
  try {
    const { name, email, password, department, expertise, employeeId } = req.body;

    if (!name?.trim() || !email || !password || !department?.trim()) {
      return res.status(400).json({ message: 'Name, email, department and password are required' });
    }
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ message: 'Enter a valid email address' });
    }
    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }

    const lower = String(email).toLowerCase();
    const exists = (await Sme.findOne({ email: lower })) || (await Admin.findOne({ email: lower }));
    if (exists) {
      return res.status(409).json({ message: 'An account with this email already exists' });
    }

    const hashed = await bcrypt.hash(password, 12);
    const sme = await Sme.create({
      name,
      email: lower,
      password: hashed,
      department,
      expertise,
      employeeId,
    });

    res.status(201).json({ token: signSmeToken(sme._id), role: 'sme', user: publicSme(sme) });
  } catch (err) {
    next(err);
  }
};

export const me = (req, res) => {
  res.json({ sme: publicSme(req.sme) });
};

export const updateAvatar = async (req, res, next) => {
  try {
    const { avatar } = req.body;
    if (typeof avatar !== 'string' || avatar.length > 150000 || !AVATAR_RE.test(avatar)) {
      return res.status(400).json({ message: 'Upload a valid png, jpeg or webp image' });
    }
    req.sme.avatar = avatar;
    await req.sme.save();
    res.json({ sme: publicSme(req.sme) });
  } catch (err) {
    next(err);
  }
};
