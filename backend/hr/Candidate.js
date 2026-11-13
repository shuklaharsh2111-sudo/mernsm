import mongoose from 'mongoose';

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
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Hr' }
  },
  { timestamps: true, collection: 'candidates' }
);

const Candidate = mongoose.models.Candidate || mongoose.model('Candidate', candidateSchema);
export default Candidate;
