import Company, { MAX_COMPANIES } from '../../admin/models/Company.js';

// Every company badge, flagged with whether the admin assigned it to this user.
export const myCompanies = async (req, res, next) => {
  try {
    const all = await Company.find().sort({ createdAt: 1 }).limit(MAX_COMPANIES);
    const mine = new Set((req.sme.companies || []).map(String));
    res.json({
      companies: all.map((c) => ({
        id: c._id,
        name: c.name,
        logo: c.logo || '',
        assigned: mine.has(String(c._id)),
      })),
      slots: MAX_COMPANIES,
    });
  } catch (err) {
    next(err);
  }
};
