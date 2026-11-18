import express from 'express';
import { protect } from '../auth.js';
import Sme from '../sme/Sme.js';
import Creative from '../sme/Creative.js';
import Task from '../sme/Tasks.js';
import Meeting from '../meeting/Meeting.js';
import Company from '../company/Company.js';
import Attendance from '../attendance/Attendance.js';
import { getOfficeConfig } from '../attendance/geo.js';
import { Smi, Des, Hr } from '../admin/UserModels.js';
import { momItemView, creativeItemView, reviewMom, reviewCreative } from '../review/reviewCore.js';

// Reporting manager panel. A reporting manager only ever sees the people who report to them
// (users whose reportingManagerId is this manager) and the work those people submit.
const router = express.Router();
router.use(protect(['reporting_manager']));

const TEAM_ROLES = [
  { role: 'sme', collection: 'smes', Model: Sme },
  { role: 'smi', collection: 'smis', Model: Smi },
  { role: 'des', collection: 'des', Model: Des },
  { role: 'hr', collection: 'hrs', Model: Hr },
];

const loadTeam = async (managerId) => {
  const groups = await Promise.all(
    TEAM_ROLES.map(async ({ role, collection, Model }) => {
      const docs = await Model.find({ reportingManagerId: managerId }).sort({ name: 1 }).lean();
      return docs.map((u) => ({ ...u, _role: role, _collection: collection }));
    })
  );
  return groups.flat();
};

const memberView = (u, companyById = {}) => ({
  id: String(u._id),
  name: u.name || u.fullname || u.email,
  email: u.email,
  role: String(u.role || u._role).toUpperCase(),
  collection: u._collection,
  contact: u.contact || '',
  reportingManagerId: u.reportingManagerId ? String(u.reportingManagerId) : '',
  profileImage: u.profileImage || u.avatar || '',
  companies: (u.companies || []).map((id) => companyById[String(id)]).filter(Boolean),
  createdAt: u.createdAt,
});

const smeIdsOf = (team) => team.filter((u) => u._role === 'sme').map((u) => u._id);

// Same shape the admin attendance page expects from /admin/users, but only this manager's team.
router.get('/users', async (req, res) => {
  const team = await loadTeam(req.user.id);
  res.json({ users: team.map((u) => ({ ...memberView(u), companies: (u.companies || []).map(String) })) });
});

// Team members with their companies and what is waiting on the manager.
router.get('/team', async (req, res) => {
  const team = await loadTeam(req.user.id);
  const smeIds = smeIdsOf(team);
  const companyIds = [...new Set(team.flatMap((u) => (u.companies || []).map(String)))];
  const companies = await Company.find({ _id: { $in: companyIds } }).lean();
  const companyById = Object.fromEntries(
    companies.map((c) => [String(c._id), { id: String(c._id), name: c.name, logo: c.logo || '' }])
  );

  const [pendingCreatives, pendingMoms, openTasks] = await Promise.all([
    Creative.aggregate([{ $match: { user: { $in: smeIds }, status: 'pending' } }, { $group: { _id: '$user', n: { $sum: 1 } } }]),
    Meeting.aggregate([{ $match: { user: { $in: smeIds }, 'mom.status': 'pending', 'mom.submittedAt': { $exists: true } } }, { $group: { _id: '$user', n: { $sum: 1 } } }]),
    Task.aggregate([{ $match: { user: { $in: smeIds }, status: { $ne: 'completed' } } }, { $group: { _id: '$user', n: { $sum: 1 } } }]),
  ]);
  const toMap = (rows) => Object.fromEntries(rows.map((r) => [String(r._id), r.n]));
  const pc = toMap(pendingCreatives);
  const pm = toMap(pendingMoms);
  const ot = toMap(openTasks);

  res.json({
    members: team.map((u) => ({
      ...memberView(u, companyById),
      pendingCreatives: pc[String(u._id)] || 0,
      pendingMoms: pm[String(u._id)] || 0,
      openTasks: ot[String(u._id)] || 0,
    })),
  });
});

