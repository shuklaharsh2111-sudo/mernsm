import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Send, Loader2 } from 'lucide-react';
import api from '../api';
import { errMsg } from '../sopUtils';
import '../style.css';
import '../styles/forms.css';

const draftKey = (id) => `onboarding-draft-${id}`;
const readDraft = (id) => {
  try { return JSON.parse(localStorage.getItem(draftKey(id)) || '{}') || {}; } catch { return {}; }
};

// Company panel: the onboarding questions, filled in right on the dashboard.
// The answers are kept as a draft in this browser until the form is submitted.
export default function OnboardingFill({ formId, onBack, onDone }) {
  const [form, setForm] = useState(null);
  const [answers, setAnswers] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.get(`/forms/${formId}`)
      .then((res) => {
        if (cancelled) return;
        setForm(res.data.form);
        setAnswers(readDraft(formId));
      })
      .catch((e) => !cancelled && setError(errMsg(e)));
    return () => { cancelled = true; };
  }, [formId]);

  const questions = form?.questions || [];
  const answered = useMemo(() => questions.filter((q) => (answers[q.id] || '').trim()).length, [questions, answers]);
  const progress = questions.length ? Math.round((answered / questions.length) * 100) : 0;

  const change = (id, value) => {
    setError('');
    setAnswers((prev) => {
      const next = { ...prev, [id]: value };
      try { localStorage.setItem(draftKey(formId), JSON.stringify(next)); } catch { /* draft is optional */ }
      return next;
    });
  };

  const submit = async (e) => {
    e.preventDefault();
    const missing = questions.filter((q) => !(answers[q.id] || '').trim());
    if (missing.length) {
      setError(`Please answer every question. ${missing.length} still empty.`);
      document.getElementById(`fq-${missing[0].id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api.post(`/forms/${formId}/submit`, { answers: questions.map((q) => ({ questionId: q.id, answer: (answers[q.id] || '').trim() })) });
      try { localStorage.removeItem(draftKey(formId)); } catch { /* ignore */ }
      onDone();
    } catch (err) {
      setError(errMsg(err));
      setBusy(false);
    }
  };

  const sections = [];
  questions.forEach((q, i) => {
    let s = sections.find((x) => x.title === q.section);
    if (!s) {
      s = { title: q.section, description: (form.sections || []).find((x) => x.title === q.section)?.description || '', items: [] };
      sections.push(s);
    }
    s.items.push({ ...q, n: i + 1 });
  });

  return (
    <div className="dashboard-content scrollable fm-page fm-fill">
      <button type="button" className="btn-ghost fm-back" onClick={onBack}><ArrowLeft size={14} /> Back to forms</button>

      <div className="page-header">
        <div>
          <span className="page-label">CLIENT DASHBOARD</span>
          <h1>{form?.title || 'Onboarding questions'}</h1>
          <p>{form ? `From ${form.senderName || 'your team'} · ${form.companyName}` : ''}</p>
        </div>
      </div>

      {error && <p className="error-message" role="alert">{error}</p>}
      {!form && !error && <p className="muted">Loading…</p>}
      {form && form.status !== 'pending' && <p className="muted">This form has already been submitted.</p>}

      {form && form.status === 'pending' && (
        <form onSubmit={submit} className="fm-fill-form">
          {form.note && <p className="fm-note">{form.note}</p>}

          <div className="fm-progress" aria-label={`${answered} of ${questions.length} answered`}>
            <div className="fm-progress-bar"><span style={{ width: `${progress}%` }} /></div>
            <small>{answered} of {questions.length} answered</small>
          </div>

          {sections.map((s) => (
            <section key={s.title} className="fm-card fm-fill-sec">
              <header>
                <h2>{s.title}</h2>
                {s.description && <p className="muted">{s.description}</p>}
              </header>
              {s.items.map((q) => (
                <label key={q.id} id={`fq-${q.id}`} className="fm-field">
                  <span><b>{q.n}.</b> {q.question} <i>*</i></span>
                  <textarea rows={4} maxLength={5000} value={answers[q.id] || ''} onChange={(e) => change(q.id, e.target.value)} placeholder="Type your answer…" />
                </label>
              ))}
            </section>
          ))}

          <div className="fm-fill-foot">
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? <Loader2 size={15} className="fm-spin" /> : <Send size={15} />} Submit form
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
