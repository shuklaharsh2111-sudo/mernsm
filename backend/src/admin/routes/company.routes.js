import { Router } from 'express';
import {
  listCompanies,
  createCompany,
  updateCompany,
  deleteCompany,
} from '../controllers/company.controller.js';
import { protectAdmin } from '../middleware/auth.js';

const router = Router();

router.use(protectAdmin);

router.get('/', listCompanies);
router.post('/', createCompany);
router.put('/:id', updateCompany);
router.delete('/:id', deleteCompany);

export default router;
