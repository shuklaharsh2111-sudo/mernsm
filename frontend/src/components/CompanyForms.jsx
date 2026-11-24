import { useCallback, useEffect, useState } from 'react';
import { Mail, Send, Eye, Trash2, ChevronDown, Users, Phone, FileText } from 'lucide-react';
import api from '../api';
import { CompanyBadge } from './CompanyBadge';
import { SendFormModal, ViewFormModal, StatusPill, fmtStamp } from './FormModals';
import { errMsg } from '../sopUtils';
import '../style.css';
import '../styles/forms.css';

// SME / SMI page: every company assigned to me with its details, a "Send form" button,
// and the forms I already sent with a "View submitted form" button once the company has answered.
export default function CompanyForms({ workspace }) {
  const [companies, setCompanies] = useState(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(''); // company whose form list is expanded
  const [formsBy, setFormsBy] = useState({}); // companyId -> forms
  const [sending, setSending] = useState(null); // company
  const [viewing, setViewing] = useState(null); // { formId }

  const loadCompanies = useCallback(() => api.get('/forms/companies')
    .then((res) => setCompanies(res.data.companies))
    .catch((e) => setError(errMsg(e))), []);

  const loadForms = useCallback((id) => api.get(`/forms/companies/${id}/forms`)
    .then((res) => setFormsBy((m) => ({ ...m, [id]: res.data.forms })))
    .catch((e) => setError(errMsg(e))), []);

  useEffect(() => { loadCompanies(); }, [loadCompanies]);
  // pick up a form the company has just completed without a manual refresh
  useEffect(() => {
    const t = setInterval(() => { loadCompanies(); if (open) loadForms(open); }, 30000);
    const onFocus = () => { loadCompanies(); if (open) loadForms(open); };
    window.addEventListener('focus', onFocus);
    return () => { clearInterval(t); window.removeEventListener('focus', onFocus); };
  }, [loadCompanies, loadForms, open]);

  const toggle = (id) => {
    if (open === id) return setOpen('');
    setOpen(id);
    return loadForms(id);
  };

  const remove = async (companyId, formId) => {
    if (!window.confirm('Delete this form?')) return;
    try {
      await api.delete(`/forms/${formId}`);
      await Promise.all([loadForms(companyId), loadCompanies()]);
    } catch (e) {
      setError(errMsg(e));
    }
  };

  return (
    <div className="dashboard-content scrollable fm-page">
      <div className="page-header">
        <div>
          <span className="page-label">{workspace}</span>
          <h1>Companies</h1>
          <p>Details of every company assigned to you. Send the onboarding form and see what they submit.</p>
        </div>
      </div>

      {error && <p className="error-message" role="alert">{error}</p>}
      {companies === null && !error && <p className="muted">Loading…</p>}
      {companies && companies.length === 0 && <p className="muted">No companies are assigned to you yet.</p>}

      <div className="fm-grid">
        {(companies || []).map((c) => {
          const forms = formsBy[c.id];
          return (
            <article key={c.id} className="fm-card">
              <header className="fm-card-head">
                <CompanyBadge company={c} size={56} />
                <div className="fm-card-title">
                  <h2>{c.name}</h2>
                  {c.email
                    ? <a href={`mailto:${c.email}`} className="fm-line"><Mail size={13} /> {c.email}</a>
                    : <span className="fm-line muted"><Mail size={13} /> No company email</span>}
                </div>
              </header>

              <div className="fm-section">
                <span className="fm-label"><Users size={13} /> Company contact{c.clients.length === 1 ? '' : 's'}</span>
                {c.clients.length === 0 ? <p className="muted fm-small">No login account is linked to this company yet.</p> : (
                  <ul className="fm-contacts">
                    {c.clients.map((cl) => (
                      <li key={cl.id}>
                        <b>{cl.name}</b>
                        <a href={`mailto:${cl.email}`} className="fm-line"><Mail size={12} /> {cl.email}</a>
                        {cl.contact && <span className="fm-line"><Phone size={12} /> {cl.contact}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="fm-section">
                <span className="fm-label"><FileText size={13} /> Onboarding form</span>
                {c.latest ? (
                  <div className="fm-onb">
                    <div className="fm-form-text">
                      <StatusPill status={c.latest.status} />
                      <small>Filled by {c.latest.contactPerson || 'the company'} · {fmtStamp(c.latest.submittedAt)}</small>
                    </div>
                    <button type="button" className="btn-ghost" onClick={() => setViewing({ formId: c.latest.formId })}><Eye size={14} /> View submitted form</button>
                  </div>
                ) : <p className="muted fm-small">This company has not completed the onboarding form yet.</p>}
              </div>

              <div className="fm-counts">
                <span><b>{c.forms.pending}</b> waiting</span>
                <span><b>{c.forms.submitted}</b> completed</span>
              </div>

              <div className="fm-actions">
                <button type="button" className="btn-primary" onClick={() => setSending(c)} disabled={c.clients.length === 0} title={c.clients.length === 0 ? 'This company has no login account to receive forms' : 'Send the onboarding form to this company'}>
                  <Send size={15} /> Send form
                </button>
                <button type="button" className="btn-ghost" onClick={() => toggle(c.id)} aria-expanded={open === c.id}>
                  <FileText size={15} /> Forms <ChevronDown size={14} className={open === c.id ? 'fm-flip' : ''} />
                </button>
              </div>

              {open === c.id && (
                <div className="fm-forms">
                  {!forms && <p className="muted fm-small">Loading…</p>}
                  {forms && forms.length === 0 && <p className="muted fm-small">You have not sent the onboarding form to this company yet.</p>}
                  {(forms || []).map((f) => (
                    <div key={f.id} className="fm-form-row">
                      <div className="fm-form-text">
                        <b>{f.title}</b>
                        <small>Sent {fmtStamp(f.createdAt)}{f.submittedAt ? ` · completed ${fmtStamp(f.submittedAt)}` : ''}</small>
                        <StatusPill status={f.status} />
                      </div>
                      <div className="fm-form-btns">
                        {f.status !== 'pending'
                          ? <button type="button" className="btn-ghost" onClick={() => setViewing({ formId: f.id })}><Eye size={14} /> View submitted form</button>
                          : <button type="button" className="fm-icon-btn" onClick={() => remove(c.id, f.id)} aria-label={`Delete ${f.title}`} title="Delete"><Trash2 size={15} /></button>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </article>
          );
        })}
      </div>

      {sending && (
        <SendFormModal
          company={sending}
          onClose={() => setSending(null)}
          onSent={() => {
            const id = sending.id;
            setSending(null);
            setOpen(id);
            loadForms(id);
            loadCompanies();
          }}
        />
      )}
      {viewing && <ViewFormModal {...viewing} canReview onClose={() => setViewing(null)} onReviewed={() => { loadCompanies(); if (open) loadForms(open); }} />}
    </div>
  );
}
