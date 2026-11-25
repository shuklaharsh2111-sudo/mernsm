import mongoose from 'mongoose';

export const COMMENT_STATUSES = ['open', 'resolved'];

// Who did something. A snapshot, so history still reads correctly if the person is renamed or removed.
const actorSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true },
  role: { type: String, required: true },
  name: { type: String, default: '' }
}, { _id: false });

const replySchema = new mongoose.Schema({
  author: { type: actorSchema, required: true },
  text: { type: String, required: true, trim: true, maxlength: 1000 },
  createdAt: { type: Date, default: Date.now }
});

// One pinpoint comment: a spot on ONE version of a creative's delivered design, plus its thread.
const creativeCommentSchema = new mongoose.Schema({
  creative: { type: mongoose.Schema.Types.ObjectId, ref: 'Creative', required: true, index: true },
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  // designOutput.version the pin was placed on. Version history / compare use this to show the right pins.
  version: { type: Number, required: true, min: 1 },
  // Pin number, 1, 2, 3... per creative + version. This is the number the person sees on the image.
  n: { type: Number, required: true, min: 1 },
  // Position as a percentage of the image (0-100), so the pin stays put at any display size.
  x: { type: Number, required: true, min: 0, max: 100 },
  y: { type: Number, required: true, min: 0, max: 100 },
  text: { type: String, required: true, trim: true, maxlength: 1000 },
  status: { type: String, enum: COMMENT_STATUSES, default: 'open', index: true },
  author: { type: actorSchema, required: true },
  replies: { type: [replySchema], default: [] },
  resolvedBy: { type: actorSchema, default: null },
  resolvedAt: { type: Date, default: null },
  // Soft delete: the comment disappears from the screen but who removed it, and when, is kept.
  deletedAt: { type: Date, default: null },
  deletedBy: { type: actorSchema, default: null }
}, { timestamps: true, collection: 'creative_comments' });

// Two people placing a pin at the same moment cannot both get the same number.
creativeCommentSchema.index({ creative: 1, version: 1, n: 1 }, { unique: true });

const CreativeComment = mongoose.models.CreativeComment || mongoose.model('CreativeComment', creativeCommentSchema);
export default CreativeComment;
