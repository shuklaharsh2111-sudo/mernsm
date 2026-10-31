import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { register, me, updateAvatar } from '../controllers/auth.controller.js';
import {
  listMySops,
  createMySop,
  updateMySop,
  deleteMySop,
} from '../controllers/sop.controller.js';
import { protectSme } from '../middleware/auth.js';

const router = Router();

const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { message: 'Too many attempts, try again later' },
});

router.post('/auth/register', registerLimiter, register);
router.get('/auth/me', protectSme, me);
router.put('/auth/avatar', protectSme, updateAvatar);

router.get('/sops', protectSme, listMySops);
router.post('/sops', protectSme, createMySop);
router.put('/sops/:id', protectSme, updateMySop);
router.delete('/sops/:id', protectSme, deleteMySop);

export default router;
