import express from 'express';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import connectDB from './config/db.js';
import authRoutes, { protect } from './auth.js';
import adminRoutes from './admin/adminRoutes.js';
import smeRoutes from './sme/smeRoutes.js';
dotenv.config();
const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 5000;
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
// DATABASE
await connectDB();
// API ROUTES
app.get('/api/health', (req, res) => {
    res.json({
        status: 'success',
        message: 'Creative Manager API is running'
    });
});
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/sme', smeRoutes);
// ROLE PROTECTED EXAMPLE ROUTES
app.get(
    '/api/admin/dashboard',
    protect(['admin']),
    (req, res) => {
        res.json({
            message: 'Admin access granted'
        });
    }
);
app.get(
    '/api/sme/dashboard',
    protect(['sme']),
    (req, res) => {
        res.json({
            message: 'SME access granted'
        });
    }
);
// FRONTEND BUILD
const frontendPath = path.resolve(
    __dirname,
    '../frontend/dist'
);
app.use(express.static(frontendPath));
// REACT ROUTING FALLBACK
app.get(/.*/, (req, res, next) => {
    if (req.path.startsWith('/api/')) {
        return next();
    }
    res.sendFile(
        path.join(frontendPath, 'index.html')
    );
});
// ERROR HANDLER
app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({
        message: 'Internal server error'
    });
});
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
