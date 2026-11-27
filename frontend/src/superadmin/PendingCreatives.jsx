import { useEffect, useMemo, useState } from 'react';
import { Check, X, Clock, ExternalLink } from 'lucide-react';
import api from '../api';
import { errMsg } from '../sopUtils';
import '../style.css';
import '../styles/dashboard-glass.css';
import './superadmin.css';

const fmt = (d) => {
  const date = d ? new Date(d) : null;
  return date && !Number.isNaN(date.getTime())
    ? date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';
};

// Super admin only: every creative that is still waiting for review, across all companies.
const PendingCreatives = () => {
  const [list, setList] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [q, setQ] = useState('');
  const [company, setCompany] = useState('');
  const [rejecting, setRejecting] = useState(null); // id of the creative being rejected
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState('');

  const load = () => api.get('/superadmin/pending-creatives')
    .then((r) => { setList(r.data.creatives); setError(''); })
    .catch((e) => setError(errMsg(e)));
  useEffect(() => { load(); }, []);

  const companies = useMemo(() => [...new Set((list || []).map((c) => c.company.name))].sort(), [list]);
  const shown = useMemo(() => (list || []).filter((c) => (
    (!company || c.company.name === company)
    && (!q.trim() || `${c.contentPillar.title} ${c.company.name} ${c.sme.name}`.toLowerCase().includes(q.trim().toLowerCase()))
  )), [list, q, company]);

  const review = async (c, action) => {
    setBusy(c.id);
    try {
      await api.put(`/admin/creatives/${c.id}/${action}`, action === 'reject' ? { note: reason.trim() } : {});
      setNotice(`"${c.contentPillar.title}" ${action === 'approve' ? 'approved' : 'sent back'}.`);
      setRejecting(null); setReason(''); setError(''); await load();
    } catch (e) { setError(errMsg(e)); } finally { setBusy(''); }
  };

  return (
    <div className="dash-glass">
      <div className="page-header">
        <div>
          <span className="page-label">SUPER ADMIN</span>
          <h1>Pending Creatives</h1>
          <p>Every creative waiting for review, across all companies. Oldest first.</p>
        </div>
        {list && <span className="so-tag">{list.length} waiting</span>}
      </div>
      {error && <p className="error-message" role="alert">{error}</p>}
      {notice && <p className="success-message" role="status" onClick={() => setNotice('')}>{notice}</p>}
      {!list && !error && <p className="muted">Loading…</p>}

      {list && (
        <div className="glass-panel">
          <div className="md-head">
            <h2><Clock size={16} /> Waiting for review</h2>
            <div className="sa-filters">
              <select className="md-select" value={company} onChange={(e) => setCompany(e.target.value)}>
                <option value="">All companies</option>
                {companies.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <input className="md-search" placeholder="Search title, company or SME" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </div>
          {shown.length === 0 ? <p className="muted">{list.length ? 'No creatives match your search.' : 'Nothing is waiting for review. 🎉'}</p> : shown.map((c) => (
            <div className="pc-item" key={c.id}>
              <div className="pc-main">
                <strong>{c.contentPillar.title}</strong>
                <small>{c.company.name} · by {c.sme.name} · submitted {fmt(c.submittedAt)}{c.date ? ` · for ${fmt(c.date)}` : ''}</small>
                {c.contentPillar.platforms.length > 0 && (
                  <span className="pc-tags">{c.contentPillar.platforms.map((p) => <i key={p}>{p}</i>)}</span>
                )}
                {c.contentPillar.caption && <p className="pc-caption">{c.contentPillar.caption}</p>}
                {(c.uploads.length > 0 || c.referenceLinks.length > 0) && (
                  <span className="pc-links">
                    {c.uploads.map((u) => <a key={u.url} href={u.url} target="_blank" rel="noreferrer"><ExternalLink size={12} /> {u.name || 'File'}</a>)}
                    {c.referenceLinks.map((l, i) => <a key={`${l}-${i}`} href={l} target="_blank" rel="noreferrer"><ExternalLink size={12} /> Reference {i + 1}</a>)}
                  </span>
                )}
                {rejecting === c.id && (
                  <div className="pc-reject">
                    <textarea rows={2} maxLength={500} placeholder="Why is it being sent back? (min 3 characters)" value={reason} onChange={(e) => setReason(e.target.value)} />
                    <div>
                      <button type="button" className="btn-primary" disabled={busy === c.id || reason.trim().length < 3} onClick={() => review(c, 'reject')}>Send back</button>
                      <button type="button" className="btn-ghost" onClick={() => { setRejecting(null); setReason(''); }}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>
              {rejecting !== c.id && (
                <div className="pc-actions">
                  <button type="button" className="btn-primary" disabled={busy === c.id} onClick={() => review(c, 'approve')}><Check size={14} /> Approve</button>
                  <button type="button" className="btn-ghost" disabled={busy === c.id} onClick={() => { setRejecting(c.id); setReason(''); }}><X size={14} /> Reject</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PendingCreatives;
