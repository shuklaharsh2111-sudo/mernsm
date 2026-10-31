import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus } from 'lucide-react';
import api from '../api';
import { errMsg, todayStr } from '../sopUtils';

const emptyAttendee = () => ({ name: '', designation: '' });

const nowHHmm = () => {
  const n = new Date();
  const p = (x) => String(x).padStart(2, '0');
  return `${p(n.getHours())}:${p(n.getMinutes())}`;
};

// Returns { subject, company, date, time, link, attendees: [{ name, designation }] } error messages ('' = fine).
const validate = (form, attendees) => {
  const e = { subject: '', company: '', date: '', time: '', link: '', attendees: attendees.map(() => ({ name: '', designation: '' })), attendeesGeneral: '' };

  const subject = form.subject.trim();
  if (!subject) e.subject = 'Subject is required';
  else if (subject.length < 3) e.subject = 'Subject must be at least 3 characters';

  if (!form.company) e.company = 'Please select a company';

  if (!form.date) e.date = 'Date is required';
  else if (form.date < todayStr()) e.date = 'Date cannot be in the past';

  if (!form.time) e.time = 'Time is required';
  else if (form.date === todayStr() && form.time < nowHHmm()) e.time = 'Time cannot be in the past';

  const link = form.link.trim();
  if (link && !/^https?:\/\/\S+\.\S+$/i.test(link)) e.link = 'Enter a valid link starting with http:// or https://';

  attendees.forEach((a, i) => {
    if (!a.name.trim()) e.attendees[i].name = 'Name is required';
    if (!a.designation.trim()) e.attendees[i].designation = 'Designation is required';
  });

  return e;
};

const hasErrors = (e) =>
  Boolean(e.subject || e.company || e.date || e.time || e.link || e.attendees.some((a) => a.name || a.designation));

export default function AddMeetingModal({ companies, onSaved, onClose }) {
  const [form, setForm] = useState({ subject: '', company: '', date: '', time: '', link: '' });
  const [attendees, setAttendees] = useState([emptyAttendee()]);
  const [touched, setTouched] = useState({}); // field key -> true once the user has left it
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const errors = useMemo(() => validate(form, attendees), [form, attendees]);
  const valid = !hasErrors(errors);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; // no page scroll behind the modal
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const show = (key) => (submitted || touched[key]) && errors[key];
  const showAtt = (i, key) => (submitted || touched[`att-${i}-${key}`]) && errors.attendees[i]?.[key];
  const touch = (key) => () => setTouched((t) => ({ ...t, [key]: true }));

  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const setAttendee = (i, key, value) =>
    setAttendees((list) => list.map((a, idx) => (idx === i ? { ...a, [key]: value } : a)));
  const addAttendee = () => setAttendees((list) => [...list, emptyAttendee()]);
  const removeAttendee = (i) => {
    if (attendees.length === 1) return; // at least one attendee is required
    setAttendees((list) => list.filter((_, idx) => idx !== i));
    setTouched((t) => {
      const next = { ...t };
      Object.keys(next).forEach((k) => k.startsWith('att-') && delete next[k]);
      return next;
    });
  };

  const submit = async (e) => {
    e.preventDefault();
    setSubmitted(true);
    if (!valid) return; // can't move forward until everything is filled in
    setBusy(true);
    setError('');
    try {
      const res = await api.post('/sme/meetings', {
        ...form,
        subject: form.subject.trim(),
        link: form.link.trim(),
        attendees: attendees.map((a) => ({ name: a.name.trim(), designation: a.designation.trim() })),
      });
      onSaved(res.data.meeting);
    } catch (err) {
      setError(errMsg(err));
      setBusy(false);
    }
  };

  const cls = (bad) => (bad ? 'invalid' : '');

  // Rendered on <body> so the dashboard's fade-in transform can't trap the fixed overlay.
  return createPortal(
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal-card wide" role="dialog" aria-modal="true" aria-labelledby="meeting-title" onSubmit={submit} noValidate>
        <div className="modal-head">
          <h2 id="meeting-title">Add Meeting</h2>
          <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="modal-body meeting-form">
          <label className={`x-field ${cls(show('subject'))}`}>
            <span>Subject <em className="req">*</em></span>
            <input type="text" value={form.subject} maxLength={200} placeholder="Meeting subject" onChange={setField('subject')} onBlur={touch('subject')} />
            {show('subject') && <small className="field-error">{errors.subject}</small>}
          </label>

          <label className={`x-field ${cls(show('company'))}`}>
            <span>Company <em className="req">*</em></span>
            <select value={form.company} onChange={setField('company')} onBlur={touch('company')}>
              <option value="">Select Company</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {show('company') && <small className="field-error">{errors.company}</small>}
          </label>

          <div className="meeting-form-row">
            <label className={`x-field ${cls(show('date'))}`}>
              <span>Date <em className="req">*</em></span>
              <input type="date" value={form.date} min={todayStr()} onChange={setField('date')} onBlur={touch('date')} />
              {show('date') && <small className="field-error">{errors.date}</small>}
            </label>
            <label className={`x-field ${cls(show('time'))}`}>
              <span>Time <em className="req">*</em></span>
              <input type="time" value={form.time} onChange={setField('time')} onBlur={touch('time')} />
              {show('time') && <small className="field-error">{errors.time}</small>}
            </label>
          </div>

          <label className={`x-field ${cls(show('link'))}`}>
            <span>Meeting Link (optional — auto-generated if left empty)</span>
            <input type="url" value={form.link} maxLength={500} placeholder="Leave empty to auto-generate a link" onChange={setField('link')} onBlur={touch('link')} />
            {show('link') && <small className="field-error">{errors.link}</small>}
          </label>

          <div className="attendee-section">
            <div className="attendee-head">
              <span>Attendees <em className="req">*</em></span>
              <button type="button" className="attendee-add" title="Add attendee" aria-label="Add attendee" onClick={addAttendee}>
                <Plus size={16} />
              </button>
            </div>

            {attendees.map((a, i) => (
              <div className="attendee-block" key={i}>
                <div className="attendee-row">
                  <input
                    type="text"
                    className={cls(showAtt(i, 'name'))}
                    value={a.name}
                    maxLength={120}
                    placeholder="Name"
                    aria-label={`Attendee ${i + 1} name`}
                    onChange={(e) => setAttendee(i, 'name', e.target.value)}
                    onBlur={touch(`att-${i}-name`)}
                  />
                  <input
                    type="text"
                    className={cls(showAtt(i, 'designation'))}
                    value={a.designation}
                    maxLength={120}
                    placeholder="Designation"
                    aria-label={`Attendee ${i + 1} designation`}
                    onChange={(e) => setAttendee(i, 'designation', e.target.value)}
                    onBlur={touch(`att-${i}-designation`)}
                  />
                  <button
                    type="button"
                    className="attendee-remove"
                    title="Remove attendee"
                    aria-label={`Remove attendee ${i + 1}`}
                    disabled={attendees.length === 1}
                    onClick={() => removeAttendee(i)}
                  >
                    <X size={14} />
                  </button>
                </div>
                {(showAtt(i, 'name') || showAtt(i, 'designation')) && (
                  <small className="field-error">{showAtt(i, 'name') || showAtt(i, 'designation')}</small>
                )}
              </div>
            ))}
          </div>

          {error && <p className="error-message" role="alert">{error}</p>}
        </div>

        <div className="modal-foot">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={busy || !valid} title={valid ? '' : 'Fill in all required fields'}>
            {busy ? 'Saving…' : 'Add Meeting'}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}
