import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Send, Check, Loader2, CheckCheck, Building2, User, Mail, CalendarCheck, Printer } from 'lucide-react';
import api from '../api';
import { errMsg } from '../sopUtils';
import '../style.css';
import '../styles/calendar.css';
import '../styles/calendar-layout.css';
import '../styles/forms.css';
import '../styles/viewform.css';

export const fmtStamp = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : '');

export const StatusPill = ({ status }) => {
  if (status === 'reviewed') return <span className="fm-pill reviewed"><CheckCheck size={11} /> Completed · Reviewed</span>;
  if (status === 'submitted') return <span className="fm-pill submitted"><Check size={11} /> Completed</span>;
  return <span className="fm-pill">Waiting for company</span>;
};

// Shell shared by the pop-ups: same header / scrolling body / footer as the calendar pop-ups.
function Shell({ title, sub, onClose, busy, children, foot, wide = false }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && !busy && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, busy]);
  return createPortal(
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className={`modal-card cx-modal fm-modal${wide ? ' vf-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <div>
            <h2>{title}</h2>
            {sub && <p className="creative-sub">{sub}</p>}
          </div>
          <button type="button" className="modal-close" aria-label="Close" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">{children}</div>
        <div className="modal-foot">{foot}</div>
      </div>
    </div>,
    document.body
  );
}

// SME / SMI: send the onboarding questions link to one company.
export function SendFormModal({ company, onClose, onSent }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [link, setLink] = useState('');

  const send = async () => {
    setError('');
    setBusy(true);
    try {
      const res = await api.post(`/forms/companies/${company.id}/forms`, { note: note.trim() });
      setLink(res.data.form.id);
      onSent(res.data.form);
    } catch (e) {
      setError(errMsg(e));
      setBusy(false);
    }
  };

  return (
    <Shell
      title="Send onboarding form"
      sub={`To ${company.name}${company.email ? ` · ${company.email}` : ''}`}
      onClose={onClose}
      busy={busy}
      foot={(
        <>
          <button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="btn-primary" onClick={send} disabled={busy || !!link}>
            {busy ? <Loader2 size={15} className="fm-spin" /> : <Send size={15} />} Send form
          </button>
        </>
      )}
    >
      <div className="fm-stack">
        <p className="fm-note">
          {company.name} gets the onboarding questions on their dashboard (Forms page) and a notification.
          Their answers show up here once they submit it.
        </p>
        <label className="fm-field">
          <span>Message for the company <em>(optional)</em></span>
          <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder="e.g. Please fill this in so we can start your content plan" />
        </label>
        {error && <p className="error-message" role="alert">{error}</p>}
      </div>
    </Shell>
  );
}

// The submitted onboarding answers, grouped by section (read-only). Reviewers can mark it as reviewed.
export function ViewFormModal({ formId, onClose, canReview = false, onReviewed }) {
  const base = `/forms/${formId}`;
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.get(base)
      .then((res) => !cancelled && setForm(res.data.form))
      .catch((e) => !cancelled && setError(errMsg(e)));
    return () => { cancelled = true; };
  }, [base]);

  const markReviewed = async () => {
    setBusy(true);
    setError('');
    try {
      await api.put(`${base}/reviewed`);
      setForm((f) => ({ ...f, status: 'reviewed' }));
      onReviewed?.();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const sub = form?.submission;
  // keep the sections in the order the questions come in, numbering every answer
  const sections = [];
  (sub?.answers || []).forEach((a, i) => {
    let s = sections.find((x) => x.name === a.section);
    if (!s) { s = { name: a.section, items: [] }; sections.push(s); }
    s.items.push({ ...a, n: i + 1 });
  });
  const total = sub?.answers?.length || 0;

  const jump = (i) => document.getElementById(`vf-sec-${i}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <Shell
      wide
      title={form ? form.title : 'Onboarding form'}
      sub={form ? `${form.companyName} · sent by ${form.senderName || 'your team'} on ${fmtStamp(form.createdAt)}` : ''}
      onClose={onClose}
      busy={busy}
      foot={(
        <>
          {sub && (
            <button type="button" className="btn-ghost vf-print" onClick={() => window.print()}>
              <Printer size={14} /> Print
            </button>
          )}
          {canReview && form && form.status === 'submitted' && (
            <button type="button" className="btn-primary" onClick={markReviewed} disabled={busy}>
              {busy ? <Loader2 size={15} className="fm-spin" /> : <CheckCheck size={15} />} Mark as reviewed
            </button>
          )}
          <button type="button" className="btn-ghost" onClick={onClose}>Close</button>
        </>
      )}
    >
      {error && <p className="error-message" role="alert">{error}</p>}
      {!form && !error && <p className="muted">Loading…</p>}
      {form && (
        <div className="vf">
          <div className="vf-top">
            <StatusPill status={form.status} />
            {sub && <small><CalendarCheck size={13} /> Completed on {fmtStamp(sub.submittedAt)}</small>}
            {sub && <small className="vf-total">{total} answers · {sections.length} sections</small>}
          </div>

          {!sub && <p className="vf-empty">The company has not completed this form yet.</p>}

          {sub && (
            <>
              <div className="vf-who">
                <div className="vf-who-item">
                  <span className="vf-who-icon"><Building2 size={16} /></span>
                  <div><dt>Company</dt><dd>{form.companyName}</dd></div>
                </div>
                <div className="vf-who-item">
                  <span className="vf-who-icon"><User size={16} /></span>
                  <div><dt>Filled by</dt><dd>{sub.contactPerson || '—'}</dd></div>
                </div>
                {sub.email && (
                  <div className="vf-who-item">
                    <span className="vf-who-icon"><Mail size={16} /></span>
                    <div><dt>Email</dt><dd><a href={`mailto:${sub.email}`}>{sub.email}</a></dd></div>
                  </div>
                )}
              </div>

              {form.note && <p className="vf-note"><b>Message sent with the form</b>{form.note}</p>}

              {sections.length > 1 && (
                <nav className="vf-jump" aria-label="Jump to section">
                  {sections.map((s, i) => (
                    <button key={s.name} type="button" onClick={() => jump(i)}>
                      <span>{i + 1}</span>{s.name}
                    </button>
                  ))}
                </nav>
              )}

              {sections.map((s, i) => (
                <section key={s.name} id={`vf-sec-${i}`} className="vf-sec">
                  <header>
                    <span className="vf-sec-num">{i + 1}</span>
                    <h3>{s.name}</h3>
                    <small>{s.items.length} {s.items.length === 1 ? 'answer' : 'answers'}</small>
                  </header>
                  {s.items.map((a) => (
                    <article key={a.questionId} className="vf-qa">
                      <h4><span>Q{a.n}</span>{a.question}</h4>
                      <p>{a.answer}</p>
                    </article>
                  ))}
                </section>
              ))}
            </>
          )}
        </div>
      )}
    </Shell>
  );
}
