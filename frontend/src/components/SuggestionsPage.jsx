import { useCallback, useEffect, useMemo, useState } from 'react';
import { Lightbulb, Send, Search, RefreshCw, Trash2, MessageSquareText } from 'lucide-react';
import api from '../api';
import { useAuth } from '../AuthContext';
import { navFor } from '../navConfig';
import { roleName } from '../roleNames';
import { errMsg } from '../sopUtils';
import '../style.css';
import '../styles/dashboard-glass.css';
import '../styles/suggestions.css';

const CATEGORIES = [
  ['general', 'General'],
  ['feature', 'New feature'],
  ['improvement', 'Improvement'],
  ['workflow', 'Workflow / process'],
  ['bug', 'Something is broken'],
  ['other', 'Other']
];
const STATUSES = [
  ['new', 'New'],
  ['reviewing', 'Reviewing'],
  ['planned', 'Planned'],
  ['done', 'Done'],
  ['dismissed', 'Dismissed']
];
const label = (list, key) => list.find(([k]) => k === key)?.[1] || key;
const fmtDate = (v) => new Date(v).toLocaleString([], { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const StatusPill = ({ status }) => <span className={`sg-pill ${status}`}>{label(STATUSES, status)}</span>;

/* ---------- everyone except admin / HR: send a suggestion + see your own ---------- */
const SendSuggestion = ({ role }) => {
  const sections = useMemo(
    () => navFor(role).flatMap((g) => g.items).map((i) => i.title).filter((t) => t !== 'Suggestions'),
    [role]
  );
  const [form, setForm] = useState({ title: '', message: '', category: 'general', page: '' });
  const [mine, setMine] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const load = useCallback(() => {
    api.get('/suggestions/mine').then((res) => setMine(res.data.suggestions || [])).catch(() => { });
  }, []);
  useEffect(() => { load(); }, [load]);

  const set = (key) => (e) => { setSent(false); setForm((f) => ({ ...f, [key]: e.target.value })); };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api.post('/suggestions', form);
      setForm({ title: '', message: '', category: 'general', page: '' });
      setSent(true);
      load();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sg-grid">
      <section className="sg-card">
        <div className="sg-card-head"><h3>Send a suggestion</h3><small>Goes to admin and HR</small></div>
        <form className="sg-form" onSubmit={submit}>
          <label>
            <span>Title</span>
            <input value={form.title} onChange={set('title')} maxLength={120} placeholder="A short summary" required />
          </label>
          <div className="sg-row">
            <label>
              <span>Type</span>
              <select value={form.category} onChange={set('category')}>
                {CATEGORIES.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label>
              <span>Related section (optional)</span>
              <select value={form.page} onChange={set('page')}>
                <option value="">Not specific</option>
                {sections.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
          </div>
          <label>
            <span>Your suggestion</span>
            <textarea value={form.message} onChange={set('message')} maxLength={2000} rows={6} placeholder="What should be added or changed, and why?" required />
            <em className="sg-count">{form.message.length}/2000</em>
          </label>
          {error && <p className="error-message" role="alert">{error}</p>}
          {sent && <p className="sg-ok" role="status">Thanks! Your suggestion was sent.</p>}
          <button type="submit" className="dash-btn sg-send" disabled={busy}>
            <Send size={15} /> {busy ? 'Sending…' : 'Send suggestion'}
          </button>
        </form>
      </section>

      <section className="sg-card">
        <div className="sg-card-head"><h3>Your suggestions</h3><small>{mine.length} sent</small></div>
        <div className="sg-list">
          {mine.length === 0 && <p className="sg-empty">You haven’t sent any suggestions yet.</p>}
          {mine.map((s) => (
            <article className="sg-item" key={s.id}>
              <div className="sg-item-top">
                <strong>{s.title}</strong>
                <StatusPill status={s.status} />
              </div>
              <p>{s.message}</p>
              <div className="sg-meta">
                <span>{label(CATEGORIES, s.category)}</span>
                {s.page && <span>{s.page}</span>}
                <span>{fmtDate(s.createdAt)}</span>
              </div>
              {s.reviewNote && (
                <div className="sg-note"><MessageSquareText size={14} /> <span><b>{s.reviewedBy || 'Reviewer'}:</b> {s.reviewNote}</span></div>
              )}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
};

/* ---------- admin + HR: the inbox ---------- */
const SuggestionInbox = () => {
  const [data, setData] = useState({ suggestions: [], counts: {} });
  const [filters, setFilters] = useState({ q: '', status: '', role: '', category: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [drafts, setDrafts] = useState({});
  const [busyId, setBusyId] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
    api.get('/suggestions', { params })
      .then((res) => { setData(res.data); setError(''); })
      .catch((err) => setError(errMsg(err)))
      .finally(() => setLoading(false));
  }, [filters]);

  useEffect(() => {
    const t = setTimeout(load, filters.q ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, filters.q]);

  const patch = async (id, body) => {
    setBusyId(id);
    try {
      const res = await api.patch(`/suggestions/${id}`, body);
      setData((d) => ({ ...d, suggestions: d.suggestions.map((s) => (s.id === id ? res.data.suggestion : s)) }));
      setError('');
      // counts change when a status changes, so refresh them quietly
      if (body.status) load();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusyId('');
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this suggestion? This cannot be undone.')) return;
    setBusyId(id);
    try {
      await api.delete(`/suggestions/${id}`);
      load();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusyId('');
    }
  };

  const setF = (key) => (e) => setFilters((f) => ({ ...f, [key]: e.target.value }));
  const roles = ['sme', 'smi', 'des', 'reporting_manager', 'operation_manager', 'hr', 'admin'];

  return (
    <>
      <div className="kpi-grid">
        {STATUSES.slice(0, 4).map(([k, v]) => (
          <button type="button" key={k} className={`kpi-card sg-kpi ${filters.status === k ? 'on' : ''}`} onClick={() => setFilters((f) => ({ ...f, status: f.status === k ? '' : k }))}>
            <div className="kpi-top"><span className="kpi-label">{v}</span></div>
            <div className="kpi-value">{data.counts?.[k] ?? '–'}</div>
          </button>
        ))}
      </div>

      <div className="sg-toolbar">
        <div className="sg-search">
          <Search size={15} />
          <input value={filters.q} onChange={setF('q')} placeholder="Search title, message or name" />
        </div>
        <select value={filters.status} onChange={setF('status')}>
          <option value="">All statuses</option>
          {STATUSES.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={filters.role} onChange={setF('role')}>
          <option value="">All panels</option>
          {roles.map((r) => <option key={r} value={r}>{roleName(r)}</option>)}
        </select>
        <select value={filters.category} onChange={setF('category')}>
          <option value="">All types</option>
          {CATEGORIES.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button type="button" className="dash-btn" onClick={load} disabled={loading}><RefreshCw size={15} /> Refresh</button>
      </div>

      {error && <p className="error-message" role="alert">{error}</p>}

      <div className="sg-list inbox">
        {!loading && data.suggestions.length === 0 && <p className="sg-empty">No suggestions match.</p>}
        {data.suggestions.map((s) => {
          const draft = drafts[s.id] ?? s.reviewNote ?? '';
          return (
            <article className="sg-item" key={s.id}>
              <div className="sg-item-top">
                <strong>{s.title}</strong>
                <StatusPill status={s.status} />
              </div>
              <div className="sg-meta">
                <span><b>{s.name || 'Unknown'}</b> · {roleName(s.role)}</span>
                <span>{label(CATEGORIES, s.category)}</span>
                {s.page && <span>About: {s.page}</span>}
                <span>{fmtDate(s.createdAt)}</span>
              </div>
              <p>{s.message}</p>
              <div className="sg-actions">
                <select value={s.status} disabled={busyId === s.id} onChange={(e) => patch(s.id, { status: e.target.value })} aria-label="Status">
                  {STATUSES.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <input
                  value={draft}
                  maxLength={1000}
                  placeholder="Reply note (visible to the sender)"
                  onChange={(e) => setDrafts((d) => ({ ...d, [s.id]: e.target.value }))}
                />
                <button type="button" className="dash-btn" disabled={busyId === s.id || draft === (s.reviewNote || '')} onClick={() => patch(s.id, { reviewNote: draft })}>Save note</button>
                <button type="button" className="sg-del" disabled={busyId === s.id} onClick={() => remove(s.id)} aria-label="Delete suggestion" title="Delete"><Trash2 size={15} /></button>
              </div>
              {s.reviewedBy && <small className="sg-reviewed">Last updated by {s.reviewedBy} · {fmtDate(s.reviewedAt)}</small>}
            </article>
          );
        })}
      </div>
    </>
  );
};

const SuggestionsPage = () => {
  const { user } = useAuth();
  const role = user?.role;
  const isReviewer = role === 'admin' || role === 'hr';
  return (
    <div className="dashboard-content scrollable dash-glass sg-page">
      <div className="page-header">
        <div>
          <span className="page-label">{roleName(role).toUpperCase()}</span>
          <h1><Lightbulb size={22} className="sg-h-icon" /> Suggestions</h1>
          <p>{isReviewer ? 'Ideas and feedback from every panel. Update the status and leave a note for the sender.' : 'Got an idea to make Neuro better? Tell admin and HR.'}</p>
        </div>
      </div>
      {isReviewer ? <SuggestionInbox /> : <SendSuggestion role={role} />}
    </div>
  );
};

export default SuggestionsPage;
