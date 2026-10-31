import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Check, Flag, Send } from 'lucide-react';
import api from '../api';
import { errMsg, fmtDay } from '../sopUtils';
import '../styles/mom.css';

export const PRIORITIES = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

const initials = (name) => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('');

const validate = (meeting, f) => {
  const e = {
    points: f.points.map((p) => (p.trim().length < 2 ? 'Enter the point discussed' : '')),
    steps: f.steps.map((s) => ({
      text: s.text.trim().length < 2 ? 'Enter the next step' : '',
      date: !s.date ? 'Date is required' : s.date < meeting.date ? 'Cannot be before the meeting date' : '',
    })),
    nDate: '', nTime: '', nAgenda: '', nPriority: '',
  };
  if (!f.next.date) e.nDate = 'Date is required';
  else if (f.next.date < meeting.date) e.nDate = 'Must be on or after this meeting';
  if (!f.next.time) e.nTime = 'Time is required';
  else if (f.next.date && `${f.next.date}T${f.next.time}` <= `${meeting.date}T${meeting.time}`) e.nTime = 'Must be after this meeting';
  if (f.next.agenda.trim().length < 3) e.nAgenda = 'Agenda is required';
  if (!f.next.priority) e.nPriority = 'Select a priority';
  return e;
};

const hasErrors = (e) =>
  e.points.some(Boolean) || e.steps.some((s) => s.text || s.date) || e.nDate || e.nTime || e.nAgenda || e.nPriority;

