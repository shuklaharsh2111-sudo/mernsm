// Position-aware PDF reader used by the resume parser.
//
// Why not just call `pdf-parse`?  Its default renderer glues text that sits on the same line
// ("Mobile:9820098200Email:x@y.com"), loses which text is big (the candidate's name is almost
// always the largest text on page 1), and its wrapper does not wait for `doc.destroy()`, which makes
// back-to-back uploads fail randomly or even return the PREVIOUS file's text.
//
// This module drives the pdf.js build that ships inside `pdf-parse` directly (no new npm package),
// runs one file at a time, and returns:
//   text      - the resume as clean lines (columns separated by " | ")
//   altText   - the same words in the PDF's own drawing order (a second opinion for the parser)
//   headlines - the biggest-font lines on page 1 (best clue for the candidate's name / job title)
//   links     - mailto: / tel: / other link targets found in the PDF (icons are often hyperlinks)
import { createRequire } from 'module';
import path from 'path';

const require = createRequire(import.meta.url);
let PDFJS = null;

const loadPdfjs = () => {
  if (PDFJS) return PDFJS;
  const pkg = require.resolve('pdf-parse/package.json');
  PDFJS = require(path.join(path.dirname(pkg), 'lib', 'pdf.js', 'v1.10.100', 'build', 'pdf.js'));
  PDFJS.disableWorker = true;
  return PDFJS;
};

// pdf.js (fake worker) keeps global state, so only one document is read at a time.
let chain = Promise.resolve();
const serial = (fn) => {
  const run = chain.then(() => fn());
  chain = run.catch(() => {});
  return run;
};

const withTimeout = (promise, ms, message) =>
  Promise.race([promise, new Promise((_, rej) => setTimeout(() => rej(new Error(message)), ms))]);

// Group text pieces into visual lines using their coordinates.
const buildRows = (items) => {
  const rows = [];
  items.forEach((it) => {
    const str = String(it.str || '');
    if (!str.trim()) return;
    const t = it.transform || [];
    const size = Math.abs(t[3]) || Math.abs(it.height) || 10;
    const piece = { str, x: t[4] || 0, w: it.width || 0, size };
    const y = t[5] || 0;
    const row = rows.find((r) => Math.abs(r.y - y) <= Math.min(r.size, size) * 0.5);
    if (row) {
      row.items.push(piece);
      row.size = Math.max(row.size, size);
    } else rows.push({ y, size, items: [piece] });
  });
  rows.sort((a, b) => b.y - a.y);
  rows.forEach((r) => {
    r.items.sort((a, b) => a.x - b.x);
    let line = '';
    let end = null;
    r.items.forEach((p) => {
      if (end !== null) {
        const gap = p.x - end;
        if (gap > p.size * 3) line += ' | '; // a different column / block on the same line
        else if (gap > p.size * 0.12 && !/\s$/.test(line) && !/^\s/.test(p.str)) line += ' ';
      }
      line += p.str;
      end = p.x + p.w;
    });
    r.text = line.replace(/[ \t]+/g, ' ').trim();
  });
  return rows.filter((r) => r.text);
};

const median = (arr) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

const readPdf = async (buffer) => {
  const lib = loadPdfjs();
  const doc = await lib.getDocument(new Uint8Array(buffer));
  const lines = [];
  const alt = [];
  const links = [];
  const sized = [];
  try {
    const pages = Math.min(doc.numPages, 6); // resumes are short; ignore anything beyond
    for (let n = 1; n <= pages; n += 1) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent({ normalizeWhitespace: true, disableCombineTextItems: false });
      const rows = buildRows(content.items);
      rows.forEach((r) => lines.push(r.text));
      content.items.forEach((it) => { if (String(it.str || '').trim()) alt.push(String(it.str).trim()); });
      if (n === 1) rows.forEach((r) => sized.push({ text: r.text, size: r.size }));
      try {
        const notes = await page.getAnnotations();
        notes.forEach((a) => { if (a && a.url) links.push(String(a.url)); });
      } catch { /* annotations are optional */ }
      lines.push('');
    }
  } finally {
    await doc.destroy();
  }

  // Page-1 lines drawn clearly bigger than the body text, biggest first (the name / job title)
  const body = median(sized.map((s) => s.size));
  // "RIYA" and "MEHTA" drawn as two big lines in a row (first / last name on separate lines) -> "RIYA MEHTA"
  const WORDISH = /^[\p{L}][\p{L}]*(?: [\p{L}][\p{L}]*)?$/u;
  const caseStyle = (t) => (t === t.toUpperCase() ? 'U' : t === t.toLowerCase() ? 'L' : /^\p{Lu}/u.test(t) ? 'C' : 'X');
  const merged = [];
  for (let i = 0; i + 1 < sized.length; i += 1) {
    const a = sized[i];
    const b = sized[i + 1];
    const wa = a.text.split(' ').length;
    const wb = b.text.split(' ').length;
    if (Math.abs(a.size - b.size) <= 0.08 * Math.max(a.size, b.size) && WORDISH.test(a.text) && WORDISH.test(b.text)
      && (wa === 1 || wb === 1) && caseStyle(a.text) === caseStyle(b.text) && caseStyle(a.text) !== 'X') {
      merged.push({ text: `${a.text} ${b.text}`, size: Math.max(a.size, b.size) + 0.01 });
    }
  }
  const headlines = [...sized, ...merged]
    .filter((s) => s.size >= body * 1.2 && s.text.length <= 70)
    .sort((a, b) => b.size - a.size)
    .slice(0, 8)
    .map((s) => s.text);

  return { text: lines.join('\n'), altText: alt.join('\n'), headlines, links };
};

export const pdfToResume = (buffer) =>
  serial(() => withTimeout(readPdf(buffer), 25000, 'Reading the PDF took too long.'));
