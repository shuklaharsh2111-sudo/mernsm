import mongoose from 'mongoose';

// A place (office, floor, gate, warehouse...) with a circular boundary.
const locationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    nameKey: { type: String, required: true, unique: true },
    // short code an IoT reader / gate controller can send instead of GPS coordinates
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    radius: { type: Number, required: true, default: 100, min: 10, max: 50000 }, // metres
    // the one fixed office location; its coordinates are set once and shared by everything
    isOffice: { type: Boolean, default: false },
    active: { type: Boolean, default: true }
  },
  { timestamps: true, collection: 'locations' }
);

export default mongoose.models.Location || mongoose.model('Location', locationSchema);
