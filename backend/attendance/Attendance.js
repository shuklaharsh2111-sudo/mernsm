import mongoose from 'mongoose';
const pointSchema = new mongoose.Schema(
  {
    lat: Number,
    lng: Number,
    accuracy: Number,       // metres, as reported by the browser
    distance: Number        // metres from the office centre
  },
  { _id: false }
);
const attendanceSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    role: { type: String, enum: ['admin', 'sme', 'des'], required: true },
    name: String,
    email: String,
    sessionId: { type: String, required: true, index: true },
    loginAt: { type: Date, required: true, default: Date.now, index: true },
    logoutAt: { type: Date, default: null },
    loginLocation: { type: pointSchema, default: null },
    ipAddress: String
  },
  { timestamps: true, collection: 'attendance' }
);
const Attendance =
  mongoose.models.Attendance ||
  mongoose.model('Attendance', attendanceSchema);
export default Attendance;
