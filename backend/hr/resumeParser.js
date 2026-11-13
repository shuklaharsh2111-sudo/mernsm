import os from 'os';
import { docxText, pdfText } from './simpleExtract.js';
import { pdfToResume } from './pdfReader.js';

// Pulls candidate details (name, mobile, email, position) out of a resume (PDF, DOCX, DOC, TXT,
// RTF or an image). It is heuristic, so the HR user always gets to review and fix the fields
// before saving.

// ---------------------------------------------------------------- helpers
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;
const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();

const ACRONYMS = new Set([
  'ui', 'ux', 'seo', 'sem', 'smm', 'hr', 'qa', 'it', 'ai', 'ml', 'bdm', 'bde', 'ceo', 'cto', 'php', 'sql',
  'ios', 'api', 'erp', 'crm', 'mern', 'mean', 'ppc', 'cad', 'vfx', 'sap', 'aws', 'devops', 'ca', 'mba', 'bpo', 'kpo'
]);
const LOWER_WORDS = new Set(['and', 'of', 'the', 'for', 'to', 'in', 'at', 'a', 'an', '&']);

const titleCase = (s) =>
  clean(s)
    .toLowerCase()
    .split(' ')
    .map((w, i) => {
      const bare = w.replace(/[^a-z0-9]/g, '');
      if (ACRONYMS.has(bare)) return w.toUpperCase();
      if (w.includes('/')) return w.split('/').map((p) => (ACRONYMS.has(p) ? p.toUpperCase() : p.replace(/^([a-z])/, (m) => m.toUpperCase()))).join('/');
      if (i > 0 && LOWER_WORDS.has(w)) return w;
      return w.replace(/(^|[-'’.])([a-z])/g, (m, a, b) => a + b.toUpperCase());
    })
    .join(' ');

// Only "fix" the case when the text is ALL CAPS or all lower case; keep proper casing as written.
const fixCase = (s) => {
  const t = clean(s);
  return t === t.toUpperCase() || t === t.toLowerCase() ? titleCase(t) : t;
};

// Prepare raw text: normalise odd unicode, drop icon-font glyphs, mailto:/tel: prefixes, zero-width chars
const normalize = (text) =>
  String(text || '')
    .normalize('NFKC')
    .replace(/[\u200b-\u200f\u2060\ufeff\u00ad]/g, '')
    .replace(/[\uE000-\uF8FF]/g, ' ') // Font Awesome / Material icon glyphs
    .replace(/[\u2022\u25CF\u25AA\u25A0\u2756\u27A4\u2192\u25BA]/g, ' | ')
    .replace(/\b(?:mailto|tel|callto|sms):/gi, ' ')
    .replace(/\r/g, '');

// "P R I Y A   S H A R M A" (spaced-out headings) -> "PRIYA SHARMA"
const unspace = (text) =>
  String(text || '').replace(
    /\b(?:[A-Za-z] ){3,}[A-Za-z](?:\s{2,}(?:[A-Za-z] ){2,}[A-Za-z])*\b/g,
    (m) => m.replace(/ {2,}/g, '\u0001').replace(/ /g, '').replace(/\u0001/g, ' ')
  );

// Rows: split on new lines and block separators (| tabs, wide gaps)
const rowsOf = (text) =>
  unspace(normalize(text))
    .split(/\n|[|\t]| {4,}/)
    .map(clean)
    .filter(Boolean);

// Pieces: rows split further on " - " style separators ("Priya Sharma - Graphic Designer")
const PHONE_CHUNK = /\+?\(?\d[\d\s().\-–/]{7,}\d/g;
const piecesOf = (text) =>
  rowsOf(text)
    .flatMap((r) => r.replace(EMAIL_RE, ' | ').replace(PHONE_CHUNK, ' | ').split('|'))
    .flatMap((r) => r.split(/\s[-–—]\s/))
    .map(clean)
    .filter(Boolean);

// ---------------------------------------------------------------- email
const KNOWN_TLDS = ['com', 'in', 'org', 'net', 'co', 'edu', 'io', 'info', 'biz', 'me', 'gov', 'dev', 'app', 'ai', 'us', 'uk', 'ac'];
const PLACEHOLDER_EMAIL = /@(?:example|domain|email|yourmail|yourdomain|test)\.(?:com|org|net)$/i;

// "name@gmail.comPhone" -> "name@gmail.com"
const trimGluedTld = (email) => {
  const m = email.match(/^(.*\.)([A-Za-z]{2,})$/);
  if (!m) return email;
  const tld = m[2];
  if (tld.length <= 3 || tld === tld.toLowerCase()) return email;
  const hit = KNOWN_TLDS.filter((k) => tld.toLowerCase().startsWith(k) && /[A-Z]/.test(tld[k.length] || ''))
    .sort((a, b) => b.length - a.length)[0];
  return hit ? m[1] + tld.slice(0, hit.length) : email;
};

export const findEmail = (text) => {
  // "9876543210priya@x.com" -> keep the phone digits out of the address
  const t = normalize(text).replace(/(\d{8,})([A-Za-z][\w.+-]*@)/g, '$1 $2');
  const all = (t.match(EMAIL_RE) || []).map((e) => trimGluedTld(e).toLowerCase().replace(/[.,;:]+$/, ''));
  const real = all.filter((e) => !PLACEHOLDER_EMAIL.test(e));
  return (real[0] || all[0] || '');
};

// ---------------------------------------------------------------- mobile
const PHONE_LABEL = /\b(?:phone|mobile|mob|cell|contact|call|tel|telephone|whatsapp|ph|m)\b/i;

// Validate a list of digit groups; returns the mobile number or ''
const asMobile = (digits, plus) => {
  if (/^[6-9]\d{9}$/.test(digits)) return digits;
  if (/^91[6-9]\d{9}$/.test(digits)) return digits.slice(2);
  if (/^0[6-9]\d{9}$/.test(digits)) return digits.slice(1);
  if (/^0091[6-9]\d{9}$/.test(digits)) return digits.slice(4);
  if (plus && /^\d{9,15}$/.test(digits)) return `+${digits}`; // other countries
  return '';
};

// Find a mobile number inside one row of text
const mobileInRow = (row) => {
  // dates, URLs and e-mails contain digits that must not be mistaken for a phone number
  const r = row
    .replace(/(\d{8,})([A-Za-z][\w.+-]*@)/g, '$1 $2')
    .replace(EMAIL_RE, ' ')
    .replace(/(?:https?:\/\/|www\.)\S+/gi, ' ')
    .replace(/\b[\w-]+\.(?:com|in|org|net|io)\/\S*/gi, ' ')
    .replace(/\b\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b/g, ' ');
  const runs = r.match(/\+?\d[\d\s().\-–/]*\d/g) || [];
  for (const run of runs) {
    const tokens = run.split(/[\s().\-–/]+/).filter(Boolean);
    for (let i = 0; i < tokens.length; i += 1) {
      let digits = '';
      for (let j = i; j < tokens.length && digits.length <= 14; j += 1) {
        digits += tokens[j].replace(/\D/g, '');
        const plus = tokens[i].startsWith('+');
        // a lone 6-9 start and the right length is enough; never start inside a longer group
        const found = asMobile(digits, plus);
        if (found) return found;
      }
    }
  }
  return '';
};

export const findMobile = (text, hints = {}) => {
  const rows = rowsOf(text);
  // 1) rows that carry a phone label, or follow a row that is only a label ("Phone")
  for (let i = 0; i < rows.length; i += 1) {
    const labelled = PHONE_LABEL.test(rows[i]) && /\d/.test(rows[i]);
    const afterLabel = i > 0 && /^(?:phone|mobile|contact|tel|call|whatsapp|ph)\b[\s:.#no-]*$/i.test(rows[i - 1]);
    if (labelled || afterLabel) {
      const m = mobileInRow(rows[i]);
      if (m) return m;
    }
  }
  // 2) the first valid mobile number anywhere
  for (const r of rows) {
    const m = mobileInRow(r);
    if (m) return m;
  }
  // 3) tel: links in the PDF
  for (const l of hints.links || []) {
    if (/^tel:/i.test(l)) {
      const m = mobileInRow(l.replace(/^tel:/i, ''));
      if (m) return m;
    }
  }
  return '';
};

// ---------------------------------------------------------------- job titles
const TITLE_WORDS = [
  'developer', 'engineer', 'designer', 'manager', 'executive', 'analyst', 'intern', 'specialist', 'consultant',
  'officer', 'marketer', 'marketing', 'editor', 'writer', 'strategist', 'administrator', 'accountant',
  'associate', 'coordinator', 'copywriter', 'videographer', 'animator', 'recruiter', 'architect', 'lead',
  'head', 'director', 'assistant', 'trainee', 'photographer', 'illustrator', 'producer', 'planner', 'artist',
  'cinematographer', 'telecaller', 'receptionist', 'representative', 'supervisor', 'tester', 'scientist',
  'developer', 'programmer', 'technician', 'secretary', 'auditor', 'executive', 'freelancer', 'blogger',
  'influencer', 'seo', 'graphic', 'ui/ux', 'ux', 'frontend', 'backend', 'full stack', 'fullstack', 'devops',
  'social media', 'content creator', 'digital marketing', 'business development', 'sales', 'telesales',
  'student', 'storyteller', 'creator', 'curator', 'stylist', 'author', 'journalist', 'reporter', 'host', 'anchor', 'trainer',
  'teacher', 'tutor', 'counsellor', 'counselor', 'nurse', 'chef', 'founder', 'owner', 'advisor', 'adviser', 'agent',
  'vlogger', 'youtuber', 'streamer', 'moderator', 'merchandiser', 'salesperson', 'operator', 'handler', 'researcher',
  'dancer', 'singer', 'musician', 'actor', 'model', 'painter', 'sculptor', 'retoucher', 'colorist'
];
const MODIFIERS = [
  'senior', 'junior', 'sr', 'jr', 'chief', 'principal', 'video', 'graphic', 'social', 'content', 'digital',
  'ui', 'ux', 'web', 'software', 'sales', 'hr', 'seo', 'creative', 'mobile', 'data', 'motion', 'brand',
  'business', 'performance', 'product', 'project', 'account', 'customer', 'technical', 'visual', 'lead',
  'fashion', 'interior', 'game', 'event', 'travel', 'textile', 'jewellery', 'jewelry', 'photo', 'film', 'audio',
  'media', 'marketing', 'finance', 'legal', 'medical', 'network', 'cloud', 'full', 'front', 'back', 'art'
];
const isTitleWord = (w) => TITLE_WORDS.some((t) => w === t || (t.length > 4 && w.startsWith(t)));
const hasTitleWord = (s) => {
  const lower = clean(s).toLowerCase();
  return lower.split(/[\s/,&]+/).some((w) => isTitleWord(w)) || TITLE_WORDS.some((t) => t.includes(' ') && lower.includes(t));
};

const SECTION_VOCAB = new Set(('resume curriculum vitae cv profile objective career summary professional about me contact details info ' +
  'information personal experience work employment history education skills skill key core technical projects project certifications ' +
  'certification achievements languages language interests hobbies references declaration address tools software expertise ' +
  'strengths internships internship qualifications qualification academic training courses awards competencies').split(' '));
// true for headings like "Work Experience", "Skills & Tools"; false for "Project Manager", "Software Engineer"
const isSection = (l) => {
  const words = clean(l).toLowerCase().replace(/[:&|/,.-]/g, ' ').split(' ').filter((w) => w && w !== 'and' && w !== 'of');
  return words.length > 0 && words.every((w) => SECTION_VOCAB.has(w));
};
const SKIP_LINE = /(resume|curriculum|vitae|\bcv\b|profile|objective|summary|contact|address|e-?mail|phone|mobile|linkedin|github|portfolio|behance|http|www\.|@|page \d|date of birth|\bdob\b|nationality|gender|marital|languages?)/i;
const PLACES = new Set(['mumbai', 'delhi', 'pune', 'india', 'bangalore', 'bengaluru', 'chennai', 'hyderabad', 'kolkata', 'thane', 'navi', 'new', 'maharashtra', 'gujarat', 'karnataka', 'ahmedabad', 'noida', 'gurgaon', 'gurugram', 'jaipur', 'nagpur', 'surat', 'lucknow', 'indore', 'andheri', 'borivali', 'goregaon', 'malad', 'kandivali', 'dadar', 'bandra', 'kalyan', 'dombivli', 'vashi', 'panvel', 'road', 'street', 'nagar', 'colony', 'society', 'building', 'tower', 'pvt', 'ltd', 'limited', 'private', 'solutions', 'technologies', 'agency', 'studio', 'university', 'college', 'school', 'institute']);
const PARTICLES = new Set(['de', 'da', 'di', 'van', 'von', 'bin', 'al', 'el', 'la', 'le', 'du', 'dos', 'das', 'mc', 'd', 'bint', 'ben']);

const HONORIFIC = /^(?:mr|mrs|ms|miss|shri|shrimati|smt)\.?\s+/i;
const CREDENTIALS = new Set([
  'mba', 'ca', 'cfa', 'cs', 'cma', 'pmp', 'phd', 'md', 'bba', 'bca', 'mca', 'btech', 'mtech', 'bcom', 'mcom',
  'bsc', 'msc', 'llb', 'llm', 'mbbs', 'bds', 'bed', 'med', 'mfa', 'bfa', 'pgdm', 'cpa', 'acca', 'fca', 'bdes', 'mdes'
]);
const credNorm = (w) => w.toLowerCase().replace(/[^a-z]/g, '');

// "Rohit K. Patil, MBA" -> "Rohit K. Patil";  "Priya Shah B.Com" -> "Priya Shah"
const stripCreds = (s) => {
  const t = clean(s);
  if (t.includes(',')) {
    const i = t.indexOf(',');
    const tail = t.slice(i + 1).split(/[,\s]+/).filter(Boolean).map(credNorm);
    if (tail.length && tail.every((w) => CREDENTIALS.has(w))) return clean(t.slice(0, i));
  }
  const words = t.split(' ');
  while (words.length > 2 && CREDENTIALS.has(credNorm(words[words.length - 1]))) words.pop();
  return words.join(' ');
};

const looksLikeName = (line, { allowSingle = false } = {}) => {
  const l = clean(line).replace(/^(?:mr|mrs|ms|miss|dr|shri|smt)\.?\s+/i, '');
  // "Design. Create. Inspire." is a tagline, not a name: a full stop after a real word ends a sentence
  if (l.split(' ').some((w) => w.endsWith('.') && w.replace(/\.+$/, '').length > 2)) return false;
  if (l.length < 3 || l.length > 42) return false;
  if (/[\d@:/\\,;()]/.test(l)) return false;
  if (!/^\p{L}[\p{L}.'’ -]*$/u.test(l)) return false;
  if (isSection(l) || SKIP_LINE.test(l)) return false;
  const words = l.split(' ');
  if (words.length > 4) return false;
  if (words.length === 1 && !allowSingle) return false;
  if (words.some((w) => PLACES.has(w.toLowerCase()))) return false;
  if (words.some((w) => isTitleWord(w.toLowerCase())) || hasTitleWord(l)) return false;
  const upper = l === l.toUpperCase();
  const lower = l === l.toLowerCase();
  const capitalised = words.every((w) => /^\p{Lu}/u.test(w) || PARTICLES.has(w.toLowerCase().replace(/\.$/, '')));
  return upper || lower || capitalised;
};

// "Rohan Mehta Senior Video Editor" -> { name: 'Rohan Mehta', title: 'Senior Video Editor' }
const splitNameTitle = (line) => {
  const words = clean(line).split(' ');
  const idx = words.findIndex((w) => {
    const lw = w.toLowerCase();
    return MODIFIERS.includes(lw) || isTitleWord(lw);
  });
  if (idx < 1 || idx > 3) return null;
  const lead = words.slice(0, idx);
  if (!lead.every((w) => /^\p{L}[\p{L}.'’-]*$/u.test(w))) return null;
  const rest = words.slice(idx);
  if (!rest.some((w) => isTitleWord(w.toLowerCase()))) return null;
  if (lead.length === 1 && lead[0].length < 3) return null;
  return { name: lead.join(' '), title: rest.join(' ') };
};

// The cleaned person name if `line` looks like one, else ''
const asName = (line, allowSingle = false) => {
  const t = stripCreds(line);
  return looksLikeName(t, { allowSingle }) ? t.replace(HONORIFIC, '') : '';
};

const emailLocal = (email) => String(email || '').split('@')[0].toLowerCase().replace(/[^a-z]/g, '');
// true when a word of the name (3+ letters) also appears in the e-mail address
const matchesEmail = (name, email) => {
  const local = emailLocal(email);
  return !!local && name.toLowerCase().replace(/[^a-z ]/g, '').split(' ').some((w) => w.length >= 3 && local.includes(w));
};
// a guess is rejected only when the e-mail clearly belongs to somebody else ("Fashion" vs dhara.shah@)
const consistentWithEmail = (name, email) => emailLocal(email).length < 5 || matchesEmail(name, email);
const sameStyle = (a, b) =>
  (a === a.toUpperCase() && b === b.toUpperCase()) || (a === a.toLowerCase() && b === b.toLowerCase())
  || (a !== a.toUpperCase() && b !== b.toUpperCase() && /^\p{Lu}/u.test(a) && /^\p{Lu}/u.test(b));

// Name-looking lines near the top, in reading order. "AISHA" + "FATIMA KHAN" on two lines -> one name.
const nameCandidates = (top) => {
  const out = [];
  let seenSection = false;
  top.slice(0, 40).forEach((l, i) => {
    if (isSection(l)) seenSection = true;
    if (i < 8 && !seenSection && i + 1 < top.length && l.split(' ').length === 1 && !/\d/.test(l)) {
      const n = top[i + 1];
      if (n.split(' ').length <= 2 && !/\d/.test(n)) {
        const la = asName(l, true);
        const lb = asName(n, true);
        if (la && lb && sameStyle(la, lb)) out.push(`${la} ${lb}`);
      }
    }
    const nm = asName(l);
    if (nm) out.push(nm);
  });
  return out;
};

// ---------------------------------------------------------------- name
export const findName = (text, email = '', filename = '', hints = {}) => {
  const rows = rowsOf(text);
  const pieces = piecesOf(text);
  const top = pieces.slice(0, 30);

  // 1) "Name: John Doe" / "Resume of John Doe"
  for (const r of rows.slice(0, 40)) {
    const m = r.match(/^(?:candidate\s+|full\s+|applicant\s+)?name\s*[:\-]\s*(.{3,40})$/i)
      || r.match(/^(?:resume|cv|curriculum\s+vitae)\s*(?:of|[:\-])\s*(.{3,40})$/i);
    const nm = m ? asName(m[1], true) : '';
    if (nm) return fixCase(nm);
  }
  // 2) the biggest text on page 1 (PDFs), then 3) name-looking lines near the top. Collect them all and
  //    prefer the one that matches the e-mail address (stops taglines like "Design. Create. Inspire." winning).
  const cands = [];
  for (const h of hints.headlines || []) {
    for (const p of piecesOf(h)) {
      const nm = asName(p, true);
      if (nm) { cands.push(nm); continue; }
      const sp = splitNameTitle(p);
      const n2 = sp ? asName(sp.name, true) : '';
      if (n2) cands.push(n2);
    }
  }
  cands.push(...nameCandidates(top));
  if (cands.length) return fixCase(cands.find((c) => email && matchesEmail(c, email)) || cands[0]);

  // 4) "Priya Sharma Senior Graphic Designer" on one line -> the words before the title
  for (const l of top) {
    if (SKIP_LINE.test(l) || /\d/.test(l)) continue;
    const sp = splitNameTitle(l);
    const nm = sp ? asName(sp.name, true) : '';
    if (nm && consistentWithEmail(nm, email)) return fixCase(nm);
  }
  // 5) a single-word name on the very first line
  const first = top[0] ? asName(top[0], true) : '';
  if (first && consistentWithEmail(first, email)) return fixCase(first);
  // 6) the e-mail: priya.sharma92@x.com -> Priya Sharma
  const local = String(email).split('@')[0].replace(/\d+/g, '').split(/[._-]+/).filter((p) => p.length > 1);
  if (local.length >= 2 || (local.length === 1 && local[0].length > 3)) return titleCase(local.slice(0, 3).join(' '));
  // 7) the file name: "Priya_Sharma_Resume.pdf"
  const fromFile = String(filename).replace(/\.[a-z0-9]+$/i, '')
    .replace(/(resume|curriculum|vitae|\bcv\b|updated|final|new|copy|\(\d+\))/gi, ' ')
    .replace(/[\d_.-]+/g, ' ').replace(/\s+/g, ' ').trim();
  const generic = /^(?:image|img|photo|picture|pic|scan|scanned|screenshot|screen shot|document|doc|untitled|download|file|whatsapp image)(?: \w+)?$/i.test(fromFile);
  return /^[A-Za-z ]{3,40}$/.test(fromFile) && !generic ? titleCase(fromFile) : '';
};

// ---------------------------------------------------------------- position
// "Graphic Designer &" / "Video editor" on two lines is ONE job title
const joinWrapped = (text) =>
  String(text || '')
    .replace(/([&+/]|\band)[ \t]*\r?\n[ \t]*(?=\p{L})/giu, '$1 ')
    .replace(/[ \t]*\r?\n[ \t]*(?=[&+/][ \t]*\p{L})/gu, ' ');

// "Graphic Designer & Video editor" -> "Graphic Designer & Video Editor"
const capWords = (t) =>
  t.split(' ').map((w, i) => (/^\p{Lu}/u.test(w) || !/^\p{L}/u.test(w) || (i > 0 && LOWER_WORDS.has(w.toLowerCase())) ? w : w[0].toUpperCase() + w.slice(1))).join(' ');

// "Social Media Manager, Bright Co. 2021 - Present" -> "Social Media Manager"
const cleanPosition = (s) => {
  let t = clean(s)
    .replace(/^(?:position|designation|role|job\s+title)\s*[:\-]\s*/i, '')
    .replace(/^(?:an?|the)\s+/i, '');
  t = t.split(/\s+(?:at|@|with|in|for|from|under)\s+|,|\(|\||\s[-–—]\s|\s{2,}|\b(?:19|20)\d{2}\b/i)[0];
  t = clean(t).replace(/[.,;:]+$/, '');
  if (t.length < 3 || t.length > 60 || t.split(' ').length > 7) return '';
  if (/(?:[&+/]|\band)$/i.test(t)) return ''; // cut off mid-title ("Graphic Designer &"): the rest is on the next line
  return fixCase(capWords(t));
};

const titleLine = (l, max = 60) =>
  l.length <= max && l.split(' ').length <= 7 && !/[@\d]/.test(l) && !SKIP_LINE.test(l) && !isSection(l) && hasTitleWord(l);

// true when the words before a job title are the candidate's name (or no name is known yet)
const samePerson = (lead, name) => {
  if (!name) return true;
  const words = (t) => String(t).toLowerCase().replace(/[^a-z ]/g, '').split(' ').filter(Boolean);
  const a = words(lead);
  const b = words(name);
  return a.length > 0 && b.length > 0 && (a.every((w) => b.includes(w)) || b.every((w) => a.includes(w)));
};
const NOT_A_TITLE = /^(?:fresher|student|resume|cv|curriculum vitae|profile|about me|summary|objective|biodata|bio-data)$/i;

export const findPosition = (text, hints = {}, name = '') => {
  text = joinWrapped(text);
  const rows = rowsOf(text);
  const pieces = piecesOf(text);
  const top = pieces.slice(0, 40);

  // 1) "Applied for: Social Media Executive", "Designation - Graphic Designer"
  for (const r of rows.slice(0, 80)) {
    const m = r.match(/^(?:position(?:\s+applied)?(?:\s+for)?|post\s+applied\s+for|applied\s+for|applying\s+for|desired\s+(?:role|position|job)|job\s+(?:title|role)|designation|current\s+(?:role|position|designation)|role)\s*[:\-]\s*(.{3,70})$/i);
    if (m) { const p = cleanPosition(m[1]); if (p) return p; }
  }
  // 2) a big headline that is a job title ("SNEHA PATIL" then "Social Media Manager")
  for (const h of hints.headlines || []) {
    for (const p of piecesOf(h)) {
      if (p !== name && titleLine(p)) { const c = cleanPosition(p); if (c) return c; }
      const sp = splitNameTitle(p);
      if (sp && samePerson(sp.name, name)) { const c = cleanPosition(sp.title); if (c) return c; }
    }
  }
  // 3) "Rohan Mehta Senior Video Editor" on one line
  for (const l of top.slice(0, 14)) {
    if (SKIP_LINE.test(l) || /\d/.test(l)) continue;
    const sp = splitNameTitle(l);
    if (sp && samePerson(sp.name, name)) { const c = cleanPosition(sp.title); if (c) return c; }
  }
  // 4) a short title-looking line right under the name / near the top
  const nameAt = name ? top.findIndex((l) => l.toLowerCase() === name.toLowerCase()) : -1;
  const order = nameAt >= 0 ? [...top.slice(nameAt + 1, nameAt + 5), ...top.slice(0, nameAt)] : top.slice(0, 16);
  for (const l of order) if (titleLine(l)) { const c = cleanPosition(l); if (c) return c; }

  const flat = clean(normalize(text).replace(/\n/g, ' '));
  // 5) objective / summary: "seeking the position of Digital Marketing Executive", "as a Video Editor"
  let m = flat.match(/\b(?:position|role|post|opening|opportunity)\s+(?:of|as)\s+(?:an?\s+)?([A-Za-z][A-Za-z/&' -]{3,45}?)(?=\s+(?:at|in|with|where|that|to|and|who)\b|[.,;]|$)/i);
  if (m && hasTitleWord(m[1])) { const c = cleanPosition(m[1]); if (c) return c; }
  m = flat.match(/\b(?:seeking|looking\s+for|applying\s+for|aspiring)\s+(?:for\s+)?(?:an?|the)?\s*([A-Za-z][A-Za-z/&' -]{3,40}?)\s+(?:position|role|job|opportunity|post)\b/i);
  if (m && hasTitleWord(m[1])) { const c = cleanPosition(m[1]); if (c) return c; }
  for (const r of rows) {
    const mm = r.match(/(?:^|[.:]\s*)((?:[A-Z][A-Za-z/&.-]*\s+){0,3}[A-Z][A-Za-z/&.-]*)\s+(?:with|having)\s+(?:over\s+|around\s+|more\s+than\s+)?\d+(?:\.\d+)?\+?\s+years?/);
    if (mm && hasTitleWord(mm[1])) { const c = cleanPosition(mm[1]); if (c) return c; }
  }
  m = flat.match(/\b((?:[A-Z][A-Za-z/&.-]*\s+){0,3}[A-Z][A-Za-z/&.-]*)\s+(?:with|having)\s+(?:over\s+|around\s+|more\s+than\s+)?\d+(?:\.\d+)?\+?\s+years?/);
  if (m && hasTitleWord(m[1])) { const c = cleanPosition(m[1]); if (c) return c; }
  m = flat.match(/\b(?:work|working|worked|serve|serving|served|join)\s+as\s+(?:an?\s+)?([A-Za-z][A-Za-z/&' -]{3,40}?)(?=\s+(?:at|in|for|with|where)\b|[.,;]|$)/i);
  if (m && hasTitleWord(m[1])) { const c = cleanPosition(m[1]); if (c) return c; }

  // 6) the first job listed under Experience
  const at = rows.findIndex((r) => /^(?:work\s+|professional\s+|relevant\s+)?(?:experience|employment(?:\s+history)?|career\s+history|internships?)\b/i.test(r) && r.length < 40);
  if (at >= 0) {
    for (const r of rows.slice(at + 1, at + 8)) {
      for (const part of r.split(/\s[-–—]\s/)) {
        const head = clean(part).split(/,|\s+(?:at|@)\s+/i)[0];
        if (titleLine(head)) { const c = cleanPosition(head); if (c) return c; }
      }
    }
  }
  // 7) any title-looking line in the top part of the resume
  for (const l of top) if (titleLine(l, 50)) { const c = cleanPosition(l); if (c) return c; }
  // 8) last resort: unusual job titles ("Visual Storyteller") are not in the word list, but they sit right
  //    under (or beside) the name in a short line of their own
  if (nameAt >= 0) {
    for (const l of top.slice(nameAt + 1, nameAt + 3)) {
      const words = l.split(' ');
      if (words.length >= 1 && words.length <= 5 && l.length <= 45
        && /^\p{L}[\p{L}&/+.'’ -]*$/u.test(l) && !/\./.test(l)
        && !isSection(l) && !SKIP_LINE.test(l) && !NOT_A_TITLE.test(l)
        && !words.some((w) => PLACES.has(w.toLowerCase()))) {
        const c = cleanPosition(l);
        if (c) return c;
      }
    }
  }
  return '';
};

// ---------------------------------------------------------------- put it together
const parseOne = (text, filename, hints) => {
  const email = findEmail(text);
  const name = findName(text, email, filename, hints);
  return { name, mobile: findMobile(text, hints), email, position: findPosition(text, hints, name) };
};

// hints (optional, from the PDF reader): { altText, headlines, links }
export const parseResumeText = (text, filename = '', hints = {}) => {
  const out = parseOne(text, filename, hints);
  // Second opinion: the same words in the file's own drawing order, to fill whatever is still empty
  if (hints.altText && (!out.name || !out.mobile || !out.email || !out.position)) {
    const alt = parseOne(hints.altText, filename, hints);
    Object.keys(out).forEach((k) => { if (!out[k] && alt[k]) out[k] = alt[k]; });
  }
  // Hyperlinks (icons in designed resumes are often mailto: links)
  if (!out.email) {
    const link = (hints.links || []).find((l) => /^mailto:/i.test(l));
    if (link) out.email = findEmail(link);
  }
  if (!out.email) {
    // last resort for the e-mail: it may be split across lines ("name@" + "gmail.com")
    out.email = findEmail(clean(normalize(text).replace(/\s*\n\s*/g, '')));
  }
  return out;
};

// ---------------------------------------------------------------- reading the file
export const RESUME_EXTS = ['pdf', 'docx', 'doc', 'txt', 'rtf', 'jpg', 'jpeg', 'png', 'webp'];
export const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'webp'];
export const extOf = (file) => String(file.originalname || '').toLowerCase().split('.').pop();

const need = (what, pkg) =>
  new Error(`${what} reading needs the "${pkg}" package. Run "npm install" in the backend folder and restart the server.`);

// Reads the uploaded file and returns { text, hints }. Libraries are loaded on demand so the
// server still starts if `npm install` has not been run since they were added.
export const extractResume = async (file) => {
  const ext = extOf(file);
  const hints = {};

  if (ext === 'pdf' || file.mimetype === 'application/pdf') {
    let text = '';
    try {
      const r = await pdfToResume(file.buffer);
      text = r.text || '';
      hints.altText = r.altText;
      hints.headlines = r.headlines;
      hints.links = r.links;
    } catch (err) {
      console.error('PDF reader failed, using built-in reader:', err.message);
    }
    if (!text.trim()) {
      try { text = pdfText(file.buffer); } catch (err) { console.error('Built-in PDF reader failed:', err.message); }
    }
    return { text, hints };
  }

  if (ext === 'docx') {
    let text = '';
    try { text = docxText(file.buffer); } catch (err) { console.error('Built-in DOCX reader failed:', err.message); }
    if (!text.trim()) {
      try {
        const mammoth = (await import('mammoth')).default;
        text = (await mammoth.extractRawText({ buffer: file.buffer })).value || '';
      } catch (err) { console.error('mammoth failed:', err.message); }
    }
    return { text, hints };
  }

  if (ext === 'doc') {
    let WordExtractor;
    try { WordExtractor = (await import('word-extractor')).default; } catch { throw need('DOC', 'word-extractor'); }
    const doc = await new WordExtractor().extract(file.buffer);
    return { text: doc.getBody() || '', hints };
  }

  if (ext === 'txt') return { text: file.buffer.toString('utf8'), hints };

  if (ext === 'rtf') {
    // strip RTF control words, keep the visible text
    const text = file.buffer.toString('utf8')
      .replace(/\{\\(?:\*\\)?(?:fonttbl|colortbl|stylesheet|info|pict)[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/gi, '')
      .replace(/\\par[d]?/g, '\n')
      .replace(/\\'[0-9a-f]{2}/gi, ' ')
      .replace(/\\[a-z]+-?\d* ?/gi, '')
      .replace(/[{}]/g, '')
      .replace(/\n[ \t]+/g, '\n');
    return { text, hints };
  }

  if (IMAGE_EXTS.includes(ext)) {
    // Photo / screenshot of a resume -> OCR
    let createWorker;
    try { ({ createWorker } = await import('tesseract.js')); } catch { throw need('Image', 'tesseract.js'); }
    const worker = await createWorker('eng', 1, { cachePath: os.tmpdir() });
    try {
      const { data } = await worker.recognize(file.buffer);
      return { text: data.text || '', hints };
    } finally {
      await worker.terminate();
    }
  }

  throw new Error('Unsupported file type.');
};

// Kept for older callers: just the text
export const extractText = async (file) => (await extractResume(file)).text;
