import mongoose from 'mongoose';

// A registered device (phone, laptop, tag...). It identifies itself with `deviceKey`.
const deviceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    deviceKey: { type: String, required: true, unique: true, index: true },
    type: { type: String, enum: ['phone', 'laptop', 'tablet', 'tag', 'other'], default: 'phone' },
    ownerName: { type: String, default: '', trim: true, maxlength: 80 },
    ownerId: { type: mongoose.Schema.Types.ObjectId, default: null },
    ownerRole: { type: String, default: '' },
    active: { type: Boolean, default: true },
    lastSeenAt: { type: Date, default: null },
    lastLat: Number,
    lastLng: Number,
    // where the device is right now (null = outside every registered location)
    currentLocationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Location', default: null }
  },
  { timestamps: true, collection: 'devices' }
);

export default mongoose.models.Device || mongoose.model('Device', deviceSchema);
