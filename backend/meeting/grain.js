// Thin client for the Grain public API (https://developers.grain.com).
// Auth: a Personal / Workspace access token sent as a Bearer token.
const BASE = 'https://api.grain.com/_/public-api/v2';
const VERSION = process.env.GRAIN_API_VERSION || '2026-10-01';

const headers = (token, json = true) => ({
  Authorization: `Bearer ${token}`,
  'Public-Api-Version': VERSION,
  ...(json ? { 'Content-Type': 'application/json' } : {}),
});

const call = async (token, path, { method = 'GET', body, text = false } = {}) => {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: headers(token, method !== 'GET'),
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  if (res.status === 429) {
    const wait = res.headers.get('retry-after');
    throw new Error(`Grain rate limit hit${wait ? `, retry after ${wait}s` : ''}`);
  }
  if (!res.ok) throw new Error(`Grain ${method} ${path} -> ${res.status}`);
  return text ? res.text() : res.json();
};

// Recordings that started between two instants (ISO strings), newest page only.
export const listRecordings = async (token, { after, before }) => {
  const data = await call(token, '/recordings', {
    method: 'POST',
    body: { filter: { after_datetime: after, before_datetime: before }, include: { participants: true, calendar_event: true } },
  });
  return data.recordings || [];
};

export const getRecording = (token, id) =>
  call(token, `/recordings/${encodeURIComponent(id)}`, {
    method: 'POST',
    body: { include: { ai_summary: true, ai_action_items: true, participants: true, calendar_event: true } },
  });

export const getTranscriptText = (token, id) => call(token, `/recordings/${encodeURIComponent(id)}/transcript.txt`, { text: true });

// Verifies a token and says whose it is.
export const tokenInfo = (token) => call(token, '/token-info');
