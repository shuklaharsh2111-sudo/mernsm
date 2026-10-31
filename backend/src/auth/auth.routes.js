import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import Admin from '../admin/models/Admin.js';
import User from '../admin/models/User.js';
import { signToken } from '../admin/utils/token.js';
import { signSmeToken } from '../sme/utils/token.js';
import { publicSme } from '../sme/controllers/auth.controller.js';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { message: 'Too many attempts, try again later' },
});

// One login for everyone. Admins sign in with email; users with email or User ID.
router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const identifier = String(req.body.identifier ?? req.body.email ?? '').trim();
    const { password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ message: 'Email / User ID and password are required' });
    }
    const lower = identifier.toLowerCase();

    const admin = await Admin.findOne({ email: lower }).select('+password');
    if (admin && (await bcrypt.compare(password, admin.password))) {
      return res.json({
        token: signToken(admin._id),
        role: 'admin',
        user: { id: admin._id, name: admin.name, email: admin.email, role: 'admin', avatar: admin.avatar || '' },
      });
    }

    const user = await User.findOne({
      $or: [{ email: lower }, { userId: identifier.toUpperCase() }],
    }).select('+password');
    if (user && (await bcrypt.compare(password, user.password))) {
      if (!user.active) {
        return res.status(403).json({ message: 'Your account is disabled. Contact your admin.' });
      }
      return res.json({ token: signSmeToken(user._id), role: user.role, user: publicSme(user) });
    }

    res.status(401).json({ message: 'Invalid credentials' });
  } catch (err) {
    next(err);
  }
});

export default router;
