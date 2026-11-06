import express from 'express';
import multer from 'multer';
import cloudinary from '../config/cloudinary.js';
import mongoose from 'mongoose';
import { protect } from '../auth.js';
import Task from '../sme/Tasks.js';
import TaskAttachment from '../sme/TaskAttachment.js';
import SmiSopAssignment from '../sop/SmiSopAssignment.js';
import Company from '../company/Company.js';
import { periodKey, resolveToday } from '../sop/period.js';

const allowedTypes = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'video/mp4', 'video/webm', 'video/quicktime',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain', 'text/csv'
];
const taskFileUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024, files: 5 },
  fileFilter: (req, file, cb) => {
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error('Unsupported file type. Upload images, videos, PDF or supported documents.'));
    }
    cb(null, true);
  }
});
const uploadToCloudinary = (buffer, folder = 'creative-manager/tasks', resourceType = 'auto') => new Promise((resolve, reject) => {
  const stream = cloudinary.uploader.upload_stream({ folder, resource_type: resourceType }, (error, result) => {
    if (error) return reject(error);
    resolve(result);
  });
  stream.end(buffer);
});

const router = express.Router();
router.use(protect(['smi']));

const populateTask = (query) => query
  .populate('company', 'name')
  .populate('user', 'name email')
  .populate('assignedSmi', 'name email');

// Companies I still have work for: a company shows while it has an SOP (not yet done
// for the current period) or a task (not completed) assigned to me, in the order they
// were first assigned. Once everything of a company is complete it drops off.
router.get('/companies', async (req, res) => {
  try {
    const today = resolveToday(req.query.today);
    const [sops, tasks] = await Promise.all([
      SmiSopAssignment.find({ smi: req.user.id }).select('company createdAt type completions sourceSop').populate('sourceSop', 'completions').lean(),
      Task.find({ assignedSmi: req.user.id }).select('company createdAt status').lean(),
    ]);
    const sopPending = (a) => {
      const key = periodKey(a.type, today);
      const mine = (a.completions || []).some((c) => c.period === key);
      const bySme = (a.sourceSop?.completions || []).some((c) => c.period === key);
      return !mine && !bySme;
    };
    const pending = [...sops.filter(sopPending), ...tasks.filter((t) => t.status !== 'completed')];
    const first = new Map(); // companyId -> earliest assignment time
    for (const { company, createdAt } of pending) {
      const id = String(company);
      if (!first.has(id) || createdAt < first.get(id)) first.set(id, createdAt);
    }
    const ids = [...first.keys()].sort((a, b) => first.get(a) - first.get(b));
    const found = await Company.find({ _id: { $in: ids } }).lean();
    const byId = Object.fromEntries(found.map((c) => [String(c._id), c]));
    res.json({ companies: ids.filter((id) => byId[id]).map((id) => ({ id, name: byId[id].name })) });
  } catch (error) {
    console.error('SMI fetch companies error:', error);
    res.status(500).json({ message: 'Unable to fetch companies' });
  }
});

