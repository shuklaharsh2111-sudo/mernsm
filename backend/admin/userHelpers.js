import mongoose from 'mongoose';
import { roleModels } from './UserModels.js';

// Small helpers shared by the admin routes and the super admin routes.
export const validId = (id) => mongoose.Types.ObjectId.isValid(id);
export const userView = (u, collection) => ({
  id: String(u._id),
  name: u.name || u.fullname || u.email,
  email: u.email,
  role: String(u.role || collection).toUpperCase(),
  collection,
  contact: u.contact || '',
  reportingManagerId: u.reportingManagerId ? String(u.reportingManagerId) : '',
  profileImage: u.profileImage || u.avatar || '',
  companies: ['smes', 'smis'].includes(collection) ? (u.companies || []).map(String) : [],
  createdAt: u.createdAt,
  isBanned: !!u.isBanned,
  banReason: u.banReason || '',
  bannedAt: u.bannedAt || null,
  isSuperAdmin: collection === 'admins' && !!u.isSuperAdmin
});
// collection name of a role, e.g. 'sme' -> 'smes'
export const getRoleCollection = (role) => roleModels[role]?.collection?.collectionName || '';
