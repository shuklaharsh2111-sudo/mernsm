import mongoose from 'mongoose';

const influencerSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  channels: {
    type: [{ type: String, enum: ['youtube', 'instagram'] }],
    required: true,
    validate: {
      validator: (value) => value.length > 0,
      message: 'Select at least one channel'
    }
  },
  youtubeLink: { type: String, trim: true, default: '' },
  instagramLink: { type: String, trim: true, default: '' },
  youtubeStats: {
    channelId: { type: String, default: '' },
    title: { type: String, default: '' },
    handle: { type: String, default: '' },
    thumbnail: { type: String, default: '' },
    subscribers: { type: Number, default: null },
    totalViews: { type: Number, default: 0 },
    videoCount: { type: Number, default: 0 },
    avgViews: { type: Number, default: 0 },
    engagement: { type: Number, default: 0 },
    fetchedAt: { type: Date }
  },
  category: { type: String, required: true, trim: true },
  location: { type: String, required: true, trim: true },
  followers: { type: Number, required: true, min: 0 },
  avgReelViews: { type: Number, required: true, min: 0 },
  engagement: { type: Number, required: true, min: 0, max: 100 },
  contact: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true, lowercase: true },
  managementAgency: { type: String, trim: true, default: '' },
  collaborationType: {
    type: String,
    enum: ['paid', 'unpaid'],
    required: true
  },
  collaborationPrice: {
    type: Number,
    min: 0,
    default: null
  }
}, { timestamps: true });

export default mongoose.models.Influencer || mongoose.model('Influencer', influencerSchema);
