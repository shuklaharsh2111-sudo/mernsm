import crypto from 'crypto';
import { PRIORITIES } from './Meeting.js';
import { isRealDate } from '../sop/period.js';

// No link entered -> make a ready-to-use Jitsi Meet room (free, no account needed).
export const generateMeetingLink = (subject) => {
  const slug = String(subject || '').replace(/[^a-zA-Z0-9]+/g, '').slice(0, 20) || 'Meeting';
  return `https://meet.jit.si/${slug}-${crypto.randomBytes(5).toString('hex')}`;
};

export const momView = (mom) =>
  mom?.submittedAt
    ? {
        points: [...(mom.points || [])],
        attendance: (mom.attendance || []).map((a) => ({ name: a.name, designation: a.designation || '', present: a.present !== false })),
        nextSteps: (mom.nextSteps || []).map((n) => ({ text: n.text, date: n.date })),
        nextMeeting: mom.nextMeeting
          ? { date: mom.nextMeeting.date, time: mom.nextMeeting.time, agenda: mom.nextMeeting.agenda, priority: mom.nextMeeting.priority }
          : null,
        status: mom.status || 'pending',
        submittedAt: mom.submittedAt,
        reviewedAt: mom.reviewedAt || null,
        reviewNote: mom.reviewNote || '',
      }
    : null;

const clean = (v) => String(v ?? '').trim();

// Validates the MOM body against its meeting. Returns { error } or { mom }.
// body: { points: [string], present: [boolean], nextSteps: [{ text, date }], nextMeeting: { date, time, agenda, priority } }
export const buildMom = (body, meeting) => {
  const fail = (error) => ({ error });

  const points = (Array.isArray(body?.points) ? body.points : []).slice(0, 30).map(clean);
  if (points.length === 0 || points.some((p) => p.length < 2)) return fail('Fill in every point discussed (at least one)');

  const present = Array.isArray(body?.present) ? body.present : [];
  if (present.length !== meeting.attendees.length || present.some((v) => typeof v !== 'boolean')) {
    return fail('Mark every attendee as present or absent');
  }
  const attendance = meeting.attendees.map((a, i) => ({ name: a.name, designation: a.designation || '', present: present[i] }));

  const steps = (Array.isArray(body?.nextSteps) ? body.nextSteps : []).slice(0, 30).map((n) => ({ text: clean(n?.text), date: clean(n?.date) }));
  if (steps.length === 0) return fail('Add at least one next step');
  for (const n of steps) {
    if (n.text.length < 2) return fail('Every next step needs a description');
    if (!isRealDate(n.date)) return fail('Every next step needs a valid date');
    if (n.date < meeting.date) return fail('A next step date cannot be before the meeting date');
  }

  const nm = body?.nextMeeting || {};
  const next = { date: clean(nm.date), time: clean(nm.time), agenda: clean(nm.agenda), priority: clean(nm.priority) };
  if (!isRealDate(next.date)) return fail('Next meeting date is required');
  if (!/^\d{2}:\d{2}$/.test(next.time)) return fail('Next meeting time is required');
  if (`${next.date}T${next.time}` <= `${meeting.date}T${meeting.time}`) return fail('Next meeting must be after this meeting');
  if (next.agenda.length < 3) return fail('Next meeting agenda is required');
  if (!PRIORITIES.includes(next.priority)) return fail('Select a priority for the next meeting');

  return {
    mom: { points, attendance, nextSteps: steps, nextMeeting: next, status: 'pending', submittedAt: new Date(), reviewedAt: undefined, reviewNote: '' },
  };
};
