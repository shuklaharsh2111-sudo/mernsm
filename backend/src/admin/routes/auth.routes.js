import { Router } from 'express';
import { me, updateAvatar } from '../controllers/auth.controller.js';
import { protectAdmin } from '../middleware/auth.js';

const router = Router();

router.get('/me', protectAdmin, me);
router.put('/avatar', protectAdmin, updateAvatar);

export default router;
