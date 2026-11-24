import express from 'express';
import mongoose from 'mongoose';
import { protect } from '../auth.js';
import { Client, roleModels } from '../admin/UserModels.js';
import Company from '../company/Company.js';
import CompanyForm from './CompanyForm.js';
import { QUESTIONS, SECTIONS } from './questions.js';
import { notifyUsers, notifyCompanyClients } from '../notifications/notify.js';

const router = express.Router();
const staff = protect(['sme', 'smi']);
const clientOnly = protect(['clients']);
const anyone = protect(['sme', 'smi', 'clients']);

const validId = (id) => mongoose.Types.ObjectId.isValid(id);
const personName = (u) => (u ? u.name || u.fullname || u.email || '' : '');

const formView = (f, company) => ({
  id: String(f._id),
  companyId: String(company?._id || f.company),
  companyName: company?.name || '',
  title: f.title,
  note: f.note || '',
  status: f.status,
  senderName: f.senderName || '',
  senderRole: f.senderRole,
  createdAt: f.createdAt,
  submittedAt: f.submittedAt,
  submittedByName: f.submittedByName || ''
});

// The company a staff member may use: only the ones the admin assigned to them.
const assignedCompany = async (req, companyId) => {
  if (!validId(companyId)) return null;
  const me = await roleModels[req.user.role].findById(req.user.id).select('companies').lean();
  if (!me || !(me.companies || []).map(String).includes(String(companyId))) return null;
  return Company.findById(companyId).select('name logo email').lean();
};

// The companies a client account belongs to.
const clientCompanyIds = async (req) => {
  const me = await Client.findById(req.user.id).select('companies').lean();
  return (me?.companies || []).map(String);
};

// ---------- SME / SMI ----------

// Every company assigned to me, with its details, its client contact(s) and how many forms are out / back.
router.get('/companies', staff, async (req, res) => {
  try {
    const me = await roleModels[req.user.role].findById(req.user.id).select('companies').lean();
    const ids = (me?.companies || []).map(String);
    const [companies, clients, forms] = await Promise.all([
      Company.find({ _id: { $in: ids } }).select('name logo email clientUser createdAt').sort({ name: 1 }).lean(),
      Client.find({ companies: { $in: ids } }).select('name fullname email contact companies').lean(),
      CompanyForm.find({ company: { $in: ids }, sender: req.user.id }).select('company status submittedAt submittedByName').sort({ submittedAt: -1 }).lean()
    ]);
    res.json({
      companies: companies.map((c) => {
        const cid = String(c._id);
        const mine = forms.filter((f) => String(f.company) === cid);
        const latest = mine.find((f) => f.status !== 'pending');
        return {
          id: cid,
          name: c.name,
          logo: c.logo || '',
          email: c.email || '',
          clients: clients
            .filter((cl) => (cl.companies || []).map(String).includes(cid) || String(c.clientUser || '') === String(cl._id))
            .map((cl) => ({ id: String(cl._id), name: personName(cl), email: cl.email, contact: cl.contact || '' })),
          // the company's own latest answered form (only forms sent to this company, never another one)
          latest: latest ? { formId: String(latest._id), status: latest.status, submittedAt: latest.submittedAt, contactPerson: latest.submittedByName } : null,
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
    const list = await CompanyForm.find({ company: company._id, sender: req.user.id }).select('-answers').sort({ createdAt: -1 }).limit(100).lean();
    res.json({ forms: list.map((f) => formView(f, company)) });
  } catch (e) {
    console.error('forms list', e);
    res.status(500).json({ message: 'Could not load the forms' });
  }
});

// "Send form": send the onboarding questions to the company's dashboard.
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
      note: String(req.body?.note || '').trim().slice(0, 1000)
    });
    notifyCompanyClients(company._id, { topic: 'forms', tone: 'info', title: 'Onboarding form to fill', message: '{actor} sent you the onboarding questions form. Please fill it in on your Forms page.' }, req.user);
    res.status(201).json({ form: formView(form.toObject(), company) });
  } catch (e) {
    console.error('forms create', e);
    res.status(500).json({ message: 'Could not send the form' });
  }
});

