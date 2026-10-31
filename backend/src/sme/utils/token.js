import jwt from 'jsonwebtoken';

export const signSmeToken = (smeId) =>
  jwt.sign({ id: smeId, role: 'sme' }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
