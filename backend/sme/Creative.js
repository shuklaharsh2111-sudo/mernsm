import mongoose from 'mongoose';

export const CREATIVE_PLATFORMS = ['instagram', 'facebook', 'linkedin', 'x', 'youtube'];
export const CREATIVE_STATUSES = ['pending', 'approved', 'rejected'];

const creativeSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'Sme', required: true, index: true },
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/, index: true },
  status: { type: String, enum: CREATIVE_STATUSES, default: 'pending', index: true },
  reviewNote: { type: String, trim: true, maxlength: 500, default: '' },
  reviewedAt: { type: Date, default: null },
  rejectionCount: { type: Number, default: 0, min: 0 },
  assignedDesigner: { type: mongoose.Schema.Types.ObjectId, ref: 'Des', default: null, index: true },
  assignedAt: { type: Date, default: null },
  assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Sme', default: null },
  referenceLinks: { type: [{ type: String, trim: true, maxlength: 500 }], default: [] },
  uploads: [{
    url: { type: String, required: true },
    publicId: { type: String, default: '' },
    originalName: { type: String, default: '' }
  }],
  // The ONE file the designer delivers for this creative. The SME approves it or asks for a redo.
  designOutput: {
    type: new mongoose.Schema({
      // Earlier versions the SME sent back for a redo (oldest first), each with the SME's note.
      history: {
        type: [new mongoose.Schema({
          url: { type: String, required: true },
          publicId: { type: String, default: '' },
          resourceType: { type: String, default: 'image' },
          originalName: { type: String, default: '' },
          mimeType: { type: String, default: '' },
          size: { type: Number, default: 0 },
          uploadedAt: { type: Date, default: null },
          note: { type: String, default: '' },
          reviewedAt: { type: Date, default: null },
          version: { type: Number, default: 1 }
        }, { _id: false })],
        default: []
      },
      url: { type: String, required: true },
      publicId: { type: String, default: '' },
      resourceType: { type: String, default: 'image' },
      originalName: { type: String, default: '' },
      mimeType: { type: String, default: '' },
      size: { type: Number, default: 0 },
      uploadedAt: { type: Date, default: Date.now },
      status: { type: String, enum: ['submitted', 'approved', 'redo'], default: 'submitted' },
      note: { type: String, trim: true, maxlength: 500, default: '' },
      reviewedAt: { type: Date, default: null },
      version: { type: Number, default: 1 },
      redoCount: { type: Number, default: 0 }
    }, { _id: false }),
    default: null
  },
  contentPillar: {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    caption: { type: String, trim: true, maxlength: 2200, default: '' },
    hashtags: { type: [{ type: String, trim: true, maxlength: 60 }], default: [] },
    keywords: { type: [{ type: String, trim: true, maxlength: 60 }], default: [] },
    platforms: {
      type: [{ type: String, enum: CREATIVE_PLATFORMS }],
      validate: [(v) => v.length > 0, 'Select at least one platform']
    }
  }
}, { timestamps: true, collection: 'creatives' });

const Creative = mongoose.models.Creative || mongoose.model('Creative', creativeSchema);

export default Creative;