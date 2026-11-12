import mongoose from 'mongoose';

// One row per person (admin, SME, ...) who connected their own Grain / Google account.
// Tokens are stored encrypted (see accounts.js) and are never sent to the browser.
const grainAccountSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true },
    role: { type: String, required: true, trim: true },
    grainToken: { type: String, default: '' },
    grainName: { type: String, default: '' }, // name Grain reports for the token, shown in settings
    googleRefreshToken: { type: String, default: '' },
  },
  { timestamps: true }
);
grainAccountSchema.index({ userId: 1, role: 1 }, { unique: true });

export default mongoose.models.GrainAccount || mongoose.model('GrainAccount', grainAccountSchema);
