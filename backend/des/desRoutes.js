
import express from 'express';
import { protect } from '../auth.js';
import Creative from '../sme/Creative.js';

const router = express.Router();

router.use(protect(['des']));

router.get('/creatives', async (req, res) => {
  try {
    const creatives = await Creative.find({
      assignedDesigner: req.user.id
    })
      .populate('company', 'name logo')
      .populate('user', 'name fullname email')
      .sort({ date: 1, createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: creatives.length,
      creatives
    });
  } catch (error) {
    console.error('DES creatives error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch assigned creatives'
    });
  }
});

export default router;
