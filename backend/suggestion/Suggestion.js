import mongoose from 'mongoose';

// One row per suggestion. Anyone signed in can send one; only admin and HR can read the whole list.
export const SUGGESTION_STATUSES = ['new', 'reviewing', 'planned', 'done', 'dismissed'];
export const SUGGESTION_CATEGORIES = ['general', 'feature', 'improvement', 'bug', 'workflow', 'other'];

const suggestionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  role: { type: String, required: true, index: true },
  name: { type: String, default: '' },
  email: { type: String, default: '' },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  message: { type: String, required: true, trim: true, maxlength: 2000 },
  category: { type: String, enum: SUGGESTION_CATEGORIES, default: 'general' },
  // the page of the panel the person was on when they wrote it (e.g. "/sme/records")
  page: { type: String, default: '', maxlength: 200 },
  status: { type: String, enum: SUGGESTION_STATUSES, default: 'new', index: true },
  reviewNote: { type: String, default: '', maxlength: 1000 },
  reviewedBy: { type: String, default: '' },
  reviewedAt: { type: Date, default: null }
}, { timestamps: true, collection: 'suggestions' });

suggestionSchema.index({ createdAt: -1 });

const Suggestion = mongoose.models.Suggestion || mongoose.model('Suggestion', suggestionSchema);
export default Suggestion;
