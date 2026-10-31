import { Router } from 'express';
import authRoutes from './auth.routes.js';
import sopRoutes from './sop.routes.js';
import usersRoutes from './users.routes.js';
import companyRoutes from './company.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/sops', sopRoutes);
router.use('/users', usersRoutes);
router.use('/companies', companyRoutes);
// Future admin modules (users, products, ...) get mounted here.

export default router;
