import { createPortal } from 'react-dom';
import { useEffect, useMemo, useState } from 'react';
import { Eye, Trash2, Pencil, Image as ImageIcon, UserRoundPlus, X, CheckCircle2, Palette, MessageSquare, Clock, RotateCcw, Check, Search } from 'lucide-react';
import api from '../api';
import CreativeViewModal from '../components/CreativeViewModal';
import ReferenceCreativeModal from '../components/ReferenceCreativeModal';
import DesignOutputModal from '../components/DesignOutputModal';
import { PLATFORMS } from '../components/creativePlatforms';
import { errMsg, fmtDay, fmtDateTime } from '../sopUtils';
import '../style.css';
import '../styles/mom.css';
import '../styles/calendar.css';
import '../styles/smecreatives.css';
const TABS = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Redo' },
  { value: 'designer', label: 'Designer Output' },
  { value: 'all', label: 'All' },
];

const STEPS = ['Sent', 'Approved', 'Designing', 'Delivered'];

// Which of the four steps a creative is on, and what the SME should do next, in plain words.
const progressOf = (c) => {
  const out = c.designOutput;
  if (c.status === 'pending') return { step: 0, tone: 'wait', text: 'Waiting for admin to review.' };
  if (c.status === 'rejected') {
    return { step: 0, tone: 'action', text: c.reviewNote ? `Admin asked for a redo: ${c.reviewNote}` : 'Admin asked for a redo. Edit it and send it again.' };
  }
  if (out?.status === 'approved') {
    if (c.clientFeedback?.open > 0) {
      return { step: 3, tone: 'action', text: `Client left ${c.clientFeedback.open} comment${c.clientFeedback.open > 1 ? 's' : ''}. Review and send back to the designer.` };
    }
    return { step: 4, tone: 'done', text: 'Design approved. Nothing left to do.' };
  }
  if (out?.status === 'submitted') return { step: 2, tone: 'action', text: 'Designer sent the design. Please review it.' };
  if (out?.status === 'redo') return { step: 2, tone: 'wait', text: out.redoBy === 'client' ? 'Client asked for changes. Designer is fixing it.' : 'Sent back to the designer for changes.' };
  if (c.assignedDesigner) return { step: 2, tone: 'wait', text: `${c.assignedDesigner.name} is working on it.` };
  return { step: 1, tone: 'action', text: 'Approved by admin. Choose a designer to start the work.' };
};

