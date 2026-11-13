// Bridge to the Python resume parser (hr/python/resume_parser.py).
// Node writes the upload to a temp file, runs the script, and reads one JSON line back.
// If Python (or its packages) is missing, callers fall back to the built-in JS reader.
import { spawn } from 'child_process';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const SCRIPT = fileURLToPath(new URL('./python/resume_parser.py', import.meta.url));
const RUN_TIMEOUT_MS = 90000; // scanned PDFs / photos go through OCR and take longer

const run = (cmd, args, timeoutMs) => new Promise((resolve) => {
  let out = '';
  let err = '';
  let done = false;
  const finish = (r) => { if (!done) { done = true; clearTimeout(timer); resolve(r); } };
  let child;
  try {
    child = spawn(cmd, args, { env: { ...process.env, PYTHONIOENCODING: 'utf-8' }, windowsHide: true });
  } catch (e) { return resolve({ code: -1, out, err: e.message }); }
  const timer = setTimeout(() => { child.kill('SIGKILL'); finish({ code: -2, out, err: 'timed out' }); }, timeoutMs);
  child.stdout.on('data', (d) => { out += d.toString('utf8'); });
  child.stderr.on('data', (d) => { err += d.toString('utf8'); });
  child.on('error', (e) => finish({ code: -1, out, err: e.message }));
  child.on('close', (code) => finish({ code, out, err }));
});

let pythonBin = null;
const detectPython = async () => {
  if (pythonBin) return pythonBin;
  const candidates = [process.env.PYTHON_BIN, 'python3', 'python', 'py'].filter(Boolean);
  for (const c of candidates) {
    const r = await run(c, ['--version'], 8000);
    if (r.code === 0) { pythonBin = c; return c; }
  }
  return null;
};

// Returns { ok: true, fields, missing, engine: 'python' } or { ok: false, code, error }
export const parseWithPython = async (file) => {
  const py = await detectPython();
  if (!py) return { ok: false, code: 'no_python', error: 'Python was not found on the server.' };

  const ext = String(file.originalname || '').toLowerCase().split('.').pop().replace(/[^a-z0-9]/g, '') || 'bin';
  const tmp = path.join(os.tmpdir(), `resume-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`);
  try {
    await fs.writeFile(tmp, file.buffer);
    const r = await run(py, [SCRIPT, tmp, '--filename', file.originalname || `resume.${ext}`], RUN_TIMEOUT_MS);
    const lastLine = r.out.trim().split('\n').filter(Boolean).pop() || '';
    try {
      return JSON.parse(lastLine);
    } catch {
      console.error('Python resume parser gave no result:', (r.err || r.out || `exit ${r.code}`).slice(0, 500));
      return { ok: false, code: 'crashed', error: 'The resume reader did not respond.' };
    }
  } finally {
    fs.unlink(tmp).catch(() => {});
  }
};
