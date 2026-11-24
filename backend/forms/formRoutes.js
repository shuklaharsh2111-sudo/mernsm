import express from 'express';
import mongoose from 'mongoose';
import { protect } from '../auth.js';
import { Client, roleModels } from '../admin/UserModels.js';
import Company from '../company/Company.js';
import CompanyForm from './CompanyForm.js';
import Onboarding from './Onboarding.js';
import { notifyUsers, notifyCompanyClients } from '../notifications/notify.js';

// The form that "Send form" sends. Override with ONBOARDING_FORM_URL in .env if the site moves.
export const ONBOARDING_URL = process.env.ONBOARDING_FORM_URL || 'https://onboardingquestions.onrender.com/';

const router = express.Router();
const staff = protect(['sme', 'smi']);
const clientOnly = protect(['clients']);
const anyone = protect(['sme', 'smi', 'clients']);

const validId = (id) => mongoose.Types.ObjectId.isValid(id);
const personName = (u) => (u ? u.name || u.fullname || u.email || '' : '');
const escapeRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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
    const [companies, clients] = await Promise.all([
      Company.find({ _id: { $in: companyIds } }).select('name email').lean(),
      Client.find({ companies: { $in: companyIds } }).select('email companies').lean()
    ]);
    for (const form of pending) {
      const company = companies.find((c) => String(c._id) === String(form.company));
      if (!company) continue;
      const emails = [
        company.email,
        ...clients.filter((cl) => (cl.companies || []).map(String).includes(String(company._id))).map((cl) => cl.email)
      ].filter(Boolean).map((e) => String(e).toLowerCase());
      const match = await Onboarding.findOne({
        createdAt: { $gte: form.createdAt },
        $or: [{ email: { $in: emails } }, { companyName: new RegExp(`^${escapeRe(company.name)}$`, 'i') }]
      }).sort({ createdAt: 1 }).lean();
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

const companyEmails = (company, clients) => [
  company.email,
  ...clients.filter((cl) => (cl.companies || []).map(String).includes(String(company._id))).map((cl) => cl.email)
].filter(Boolean).map((e) => String(e).toLowerCase());

const matchQuery = (company, emails) => ({
  $or: [{ email: { $in: emails } }, { companyName: new RegExp(`^${escapeRe(company.name)}$`, 'i') }]
});

// Whatever this company already submitted on the onboarding site (also before any form was sent from here).
const latestSubmission = async (company) => {
  const clients = await Client.find({ companies: company._id }).select('email companies').lean();
  return Onboarding.findOne(matchQuery(company, companyEmails(company, clients))).sort({ createdAt: -1 }).lean();
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
    const subs = await Promise.all(companies.map((c) => Onboarding.findOne(matchQuery(c, companyEmails(c, clients))).sort({ createdAt: -1 }).lean()));
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

// Open one existing submission (staff: of a company assigned to them; company: its own).
const submissionAccess = async (req) => {
  if (!validId(req.params.id)) return null;
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
    const clients = await Client.find({ companies: c._id }).select('email companies').lean();
    const emails = companyEmails(c, clients);
    if (emails.includes(sub.email) || String(sub.companyName).toLowerCase() === String(c.name).toLowerCase()) return { sub, company: c };
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