// Numbers for the dashboard.
router.get('/overview', async (req, res) => {
  const team = await loadTeam(req.user.id);
  const smeIds = smeIdsOf(team);
  const companyIds = new Set(team.flatMap((u) => (u.companies || []).map(String)));

  const [creativeRows, momRows, taskRows, recentCreatives, recentMoms] = await Promise.all([
    Creative.aggregate([{ $match: { user: { $in: smeIds } } }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
    Meeting.aggregate([{ $match: { user: { $in: smeIds }, 'mom.submittedAt': { $exists: true } } }, { $group: { _id: '$mom.status', n: { $sum: 1 } } }]),
    Task.aggregate([{ $match: { user: { $in: smeIds } } }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
    Creative.find({ user: { $in: smeIds }, status: 'pending' }).sort({ createdAt: 1 }).limit(5)
      .populate('company', 'name').populate('user', 'name fullname email').populate('assignedDesigner', 'name email'),
    Meeting.find({ user: { $in: smeIds }, 'mom.status': 'pending', 'mom.submittedAt': { $exists: true } })
      .sort({ 'mom.submittedAt': 1 }).limit(5)
      .populate('company', 'name').populate('user', 'name fullname email'),
  ]);
  const toMap = (rows) => Object.fromEntries(rows.map((r) => [r._id, r.n]));
  const cr = toMap(creativeRows);
  const mm = toMap(momRows);
  const tk = toMap(taskRows);
  const creativeTotal = Object.values(cr).reduce((a, b) => a + b, 0);

  res.json({
    counts: {
      team: team.length,
      smes: smeIds.length,
      companies: companyIds.size,
      creativesPending: cr.pending || 0,
      creativesApproved: cr.approved || 0,
      creativesRejected: cr.rejected || 0,
      creativesTotal: creativeTotal,
      momsPending: mm.pending || 0,
      momsApproved: mm.approved || 0,
      tasksNew: tk.new || 0,
      tasksInProgress: tk['in-progress'] || 0,
      tasksCompleted: tk.completed || 0,
    },
    team: team.map((u) => ({
      id: String(u._id),
      name: u.name || u.fullname || u.email,
      email: u.email,
      role: String(u.role || u._role).toUpperCase(),
      profileImage: u.profileImage || u.avatar || '',
    })),
    pendingCreatives: recentCreatives.map(creativeItemView),
    pendingMoms: recentMoms.map(momItemView),
  });
});

// ---------------- Creative approvals (only the team's SMEs) ----------------
router.get('/creatives', async (req, res) => {
  const smeIds = smeIdsOf(await loadTeam(req.user.id));
  const list = await Creative.find({ user: { $in: smeIds } })
    .sort({ createdAt: -1 })
    .limit(500)
    .populate('company', 'name')
    .populate('user', 'name fullname email')
    .populate('assignedDesigner', 'name email');
  res.json({ creatives: list.map(creativeItemView) });
});
const creativeScope = async (req) => ({ user: { $in: smeIdsOf(await loadTeam(req.user.id)) } });
router.put('/creatives/:id/approve', async (req, res) => reviewCreative(req, res, 'approve', await creativeScope(req)));
router.put('/creatives/:id/reject', async (req, res) => reviewCreative(req, res, 'reject', await creativeScope(req)));

// ---------------- MOM approvals (only the team's SMEs) ----------------
router.get('/moms', async (req, res) => {
  const smeIds = smeIdsOf(await loadTeam(req.user.id));
  const list = await Meeting.find({ user: { $in: smeIds }, 'mom.submittedAt': { $exists: true } })
    .sort({ 'mom.submittedAt': -1 })
    .limit(300)
    .populate('company', 'name')
    .populate('user', 'name fullname email');
  res.json({ moms: list.map(momItemView) });
});
router.put('/moms/:id/approve', async (req, res) => reviewMom(req, res, 'approve', await creativeScope(req)));
router.put('/moms/:id/send-back', async (req, res) => reviewMom(req, res, 'send-back', await creativeScope(req)));
router.put('/moms/:id/reject', async (req, res) => reviewMom(req, res, 'reject', await creativeScope(req)));

// ---------------- Attendance (the team, plus the manager's own sessions) ----------------
router.get('/attendance', async (req, res) => {
  const team = await loadTeam(req.user.id);
  const allowed = team.map((u) => String(u._id));
  const filter = {};
  if (req.query.userId) {
    if (!allowed.includes(String(req.query.userId))) {
      return res.status(403).json({ message: 'That person does not report to you' });
    }
    filter.userId = req.query.userId;
  } else {
    filter.userId = { $in: allowed };
  }
  const range = {};
  if (req.query.from) {
    const d = new Date(`${req.query.from}T00:00:00`);
    if (!isNaN(d)) range.$gte = d;
  }
  if (req.query.to) {
    const d = new Date(`${req.query.to}T23:59:59.999`);
    if (!isNaN(d)) range.$lte = d;
  }
  if (Object.keys(range).length) filter.loginAt = range;
  const limit = Math.min(parseInt(req.query.limit, 10) || 500, 2000);
  const records = await Attendance.find(filter).sort({ loginAt: -1 }).limit(limit).lean();
  const office = getOfficeConfig();
  res.json({
    office: { configured: office.configured, radius: office.radius },
    records: records.map((r) => ({
      id: r._id,
      userId: r.userId,
      name: r.name,
      email: r.email,
      role: r.role,
      loginAt: r.loginAt,
      logoutAt: r.logoutAt,
      distance: r.loginLocation?.distance ?? null,
      accuracy: r.loginLocation?.accuracy ?? null,
    })),
  });
});

export default router;
