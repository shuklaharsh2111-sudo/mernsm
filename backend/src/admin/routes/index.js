import { Router } from 'express';
import authRoutes from './auth.routes.js';
import sopRoutes from './sop.routes.js';
import usersRoutes from './users.routes.js';
<<<<<<< HEAD
import companyRoutes from './company.routes.js';
=======
<<<<<<< HEAD
import companyRoutes from './company.routes.js';
=======
>>>>>>> adc7900227aadaf9e0a6f9f972499593c8ff0896
>>>>>>> c86954fd1b281ba1f0f38af41524f26256ebf5f0

const router = Router();

router.use('/auth', authRoutes);
router.use('/sops', sopRoutes);
router.use('/users', usersRoutes);
<<<<<<< HEAD
router.use('/companies', companyRoutes);
=======
<<<<<<< HEAD
router.use('/companies', companyRoutes);
=======
>>>>>>> adc7900227aadaf9e0a6f9f972499593c8ff0896
>>>>>>> c86954fd1b281ba1f0f38af41524f26256ebf5f0
// Future admin modules (users, products, ...) get mounted here.

export default router;
