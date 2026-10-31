import crypto from 'crypto';

// Constant-time comparison so the code can't be guessed by timing.
export const isValidAdminCode = (input) => {
  if (typeof input !== 'string' || !input) return false;
  const hash = (v) => crypto.createHash('sha256').update(v).digest();
  return crypto.timingSafeEqual(hash(input), hash(process.env.ADMIN_SECRET_CODE));
};
