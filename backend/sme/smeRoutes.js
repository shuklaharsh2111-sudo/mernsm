import multer from 'multer';
import cloudinary from '../config/cloudinary.js';
import express from 'express';
import mongoose from 'mongoose';
import { protect } from '../auth.js';
import Sme from './Sme.js';
import Company from '../company/Company.js';
import SopAssignment from '../sop/SopAssignment.js';
import { periodKey, resolveToday } from '../sop/period.js';
import Task from './Tasks.js';
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
  fileFilter: (req, file, cb) => {
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimetype)) {
      return cb(new Error('Only JPG, PNG, WEBP and GIF images are allowed'));
    }
    cb(null, true);
  }
});
const uploadToCloudinary = (buffer) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({
      folder: 'creative-manager/tasks',
      resource_type: 'image'
    }, (error, result) => {
      if (error) return reject(error);
      resolve(result);
    });
    stream.end(buffer);
  });
};
const router = express.Router();
router.use(protect(['sme']));
// Companies the admin assigned to the logged-in SME (max 5), in the order assigned.
router.get('/companies', async (req, res) => {
  const me = await Sme.findById(req.user.id);
  if (!me) return res.status(401).json({ message: 'User not found' });
  const ids = (me.companies || []).map(String);
  const found = await Company.find({ _id: { $in: ids } });
  const byId = Object.fromEntries(found.map((c) => [String(c._id), c]));
  const companies = ids.filter((id) => byId[id]).map((id) => ({ id, name: byId[id].name }));
  res.json({ companies });
});
const view = (a, today) => {
  const key = periodKey(a.type, today);
  return {
    id: a._id,
    type: a.type,
    text: a.text,
    date: a.date,
    active: a.date <= today, // not started yet -> can't be ticked
    period: key,
    done: (a.completions || []).some((c) => c.period === key),
    completions: (a.completions || []).map((c) => ({ period: c.period, at: c.at })),
    company: a.company ? { id: a.company._id, name: a.company.name } : { id: '', name: 'Removed company' },
  };
};
const listFor = async (userId, today) => {
  const list = await SopAssignment.find({ user: userId })
    .sort({ date: -1, createdAt: -1 })
    .limit(300)
    .populate('company', 'name');
  return list.map((a) => view(a, today));
};
// SOPs the admin assigned to me, with this period's tick state.
router.get('/sop-assignments', async (req, res) => {
  const today = resolveToday(req.query.today);
  res.json({ assignments: await listFor(req.user.id, today), today });
});
// Save ticks: body = { today, changes: [{ id, done }] }. A tick is saved for the
// current period only (today / this week / this month, by the SOP's type).
router.put('/sop-assignments/completions', async (req, res) => {
  const today = resolveToday(req.body.today);
  const changes = Array.isArray(req.body.changes) ? req.body.changes.slice(0, 200) : [];
  if (changes.some((c) => !mongoose.Types.ObjectId.isValid(c?.id) || typeof c.done !== 'boolean')) {
    return res.status(400).json({ message: 'Invalid changes' });
  }
  for (const { id, done } of changes) {
    const sop = await SopAssignment.findOne({ _id: id, user: req.user.id });
    if (!sop || sop.date > today) continue; // not mine, or hasn't started yet
    const key = periodKey(sop.type, today);
    const has = sop.completions.some((c) => c.period === key);
    if (done && !has) sop.completions.push({ period: key, at: new Date() });
    if (!done && has) sop.completions = sop.completions.filter((c) => c.period !== key);
    if (done !== has) await sop.save();
  }
  res.json({ assignments: await listFor(req.user.id, today), today });
});
// =========================================
// TASK MANAGER APIs
// =========================================
// GET: Logged-in SME ke saare tasks
router.get('/tasks', async (req, res) => {
  try {
    const tasks = await Task.find({
      user: req.user.id
    })
      .populate('company', 'name')
      .sort({ createdAt: -1 });
    res.json({ tasks });
  } catch (error) {
    console.error('Fetch Tasks Error:', error);
    res.status(500).json({
      message: 'Unable to fetch tasks'
    });
  }
});
// POST: Create a new task
router.post('/tasks', async (req, res) => {
  try {
    const {
      companyId,
      title,
      category,
      frequencyDays,
      tatDays,
      taskType,
      objective,
      customObjective,
      priority
    } = req.body;
    // Required fields
    if (
      !companyId ||
      !title?.trim() ||
      !category ||
      !tatDays ||
      !taskType ||
      !objective ||
      !priority
    ) {
      return res.status(400).json({
        message: 'Please fill all required fields'
      });
    }
    // Validate company ID
    if (!mongoose.Types.ObjectId.isValid(companyId)) {
      return res.status(400).json({
        message: 'Invalid company selected'
      });
    }
    // Verify logged-in SME
    const me = await Sme.findById(req.user.id);
    if (!me) {
      return res.status(401).json({
        message: 'SME account not found'
      });
    }
    // Check whether company is assigned to this SME
    const isAssigned = (me.companies || []).some(
      (id) => String(id) === String(companyId)
    );
    if (!isAssigned) {
      return res.status(403).json({
        message: 'You are not assigned to this company'
      });
    }
    // Validate category
    if (!['one-time', 'recurring'].includes(category)) {
      return res.status(400).json({
        message: 'Invalid task category'
      });
    }
    // Validate frequency
    let selectedFrequency = null;
    if (category === 'recurring') {
      selectedFrequency = Number(frequencyDays);
      if (![7, 15, 30].includes(selectedFrequency)) {
        return res.status(400).json({
          message: 'Select a valid recurring frequency'
        });
      }
    }
    // Validate TAT
    const selectedTat = Number(tatDays);
    if (
      !Number.isInteger(selectedTat) ||
      selectedTat < 1 ||
      selectedTat > 3650
    ) {
      return res.status(400).json({
        message: 'TAT must be a valid number of days'
      });
    }
    // Validate task type
    const allowedTaskTypes = [
      'Strategy/Pitch Deck',
      'Mood Board',
      'Shoots',
      'Content Planning',
      'Content Writing',
      'Influencer Collaboration'
    ];
    if (!allowedTaskTypes.includes(taskType)) {
      return res.status(400).json({
        message: 'Invalid task type'
      });
    }
    // Validate objective
    const allowedObjectives = [
      'Brand Awareness',
      'Lead Generation',
      'Brand Positioning',
      'Others'
    ];
    if (!allowedObjectives.includes(objective)) {
      return res.status(400).json({
        message: 'Invalid objective'
      });
    }
    if (
      objective === 'Others' &&
      !customObjective?.trim()
    ) {
      return res.status(400).json({
        message: 'Please enter your custom objective'
      });
    }
    // Validate priority
    if (!['High', 'Low', 'Critical'].includes(priority)) {
      return res.status(400).json({
        message: 'Invalid priority'
      });
    }
    // Create task
    const task = await Task.create({
      user: req.user.id,
      company: companyId,
      title: title.trim(),
      category,
      frequencyDays: selectedFrequency,
      tatDays: selectedTat,
      taskType,
      objective,
      customObjective:
        objective === 'Others' ? customObjective.trim() : '',
      priority,
      status: 'new'
    });
    await task.populate('company', 'name');
    return res.status(201).json({
      message: 'Task created successfully',
      task
    });
  } catch (error) {
    console.error('Create Task Error:', error);
    res.status(500).json({
      message: 'Unable to create task'
    });
  }
});
// Start task
router.patch('/tasks/:id/start', async (req, res) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, user: req.user.id, status: 'new' });
    if (!task) return res.status(404).json({ message: 'Task not found or already started' });
    task.status = 'in-progress';
    task.startedAt = new Date();
    await task.save();
    const updatedTask = await Task.findById(task._id).populate('company', 'name');
    res.json({ message: 'Task started successfully', task: updatedTask });
  } catch (error) {
    console.error('Start task error:', error);
    res.status(500).json({ message: 'Unable to start task' });
  }
});
// End task
router.patch('/tasks/:id/end', async (req, res) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, user: req.user.id, status: 'in-progress' });
    if (!task) return res.status(404).json({ message: 'Task not found or not in progress' });
    task.status = 'completed';
    task.endedAt = new Date();
    await task.save();
    const updatedTask = await Task.findById(task._id).populate('company', 'name');
    res.json({ message: 'Task completed successfully', task: updatedTask });
  } catch (error) {
    console.error('End task error:', error);
    res.status(500).json({ message: 'Unable to complete task' });
  }
});
// Upload task images to Cloudinary
router.post('/tasks/:id/attachments', (req, res) => {
  upload.array('files', 5)(req, res, async (uploadError) => {
    if (uploadError) {
      return res.status(400).json({ message: uploadError.message });
    }

    const uploadedImages = [];

    try {
      const files = req.files || [];

      if (!files.length) {
        return res.status(400).json({ message: 'Please select at least one image' });
      }

      const task = await Task.findOne({
        _id: req.params.id,
        user: req.user.id
      });

      if (!task) {
        return res.status(404).json({ message: 'Task not found' });
      }

      for (const file of files) {
        const result = await uploadToCloudinary(file.buffer);

        uploadedImages.push({
          url: result.secure_url,
          publicId: result.public_id,
          originalName: file.originalname,
          uploadedAt: new Date()
        });
      }

      task.attachments.push(...uploadedImages);
      await task.save();

      const updatedTask = await Task.findById(task._id).populate('company', 'name');

      return res.json({
        message: 'Images uploaded successfully',
        task: updatedTask
      });

    } catch (error) {
      await Promise.all(
        uploadedImages.map((image) =>
          cloudinary.uploader.destroy(image.publicId).catch(() => null)
        )
      );

      console.error('Task attachment error:', error);
      return res.status(500).json({ message: 'Unable to upload images' });
    }
  });
});
export default router;
