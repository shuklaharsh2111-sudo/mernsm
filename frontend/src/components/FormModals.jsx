import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Send, Check, Loader2, ExternalLink, CheckCheck } from 'lucide-react';
import api from '../api';
import { errMsg } from '../sopUtils';
import '../style.css';
import '../styles/calendar.css';
import '../styles/calendar-layout.css';
import '../styles/forms.css';

export const fmtStamp = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : '');

export const StatusPill = ({ status }) => {
  if (status === 'reviewed') return <span className="fm-pill reviewed"><CheckCheck size={11} /> Completed · Reviewed</span>;
  if (status === 'submitted') return <span className="fm-pill submitted"><Check size={11} /> Completed</span>;
  return <span className="fm-pill">Waiting for company</span>;
};

// Shell shared by the pop-ups: same header / scrolling body / footer as the calendar pop-ups.
function Shell({ title, sub, onClose, busy, children, foot }) {
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
      <div className="modal-card cx-modal fm-modal" role="dialog" aria-modal="true" aria-label={title}>
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
      setLink(res.data.form.url);
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
          {company.name} gets a notification in their panel with a button that opens the onboarding questions form.
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
// Open it by form id (a form that was sent from here) or by submission id (data already in the database).
export function ViewFormModal({ formId, submissionId, onClose, canReview = false, onReviewed }) {
  const base = submissionId ? `/forms/onboarding/${submissionId}` : `/forms/${formId}`;
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
      setForm((f) => ({ ...f, status: 'reviewed', onboarding: f.onboarding ? { ...f.onboarding, status: 'reviewed' } : f.onboarding }));
      onReviewed?.();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const sub = form?.onboarding;
  // keep the sections in the order the questions come in
  const sections = [];
  (sub?.answers || []).forEach((a) => {
    let s = sections.find((x) => x.name === a.section);
    if (!s) { s = { name: a.section, items: [] }; sections.push(s); }
    s.items.push(a);
  });

  return (
    <Shell
      title={form ? form.title : 'Onboarding form'}
      sub={form ? `${form.companyName}${form.createdAt ? ` · sent by ${form.senderName || 'your team'} on ${fmtStamp(form.createdAt)}` : ''}` : ''}
      onClose={onClose}
      busy={busy}
      foot={(
        <>
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
        <div className="fm-stack">
          <div className="fm-meta">
            <StatusPill status={form.status} />
            {sub && <small>Submitted on {fmtStamp(sub.submittedAt)}</small>}
          </div>
          {!sub && <p className="muted">The company has not completed this form yet.</p>}
          {sub && (
            <>
              <dl className="fm-who">
                <div><dt>Company</dt><dd>{sub.companyName}</dd></div>
                <div><dt>Contact person</dt><dd>{sub.contactPerson}</dd></div>
                <div><dt>Email</dt><dd><a href={`mailto:${sub.email}`}>{sub.email}</a></dd></div>
              </dl>
              {sections.map((s) => (
                <section key={s.name} className="fm-sec">
                  <h3>{s.name}</h3>
                  {s.items.map((a) => (
                    <div key={a.questionId} className="fm-qa">
                      <b>{a.question}</b>
                      <p>{a.answer}</p>
                    </div>
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

// SME / SMI: pick a submitted onboarding form and link it to a company (when it was not matched automatically).
export function LinkSubmissionModal({ company, onClose, onLinked }) {
  const [list, setList] = useState(null);
  const [pick, setPick] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/forms/submissions/unlinked').then((res) => setList(res.data.submissions)).catch((e) => setError(errMsg(e)));
  }, []);

  const link = async () => {
    setBusy(true);
    setError('');
    try {
      await api.post(`/forms/companies/${company.id}/link`, { submissionId: pick });
      onLinked();
    } catch (e) {
      setError(errMsg(e));
      setBusy(false);
    }
  };

  return (
    <Shell
      title="Link a submitted form"
      sub={`For ${company.name}`}
      onClose={onClose}
      busy={busy}
      foot={(
        <>
          <button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="btn-primary" onClick={link} disabled={busy || !pick}>
            {busy ? <Loader2 size={15} className="fm-spin" /> : <Check size={15} />} Link and mark completed
          </button>
        </>
      )}
    >
      <div className="fm-stack">
        <p className="fm-note">These submitted onboarding forms did not match any of your companies by email or name. Pick the one this company filled in.</p>
        {error && <p className="error-message" role="alert">{error}</p>}
        {!list && !error && <p className="muted">Loading…</p>}
        {list && list.length === 0 && <p className="muted">No unmatched submissions found.</p>}
        {(list || []).map((s) => (
          <label key={s.id} className="fm-field" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <input type="radio" name="sub" value={s.id} checked={pick === s.id} onChange={() => setPick(s.id)} />
            <span><b>{s.companyName}</b><br /><small>{s.contactPerson} · {s.email} · {fmtStamp(s.submittedAt)}</small></span>
          </label>
        ))}
      </div>
    </Shell>
  );
}

export const OpenFormLink = ({ url, children = 'Open onboarding form' }) => (
  <a className="btn-primary fm-open" href={url} target="_blank" rel="noreferrer noopener"><ExternalLink size={14} /> {children}</a>
);
