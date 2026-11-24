import express from 'express';
import mongoose from 'mongoose';
import { protect } from '../auth.js';
import { Client, roleModels } from '../admin/UserModels.js';
import Company from '../company/Company.js';
import CompanyForm from './CompanyForm.js';
import Onboarding, { refreshOnboardingDb } from './Onboarding.js';
import { notifyUsers, notifyCompanyClients } from '../notifications/notify.js';

// The form that "Send form" sends. Override with ONBOARDING_FORM_URL in .env if the site moves.
export const ONBOARDING_URL = process.env.ONBOARDING_FORM_URL || 'https://onboardingquestions.onrender.com/';

const router = express.Router();
const staff = protect(['sme', 'smi']);
const clientOnly = protect(['clients']);
const anyone = protect(['sme', 'smi', 'clients']);

const validId = (id) => mongoose.Types.ObjectId.isValid(id);
const personName = (u) => (u ? u.name || u.fullname || u.email || '' : '');

// Lenient company <-> submission matching, done on the whole "onboardings" collection:
// same email as the company or one of its logins, or the same company name ignoring case, spaces and punctuation
// (or one name contained in the other).
const norm = (v) => String(v || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const allSubmissions = async () => {
  await refreshOnboardingDb();
  return Onboarding.find().select('companyName contactPerson email status createdAt').sort({ createdAt: -1 }).limit(2000).lean();
};
const FREE_MAIL = new Set(['gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.in', 'ymail.com', 'outlook.com', 'hotmail.com', 'live.com', 'icloud.com', 'rediffmail.com', 'proton.me', 'protonmail.com']);
const STOP_WORDS = new Set(['company', 'private', 'limited', 'pvt', 'ltd', 'india', 'solutions', 'services', 'group', 'technologies', 'enterprises', 'industries', 'the', 'and']);
const words = (v) => String(v || '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
const domainOf = (e) => (String(e || '').split('@')[1] || '').trim().toLowerCase();
const isMatch = (sub, company, emails) => {
  if (emails.includes(String(sub.email || '').trim().toLowerCase())) return true;
  // same (non-free) email domain as the company or one of its logins, e.g. anyone@brand.com
  const dom = domainOf(sub.email);
  if (dom && !FREE_MAIL.has(dom) && emails.some((e) => domainOf(e) === dom)) return true;
  // every meaningful word of the shorter company name is in the other one ("Sunrise Bakery" vs "Sunrise Bakery & Cafe Pvt Ltd")
  const wa = words(company.name);
  const wb = words(sub.companyName);
  if (wa.length && wb.length) {
    const [short, long] = wa.length <= wb.length ? [wa, wb] : [wb, wa];
    if (short.every((w) => long.includes(w))) return true;
  }
  // the person who filled the form is one of the company's logins (entries stored as "name:<normalised>")
  if (norm(sub.contactPerson) && emails.includes(`name:${norm(sub.contactPerson)}`)) return true;
  const a = norm(company.name);
  const b = norm(sub.companyName);
  return Boolean(a && b && (a === b || (Math.min(a.length, b.length) >= 4 && (a.includes(b) || b.includes(a)))));
};

const formView = (f, company) => ({
  id: String(f._id),
  companyId: String(company?._id || f.company),
  companyName: company?.name || '',
  title: f.title,
  note: f.note || '',
  url: f.url,
  status: f.status,
  senderName: f.senderName || '',
  senderRole: f.senderRole,
  createdAt: f.createdAt,
  submittedAt: f.submittedAt,
  submittedByName: f.submittedByName || ''
});

// Look for the company's submission on the onboarding site: same email as the company or one of its
// login accounts, or the same company name, saved after the form was sent. A match turns the form into "submitted".
export const syncOnboarding = async (filter = {}) => {
  try {
    const pending = await CompanyForm.find({ ...filter, status: 'pending' }).lean();
    if (!pending.length) return;
    const companyIds = [...new Set(pending.map((f) => String(f.company)))];
    const all = await allSubmissions();
    const [companies, clients] = await Promise.all([
      Company.find({ _id: { $in: companyIds } }).select('name email').lean(),
      Client.find({ companies: { $in: companyIds } }).select('name fullname email companies').lean()
    ]);
    for (const form of pending) {
      const company = companies.find((c) => String(c._id) === String(form.company));
      if (!company) continue;
      const emails = companyEmails(company, clients);
      // prefer the first submission saved after the form was sent; otherwise the company's latest submission
      // (it may have been filled in earlier or the clocks differ) - either way the form is completed
      const mine = all.filter((sub) => isMatch(sub, company, emails));
      const match = [...mine].reverse().find((sub) => new Date(sub.createdAt) >= new Date(form.createdAt)) || mine[0];
      if (!match) continue;
      // only the first sync to flip the form notifies the sender
      const won = await CompanyForm.findOneAndUpdate(
        { _id: form._id, status: 'pending' },
        { $set: { status: match.status === 'reviewed' ? 'reviewed' : 'submitted', onboarding: match._id, submittedAt: match.createdAt, submittedByName: match.contactPerson } },
        { new: true }
      ).lean();
      if (won) {
        notifyUsers([{ id: form.sender, role: form.senderRole }], { topic: 'forms', tone: 'success', title: 'Onboarding form submitted', message: `${company.name} submitted the onboarding questions.` });
      }
    }
  } catch (e) {
    console.error('onboarding sync', e.message);
  }
};

const companyEmails = (company, clients) => {
  const mine = clients.filter((cl) => (cl.companies || []).map(String).includes(String(company._id)));
  return [
    company.email,
    ...mine.map((cl) => cl.email),
    ...mine.map((cl) => (norm(personName(cl)) && !String(personName(cl)).includes('@') ? `name:${norm(personName(cl))}` : ''))
  ].filter(Boolean).map((e) => String(e).trim().toLowerCase());
};

// A submission that staff linked to the company by hand ("Link a submitted form").
const linkedSubmissionFor = async (companyId) => {
  const f = await CompanyForm.findOne({ company: companyId, onboarding: { $ne: null } }).sort({ submittedAt: -1 }).select('onboarding').lean();
  if (!f) return null;
  await refreshOnboardingDb();
  return Onboarding.findById(f.onboarding).select('companyName contactPerson email status createdAt').lean();
};

// Whatever this company already submitted on the onboarding site (also before any form was sent from here).
const latestSubmission = async (company) => {
  const [clients, all] = await Promise.all([Client.find({ companies: company._id }).select('name fullname email companies').lean(), allSubmissions()]);
  const emails = companyEmails(company, clients);
  return all.find((sub) => isMatch(sub, company, emails)) || (await linkedSubmissionFor(company._id));
};

const submissionSummary = (sub) => (sub ? { id: String(sub._id), status: sub.status, submittedAt: sub.createdAt, contactPerson: sub.contactPerson } : null);

const submissionView = (sub, company) => ({
  title: 'Onboarding questions',
  companyId: String(company._id),
  companyName: company.name,
  status: sub.status,
  senderName: '',
  createdAt: null,
  onboarding: {
    id: String(sub._id),
    companyName: sub.companyName,
    contactPerson: sub.contactPerson,
    email: sub.email,
    status: sub.status,
    submittedAt: sub.createdAt,
    answers: (sub.answers || []).map((a) => ({ questionId: a.questionId, section: a.section, question: a.question, answer: a.answer }))
  }
});

// The company a staff member may use: only the ones the admin assigned to them.
const assignedCompany = async (req, companyId) => {
  if (!validId(companyId)) return null;
  const me = await roleModels[req.user.role].findById(req.user.id).select('companies').lean();
  if (!me || !(me.companies || []).map(String).includes(String(companyId))) return null;
  return Company.findById(companyId).select('name logo email').lean();
};

// ---------- SME / SMI ----------

// Every company assigned to me, with its details, its client contact(s) and how many forms are out / back.
router.get('/companies', staff, async (req, res) => {
  try {
    const me = await roleModels[req.user.role].findById(req.user.id).select('companies').lean();
    const ids = (me?.companies || []).map(String);
    await syncOnboarding({ company: { $in: ids }, sender: req.user.id });
    const [companies, clients, forms] = await Promise.all([
      Company.find({ _id: { $in: ids } }).select('name logo email clientUser createdAt').sort({ name: 1 }).lean(),
      Client.find({ companies: { $in: ids } }).select('name fullname email contact companies').lean(),
      CompanyForm.find({ company: { $in: ids }, sender: req.user.id }).select('company status').lean()
    ]);
    const all = await allSubmissions();
    const subs = await Promise.all(companies.map(async (c) => { const emails = companyEmails(c, clients); return all.find((sub) => isMatch(sub, c, emails)) || (await linkedSubmissionFor(c._id)); }));
    res.json({
      companies: companies.map((c, i) => {
        const cid = String(c._id);
        const mine = forms.filter((f) => String(f.company) === cid);
        return {
          id: cid,
          name: c.name,
          logo: c.logo || '',
          email: c.email || '',
          clients: clients
            .filter((cl) => (cl.companies || []).map(String).includes(cid) || String(c.clientUser || '') === String(cl._id))
            .map((cl) => ({ id: String(cl._id), name: personName(cl), email: cl.email, contact: cl.contact || '' })),
          onboarding: submissionSummary(subs[i]),
          forms: { pending: mine.filter((f) => f.status === 'pending').length, submitted: mine.filter((f) => f.status !== 'pending').length }
        };
      })
    });
  } catch (e) {
    console.error('forms companies', e);
    res.status(500).json({ message: 'Could not load your companies' });
  }
});

// Forms I sent to one company (newest first).
router.get('/companies/:companyId/forms', staff, async (req, res) => {
  try {
    const company = await assignedCompany(req, req.params.companyId);
    if (!company) return res.status(403).json({ message: 'This company is not assigned to you' });
    await syncOnboarding({ company: company._id, sender: req.user.id });
    const list = await CompanyForm.find({ company: company._id, sender: req.user.id }).sort({ createdAt: -1 }).limit(100).lean();
    res.json({ forms: list.map((f) => formView(f, company)) });
  } catch (e) {
    console.error('forms list', e);
    res.status(500).json({ message: 'Could not load the forms' });
  }
});

// "Send form": send the onboarding questions link to the company.
router.post('/companies/:companyId/forms', staff, async (req, res) => {
  try {
    const company = await assignedCompany(req, req.params.companyId);
    if (!company) return res.status(403).json({ message: 'This company is not assigned to you' });
    const waiting = await CompanyForm.exists({ company: company._id, sender: req.user.id, status: 'pending' });
    if (waiting) return res.status(400).json({ message: 'You already sent the form to this company and it is still waiting for their answers' });
    const me = await roleModels[req.user.role].findById(req.user.id).select('name fullname email').lean();
    const form = await CompanyForm.create({
      company: company._id,
      sender: req.user.id,
      senderRole: req.user.role,
      senderName: personName(me),
      note: String(req.body?.note || '').trim().slice(0, 1000),
      url: ONBOARDING_URL
    });
    notifyCompanyClients(company._id, { topic: 'forms', tone: 'info', title: 'Onboarding form to fill', message: '{actor} sent you the onboarding questions form. Please fill it in.' }, req.user);
    res.status(201).json({ form: formView(form.toObject(), company) });
  } catch (e) {
    console.error('forms create', e);
    res.status(500).json({ message: 'Could not send the form' });
  }
});

// Submissions on the onboarding site that are not matched to any of my companies yet (newest first), to link by hand.
router.get('/submissions/unlinked', staff, async (req, res) => {
  try {
    const me = await roleModels[req.user.role].findById(req.user.id).select('companies').lean();
    const ids = (me?.companies || []).map(String);
    const [companies, clients, all, linked] = await Promise.all([
      Company.find({ _id: { $in: ids } }).select('name email').lean(),
      Client.find({ companies: { $in: ids } }).select('name fullname email companies').lean(),
      allSubmissions(),
      CompanyForm.find({ onboarding: { $ne: null } }).select('onboarding').lean()
    ]);
    const taken = new Set(linked.map((f) => String(f.onboarding)));
    const free = all.filter((sub) => !taken.has(String(sub._id)) && !companies.some((c) => isMatch(sub, c, companyEmails(c, clients))));
    res.json({ submissions: free.slice(0, 50).map((s) => ({ id: String(s._id), companyName: s.companyName, contactPerson: s.contactPerson, email: s.email, status: s.status, submittedAt: s.createdAt })) });
  } catch (e) {
    console.error('forms unlinked', e);
    res.status(500).json({ message: 'Could not load the submissions' });
  }
});

// Link a submitted onboarding form to a company by hand: its waiting form becomes completed.
router.post('/companies/:companyId/link', staff, async (req, res) => {
  try {
    const company = await assignedCompany(req, req.params.companyId);
    if (!company) return res.status(403).json({ message: 'This company is not assigned to you' });
    const subId = req.body?.submissionId;
    if (!validId(subId)) return res.status(400).json({ message: 'Choose a submission to link' });
    await refreshOnboardingDb();
    const sub = await Onboarding.findById(subId).select('companyName contactPerson email status createdAt').lean();
    if (!sub) return res.status(404).json({ message: 'Submission not found' });
    const patch = { status: sub.status === 'reviewed' ? 'reviewed' : 'submitted', onboarding: sub._id, submittedAt: sub.createdAt, submittedByName: sub.contactPerson };
    const pending = await CompanyForm.findOne({ company: company._id, sender: req.user.id, status: 'pending' }).sort({ createdAt: -1 });
    if (pending) {
      Object.assign(pending, patch);
      await pending.save();
    } else {
      const me = await roleModels[req.user.role].findById(req.user.id).select('name fullname email').lean();
      await CompanyForm.create({ company: company._id, sender: req.user.id, senderRole: req.user.role, senderName: personName(me), url: ONBOARDING_URL, ...patch });
    }
    res.json({ ok: true });
  } catch (e) {
    console.error('forms link', e);
    res.status(500).json({ message: 'Could not link the submission' });
  }
});

// Open one existing submission (staff: of a company assigned to them; company: its own).
const submissionAccess = async (req) => {
  if (!validId(req.params.id)) return null;
  await refreshOnboardingDb();
  const sub = await Onboarding.findById(req.params.id).lean();
  if (!sub) return null;
  let companyIds;
  if (req.user.role === 'clients') {
    const cid = await clientCompanyId(req);
    companyIds = cid ? [cid] : [];
  } else {
    const me = await roleModels[req.user.role].findById(req.user.id).select('companies').lean();
    companyIds = me?.companies || [];
  }
  const companies = await Company.find({ _id: { $in: companyIds } }).select('name email').lean();
  for (const c of companies) {
    const clients = await Client.find({ companies: c._id }).select('name fullname email companies').lean();
    const emails = companyEmails(c, clients);
    if (isMatch(sub, c, emails)) return { sub, company: c };
    if (await CompanyForm.exists({ company: c._id, onboarding: sub._id })) return { sub, company: c };
  }
  return null;
};

router.get('/onboarding/:id', anyone, async (req, res) => {
  try {
    const hit = await submissionAccess(req);
    if (!hit) return res.status(404).json({ message: 'Form not found' });
    res.json({ form: submissionView(hit.sub, hit.company) });
  } catch (e) {
    console.error('onboarding get', e);
    res.status(500).json({ message: 'Could not load the form' });
  }
});

router.put('/onboarding/:id/reviewed', staff, async (req, res) => {
  try {
    const hit = await submissionAccess(req);
    if (!hit) return res.status(404).json({ message: 'Form not found' });
    await Onboarding.updateOne({ _id: hit.sub._id }, { $set: { status: 'reviewed' } });
    await CompanyForm.updateMany({ onboarding: hit.sub._id, status: 'submitted' }, { $set: { status: 'reviewed' } });
    res.json({ ok: true, status: 'reviewed' });
  } catch (e) {
    console.error('onboarding reviewed', e);
    res.status(500).json({ message: 'Could not update the form' });
  }
});

// Mark a submitted form as reviewed (also updates the submission itself).
router.put('/:id/reviewed', staff, async (req, res) => {
  try {
    if (!validId(req.params.id)) return res.status(404).json({ message: 'Form not found' });
    const form = await CompanyForm.findOne({ _id: req.params.id, sender: req.user.id });
    if (!form) return res.status(404).json({ message: 'Form not found' });
    if (form.status === 'pending') return res.status(400).json({ message: 'The company has not submitted this form yet' });
    if (form.onboarding) await Onboarding.updateOne({ _id: form.onboarding }, { $set: { status: 'reviewed' } });
    form.status = 'reviewed';
    await form.save();
    res.json({ ok: true, status: 'reviewed' });
  } catch (e) {
    console.error('forms reviewed', e);
    res.status(500).json({ message: 'Could not update the form' });
  }
});

router.delete('/:id', staff, async (req, res) => {
  try {
    if (!validId(req.params.id)) return res.status(404).json({ message: 'Form not found' });
    const done = await CompanyForm.deleteOne({ _id: req.params.id, sender: req.user.id, status: 'pending' });
    if (!done.deletedCount) return res.status(404).json({ message: 'Form not found or already submitted' });
    res.json({ ok: true });
  } catch (e) {
    console.error('forms delete', e);
    res.status(500).json({ message: 'Could not delete the form' });
  }
});

// ---------- Company (client account) ----------

const clientCompanyId = async (req) => {
  const me = await Client.findById(req.user.id).select('companies').lean();
  return me?.companies?.[0] || null;
};

router.get('/received', clientOnly, async (req, res) => {
  try {
    const companyId = await clientCompanyId(req);
    if (!companyId) return res.status(404).json({ message: 'No company is linked to this account. Please contact your admin.' });
    await syncOnboarding({ company: companyId });
    const company = await Company.findById(companyId).select('name email').lean();
    const list = await CompanyForm.find({ company: companyId }).sort({ createdAt: -1 }).limit(200).lean();
    const sub = await latestSubmission(company);
    res.json({ forms: list.map((f) => formView(f, company)), onboarding: submissionSummary(sub) });
  } catch (e) {
    console.error('forms received', e);
    res.status(500).json({ message: 'Could not load your forms' });
  }
});

// ---------- One form in full, with the submitted answers: its sender, or the company it was sent to ----------
router.get('/:id', anyone, async (req, res) => {
  try {
    if (!validId(req.params.id)) return res.status(404).json({ message: 'Form not found' });
    const found = await CompanyForm.findById(req.params.id).select('company sender').lean();
    if (!found) return res.status(404).json({ message: 'Form not found' });
    const allowed = req.user.role === 'clients'
      ? String(await clientCompanyId(req)) === String(found.company)
      : String(found.sender) === String(req.user.id);
    if (!allowed) return res.status(404).json({ message: 'Form not found' });
    await syncOnboarding({ _id: found._id });
    const form = await CompanyForm.findById(found._id).populate('company', 'name').lean();
    const sub = form.onboarding ? await Onboarding.findById(form.onboarding).lean() : null;
    res.json({
      form: {
        ...formView(form, form.company),
        onboarding: sub ? {
          companyName: sub.companyName,
          contactPerson: sub.contactPerson,
          email: sub.email,
          status: sub.status,
          submittedAt: sub.createdAt,
          answers: (sub.answers || []).map((a) => ({ questionId: a.questionId, section: a.section, question: a.question, answer: a.answer }))
        } : null
      }
    });
  } catch (e) {
    console.error('forms get', e);
    res.status(500).json({ message: 'Could not load the form' });
  }
});

export default router;
