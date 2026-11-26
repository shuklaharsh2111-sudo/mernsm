// Creates a super admin, or turns an existing admin into one.
//   node scripts/create-super-admin.js --email boss@company.com --name "Boss" --password "StrongPass123"
//   node scripts/create-super-admin.js --email existing-admin@company.com      -> promotes that admin
import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import Admin from '../admin/Admin.js';
import { roleModels } from '../admin/UserModels.js';

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : '';
};
const email = String(arg('email')).trim().toLowerCase();
const name = String(arg('name')).trim();
const password = String(arg('password'));
if (!email) {
  console.error('Usage: node scripts/create-super-admin.js --email <email> [--name <name> --password <password>]');
  process.exit(1);
}

await mongoose.connect(process.env.MONGO_URI);
try {
  const existing = await Admin.findOne({ email });
  if (existing) {
    await Admin.collection.updateOne({ _id: existing._id }, { $set: { isSuperAdmin: true } });
    console.log(`${email} is now a super admin.`);
  } else {
    for (const Model of Object.values(roleModels)) {
      if (await Model.exists({ email })) throw new Error('That email already belongs to a non-admin account.');
    }
    if (!name || password.length < 8) throw new Error('A new super admin needs --name and a --password of at least 8 characters.');
    await Admin.collection.insertOne({
      name, fullname: name, email, contact: '', role: 'admin', isSuperAdmin: true,
      password: await bcrypt.hash(password, 10), createdAt: new Date(), updatedAt: new Date(),
    });
    console.log(`Super admin created: ${email}`);
  }
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
