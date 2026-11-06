import mongoose from 'mongoose';

const num = { type: Number, min: 0, default: null };

const bestContentSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true, maxlength: 150, default: '' },
    note: { type: String, trim: true, maxlength: 400, default: '' },
    views: num,
    boosted: { type: Boolean, default: false },
  },
  { _id: false }
);

const line = { type: [{ type: String, trim: true, maxlength: 400 }], default: [] };

// SME -> the social-media numbers for one company in one month.
// These come from the platform insights (Instagram etc.), so the SME types them in;
// creative / SOP / meeting numbers are still calculated from the live records.
const socialMetricsSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'Sme', required: true, index: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    month: { type: String, required: true, match: /^\d{4}-\d{2}$/ },
    platform: { type: String, trim: true, maxlength: 30, default: 'Instagram' },

    // Reporting window inside the month, e.g. 9th - 30th (blank = whole month)
    periodFrom: { type: String, match: /^(\d{4}-\d{2}-\d{2})?$/, default: '' },
    periodTo: { type: String, match: /^(\d{4}-\d{2}-\d{2})?$/, default: '' },

    // Audience growth
    followersStart: num,
    newFollowers: num,
    unfollowers: num,
    followersEnd: num,

    // Reach & engagement
    accountsReached: num,
    accountsEngaged: num, // interactions
    views: num, // impressions / views
    profileVisits: num,
    websiteVisits: num, // bio link taps
    nonFollowerInteractionPct: { type: Number, min: 0, max: 100, default: null },

    // 3-month overview: figures typed in for the two earlier months (blank = use what was saved for those months)
    ovPrevFollowers: num,
    ovPrevReach: num,
    ovPrevEngagement: num,
    ovEarlierFollowers: num,
    ovEarlierReach: num,
    ovEarlierEngagement: num,

    // Content output
    posts: num,
    reels: num,
    stories: num,

    paidPromotion: { type: Boolean, default: false },
    paidNote: { type: String, trim: true, maxlength: 400, default: '' },

    bestContent: { type: [bestContentSchema], default: [] },
    keyInsights: line,
    improvements: line,
    summaryNote: { type: String, trim: true, maxlength: 1000, default: '' },
  },
  { timestamps: true, collection: 'socialmetrics' }
);

// One record per company, month AND platform (Instagram numbers never overwrite Facebook numbers).
socialMetricsSchema.index({ user: 1, company: 1, month: 1, platform: 1 }, { unique: true });

const SocialMetrics = mongoose.models.SocialMetrics || mongoose.model('SocialMetrics', socialMetricsSchema);

// The unique index used to be (user, company, month) only. It would block a second platform in the
// same month, so drop it once. If it is already gone this is ignored.
SocialMetrics.collection.dropIndex('user_1_company_1_month_1').catch(() => {});

export default SocialMetrics;
