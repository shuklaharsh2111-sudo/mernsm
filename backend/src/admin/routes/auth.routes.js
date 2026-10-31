import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { register, login, me, updateAvatar } from '../controllers/auth.controller.js';
import { protectAdmin } from '../middleware/auth.js';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { message: 'Too many attempts, try again later' },
});

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.get('/me', protectAdmin, me);
router.put('/avatar', protectAdmin, updateAvatar);

export default router;
