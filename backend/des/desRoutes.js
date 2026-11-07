import express from 'express';
import { protect } from '../auth.js';
import Creative from '../sme/Creative.js';
const router = express.Router();
router.use(protect(['des']));
router.get('/companies', async (req, res) => {
  try {
    const creatives = await Creative.find({
      assignedDesigner: req.user.id,
      company: { $ne: null }
    })
      .populate('company', 'name logo')
      .lean();
    const companiesMap = new Map();
    creatives.forEach((creative) => {
      if (creative.company?._id) {
        const companyId = String(creative.company._id);
        if (!companiesMap.has(companyId)) {
          companiesMap.set(companyId, {
            id: companyId,
            _id: companyId,
            name: creative.company.name,
            logo: creative.company.logo || '',
            creativeCount: 0
          });
        }
        companiesMap.get(companyId).creativeCount += 1;
      }
    });
    return res.json([...companiesMap.values()]);
  } catch (error) {
    console.error('DES companies error:', error);
    return res.status(500).json({
      message: 'Failed to fetch assigned companies'
    });
  }
});
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
