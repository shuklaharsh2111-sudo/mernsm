import { roleLabel } from '../../admin/models/User.js';

const AVATAR_RE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;

// What a logged-in user sees about themselves (never the password).
export const publicSme = (user) => ({
  id: user._id,
  userId: user.userId,
  name: user.name,
  email: user.email,
  contact: user.contact,
  role: user.role,
  roleLabel: roleLabel(user.role),
  reportingManager: user.reportingManager,
  assignedCompanies: user.assignedCompanies,
  avatar: user.avatar || '',
});

export const me = (req, res) => {
  res.json({ sme: publicSme(req.sme) });
};

export const updateAvatar = async (req, res, next) => {
  try {
    const { avatar } = req.body;
    if (typeof avatar !== 'string' || avatar.length > 150000 || !AVATAR_RE.test(avatar)) {
      return res.status(400).json({ message: 'Upload a valid png, jpeg or webp image' });
    }
    req.sme.avatar = avatar;
    await req.sme.save();
    res.json({ sme: publicSme(req.sme) });
  } catch (err) {
    next(err);
  }
};
