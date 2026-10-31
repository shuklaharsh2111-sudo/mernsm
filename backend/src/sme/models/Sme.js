import mongoose from 'mongoose';

const smeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    department: { type: String, required: true, trim: true, maxlength: 80 },
    expertise: { type: String, default: '', trim: true, maxlength: 120 },
    employeeId: { type: String, default: '', trim: true, maxlength: 40 },
    avatar: { type: String, default: '' },
    role: { type: String, default: 'sme', immutable: true },
  },
  { timestamps: true }
);

export default mongoose.model('Sme', smeSchema);
