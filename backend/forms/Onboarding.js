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

// WHERE THE SUBMISSIONS ARE READ FROM
// The onboarding site saves into the "onboardings" collection of whatever database its own MONGO_URI names,
// which may differ from this app's database (a MONGO_URI without a database name connects to "test").
// So that it works without any setup, this finds the database on the cluster whose "onboardings" collection
// has the newest submission and reads from there (re-checked every 20 s, since the collection only exists
// after the first submission). To pin it instead, set ONBOARDING_DB_NAME (same cluster) or
// ONBOARDING_MONGO_URI (another cluster) in .env.
const modelFor = (conn) => conn.models.Onboarding || conn.model('Onboarding', onboardingSchema, 'onboardings');

const external = process.env.ONBOARDING_MONGO_URI ? mongoose.createConnection(process.env.ONBOARDING_MONGO_URI) : null;
let current = process.env.ONBOARDING_DB_NAME || null; // null = this app's own database
const pinned = Boolean(external || process.env.ONBOARDING_DB_NAME);

const currentModel = () => {
  if (external) return modelFor(external);
  if (current && current !== mongoose.connection.name) return modelFor(mongoose.connection.useDb(current, { useCache: true }));
  return modelFor(mongoose.connection);
};

let lastScan = 0;
export const refreshOnboardingDb = async (force = false) => {
  if (pinned || mongoose.connection.readyState !== 1) return;
  if (!force && Date.now() - lastScan < 20000) return;
  lastScan = Date.now();
  try {
    const client = mongoose.connection.getClient();
    const { databases } = await client.db().admin().listDatabases();
    let best = null;
    for (const d of databases) {
      if (['admin', 'local', 'config'].includes(d.name)) continue;
      const doc = await client.db(d.name).collection('onboardings').find({}, { projection: { createdAt: 1 } }).sort({ createdAt: -1 }).limit(1).next();
      if (!doc) continue;
      const t = new Date(doc.createdAt || 0).getTime();
      if (!best || t > best.t) best = { name: d.name, t };
    }
    if (best && best.name !== (current || mongoose.connection.name)) {
      current = best.name;
      console.log(`Onboarding submissions are read from database "${best.name}"`);
    }
  } catch (e) {
    console.error('onboarding database lookup failed (set ONBOARDING_DB_NAME to skip it):', e.message);
  }
};

// Behaves like the model; each call goes to the database found above.
export default new Proxy(function Onboarding() {}, {
  get: (_t, prop) => {
    const m = currentModel();
    const v = m[prop];
    return typeof v === 'function' ? v.bind(m) : v;
  }
});
