import mongoose from 'mongoose';
export const MAX_ASSIGNED = 5;
const companySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 60 },
  nameKey: { type: String, required: true, unique: true, select: false },
  logo: { type: String, default: '' },
  logoPublicId: { type: String, default: '' }
}, { timestamps: true });
export default mongoose.models.Company || mongoose.model('Company', companySchema);