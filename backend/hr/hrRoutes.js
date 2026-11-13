import express from 'express';
import mongoose from 'mongoose';
import { protect } from '../auth.js';
import { roleModels } from '../admin/UserModels.js';
import Attendance from '../attendance/Attendance.js';
import { getOfficeConfig } from '../attendance/geo.js';
import recruitmentRoutes from './recruitmentRoutes.js';

const router = express.Router();
router.use(protect(['hr']));
router.use('/recruitment', recruitmentRoutes);

// Roles HR manages. Admins and clients are not employees, so they never show up here.
const EMPLOYEE_ROLES = ['reporting_manager', 'sme', 'smi', 'des', 'hr'];
const validId = (id) => mongoose.Types.ObjectId.isValid(id);

// "Late" = first login of the day after this time (server local time). Set HR_LATE_AFTER=HH:MM in .env.
const lateAfterMinutes = () => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(process.env.HR_LATE_AFTER || '10:30').trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : 10 * 60 + 30;
};
const minutesOfDay = (d) => d.getHours() * 60 + d.getMinutes();

// Some old SME documents store dates as { $date: ... }, so parse defensively.
const toDate = (v) => {
  const raw = v && typeof v === 'object' && !(v instanceof Date) ? v.$date : v;
  const d = raw ? new Date(raw) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
};
const startOfDay = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const loadEmployees = async () => {
  const lists = await Promise.all(
    EMPLOYEE_ROLES.map(async (role) => {
      const docs = await roleModels[role].find().lean();
      return docs.map((u) => ({
        id: String(u._id),
        name: u.name || u.fullname || u.email,
        email: u.email,
        contact: u.contact || '',
        role,
        profileImage: u.profileImage || u.avatar || '',
        reportingManagerId: u.reportingManagerId ? String(u.reportingManagerId) : '',
        joinedAt: toDate(u.createdAt)
      }));
    })
  );
  return lists.flat();
};

// Group sessions into { userId -> { dayKey -> sessions[] } }
const groupByUserDay = (records) => {
  const map = new Map();
  records.forEach((r) => {
    const uid = String(r.userId);
    if (!map.has(uid)) map.set(uid, new Map());
    const days = map.get(uid);
    const k = dayKey(new Date(r.loginAt));
    if (!days.has(k)) days.set(k, []);
    days.get(k).push(r);
  });
  return map;
};

// Hours worked in one day = sum of finished sessions (open sessions are not counted).
const hoursOf = (sessions) =>
  sessions.reduce((sum, s) => (s.logoutAt ? sum + (new Date(s.logoutAt) - new Date(s.loginAt)) / 36e5 : sum), 0);

