import { Router } from 'express';
import { me, updateAvatar } from '../controllers/auth.controller.js';
import {
  listMySops,
  createMySop,
  updateMySop,
  deleteMySop,
} from '../controllers/sop.controller.js';
<<<<<<< HEAD
import { myCompanies } from '../controllers/company.controller.js';
=======
<<<<<<< HEAD
import { myCompanies } from '../controllers/company.controller.js';
=======
>>>>>>> adc7900227aadaf9e0a6f9f972499593c8ff0896
>>>>>>> c86954fd1b281ba1f0f38af41524f26256ebf5f0
import { protectSme } from '../middleware/auth.js';

const router = Router();

// No self-registration: admins create these accounts from the Users page.
router.get('/auth/me', protectSme, me);
router.put('/auth/avatar', protectSme, updateAvatar);

<<<<<<< HEAD
router.get('/companies', protectSme, myCompanies);

=======
<<<<<<< HEAD
router.get('/companies', protectSme, myCompanies);

=======
>>>>>>> adc7900227aadaf9e0a6f9f972499593c8ff0896
>>>>>>> c86954fd1b281ba1f0f38af41524f26256ebf5f0
router.get('/sops', protectSme, listMySops);
router.post('/sops', protectSme, createMySop);
router.put('/sops/:id', protectSme, updateMySop);
router.delete('/sops/:id', protectSme, deleteMySop);

export default router;
