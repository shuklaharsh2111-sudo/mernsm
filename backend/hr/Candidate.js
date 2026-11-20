import mongoose from 'mongoose';

// Dropdown choices for the recruitment sheet (kept here so the API can validate them)
export const REMARK_STATUSES = ['Shortlisted', 'HOLD', 'Absconded', 'Rejected by Candidate', 'Unanswered', 'Telephonic Rejected', 'Out of Mumbai'];
export const INTERVIEW_STATUSES = ['Selected', 'HOLD', 'Absconded', 'Rejected 1st Round', 'Rejected 2nd Round', 'Rejected'];

const candidateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    mobile: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, lowercase: true, default: '' },
    position: { type: String, trim: true, default: '', maxlength: 80 },
    resume: {
      url: { type: String, default: '' },
      publicId: { type: String, default: '' },
      resourceType: { type: String, default: 'image' },
      originalName: { type: String, default: '' }
    },
    shortlisted: { type: Boolean, default: false },   // CV shortlisted?
    callDone: { type: Boolean, default: false },      // call made?
    interviewAt: { type: Date, default: null },       // interview schedule
    remark: { type: String, default: '', maxlength: 1000 }, // last remark / note
    remarkAt: { type: Date, default: null },
    skills: { type: String, trim: true, default: '', maxlength: 500 },  // comma separated, read from the resume
    // result of comparing the resume's skills with the role's base skills
    matchRole: { type: String, default: '' },
    matchScore: { type: Number, default: null },
    matchNeeded: { type: Number, default: null },
    matchedSkills: { type: [String], default: [] },
    missingSkills: { type: [String], default: [] },
    autoShortlisted: { type: Boolean, default: false },
    remarkStatus: { type: String, default: '', enum: ['', ...REMARK_STATUSES] },        // "Remark" dropdown
    interviewStatus: { type: String, default: '', enum: ['', ...INTERVIEW_STATUSES] },  // "Interview Status" dropdown
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Hr' }
  },
  { timestamps: true, collection: 'candidates' }
);

const Candidate = mongoose.models.Candidate || mongoose.model('Candidate', candidateSchema);
export default Candidate;
