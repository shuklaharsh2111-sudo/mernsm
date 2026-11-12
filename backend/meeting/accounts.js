import crypto from 'crypto';
import GrainAccount from './GrainAccount.js';

// ---- encryption for stored tokens (AES-256-GCM, key from GRAIN_ENCRYPTION_KEY or JWT_SECRET) ----
const key = () => crypto.createHash('sha256').update(process.env.GRAIN_ENCRYPTION_KEY || process.env.JWT_SECRET || 'dev-only').digest();
export const encrypt = (plain) => {
  if (!plain) return '';
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([c.update(String(plain), 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString('base64')).join('.');
};
export const decrypt = (blob) => {
  if (!blob) return '';
  try {
    const [iv, tag, enc] = blob.split('.').map((p) => Buffer.from(p, 'base64'));
    const d = crypto.createDecipheriv('aes-256-gcm', key(), iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(enc), d.final()]).toString('utf8');
  } catch {
    return '';
  }
};

// While testing, everyone can share one Grain/Google account from .env.
// Set GRAIN_USE_DEFAULT_ACCOUNT=false once every person has connected their own.
const defaultsOn = () => String(process.env.GRAIN_USE_DEFAULT_ACCOUNT ?? 'true').toLowerCase() !== 'false';

// Which Grain token + Google refresh token to use for this person's meetings.
// Each part falls back to the shared test account independently.
export const resolveAccount = async (userId, role = 'sme') => {
  const own = userId ? await GrainAccount.findOne({ userId, role }).lean() : null;
  const ownGrain = decrypt(own?.grainToken);
  const ownGoogle = decrypt(own?.googleRefreshToken);
  const useDefault = defaultsOn();
  const grainToken = ownGrain || (useDefault ? process.env.GRAIN_API_TOKEN || '' : '');
  const googleRefreshToken = ownGoogle || (useDefault ? process.env.GOOGLE_REFRESH_TOKEN || '' : '');
  return {
    grainToken,
    googleRefreshToken,
    grainSource: ownGrain ? 'own' : grainToken ? 'default' : 'none',
    googleSource: ownGoogle ? 'own' : googleRefreshToken ? 'default' : 'none',
    grainName: own?.grainName || '',
    defaultEmail: process.env.GRAIN_DEFAULT_ACCOUNT_EMAIL || '',
  };
};

export const statusView = (a) => ({
  grain: { source: a.grainSource, connected: a.grainSource !== 'none', name: a.grainSource === 'own' ? a.grainName : '' },
  google: { source: a.googleSource, connected: a.googleSource !== 'none' },
  sharedAccountEmail: a.defaultEmail,
});
