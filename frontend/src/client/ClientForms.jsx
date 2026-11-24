import { useCallback, useEffect, useState } from 'react';
import { FileText, Eye } from 'lucide-react';
import api from '../api';
import { OpenFormLink, ViewFormModal, StatusPill, fmtStamp } from '../components/FormModals';
import { errMsg } from '../sopUtils';
import '../style.css';
import '../styles/forms.css';

// Company panel: the onboarding form your SME / SMI sent. Open it to fill it in; once submitted it can be viewed here.
const ClientForms = () => {
  const [forms, setForms] = useState(null);
  const [error, setError] = useState('');
  const [viewing, setViewing] = useState(null); // { formId } | { submissionId }
  const [existing, setExisting] = useState(null); // onboarding answers already in the database

  const load = useCallback(() => api.get('/forms/received')
    .then((res) => { setForms(res.data.forms); setExisting(res.data.onboarding || null); })
    .catch((e) => setError(errMsg(e))), []);

  useEffect(() => { load(); }, [load]);
  // after filling the form in the other tab, coming back here picks up the submission
  useEffect(() => {
    window.addEventListener('focus', load);
    return () => window.removeEventListener('focus', load);
  }, [load]);

  const waiting = (forms || []).filter((f) => f.status === 'pending');
  const done = (forms || []).filter((f) => f.status !== 'pending');

  const row = (f) => (
    <div key={f.id} className="fm-card fm-row">
      <span className="fm-row-icon"><FileText size={18} /></span>
      <div className="fm-form-text">
        <b>{f.title}</b>
        <small>From {f.senderName || 'your team'} · sent {fmtStamp(f.createdAt)}</small>
        {f.note && <small className="fm-row-note">{f.note}</small>}
        <StatusPill status={f.status} />
      </div>
      {f.status === 'pending'
        ? <OpenFormLink url={f.url} />
        : <button type="button" className="btn-ghost" onClick={() => setViewing({ formId: f.id })}><Eye size={14} /> View submitted form</button>}
    </div>
  );

  return (
    <div className="dashboard-content scrollable fm-page">
      <div className="page-header">
        <div>
          <span className="page-label">CLIENT DASHBOARD</span>
          <h1>Forms</h1>
          <p>The onboarding form your social media team sent you. Open it, answer the questions and submit.</p>
        </div>
      </div>

      {error && <p className="error-message" role="alert">{error}</p>}
      {forms === null && !error && <p className="muted">Loading…</p>}
      {forms && forms.length === 0 && !existing && <p className="muted">No forms yet. When your team sends you one it will show up here.</p>}

      {/* answers already on file (submitted before any form was sent from the dashboard) */}
      {existing && done.length === 0 && (
        <section className="fm-list">
          <h3 className="fm-list-title">Submitted (1)</h3>
          <div className="fm-card fm-row">
            <span className="fm-row-icon"><FileText size={18} /></span>
            <div className="fm-form-text">
              <b>Onboarding questions</b>
              <small>Filled by {existing.contactPerson} · {fmtStamp(existing.submittedAt)}</small>
              <StatusPill status={existing.status} />
            </div>
            <button type="button" className="btn-ghost" onClick={() => setViewing({ submissionId: existing.id })}><Eye size={14} /> View submitted form</button>
          </div>
        </section>
      )}

      {waiting.length > 0 && <section className="fm-list"><h3 className="fm-list-title">Waiting for you ({waiting.length})</h3>{waiting.map(row)}</section>}
      {done.length > 0 && <section className="fm-list"><h3 className="fm-list-title">Submitted ({done.length})</h3>{done.map(row)}</section>}

      {viewing && <ViewFormModal {...viewing} onClose={() => setViewing(null)} />}
    </div>
  );
};

export default ClientForms;
