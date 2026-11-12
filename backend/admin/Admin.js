import mongoose from 'mongoose';
const adminSchema = new mongoose.Schema({
  name: { type: String, trim: true },
  fullname: String,
  contact: { type: String, trim: true, default: '' },
  email: { type: String, lowercase: true, trim: true },
  password: { type: String, select: false },
  avatar: { type: String, default: '' },
  profileImage: { type: String, default: '' },
  avatarPublicId: { type: String, default: '' },
  role: { type: String, default: 'admin' },
  isDefault: { type: Boolean, default: false }
}, {
  timestamps: true,
  strict: false,
  collection: 'admins'
});
const Admin = mongoose.models.Admin || mongoose.model('Admin', adminSchema);
export default Admin;