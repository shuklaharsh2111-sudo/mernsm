import mongoose from 'mongoose';

// One stay of one device inside one location: inAt -> outAt.
// outAt === null means the device is still inside.
const visitSchema = new mongoose.Schema(
  {
    deviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Device', required: true, index: true },
    locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Location', required: true, index: true },
    inAt: { type: Date, required: true, default: Date.now, index: true },
    outAt: { type: Date, default: null },
    lastSeenAt: { type: Date, default: Date.now },
    source: { type: String, enum: ['gps', 'reader', 'manual'], default: 'gps' }
  },
  { timestamps: true, collection: 'device_visits' }
);

visitSchema.index({ deviceId: 1, outAt: 1 });

export default mongoose.models.DeviceVisit || mongoose.model('DeviceVisit', visitSchema);
