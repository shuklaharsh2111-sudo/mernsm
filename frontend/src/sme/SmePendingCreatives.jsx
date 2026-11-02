import { useEffect, useMemo, useState } from 'react';
import { Eye, Trash2, Pencil, Image as ImageIcon } from 'lucide-react';
import api from '../api';
import CreativeViewModal from '../components/CreativeViewModal';
import ReferenceCreativeModal from '../components/ReferenceCreativeModal';
import { PLATFORMS } from '../components/creativePlatforms';
import { errMsg, fmtDay, fmtDateTime } from '../sopUtils';
import '../style.css';
import '../styles/mom.css';
import '../styles/calendar.css';

const TABS = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Redo' },
  { value: 'all', label: 'All' },
];

// The SME's own creatives and where each one is in the admin's approval.
const SmePendingCreatives = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('pending');
  const [viewing, setViewing] = useState(null);
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api.get('/sme/creatives')
      .then((r) => !cancelled && setItems([...r.data.creatives].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))))
      .catch((err) => !cancelled && setError(errMsg(err)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const counts = useMemo(() => {
    const c = { all: items.length, pending: 0, approved: 0, rejected: 0 };
    items.forEach((i) => (c[i.status] += 1));
    return c;
  }, [items]);
  const shown = items.filter((i) => tab === 'all' || i.status === tab);

  const withdraw = async (c) => {
    if (!window.confirm('Withdraw this creative?')) return;
    try {
      await api.delete(`/sme/creatives/${c.id}`);
      setItems((list) => list.filter((x) => x.id !== c.id));
    } catch (err) {
      setError(errMsg(err));
    }
  };

  return (
    <div className="dashboard-content scrollable">
      <div className="page-header">
        <div>
          <span className="page-label">SME WORKSPACE</span>
          <h1>Pending Creative</h1>
          <p>Creatives you sent for approval. They show on your calendar as Pending, Approved or Redo.</p>
        </div>
      </div>

      <div className="sop-tabs">
        {TABS.map((t) => (
          <button key={t.value} type="button" className={tab === t.value ? 'active' : ''} onClick={() => setTab(t.value)}>
            {t.label} ({counts[t.value]})
          </button>
        ))}
      </div>

      {error && <p className="error-message" role="alert">{error}</p>}

      {loading ? (
        <p className="muted">Loading…</p>
      ) : shown.length === 0 ? (
        <div className="glass-panel"><p className="muted">No {tab === 'all' ? '' : `${tab} `}creatives yet.</p></div>
      ) : (
        <div className="mom-list">
          {shown.map((c) => (
            <div key={c.id} className="glass-panel creative-row">
              <div className="creative-row-thumb">
                {c.uploads[0] ? <img src={c.uploads[0].url} alt="" /> : <ImageIcon size={22} />}
              </div>
              <div className="creative-row-body">
                <span className="mom-card-company">{c.companyName || 'Brand'}</span>
                <h3 className="mom-card-title">{c.contentPillar.title}</h3>
                <p className="mom-card-sub">
                  For {fmtDay(c.date)} · Sent {fmtDateTime(c.createdAt)}
                </p>
                <div className="creative-row-platforms">
                  {c.contentPillar.platforms.map((pk) => {
                    const P = PLATFORMS.find((p) => p.key === pk);
                    return P ? <span key={pk} title={P.label}><P.icon size={14} /></span> : null;
                  })}
                </div>
                {c.status === 'rejected' && <p className="mom-note rejected">Admin asked for a redo{c.reviewNote ? `: ${c.reviewNote}` : '.'}</p>}
                {c.status === 'approved' && <p className="mom-note approved">Approved {fmtDateTime(c.reviewedAt)}.</p>}
              </div>
              <div className="creative-row-side">
                <span className={`status-pill ${c.status}`}>{c.status === 'rejected' ? 'redo' : c.status}</span>
                <div className="btn-row small">
                  <button type="button" className="btn-ghost" onClick={() => setViewing(c)}><Eye size={14} /> Preview</button>
                  {c.status === 'rejected' && (
                    <button type="button" className="btn-primary" onClick={() => setEditing(c)}><Pencil size={14} /> Edit &amp; resubmit</button>
                  )}
                  {c.status === 'pending' && (
                    <button type="button" className="btn-ghost danger" onClick={() => withdraw(c)}><Trash2 size={14} /> Withdraw</button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {viewing && (
        <CreativeViewModal
          creative={viewing}
          company={{ name: viewing.companyName }}
          platforms={PLATFORMS}
          onEdit={(c) => { setViewing(null); setEditing(c); }}
          onClose={() => setViewing(null)}
        />
      )}

      {editing && (
        <ReferenceCreativeModal
          company={{ id: editing.companyId, name: editing.companyName }}
          date={editing.date}
          platforms={PLATFORMS}
          editing={editing}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setItems((list) => list.map((c) => (c.id === saved.id ? { ...saved, companyName: c.companyName } : c)));
            setEditing(null);
          }}
        />
      )}
    </div>
  );
};

export default SmePendingCreatives;
