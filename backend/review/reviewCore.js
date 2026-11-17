import mongoose from 'mongoose';
import Meeting from '../meeting/Meeting.js';
import { momView, recordingView } from '../meeting/momHelpers.js';
import { createMeetingLink } from '../meeting/googleCalendar.js';
import { resolveAccount } from '../meeting/accounts.js';
import Creative from '../sme/Creative.js';

// Shared by the admin panel and the reporting manager panel.
// `scope` is an extra Mongo filter (the reporting manager passes { user: { $in: teamSmeIds } }); the admin passes {}.
const validId = (id) => mongoose.Types.ObjectId.isValid(id);

export const momItemView = (m) => ({
  id: m._id,
  subject: m.subject,
  date: m.date,
  time: m.time,
  company: m.company ? { id: m.company._id, name: m.company.name } : { id: '', name: 'Removed company' },
  sme: m.user ? { id: m.user._id, name: m.user.name || m.user.fullname || m.user.email, email: m.user.email } : { id: '', name: 'Removed user', email: '' },
  mom: momView(m.mom),
  recording: recordingView(m.recording),
});
// action: 'approve' | 'send-back' | 'reject'. Send back / reject need a reason.
const REVIEW = {
  approve: { status: 'approved', needsNote: false },
  'send-back': { status: 'sent_back', needsNote: true },
  reject: { status: 'rejected', needsNote: true },
};
export const reviewMom = async (req, res, action, scope = {}) => {
  const { status, needsNote } = REVIEW[action];
  if (!validId(req.params.id)) return res.status(404).json({ message: 'MOM not found' });
  const meeting = await Meeting.findOne({ _id: req.params.id, 'mom.submittedAt': { $exists: true }, ...scope })
    .populate('company', 'name')
    .populate('user', 'name fullname email');
  if (!meeting) return res.status(404).json({ message: 'MOM not found' });
  if (meeting.mom.status !== 'pending') {
    return res.status(400).json({ message: `This MOM is not waiting for review (it is ${meeting.mom.status.replace('_', ' ')})` });
  }
  const note = String(req.body?.note || '').trim();
  if (needsNote && note.length < 3) {
    return res.status(400).json({ message: 'Give a reason (at least 3 characters)' });
  }
  // Approving schedules the next meeting for the SME, so it shows up active on their dashboard.
  let nextScheduled = false;
  if (status === 'approved' && meeting.company && meeting.user && meeting.mom.nextMeeting) {
    if (!(await Meeting.exists({ fromMeeting: meeting._id }))) {
      const nm = meeting.mom.nextMeeting;
      // The follow-up belongs to the SME, so it goes on the SME's calendar (their Grain records it).
      const smeAccount = await resolveAccount(meeting.user._id, 'sme');
      const auto = await createMeetingLink({ subject: String(nm.agenda).slice(0, 200), date: nm.date, time: nm.time, attendees: meeting.attendees, refreshToken: smeAccount.googleRefreshToken });
      await Meeting.create({
        user: meeting.user._id,
        company: meeting.company._id,
        subject: String(nm.agenda).slice(0, 200),
        date: nm.date,
        time: nm.time,
        link: auto.link,
        calendar: auto.calendar,
        attendees: meeting.attendees.map((a) => ({ name: a.name, designation: a.designation })),
        priority: nm.priority,
        fromMeeting: meeting._id,
      });
    }
    nextScheduled = true;
  }
  meeting.mom.status = status;
  meeting.mom.reviewedAt = new Date();
  meeting.mom.reviewNote = needsNote ? note : '';
  await meeting.save();
  res.json({ mom: momItemView(meeting), nextScheduled });
};
// What the designer delivered for an approved creative, and where the SME's review of it stands
// (submitted / approved / redo). Read-only for the admin.
const designOutputView = (d) => (d ? {
  url: d.url,
  name: d.originalName,
  mimeType: d.mimeType,
  size: d.size,
  uploadedAt: d.uploadedAt,
  status: d.status,
  note: d.note || '',
  reviewedAt: d.reviewedAt,
  version: d.version || 1,
  redoCount: d.redoCount || 0,
  history: [...(d.history || [])].reverse().map((h) => ({
    url: h.url,
    name: h.originalName,
    mimeType: h.mimeType,
    size: h.size,
    uploadedAt: h.uploadedAt,
    note: h.note || '',
    reviewedAt: h.reviewedAt,
    version: h.version || 1,
  })),
} : null);
export const creativeItemView = (c) => ({
  id: c._id,
  status: c.status,
  reviewNote: c.reviewNote || '',
  reviewedAt: c.reviewedAt,
  submittedAt: c.createdAt,
  date: c.date,
  referenceLinks: c.referenceLinks || [],
  uploads: (c.uploads || []).map((u) => ({ url: u.url, name: u.originalName })),
  // Only an approved creative can have a designer, so these stay empty for pending / rejected ones.
  assignedDesigner: c.status === 'approved' && c.assignedDesigner && c.assignedDesigner._id
    ? { id: String(c.assignedDesigner._id), name: c.assignedDesigner.name, email: c.assignedDesigner.email }
    : null,
  assignedAt: c.status === 'approved' ? c.assignedAt || null : null,
  designOutput: c.status === 'approved' ? designOutputView(c.designOutput) : null,
  contentPillar: {
    title: c.contentPillar?.title || '',
    caption: c.contentPillar?.caption || '',
    hashtags: c.contentPillar?.hashtags || [],
    keywords: c.contentPillar?.keywords || [],
    platforms: c.contentPillar?.platforms || [],
  },
  company: c.company ? { id: c.company._id, name: c.company.name } : { id: '', name: 'Removed company' },
  sme: c.user ? { id: c.user._id, name: c.user.name || c.user.fullname || c.user.email, email: c.user.email } : { id: '', name: 'Removed user', email: '' },
});
// Approve -> it appears on the SME's calendar. Reject needs a reason.
export const reviewCreative = async (req, res, action, scope = {}) => {
  if (!validId(req.params.id)) return res.status(404).json({ message: 'Creative not found' });
  const creative = await Creative.findOne({ _id: req.params.id, ...scope })
    .populate('company', 'name')
    .populate('user', 'name fullname email')
    .populate('assignedDesigner', 'name email');
  if (!creative) return res.status(404).json({ message: 'Creative not found' });
  if (creative.status !== 'pending') {
    return res.status(400).json({ message: `This creative is not waiting for review (it is ${creative.status})` });
  }
  const note = String(req.body?.note || '').trim();
  if (action === 'reject' && note.length < 3) {
    return res.status(400).json({ message: 'Give a reason (at least 3 characters)' });
  }
  creative.status = action === 'approve' ? 'approved' : 'rejected';
  creative.reviewNote = action === 'reject' ? note.slice(0, 500) : '';
  creative.reviewedAt = new Date();
  if (action === 'reject') creative.rejectionCount = (creative.rejectionCount || 0) + 1;
  await creative.save();
  res.json({ creative: creativeItemView(creative) });
};
