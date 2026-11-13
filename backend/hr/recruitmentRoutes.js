import express from 'express';
import multer from 'multer';
import mongoose from 'mongoose';
import cloudinary from '../config/cloudinary.js';
import Candidate from './Candidate.js';
import { extractResume, parseResumeText, RESUME_EXTS, IMAGE_EXTS, extOf } from './resumeParser.js';
import { parseWithPython } from './pythonParser.js';

const router = express.Router();
const validId = (id) => mongoose.Types.ObjectId.isValid(id);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MAX_MB = 8;
const resumeUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_MB * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (RESUME_EXTS.includes(extOf(file))) return cb(null, true);
    cb(new Error('Unsupported file. Upload a PDF, Word (DOC/DOCX), TXT, RTF or an image (JPG, PNG, WEBP).'));
  }
}).single('resume');

// Turn multer errors into a normal 400 JSON message
const withUpload = (handler) => (req, res, next) =>
  resumeUpload(req, res, (err) => {
    if (err) {
      const message = err.code === 'LIMIT_FILE_SIZE' ? `The resume must be ${MAX_MB}MB or smaller.` : err.message;
      return res.status(400).json({ message });
    }
    return Promise.resolve(handler(req, res, next)).catch(next);
  });

const uploadResume = (file) => new Promise((resolve, reject) => {
  const ext = extOf(file);
  // PDFs and pictures are stored as "image" (browsers can open them); Word/text files must be "raw"
  const resource_type = ext === 'pdf' || IMAGE_EXTS.includes(ext) ? 'image' : 'raw';
  const safe = String(file.originalname || 'resume').replace(/[^\w.-]+/g, '_');
  const options = { folder: 'creative-manager/resumes', resource_type };
  if (resource_type === 'raw') options.public_id = `${Date.now()}-${safe}`;
  cloudinary.uploader.upload_stream(options, (error, result) => {
    if (error) return reject(error);
    resolve({ url: result.secure_url, publicId: result.public_id, resourceType: resource_type, originalName: file.originalname || '' });
  }).end(file.buffer);
});

const view = (c) => ({
  id: String(c._id),
  name: c.name,
  mobile: c.mobile || '',
  email: c.email || '',
  position: c.position || '',
  resume: c.resume?.url ? { url: c.resume.url, name: c.resume.originalName || 'Resume' } : null,
  shortlisted: !!c.shortlisted,
  callDone: !!c.callDone,
  interviewAt: c.interviewAt || null,
  remark: c.remark || '',
  remarkAt: c.remarkAt || null,
  createdAt: c.createdAt
});

const cleanMobile = (v) => String(v || '').replace(/[^\d+]/g, '').slice(0, 16);

// Step 1 — read the resume and suggest the details (name, mobile, email, position). Nothing is saved yet.
// The Python reader (pdfplumber / python-docx / OCR) is used first; if Python or its packages are
// not installed on the server, the built-in JavaScript reader takes over.
router.post('/parse', withUpload(async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Choose a resume file first.' });

  const py = await parseWithPython(req.file);
  if (py.ok) {
    // Some designs trip one reader but not the other: when Python left something empty, ask the JS reader
    // too and only use it to fill the blanks (it never overwrites what Python found).
    if (py.missing && py.missing.length) {
      try {
        const alt = await extractResume(req.file);
        if (alt.text.trim()) {
          const jsFields = parseResumeText(alt.text, req.file.originalname, alt.hints);
          py.missing.forEach((k) => { if (jsFields[k]) py.fields[k] = jsFields[k]; });
          py.missing = ['name', 'mobile', 'email', 'position'].filter((k) => !py.fields[k]);
        }
      } catch (err) {
        console.warn('JS reader (second opinion) failed:', err.message);
      }
    }
    return res.json({ fields: py.fields, missing: py.missing, engine: 'python' });
  }
  if (py.code === 'no_python' || py.code === 'missing_dependency' || py.code === 'crashed') {
    console.warn(`Python resume reader unavailable (${py.error}) - using the JavaScript reader. Run "pip install -r requirements.txt" in backend/hr/python.`);
  }

  let read;
  try {
    read = await extractResume(req.file);
  } catch (err) {
    console.error('Resume read failed:', err);
    return res.status(422).json({ message: err.message || 'Could not read this file. Fill in the details by hand.' });
  }
  if (!read.text.trim()) {
    return res.status(422).json({ message: 'No text could be read from this file. Upload a Word file or a clear photo of the resume, or fill in the details by hand.' });
  }
  const fields = parseResumeText(read.text, req.file.originalname, read.hints);
  const missing = ['name', 'mobile', 'email', 'position'].filter((k) => !fields[k]);
  res.json({ fields, missing, engine: 'js' });
}));