// ---------------- Dashboard ----------------
router.get('/dashboard', async (req, res) => {
  const employees = await loadEmployees();
  const byId = new Map(employees.map((e) => [e.id, e]));
  const today = startOfDay();
  const weekStart = addDays(today, -6);
  const monthAgo = addDays(today, -30);

  const records = await Attendance.find({ role: { $in: EMPLOYEE_ROLES }, loginAt: { $gte: weekStart } })
    .sort({ loginAt: 1 })
    .lean();
  const grouped = groupByUserDay(records);
  const todayKey = dayKey(today);

  // Who is in today, who is online right now, who was late
  const lateLimit = lateAfterMinutes();
  const presentToday = [];
  let online = 0;
  let late = 0;
  grouped.forEach((days, uid) => {
    const sessions = days.get(todayKey);
    if (!sessions || !byId.has(uid)) return;
    const first = sessions[0];
    const last = sessions[sessions.length - 1];
    const isOnline = !last.logoutAt;
    const isLate = minutesOfDay(new Date(first.loginAt)) > lateLimit;
    if (isOnline) online += 1;
    if (isLate) late += 1;
    presentToday.push({
      id: uid,
      name: byId.get(uid).name,
      role: byId.get(uid).role,
      profileImage: byId.get(uid).profileImage,
      firstLogin: first.loginAt,
      lastLogout: last.logoutAt || null,
      online: isOnline,
      late: isLate
    });
  });
  presentToday.sort((a, b) => new Date(b.firstLogin) - new Date(a.firstLogin));
  const presentIds = new Set(presentToday.map((p) => p.id));
  const absentToday = employees
    .filter((e) => !presentIds.has(e.id))
    .map(({ id, name, role, profileImage }) => ({ id, name, role, profileImage }));

  // 7-day trend
  const trend = [];
  for (let i = 0; i < 7; i += 1) {
    const d = addDays(weekStart, i);
    const k = dayKey(d);
    let present = 0;
    let hours = 0;
    let withHours = 0;
    grouped.forEach((days, uid) => {
      if (!byId.has(uid) || !days.has(k)) return;
      present += 1;
      const h = hoursOf(days.get(k));
      if (h > 0) { hours += h; withHours += 1; }
    });
    trend.push({
      date: k,
      present,
      avgHours: withHours ? Math.round((hours / withHours) * 10) / 10 : 0
    });
  }

  // Headcount by role + recent joiners
  const roleCounts = {};
  employees.forEach((e) => { roleCounts[e.role] = (roleCounts[e.role] || 0) + 1; });
  const newJoiners = employees
    .filter((e) => e.joinedAt && e.joinedAt >= monthAgo)
    .sort((a, b) => b.joinedAt - a.joinedAt)
    .slice(0, 6)
    .map((e) => ({ id: e.id, name: e.name, role: e.role, profileImage: e.profileImage, joinedAt: e.joinedAt }));

  const total = employees.length;
  res.json({
    lateAfter: String(process.env.HR_LATE_AFTER || '10:30'),
    summary: {
      totalEmployees: total,
      presentToday: presentToday.length,
      absentToday: absentToday.length,
      onlineNow: online,
      lateToday: late,
      newThisMonth: employees.filter((e) => e.joinedAt && e.joinedAt >= monthAgo).length,
      attendanceRate: total ? Math.round((presentToday.length / total) * 100) : 0
    },
    roleCounts,
    trend,
    presentToday,
    absentToday,
    newJoiners
  });
});

// ---------------- Employees ----------------
router.get('/employees', async (req, res) => {
  const employees = await loadEmployees();
  const managers = new Map(
    (await roleModels.reporting_manager.find().select('name fullname email').lean())
      .map((m) => [String(m._id), m.name || m.fullname || m.email])
  );

  const today = startOfDay();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const records = await Attendance.find({ role: { $in: EMPLOYEE_ROLES }, loginAt: { $gte: monthStart } }).lean();
  const grouped = groupByUserDay(records);
  const todayKey = dayKey(today);

  // working days (Mon-Sat) so far this month, for "days present / working days"
  let workingDays = 0;
  for (let d = new Date(monthStart); d <= today; d = addDays(d, 1)) if (d.getDay() !== 0) workingDays += 1;

  res.json({
    workingDays,
    employees: employees
      .map((e) => {
        const days = grouped.get(e.id);
        const todaySessions = days?.get(todayKey);
        return {
          id: e.id,
          name: e.name,
          email: e.email,
          contact: e.contact,
          role: e.role,
          profileImage: e.profileImage,
          reportingManager: managers.get(e.reportingManagerId) || '',
          joinedAt: e.joinedAt,
          daysPresent: days ? days.size : 0,
          todayStatus: !todaySessions ? 'absent' : todaySessions[todaySessions.length - 1].logoutAt ? 'left' : 'online'
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  });
});

// ---------------- Attendance ----------------
// GET /api/hr/attendance?from=YYYY-MM-DD&to=YYYY-MM-DD&userId=<id>&role=sme
router.get('/attendance', async (req, res) => {
  const filter = { role: { $in: EMPLOYEE_ROLES } };
  if (req.query.userId) {
    if (!validId(req.query.userId)) return res.status(400).json({ message: 'Invalid user' });
    filter.userId = req.query.userId;
  }
  if (EMPLOYEE_ROLES.includes(req.query.role)) filter.role = req.query.role;
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
  const office = getOfficeConfig();
  res.json({
    office: { configured: office.configured, radius: office.radius },
    lateAfter: String(process.env.HR_LATE_AFTER || '10:30'),
    records: records.map((r) => ({
      id: r._id,
      userId: r.userId,
      name: r.name,
      email: r.email,
      role: r.role,
      loginAt: r.loginAt,
      logoutAt: r.logoutAt,
      distance: r.loginLocation?.distance ?? null
    }))
  });
});

export default router;
