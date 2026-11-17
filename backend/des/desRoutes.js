import express from 'express';
import multer from 'multer';
import mongoose from 'mongoose';
import { protect } from '../auth.js';
import Creative from '../sme/Creative.js';
import cloudinary from '../config/cloudinary.js';
import Admin from '../admin/Admin.js';
import { Des, ReportingManager } from '../admin/UserModels.js';
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
  redoCount: d.redoCount || 0,
  // earlier versions the SME sent back, newest first
  history: (d.history || [])
    .map((h) => ({
      url: h.url,
      originalName: h.originalName,
      mimeType: h.mimeType,
      size: h.size,
      uploadedAt: h.uploadedAt,
      note: h.note || '',
      reviewedAt: h.reviewedAt,
      version: h.version || 1
    }))
    .sort((a, b) => b.version - a.version)
} : null);
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
            creativeCount: 0,
            todoCount: 0
          });
        }
        const entry = companiesMap.get(companyId);
        entry.creativeCount += 1;
        // still needs the designer: nothing delivered yet, or the SME asked for a redo
        const out = creative.designOutput;
        if (!out?.url || out.status === 'redo') entry.todoCount += 1;
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
    const creatives = await Creative.find({ assignedDesigner: req.user.id })
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

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

const getMonthKey = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

const shiftMonth = (key, by) => {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + by, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);

// One month of a designer's work: totals, weekly activity, per-company totals and one row per creative.
const summariseMonth = (creatives, month) => {
  const inMonth = (value) => getMonthKey(value) === month;
  const weekly = ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5'].map((label) => ({ label, submitted: 0, approved: 0, redo: 0 }));
  const weekIndex = (value) => Math.min(4, Math.floor((new Date(value).getDate() - 1) / 7));
  const companyMap = new Map();
  const items = [];
  const stats = { assigned: 0, submitted: 0, approved: 0, redo: 0, pending: 0, totalVersions: 0, totalRedoRequests: 0 };

  creatives.forEach((creative) => {
    const design = creative.designOutput || null;
    const assignedDate = creative.assignedAt || creative.createdAt;
    const assignedThisMonth = inMonth(assignedDate);
    const submittedThisMonth = inMonth(design?.uploadedAt);
    const reviewedThisMonth = inMonth(design?.reviewedAt);
    const approvedThisMonth = reviewedThisMonth && design?.status === 'approved';
    const redoThisMonth = reviewedThisMonth && design?.status === 'redo';
    const pendingThisMonth = assignedThisMonth && !design?.url;
    if (!(assignedThisMonth || submittedThisMonth || approvedThisMonth || redoThisMonth)) return;

    if (assignedThisMonth) stats.assigned += 1;
    if (submittedThisMonth) stats.submitted += 1;
    if (approvedThisMonth) stats.approved += 1;
    if (redoThisMonth) stats.redo += 1;
    if (pendingThisMonth) stats.pending += 1;
    stats.totalVersions += submittedThisMonth ? (design?.version || 1) : 0;
    stats.totalRedoRequests += redoThisMonth ? 1 : 0;

    if (submittedThisMonth) weekly[weekIndex(design.uploadedAt)].submitted += 1;
    if (approvedThisMonth) weekly[weekIndex(design.reviewedAt)].approved += 1;
    if (redoThisMonth) weekly[weekIndex(design.reviewedAt)].redo += 1;

    const companyId = String(creative.company?._id || 'unknown');
    if (!companyMap.has(companyId)) {
      companyMap.set(companyId, {
        id: companyId,
        name: creative.company?.name || 'Unknown Company',
        logo: creative.company?.logo || '',
        assigned: 0, submitted: 0, approved: 0, redo: 0, pending: 0
      });
    }
    const company = companyMap.get(companyId);
    if (assignedThisMonth) company.assigned += 1;
    if (submittedThisMonth) company.submitted += 1;
    if (approvedThisMonth) company.approved += 1;
    if (redoThisMonth) company.redo += 1;
    if (pendingThisMonth) company.pending += 1;

    items.push({
      id: String(creative._id),
      title: creative.contentPillar?.title || 'Untitled Creative',
      company: creative.company?.name || 'Unknown Company',
      companyLogo: creative.company?.logo || '',
      scheduledDate: creative.date || '',
      assignedAt: assignedDate || null,
      uploadedAt: design?.uploadedAt || null,
      reviewedAt: design?.reviewedAt || null,
      status: !design?.url ? 'pending' : design.status || 'submitted',
      version: design?.version || 0,
      redoCount: design?.redoCount || 0,
      reviewNote: design?.note || creative.reviewNote || '',
      platform: creative.contentPillar?.platforms || []
    });
  });

  return {
    stats: {
      ...stats,
      completionRate: Math.min(100, pct(stats.submitted, stats.assigned)),
      // of the designs the SME reviewed this month, how many were approved first time round or after a redo
      approvalRate: pct(stats.approved, stats.approved + stats.redo)
    },
    weekly,
    companies: [...companyMap.values()].sort((a, b) => b.assigned - a.assigned),
    creatives: items.sort((a, b) => new Date(b.uploadedAt || b.assignedAt || 0) - new Date(a.uploadedAt || a.assignedAt || 0))
  };
};

// GET /monthly-reports?month=YYYY-MM&company=<id>   (company is optional: leave it out for every company)
router.get('/monthly-reports', async (req, res) => {
  try {
    const month = String(req.query.month || '');
    if (!MONTH_RE.test(month)) {
      return res.status(400).json({ success: false, message: 'Please select a valid month.' });
    }
    const company = String(req.query.company || '');
    if (company && !mongoose.isValidObjectId(company)) {
      return res.status(400).json({ success: false, message: 'Invalid company.' });
    }

    const filter = { assignedDesigner: req.user.id };
    if (company) filter.company = company;

    const [creatives, me, assignedCompanies] = await Promise.all([
      Creative.find(filter)
        .populate('company', 'name logo')
        .sort({ assignedAt: -1, createdAt: -1 })
        .lean(),
      Des.findById(req.user.id).select('name fullname email reportingManagerId').lean(),
      Creative.distinct('company', { assignedDesigner: req.user.id, company: { $ne: null } })
    ]);

    let manager = '';
    if (me?.reportingManagerId) {
      const found = (await ReportingManager.findById(me.reportingManagerId).select('name fullname email').lean())
        || (await Admin.findById(me.reportingManagerId).select('name fullname email').lean());
      manager = found?.name || found?.fullname || found?.email || '';
    }

    const previousMonth = shiftMonth(month, -1);
    const current = summariseMonth(creatives, month);
    const previous = summariseMonth(creatives, previousMonth);
    const [y, m] = month.split('-').map(Number);
    const last = String(new Date(y, m, 0).getDate()).padStart(2, '0');

    return res.json({
      success: true,
      month,
      previousMonth,
      periodFrom: `${month}-01`,
      periodTo: `${month}-${last}`,
      designer: {
        name: me?.name || me?.fullname || me?.email || '',
        email: me?.email || '',
        position: 'Design Executive (DES)',
        department: 'Design',
        manager
      },
      companyCount: assignedCompanies.length,
      company,
      stats: current.stats,
      previousStats: previous.stats,
      weekly: current.weekly,
      companies: current.companies,
      creatives: current.creatives
    });
  } catch (error) {
    console.error('DES monthly reports error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate monthly report.'
    });
  }
});

export default router;
