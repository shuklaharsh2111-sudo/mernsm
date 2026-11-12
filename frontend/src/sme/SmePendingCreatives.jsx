import { createPortal } from 'react-dom';
import { useEffect, useMemo, useState } from 'react';
import { Eye, Trash2, Pencil, Image as ImageIcon, UserRoundPlus, X, CheckCircle2, Palette } from 'lucide-react';
import api from '../api';
import CreativeViewModal from '../components/CreativeViewModal';
import ReferenceCreativeModal from '../components/ReferenceCreativeModal';
import DesignOutputModal from '../components/DesignOutputModal';
import { PLATFORMS } from '../components/creativePlatforms';
import { errMsg, fmtDay, fmtDateTime } from '../sopUtils';
import '../style.css';
import '../styles/mom.css';
import '../styles/calendar.css';
const TABS = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Redo' },
  { value: 'designer', label: 'Designer Output' },
  { value: 'all', label: 'All' },
];
const SmePendingCreatives = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('pending');
  const [viewing, setViewing] = useState(null);
  const [editing, setEditing] = useState(null);
  const [assigning, setAssigning] = useState(null);
  const [reviewing, setReviewing] = useState(null);
  const [designers, setDesigners] = useState([]);
  const [selectedDesigner, setSelectedDesigner] = useState('');
  const [designersLoading, setDesignersLoading] = useState(false);
  const [savingAssignment, setSavingAssignment] = useState(false);
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
  useEffect(() => {
    if (!assigning) return undefined;
    const onKey = (e) => e.key === 'Escape' && !savingAssignment && setAssigning(null);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [assigning, savingAssignment]);
  const counts = useMemo(() => {
    const c = { all: items.length, pending: 0, approved: 0, rejected: 0, designer: 0 };
    items.forEach((i) => {
      if (c[i.status] !== undefined) c[i.status] += 1;
      if (i.designOutput) c.designer += 1;
    });
    return c;
  }, [items]);
  const shown = items.filter((i) => (
    tab === 'all' || (tab === 'designer' ? Boolean(i.designOutput) : i.status === tab)
  ));
  const withdraw = async (c) => {
    if (!window.confirm('Withdraw this creative?')) return;
    try {
      await api.delete(`/sme/creatives/${c.id}`);
      setItems((list) => list.filter((x) => x.id !== c.id));
    } catch (err) {
      setError(errMsg(err));
    }
  };
  const openAssign = async (creative) => {
    setError('');
    setAssigning(creative);
    setSelectedDesigner(creative.assignedDesigner?.id || '');
    setDesignersLoading(true);
    try {
      const { data } = await api.get('/sme/designers');
      setDesigners(data.designers || []);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setDesignersLoading(false);
    }
  };
  const saveAssignment = async () => {
    if (!assigning || !selectedDesigner) {
      setError('Please select a designer');
      return;
    }
    setSavingAssignment(true);
    setError('');
    try {
      const { data } = await api.put(`/sme/creatives/${assigning.id}/assign`, {
        designerId: selectedDesigner
      });
      setItems((list) => list.map((c) => (
        c.id === data.creative.id ? data.creative : c
      )));
      setAssigning(null);
      setSelectedDesigner('');
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setSavingAssignment(false);
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
        <div className="glass-panel"><p className="muted">{tab === 'designer' ? 'No designer output yet.' : `No ${tab === 'all' ? '' : `${tab} `}creatives yet.`}</p></div>
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
                {c.status === 'approved' && c.assignedDesigner && (
                  <div className="creative-assigned-info">
                    <CheckCircle2 size={15} />
                    <span>Assigned to <strong>{c.assignedDesigner.name}</strong></span>
                  </div>
                )}
                {c.designOutput && (
                  <button type="button" className="design-output-chip" onClick={() => setReviewing(c)}>
                    {(c.designOutput.mimeType || '').startsWith('image/')
                      ? <img src={c.designOutput.url} alt="" />
                      : <Palette size={18} />}
                    <span>
                      <strong>Designer output</strong>
                      <em>{c.designOutput.name || 'Design file'}</em>
                    </span>
                    <i className={`status-pill ${c.designOutput.status === 'submitted' ? 'pending' : c.designOutput.status === 'redo' ? 'rejected' : 'approved'}`}>
                      {c.designOutput.status === 'submitted' ? 'Review' : c.designOutput.status === 'redo' ? 'Redo sent' : 'Approved'}
                    </i>
                  </button>
                )}
              </div>
              <div className="creative-row-side">
                <span className={`status-pill ${c.status}`}>{c.status === 'rejected' ? 'redo' : c.status}</span>
                <div className="btn-row small">
                  <button type="button" className="btn-ghost" onClick={() => setViewing(c)}>
                    <Eye size={14} /> Preview
                  </button>
                  {c.status === 'approved' && (
                    <button type="button" className="btn-primary" onClick={() => openAssign(c)}>
                      <UserRoundPlus size={14} />
                      {c.assignedDesigner ? 'Reassign' : 'Assign'}
                    </button>
                  )}
                  {c.status === 'rejected' && (
                    <button type="button" className="btn-primary" onClick={() => setEditing(c)}>
                      <Pencil size={14} /> Edit &amp; resubmit
                    </button>
                  )}
                  {c.status === 'pending' && (
                    <button type="button" className="btn-ghost danger" onClick={() => withdraw(c)}>
                      <Trash2 size={14} /> Withdraw
                    </button>
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
            setItems((list) => list.map((c) => (
              c.id === saved.id ? { ...saved, companyName: c.companyName } : c
            )));
            setEditing(null);
          }}
        />
      )}
      {reviewing && (
        <DesignOutputModal
          creative={reviewing}
          onClose={() => setReviewing(null)}
          onUpdated={(saved) => setItems((list) => list.map((c) => (c.id === saved.id ? saved : c)))}
        />
      )}
      {assigning && createPortal(
        <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && !savingAssignment && setAssigning(null)}>
          <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="assign-designer-title">
            <div className="modal-head">
              <h2 id="assign-designer-title">{assigning.assignedDesigner ? 'Reassign Designer' : 'Assign Designer'}</h2>
              <button type="button" className="modal-close" aria-label="Close" onClick={() => setAssigning(null)} disabled={savingAssignment}>
                <X size={16} />
              </button>
            </div>
            <div className="modal-body">
              <div className="sops-form">
                <div className="sop-preview">
                  <div className="sop-item-top">
                    <b>{assigning.companyName || 'Brand'}</b>
                    <span className="muted">For {fmtDay(assigning.date)}</span>
                  </div>
                  <p className="sop-item-text">{assigning.contentPillar.title}</p>
                </div>
                <label className="x-field">
                  <span>Select designer *</span>
                  <select
                    value={selectedDesigner}
                    disabled={designersLoading || !designers.length}
                    onChange={(e) => setSelectedDesigner(e.target.value)}
                  >
                    <option value="">
                      {designersLoading ? 'Loading designers…' : designers.length ? 'Choose a designer' : 'No designers found'}
                    </option>
                    {designers.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}{d.email ? ` (${d.email})` : ''}</option>
                    ))}
                  </select>
                </label>
                {error && <p className="error-message" role="alert">{error}</p>}
                <div className="btn-row">
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={saveAssignment}
                    disabled={designersLoading || !selectedDesigner || savingAssignment}
                  >
                    {savingAssignment ? 'Assigning…' : assigning.assignedDesigner ? 'Update assignment' : 'Assign'}
                  </button>
                  <button type="button" className="btn-ghost" onClick={() => setAssigning(null)} disabled={savingAssignment}>Cancel</button>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
export default SmePendingCreatives;