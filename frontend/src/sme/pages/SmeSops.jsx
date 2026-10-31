import { useEffect, useState } from 'react';
import { useSmeAuth } from '../context/SmeAuthContext';
import { createMySop, getMySops, updateMySop, withdrawMySop } from '../api/smeApi';
import { STATUS_LABEL, fmt } from '../../shared/sop';

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'revision', label: 'Needs redo' },
];

export default function SmeSops() {
  const { token } = useSmeAuth();
  const [sops, setSops] = useState([]);
  const [tab, setTab] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey((k) => k + 1);

  useEffect(() => {
    let cancelled = false;
    getMySops(token)
      .then((d) => {
        if (cancelled) return;
        setError('');
        setSops(d.sops);
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [token, reloadKey]);

  const submitForm = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { id, ...body } = form;
      if (id) await updateMySop(token, id, body);
      else await createMySop(token, body);
      setForm(null);
      reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async (id) => {
    if (!window.confirm('Withdraw this SOP?')) return;
    try {
      await withdrawMySop(token, id);
      reload();
    } catch (err) {
      setError(err.message);
    }
  };

  const shown = tab === 'all' ? sops : sops.filter((s) => s.status === tab);

  return (
    <>
      <div className="sop-head">
        <h1 className="admin-title">My SOPs</h1>
        <button
          type="button"
          className="admin-btn sop-new"
          onClick={() => setForm({ title: '', department: '', description: '', content: '' })}
        >
          + New SOP
        </button>
      </div>

      <div className="sop-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={tab === t.key ? 'active' : ''}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <p className="admin-error" role="alert">{error}</p>}

      {form && (
        <form className="admin-panel sop-form" onSubmit={submitForm}>
          <h2>{form.id ? 'Edit & resubmit SOP' : 'New SOP'}</h2>
          <label className="admin-field">
            <span>Title</span>
            <input value={form.title} maxLength={150} required onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </label>
          <label className="admin-field">
            <span>Department</span>
            <input value={form.department} maxLength={80} onChange={(e) => setForm({ ...form, department: e.target.value })} />
          </label>
          <label className="admin-field">
            <span>Short description</span>
            <input value={form.description} maxLength={500} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </label>
          <label className="admin-field">
            <span>SOP content / steps</span>
            <textarea className="sop-textarea" rows={8} required value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
          </label>
          <div className="sop-actions">
            <button className="admin-btn sop-inline" disabled={busy}>
              {busy ? 'Saving…' : form.id ? 'Save & resubmit' : 'Submit for review'}
            </button>
            <button type="button" className="sop-btn ghost" onClick={() => setForm(null)}>Cancel</button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="admin-loading">Loading your SOPs…</p>
      ) : shown.length === 0 ? (
        <div className="admin-panel"><p>No SOPs here yet.</p></div>
      ) : (
        <div className="sop-list">
          {shown.map((sop) => {
            const isOpen = openId === sop._id;
            return (
              <article key={sop._id} className="admin-panel sop-card">
                <div className="sop-card-top">
                  <div>
                    <h3>{sop.title}</h3>
                    <p className="sop-meta">
                      {sop.department && <>{sop.department} · </>}
                      Updated {fmt(sop.updatedAt)}
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
                      className="sop-btn revise"
                      onClick={() =>
                        setForm({ id: sop._id, title: sop.title, department: sop.department, description: sop.description, content: sop.content })
                      }
                    >
                      {sop.status === 'pending' ? 'Edit' : 'Fix & resubmit'}
                    </button>
                  )}
                  {sop.status === 'pending' && (
                    <button type="button" className="sop-btn ghost danger" onClick={() => withdraw(sop._id)}>Withdraw</button>
                  )}
                </div>

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
