import mongoose from 'mongoose';

const adminSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true, select: false },
    avatar: { type: String, default: '' },
    role: { type: String, default: 'admin', immutable: true },
  },
  { timestamps: true }
);

export default mongoose.model('Admin', adminSchema);
