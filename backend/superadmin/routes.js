import express from 'express';
import { protect } from '../auth.js';
import Admin from '../admin/Admin.js';
import Company from '../company/Company.js';
import Meeting from '../meeting/Meeting.js';
import Creative from '../sme/Creative.js';
import Task from '../sme/Tasks.js';
import Attendance from '../attendance/Attendance.js';
import { roleModels, ReportingManager } from '../admin/UserModels.js';
import { userView, getRoleCollection, validId } from '../admin/userHelpers.js';
import { creativeItemView } from '../review/reviewCore.js';
import { healthOf } from '../sme/health.js';
import { resolveToday } from '../sop/period.js';
import { getOfficeConfig } from '../attendance/geo.js';
import { getStoredSettings, getLateAfter, saveAttendanceSettings } from '../attendance/settings.js';
import Sme from '../sme/Sme.js';
import { Smi } from '../admin/UserModels.js';

// SUPER ADMIN ONLY routes, mounted at /api/superadmin. Every route here is blocked for normal admins.
const router = express.Router();
router.use(protect(['admin']), (req, res, next) => (
  req.user?.isSuperAdmin ? next() : res.status(403).json({ message: 'Only a super admin can access this.' })
));
// GET /api/superadmin/overall  -> system-wide numbers for the super admin's overall dashboard
router.get('/overall', async (req, res) => {
  try {
    const departments = Object.entries(roleModels).filter(([role]) => role !== 'admin');
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const [adminTotal, superTotal, deptCounts, companies, creativeRows, momRows, taskRows, onlineNow, loginsToday, recentAdmins, recentUsers] = await Promise.all([
      Admin.countDocuments(),
      Admin.countDocuments({ isSuperAdmin: true }),
      Promise.all(departments.map(async ([role, Model]) => ({
        role,
        total: await Model.countDocuments(),
        banned: await Model.countDocuments({ isBanned: true })
      }))),
      Company.countDocuments(),
      Creative.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
      Meeting.aggregate([{ $match: { 'mom.submittedAt': { $exists: true } } }, { $group: { _id: '$mom.status', n: { $sum: 1 } } }]),
      Task.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
      Attendance.distinct('userId', { logoutAt: null, loginAt: { $gte: new Date(Date.now() - 24 * 3600 * 1000) } }),
      Attendance.distinct('userId', { loginAt: { $gte: startOfDay } }),
      Admin.find().sort({ createdAt: -1 }).limit(5).lean(),
      Promise.all(departments.map(async ([role, Model]) => (await Model.find().sort({ createdAt: -1 }).limit(5).lean()).map((u) => userView(u, getRoleCollection(role))))),
    ]);
    const map = (rows) => Object.fromEntries(rows.map((r) => [r._id, r.n]));
    const cr = map(creativeRows);
    const mm = map(momRows);
    const tk = map(taskRows);
    res.json({
      admins: { total: adminTotal, superAdmins: superTotal, normal: adminTotal - superTotal },
      departments: deptCounts.map((d) => ({ role: d.role.toUpperCase(), collection: getRoleCollection(d.role), total: d.total, banned: d.banned })),
      employees: deptCounts.reduce((n, d) => n + d.total, 0),
      companies,
      creatives: { pending: cr.pending || 0, approved: cr.approved || 0, rejected: cr.rejected || 0, total: Object.values(cr).reduce((a, b) => a + b, 0) },
      moms: { pending: mm.pending || 0, approved: mm.approved || 0 },
      tasks: { new: tk.new || 0, inProgress: tk['in-progress'] || 0, completed: tk.completed || 0 },
      activity: { onlineNow: onlineNow.length, loginsToday: loginsToday.length },
      recentAdmins: recentAdmins.map((a) => userView(a, 'admins')),
      recentUsers: recentUsers.flat().sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 6)
    });
  } catch (error) {
    console.error('Overall dashboard error:', error);
    res.status(500).json({ message: 'Unable to load the overall dashboard' });
  }
});
// GET /api/superadmin/company-overview  -> one row per company: assigned SME(s) and SMI(s), creative counts, health
router.get('/company-overview', async (req, res) => {
  try {
    const today = resolveToday(req.query.today);
    const [companies, smes, smis, creatives] = await Promise.all([
      Company.find().sort({ name: 1 }).lean(),
      Sme.find({ 'companies.0': { $exists: true } }).select('name fullname email companies isBanned profileImage avatar').lean(),
      Smi.find({ 'companies.0': { $exists: true } }).select('name fullname email companies isBanned profileImage avatar').lean(),
      Creative.find().select('company date status createdAt rejectionCount').lean(),
    ]);
    const stats = {};
    for (const c of creatives) {
      const key = String(c.company);
      const m = stats[key] || (stats[key] = { total: 0, approved: 0, pending: 0, redo: 0, rejected: 0, delays: 0, overdue: 0 });
      m.total += 1;
      if (c.status === 'approved') m.approved += 1;
      else if (c.status === 'pending') m.pending += 1;
      else if (c.status === 'rejected') m.redo += 1;
      m.rejected += Math.max(c.rejectionCount || 0, c.status === 'rejected' ? 1 : 0);
      if (c.createdAt && c.createdAt.toISOString().slice(0, 10) > c.date) m.delays += 1;
      if (c.status !== 'approved' && c.date < today) m.overdue += 1;
    }
    const peopleFor = (rows, companyId) => rows
      .filter((u) => (u.companies || []).some((id) => String(id) === companyId))
      .map((u) => ({ id: String(u._id), name: u.name || u.fullname || u.email, email: u.email, isBanned: !!u.isBanned, profileImage: u.profileImage || u.avatar || '' }));
    const list = companies.map((c) => {
      const id = String(c._id);
      const m = stats[id] || { total: 0, approved: 0, pending: 0, redo: 0, rejected: 0, delays: 0, overdue: 0 };
      return {
        id,
        name: c.name,
        logo: c.logo || '',
        smes: peopleFor(smes, id),
        smis: peopleFor(smis, id),
        ...m,
        approvalRate: m.total ? Math.round((m.approved / m.total) * 100) : 0,
        health: m.total ? healthOf(m) : 'nodata',
      };
    });
    res.json({ companies: list, today });
  } catch (error) {
    console.error('Company overview error:', error);
    res.status(500).json({ message: 'Unable to load the company overview' });
  }
});
// ---------- Online now + login history (same data as the HR pages, but for every role) ----------
const ALL_ROLES = Object.keys(roleModels);
const dayKeyOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
// GET /api/superadmin/presence  -> everyone, online or offline right now (online = today's latest session has no sign-out)
router.get('/presence', async (req, res) => {
  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const [lists, records] = await Promise.all([
      Promise.all(ALL_ROLES.map(async (role) => (await roleModels[role].find().lean()).map((u) => ({
        id: String(u._id),
        name: u.name || u.fullname || u.email,
        role,
        profileImage: u.profileImage || u.avatar || '',
      })))),
      Attendance.find({ loginAt: { $gte: startOfToday } }).sort({ loginAt: 1 }).lean(),
    ]);
    const byUser = new Map();
    records.forEach((r) => {
      const k = String(r.userId);
      if (!byUser.has(k)) byUser.set(k, []);
      byUser.get(k).push(r);
    });
    const people = lists.flat().map((p) => {
      const sessions = byUser.get(p.id) || [];
      const first = sessions[0];
      const last = sessions[sessions.length - 1];
      const online = !!last && !last.logoutAt;
      return { ...p, online, firstLogin: first?.loginAt || null, lastLogout: online ? null : last?.logoutAt || null };
    }).sort((a, b) => a.name.localeCompare(b.name));
    const online = people.filter((p) => p.online).length;
    res.json({ summary: { total: people.length, online, offline: people.length - online }, people, date: dayKeyOf(startOfToday) });
  } catch (error) {
    console.error('Presence error:', error);
    res.status(500).json({ message: 'Unable to load who is online' });
  }
});
// GET /api/superadmin/login-history?from=YYYY-MM-DD&to=YYYY-MM-DD&role=sme&userId=<id>  -> every login / logout, newest first
router.get('/login-history', async (req, res) => {
  try {
    const filter = {};
    if (req.query.userId) {
      if (!validId(req.query.userId)) return res.status(400).json({ message: 'Invalid user' });
      filter.userId = req.query.userId;
    }
    if (ALL_ROLES.includes(req.query.role)) filter.role = req.query.role;
    const range = {};
    if (req.query.from) {
      const d = new Date(`${req.query.from}T00:00:00`);
      if (!Number.isNaN(d.getTime())) range.$gte = d;
    }
    if (req.query.to) {
      const d = new Date(`${req.query.to}T23:59:59.999`);
      if (!Number.isNaN(d.getTime())) range.$lte = d;
    }
    if (Object.keys(range).length) filter.loginAt = range;
    const limit = Math.min(parseInt(req.query.limit, 10) || 500, 2000);
    const records = await Attendance.find(filter).sort({ loginAt: -1 }).limit(limit).lean();
    res.json({
      records: records.map((r) => ({
        id: String(r._id),
        userId: String(r.userId),
        name: r.name,
        email: r.email,
        role: r.role,
        loginAt: r.loginAt,
        logoutAt: r.logoutAt,
        ipAddress: r.ipAddress || '',
      })),
    });
  } catch (error) {
    console.error('Login history error:', error);
    res.status(500).json({ message: 'Unable to load login history' });
  }
});
// ---------- Office + attendance settings (replaces OFFICE_LAT / OFFICE_LNG / OFFICE_RADIUS_METERS / HR_LATE_AFTER in .env) ----------
const settingsView = () => {
  const o = getOfficeConfig();
  const saved = getStoredSettings() || {};
  return {
    lat: o.configured ? o.lat : null,
    lng: o.configured ? o.lng : null,
    radius: o.radius,
    lateAfter: getLateAfter(),
    enforceStaff: o.enforceSme,
    enforceAdmin: o.enforceAdmin,
    configured: o.configured,
    // true when the value comes from the app, false when it is still read from .env
    savedInApp: {
      location: Number.isFinite(saved.officeLat) && Number.isFinite(saved.officeLng),
      radius: Number.isFinite(saved.officeRadius),
      lateAfter: !!saved.lateAfter,
    },
    updatedAt: saved.updatedAt || null,
    updatedBy: saved.updatedBy || '',
  };
};
// GET /api/superadmin/attendance-settings
router.get('/attendance-settings', (req, res) => res.json({ settings: settingsView() }));
// PUT /api/superadmin/attendance-settings   body: { lat, lng, radius, lateAfter, enforceStaff, enforceAdmin }
router.put('/attendance-settings', async (req, res) => {
  try {
    const b = req.body || {};
    const lat = Number(b.lat);
    const lng = Number(b.lng);
    const radius = Number(b.radius);
    if (b.lat === '' || b.lng === '' || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      return res.status(400).json({ message: 'Enter a valid latitude (-90 to 90) and longitude (-180 to 180).' });
    }
    if (!Number.isFinite(radius) || radius < 10 || radius > 50000) {
      return res.status(400).json({ message: 'Radius must be between 10 and 50000 metres.' });
    }
    if (!/^([01]?\d|2[0-3]):[0-5]\d$/.test(String(b.lateAfter || '').trim())) {
      return res.status(400).json({ message: 'Late time must look like 10:30 (24-hour HH:MM).' });
    }
    const by = req.user.name || req.user.email || String(req.user.id || '');
    await saveAttendanceSettings({
      officeLat: lat,
      officeLng: lng,
      officeRadius: radius,
      lateAfter: String(b.lateAfter).trim().replace(/^(\d):/, '0$1:'),
      enforceStaff: !!b.enforceStaff,
      enforceAdmin: !!b.enforceAdmin,
    }, by);
    res.json({ message: 'Attendance settings saved', settings: settingsView() });
  } catch (error) {
    console.error('Attendance settings error:', error);
    res.status(500).json({ message: 'Unable to save attendance settings' });
  }
});
// PUT /api/superadmin/users/:id/super-admin   body: { value: true|false }  -> a super admin makes another admin a super admin (or removes it)
router.put('/users/:id/super-admin', async (req, res) => {
  try {
    if (!validId(req.params.id)) return res.status(404).json({ message: 'User not found' });
    const value = req.body.value === true || req.body.value === 'true';
    const admin = await Admin.findById(req.params.id);
    if (!admin) return res.status(404).json({ message: 'Admin not found' });
    if (!value && admin.isSuperAdmin && (await Admin.countDocuments({ isSuperAdmin: true })) <= 1) {
      return res.status(403).json({ message: 'There must always be at least one super admin.' });
    }
    await Admin.collection.updateOne({ _id: admin._id }, { $set: { isSuperAdmin: value } });
    const fresh = await Admin.findById(admin._id).lean();
    res.json({ message: value ? 'Made super admin' : 'Super admin removed', user: userView(fresh, 'admins') });
  } catch (error) {
    console.error('Admin super-admin toggle error:', error);
    res.status(500).json({ message: 'Unable to update this admin' });
  }
});
// GET /api/superadmin/pending-creatives  -> every creative (all companies, all SMEs) still waiting for review, oldest first
router.get('/pending-creatives', async (req, res) => {
  try {
    const list = await Creative.find({ status: 'pending' })
      .sort({ createdAt: 1 })
      .limit(500)
      .populate('company', 'name')
      .populate('user', 'name fullname email')
      .populate('assignedDesigner', 'name email');
    res.json({ creatives: list.map(creativeItemView) });
  } catch (error) {
    console.error('Pending creatives error:', error);
    res.status(500).json({ message: 'Unable to load pending creatives' });
  }
});
// GET /api/superadmin/banned  -> every banned account in every department, newest ban first
router.get('/banned', async (req, res) => {
  try {
    const rows = (await Promise.all(Object.entries(roleModels).map(async ([role, Model]) => (
      (await Model.find({ isBanned: true }).lean()).map((u) => ({ u, collection: getRoleCollection(role) }))
    )))).flat();
    // bannedBy is stored as an admin id; show the admin's name instead
    const adminIds = [...new Set(rows.map(({ u }) => u.bannedBy).filter((id) => id && validId(id)))];
    const admins = await Admin.find({ _id: { $in: adminIds } }).select('name fullname email').lean();
    const adminName = Object.fromEntries(admins.map((a) => [String(a._id), a.name || a.fullname || a.email]));
    const accounts = rows
      .map(({ u, collection }) => ({ ...userView(u, collection), bannedByName: adminName[u.bannedBy] || '' }))
      .sort((a, b) => new Date(b.bannedAt || 0) - new Date(a.bannedAt || 0));
    res.json({ accounts });
  } catch (error) {
    console.error('Banned accounts error:', error);
    res.status(500).json({ message: 'Unable to load banned accounts' });
  }
});
const MANAGED_ROLES = ['sme', 'smi', 'des', 'hr'];
// GET /api/superadmin/departments  -> every department (role) with its people
router.get('/departments', async (req, res) => {
  try {
    const departments = await Promise.all(Object.entries(roleModels).filter(([role]) => role !== 'admin').map(async ([role, Model]) => {
      const users = await Model.find().sort({ name: 1 }).lean();
      return {
        role,
        collection: getRoleCollection(role),
        hasManager: MANAGED_ROLES.includes(role),
        total: users.length,
        banned: users.filter((u) => u.isBanned).length,
        members: users.map((u) => ({ ...userView(u, getRoleCollection(role)), companyCount: (u.companies || []).length })),
      };
    }));
    const managers = await ReportingManager.find().select('name fullname email').sort({ name: 1 }).lean();
    res.json({
      departments,
      reportingManagers: managers.map((m) => ({ id: String(m._id), name: m.name || m.fullname || m.email })),
    });
  } catch (error) {
    console.error('Departments error:', error);
    res.status(500).json({ message: 'Unable to load departments' });
  }
});
// PUT /api/superadmin/departments/:role/:id/manager   body: { managerId: '<id>' | '' }  -> move a person under another reporting manager
router.put('/departments/:role/:id/manager', async (req, res) => {
  try {
    const { role, id } = req.params;
    if (!MANAGED_ROLES.includes(role)) return res.status(400).json({ message: 'This department has no reporting manager.' });
    if (!validId(id)) return res.status(404).json({ message: 'User not found' });
    const managerId = String(req.body.managerId || '');
    if (managerId && (!validId(managerId) || !(await ReportingManager.exists({ _id: managerId })))) {
      return res.status(400).json({ message: 'Selected reporting manager does not exist' });
    }
    const user = await roleModels[role].findByIdAndUpdate(id, { $set: { reportingManagerId: managerId || null } }, { new: true }).lean();
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ message: 'Reporting manager updated', user: userView(user, getRoleCollection(role)) });
  } catch (error) {
    console.error('Department manager update error:', error);
    res.status(500).json({ message: 'Unable to update this person' });
  }
});
export default router;
