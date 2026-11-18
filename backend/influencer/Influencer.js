import mongoose from 'mongoose';

export const INFLUENCER_PLATFORMS = ['Instagram', 'YouTube', 'Facebook', 'X', 'LinkedIn', 'Snapchat', 'Other'];
export const INFLUENCER_TIERS = ['Nano', 'Micro', 'Mid', 'Macro', 'Mega'];
export const INFLUENCER_STATUSES = ['shortlisted', 'contacted', 'negotiating', 'confirmed', 'live', 'completed', 'rejected'];

const influencerSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  ownerRole: { type: String, enum: ['sme', 'smi'], required: true, index: true },
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null },
  name: { type: String, required: true, trim: true, maxlength: 80 },
  handle: { type: String, trim: true, maxlength: 60, default: '' },
  platform: { type: String, enum: INFLUENCER_PLATFORMS, required: true },
  profileUrl: { type: String, trim: true, maxlength: 300, default: '' },
  niche: { type: String, trim: true, maxlength: 60, default: '' },
  followers: { type: Number, min: 0, default: 0 },
  engagementRate: { type: Number, min: 0, max: 100, default: 0 }, // percent
  avgViews: { type: Number, min: 0, default: 0 },
  location: { type: String, trim: true, maxlength: 60, default: '' },
  contact: { type: String, trim: true, maxlength: 120, default: '' },
  campaign: { type: String, trim: true, maxlength: 120, default: '' },
  deliverables: { type: String, trim: true, maxlength: 300, default: '' },
  fee: { type: Number, min: 0, default: 0 },
  status: { type: String, enum: INFLUENCER_STATUSES, default: 'shortlisted', index: true },
  postDate: { type: String, default: '' }, // 'YYYY-MM-DD'
  postLink: { type: String, trim: true, maxlength: 300, default: '' },
  reach: { type: Number, min: 0, default: 0 },
  notes: { type: String, trim: true, maxlength: 1000, default: '' }
}, { timestamps: true, collection: 'influencers' });

export const tierFor = (followers) => {
  if (followers >= 1_000_000) return 'Mega';
  if (followers >= 500_000) return 'Macro';
  if (followers >= 100_000) return 'Mid';
  if (followers >= 10_000) return 'Micro';
  return 'Nano';
};

export default mongoose.models.Influencer || mongoose.model('Influencer', influencerSchema);
