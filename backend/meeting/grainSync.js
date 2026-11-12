import Meeting from './Meeting.js';
import { listRecordings, getRecording, getTranscriptText } from './grain.js';
import { resolveAccount } from './accounts.js';

const MIN = 60 * 1000;
const SETTLE_MS = 3 * MIN; // wait a little after Join before the first look
const GIVE_UP_AFTER_MS = 8 * 60 * MIN; // stop polling 8 hours after joining
const WINDOW_BEFORE_MS = 20 * MIN; // Grain may start recording a bit before/after the Join click
const WINDOW_AFTER_MS = 90 * MIN;
const MAX_TRANSCRIPT_CHARS = 200000;

const asDate = (v) => (v ? new Date(v) : undefined);

// Pick the recording that best belongs to this meeting: started closest to the Join click,
// preferring one recorded on Google Meet and one the SME recorded.
const pickRecording = (list, meeting, emails) => {
  const anchor = new Date(meeting.joinedAt).getTime();
  const mine = new Set((emails || []).filter(Boolean).map((e) => String(e).toLowerCase()));
  // Exact match: the recording is linked to the Google Calendar event this app created.
  const uid = meeting.calendar?.iCalUID;
  const exact = uid && list.find((r) => r.calendar_event?.ical_uid === uid);
  if (exact) return exact;
  const scored = list
    .map((r) => {
      const gap = Math.abs(new Date(r.start_datetime).getTime() - anchor);
      let penalty = gap;
      if (r.source && r.source !== 'meet' && r.source !== 'local_capture') penalty += 30 * MIN;
      if ((r.recorders || []).some((x) => mine.has(String(x.email || '').toLowerCase()))) penalty -= 10 * MIN;
      return { r, penalty };
    })
    .sort((a, b) => a.penalty - b.penalty);
  return scored[0]?.r || null;
};

const actionItemsOf = (rec) =>
  (rec.ai_action_items || []).map((a) => ({
    text: String(a.text || '').trim(),
    assignee: a.assignee?.name || '',
    status: a.status || 'pending',
  })).filter((a) => a.text);

// Look for the recording of one meeting and save whatever Grain has. Returns the updated meeting.
export const syncMeetingRecording = async (meeting) => {
  if (!meeting.joinedAt) throw new Error('Join the meeting first');

  // Whose Grain? The person who owns this meeting (their own account, or the shared test account).
  const account = await resolveAccount(meeting.user?._id || meeting.user, 'sme');
  if (!account.grainToken) throw new Error('No Grain account connected. Connect yours in Settings.');
  const token = account.grainToken;

  const rec = meeting.recording || {};
  rec.account = account.grainSource;
  rec.attempts = (rec.attempts || 0) + 1;
  rec.lastCheckedAt = new Date();
  rec.lastError = '';
  rec.status = rec.status === 'ready' ? 'ready' : 'pending';

  try {
    let grainId = rec.grainId;
    if (!grainId) {
      const joined = new Date(meeting.joinedAt).getTime();
      const list = await listRecordings(token, {
        after: new Date(joined - WINDOW_BEFORE_MS).toISOString(),
        before: new Date(joined + WINDOW_AFTER_MS).toISOString(),
      });
      await meeting.populate('user', 'email');
      const match = pickRecording(list, meeting, [meeting.user?.email, account.defaultEmail]);
      if (match) grainId = match.id;
    }

    if (grainId) {
      const full = await getRecording(token, grainId);
      rec.grainId = full.id;
      rec.url = full.url || rec.url || '';
      rec.thumbnailUrl = full.thumbnail_url || '';
      rec.title = full.title || '';
      rec.startedAt = asDate(full.start_datetime);
      rec.durationMs = full.duration_ms || 0;
      const summary = String(full.ai_summary?.text || '').trim();
      rec.actionItems = actionItemsOf(full);
      // Grain finishes the summary a few minutes after the call ends; keep polling until it's there.
      if (summary) {
        rec.summary = summary;
        try {
          rec.transcript = String(await getTranscriptText(token, grainId)).slice(0, MAX_TRANSCRIPT_CHARS);
        } catch {
          /* the transcript is a bonus, never block saving the summary */
        }
        rec.status = 'ready';
        rec.savedAt = new Date();
      }
    }
  } catch (err) {
    rec.lastError = String(err.message || err).slice(0, 300);
  }

  if (rec.status !== 'ready' && Date.now() - new Date(meeting.joinedAt).getTime() > GIVE_UP_AFTER_MS) {
    rec.status = 'failed';
  }
  meeting.recording = rec;
  await meeting.save();
  return meeting;
};

let running = false;
const pollOnce = async () => {
  if (running) return;
  running = true;
  try {
    const now = Date.now();
    const candidates = await Meeting.find({
      joinedAt: { $lte: new Date(now - SETTLE_MS), $gte: new Date(now - GIVE_UP_AFTER_MS) },
      'recording.status': { $ne: 'ready' },
    })
      .limit(25);
    for (const m of candidates) {
      if (m.recording?.status === 'failed') continue;
      await syncMeetingRecording(m).catch((e) => !e.message.startsWith('No Grain') && console.error('Grain sync error:', e.message));
    }
  } catch (err) {
    console.error('Grain poll error:', err.message);
  } finally {
    running = false;
  }
};

export const startGrainPoller = () => {
  const every = Math.max(60000, Number(process.env.GRAIN_POLL_INTERVAL_MS) || 2 * MIN);
  console.log(`Grain: checking for new recordings every ${Math.round(every / 1000)}s`);
  setTimeout(pollOnce, 15000);
  setInterval(pollOnce, every);
};
