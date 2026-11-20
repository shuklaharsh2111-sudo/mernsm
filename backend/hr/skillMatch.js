// Compares a candidate (position + skills) with the base skills HR saved for roles.
import RoleSkill from './RoleSkill.js';
import Candidate from './Candidate.js';

const SENIORITY = new Set(['senior', 'junior', 'sr', 'jr', 'lead', 'head', 'intern', 'trainee', 'fresher', 'executive', 'associate', 'assistant', 'manager', 'freelance', 'freelancer', 'full', 'time', 'part']);
const stem = (w) => (w.length > 5 ? w.replace(/(ers|er|ing|s)$/, '') : w);
const roleTokens = (s) =>
  String(s || '').toLowerCase().replace(/[^a-z0-9+#\s]/g, ' ').split(/\s+/)
    .filter((w) => w && !SENIORITY.has(w)).map(stem);

// How close is a candidate's position to a saved role? 0 = unrelated, 100 = same
const roleScore = (position, role) => {
  const a = roleTokens(position);
  const b = roleTokens(role);
  if (!a.length || !b.length) return 0;
  const A = a.join(' ');
  const B = b.join(' ');
  if (A === B) return 100;
  if (A.includes(B) || B.includes(A)) return 85;
  const common = a.filter((w) => b.includes(w)).length;
  const jaccard = common / new Set([...a, ...b]).size;
  return jaccard >= 0.5 ? Math.round(jaccard * 70) : 0;
};

export const findRole = (roles, position) => {
  let best = null;
  let bestScore = 0;
  roles.forEach((r) => {
    const s = roleScore(position, r.role);
    if (s > bestScore) { best = r; bestScore = s; }
  });
  return best;
};

// "Adobe Photoshop" = "Photoshop", "Node.js" = "NodeJS" = "Node"
const normSkill = (s) =>
  String(s || '').toLowerCase().trim()
    .replace(/^(?:adobe|ms|microsoft|google)\s+/, '')
    .replace(/[.\s-]?js$/, '')
    .replace(/[^a-z0-9+#]/g, '');
const sameSkill = (a, b) => {
  if (!a || !b) return false;
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return short.length >= 4 && long.includes(short);
};

export const splitSkills = (value) =>
  (Array.isArray(value) ? value : String(value || '').split(/[,;\n]/)).map((s) => String(s).trim()).filter(Boolean);

// -> null when there is nothing to compare with, otherwise the result of the comparison
export const evaluateMatch = async (position, skillsText) => {
  const roles = await RoleSkill.find().lean();
  const role = findRole(roles, position);
  if (!role || !role.skills.length) return null;
  const have = splitSkills(skillsText).map(normSkill);
  const matched = [];
  const missing = [];
  role.skills.forEach((req) => {
    const n = normSkill(req);
    (have.some((h) => sameSkill(h, n)) ? matched : missing).push(req);
  });
  const score = Math.round((matched.length / role.skills.length) * 100);
  return {
    role: role.role,
    score,
    needed: role.minMatch,
    matched,
    missing,
    pass: score >= role.minMatch,
    autoShortlist: role.autoShortlist !== false
  };
};

// Re-compare every candidate after a role's base skills change, so the badges never show an old result.
// Only the stored result is refreshed; nobody is shortlisted or un-shortlisted here.
export const refreshAllMatches = async () => {
  const roles = await RoleSkill.find().lean();
  const list = await Candidate.find().select('position skills matchRole matchScore matchNeeded matchedSkills missingSkills').lean();
  const ops = [];
  list.forEach((c) => {
    const role = findRole(roles, c.position);
    let next = { matchRole: '', matchScore: null, matchNeeded: null, matchedSkills: [], missingSkills: [] };
    if (role && role.skills.length) {
      const have = splitSkills(c.skills).map(normSkill);
      const matched = [];
      const missing = [];
      role.skills.forEach((req) => {
        const n = normSkill(req);
        (have.some((h) => sameSkill(h, n)) ? matched : missing).push(req);
      });
      next = { matchRole: role.role, matchScore: Math.round((matched.length / role.skills.length) * 100), matchNeeded: role.minMatch, matchedSkills: matched, missingSkills: missing };
    }
    const same = next.matchRole === (c.matchRole || '') && next.matchScore === (c.matchScore ?? null) && next.matchNeeded === (c.matchNeeded ?? null)
      && next.missingSkills.join('|') === (c.missingSkills || []).join('|');
    if (!same) ops.push({ updateOne: { filter: { _id: c._id }, update: { $set: next } } });
  });
  if (ops.length) await Candidate.bulkWrite(ops);
  return ops.length;
};

