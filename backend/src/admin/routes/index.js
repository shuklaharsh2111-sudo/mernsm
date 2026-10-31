import { Router } from 'express';
import authRoutes from './auth.routes.js';
import sopRoutes from './sop.routes.js';
import usersRoutes from './users.routes.js';
<<<<<<< HEAD
import companyRoutes from './company.routes.js';
=======
>>>>>>> adc7900227aadaf9e0a6f9f972499593c8ff0896

const router = Router();

router.use('/auth', authRoutes);
router.use('/sops', sopRoutes);
router.use('/users', usersRoutes);
<<<<<<< HEAD
router.use('/companies', companyRoutes);
=======
>>>>>>> adc7900227aadaf9e0a6f9f972499593c8ff0896
// Future admin modules (users, products, ...) get mounted here.

export default router;
