import jwt from 'jsonwebtoken';

export const signToken = (adminId) =>
  jwt.sign({ id: adminId, role: 'admin' }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