const STATUS_LABEL = { pending: 'Pending', approved: 'Approved', rejected: 'Redo' };
const EMPTY_TEXT = {
  pending: 'Nothing is waiting for admin right now.',
  approved: 'No approved creatives yet.',
  rejected: 'No redo requests. Nice work!',
  designer: 'No designer output yet.',
  all: 'You have not sent any creatives yet.',
};
const SmePendingCreatives = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('pending');
  const [query, setQuery] = useState('');
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
  const q = query.trim().toLowerCase();
  const shown = items.filter((i) => (
    (tab === 'all' || (tab === 'designer' ? Boolean(i.designOutput) : i.status === tab)) &&
    (!q || `${i.companyName || ''} ${i.contentPillar.title}`.toLowerCase().includes(q))
  ));
  // things waiting on the SME, so they know what to do first
  const needsAction = items.filter((i) => progressOf(i).tone === 'action').length;
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
    <div className="dashboard-content scrollable sc-page">
      <div className="page-header">
        <div>
          <span className="page-label">SME WORKSPACE</span>
          <h1>Creatives</h1>
          <p>Track every creative from the moment you send it to the final design.</p>
        </div>
        {needsAction > 0 && (
          <button type="button" className="sc-attention" onClick={() => { setTab('all'); setQuery(''); }}>
            <span className="sc-attention-dot" />
            {needsAction} need{needsAction === 1 ? 's' : ''} your action
          </button>
        )}
      </div>

      <div className="sc-toolbar">
        <div className="sc-tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={tab === t.value}
              className={tab === t.value ? 'active' : ''}
              onClick={() => setTab(t.value)}
            >
              {t.label}
              <b>{counts[t.value]}</b>
            </button>
          ))}
        </div>
        <label className="sc-search">
          <Search size={15} />
          <input type="search" placeholder="Search brand or title" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
      </div>

      {error && <p className="error-message" role="alert">{error}</p>}

      {loading ? (
        <p className="muted">Loading…</p>
      ) : shown.length === 0 ? (
        <div className="sc-empty">
          <Palette size={28} />
          <p>{q ? 'Nothing matches your search.' : EMPTY_TEXT[tab]}</p>
        </div>
      ) : (
        <div className="sc-list">
          {shown.map((c) => {
            const prog = progressOf(c);
            const out = c.designOutput;
            const canAssign = c.status === 'approved' && tab !== 'designer' && (!out || out.status === 'redo');
            return (
              <article key={c.id} className={`sc-card ${prog.tone}`}>
                <button type="button" className="sc-thumb" onClick={() => setViewing(c)} title="Preview creative" aria-label="Preview creative">
                  {c.uploads[0] ? <img src={c.uploads[0].url} alt="" /> : <ImageIcon size={26} />}
                  <span className="sc-thumb-hover"><Eye size={16} /> Preview</span>
                </button>

                <div className="sc-main">
                  <div className="sc-top">
                    <span className="sc-brand">{c.companyName || 'Brand'}</span>
                    <span className={`sc-status ${c.status}`}>
                      {c.status === 'pending' && <Clock size={12} />}
                      {c.status === 'approved' && <Check size={12} />}
                      {c.status === 'rejected' && <RotateCcw size={12} />}
                      {STATUS_LABEL[c.status] || c.status}
                    </span>
                  </div>
                  <h3 className="sc-title">{c.contentPillar.title}</h3>
                  <p className="sc-meta">
                    <span>For {fmtDay(c.date)}</span>
                    <span>Sent {fmtDateTime(c.createdAt)}</span>
                    <span className="sc-platforms">
                      {c.contentPillar.platforms.map((pk) => {
                        const P = PLATFORMS.find((p) => p.key === pk);
                        return P ? <i key={pk} title={P.label}><P.icon size={14} /></i> : null;
                      })}
                    </span>
                  </p>

                  <ol className="sc-steps" aria-label="Progress">
                    {STEPS.map((label, i) => (
                      <li key={label} className={i < prog.step ? 'done' : i === prog.step ? 'now' : ''}>
                        <span className="sc-dot">{i < prog.step ? <Check size={11} /> : i + 1}</span>
                        <span className="sc-step-label">{label}</span>
                      </li>
                    ))}
                  </ol>

                  <p className={`sc-next ${prog.tone}`}>
                    {prog.tone === 'done' ? <CheckCircle2 size={15} /> : prog.tone === 'action' ? <MessageSquare size={15} /> : <Clock size={15} />}
                    <span>{prog.text}</span>
                  </p>

                  {c.status === 'approved' && c.assignedDesigner && (
                    <p className="sc-designer"><UserRoundPlus size={13} /> Designer: <strong>{c.assignedDesigner.name}</strong></p>
                  )}
                  {out && (
                    <button type="button" className="sc-output" onClick={() => setReviewing(c)}>
                      {(out.mimeType || '').startsWith('image/') ? <img src={out.url} alt="" /> : <Palette size={18} />}
                      <span>
                        <strong>Designer output</strong>
                        <em>{out.name || 'Design file'}</em>
                      </span>
                    </button>
                  )}
                </div>

                <div className="sc-actions">
                  {c.status === 'rejected' && (
                    <button type="button" className="btn-primary" onClick={() => setEditing(c)}>
                      <Pencil size={14} /> Edit &amp; resend
                    </button>
                  )}
                  {out?.status === 'submitted' && (
                    <button type="button" className="btn-primary" onClick={() => setReviewing(c)}>
                      <Palette size={14} /> Review design
                    </button>
                  )}
                  {out?.status === 'approved' && c.clientFeedback?.open > 0 && (
                    <button type="button" className="btn-primary" onClick={() => setReviewing(c)}>
                      <MessageSquare size={14} /> See client feedback
                    </button>
                  )}
                  {canAssign && (
                    <button type="button" className={c.assignedDesigner ? 'btn-ghost' : 'btn-primary'} onClick={() => openAssign(c)}>
                      <UserRoundPlus size={14} /> {c.assignedDesigner ? 'Change designer' : 'Choose designer'}
                    </button>
                  )}
                  {out && out.status !== 'submitted' && !(out.status === 'approved' && c.clientFeedback?.open > 0) && (
                    <button type="button" className="btn-ghost" onClick={() => setReviewing(c)}>
                      <Palette size={14} /> View design
                    </button>
                  )}
                  <button type="button" className="btn-ghost" onClick={() => setViewing(c)}>
                    <Eye size={14} /> Preview
                  </button>
                  {c.status === 'pending' && (
                    <button type="button" className="btn-ghost danger" onClick={() => withdraw(c)}>
                      <Trash2 size={14} /> Withdraw
                    </button>
                  )}
                </div>
              </article>
            );
          })}
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