export default function SendMomModal({ meeting, onSaved, onClose }) {
  const saved = meeting.mom;
  const locked = saved?.status === 'approved' || saved?.status === 'rejected'; // final: view-only

  const [form, setForm] = useState(() => ({
    points: saved?.points?.length ? [...saved.points] : [''],
    // true = present (tick), false = absent (cross)
    present: meeting.attendees.map((_, i) => (saved?.attendance?.length === meeting.attendees.length ? saved.attendance[i].present : true)),
    steps: saved?.nextSteps?.length ? saved.nextSteps.map((s) => ({ ...s })) : [{ text: '', date: '' }],
    next: saved?.nextMeeting ? { ...saved.nextMeeting } : { date: '', time: '', agenda: '', priority: '' },
  }));
  const [submitted, setSubmitted] = useState(false);
  const [touched, setTouched] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const errors = useMemo(() => validate(meeting, form), [meeting, form]);
  const valid = !hasErrors(errors);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const touch = (key) => () => setTouched((t) => ({ ...t, [key]: true }));
  const see = (key, msg) => ((submitted || touched[key]) && msg ? msg : '');

  // points
  const setPoint = (i, v) => setForm((f) => ({ ...f, points: f.points.map((p, idx) => (idx === i ? v : p)) }));
  const addPoint = () => setForm((f) => ({ ...f, points: [...f.points, ''] }));
  const removePoint = (i) => setForm((f) => (f.points.length === 1 ? f : { ...f, points: f.points.filter((_, idx) => idx !== i) }));

  // attendance
  const setPresent = (i, v) => setForm((f) => ({ ...f, present: f.present.map((p, idx) => (idx === i ? v : p)) }));

  // next steps
  const setStep = (i, key, v) => setForm((f) => ({ ...f, steps: f.steps.map((s, idx) => (idx === i ? { ...s, [key]: v } : s)) }));
  const addStep = () => setForm((f) => ({ ...f, steps: [...f.steps, { text: '', date: '' }] }));
  const removeStep = (i) => setForm((f) => (f.steps.length === 1 ? f : { ...f, steps: f.steps.filter((_, idx) => idx !== i) }));

  // next meeting
  const setNext = (key, v) => setForm((f) => ({ ...f, next: { ...f.next, [key]: v } }));

  const submit = async (e) => {
    e.preventDefault();
    if (locked) return;
    setSubmitted(true);
    if (!valid) return;
    setBusy(true);
    setError('');
    try {
      const res = await api.put(`/sme/meetings/${meeting.id}/mom`, {
        points: form.points.map((p) => p.trim()),
        present: form.present,
        nextSteps: form.steps.map((s) => ({ text: s.text.trim(), date: s.date })),
        nextMeeting: { ...form.next, agenda: form.next.agenda.trim() },
      });
      onSaved(res.data.meeting);
    } catch (err) {
      setError(errMsg(err));
      setBusy(false);
    }
  };

  const presentCount = form.present.filter(Boolean).length;

  return createPortal(
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal-card wide mom-modal" role="dialog" aria-modal="true" aria-labelledby="mom-title" onSubmit={submit} noValidate>
        <div className="modal-head">
          <h2 id="mom-title">Minutes of Meeting</h2>
          <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="modal-body meeting-form">
          <p className="mom-meta">
            <b>{meeting.subject}</b> · {meeting.company.name} · {fmtDay(meeting.date)}, {meeting.time}
          </p>

          {saved?.status === 'pending' && <div className="mom-banner pending">Waiting for admin approval. You can still edit and resubmit.</div>}
          {saved?.status === 'sent_back' && (
            <div className="mom-banner rejected">
              The admin sent this back for changes{saved.reviewNote ? `: ${saved.reviewNote}` : '.'} Update it and submit again.
            </div>
          )}
          {saved?.status === 'approved' && <div className="mom-banner approved">Approved by admin and saved in Records. This MOM is read-only.</div>}
          {saved?.status === 'rejected' && (
            <div className="mom-banner rejected">Rejected by admin{saved.reviewNote ? `: ${saved.reviewNote}` : '.'} This decision is final.</div>
          )}

          <fieldset className="mom-fieldset" disabled={locked || busy}>
            {/* 1. Points discussed */}
            <section className="mom-section">
              <div className="attendee-head">
                <span>Points Discussed <em className="req">*</em></span>
                <button type="button" className="attendee-add" title="Add point" aria-label="Add point" onClick={addPoint}>
                  <Plus size={16} />
                </button>
              </div>
              {form.points.map((p, i) => (
                <div className="attendee-block" key={i}>
                  <div className="mom-row point">
                    <span className="mom-num">{i + 1}</span>
                    <input
                      type="text"
                      className={see(`p-${i}`, errors.points[i]) ? 'invalid' : ''}
                      value={p}
                      maxLength={1000}
                      placeholder="Point discussed"
                      aria-label={`Point ${i + 1}`}
                      onChange={(e) => setPoint(i, e.target.value)}
                      onBlur={touch(`p-${i}`)}
                    />
                    <button type="button" className="attendee-remove" aria-label={`Remove point ${i + 1}`} disabled={form.points.length === 1} onClick={() => removePoint(i)}>
                      <X size={14} />
                    </button>
                  </div>
                  {see(`p-${i}`, errors.points[i]) && <small className="field-error">{errors.points[i]}</small>}
                </div>
              ))}
            </section>

            {/* 2. Attendance */}
            <section className="mom-section">
              <div className="attendee-head">
                <span>Attendance</span>
                <span className="muted">{presentCount} of {meeting.attendees.length} present</span>
              </div>
              {meeting.attendees.map((a, i) => (
                <div className={`mom-attendee ${form.present[i] ? '' : 'absent'}`} key={i}>
                  <span className="avatar mom-avatar">{initials(a.name)}</span>
                  <div className="mom-attendee-text">
                    <b>{a.name}</b>
                    <span className="muted">{a.designation}</span>
                  </div>
                  <div className="mom-attend-toggle" role="group" aria-label={`Attendance of ${a.name}`}>
                    <button
                      type="button"
                      className={`present ${form.present[i] ? 'on' : ''}`}
                      title="Present"
                      aria-label={`${a.name} present`}
                      aria-pressed={form.present[i]}
                      onClick={() => setPresent(i, true)}
                    >
                      <Check size={16} />
                    </button>
                    <button
                      type="button"
                      className={`absent ${form.present[i] ? '' : 'on'}`}
                      title="Absent"
                      aria-label={`${a.name} absent`}
                      aria-pressed={!form.present[i]}
                      onClick={() => setPresent(i, false)}
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </section>

            {/* 3. Next steps, with dates */}
            <section className="mom-section">
              <div className="attendee-head">
                <span>Next Steps <em className="req">*</em></span>
                <button type="button" className="attendee-add" title="Add next step" aria-label="Add next step" onClick={addStep}>
                  <Plus size={16} />
                </button>
              </div>
              {form.steps.map((s, i) => {
                const et = see(`s-${i}-text`, errors.steps[i].text);
                const ed = see(`s-${i}-date`, errors.steps[i].date);
                return (
                  <div className="attendee-block" key={i}>
                    <div className="mom-row step">
                      <input
                        type="text"
                        className={et ? 'invalid' : ''}
                        value={s.text}
                        maxLength={1000}
                        placeholder="What should be done"
                        aria-label={`Next step ${i + 1}`}
                        onChange={(e) => setStep(i, 'text', e.target.value)}
                        onBlur={touch(`s-${i}-text`)}
                      />
                      <input
                        type="date"
                        className={ed ? 'invalid' : ''}
                        value={s.date}
                        min={meeting.date}
                        aria-label={`Next step ${i + 1} date`}
                        onChange={(e) => setStep(i, 'date', e.target.value)}
                        onBlur={touch(`s-${i}-date`)}
                      />
                      <button type="button" className="attendee-remove" aria-label={`Remove next step ${i + 1}`} disabled={form.steps.length === 1} onClick={() => removeStep(i)}>
                        <X size={14} />
                      </button>
                    </div>
                    {(et || ed) && <small className="field-error">{et || ed}</small>}
                  </div>
                );
              })}
            </section>

            {/* 4. Next meeting schedule */}
            <section className="mom-section">
              <div className="attendee-head"><span>Next Meeting Schedule <em className="req">*</em></span></div>

              <div className="meeting-form-row">
                <label className={`x-field ${see('nDate', errors.nDate) ? 'invalid' : ''}`}>
                  <span>Date</span>
                  <input type="date" value={form.next.date} min={meeting.date} onChange={(e) => setNext('date', e.target.value)} onBlur={touch('nDate')} />
                  {see('nDate', errors.nDate) && <small className="field-error">{errors.nDate}</small>}
                </label>
                <label className={`x-field ${see('nTime', errors.nTime) ? 'invalid' : ''}`}>
                  <span>Time</span>
                  <input type="time" value={form.next.time} onChange={(e) => setNext('time', e.target.value)} onBlur={touch('nTime')} />
                  {see('nTime', errors.nTime) && <small className="field-error">{errors.nTime}</small>}
                </label>
              </div>

              <label className={`x-field ${see('nAgenda', errors.nAgenda) ? 'invalid' : ''}`}>
                <span>Agenda</span>
                <input type="text" value={form.next.agenda} maxLength={500} placeholder="Agenda of the next meeting" onChange={(e) => setNext('agenda', e.target.value)} onBlur={touch('nAgenda')} />
                {see('nAgenda', errors.nAgenda) && <small className="field-error">{errors.nAgenda}</small>}
              </label>

              <div className="x-field">
                <span>Priority</span>
                <div className="priority-group" role="radiogroup" aria-label="Priority">
                  {PRIORITIES.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      role="radio"
                      aria-checked={form.next.priority === p.value}
                      className={`priority-btn ${p.value} ${form.next.priority === p.value ? 'on' : ''}`}
                      onClick={() => { setNext('priority', p.value); touch('nPriority')(); }}
                    >
                      <Flag size={14} /> {p.label}
                    </button>
                  ))}
                </div>
                {see('nPriority', errors.nPriority) && <small className="field-error">{errors.nPriority}</small>}
              </div>
            </section>
          </fieldset>

          {error && <p className="error-message" role="alert">{error}</p>}
        </div>

        <div className="modal-foot">
          <button type="button" className="btn-ghost" onClick={onClose}>{locked ? 'Close' : 'Cancel'}</button>
          {!locked && (
            <button type="submit" className="btn-primary" disabled={busy || !valid} title={valid ? '' : 'Fill in all required fields'}>
              <Send size={14} style={{ marginRight: 6, verticalAlign: '-2px' }} />
              {busy ? 'Submitting…' : saved ? 'Resubmit for Approval' : 'Submit for Approval'}
            </button>
          )}
        </div>
      </form>
    </div>,
    document.body
  );
}
