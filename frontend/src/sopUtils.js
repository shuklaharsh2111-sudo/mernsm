// Shared helpers for the SOP features.

export const SOP_TYPES = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

export const typeLabel = (v) => SOP_TYPES.find((t) => t.value === v)?.label || v;

// Wording for the tick: Daily -> today, Weekly -> this week, Monthly -> this month.
export const PERIOD_WORD = { daily: 'today', weekly: 'this week', monthly: 'this month' };

export const errMsg = (err) => err?.response?.data?.message || err?.message || 'Something went wrong';

// 'YYYY-MM-DD' -> '31 Oct 2026' without timezone shifting.
export const fmtDay = (s) => {
  if (!s) return '';
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

// ISO timestamp -> '31 Oct 2026, 2:15 pm'
export const fmtDateTime = (iso) =>
  iso
    ? new Date(iso).toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
    : '';

// The browser's own calendar day as YYYY-MM-DD.
export const todayStr = () => {
  const n = new Date();
  const p = (x) => String(x).padStart(2, '0');
  return `${n.getFullYear()}-${p(n.getMonth() + 1)}-${p(n.getDate())}`;
};

// Human label for a saved period key: daily 'YYYY-MM-DD', weekly 'YYYY-Www', monthly 'YYYY-MM'.
export const periodLabel = (type, key) => {
  if (!key) return '';
  if (type === 'weekly') {
    const [y, w] = key.split('-W');
    return `Week ${Number(w)}, ${y}`;
  }
  if (type === 'monthly') {
    const [y, m] = key.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  }
  return fmtDay(key);
};

// 'HH:mm' -> '2:30 pm'
export const fmtClock = (t) => {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
};
