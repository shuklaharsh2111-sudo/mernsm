import mongoose from 'mongoose';

export const CREATIVE_PLATFORMS = ['instagram', 'facebook', 'linkedin', 'x', 'youtube'];
// pending = waiting for admin; only approved creatives show on the calendar.
export const CREATIVE_STATUSES = ['pending', 'approved', 'rejected'];

// SME -> a reference creative planned on a calendar day for one brand.
const creativeSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'Sme', required: true, index: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/, index: true },
    status: { type: String, enum: CREATIVE_STATUSES, default: 'pending', index: true },
    reviewNote: { type: String, trim: true, maxlength: 500, default: '' },
    reviewedAt: { type: Date, default: null },
    referenceLinks: { type: [{ type: String, trim: true, maxlength: 500 }], default: [] },
    // uploaded reference images (Cloudinary)
    uploads: [
      {
        url: { type: String, required: true },
        publicId: { type: String, default: '' },
        originalName: { type: String, default: '' },
      },
    ],
    contentPillar: {
      title: { type: String, required: true, trim: true, maxlength: 120 },
      caption: { type: String, trim: true, maxlength: 2200, default: '' },
      hashtags: { type: [{ type: String, trim: true, maxlength: 60 }], default: [] },
      keywords: { type: [{ type: String, trim: true, maxlength: 60 }], default: [] },
      platforms: {
        type: [{ type: String, enum: CREATIVE_PLATFORMS }],
        validate: [(v) => v.length > 0, 'Select at least one platform'],
      },
    },
  },
  { timestamps: true, collection: 'creatives' }
);

const Creative = mongoose.models.Creative || mongoose.model('Creative', creativeSchema);
export default Creative;
