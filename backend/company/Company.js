import mongoose from 'mongoose';

// How many companies one SME can be assigned.
export const MAX_ASSIGNED = 5;

const companySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    // lowercase copy of the name so "Acme" and "acme" can't both exist
    nameKey: { type: String, required: true, unique: true, select: false },
  },
  { timestamps: true }
);

export default mongoose.models.Company || mongoose.model('Company', companySchema);
