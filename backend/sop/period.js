// A tick belongs to a period: daily -> the day, weekly -> the ISO week, monthly -> the month.
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const isoWeekKey = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t - yearStart) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
};

export const periodKey = (type, dateStr) => {
  if (type === 'weekly') return isoWeekKey(dateStr);
  if (type === 'monthly') return dateStr.slice(0, 7);
  return dateStr;
};

export const isRealDate = (s) => {
  if (typeof s !== 'string' || !DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

// The browser sends its local "today" (timezones differ from the server's).
// Accept it only when it is within 2 days of the server's date.
export const resolveToday = (input) => {
  const server = new Date().toISOString().slice(0, 10);
  if (!isRealDate(input)) return server;
  const diff = Math.abs(new Date(`${input}T00:00:00Z`) - new Date(`${server}T00:00:00Z`)) / 86400000;
  return diff > 2 ? server : input;
};
