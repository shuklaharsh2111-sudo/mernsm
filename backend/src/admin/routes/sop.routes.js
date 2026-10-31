import { Router } from 'express';
import {
  listSops,
  getSop,
  createSop,
  updateSop,
  reviewSop,
  deleteSop,
} from '../controllers/sop.controller.js';
import { protectAdmin } from '../middleware/auth.js';

const router = Router();

router.use(protectAdmin);

router.get('/', listSops);
router.post('/', createSop);
router.get('/:id', getSop);
router.put('/:id', updateSop);
router.patch('/:id/review', reviewSop);
router.delete('/:id', deleteSop);

export default router;
