
import mongoose from 'mongoose';

const smeSchema = new mongoose.Schema(
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
      default: 'sme'
    },
    reportingManagerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      default: null
    }
  },
  {
    timestamps: true,
    strict: false,
    collection: 'smes'
  }
);

const Sme =
  mongoose.models.Sme ||
  mongoose.model('Sme', smeSchema);

export default Sme;
