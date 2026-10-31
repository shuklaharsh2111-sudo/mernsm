import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import Admin from '../admin/models/Admin.js';
import Sme from '../sme/models/Sme.js';
import { signToken } from '../admin/utils/token.js';
import { signSmeToken } from '../sme/utils/token.js';
import { publicSme } from '../sme/controllers/auth.controller.js';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { message: 'Too many attempts, try again later' },
});

// One login for every role. The account decides where the user lands.
router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }
    const lower = String(email).toLowerCase();

    const admin = await Admin.findOne({ email: lower }).select('+password');
    if (admin && (await bcrypt.compare(password, admin.password))) {
      return res.json({
        token: signToken(admin._id),
        role: 'admin',
        user: { id: admin._id, name: admin.name, email: admin.email, role: 'admin', avatar: admin.avatar || '' },
      });
    }

    const sme = await Sme.findOne({ email: lower }).select('+password');
    if (sme && (await bcrypt.compare(password, sme.password))) {
      return res.json({ token: signSmeToken(sme._id), role: 'sme', user: publicSme(sme) });
    }

    res.status(401).json({ message: 'Invalid email or password' });
  } catch (err) {
    next(err);
  }
});

export default router;
