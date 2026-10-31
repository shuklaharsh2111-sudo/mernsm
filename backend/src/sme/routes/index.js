import { Router } from 'express';
import { me, updateAvatar } from '../controllers/auth.controller.js';
import {
  listMySops,
  createMySop,
  updateMySop,
  deleteMySop,
} from '../controllers/sop.controller.js';
import { myCompanies } from '../controllers/company.controller.js';
import { protectSme } from '../middleware/auth.js';

const router = Router();

// No self-registration: admins create these accounts from the Users page.
router.get('/auth/me', protectSme, me);
router.put('/auth/avatar', protectSme, updateAvatar);

router.get('/companies', protectSme, myCompanies);

router.get('/sops', protectSme, listMySops);
router.post('/sops', protectSme, createMySop);
router.put('/sops/:id', protectSme, updateMySop);
router.delete('/sops/:id', protectSme, deleteMySop);

export default router;
