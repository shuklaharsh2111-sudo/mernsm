import { useCallback, useEffect, useState } from 'react';
import { FileText, Eye, PencilLine } from 'lucide-react';
import api from '../api';
import { ViewFormModal, StatusPill, fmtStamp } from '../components/FormModals';
import OnboardingFill from '../components/OnboardingFill';
import { errMsg } from '../sopUtils';
import '../style.css';
import '../styles/forms.css';

// Company panel: the onboarding form your SME / SMI sent. Fill it in right here; once submitted it can be viewed here.
const ClientForms = () => {
  const [forms, setForms] = useState(null);
  const [error, setError] = useState('');
  const [viewing, setViewing] = useState(null); // { formId }
  const [filling, setFilling] = useState(''); // form id being filled in

  const load = useCallback(() => api.get('/forms/received')
    .then((res) => setForms(res.data.forms))
    .catch((e) => setError(errMsg(e))), []);

  useEffect(() => { load(); }, [load]);

  if (filling) {
    return <OnboardingFill formId={filling} onBack={() => setFilling('')} onDone={() => { setFilling(''); load(); }} />;
  }

  const waiting = (forms || []).filter((f) => f.status === 'pending');
  const done = (forms || []).filter((f) => f.status !== 'pending');

  const row = (f) => (
    <div key={f.id} className="fm-card fm-row">
      <span className="fm-row-icon"><FileText size={18} /></span>
      <div className="fm-form-text">
        <b>{f.title}</b>
        <small>From {f.senderName || 'your team'} · sent {fmtStamp(f.createdAt)}{f.submittedAt ? ` · completed ${fmtStamp(f.submittedAt)}` : ''}</small>
        {f.note && <small className="fm-row-note">{f.note}</small>}
        <StatusPill status={f.status} />
      </div>
      {f.status === 'pending'
        ? <button type="button" className="btn-primary" onClick={() => setFilling(f.id)}><PencilLine size={14} /> Fill form</button>
        : <button type="button" className="btn-ghost" onClick={() => setViewing({ formId: f.id })}><Eye size={14} /> View submitted form</button>}
    </div>
  );

  return (
    <div className="dashboard-content scrollable fm-page">
      <div className="page-header">
        <div>
          <span className="page-label">CLIENT DASHBOARD</span>
          <h1>Forms</h1>
          <p>The onboarding form your social media team sent you. Answer the questions and submit.</p>
        </div>
      </div>

      {error && <p className="error-message" role="alert">{error}</p>}
      {forms === null && !error && <p className="muted">Loading…</p>}
      {forms && forms.length === 0 && <p className="muted">No forms yet. When your team sends you one it will show up here.</p>}

      {waiting.length > 0 && <section className="fm-list"><h3 className="fm-list-title">Waiting for you ({waiting.length})</h3>{waiting.map(row)}</section>}
      {done.length > 0 && <section className="fm-list"><h3 className="fm-list-title">Completed ({done.length})</h3>{done.map(row)}</section>}

      {viewing && <ViewFormModal {...viewing} onClose={() => setViewing(null)} />}
    </div>
  );
};

export default ClientForms;