// ---------------- SOPs an SME assigned to me ----------------
const sopView = (a, today) => {
  const key = periodKey(a.type, today);
  return {
    id: a._id,
    type: a.type,
    text: a.text,
    date: a.date,
    active: a.date <= today, // not started yet -> can't be ticked
    period: key,
    done: (a.completions || []).some((c) => c.period === key),
    // The SME ticked the original SOP for this period: shown as completed by the SME, can't be ticked here.
    completedBySme: Boolean(a.sourceSop?.completions?.some((c) => c.period === key)),
    completions: (a.completions || []).map((c) => ({ period: c.period, at: c.at })),
    company: a.company ? { id: a.company._id, name: a.company.name } : { id: '', name: 'Removed company' },
    assignedBy: a.assignedBy ? { id: a.assignedBy._id, name: a.assignedBy.name } : { id: '', name: 'Removed SME' },
  };
};
const sopListFor = async (userId, today) => {
  const list = await SmiSopAssignment.find({ smi: userId })
    .sort({ date: -1, createdAt: -1 })
    .limit(300)
    .populate('company', 'name')
    .populate('assignedBy', 'name')
    .populate('sourceSop', 'completions');
  return list.map((a) => sopView(a, today));
};
router.get('/sop-assignments', async (req, res) => {
  try {
    const today = resolveToday(req.query.today);
    res.json({ assignments: await sopListFor(req.user.id, today), today });
  } catch (error) {
    console.error('SMI fetch SOPs error:', error);
    res.status(500).json({ message: 'Unable to fetch SOPs' });
  }
});
// Save ticks: body = { today, changes: [{ id, done }] }. A tick is saved for the
// current period only (today / this week / this month, by the SOP's type).
router.put('/sop-assignments/completions', async (req, res) => {
  try {
    const today = resolveToday(req.body.today);
    const changes = Array.isArray(req.body.changes) ? req.body.changes.slice(0, 200) : [];
    if (changes.some((c) => !mongoose.Types.ObjectId.isValid(c?.id) || typeof c.done !== 'boolean')) {
      return res.status(400).json({ message: 'Invalid changes' });
    }
    for (const { id, done } of changes) {
      const sop = await SmiSopAssignment.findOne({ _id: id, smi: req.user.id }).populate('sourceSop', 'completions');
      if (!sop || sop.date > today) continue; // not mine, or hasn't started yet
      const key = periodKey(sop.type, today);
      if (sop.sourceSop?.completions?.some((c) => c.period === key)) {
        return res.status(409).json({ message: 'Your SME has already completed this SOP' });
      }
      const has = sop.completions.some((c) => c.period === key);
      if (done && !has) sop.completions.push({ period: key, at: new Date() });
      if (!done && has) sop.completions = sop.completions.filter((c) => c.period !== key);
      if (done !== has) await sop.save();
    }
    res.json({ assignments: await sopListFor(req.user.id, today), today });
  } catch (error) {
    console.error('SMI tick SOP error:', error);
    res.status(500).json({ message: 'Unable to save SOP' });
  }
});

// GET: tasks an SME assigned to the logged-in SMI
router.get('/tasks', async (req, res) => {
  try {
    const tasks = await populateTask(Task.find({ assignedSmi: req.user.id }).sort({ createdAt: -1 }));
    res.json({ tasks });
  } catch (error) {
    console.error('SMI fetch tasks error:', error);
    res.status(500).json({ message: 'Unable to fetch tasks' });
  }
});

router.patch('/tasks/:id/start', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ message: 'Invalid task' });
    const task = await Task.findOne({ _id: req.params.id, assignedSmi: req.user.id, status: 'new' });
    if (!task) return res.status(404).json({ message: 'Task not found or already started' });
    task.status = 'in-progress';
    task.startedAt = new Date();
    await task.save();
    res.json({ message: 'Task started successfully', task: await populateTask(Task.findById(task._id)) });
  } catch (error) {
    console.error('SMI start task error:', error);
    res.status(500).json({ message: 'Unable to start task' });
  }
});

router.patch('/tasks/:id/end', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ message: 'Invalid task' });
    const task = await Task.findOne({ _id: req.params.id, assignedSmi: req.user.id, status: 'in-progress' });
    if (!task) return res.status(404).json({ message: 'Task not found or not in progress' });
    task.status = 'completed';
    task.endedAt = new Date();
    await task.save();
    res.json({ message: 'Task completed successfully', task: await populateTask(Task.findById(task._id)) });
  } catch (error) {
    console.error('SMI end task error:', error);
    res.status(500).json({ message: 'Unable to complete task' });
  }
});

