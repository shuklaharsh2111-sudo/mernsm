import express from 'express';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import cloudinary from '../config/cloudinary.js';
import { protect } from '../auth.js';
import { roleModels } from '../admin/UserModels.js';

// Profile settings (name, photo, password) for EVERY signed-in role.
// The SME panel keeps its own /api/sme/profile; admin, des, smi, hr and the rest use this one.
const router = express.Router();
router.use(protect([]));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimetype)) {
      return cb(new Error('Only JPG, PNG, WEBP and GIF images are allowed'));
    }
    cb(null, true);
  }
});

const uploadToCloudinary = (buffer, folder = 'creative-manager/avatars') =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder, resource_type: 'image' }, (error, result) => {
      if (error) return reject(error);
      resolve(result);
    });
    stream.end(buffer);
  });

const profileView = (u, role) => ({
  id: u._id,
  name: u.name || u.fullname || u.email,
  email: u.email,
  avatar: u.avatar || u.profileImage || '',
  role
});

// Pick the right collection for the logged-in user's role.
const modelFor = (req, res) => {
  const Model = roleModels[req.user.role];
  if (!Model) {
    res.status(403).json({ message: 'Invalid role' });
    return null;
  }
  return Model;
};

router.get('/profile', async (req, res) => {
  try {
    const Model = modelFor(req, res);
    if (!Model) return;
    const me = await Model.findById(req.user.id).lean();
    if (!me) return res.status(401).json({ message: 'User not found' });
    res.json({ user: profileView(me, req.user.role) });
  } catch (error) {
    console.error('Fetch profile error:', error);
    res.status(500).json({ message: 'Unable to load profile' });
  }
});

// Change name and/or profile image. multipart/form-data: name, avatar (file), removeAvatar ('true' to delete it).
router.put('/profile', (req, res) => {
  upload.single('avatar')(req, res, async (uploadError) => {
    if (uploadError) return res.status(400).json({ message: uploadError.message });
    let uploaded = null;
    try {
      const Model = modelFor(req, res);
      if (!Model) return;
      const me = await Model.findById(req.user.id).lean();
      if (!me) return res.status(401).json({ message: 'User not found' });

      const changes = {};
      if (req.body.name !== undefined) {
        const name = String(req.body.name).trim();
        if (name.length < 2 || name.length > 60) {
          return res.status(400).json({ message: 'Name must be 2 to 60 characters' });
        }
        changes.name = name;
      }

      const oldPublicId = me.avatarPublicId || '';
      let replaced = false;
      if (req.file) {
        const result = await uploadToCloudinary(req.file.buffer);
        uploaded = result;
        changes.avatar = result.secure_url;
        changes.profileImage = result.secure_url;
        changes.avatarPublicId = result.public_id;
        replaced = true;
      } else if (req.body.removeAvatar === 'true') {
        changes.avatar = '';
        changes.profileImage = '';
        changes.avatarPublicId = '';
        replaced = true;
      }

      // straight to MongoDB so nothing else on the record is validated or touched
      if (Object.keys(changes).length) {
        await Model.collection.updateOne({ _id: me._id }, { $set: changes });
      }
      if (replaced && oldPublicId) cloudinary.uploader.destroy(oldPublicId).catch(() => null);
      res.json({ user: profileView({ ...me, ...changes }, req.user.role), message: 'Profile updated' });
    } catch (error) {
      if (uploaded) cloudinary.uploader.destroy(uploaded.public_id).catch(() => null);
      console.error('Update profile error:', error);
      res.status(500).json({ message: 'Unable to update profile' });
    }
  });
});

router.put('/password', async (req, res) => {
  try {
    const Model = modelFor(req, res);
    if (!Model) return;
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Enter your current and new password' });
    }
    if (typeof newPassword !== 'string' || newPassword.length < 8 || newPassword.length > 72) {
      return res.status(400).json({ message: 'New password must be 8 to 72 characters' });
    }
    const me = await Model.findById(req.user.id).select('+password').lean();
    if (!me || !me.password) return res.status(401).json({ message: 'User not found' });
    if (!(await bcrypt.compare(currentPassword, me.password))) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }
    if (await bcrypt.compare(newPassword, me.password)) {
      return res.status(400).json({ message: 'New password must be different from the current one' });
    }
    const hashed = await bcrypt.hash(newPassword, 10);
    await Model.collection.updateOne({ _id: me._id }, { $set: { password: hashed } });
    res.json({ message: 'Password changed' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Unable to change password' });
  }
});

export default router;
