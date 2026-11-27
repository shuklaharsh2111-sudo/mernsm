import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import connectDB from './config/db.js';
import { loadAttendanceSettings } from './attendance/settings.js';
import { ensureSuperAdmin, superRoutes } from './superadmin/index.js';
import authRoutes, { protect } from './auth.js';
import adminRoutes from './admin/adminRoutes.js';
import smeRoutes from './sme/smeRoutes.js';
import smiRoutes from './smi/smiRoutes.js';
import { buildInfluencerRouter } from './influencer/influencerRoutes.js';
import invoiceRoutes from './invoices/invoiceRoutes.js';
import desRoutes from './des/desRoutes.js';
import hrRoutes from './hr/hrRoutes.js';
import musicRoutes from './music/musicRoutes.js';
import accountRoutes from './account/accountRoutes.js';
import rmRoutes from './rm/rmRoutes.js';
import notificationRoutes from './notifications/notificationRoutes.js';
import suggestionRoutes from './suggestion/suggestionRoutes.js';
import { startGrainPoller } from './meeting/grainSync.js';
import { googleCallback } from './meeting/integrationRoutes.js';
import aiRoutes from './ai/aiRoutes.js';
import clientRoutes from './client/clientRoutes.js';
import formRoutes from './forms/formRoutes.js';
// ON HOLD (device tracking): import deviceRoutes, { publicRouter as devicePublicRoutes } from './attendance/deviceRoutes.js';
dotenv.config();
const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 5000;
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use('/api/des', desRoutes);
app.use('/api/ai', aiRoutes);
await connectDB();
await ensureSuperAdmin();
await loadAttendanceSettings();
app.get('/api/health', (req, res) => {
    res.json({
        status: 'success',
        message: 'Creative Manager API is running'
    });
});
app.use('/api/auth', authRoutes);
app.get('/api/integrations/google/callback', googleCallback);
app.use('/api/superadmin', superRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/sme/influencers', buildInfluencerRouter('sme'));
app.use('/api/smi/influencers', buildInfluencerRouter('smi'));
app.use('/api/sme', smeRoutes);
app.use('/api/smi', smiRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/hr', hrRoutes);
app.use('/api/music', musicRoutes);
app.use('/api/account', accountRoutes);
app.use('/api/rm', rmRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/suggestions', suggestionRoutes);
app.use('/api/client', clientRoutes);
app.use('/api/forms', formRoutes);
// ON HOLD (device tracking): app.use('/api/device', devicePublicRoutes);
// ON HOLD (device tracking): app.use('/api/devices', deviceRoutes);
app.get('/api/admin/dashboard', protect(['admin', 'operation_manager']), (req, res) => {
    res.json({ message: 'Admin access granted' });
});
app.get('/api/sme/dashboard', protect(['sme']), (req, res) => {
    res.json({ message: 'SME access granted' });
});
const frontendPath = path.resolve(__dirname, '../frontend/dist');
app.use(express.static(frontendPath));
app.get(/.*/, (req, res, next) => {
    if (req.path.startsWith('/api/')) {
        return next();
    }
    res.sendFile(path.join(frontendPath, 'index.html'));
});
app.use((err, req, res, next) => {
    if (err?.name === 'MulterError') {
        const message = err.code === 'LIMIT_FILE_SIZE' ? 'Image size must be less than 10MB' : err.message;
        return res.status(400).json({ message });
    }
    if (err?.message === 'Only JPG, PNG and WEBP images are allowed') {
        return res.status(400).json({ message: err.message });
    }
    console.error(err);
    res.status(500).json({
        message: 'Internal server error'
    });
});
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    startGrainPoller();
});
