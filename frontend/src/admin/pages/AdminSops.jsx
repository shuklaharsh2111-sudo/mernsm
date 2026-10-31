import { useEffect, useState } from 'react';
import { useAdminAuth } from '../context/AdminAuthContext';
import { createSop, deleteSop, getSops, reviewSop, updateSop } from '../api/adminApi';

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'revision', label: 'Needs redo' },
];

const STATUS_LABEL = {
  pending: 'Pending review',
  approved: 'Approved',
  rejected: 'Rejected',
  revision: 'Needs redo',
};

const fmt = (d) => (d ? new Date(d).toLocaleString() : '');
const EMPTY_FORM = { title: '', department: '', description: '', content: '' };

export default function AdminSops() {
  const { token } = useAdminAuth();
  const [tab, setTab] = useState('all');
  const [sops, setSops] = useState([]);
  const [counts, setCounts] = useState({ pending: 0, approved: 0, rejected: 0, revision: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState(null);

  // review box state: which SOP + which decision is being written
  const [review, setReview] = useState(null); // { id, decision }
  const [reason, setReason] = useState('');

  // create / edit form
  const [form, setForm] = useState(null); // null = hidden, { id?, ...fields }
  const [busy, setBusy] = useState(false);

  const [reloadKey, setReloadKey] = useState(0);
  const load = () => setReloadKey((k) => k + 1);

  useEffect(() => {
    let cancelled = false;
    getSops(token, tab)
      .then((data) => {
        if (cancelled) return;
        setError('');
        setSops(data.sops);
        setCounts(data.counts);
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [token, tab, reloadKey]);

  const startReview = (id, decision) => {
    setReview({ id, decision });
    setReason('');
    setError('');
  };

  const submitReview = async () => {
    setBusy(true);
    setError('');
    try {
      await reviewSop(token, review.id, { decision: review.decision, reason });
      setReview(null);
      setReason('');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const submitForm = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { id, ...body } = form;
      if (id) await updateSop(token, id, body);
      else await createSop(token, body);
      setForm(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this SOP permanently?')) return;
    try {
      await deleteSop(token, id);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const total = counts.pending + counts.approved + counts.rejected + counts.revision;
  const needsReason = review && review.decision !== 'approved';

  return (
    <>
      <div className="sop-head">
        <h1 className="admin-title">SOP Review</h1>
        <button
          type="button"
          className="admin-btn sop-new"
          onClick={() => setForm({ ...EMPTY_FORM })}
        >
          + New SOP
        </button>
      </div>

      <div className="sop-stats">
        <div className="sop-stat"><strong>{total}</strong><span>Total</span></div>
        <div className="sop-stat"><strong>{counts.pending}</strong><span>Pending</span></div>
        <div className="sop-stat"><strong>{counts.approved}</strong><span>Approved</span></div>
        <div className="sop-stat"><strong>{counts.rejected}</strong><span>Rejected</span></div>
        <div className="sop-stat"><strong>{counts.revision}</strong><span>Needs redo</span></div>
      </div>

      <div className="sop-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={tab === t.key ? 'active' : ''}
            onClick={() => {
              setLoading(true);
              setTab(t.key);
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <p className="admin-error" role="alert">{error}</p>}

      {form && (
        <form className="admin-panel sop-form" onSubmit={submitForm}>
          <h2>{form.id ? 'Edit SOP' : 'New SOP'}</h2>
          <label className="admin-field">
            <span>Title</span>
            <input
              value={form.title}
              maxLength={150}
              required
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </label>
          <label className="admin-field">
            <span>Department</span>
            <input
              value={form.department}
              maxLength={80}
              onChange={(e) => setForm({ ...form, department: e.target.value })}
            />
          </label>
          <label className="admin-field">
            <span>Short description</span>
            <input
              value={form.description}
              maxLength={500}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </label>
          <label className="admin-field">
            <span>SOP content / steps</span>
            <textarea
              className="sop-textarea"
              rows={8}
              value={form.content}
              required
              onChange={(e) => setForm({ ...form, content: e.target.value })}
            />
          </label>
          <div className="sop-actions">
            <button className="admin-btn sop-inline" disabled={busy}>
              {busy ? 'Saving…' : form.id ? 'Save & resubmit' : 'Submit for review'}
            </button>
            <button type="button" className="sop-btn ghost" onClick={() => setForm(null)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="admin-loading">Loading SOPs…</p>
      ) : sops.length === 0 ? (
        <div className="admin-panel"><p>No SOPs here yet.</p></div>
      ) : (
        <div className="sop-list">
          {sops.map((sop) => {
            const isOpen = openId === sop._id;
            const reviewing = review?.id === sop._id;
            return (
              <article key={sop._id} className="admin-panel sop-card">
                <div className="sop-card-top">
                  <div>
                    <h3>{sop.title}</h3>
                    <p className="sop-meta">
                      {sop.department && <>{sop.department} · </>}
                      By {sop.submittedBy || 'Unknown'} · Updated {fmt(sop.updatedAt)}
                      {sop.revisionCount > 0 && <> · Revision #{sop.revisionCount}</>}
                    </p>
                  </div>
                  <span className={`sop-badge ${sop.status}`}>{STATUS_LABEL[sop.status]}</span>
                </div>

                {sop.description && <p className="sop-desc">{sop.description}</p>}

                {(sop.status === 'rejected' || sop.status === 'revision') && sop.reviewReason && (
                  <div className={`sop-reason ${sop.status}`}>
                    <strong>{sop.status === 'rejected' ? 'Why rejected' : 'Why redo'}</strong>
                    <p>{sop.reviewReason}</p>
                    <small>— {sop.reviewedByName}, {fmt(sop.reviewedAt)}</small>
                  </div>
                )}
                {sop.status === 'approved' && sop.reviewReason && (
                  <div className="sop-reason approved">
                    <strong>Approval note</strong>
                    <p>{sop.reviewReason}</p>
                  </div>
                )}

                <div className="sop-actions">
                  <button type="button" className="sop-btn ghost" onClick={() => setOpenId(isOpen ? null : sop._id)}>
                    {isOpen ? 'Hide details' : 'View details'}
                  </button>
                  {sop.status !== 'approved' && (
                    <button
                      type="button"
                      className="sop-btn ghost"
                      onClick={() => setForm({ id: sop._id, title: sop.title, department: sop.department, description: sop.description, content: sop.content })}
                    >
                      Edit
                    </button>
                  )}
                  {sop.status !== 'approved' && (
                    <button type="button" className="sop-btn approve" onClick={() => startReview(sop._id, 'approved')}>Approve</button>
                  )}
                  {sop.status !== 'revision' && (
                    <button type="button" className="sop-btn revise" onClick={() => startReview(sop._id, 'revision')}>Request redo</button>
                  )}
                  {sop.status !== 'rejected' && (
                    <button type="button" className="sop-btn reject" onClick={() => startReview(sop._id, 'rejected')}>Reject</button>
                  )}
                  <button type="button" className="sop-btn ghost danger" onClick={() => remove(sop._id)}>Delete</button>
                </div>

                {reviewing && (
                  <div className="sop-review-box">
                    <label className="admin-field">
                      <span>
                        {review.decision === 'approved' && 'Approval note (optional)'}
                        {review.decision === 'revision' && 'Why does this need to be redone? (required)'}
                        {review.decision === 'rejected' && 'Why is it rejected? (required)'}
                      </span>
                      <textarea
                        className="sop-textarea"
                        rows={3}
                        maxLength={1000}
                        autoFocus
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder={needsReason ? 'Explain what is wrong or missing…' : 'Optional comment'}
                      />
                    </label>
                    <div className="sop-actions">
                      <button
                        type="button"
                        className={`sop-btn ${review.decision === 'approved' ? 'approve' : review.decision === 'revision' ? 'revise' : 'reject'}`}
                        disabled={busy || (needsReason && reason.trim().length < 5)}
                        onClick={submitReview}
                      >
                        {busy ? 'Saving…' : 'Confirm'}
                      </button>
                      <button type="button" className="sop-btn ghost" onClick={() => setReview(null)}>Cancel</button>
                    </div>
                  </div>
                )}

                {isOpen && (
                  <div className="sop-details">
                    <h4>SOP content</h4>
                    <pre className="sop-content">{sop.content}</pre>
                    <h4>History</h4>
                    <ul className="sop-history">
                      {[...sop.history].reverse().map((h, i) => (
                        <li key={i}>
                          <span className={`sop-badge ${h.status}`}>{STATUS_LABEL[h.status]}</span>
                          <span>
                            {h.reason && <>{h.reason} </>}
                            <small>— {h.by}, {fmt(h.at)}</small>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
