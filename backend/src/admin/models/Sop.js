import mongoose from 'mongoose';
<<<<<<< HEAD

export const SOP_STATUSES = ['pending', 'approved', 'rejected', 'revision'];

=======
<<<<<<< HEAD

export const SOP_STATUSES = ['pending', 'approved', 'rejected', 'revision'];

=======
export const SOP_STATUSES = ['pending', 'approved', 'rejected', 'revision'];
>>>>>>> adc7900227aadaf9e0a6f9f972499593c8ff0896
>>>>>>> c86954fd1b281ba1f0f38af41524f26256ebf5f0
const historySchema = new mongoose.Schema(
  {
    status: { type: String, enum: SOP_STATUSES, required: true },
    reason: { type: String, default: '', trim: true, maxlength: 1000 },
    by: { type: String, default: '' },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);
<<<<<<< HEAD

=======
<<<<<<< HEAD

=======
>>>>>>> adc7900227aadaf9e0a6f9f972499593c8ff0896
>>>>>>> c86954fd1b281ba1f0f38af41524f26256ebf5f0
const sopSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 150 },
    department: { type: String, default: '', trim: true, maxlength: 80 },
    description: { type: String, default: '', trim: true, maxlength: 500 },
    content: { type: String, required: true, trim: true, maxlength: 20000 },
    submittedBy: { type: String, default: '', trim: true, maxlength: 80 },
<<<<<<< HEAD
=======
<<<<<<< HEAD
>>>>>>> c86954fd1b281ba1f0f38af41524f26256ebf5f0
    submittedById: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    status: { type: String, enum: SOP_STATUSES, default: 'pending', index: true },
    // Why the SOP was rejected / sent back for redo (or an optional approval note)
    reviewReason: { type: String, default: '', trim: true, maxlength: 1000 },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
<<<<<<< HEAD
=======
=======
<<<<<<< HEAD
=======
    submittedById: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
>>>>>>> 76349f266a7448cb76e45c91a353b5745cbf3f2e
    status: { type: String, enum: SOP_STATUSES, default: 'pending', index: true },
    // Why the SOP was rejected / sent back for redo (or an optional approval note)
    reviewReason: { type: String, default: '', trim: true, maxlength: 1000 },
    submittedById: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
>>>>>>> adc7900227aadaf9e0a6f9f972499593c8ff0896
>>>>>>> c86954fd1b281ba1f0f38af41524f26256ebf5f0
    reviewedByName: { type: String, default: '' },
    reviewedAt: { type: Date },
    revisionCount: { type: Number, default: 0 },
    history: { type: [historySchema], default: [] },
  },
  { timestamps: true }
);
<<<<<<< HEAD

=======
<<<<<<< HEAD

=======
>>>>>>> adc7900227aadaf9e0a6f9f972499593c8ff0896
>>>>>>> c86954fd1b281ba1f0f38af41524f26256ebf5f0
export default mongoose.model('Sop', sopSchema);
