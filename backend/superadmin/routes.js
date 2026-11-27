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
