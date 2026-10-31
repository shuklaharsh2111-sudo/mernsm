
import mongoose from 'mongoose';

const adminSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true
    },
    fullname: String,
    email: {
      type: String,
      lowercase: true,
      trim: true
    },
    password: {
      type: String,
      select: false
    },
    avatar: {
      type: String,
      default: ''
    },
    profileImage: String,
    role: {
      type: String,
      default: 'admin'
    }
  },
  {
    timestamps: true,
    strict: false,
    collection: 'admins'
  }
);

const Admin =
  mongoose.models.Admin ||
  mongoose.model('Admin', adminSchema);

export default Admin;
