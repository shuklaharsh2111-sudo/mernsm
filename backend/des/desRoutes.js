import multer from 'multer';
import cloudinary from '../config/cloudinary.js';
import mongoose from 'mongoose';
import express from 'express';
import { protect } from '../auth.js';
import Creative from '../sme/Creative.js';
const router = express.Router();
const designerUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  }
});
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
router.post('/creatives/:id/work-upload', (req, res, next) => {
  designerUpload.single('image')(req, res, (error) => {
    if (error) {
      console.error('Designer Multer Error:', error);
      return res.status(400).json({
        success: false,
        message: error.code === 'LIMIT_FILE_SIZE'
          ? 'Image size must be less than 10 MB'
          : error.message || 'Image upload validation failed'
      });
    }
    next();
  });
}, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid creative ID'
      });
    }
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please select an image'
      });
    }
    if (!process.env.CLOUDINARY_CLOUD_NAME ||
        !process.env.CLOUDINARY_API_KEY ||
        !process.env.CLOUDINARY_API_SECRET) {
      return res.status(500).json({
        success: false,
        message: 'Cloudinary configuration is missing'
      });
    }
    const creative = await Creative.findOne({
      _id: req.params.id,
      assignedDesigner: req.user.id
    });
    if (!creative) {
      return res.status(404).json({
        success: false,
        message: 'Creative not found or not assigned to you'
      });
    }
    const uploaded = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream({
        folder: 'creative-manager/designer-work',
        resource_type: 'image'
      }, (error, result) => {
        if (error) return reject(error);
        if (!result?.secure_url) {
          return reject(new Error('Cloudinary did not return an image URL'));
        }
        resolve(result);
      }).end(req.file.buffer);
    });
    creative.designerWork = creative.designerWork || {};
    creative.designerWork.uploads = creative.designerWork.uploads || [];
    creative.designerWork.uploads.push({
      url: uploaded.secure_url,
      publicId: uploaded.public_id,
      originalName: req.file.originalname,
      uploadedAt: new Date()
    });
    await creative.save();
    return res.status(200).json({
      success: true,
      message: 'Your work uploaded successfully',
      creative
    });
  } catch (error) {
    console.error('Designer work upload error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Unable to upload image'
    });
  }
});
export default router;
