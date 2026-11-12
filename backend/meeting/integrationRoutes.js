import jwt from 'jsonwebtoken';
import GrainAccount from './GrainAccount.js';
import { encrypt, resolveAccount, statusView } from './accounts.js';
import { tokenInfo } from './grain.js';
import { exchangeRefreshToken, googleAuthUrl, exchangeCode, googleClientReady } from './googleCalendar.js';

// "Connect my Grain / Google account" endpoints, mounted on every role's router (sme, admin, ...).
// GET    /integrations                 -> status (never returns tokens)
// PUT    /integrations/grain           -> { token }  verified against Grain, then saved encrypted
// DELETE /integrations/grain
// GET    /integrations/google/start    -> { url }    send the browser there to connect Google Calendar
// DELETE /integrations/google
export const mountIntegrationRoutes = (router) => {
  const me = (req) => ({ userId: req.user.id, role: req.user.role });
  const status = async (req) => ({ ...statusView(await resolveAccount(req.user.id, req.user.role)), googleReady: googleClientReady() });

  router.get('/integrations', async (req, res) => res.json(await status(req)));

  router.put('/integrations/grain', async (req, res) => {
    const token = String(req.body?.token || '').trim();
    if (token.length < 10) return res.status(400).json({ message: 'Paste your Grain access token' });
    let info;
    try {
      info = await tokenInfo(token);
    } catch (err) {
      return res.status(400).json({ message: 'Grain rejected that token. Create a new one in Grain → Settings → Integrations → API.' });
    }
    await GrainAccount.findOneAndUpdate(me(req), { $set: { grainToken: encrypt(token), grainName: info?.name || '' } }, { upsert: true });
    res.json(await status(req));
  });

  router.delete('/integrations/grain', async (req, res) => {
    await GrainAccount.updateOne(me(req), { $set: { grainToken: '', grainName: '' } });
    res.json(await status(req));
  });

  router.get('/integrations/google/start', (req, res) => {
    if (!googleClientReady()) return res.status(400).json({ message: 'Google is not configured on the server (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET)' });
    const state = jwt.sign({ id: req.user.id, role: req.user.role, p: 'google-connect' }, process.env.JWT_SECRET, { expiresIn: '10m' });
    res.json({ url: googleAuthUrl(state) });
  });

  router.delete('/integrations/google', async (req, res) => {
    await GrainAccount.updateOne(me(req), { $set: { googleRefreshToken: '' } });
    res.json(await status(req));
  });
};

// Google redirects the browser here after consent. No cookie auth: the signed `state` says who it is.
export const googleCallback = async (req, res) => {
  const back = (role, flag) => res.redirect(`${process.env.CLIENT_URL || ''}/${role === 'admin' ? 'admin/meetings' : `${role}/settings`}?google=${flag}`);
  let who;
  try {
    who = jwt.verify(String(req.query.state || ''), process.env.JWT_SECRET);
    if (who.p !== 'google-connect') throw new Error('bad state');
  } catch {
    return res.status(400).send('This link expired. Go back to the app and try Connect Google again.');
  }
  try {
    const refresh = await exchangeCode(String(req.query.code || ''));
    await exchangeRefreshToken(refresh); // make sure it actually works
    await GrainAccount.findOneAndUpdate({ userId: who.id, role: who.role }, { $set: { googleRefreshToken: encrypt(refresh) } }, { upsert: true });
    back(who.role, 'connected');
  } catch (err) {
    console.error('Google connect error:', err.message);
    back(who.role, 'failed');
  }
};
