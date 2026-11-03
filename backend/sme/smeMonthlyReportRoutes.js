
import express from 'express';
import { protect } from '../auth.js';

const router = express.Router();

// SME monthly performance report
router.get('/', protect(['sme']), async (req, res) => {
    try {
        res.status(200).json({
            success: true,
            message: 'SME Monthly Report API is working',
            report: null
        });
    } catch (error) {
        console.error('Monthly Report Error:', error);

        res.status(500).json({
            success: false,
            message: 'Failed to generate monthly report'
        });
    }
});

export default router;
