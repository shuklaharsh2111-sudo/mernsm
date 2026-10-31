import bcrypt from 'bcryptjs';
import Admin from '../admin/models/Admin.js';
import User from '../admin/models/User.js';

// There is no register page. If the database has no admin yet, create the first one
// from ADMIN_EMAIL / ADMIN_PASSWORD (/ ADMIN_NAME) in .env. After that, .env values are ignored.
const seedAdmin = async () => {
  if ((await Admin.countDocuments()) > 0) return;

  const { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME } = process.env;
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.error(
      'No admin exists yet. Set ADMIN_EMAIL and ADMIN_PASSWORD in backend/.env, then restart to create the first admin.'
    );
    process.exit(1);
  }
  if (ADMIN_PASSWORD.length < 8) {
    console.error('ADMIN_PASSWORD must be at least 8 characters.');
    process.exit(1);
  }

  const email = ADMIN_EMAIL.trim().toLowerCase();
  if (await User.findOne({ email })) {
    console.error(`ADMIN_EMAIL (${email}) is already used by a user. Pick a different email.`);
    process.exit(1);
  }

  await Admin.create({
    name: (ADMIN_NAME || 'Admin').trim(),
    email,
    password: await bcrypt.hash(ADMIN_PASSWORD, 12),
  });
  console.log(`First admin created: ${email}. You can now remove ADMIN_PASSWORD from .env.`);
};

export default seedAdmin;
