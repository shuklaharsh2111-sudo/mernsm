import mongoose from 'mongoose';

const answerSchema = new mongoose.Schema({
  questionId: { type: String, required: true },
  section: { type: String, required: true },
  question: { type: String, required: true },
  answer: { type: String, required: true, trim: true }
}, { _id: false });

// "Send form": an SME / SMI sends the onboarding questions to one of their companies.
// The company fills them in on its own dashboard (Forms page); the answers are saved on this same document.
const companyFormSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  sender: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  senderRole: { type: String, enum: ['sme', 'smi'], required: true },
  senderName: { type: String, default: '' },
  title: { type: String, default: 'Onboarding questions', trim: true, maxlength: 120 },
  note: { type: String, default: '', trim: true, maxlength: 1000 },
  status: { type: String, enum: ['pending', 'submitted', 'reviewed'], default: 'pending', index: true },
  answers: { type: [answerSchema], default: [] },
  submittedAt: { type: Date, default: null },
  submittedBy: { type: mongoose.Schema.Types.ObjectId, default: null },
  submittedByName: { type: String, default: '' },
  submittedByEmail: { type: String, default: '' }
}, { timestamps: true });

export default mongoose.models.CompanyForm || mongoose.model('CompanyForm', companyFormSchema);
