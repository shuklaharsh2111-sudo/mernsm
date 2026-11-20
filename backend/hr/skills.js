// Pulls the candidate's skills out of resume text.
// 1) reads the "Skills / Tools / Software ..." section of the resume, item by item
// 2) also spots well-known tools anywhere in the text (Photoshop, Figma, React ...)
// Returns one comma-separated string (what the "Skills" column stores).

const KNOWN = [
  // design & creative
  'Photoshop', 'Illustrator', 'InDesign', 'After Effects', 'Premiere Pro', 'Lightroom', 'Figma', 'Adobe XD', 'Sketch',
  'Canva', 'CorelDRAW', 'Blender', 'Cinema 4D', 'Maya', 'Final Cut Pro', 'DaVinci Resolve', 'CapCut', 'Procreate',
  'Premiere', 'Audition', 'Animate', 'Spline', 'Framer', 'Webflow', 'Midjourney',
  'UI/UX', 'UI Design', 'UX Design', 'Graphic Design', 'Motion Graphics', 'Video Editing', 'Photo Editing', 'Branding',
  'Logo Design', 'Typography', 'Wireframing', 'Prototyping', 'Illustration', 'Animation', '3D Modelling', 'Copywriting',
  'Content Writing', 'Storytelling', 'Photography', 'Videography', 'Social Media Marketing', 'Content Creation',
  'SEO', 'SEM', 'Digital Marketing', 'Email Marketing', 'Influencer Marketing', 'Google Analytics', 'Google Ads',
  'Meta Ads', 'Facebook Ads', 'Canva Pro', 'Meta Business Suite', 'Hootsuite', 'Buffer', 'Mailchimp', 'HubSpot',
  'Salesforce', 'Zoho', 'Notion', 'Trello', 'Asana', 'Jira', 'Slack',
  // office / data
  'MS Excel', 'Excel', 'MS Word', 'MS Office', 'PowerPoint', 'Google Sheets', 'Tally', 'Power BI', 'Tableau', 'SQL', 'MySQL',
  'PostgreSQL', 'MongoDB', 'Firebase', 'Data Analysis',
  // dev
  'JavaScript', 'TypeScript', 'React', 'React.js', 'Next.js', 'Node.js', 'Express.js', 'Express', 'Angular', 'Vue.js', 'HTML',
  'CSS', 'HTML5', 'CSS3', 'Tailwind CSS', 'Bootstrap', 'Sass', 'Redux', 'jQuery', 'Python', 'Django', 'Flask', 'Java', 'Spring Boot',
  'C++', 'C#', '.NET', 'PHP', 'Laravel', 'WordPress', 'Shopify', 'Swift', 'Kotlin', 'Flutter', 'React Native', 'Android', 'Git',
  'GitHub', 'Docker', 'AWS', 'Azure', 'GCP', 'REST API', 'GraphQL', 'Linux', 'Machine Learning', 'Deep Learning', 'TensorFlow',
  'PyTorch', 'Pandas', 'NumPy', 'MERN', 'MERN Stack',
  // business
  'Business Development', 'Lead Generation', 'Sales', 'Negotiation', 'Client Handling', 'Market Research', 'Brand Strategy',
  'Content Strategy', 'Communication', 'Leadership', 'Project Management', 'Team Management', 'Public Speaking', 'Time Management',
];

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
const KNOWN_RES = KNOWN.map((name) => ({
  name,
  re: new RegExp(`(?<![A-Za-z0-9+#.])${escapeRe(name).replace(/\\ /g, '\\s+')}(?![A-Za-z0-9+#])`, 'i'),
}));
const CANON = new Map(KNOWN.map((n) => [n.toLowerCase(), n]));

const HEADING = /^(?:(?:technical|key|core|professional|soft|software|design|it|computer|hard|other|relevant|additional)\s+)?(?:skills?(?:\s*set)?|competenc(?:y|ies)|expertise|tools?|software|technologies|tech\s*stack|areas?\s+of\s+expertise|tools\s+known|software\s+(?:knowledge|proficiency|known))(?:\s*(?:&|and|\/|,)\s*[a-z ]{3,25})?$/i;
const STOP = /^(?:work\s+)?(?:experience|work\s+history|employment(?:\s+history)?|professional\s+experience|internships?|education(?:al)?(?:\s+qualifications?)?|academics?|projects?|summary|profile|professional\s+summary|career\s+objective|objective|about(?:\s+me)?|certifications?|certificates?|courses?|training|achievements?|awards?|accomplishments?|languages?|interests?|hobbies|references?|declaration|personal\s+(?:details|information)|contact(?:\s+(?:details|info))?|links?|volunteering|activities|extra[\s-]*curricular(?:\s+activities)?|strengths?|portfolio)$/i;

