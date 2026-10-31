import mongoose from 'mongoose';

// Admin -> SME: an SOP the admin wants an SME to follow for one company.
export const SOP_TYPE_VALUES = ['daily', 'weekly', 'monthly'];

// One saved tick: the SME marked this SOP done for a period (see period.js).
const completionSchema = new mongoose.Schema(
  {
    period: { type: String, required: true },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const sopAssignmentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'Sme', required: true, index: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    type: { type: String, enum: SOP_TYPE_VALUES, required: true },
    text: { type: String, required: true, trim: true, maxlength: 5000 },
    // Start date as YYYY-MM-DD (no timezone shifting). Daily SOPs repeat every day
    // from here, weekly every week, monthly every month.
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    completions: { type: [completionSchema], default: [] },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  },
  { timestamps: true }
);

export default mongoose.models.SopAssignment || mongoose.model('SopAssignment', sopAssignmentSchema);
