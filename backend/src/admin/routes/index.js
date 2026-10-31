import { Router } from 'express';
import authRoutes from './auth.routes.js';
import sopRoutes from './sop.routes.js';
import usersRoutes from './users.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/sops', sopRoutes);
router.use('/users', usersRoutes);
// Future admin modules (users, products, ...) get mounted here.

export default router;
