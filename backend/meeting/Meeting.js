import mongoose from 'mongoose';
// SME -> a meeting they schedule for one of their companies.
const attendeeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    designation: { type: String, trim: true, maxlength: 120, default: '' },
  },
  { _id: false }
);
// pending = waiting for admin; sent_back = admin wants changes (SME can edit + resubmit);
// approved / rejected are final.
export const MOM_STATUSES = ['pending', 'approved', 'sent_back', 'rejected'];
export const PRIORITIES = ['high', 'medium', 'low'];
// Minutes of Meeting: written by the SME, then approved / rejected by the admin.
const momSchema = new mongoose.Schema(
  {
    points: { type: [{ type: String, trim: true, maxlength: 1000 }], default: [] }, // points discussed
    // Who was there: present=false means absent (cross mark). Same order as the meeting's attendees.
    attendance: {
      type: [
        new mongoose.Schema(
          { name: String, designation: String, present: { type: Boolean, default: true } },
          { _id: false }
        ),
      ],
      default: [],
    },
    // Next steps, each with a date.
    nextSteps: {
      type: [
        new mongoose.Schema(
          { text: { type: String, trim: true, maxlength: 1000 }, date: { type: String, match: /^\d{4}-\d{2}-\d{2}$/ } },
          { _id: false }
        ),
      ],
      default: [],
    },
    // Next meeting schedule.
    nextMeeting: {
      type: new mongoose.Schema(
        {
          date: { type: String, match: /^\d{4}-\d{2}-\d{2}$/ },
          time: { type: String, match: /^\d{2}:\d{2}$/ },
          agenda: { type: String, trim: true, maxlength: 500 },
          priority: { type: String, enum: PRIORITIES },
        },
        { _id: false }
      ),
    },
    status: { type: String, enum: MOM_STATUSES, default: 'pending' },
    submittedAt: { type: Date },
    reviewedAt: { type: Date },
    reviewNote: { type: String, trim: true, maxlength: 500, default: '' }, // admin's reason when rejected
  },
  { _id: false }
);
// Filled in automatically from Grain (the desktop recorder joined the Google Meet call).
// pending = joined, waiting for Grain to finish; ready = summary saved; failed = gave up polling.
export const RECORDING_STATUSES = ['pending', 'ready', 'failed'];
const recordingSchema = new mongoose.Schema(
  {
    status: { type: String, enum: RECORDING_STATUSES, default: 'pending' },
    grainId: { type: String, default: '' },
    url: { type: String, default: '' }, // Grain share link (opens the video)
    thumbnailUrl: { type: String, default: '' },
    title: { type: String, default: '' },
    startedAt: { type: Date },
    durationMs: { type: Number, default: 0 },
    summary: { type: String, default: '' }, // Grain AI summary (markdown)
    actionItems: {
      type: [new mongoose.Schema({ text: String, assignee: String, status: String }, { _id: false })],
      default: [],
    },
    transcript: { type: String, default: '' }, // plain text, speaker: line
    account: { type: String, default: '' }, // 'own' = the person's Grain, 'default' = shared test account
    attempts: { type: Number, default: 0 },
    lastCheckedAt: { type: Date },
    lastError: { type: String, default: '' },
    savedAt: { type: Date },
  },
  { _id: false }
);
const meetingSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'Sme', required: true, index: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    subject: { type: String, required: true, trim: true, maxlength: 200 },
    // Date as YYYY-MM-DD and time as HH:mm (no timezone shifting).
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    time: { type: String, required: true, match: /^\d{2}:\d{2}$/ },
    link: { type: String, trim: true, maxlength: 500, default: '' },
    // Set when the meeting was created as a Google Calendar event (so Grain can see and record it).
    calendar: {
      type: new mongoose.Schema({ eventId: String, iCalUID: String, htmlLink: String }, { _id: false }),
      default: undefined,
    },
    attendees: { type: [attendeeSchema], default: [] },
    mom: { type: momSchema, default: undefined },
    recording: { type: recordingSchema, default: undefined },
    // Set when the SME clicks Join Now (this is what unlocks the Send MOM button).
    joinedAt: { type: Date },
    // Set on meetings that were scheduled automatically from an approved MOM.
    priority: { type: String, enum: PRIORITIES },
    fromMeeting: { type: mongoose.Schema.Types.ObjectId, ref: 'Meeting' },
  },
  { timestamps: true }
);
export default mongoose.models.Meeting || mongoose.model('Meeting', meetingSchema);
