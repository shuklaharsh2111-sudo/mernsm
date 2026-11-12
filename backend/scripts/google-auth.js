// One-time helper: gets the GOOGLE_REFRESH_TOKEN for the Google account that Grain is connected to.
// Run:  node scripts/google-auth.js   (needs GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env)
// The OAuth client must be type "Desktop app" in Google Cloud Console with the Calendar API enabled.
import 'dotenv/config';
import http from 'http';
import { exec } from 'child_process';

const { GOOGLE_CLIENT_ID: id, GOOGLE_CLIENT_SECRET: secret } = process.env;
if (!id || !secret) {
  console.error('Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in backend/.env first.');
  process.exit(1);
}
const PORT = 53682;
const redirect = `http://127.0.0.1:${PORT}`;
const authUrl =
  'https://accounts.google.com/o/oauth2/v2/auth?' +
  new URLSearchParams({
    client_id: id,
    redirect_uri: redirect,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/calendar.events',
    access_type: 'offline',
    prompt: 'consent',
  });

const server = http.createServer(async (req, res) => {
  const code = new URL(req.url, redirect).searchParams.get('code');
  if (!code) return res.end('Waiting for Google…');
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: id, client_secret: secret, redirect_uri: redirect, grant_type: 'authorization_code' }),
  });
  const data = await r.json();
  res.end(data.refresh_token ? 'Done! You can close this tab and go back to the terminal.' : 'No refresh token returned. Check the terminal.');
  if (data.refresh_token) console.log(`\nAdd this to backend/.env:\n\nGOOGLE_REFRESH_TOKEN=${data.refresh_token}\n`);
  else console.error('Google did not return a refresh token:', data);
  server.close();
});
server.listen(PORT, '127.0.0.1', () => {
  console.log('Open this URL and sign in with the Google account that Grain is connected to:\n\n' + authUrl + '\n');
  const open = process.platform === 'win32' ? 'start ""' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  exec(`${open} "${authUrl}"`, () => {});
});
