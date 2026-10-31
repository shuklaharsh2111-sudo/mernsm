import { Router } from 'express';
import authRoutes from './auth.routes.js';
import sopRoutes from './sop.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/sops', sopRoutes);
// Future admin modules (users, products, ...) get mounted here.

export default router;
