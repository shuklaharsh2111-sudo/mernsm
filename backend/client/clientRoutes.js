import express from 'express';
import { protect } from '../auth.js';
import { Client, Smi } from '../admin/UserModels.js';
import Company from '../company/Company.js';
import Sme from '../sme/Sme.js';
import SopAssignment from '../sop/SopAssignment.js';
import SmiSopAssignment from '../sop/SmiSopAssignment.js';
import Meeting from '../meeting/Meeting.js';
import Creative from '../sme/Creative.js';
import { periodKey, resolveToday } from '../sop/period.js';

const router = express.Router();
router.use(protect(['clients']));

const personName = (u) => (u ? u.name || u.fullname || 'Team member' : 'Team member');

// Everything here is read-only and limited to the company linked to this client account.
router.get('/dashboard', async (req, res) => {
  try {
    const client = await Client.findById(req.user.id).select('companies').lean();
    const companyId = client?.companies?.[0];
    const company = companyId ? await Company.findById(companyId).lean() : null;
    if (!company) return res.status(404).json({ message: 'No company is linked to this account. Please contact your admin.' });

    const today = resolveToday(req.query.today);
    const [smes, smis, smeSops, smiSops, meetings] = await Promise.all([
      Sme.find({ companies: company._id }).select('name fullname email profileImage avatar').lean(),
      Smi.find({ companies: company._id }).select('name fullname email profileImage avatar').lean(),
      SopAssignment.find({ company: company._id }).populate('user', 'name fullname').sort({ createdAt: -1 }).limit(200).lean(),
      // SMI copies of an SME's SOP (sourceSop) are skipped so one SOP is not counted twice
      SmiSopAssignment.find({ company: company._id, sourceSop: null }).populate('smi', 'name fullname').sort({ createdAt: -1 }).limit(200).lean(),
      Meeting.find({ company: company._id }).populate('user', 'name fullname').sort({ date: 1, time: 1 }).limit(300).lean()
    ]);

    const team = [
      ...smes.map((u) => ({ id: String(u._id), name: personName(u), role: 'Social Media Executive', email: u.email || '', avatar: u.profileImage || u.avatar || '' })),
      ...smis.map((u) => ({ id: String(u._id), name: personName(u), role: 'Social Media Intern', email: u.email || '', avatar: u.profileImage || u.avatar || '' }))
    ];

    const sopView = (s, who) => ({
      id: String(s._id),
      type: s.type,
      text: s.text,
      assignee: personName(who),
      done: (s.completions || []).some((c) => c.period === periodKey(s.type, today))
    });
    const sops = [
      ...smeSops.map((s) => sopView(s, s.user)),
      ...smiSops.map((s) => sopView(s, s.smi))
    ];
    const byType = { daily: { total: 0, done: 0 }, weekly: { total: 0, done: 0 }, monthly: { total: 0, done: 0 } };
    sops.forEach((s) => {
      if (!byType[s.type]) return;
      byType[s.type].total += 1;
      if (s.done) byType[s.type].done += 1;
    });

    const meetingView = (m) => ({
      id: String(m._id), subject: m.subject, date: m.date, time: m.time, link: m.link || '', host: personName(m.user)
    });
    const upcoming = meetings.filter((m) => m.date >= today).slice(0, 8).map(meetingView);
    const recent = meetings.filter((m) => m.date < today).reverse().slice(0, 5).map(meetingView);

    res.json({
      company: { id: String(company._id), name: company.name, logo: company.logo || '', email: company.email || '' },
      today,
      team,
      sops: { total: sops.length, done: sops.filter((s) => s.done).length, byType, list: sops },
      meetings: { upcoming, recent }
    });
  } catch (e) {
    console.error('client dashboard', e);
    res.status(500).json({ message: 'Could not load your dashboard' });
  }
});

// Final output creatives: the designer's delivered file that has been approved, on its planned date.
router.get('/creatives', async (req, res) => {
  try {
    const client = await Client.findById(req.user.id).select('companies').lean();
    const companyId = client?.companies?.[0];
    if (!companyId) return res.status(404).json({ message: 'No company is linked to this account. Please contact your admin.' });
    const company = await Company.findById(companyId).select('name logo').lean();
    const list = await Creative.find({ company: companyId, 'designOutput.status': 'approved' })
      .select('date contentPillar designOutput.url designOutput.resourceType designOutput.mimeType designOutput.originalName')
      .sort({ date: 1, createdAt: 1 })
      .limit(1000)
      .lean();
    res.json({
      company: company ? { id: String(company._id), name: company.name, logo: company.logo || '' } : null,
      creatives: list.map((c) => ({
        id: String(c._id),
        date: c.date,
        title: c.contentPillar?.title || 'Untitled',
        caption: c.contentPillar?.caption || '',
        hashtags: c.contentPillar?.hashtags || [],
        platforms: c.contentPillar?.platforms || [],
        file: {
          url: c.designOutput.url,
          isVideo: c.designOutput.resourceType === 'video' || /^video\//.test(c.designOutput.mimeType || ''),
          name: c.designOutput.originalName || ''
        }
      }))
    });
  } catch (e) {
    console.error('client creatives', e);
    res.status(500).json({ message: 'Could not load your creatives' });
  }
});

export default router;
