import express from 'express';
import mongoose from 'mongoose';
import { protect } from '../auth.js';
import { Client, Smi } from '../admin/UserModels.js';
import Company from '../company/Company.js';
import Sme from '../sme/Sme.js';
import SopAssignment from '../sop/SopAssignment.js';
import SmiSopAssignment from '../sop/SmiSopAssignment.js';
import Meeting from '../meeting/Meeting.js';
import Creative from '../sme/Creative.js';
import CreativeComment from './CreativeComment.js';
import { notifyUsers } from '../notifications/notify.js';
import { periodKey, resolveToday } from '../sop/period.js';

const router = express.Router();
router.use(protect(['clients']));

// What a client may see: final (approved) designs, plus designs in redo that come from the client's own feedback
// (the revision was sent by the client, or the client had already commented on it). A redo the SME asked for
// on a first delivery was never shown to the client, so it stays hidden.
const clientVisible = async (companyId) => {
  const commented = await CreativeComment.distinct('creative', { company: companyId, deletedAt: null });
  return {
    company: companyId,
    $or: [
      { 'designOutput.status': 'approved' },
      { 'designOutput.status': 'redo', $or: [{ 'designOutput.redoBy': 'client' }, { _id: { $in: commented } }] }
    ]
  };
};

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

    // final creatives, and the ones this client sent back with a revision (redo)
    const finals = await Creative.find(await clientVisible(company._id))
      .select('date contentPillar.title contentPillar.platforms designOutput.status designOutput.version designOutput.reviewedAt')
      .sort({ date: 1 })
      .limit(1000)
      .lean();
    const redoing = finals.filter((f) => f.designOutput.status === 'redo');
    const redoPins = redoing.length
      ? await CreativeComment.find({ creative: { $in: redoing.map((f) => f._id) }, status: 'open', deletedAt: null }).select('creative version').lean()
      : [];
    const pinCount = {};
    const redoVersion = new Map(redoing.map((f) => [String(f._id), f.designOutput.version || 1]));
    redoPins.forEach((p) => {
      if (redoVersion.get(String(p.creative)) === p.version) pinCount[String(p.creative)] = (pinCount[String(p.creative)] || 0) + 1;
    });
    const creatives = {
      approved: finals.length - redoing.length,
      redo: redoing.length,
      redoList: redoing.map((f) => ({
        id: String(f._id),
        title: f.contentPillar?.title || 'Untitled',
        date: f.date,
        platforms: f.contentPillar?.platforms || [],
        pins: pinCount[String(f._id)] || 0,
        sentAt: f.designOutput.reviewedAt || null
      }))
    };

    res.json({
      company: { id: String(company._id), name: company.name, logo: company.logo || '', email: company.email || '' },
      today,
      creatives,
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
    // final designs, plus the ones this client sent back with a pinpoint revision (waiting for the new version)
    const list = await Creative.find(await clientVisible(companyId))
      .select('date contentPillar designOutput.url designOutput.resourceType designOutput.mimeType designOutput.originalName designOutput.version designOutput.status')
      .sort({ date: 1, createdAt: 1 })
      .limit(1000)
      .lean();
    // open pins on the version the client sees: the creative shows as "changes requested" while any are open
    const pins = list.length
      ? await CreativeComment.find({ creative: { $in: list.map((c) => c._id) }, status: 'open', deletedAt: null }).select('creative version').lean()
      : [];
    const openBy = {};
    const versionOf = new Map(list.map((c) => [String(c._id), c.designOutput.version || 1]));
    pins.forEach((p) => {
      const key = String(p.creative);
      if (versionOf.get(key) === p.version) openBy[key] = (openBy[key] || 0) + 1;
    });
    res.json({
      company: company ? { id: String(company._id), name: company.name, logo: company.logo || '' } : null,
      creatives: list.map((c) => ({
        id: String(c._id),
        openFeedback: openBy[String(c._id)] || 0,
        revisionSent: c.designOutput.status === 'redo',
        date: c.date,
        title: c.contentPillar?.title || 'Untitled',
        caption: c.contentPillar?.caption || '',
        hashtags: c.contentPillar?.hashtags || [],
        platforms: c.contentPillar?.platforms || [],
        version: c.designOutput.version || 1,
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

// ---------------------------------------------------------------------------------------------
// Pinpoint feedback: the client clicks a spot on a final creative and leaves a comment there.
// Comments belong to ONE version of the design (designOutput.version), so earlier versions keep
// their own pins when version history / compare arrive.
// ---------------------------------------------------------------------------------------------
const MAX_COMMENT = 1000;
const brief = (t) => (t.length > 120 ? `${t.slice(0, 117)}…` : t);
const round2 = (n) => Math.round(n * 100) / 100;

// The signed-in client plus ONE of their own company's final creatives. When it cannot give both it
// has already sent the error response and returns null.
const loadForClient = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400).json({ message: 'Invalid creative id' });
    return null;
  }
  const client = await Client.findById(req.user.id).select('companies name fullname email').lean();
  const companyId = client?.companies?.[0];
  if (!companyId) {
    res.status(404).json({ message: 'No company is linked to this account. Please contact your admin.' });
    return null;
  }
  const creative = await Creative.findOne({ ...(await clientVisible(companyId)), _id: req.params.id })
    .select('user company assignedDesigner contentPillar.title designOutput.version designOutput.status')
    .lean();
  if (!creative) {
    res.status(404).json({ message: 'Creative not found' });
    return null;
  }
  return { client, creative };
};

const actorOf = (client) => ({ userId: client._id, role: 'clients', name: client.name || client.fullname || client.email || 'Client' });

const personView = (a, meId) => (a ? {
  id: String(a.userId),
  name: a.name || 'Team member',
  role: a.role,
  isMe: String(a.userId) === String(meId)
} : null);

const commentView = (c, meId) => ({
  id: String(c._id),
  n: c.n,
  x: c.x,
  y: c.y,
  version: c.version,
  text: c.text,
  status: c.status,
  createdAt: c.createdAt,
  author: personView(c.author, meId),
  resolvedBy: personView(c.resolvedBy, meId),
  resolvedAt: c.resolvedAt || null,
  replies: (c.replies || []).map((r) => ({
    id: String(r._id),
    text: r.text,
    createdAt: r.createdAt,
    author: personView(r.author, meId)
  }))
});

// The SME who owns the creative and the designer on it hear about new client feedback.
const notifyTeam = (creative, actor, title, message) => {
  const to = [{ id: creative.user, role: 'sme' }];
  if (creative.assignedDesigner) to.push({ id: creative.assignedDesigner, role: 'des' });
  notifyUsers(to, { topic: 'creatives', tone: 'info', title, message }, actor);
};

// Send the revision: the open pins go to the SME and the designer, and the design goes back to "redo" for both.
router.post('/creatives/:id/revision', async (req, res) => {
  try {
    const ctx = await loadForClient(req, res);
    if (!ctx) return;
    if (ctx.creative.designOutput?.status !== 'approved') return res.status(409).json({ message: 'Your revision was already sent.' });
    const version = ctx.creative.designOutput.version || 1;
    const pins = await CreativeComment.find({ creative: ctx.creative._id, version, status: 'open', deletedAt: null }).sort({ n: 1 }).lean();
    if (!pins.length) return res.status(400).json({ message: 'Click on the creative and add at least one comment first' });
    const note = `Client feedback: ${pins.map((p) => `#${p.n} ${p.text}`).join(' | ')}`.slice(0, 500);
    const updated = await Creative.findOneAndUpdate(
      { _id: ctx.creative._id, 'designOutput.status': 'approved' },
      { $set: { 'designOutput.status': 'redo', 'designOutput.note': note, 'designOutput.redoBy': 'client', 'designOutput.reviewedAt': new Date() }, $inc: { 'designOutput.redoCount': 1 } },
      { new: true }
    ).select('_id').lean();
    if (!updated) return res.status(409).json({ message: 'Your revision was already sent.' });
    notifyTeam(ctx.creative, req.user, 'Client sent a revision',
      `{actor} asked for changes on "${ctx.creative.contentPillar?.title || 'a creative'}" (${pins.length} pin${pins.length > 1 ? 's' : ''}). It is back in Redo.`);
    res.json({ id: String(ctx.creative._id), revisionSent: true });
  } catch (e) {
    console.error('client revision', e);
    res.status(500).json({ message: 'Could not send your revision' });
  }
});

// All pins on a version (the current one unless ?version=N is given).
router.get('/creatives/:id/comments', async (req, res) => {
  try {
    const ctx = await loadForClient(req, res);
    if (!ctx) return;
    const currentVersion = ctx.creative.designOutput?.version || 1;
    const asked = Number.parseInt(req.query.version, 10);
    const version = Number.isInteger(asked) && asked >= 1 ? asked : currentVersion;
    const list = await CreativeComment.find({ creative: ctx.creative._id, version, deletedAt: null }).sort({ n: 1 }).lean();
    res.json({ version, currentVersion, comments: list.map((c) => commentView(c, req.user.id)) });
  } catch (e) {
    console.error('client comments list', e);
    res.status(500).json({ message: 'Could not load the comments' });
  }
});

// Drop a new pin on the current version.
router.post('/creatives/:id/comments', async (req, res) => {
  try {
    const ctx = await loadForClient(req, res);
    if (!ctx) return;
    const { x, y } = req.body || {};
    const text = String(req.body?.text ?? '').trim();
    // real numbers only: Number(null) and Number('') are 0 and would silently pin the top-left corner
    if (![x, y].every((n) => typeof n === 'number' && Number.isFinite(n)) || x < 0 || x > 100 || y < 0 || y > 100) {
      return res.status(400).json({ message: 'Click on the creative to choose where your comment goes' });
    }
    if (!text) return res.status(400).json({ message: 'Please write your comment' });
    if (text.length > MAX_COMMENT) return res.status(400).json({ message: `Comments can be at most ${MAX_COMMENT} characters` });
    if (ctx.creative.designOutput?.status !== 'approved') return res.status(409).json({ message: 'Your revision was already sent. New comments can be added on the next version.' });

    const version = ctx.creative.designOutput?.version || 1;
    const actor = actorOf(ctx.client);
    let saved = null;
    // pin numbers count up per version and are never reused (deleted pins keep theirs); retry if two land together
    for (let attempt = 0; attempt < 3 && !saved; attempt += 1) {
      const last = await CreativeComment.findOne({ creative: ctx.creative._id, version }).sort({ n: -1 }).select('n').lean();
      try {
        saved = await CreativeComment.create({
          creative: ctx.creative._id,
          company: ctx.creative.company,
          version,
          n: (last?.n || 0) + 1,
          x: round2(x),
          y: round2(y),
          text,
          author: actor
        });
      } catch (err) {
        if (err?.code !== 11000) throw err;
      }
    }
    if (!saved) return res.status(409).json({ message: 'Another comment was added at the same moment. Please try again.' });

    notifyTeam(ctx.creative, req.user, 'New client feedback',
      `{actor} commented on "${ctx.creative.contentPillar?.title || 'a creative'}" (pin #${saved.n}): ${brief(text)}`);
    res.status(201).json({ comment: commentView(saved.toObject(), req.user.id) });
  } catch (e) {
    console.error('client comment create', e);
    res.status(500).json({ message: 'Could not save your comment' });
  }
});

// Reply inside a pin's thread.
router.post('/creatives/:id/comments/:cid/replies', async (req, res) => {
  try {
    const ctx = await loadForClient(req, res);
    if (!ctx) return;
    if (!mongoose.isValidObjectId(req.params.cid)) return res.status(400).json({ message: 'Invalid comment id' });
    const text = String(req.body?.text ?? '').trim();
    if (!text) return res.status(400).json({ message: 'Please write your reply' });
    if (text.length > MAX_COMMENT) return res.status(400).json({ message: `Replies can be at most ${MAX_COMMENT} characters` });

    const updated = await CreativeComment.findOneAndUpdate(
      { _id: req.params.cid, creative: ctx.creative._id, deletedAt: null },
      { $push: { replies: { author: actorOf(ctx.client), text } } },
      { new: true, runValidators: true }
    ).lean();
    if (!updated) return res.status(404).json({ message: 'Comment not found' });

    notifyTeam(ctx.creative, req.user, 'Client replied',
      `{actor} replied on "${ctx.creative.contentPillar?.title || 'a creative'}" (pin #${updated.n}): ${brief(text)}`);
    res.status(201).json({ comment: commentView(updated, req.user.id) });
  } catch (e) {
    console.error('client comment reply', e);
    res.status(500).json({ message: 'Could not save your reply' });
  }
});

// Mark a pin resolved, or open it again. Who did it and when is kept.
router.patch('/creatives/:id/comments/:cid', async (req, res) => {
  try {
    const ctx = await loadForClient(req, res);
    if (!ctx) return;
    if (!mongoose.isValidObjectId(req.params.cid)) return res.status(400).json({ message: 'Invalid comment id' });
    const status = String(req.body?.status || '');
    if (!['open', 'resolved'].includes(status)) return res.status(400).json({ message: 'Status must be open or resolved' });

    const set = status === 'resolved'
      ? { status, resolvedBy: actorOf(ctx.client), resolvedAt: new Date() }
      : { status, resolvedBy: null, resolvedAt: null };
    const updated = await CreativeComment.findOneAndUpdate(
      { _id: req.params.cid, creative: ctx.creative._id, deletedAt: null },
      { $set: set },
      { new: true }
    ).lean();
    if (!updated) return res.status(404).json({ message: 'Comment not found' });
    res.json({ comment: commentView(updated, req.user.id) });
  } catch (e) {
    console.error('client comment status', e);
    res.status(500).json({ message: 'Could not update the comment' });
  }
});

// Remove your own pin. It is hidden, not erased: who removed it and when stays on record.
router.delete('/creatives/:id/comments/:cid', async (req, res) => {
  try {
    const ctx = await loadForClient(req, res);
    if (!ctx) return;
    if (!mongoose.isValidObjectId(req.params.cid)) return res.status(400).json({ message: 'Invalid comment id' });
    const removed = await CreativeComment.findOneAndUpdate(
      { _id: req.params.cid, creative: ctx.creative._id, deletedAt: null, 'author.userId': req.user.id },
      { $set: { deletedAt: new Date(), deletedBy: actorOf(ctx.client) } },
      { new: true }
    ).lean();
    if (!removed) return res.status(404).json({ message: 'Comment not found, or it is not yours to delete' });
    res.json({ id: String(removed._id) });
  } catch (e) {
    console.error('client comment delete', e);
    res.status(500).json({ message: 'Could not delete the comment' });
  }
});

export default router;
