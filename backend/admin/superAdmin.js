import bcrypt from 'bcryptjs';
import Admin from './Admin.js';
import { roleModels } from './UserModels.js';

// Super admin comes from .env:
//   SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD (min 8 chars), SUPER_ADMIN_NAME (optional)
// On every server start: the account is created if missing, promoted to super admin if it
// is a normal admin, and its password is re-synced when the value in .env changes.
// If the env vars are not set, falls back to the old behaviour (oldest admin becomes super admin).
const syncFromEnv = async (email, password, name) => {
  if (password.length < 8) {
    console.error('SUPER_ADMIN_PASSWORD must be at least 8 characters. Super admin from .env skipped.');
    return false;
  }
  const existing = await Admin.findOne({ email }).select('+password');
  if (existing) {
    const update = {};
    if (!existing.isSuperAdmin) update.isSuperAdmin = true;
    if (!existing.password || !(await bcrypt.compare(password, existing.password))) {
      update.password = await bcrypt.hash(password, 10);
    }
    if (Object.keys(update).length) {
      update.updatedAt = new Date();
      await Admin.collection.updateOne({ _id: existing._id }, { $set: update });
      console.log(`Super admin synced from .env: ${email}`);
    }
    return true;
  }
  for (const [roleName, Model] of Object.entries(roleModels)) {
    if (roleName !== 'admin' && (await Model.exists({ email }))) {
      console.error(`SUPER_ADMIN_EMAIL (${email}) already belongs to a ${roleName} account. Super admin from .env skipped.`);
      return false;
    }
  }
  await Admin.collection.insertOne({
    name, fullname: name, email, contact: '', role: 'admin', isSuperAdmin: true,
    password: await bcrypt.hash(password, 10), createdAt: new Date(), updatedAt: new Date(),
  });
  console.log(`Super admin created from .env: ${email}`);
  return true;
};

export const ensureSuperAdmin = async () => {
  try {
    const email = String(process.env.SUPER_ADMIN_EMAIL || '').trim().toLowerCase();
    const password = String(process.env.SUPER_ADMIN_PASSWORD || '');
    const name = String(process.env.SUPER_ADMIN_NAME || 'Super Admin').trim();
    if (email && password) {
      if (await syncFromEnv(email, password, name)) return;
    }
    if (await Admin.exists({ isSuperAdmin: true })) return;
    const first = (await Admin.findOne({ isDefault: true }).sort({ createdAt: 1 }))
      || (await Admin.findOne().sort({ createdAt: 1 }));
    if (!first) return;
    await Admin.collection.updateOne({ _id: first._id }, { $set: { isSuperAdmin: true } });
    console.log(`Super admin: ${first.email} was made the super admin (there was none).`);
  } catch (error) {
    console.error('ensureSuperAdmin failed:', error.message);
  }
};
