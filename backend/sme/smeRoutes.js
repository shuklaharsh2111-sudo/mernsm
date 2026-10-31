import multer from 'multer';
import cloudinary from '../config/cloudinary.js';
import express from 'express';
import mongoose from 'mongoose';
import { protect } from '../auth.js';
import Sme from './Sme.js';
import Company from '../company/Company.js';
import SopAssignment from '../sop/SopAssignment.js';
import Meeting from '../meeting/Meeting.js';
import { momView, buildMom, generateMeetingLink } from '../meeting/momHelpers.js';
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
const meetingView = (m) => ({
  id: m._id,
  subject: m.subject,
  date: m.date,
  time: m.time,
  link: m.link || '',
  joined: Boolean(m.joinedAt),
  priority: m.priority || '',
  fromMom: Boolean(m.fromMeeting),
  attendees: (m.attendees || []).map((a) => ({ name: a.name, designation: a.designation || '' })),
  company: m.company ? { id: m.company._id, name: m.company.name } : { id: '', name: 'Removed company' },
  mom: momView(m.mom),
});

// My meetings, soonest first.
router.get('/meetings', async (req, res) => {
  const list = await Meeting.find({ user: req.user.id }).sort({ date: 1, time: 1 }).limit(300).populate('company', 'name');
  res.json({ meetings: list.map(meetingView) });
});

// Create a meeting: { subject, company, date, time, link?, attendees: [{ name, designation }] }
router.post('/meetings', async (req, res) => {
  const { subject, company, date, time, link } = req.body || {};
  const subj = String(subject || '').trim();
  if (subj.length < 3) return res.status(400).json({ message: 'Subject must be at least 3 characters' });
  if (!mongoose.Types.ObjectId.isValid(company)) return res.status(400).json({ message: 'Select a company' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return res.status(400).json({ message: 'Date is required' });
  if (!/^\d{2}:\d{2}$/.test(time || '')) return res.status(400).json({ message: 'Time is required' });

  // The company must be one the admin assigned to me.
  const me = await Sme.findById(req.user.id);
  if (!me) return res.status(401).json({ message: 'User not found' });
  if (!(me.companies || []).map(String).includes(String(company))) {
    return res.status(400).json({ message: 'That company is not assigned to you' });
  }

  const cleanLink = String(link || '').trim();
  if (cleanLink && !/^https?:\/\/\S+$/i.test(cleanLink)) {
    return res.status(400).json({ message: 'Meeting link must start with http:// or https://' });
  }

  const rawAttendees = Array.isArray(req.body.attendees) ? req.body.attendees.slice(0, 50) : [];
  const attendees = rawAttendees.map((a) => ({
    name: String(a?.name || '').trim(),
    designation: String(a?.designation || '').trim(),
  }));
  if (attendees.length === 0) return res.status(400).json({ message: 'Add at least one attendee' });
  if (attendees.some((a) => !a.name || !a.designation)) {
    return res.status(400).json({ message: 'Every attendee needs a name and a designation' });
  }

  const created = await Meeting.create({ user: req.user.id, company, subject: subj, date, time, link: cleanLink || generateMeetingLink(subj), attendees });
  await created.populate('company', 'name');
  res.status(201).json({ meeting: meetingView(created) });
});

// Add more attendees to a meeting: { attendees: [{ name, designation }] } (appended to the existing ones).
// Locked once a MOM exists, because the MOM's attendance list is built from the attendees.
router.put('/meetings/:id/attendees', async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ message: 'Invalid meeting' });
  const meeting = await Meeting.findOne({ _id: req.params.id, user: req.user.id }).populate('company', 'name');
  if (!meeting) return res.status(404).json({ message: 'Meeting not found' });
  if (meeting.mom?.submittedAt) {
    return res.status(400).json({ message: 'Attendees cannot be changed after the MOM is submitted' });
  }

  const incoming = (Array.isArray(req.body?.attendees) ? req.body.attendees : []).slice(0, 50).map((a) => ({
    name: String(a?.name || '').trim(),
    designation: String(a?.designation || '').trim(),
  }));
  if (incoming.length === 0) return res.status(400).json({ message: 'Add at least one attendee' });
  if (incoming.some((a) => !a.name || !a.designation)) {
    return res.status(400).json({ message: 'Every attendee needs a name and a designation' });
  }
  if (meeting.attendees.length + incoming.length > 50) {
    return res.status(400).json({ message: 'A meeting can have at most 50 attendees' });
  }

  const key = (a) => `${a.name.toLowerCase()}|${a.designation.toLowerCase()}`;
  const existing = new Set(meeting.attendees.map(key));
  for (const a of incoming) {
    if (existing.has(key(a))) return res.status(400).json({ message: `${a.name} (${a.designation}) is already an attendee` });
    existing.add(key(a));
  }

  meeting.attendees.push(...incoming);
  await meeting.save();
  res.json({ meeting: meetingView(meeting) });
});

// Records: every meeting whose MOM the admin approved, newest first.
router.get('/records', async (req, res) => {
  const list = await Meeting.find({ user: req.user.id, 'mom.status': 'approved' })
    .sort({ 'mom.reviewedAt': -1 })
    .limit(300)
    .populate('company', 'name');
  res.json({ records: list.map(meetingView) });
});

// Join Now: only allowed from the meeting's date + time. Body: { now: 'YYYY-MM-DDTHH:mm' } (the user's local time).
router.put('/meetings/:id/join', async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ message: 'Invalid meeting' });
  const meeting = await Meeting.findOne({ _id: req.params.id, user: req.user.id }).populate('company', 'name');
  if (!meeting) return res.status(404).json({ message: 'Meeting not found' });

  const now = String(req.body?.now || '');
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(now)) return res.status(400).json({ message: 'Invalid time' });
  if (now < `${meeting.date}T${meeting.time}`) {
    return res.status(400).json({ message: 'This meeting has not started yet' });
  }

  if (!meeting.joinedAt) {
    meeting.joinedAt = new Date();
    await meeting.save();
  }
  res.json({ meeting: meetingView(meeting) });
});

// Submit the minutes of a meeting for the admin's approval (re-submit after a rejection).
router.put('/meetings/:id/mom', async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ message: 'Invalid meeting' });
  const meeting = await Meeting.findOne({ _id: req.params.id, user: req.user.id }).populate('company', 'name');
  if (!meeting) return res.status(404).json({ message: 'Meeting not found' });
  if (!meeting.joinedAt) return res.status(400).json({ message: 'Join the meeting before sending the MOM' });
  if (meeting.mom?.submittedAt && ['approved', 'rejected'].includes(meeting.mom.status)) {
    return res.status(400).json({ message: `This MOM is already ${meeting.mom.status} and cannot be changed` });
  }

  const { error, mom } = buildMom(req.body, meeting);
  if (error) return res.status(400).json({ message: error });

  meeting.mom = mom;
  await meeting.save();
  res.json({ meeting: meetingView(meeting) });
});

export default router;