// Mark a submitted form as reviewed.
router.put('/:id/reviewed', staff, async (req, res) => {
  try {
    if (!validId(req.params.id)) return res.status(404).json({ message: 'Form not found' });
    const form = await CompanyForm.findOne({ _id: req.params.id, sender: req.user.id });
    if (!form) return res.status(404).json({ message: 'Form not found' });
    if (form.status === 'pending') return res.status(400).json({ message: 'The company has not submitted this form yet' });
    form.status = 'reviewed';
    await form.save();
    res.json({ ok: true, status: 'reviewed' });
  } catch (e) {
    console.error('forms reviewed', e);
    res.status(500).json({ message: 'Could not update the form' });
  }
});

// Take back a form the company has not answered yet.
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

// The forms sent to my company.
router.get('/received', clientOnly, async (req, res) => {
  try {
    const companyIds = await clientCompanyIds(req);
    if (!companyIds.length) return res.status(404).json({ message: 'No company is linked to this account. Please contact your admin.' });
    const companies = await Company.find({ _id: { $in: companyIds } }).select('name').lean();
    const list = await CompanyForm.find({ company: { $in: companyIds } }).select('-answers').sort({ createdAt: -1 }).limit(200).lean();
    res.json({ forms: list.map((f) => formView(f, companies.find((c) => String(c._id) === String(f.company)))) });
  } catch (e) {
    console.error('forms received', e);
    res.status(500).json({ message: 'Could not load your forms' });
  }
});

// Fill in and submit the form (once).
router.post('/:id/submit', clientOnly, async (req, res) => {
  try {
    if (!validId(req.params.id)) return res.status(404).json({ message: 'Form not found' });
    const companyIds = await clientCompanyIds(req);
    const form = await CompanyForm.findById(req.params.id);
    if (!form || !companyIds.includes(String(form.company))) return res.status(404).json({ message: 'Form not found' });
    if (form.status !== 'pending') return res.status(400).json({ message: 'This form has already been submitted' });

    const given = Array.isArray(req.body?.answers) ? req.body.answers : [];
    const answers = [];
    for (const q of QUESTIONS) {
      const a = given.find((x) => x && x.questionId === q.id);
      const text = typeof a?.answer === 'string' ? a.answer.trim() : '';
      if (!text) return res.status(400).json({ message: `Please answer question ${q.id.slice(1)}.` });
      answers.push({ questionId: q.id, section: q.section, question: q.question, answer: text.slice(0, 5000) });
    }

    const me = await Client.findById(req.user.id).select('name fullname email').lean();
    form.answers = answers;
    form.status = 'submitted';
    form.submittedAt = new Date();
    form.submittedBy = req.user.id;
    form.submittedByName = personName(me);
    form.submittedByEmail = me?.email || '';
    await form.save();

    const company = await Company.findById(form.company).select('name').lean();
    notifyUsers([{ id: form.sender, role: form.senderRole }], { topic: 'forms', tone: 'success', title: 'Onboarding form submitted', message: `${company?.name || 'A company'} submitted the onboarding questions.` }, req.user);
    res.json({ ok: true, form: formView(form.toObject(), company) });
  } catch (e) {
    console.error('forms submit', e);
    res.status(500).json({ message: 'Could not submit the form' });
  }
});

// ---------- One form in full: its sender, or the company it was sent to ----------
// A form still waiting also returns the questions, so the company can fill it in.
router.get('/:id', anyone, async (req, res) => {
  try {
    if (!validId(req.params.id)) return res.status(404).json({ message: 'Form not found' });
    const form = await CompanyForm.findById(req.params.id).populate('company', 'name').lean();
    if (!form) return res.status(404).json({ message: 'Form not found' });
    const allowed = req.user.role === 'clients'
      ? (await clientCompanyIds(req)).includes(String(form.company?._id))
      : String(form.sender) === String(req.user.id);
    if (!allowed) return res.status(404).json({ message: 'Form not found' });
    res.json({
      form: {
        ...formView(form, form.company),
        sections: SECTIONS,
        questions: form.status === 'pending' ? QUESTIONS : [],
        submission: form.status === 'pending' ? null : {
          contactPerson: form.submittedByName,
          email: form.submittedByEmail,
          submittedAt: form.submittedAt,
          answers: (form.answers || []).map((a) => ({ questionId: a.questionId, section: a.section, question: a.question, answer: a.answer }))
        }
      }
    });
  } catch (e) {
    console.error('forms get', e);
    res.status(500).json({ message: 'Could not load the form' });
  }
});

export default router;
