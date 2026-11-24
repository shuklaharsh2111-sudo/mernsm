import mongoose from 'mongoose';

// The onboarding questions site (https://onboardingquestions.onrender.com) saves each submission with this shape.
// It is registered here with the same schema so the dashboard can read what came back
// (the site and this app must use the same MongoDB: collection "onboardings").
const answerSchema = new mongoose.Schema({
  questionId: {
    type: String,
    required: true
  },
  section: {
    type: String,
    required: true
  },
  question: {
    type: String,
    required: true
  },
  answer: {
    type: String,
    required: true,
    trim: true
  }
}, { _id: false });

const onboardingSchema = new mongoose.Schema({
  companyName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 150
  },
  contactPerson: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  answers: {
    type: [answerSchema],
    required: true,
    validate: {
      validator: answers => answers.length === 23,
      message: 'Exactly 23 answers are required'
    }
  },
  status: {
    type: String,
    enum: ['submitted', 'reviewed'],
    default: 'submitted'
  }
}, {
  timestamps: true
});

export default mongoose.models.Onboarding || mongoose.model('Onboarding', onboardingSchema);
