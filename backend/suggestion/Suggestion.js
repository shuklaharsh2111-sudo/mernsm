import mongoose from 'mongoose';

// Suggestions are ANONYMOUS: nothing about the sender (id, name, email, role) is stored.
const suggestionSchema = new mongoose.Schema({
  message: { type: String, required: true, trim: true, maxlength: 2000 }
}, { timestamps: true, collection: 'suggestions' });

suggestionSchema.index({ createdAt: -1 });

const Suggestion = mongoose.models.Suggestion || mongoose.model('Suggestion', suggestionSchema);
export default Suggestion;
