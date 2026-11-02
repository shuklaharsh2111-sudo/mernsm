// One-time repair: turns dates saved as { "$date": "..." } objects (a bad JSON import) into real MongoDB dates.
//   node scripts/fix-date-fields.js          -> only shows what it would change
//   node scripts/fix-date-fields.js --apply  -> writes the fixes
import 'dotenv/config';
import mongoose from 'mongoose';

const apply = process.argv.includes('--apply');

const isExtDate = (v) =>
  v && typeof v === 'object' && !(v instanceof Date) && Object.keys(v).length === 1 && '$date' in v;

// returns [newValue, changed]
const fix = (v) => {
  if (isExtDate(v)) {
    const d = new Date(typeof v.$date === 'object' ? Number(v.$date.$numberLong) : v.$date);
    return Number.isNaN(d.getTime()) ? [v, false] : [d, true];
  }
  if (Array.isArray(v)) {
    let changed = false;
    const out = v.map((x) => {
      const [nx, c] = fix(x);
      changed = changed || c;
      return nx;
    });
    return [changed ? out : v, changed];
  }
  if (v && typeof v === 'object' && v.constructor === Object) {
    let changed = false;
    const out = {};
    for (const [k, x] of Object.entries(v)) {
      const [nx, c] = fix(x);
      changed = changed || c;
      out[k] = nx;
    }
    return [changed ? out : v, changed];
  }
  return [v, false];
};

await mongoose.connect(process.env.MONGO_URI);
const db = mongoose.connection.db;
let total = 0;

for (const { name } of await db.listCollections().toArray()) {
  if (name.startsWith('system.')) continue;
  const col = db.collection(name);
  let fixedDocs = 0;
  for await (const doc of col.find({})) {
    const set = {};
    for (const [k, v] of Object.entries(doc)) {
      if (k === '_id') continue;
      const [nv, changed] = fix(v);
      if (changed) set[k] = nv;
    }
    if (Object.keys(set).length) {
      fixedDocs += 1;
      console.log(`${name} ${doc._id}: ${Object.keys(set).join(', ')}`);
      if (apply) await col.updateOne({ _id: doc._id }, { $set: set });
    }
  }
  if (fixedDocs) console.log(`-> ${name}: ${fixedDocs} document(s) ${apply ? 'fixed' : 'need fixing'}\n`);
  total += fixedDocs;
}

console.log(total ? (apply ? `Done. Fixed ${total} document(s).` : `Found ${total} document(s). Run again with --apply to fix them.`) : 'No bad dates found.');
await mongoose.disconnect();
