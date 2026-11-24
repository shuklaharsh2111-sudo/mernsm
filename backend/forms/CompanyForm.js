import mongoose from 'mongoose';

// "Send form": an SME / SMI sends the onboarding questions link to one of their companies.
// The company fills it in on the onboarding site; the submission (an Onboarding document) is matched back here.
const companyFormSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  sender: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  senderRole: { type: String, enum: ['sme', 'smi'], required: true },
  senderName: { type: String, default: '' },
  title: { type: String, default: 'Onboarding questions', trim: true, maxlength: 120 },
  note: { type: String, default: '', trim: true, maxlength: 1000 },
  url: { type: String, required: true },
  status: { type: String, enum: ['pending', 'submitted', 'reviewed'], default: 'pending', index: true },
  onboarding: { type: mongoose.Schema.Types.ObjectId, ref: 'Onboarding', default: null },
  submittedAt: { type: Date, default: null },
  submittedByName: { type: String, default: '' }
}, { timestamps: true });

export default mongoose.models.CompanyForm || mongoose.model('CompanyForm', companyFormSchema);
