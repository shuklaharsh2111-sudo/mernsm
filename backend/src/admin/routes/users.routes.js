import { Router } from 'express';
import {
  listUsers,
  createUser,
  updateUser,
  resetUserPassword,
  setUserActive,
  deleteUser,
} from '../controllers/users.controller.js';
import { protectAdmin } from '../middleware/auth.js';

const router = Router();

router.use(protectAdmin);

router.get('/', listUsers);
router.post('/', createUser);
router.put('/:id', updateUser);
router.post('/:id/reset-password', resetUserPassword);
router.patch('/:id/active', setUserActive);
router.delete('/:id', deleteUser);

export default router;
