import mongoose from 'mongoose';

// Add more roles here later; the Users page dropdown reads from this list.
export const ROLES = [{ value: 'sme', label: 'SME' }];
export const ROLE_VALUES = ROLES.map((r) => r.value);
export const roleLabel = (value) => ROLES.find((r) => r.value === value)?.label || value;

const userSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true, uppercase: true, immutable: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    contact: { type: String, required: true, trim: true, maxlength: 20 },
    role: { type: String, enum: ROLE_VALUES, required: true },
    reportingManager: { type: String, default: '', trim: true, maxlength: 80 },
<<<<<<< HEAD
    // Companies the admin assigned (max 5 exist). Shown as badges on the user's dashboard.
    companies: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Company' }],
=======
    assignedCompanies: { type: [String], default: [] },
>>>>>>> adc7900227aadaf9e0a6f9f972499593c8ff0896
    password: { type: String, required: true, select: false },
    avatar: { type: String, default: '' },
    active: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  },
  { timestamps: true }
);

export default mongoose.model('User', userSchema);