// Attachments the SME added to a task assigned to me (view only)
router.get('/tasks/:taskId/attachments', async (req, res) => {
  try {
    const { taskId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(taskId)) return res.status(400).json({ message: 'Invalid task ID.' });
    const task = await Task.findOne({ _id: taskId, assignedSmi: req.user.id });
    if (!task) return res.status(404).json({ message: 'Task not found.' });
    const attachments = await TaskAttachment.find({ task: taskId }).sort({ createdAt: -1 }).lean();
    res.json({
      attachments: attachments.map((item) => ({
        _id: item._id,
        originalName: item.originalName,
        mimeType: item.mimeType,
        fileType: item.fileType || (item.mimeType?.startsWith('image/') ? 'image' : item.mimeType === 'application/pdf' ? 'pdf' : item.mimeType?.startsWith('video/') ? 'video' : 'document'),
        size: item.size,
        fileUrl: item.fileUrl || item.imageUrl,
        canDelete: String(item.user) === String(req.user.id),
        createdAt: item.createdAt
      }))
    });
  } catch (error) {
    console.error('SMI fetch attachments error:', error);
    res.status(500).json({ message: 'Unable to load task attachments.' });
  }
});

router.post('/tasks/:taskId/attachments', (req, res, next) => {
  taskFileUpload.array('files', 5)(req, res, (error) => {
    if (error) return res.status(400).json({ message: error.message });
    next();
  });
}, async (req, res) => {
  const uploadedFiles = [];
  try {
    const { taskId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(taskId)) return res.status(400).json({ message: 'Invalid task ID.' });
    const task = await Task.findOne({ _id: taskId, assignedSmi: req.user.id });
    if (!task) return res.status(404).json({ message: 'Task not found.' });
    if (!req.files?.length) return res.status(400).json({ message: 'Please select at least one file.' });
    const existingCount = await TaskAttachment.countDocuments({ task: taskId });
    if (existingCount + req.files.length > 5) {
      return res.status(400).json({ message: `You can upload only ${Math.max(5 - existingCount, 0)} more file(s).` });
    }
    for (const file of req.files) {
      const result = await uploadToCloudinary(file.buffer);
      const fileType = file.mimetype.startsWith('image/') ? 'image'
        : file.mimetype.startsWith('video/') ? 'video'
          : file.mimetype === 'application/pdf' ? 'pdf' : 'document';
      uploadedFiles.push({
        task: taskId,
        user: req.user.id,
        originalName: file.originalname,
        mimeType: file.mimetype,
        fileType,
        size: file.size,
        fileUrl: result.secure_url,
        publicId: result.public_id,
        resourceType: result.resource_type
      });
    }
    const saved = await TaskAttachment.insertMany(uploadedFiles);
    res.status(201).json({
      message: 'Files uploaded successfully.',
      attachments: saved.map((item) => ({
        _id: item._id, originalName: item.originalName, mimeType: item.mimeType, fileType: item.fileType,
        size: item.size, fileUrl: item.fileUrl, canDelete: true, createdAt: item.createdAt
      }))
    });
  } catch (error) {
    await Promise.all(uploadedFiles.map((item) =>
      cloudinary.uploader.destroy(item.publicId, { resource_type: item.resourceType }).catch(() => null)
    ));
    console.error('SMI attachment upload error:', error);
    res.status(500).json({ message: 'Unable to upload files.' });
  }
});

// An SMI can delete only the files they uploaded themselves
router.delete('/tasks/:taskId/attachments/:attachmentId', async (req, res) => {
  try {
    const { taskId, attachmentId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(taskId) || !mongoose.Types.ObjectId.isValid(attachmentId)) {
      return res.status(400).json({ message: 'Invalid request.' });
    }
    const task = await Task.findOne({ _id: taskId, assignedSmi: req.user.id });
    if (!task) return res.status(404).json({ message: 'Task not found.' });
    const attachment = await TaskAttachment.findOne({ _id: attachmentId, task: task._id, user: req.user.id });
    if (!attachment) return res.status(404).json({ message: 'File not found, or you did not upload it.' });
    if (attachment.publicId) {
      await cloudinary.uploader.destroy(attachment.publicId, { resource_type: attachment.resourceType || 'image' });
    }
    await TaskAttachment.deleteOne({ _id: attachment._id });
    res.json({ message: 'File deleted successfully.' });
  } catch (error) {
    console.error('SMI delete attachment error:', error);
    res.status(500).json({ message: 'Unable to delete file.' });
  }
});

export default router;
