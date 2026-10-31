import mongoose from 'mongoose';

export const SOP_STATUSES = ['pending', 'approved', 'rejected', 'revision'];

const historySchema = new mongoose.Schema(
  {
    status: { type: String, enum: SOP_STATUSES, required: true },
    reason: { type: String, default: '', trim: true, maxlength: 1000 },
    by: { type: String, default: '' },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const sopSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 150 },
    department: { type: String, default: '', trim: true, maxlength: 80 },
    description: { type: String, default: '', trim: true, maxlength: 500 },
    content: { type: String, required: true, trim: true, maxlength: 20000 },
    submittedBy: { type: String, default: '', trim: true, maxlength: 80 },
    submittedById: { type: mongoose.Schema.Types.ObjectId, ref: 'Sme', index: true },
    status: { type: String, enum: SOP_STATUSES, default: 'pending', index: true },
    // Why the SOP was rejected / sent back for redo (or an optional approval note)
    reviewReason: { type: String, default: '', trim: true, maxlength: 1000 },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    reviewedByName: { type: String, default: '' },
    reviewedAt: { type: Date },
    revisionCount: { type: Number, default: 0 },
    history: { type: [historySchema], default: [] },
  },
  { timestamps: true }
);

export default mongoose.model('Sop', sopSchema);
