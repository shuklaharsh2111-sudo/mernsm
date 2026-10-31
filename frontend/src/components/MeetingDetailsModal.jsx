
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Flag, CalendarDays, Link2 } from 'lucide-react';
import api from '../api';
import { errMsg, fmtDay, fmtClock } from '../sopUtils';
import '../styles/mom.css';

const initials = (name) => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('');
const AVATAR_COLORS = ['#7c5cff', '#2bb3a3', '#e0709a', '#e69b3a', '#4f8cff', '#8f6bd6'];
const avatarColor = (name) => AVATAR_COLORS[[...name].reduce((n, ch) => n + ch.charCodeAt(0), 0) % AVATAR_COLORS.length];
const blank = () => ({ name: '', designation: '' });
const norm = (a) => `${a.name.trim().toLowerCase()}|${a.designation.trim().toLowerCase()}`;

// Meeting details. More attendees can be added until the MOM is submitted.
export default function MeetingDetailsModal({ meeting, onUpdated, onClose }) {
  const locked = Boolean(meeting.mom); // attendance in the MOM is built from the attendees
  const [rows, setRows] = useState([blank()]);
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [added, setAdded] = useState('');

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

  const errors = useMemo(() => {
    const existing = new Set(meeting.attendees.map(norm));
    const seen = new Set();
    return rows.map((r) => {
      const e = { name: '', designation: '' };
      if (!r.name.trim()) e.name = 'Name is required';
      if (!r.designation.trim()) e.designation = 'Designation is required';
      if (!e.name && !e.designation) {
        const k = norm(r);
        if (existing.has(k) || seen.has(k)) e.name = 'Already an attendee';
        seen.add(k);
      }
      return e;
    });
  }, [rows, meeting.attendees]);
  const valid = errors.every((e) => !e.name && !e.designation);

  const setRow = (i, key, v) => setRows((list) => list.map((r, idx) => (idx === i ? { ...r, [key]: v } : r)));
  const addRow = () => setRows((list) => [...list, blank()]);
  const removeRow = (i) => {
    if (rows.length === 1) return;
    setRows((list) => list.filter((_, idx) => idx !== i));
    setTouched({});
  };
  const touch = (k) => () => setTouched((t) => ({ ...t, [k]: true }));
  const show = (i, key) => (submitted || touched[`${i}-${key}`]) && errors[i][key];

  const save = async (e) => {
    e.preventDefault();
    setSubmitted(true);
    setAdded('');
    if (!valid) return;
    setBusy(true);
    setError('');
    try {
      const res = await api.put(`/sme/meetings/${meeting.id}/attendees`, {
        attendees: rows.map((r) => ({ name: r.name.trim(), designation: r.designation.trim() })),
      });
      onUpdated(res.data.meeting);
      setAdded(`${rows.length} attendee${rows.length > 1 ? 's' : ''} added.`);
      setRows([blank()]);
      setTouched({});
      setSubmitted(false);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal-card wide" role="dialog" aria-modal="true" aria-labelledby="md-title" onSubmit={save} noValidate>
        <div className="modal-head">
          <h2 id="md-title">Meeting Details</h2>
          <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="modal-body meeting-form">
          <div className="md-summary">
            <span className="meeting-company">{meeting.company.name}</span>
            <h3 className="meeting-title">{meeting.subject}</h3>
            <div className="md-facts">
              <span><CalendarDays size={14} /> {fmtDay(meeting.date)}, {fmtClock(meeting.time)}</span>
              {meeting.priority && (
                <span className={`prio-pill ${meeting.priority}`}><Flag size={11} /> {meeting.priority}</span>
              )}
              {meeting.link && (
                <a href={meeting.link} target="_blank" rel="noopener noreferrer" className="md-link"><Link2 size={14} /> Meeting link</a>
              )}
            </div>
          </div>

          <section className="mom-section">
            <div className="attendee-head">
              <span>Attendees ({meeting.attendees.length})</span>
            </div>
            <div className="md-attendees">
              {meeting.attendees.map((a, i) => (
                <div className="md-attendee" key={`${a.name}-${i}`}>
                  <span className="avatar mom-avatar" style={{ background: avatarColor(a.name) }}>{initials(a.name)}</span>
                  <div className="mom-attendee-text">
                    <b>{a.name}</b>
                    <span className="muted">{a.designation}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {locked ? (
            <p className="mom-banner pending">Attendees can’t be changed after the MOM has been submitted.</p>
          ) : (
            <section className="mom-section">
              <div className="attendee-head">
                <span>Add more attendees</span>
                <button type="button" className="attendee-add" title="Add another row" aria-label="Add another attendee row" onClick={addRow}>
                  <Plus size={16} />
                </button>
              </div>

              {rows.map((r, i) => (
                <div className="attendee-block" key={i}>
                  <div className="attendee-row">
                    <input
                      type="text"
                      className={show(i, 'name') ? 'invalid' : ''}
                      value={r.name}
                      maxLength={120}
                      placeholder="Name"
                      aria-label={`New attendee ${i + 1} name`}
                      onChange={(e) => setRow(i, 'name', e.target.value)}
                      onBlur={touch(`${i}-name`)}
                    />
                    <input
                      type="text"
                      className={show(i, 'designation') ? 'invalid' : ''}
                      value={r.designation}
                      maxLength={120}
                      placeholder="Designation"
                      aria-label={`New attendee ${i + 1} designation`}
                      onChange={(e) => setRow(i, 'designation', e.target.value)}
                      onBlur={touch(`${i}-designation`)}
                    />
                    <button type="button" className="attendee-remove" aria-label={`Remove row ${i + 1}`} disabled={rows.length === 1} onClick={() => removeRow(i)}>
                      <X size={14} />
                    </button>
                  </div>
                  {(show(i, 'name') || show(i, 'designation')) && <small className="field-error">{show(i, 'name') || show(i, 'designation')}</small>}
                </div>
              ))}

              {added && <p className="success-message" role="status">{added}</p>}
            </section>
          )}

          {error && <p className="error-message" role="alert">{error}</p>}
        </div>

        <div className="modal-foot">
          <button type="button" className="btn-ghost" onClick={onClose}>Close</button>
          {!locked && (
            <button type="submit" className="btn-primary" disabled={busy || !valid} title={valid ? '' : 'Fill in name and designation'}>
              {busy ? 'Adding…' : 'Add Attendees'}
            </button>
          )}
        </div>
      </form>
    </div>,
    document.body
  );
}