const INLINE = /^(?:skills?(?:\s*set)?|(?:technical|key|core|soft|software|design|it)\s+skills?|tools?(?:\s+known)?|software(?:\s+known)?|tech\s*stack)\s*[:\-–]\s*(.+)$/i;
const clean = (s) => String(s || '').replace(/[\u00a0\t]+/g, ' ').replace(/\s+/g, ' ').trim();
const tidyLine = (l) => clean(l).replace(/^[\s•·▪●◦■□►➢✓✔*\-–—>]+/, '').replace(/:+$/, '').trim();

const WEAK = /^(?:and|etc\.?|more|others?|basic|basics|advanced|intermediate|beginner|proficient|expert|good|excellent|knowledge|working|hands[\s-]*on|familiar(?:ity)?|skills?|tools?|software|n\/a|none|na|yes|no)$/i;
const SENTENCE = /\b(?:the|with|of|for|in|at|to|on|using|that|which|have|has|was|were|my|our|your|i|am|is|are)\b/i;

const cleanItem = (raw) => {
  let s = tidyLine(raw)
    .replace(/\s*\((?:[^)]{0,25})\)\s*$/, '')           // "Photoshop (Advanced)"
    .replace(/\s*[-–:]\s*(?:basic|intermediate|advanced|expert|beginner|proficient|good)\b.*$/i, '')
    .replace(/^(?:good|excellent|strong|basic|advanced|great|fluent|sound)\s+/i, '')
    .replace(/[.;]+$/, '')
    .trim();
  if (!s || s.length < 2 || s.length > 32) return '';
  if (WEAK.test(s) || /^\d+$/.test(s) || /@|https?:|www\./i.test(s)) return '';
  const words = s.split(' ');
  if (words.length > 4) return '';
  if (words.length > 2 && SENTENCE.test(s)) return '';
  return CANON.get(s.toLowerCase()) || s;
};

// Items listed under a "Skills" style heading
const fromSection = (text) => {
  const lines = String(text || '').split(/\r?\n/);
  const items = [];
  for (let i = 0; i < lines.length; i += 1) {
    const head = tidyLine(lines[i]);
    const raw = clean(lines[i]);
    let body = null;
    if (head && head.length <= 40 && HEADING.test(head)) {
      body = lines.slice(i + 1, i + 26);
    } else {
      // "Skills: Photoshop, Figma" on a single line
      const m = raw.replace(/^[\s•·▪●◦■□►➢✓✔*\-–—>]+/, '').match(INLINE);
      if (m) body = [m[1], ...lines.slice(i + 1, i + 6)];
    }
    if (!body) continue;
    for (const line of body) {
      const t = tidyLine(line);
      if (!t) continue;
      if (STOP.test(t.replace(/:$/, '')) || (t.length <= 40 && STOP.test(t))) break;
      // "Design Tools: Photoshop, Illustrator" -> keep what follows the label
      let rest = String(line).replace(/\t/g, '  ');
      const colon = rest.match(/^([^:]{2,30}):\s*(.+)$/);
      if (colon && clean(colon[1]).split(' ').length <= 3) rest = colon[2];
      rest.split(/[,;|•·▪●◦■□►➢✓✔]|\s{2,}|\s[-–—]\s|\s\/\s/).forEach((part) => {
        const item = cleanItem(part);
        if (item) items.push(item);
      });
    }
    if (items.length) break; // first real skills section is enough
  }
  return items;
};

// Well-known tools mentioned anywhere in the resume
const fromKnown = (text) => KNOWN_RES.filter(({ re }) => re.test(text)).map(({ name }) => name);

export const findSkills = (text, { max = 20, maxLen = 500 } = {}) => {
  const body = String(text || '');
  if (!body.trim()) return '';
  const seen = new Set();
  const out = [];
  const add = (item) => {
    const key = item.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(item);
  };
  fromSection(body).forEach(add);
  fromKnown(body).forEach(add);
  // drop short names already covered by a longer one ("Premiere" vs "Premiere Pro", "Excel" vs "MS Excel")
  const lower = out.map((s) => s.toLowerCase());
  const kept = out.filter((s, i) => !lower.some((o, j) => j !== i && o.length > s.length && (o.endsWith(` ${s.toLowerCase()}`) || o.startsWith(`${s.toLowerCase()} `) || o.startsWith(`${s.toLowerCase()}.`))));
  let result = '';
  for (const s of kept.slice(0, max)) {
    const next = result ? `${result}, ${s}` : s;
    if (next.length > maxLen) break;
    result = next;
  }
  return result;
};

// Same clean-up for text typed in by HR (comma separated)
export const cleanSkills = (value, maxLen = 500) =>
  String(value || '')
    .split(/[,;\n]/)
    .map((s) => clean(s))
    .filter(Boolean)
    .filter((s, i, a) => a.findIndex((x) => x.toLowerCase() === s.toLowerCase()) === i)
    .join(', ')
    .slice(0, maxLen);
