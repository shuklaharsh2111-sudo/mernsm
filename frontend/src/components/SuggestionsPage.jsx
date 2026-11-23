import { useCallback, useEffect, useState } from 'react';
import { Lightbulb, Send, Search, RefreshCw, Trash2, EyeOff, Inbox, CalendarDays } from 'lucide-react';
import api from '../api';
import { useAuth } from '../AuthContext';
import { roleName } from '../roleNames';
import { errMsg } from '../sopUtils';
import '../style.css';
import '../styles/dashboard-glass.css';
import '../styles/suggestions.css';

const fmtDate = (v) => new Date(v).toLocaleString([], { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/* ---------- everyone except admin / HR: one box, type anything, send ---------- */
const SendSuggestion = () => {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api.post('/suggestions', { message });
      setMessage('');
      setSent(true);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="sg-compose">
      <header className="sg-compose-head">
        <span className="sg-compose-icon"><Lightbulb size={20} /></span>
        <div>
          <h3>Share your suggestion</h3>
          <p>Tell us what to add, change or fix. Anything is welcome.</p>
        </div>
      </header>

      <form onSubmit={submit}>
        <textarea
          value={message}
          onChange={(e) => { setSent(false); setMessage(e.target.value); }}
          maxLength={2000}
          rows={9}
          placeholder="Type anything…"
          aria-label="Your suggestion"
          required
        />

        {error && <p className="error-message" role="alert">{error}</p>}
        {sent && <p className="sg-ok" role="status">Thanks! Your suggestion was sent.</p>}

        <footer className="sg-compose-foot">
          <span className="sg-anon"><EyeOff size={14} /> Anonymous: admin and HR never see your name</span>
          <div className="sg-compose-actions">
            <span className="sg-count">{message.length}/2000</span>
            <button type="submit" className="dash-btn sg-send" disabled={busy || !message.trim()}>
              <Send size={15} /> {busy ? 'Sending…' : 'Send'}
            </button>
          </div>
        </footer>
      </form>
    </section>
  );
};

/* ---------- admin + HR: anonymous feed ---------- */
const SuggestionInbox = () => {
  const [data, setData] = useState({ suggestions: [], total: 0, thisWeek: 0 });
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('newest');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    api.get('/suggestions', { params: { q: q.trim() || undefined, sort } })
      .then((res) => { setData(res.data); setError(''); })
      .catch((err) => setError(errMsg(err)))
      .finally(() => setLoading(false));
  }, [q, sort]);

  useEffect(() => {
    const t = setTimeout(load, q ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

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

  return (
    <>
      <div className="sg-stats">
        <div className="sg-stat"><Inbox size={18} /><div><b>{data.total}</b><span>Total suggestions</span></div></div>
        <div className="sg-stat"><CalendarDays size={18} /><div><b>{data.thisWeek}</b><span>Last 7 days</span></div></div>
      </div>

      <div className="sg-toolbar">
        <div className="sg-search">
          <Search size={15} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search suggestions" />
        </div>
        <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort">
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>
        <button type="button" className="dash-btn" onClick={load} disabled={loading}><RefreshCw size={15} /> Refresh</button>
      </div>

      {error && <p className="error-message" role="alert">{error}</p>}

      {!loading && data.suggestions.length === 0 && (
        <p className="sg-empty">{q ? 'No suggestions match your search.' : 'No suggestions yet.'}</p>
      )}
      <div className="sg-feed">
        {data.suggestions.map((s) => (
          <article className="sg-card" key={s.id}>
            <p>{s.message}</p>
            <footer>
              <small>{fmtDate(s.createdAt)}</small>
              <button type="button" className="sg-del" disabled={busyId === s.id} onClick={() => remove(s.id)} aria-label="Delete suggestion" title="Delete"><Trash2 size={15} /></button>
            </footer>
          </article>
        ))}
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
          <p>{isReviewer ? 'Anonymous suggestions from every panel. You see the message only, never who sent it.' : 'Got an idea? Type it below. It goes to admin and HR anonymously.'}</p>
        </div>
      </div>
      {isReviewer ? <SuggestionInbox /> : <SendSuggestion />}
    </div>
  );
};

export default SuggestionsPage;
