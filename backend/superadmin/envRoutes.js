import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { protect } from '../auth.js';

// SUPER ADMIN ONLY: view / reveal / edit the credentials stored in backend/.env.
// Mounted at /api/superadmin/env (NOT under /api/admin), and every route re-checks isSuperAdmin,
// so a normal admin (or any other role) gets 403 and never sees a value.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_PATH = path.resolve(__dirname, '../.env');
const router = express.Router();

const KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
const SECRET_RE = /SECRET|PASSWORD|PSWD|TOKEN|API_KEY|_KEY$|MONGO_URI|CODE/i;
const GROUPS = [
  ['Server', /^(PORT|CLIENT_URL|PUBLIC_URL|PUBLIC_API_URL|JWT_EXPIRES_IN)$/],
  ['Database', /^(MONGO|MONGODB)/i],
  ['Security', /^(JWT_|ADMIN_SECRET|GRAIN_ENCRYPTION)/],
  ['Super admin', /^SUPER_ADMIN_/],
  ['Cloudinary', /^CLOUDINARY_/],
  ['OpenAI', /^OPENAI_/],
  ['Google / YouTube', /^(GOOGLE_|YOUTUBE_|MEETING_)/],
  ['Grain', /^GRAIN_/],
  ['Attendance / Office', /^(OFFICE_|ATTENDANCE_|HR_)/],
];
const groupOf = (key) => (GROUPS.find(([, re]) => re.test(key)) || ['Other'])[0];

const readLines = () => (fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf8').split(/\r?\n/) : []);
const parseLine = (line) => {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/);
  if (!m) return null;
  let value = m[2].trim();
  if (/^(".*"|'.*')$/.test(value)) value = value.slice(1, -1);
  return { key: m[1], value };
};
const writeLines = (lines) => {
  fs.writeFileSync(`${ENV_PATH}.bak`, fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH) : '');
  fs.writeFileSync(ENV_PATH, lines.join('\r\n'));
};
const mask = (v) => (!v ? '' : v.length <= 4 ? '••••' : `${'•'.repeat(Math.min(v.length - 2, 12))}${v.slice(-2)}`);
const fmtValue = (v) => (/[\s#"']/.test(v) ? `"${v.replace(/"/g, '\\"')}"` : v);

const superOnly = [protect(['admin']), (req, res, next) => (
  req.user?.isSuperAdmin ? next() : res.status(403).json({ message: 'Only a super admin can access environment credentials.' })
)];
router.use(...superOnly);

router.get('/', (req, res) => {
  const items = readLines().map(parseLine).filter(Boolean).map(({ key, value }) => {
    const secret = SECRET_RE.test(key);
    return { key, group: groupOf(key), secret, hasValue: value !== '', value: secret ? mask(value) : value };
  });
  res.json({ file: '.env', items });
});

router.get('/:key/reveal', (req, res) => {
  const found = readLines().map(parseLine).find((e) => e && e.key === req.params.key);
  if (!found) return res.status(404).json({ message: 'Key not found' });
  res.json({ key: found.key, value: found.value });
});

const save = (key, value, { create }) => {
  const lines = readLines();
  const idx = lines.findIndex((l) => parseLine(l)?.key === key);
  if (create && idx !== -1) return { status: 409, message: `${key} already exists.` };
  if (!create && idx === -1) return { status: 404, message: 'Key not found' };
  const line = `${key}=${fmtValue(value)}`;
  if (idx === -1) { while (lines.length && lines[lines.length - 1] === '') lines.pop(); lines.push(line, ''); } else lines[idx] = line;
  writeLines(lines);
  process.env[key] = value; // applies to code that reads env lazily; boot-time values need a restart
  return { status: 200 };
};

router.put('/:key', (req, res) => {
  const { key } = req.params;
  const value = String(req.body?.value ?? '');
  if (/[\r\n]/.test(value)) return res.status(400).json({ message: 'Value cannot contain line breaks.' });
  const r = save(key, value, { create: false });
  if (r.status !== 200) return res.status(r.status).json({ message: r.message });
  res.json({ message: `${key} updated. Restart the server for values read only at startup (PORT, MONGO_URI, JWT_SECRET...).` });
});

router.post('/', (req, res) => {
  const key = String(req.body?.key || '').trim();
  const value = String(req.body?.value ?? '');
  if (!KEY_RE.test(key)) return res.status(400).json({ message: 'Key may only contain letters, numbers and underscores.' });
  if (/[\r\n]/.test(value)) return res.status(400).json({ message: 'Value cannot contain line breaks.' });
  const r = save(key, value, { create: true });
  if (r.status !== 200) return res.status(r.status).json({ message: r.message });
  res.status(201).json({ message: `${key} added.` });
});

router.delete('/:key', (req, res) => {
  const { key } = req.params;
  if (/^(MONGO_URI|JWT_SECRET|SUPER_ADMIN_EMAIL|SUPER_ADMIN_PASSWORD)$/.test(key)) {
    return res.status(400).json({ message: `${key} is required and cannot be removed here.` });
  }
  const lines = readLines();
  const idx = lines.findIndex((l) => parseLine(l)?.key === key);
  if (idx === -1) return res.status(404).json({ message: 'Key not found' });
  lines.splice(idx, 1);
  writeLines(lines);
  delete process.env[key];
  res.json({ message: `${key} removed.` });
});

export default router;
