import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Loader2, Send, Cloud } from 'lucide-react';
import api from '../api';
import { errMsg } from '../sopUtils';
import '../style.css';
import '../styles/forms.css';
import '../styles/onboarding.css';

const draftKey = (id) => `onboarding-draft-${id}`;
const readDraft = (id) => {
  try { return JSON.parse(localStorage.getItem(draftKey(id)) || '{}') || {}; } catch { return {}; }
};
const filled = (v) => (v || '').trim().length > 0;
const MAX = 5000;

// Circular progress used in the header.
function Ring({ value }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <div className="ob-ring" role="img" aria-label={`${value}% complete`}>
      <svg viewBox="0 0 64 64" width="64" height="64">
        <defs>
          <linearGradient id="ob-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f26b0f" />
            <stop offset="100%" stopColor="#d92d0a" />
          </linearGradient>
        </defs>
        <circle cx="32" cy="32" r={r} className="ob-ring-track" />
        <circle
          cx="32" cy="32" r={r} className="ob-ring-bar"
          strokeDasharray={c} strokeDashoffset={c - (c * value) / 100}
          transform="rotate(-90 32 32)"
        />
      </svg>
      <span>{value}%</span>
    </div>
  );
}

// Company panel: the onboarding questions, filled in right on the dashboard.
// Answers are kept as a draft in this browser until the form is submitted.
export default function OnboardingFill({ formId, onBack, onDone }) {
  const [form, setForm] = useState(null);
  const [answers, setAnswers] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [saved, setSaved] = useState(false);
  const [flagged, setFlagged] = useState([]); // ids of questions left empty on submit
  const topRef = useRef(null);
  const saveTimer = useRef(null);

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

  useEffect(() => () => clearTimeout(saveTimer.current), []);

  const questions = form?.questions || [];

  const sections = useMemo(() => {
    const out = [];
    questions.forEach((q, i) => {
      let s = out.find((x) => x.title === q.section);
      if (!s) {
        s = {
          title: q.section,
          description: (form.sections || []).find((x) => x.title === q.section)?.description || '',
          items: [],
        };
        out.push(s);
      }
      s.items.push({ ...q, n: i + 1 });
    });
    return out;
  }, [questions, form]);

  const answered = useMemo(() => questions.filter((q) => filled(answers[q.id])).length, [questions, answers]);
  const progress = questions.length ? Math.round((answered / questions.length) * 100) : 0;
  const sectionDone = (s) => s.items.filter((q) => filled(answers[q.id])).length;

  const change = (id, value) => {
    setError('');
    setFlagged((f) => f.filter((x) => x !== id));
    setAnswers((prev) => {
      const next = { ...prev, [id]: value };
      try { localStorage.setItem(draftKey(formId), JSON.stringify(next)); } catch { /* draft is optional */ }
      return next;
    });
    setSaved(true);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => setSaved(false), 1800);
  };

  const grow = (el) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 420)}px`;
  };

  const goTo = (i) => {
    setStep(i);
    requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const submit = async (e) => {
    e.preventDefault();
    const missing = questions.filter((q) => !filled(answers[q.id]));
    if (missing.length) {
      setFlagged(missing.map((q) => q.id));
      setError(`Please answer every question. ${missing.length} still empty.`);
      const idx = sections.findIndex((s) => s.items.some((q) => q.id === missing[0].id));
      setStep(idx);
      setTimeout(() => document.getElementById(`fq-${missing[0].id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60);
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api.post(`/forms/${formId}/submit`, {
        answers: questions.map((q) => ({ questionId: q.id, answer: (answers[q.id] || '').trim() })),
      });
      try { localStorage.removeItem(draftKey(formId)); } catch { /* ignore */ }
      onDone();
    } catch (err) {
      setError(errMsg(err));
      setBusy(false);
    }
  };

  const current = sections[step];
  const isLast = step === sections.length - 1;

  return (
    <div className="dashboard-content scrollable fm-page ob-page">
      <button type="button" className="btn-ghost fm-back" onClick={onBack}><ArrowLeft size={14} /> Back to forms</button>

      <header className="ob-hero" ref={topRef}>
        <div className="ob-hero-text">
          <span className="page-label">CLIENT DASHBOARD · ONBOARDING</span>
          <h1>{form?.title || 'Onboarding questions'}</h1>
          <p>{form ? `From ${form.senderName || 'your team'} · ${form.companyName}` : ''}</p>
          {form?.note && <p className="ob-note">{form.note}</p>}
        </div>
        {form && form.status === 'pending' && (
          <div className="ob-hero-side">
            <Ring value={progress} />
            <div className="ob-hero-stat">
              <b>{answered}<small> / {questions.length}</small></b>
              <span>answered</span>
              <em className={`ob-saved ${saved ? 'on' : ''}`}><Cloud size={12} /> Draft saved</em>
            </div>
          </div>
        )}
      </header>

      {error && <p className="error-message" role="alert">{error}</p>}
      {!form && !error && <p className="muted">Loading…</p>}
      {form && form.status !== 'pending' && <p className="muted">This form has already been submitted.</p>}

      {form && form.status === 'pending' && current && (
        <form onSubmit={submit} className="ob-layout" noValidate>
          <nav className="ob-steps" aria-label="Form sections">
            {sections.map((s, i) => {
              const d = sectionDone(s);
              const complete = d === s.items.length;
              return (
                <button
                  key={s.title}
                  type="button"
                  className={`ob-step ${i === step ? 'active' : ''} ${complete ? 'complete' : ''}`}
                  onClick={() => goTo(i)}
                  aria-current={i === step ? 'step' : undefined}
                >
                  <span className="ob-step-dot">{complete ? <Check size={14} strokeWidth={3} /> : i + 1}</span>
                  <span className="ob-step-text">
                    <b>{s.title}</b>
                    <small>{d} of {s.items.length} answered</small>
                  </span>
                </button>
              );
            })}
          </nav>

          <div className="ob-main">
            <section className="ob-panel" key={current.title}>
              <div className="ob-panel-head">
                <span className="ob-kicker">Section {step + 1} of {sections.length}</span>
                <h2>{current.title}</h2>
                {current.description && <p>{current.description}</p>}
              </div>

              {current.items.map((q) => {
                const v = answers[q.id] || '';
                const ok = filled(v);
                const bad = flagged.includes(q.id);
                return (
                  <div key={q.id} id={`fq-${q.id}`} className={`ob-q ${ok ? 'ok' : ''} ${bad ? 'bad' : ''}`}>
                    <label htmlFor={`in-${q.id}`} className="ob-q-label">
                      <span className="ob-q-num">{ok ? <Check size={14} strokeWidth={3} /> : q.n}</span>
                      <span className="ob-q-text">{q.question}</span>
                    </label>
                    <textarea
                      id={`in-${q.id}`}
                      ref={grow}
                      rows={3}
                      maxLength={MAX}
                      value={v}
                      onChange={(e) => { change(q.id, e.target.value); grow(e.target); }}
                      placeholder="Type your answer here…"
                      aria-invalid={bad}
                    />
                    <div className="ob-q-foot">
                      <span className="ob-q-err">{bad ? 'This question needs an answer' : ''}</span>
                      <span className="ob-count">{v.length > 0 ? `${v.length} / ${MAX}` : 'Required'}</span>
                    </div>
                  </div>
                );
              })}

              <div className="ob-nav">
                <button type="button" className="btn-ghost" onClick={() => goTo(step - 1)} disabled={step === 0}>
                  <ArrowLeft size={15} /> Previous
                </button>
                {isLast ? (
                  <button type="submit" className="btn-primary" disabled={busy}>
                    {busy ? <Loader2 size={15} className="fm-spin" /> : <Send size={15} />} Submit form
                  </button>
                ) : (
                  <button type="button" className="btn-primary" onClick={() => goTo(step + 1)}>
                    Next section <ArrowRight size={15} />
                  </button>
                )}
              </div>
            </section>

            {isLast && progress === 100 && (
              <p className="ob-ready"><CheckCircle2 size={16} /> Everything is answered. You&apos;re ready to submit.</p>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