router.get('/', async (req, res) => {
  const list = await Candidate.find().sort({ createdAt: -1 }).limit(1000);
  res.json({ candidates: list.map(view) });
});

// Step 2 — save the candidate (with the resume file) after HR has checked the details.
router.post('/', withUpload(async (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const mobile = cleanMobile(req.body.mobile);
  const position = String(req.body.position || '').trim();
  if (!name) return res.status(400).json({ message: 'Candidate name is required.' });
  if (email && !EMAIL_RE.test(email)) return res.status(400).json({ message: 'Enter a valid email address.' });
  if (!email && !mobile) return res.status(400).json({ message: 'Add an email or a mobile number.' });

  const dup = await Candidate.findOne({ $or: [email ? { email } : null, mobile ? { mobile } : null].filter(Boolean) });
  if (dup) return res.status(409).json({ message: `${dup.name} is already in the list with the same email or mobile.` });

  let resume;
  let warning = '';
  if (req.file) {
    try {
      resume = await uploadResume(req.file);
    } catch (err) {
      console.error('Resume upload failed:', err.message);
      warning = 'Candidate saved, but the resume file could not be uploaded.';
    }
  }
  const candidate = await Candidate.create({ name, email, mobile, position, resume, createdBy: req.user.id });
  res.status(201).json({ candidate: view(candidate), warning });
}));

// Inline edits from the table (checkboxes, interview schedule, remark, details)
router.put('/:id', async (req, res) => {
  if (!validId(req.params.id)) return res.status(404).json({ message: 'Candidate not found.' });
  const c = await Candidate.findById(req.params.id);
  if (!c) return res.status(404).json({ message: 'Candidate not found.' });
  const b = req.body || {};

  if ('name' in b) {
    const name = String(b.name || '').trim();
    if (!name) return res.status(400).json({ message: 'Candidate name is required.' });
    c.name = name;
  }
  if ('email' in b) {
    const email = String(b.email || '').trim().toLowerCase();
    if (email && !EMAIL_RE.test(email)) return res.status(400).json({ message: 'Enter a valid email address.' });
    c.email = email;
  }
  if ('mobile' in b) c.mobile = cleanMobile(b.mobile);
  if ('position' in b) c.position = String(b.position || '').trim().slice(0, 80);
  if ('shortlisted' in b) c.shortlisted = !!b.shortlisted;
  if ('callDone' in b) c.callDone = !!b.callDone;
  if ('interviewAt' in b) {
    if (!b.interviewAt) c.interviewAt = null;
    else {
      const d = new Date(b.interviewAt);
      if (Number.isNaN(d.getTime())) return res.status(400).json({ message: 'Enter a valid interview date and time.' });
      c.interviewAt = d;
    }
  }
  if ('remark' in b) {
    const remark = String(b.remark || '').trim().slice(0, 1000);
    if (remark !== c.remark) { c.remark = remark; c.remarkAt = remark ? new Date() : null; }
  }
  await c.save();
  res.json({ candidate: view(c) });
});

router.delete('/:id', async (req, res) => {
  if (!validId(req.params.id)) return res.status(404).json({ message: 'Candidate not found.' });
  const c = await Candidate.findByIdAndDelete(req.params.id);
  if (!c) return res.status(404).json({ message: 'Candidate not found.' });
  if (c.resume?.publicId) {
    await cloudinary.uploader.destroy(c.resume.publicId, { resource_type: c.resume.resourceType || 'image' })
      .catch((e) => console.error('Resume deletion failed:', e.message));
  }
  res.json({ message: 'Candidate removed.' });
});

export default router;
