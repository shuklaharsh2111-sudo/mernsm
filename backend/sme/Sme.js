import mongoose from 'mongoose';

const smeSchema = new mongoose.Schema({
  name: { type: String, trim: true },
  fullname: String,
  contact: { type: String, trim: true, default: '' },
  email: { type: String, lowercase: true, trim: true },
  password: { type: String, select: false },
  avatar: { type: String, default: '' },
  profileImage: { type: String, default: '' },
  avatarPublicId: { type: String, default: '' },
  companies: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Company' }],
  role: { type: String, default: 'sme' },
  reportingManagerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ReportingManager',
    default: null
  }
}, {
  timestamps: true,
  strict: false,
  collection: 'smes'
});

const Sme = mongoose.models.Sme || mongoose.model('Sme', smeSchema);

export default Sme;