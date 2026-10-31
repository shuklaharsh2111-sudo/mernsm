// Login is handled by the shared /api/auth/login. Admins are never self-registered:
// the first admin is seeded from .env (see config/seedAdmin.js).
const AVATAR_RE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;

const publicAdmin = (admin) => ({
  id: admin._id,
  name: admin.name,
  email: admin.email,
  role: admin.role,
  avatar: admin.avatar || '',
});

export const me = (req, res) => {
  res.json({ admin: publicAdmin(req.admin) });
};

export const updateAvatar = async (req, res, next) => {
  try {
    const { avatar } = req.body;
    if (typeof avatar !== 'string' || avatar.length > 150000 || !AVATAR_RE.test(avatar)) {
      return res.status(400).json({ message: 'Upload a valid png, jpeg or webp image' });
    }
    req.admin.avatar = avatar;
    await req.admin.save();
    res.json({ admin: publicAdmin(req.admin) });
  } catch (err) {
    next(err);
  }
};
