import AttendanceSettings from './AttendanceSettings.js';

// The settings are cached in memory so the login check (geo.js) and the HR pages can read them synchronously.
// DB value wins; if a field was never set in the app, the old .env value is used.
let cache = null;

export const loadAttendanceSettings = async () => {
  try {
    cache = (await AttendanceSettings.findOne({ key: 'attendance' }).lean()) || null;
  } catch (error) {
    console.error('Could not load attendance settings:', error.message);
  }
  return cache;
};

export const getStoredSettings = () => cache;

export const saveAttendanceSettings = async (values, updatedBy = '') => {
  const doc = await AttendanceSettings.findOneAndUpdate(
    { key: 'attendance' },
    { $set: { ...values, updatedBy } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();
  cache = doc;
  return doc;
};

const validTime = (v) => /^([01]?\d|2[0-3]):[0-5]\d$/.test(String(v || '').trim());
const pad = (v) => String(v).trim().replace(/^(\d):/, '0$1:');

// "HH:MM" after which the first login of the day counts as late.
export const getLateAfter = () => {
  if (validTime(cache?.lateAfter)) return pad(cache.lateAfter);
  const env = String(process.env.HR_LATE_AFTER || '').trim();
  return validTime(env) ? pad(env) : '10:30';
};
