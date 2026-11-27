import mongoose from 'mongoose';

// One document: the office location, allowed radius and late time, edited by the super admin in the app.
// A field left empty here falls back to the matching value in backend/.env.
const settingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'attendance', unique: true },
    officeLat: { type: Number, default: null },
    officeLng: { type: Number, default: null },
    officeRadius: { type: Number, default: null },     // metres
    lateAfter: { type: String, default: '' },          // HH:MM, server local time
    enforceStaff: { type: Boolean, default: null },    // null = use .env
    enforceAdmin: { type: Boolean, default: null },
    updatedBy: { type: String, default: '' },
  },
  { timestamps: true, collection: 'attendance_settings' }
);

export default mongoose.models.AttendanceSettings || mongoose.model('AttendanceSettings', settingsSchema);
