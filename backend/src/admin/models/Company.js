import mongoose from 'mongoose';

// The dashboard shows this many company badges.
export const MAX_COMPANIES = 5;

const companySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    // Small data-URL image (png/jpeg/webp). Empty = show initials instead.
    logo: { type: String, default: '' },
  },
  { timestamps: true }
);

export default mongoose.model('Company', companySchema);
