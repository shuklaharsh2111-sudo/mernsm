import mongoose from 'mongoose';
export const MAX_ASSIGNED = 5;
const companySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 60 },
  nameKey: { type: String, required: true, unique: true, select: false },
  logo: { type: String, default: '' },
  logoPublicId: { type: String, default: '' },
  email: { type: String, lowercase: true, trim: true, unique: true, sparse: true },
  // the login account (role "clients") that belongs to this company
  clientUser: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', default: null }
}, { timestamps: true });
export default mongoose.models.Company || mongoose.model('Company', companySchema);