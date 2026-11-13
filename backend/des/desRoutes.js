import express from 'express';
import multer from 'multer';
import mongoose from 'mongoose';
import { protect } from '../auth.js';
import Creative from '../sme/Creative.js';
import cloudinary from '../config/cloudinary.js';
const router = express.Router();
const MAX_FILE_MB = 10;
const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'video/mp4', 'video/webm', 'video/quicktime',
  'application/pdf'
];
const designUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_MB * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      return cb(new Error('Unsupported file type. Upload JPG, PNG, WEBP, GIF, MP4, WEBM, MOV or PDF files.'));
    }
    cb(null, true);
  }
});
const uploadErrorMessage = (err) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') return `Each file must be ${MAX_FILE_MB}MB or smaller.`;
    if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') return 'Please upload only one file.';
  }
  return err.message || 'File upload failed.';
};
// Cloudinary stores PDFs under the "image" resource type
const resourceTypeFor = (mimetype) => (mimetype.startsWith('video/') ? 'video' : 'image');
const uploadBuffer = (file) => new Promise((resolve, reject) => {
  const resource_type = resourceTypeFor(file.mimetype);
  const stream = cloudinary.uploader.upload_stream(
    { folder: 'creative-manager/designs', resource_type },
    (error, result) => (error ? reject(error) : resolve({ ...result, resource_type }))
  );
  stream.end(file.buffer);
});
export const designView = (d) => (d ? {
  url: d.url,
  originalName: d.originalName,
  mimeType: d.mimeType,
  size: d.size,
  uploadedAt: d.uploadedAt,
  status: d.status,
  note: d.note || '',
  reviewedAt: d.reviewedAt,
  version: d.version || 1,
  redoCount: d.redoCount || 0
} : null);
router.use(protect(['des']));
router.get('/companies', async (req, res) => {
  try {
    const creatives = await Creative.find({
      assignedDesigner: req.user.id,
      company: { $ne: null },
      'designOutput.url': { $exists: true, $nin: ['', null] }
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
      assignedDesigner: req.user.id,
      'designOutput.url': { $exists: true, $nin: ['', null] }
    })
      .populate('company', 'name logo')
      .populate('user', 'name fullname email')
      .sort({ date: 1, createdAt: -1 })
      .lean();
    return res.status(200).json({
      success: true,
      count: creatives.length,
      creatives: creatives.map((c) => ({
        ...c,
        designOutput: designView(c.designOutput)
      }))
    });
  } catch (error) {
    console.error('DES creatives error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch uploaded creatives'
    });
  }
});
// Designer delivers ONE finished file per creative. Uploading again replaces it (used after the SME asks for a redo).
router.post('/creatives/:id/design', (req, res) => {
  designUpload.single('file')(req, res, async (uploadError) => {
    if (uploadError) return res.status(400).json({ message: uploadErrorMessage(uploadError) });
    let uploaded = null;
    try {
      if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({ message: 'Invalid creative id.' });
      }
      if (!req.file) {
        return res.status(400).json({ message: 'Please choose a file to upload.' });
      }
      const creative = await Creative.findOne({ _id: req.params.id, assignedDesigner: req.user.id });
      if (!creative) {
        return res.status(404).json({ message: 'Creative not found or not assigned to you.' });
      }
      const cur = creative.designOutput;
      if (cur?.status === 'approved') {
        return res.status(400).json({ message: 'This design was already approved, so it can no longer be changed.' });
      }
      const prev = cur
        ? {
          status: cur.status,
          url: cur.url,
          publicId: cur.publicId,
          resourceType: cur.resourceType,
          originalName: cur.originalName,
          mimeType: cur.mimeType,
          size: cur.size,
          uploadedAt: cur.uploadedAt,
          note: cur.note,
          reviewedAt: cur.reviewedAt,
          version: cur.version || 1,
          redoCount: cur.redoCount || 0,
          history: (cur.history || []).map((h) => h.toObject())
        }
        : null;
      const result = await uploadBuffer(req.file);
      uploaded = { publicId: result.public_id, resourceType: result.resource_type };
      // A version the SME sent back for a redo is kept in the history; one replaced before review is simply dropped.
      const keepPrev = prev?.status === 'redo';
      const history = prev ? [...prev.history] : [];
      if (keepPrev) {
        history.push({
          url: prev.url,
          publicId: prev.publicId,
          resourceType: prev.resourceType,
          originalName: prev.originalName,
          mimeType: prev.mimeType,
          size: prev.size,
          uploadedAt: prev.uploadedAt,
          note: prev.note,
          reviewedAt: prev.reviewedAt,
          version: prev.version
        });
      }
      creative.designOutput = {
        history,
        url: result.secure_url,
        publicId: result.public_id,
        resourceType: result.resource_type,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        uploadedAt: new Date(),
        status: 'submitted',
        note: '',
        reviewedAt: null,
        version: (prev?.version || 0) + 1,
        redoCount: prev?.redoCount || 0
      };
      await creative.save();
      if (prev && !keepPrev && prev.publicId) {
        await cloudinary.uploader.destroy(prev.publicId, { resource_type: prev.resourceType || 'image' }).catch(() => null);
      }
      return res.status(201).json({ message: 'Design uploaded.', designOutput: designView(creative.designOutput) });
    } catch (error) {
      if (uploaded) await cloudinary.uploader.destroy(uploaded.publicId, { resource_type: uploaded.resourceType }).catch(() => null);
      console.error('DES upload error:', error);
      return res.status(500).json({ message: error.message || 'Failed to upload design.' });
    }
  });
});
export default router;
