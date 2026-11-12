import { generateMeetingLink } from './momHelpers.js';

// Creates a real Google Calendar event with a Google Meet link on the calendar that Grain is connected to.
// Grain only records meetings it sees on that calendar, so this is what makes automatic recording work.
const TZ = process.env.MEETING_TZ || 'Asia/Kolkata';
const DURATION_MIN = Math.max(15, Number(process.env.MEETING_DURATION_MIN) || 60);

export const googleClientReady = () => Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

const redirectUri = () => process.env.GOOGLE_REDIRECT_URI || `${process.env.PUBLIC_API_URL || `http://localhost:${process.env.PORT || 5000}`}/api/integrations/google/callback`;

const tokenCache = new Map(); // refresh token -> { token, exp }
export const exchangeRefreshToken = async (refreshToken) => {
  const hit = tokenCache.get(refreshToken);
  if (hit && Date.now() < hit.exp - 60000) return hit.token;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
    signal: AbortSignal.timeout(15000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) throw new Error(`Google sign-in failed (${data.error || res.status})`);
  tokenCache.set(refreshToken, { token: data.access_token, exp: Date.now() + (data.expires_in || 3600) * 1000 });
  return data.access_token;
};

// "Connect Google Calendar" for one person: send them to this URL, Google calls back with ?code=...
export const googleAuthUrl = (state) =>
  'https://accounts.google.com/o/oauth2/v2/auth?' +
  new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/calendar.events',
    access_type: 'offline',
    prompt: 'consent',
    state,
  });

export const exchangeCode = async (code) => {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri(),
      grant_type: 'authorization_code',
    }),
    signal: AbortSignal.timeout(15000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.refresh_token) throw new Error(`Google did not return a refresh token (${data.error || res.status})`);
  return data.refresh_token;
};

// 'YYYY-MM-DD' + 'HH:mm' + minutes -> local 'YYYY-MM-DDTHH:mm:00' (no timezone shifting; the TZ is sent separately).
const addMinutes = (date, time, mins) => {
  const d = new Date(`${date}T${time}:00Z`);
  d.setUTCMinutes(d.getUTCMinutes() + mins);
  return d.toISOString().slice(0, 19);
};

// Returns { link, calendar: { eventId, iCalUID, htmlLink } | undefined, source: 'google' | 'jitsi' }.
// Falls back to a Jitsi room if Google isn't set up or the call fails, so scheduling never breaks.
export const createMeetingLink = async ({ subject, date, time, attendees = [], description = '', refreshToken }) => {
  if (!googleClientReady() || !refreshToken) return { link: generateMeetingLink(subject), source: 'jitsi' };
  try {
    const token = await exchangeRefreshToken(refreshToken);
    const calId = encodeURIComponent(process.env.GOOGLE_CALENDAR_ID || 'primary');
    const who = attendees.map((a) => `${a.name}${a.designation ? ` (${a.designation})` : ''}`).join(', ');
    const body = {
      summary: subject,
      description: [description, who && `Attendees: ${who}`].filter(Boolean).join('\n'),
      start: { dateTime: `${date}T${time}:00`, timeZone: TZ },
      end: { dateTime: addMinutes(date, time, DURATION_MIN), timeZone: TZ },
      conferenceData: {
        createRequest: { requestId: `mtg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, conferenceSolutionKey: { type: 'hangoutsMeet' } },
      },
    };
    const url = `https://www.googleapis.com/calendar/v3/calendars/${calId}/events?conferenceDataVersion=1&sendUpdates=none`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });
    const ev = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(ev?.error?.message || `Google Calendar ${res.status}`);
    const meet = ev.hangoutLink || ev.conferenceData?.entryPoints?.find((e) => e.entryPointType === 'video')?.uri;
    if (!meet) throw new Error('Google did not return a Meet link');
    return { link: meet, source: 'google', calendar: { eventId: ev.id, iCalUID: ev.iCalUID || '', htmlLink: ev.htmlLink || '' } };
  } catch (err) {
    console.error('Google Calendar error, using a Jitsi link instead:', err.message);
    return { link: generateMeetingLink(subject), source: 'jitsi' };
  }
};
