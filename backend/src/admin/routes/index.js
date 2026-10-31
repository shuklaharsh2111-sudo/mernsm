import { Router } from 'express';
import authRoutes from './auth.routes.js';

const router = Router();

router.use('/auth', authRoutes);
// Future admin modules (users, products, ...) get mounted here.

export default router;
