import mongoose from 'mongoose';
import { SOP_TYPE_VALUES } from './SopAssignment.js';

// SME -> SMI: an SOP an SME wants an SMI to follow for one of the SME's companies.
// It is either a copy of an SOP the SME already has (sourceSop) or a brand new one.
const completionSchema = new mongoose.Schema(
  {
    period: { type: String, required: true }, // see period.js
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const smiSopAssignmentSchema = new mongoose.Schema(
  {
    smi: { type: mongoose.Schema.Types.ObjectId, ref: 'Smi', required: true, index: true },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Sme', required: true, index: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    sourceSop: { type: mongoose.Schema.Types.ObjectId, ref: 'SopAssignment', default: null },
    type: { type: String, enum: SOP_TYPE_VALUES, required: true },
    text: { type: String, required: true, trim: true, maxlength: 5000 },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    completions: { type: [completionSchema], default: [] },
  },
  { timestamps: true, collection: 'smisopassignments' }
);

export default mongoose.models.SmiSopAssignment || mongoose.model('SmiSopAssignment', smiSopAssignmentSchema);
