import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import { X, CheckCircle2, RotateCcw, ExternalLink, FileText, MessageSquare, Send } from 'lucide-react';
import api from '../api';
import { errMsg, fmtDay, fmtDateTime } from '../sopUtils';
import '../styles/designfeedback.css';

const STATUS = {
  submitted: { label: 'Waiting for review', className: 'pending' },
  approved: { label: 'Approved', className: 'approved' },
  redo: { label: 'Redo requested', className: 'rejected' },
};

const formatSize = (bytes) => {
  if (!bytes) return '—';
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

const isImg = (m) => (m || '').startsWith('image/');
const isVid = (m) => (m || '').startsWith('video/');

function FilePreview({ url, name, mimeType }) {
  if (isImg(mimeType)) return <img src={url} alt={name || 'Design'} />;
  if (isVid(mimeType)) return <video src={url} controls />;
  return (
    <div className="design-preview-file">
      <FileText size={34} />
      <span>{name || 'Design file'}</span>
    </div>
  );
}

// SME: what the designer delivered for one creative. Approve it, or send it back with a redo note.
export default function DesignOutputModal({ creative, onUpdated, onClose }) {
  const out = creative.designOutput;
  const [redoing, setRedoing] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // client improvements (pins) on a final design, and sending it back to the designer
  const [fb, setFb] = useState(null);
  const [fbNote, setFbNote] = useState('');
  const [designers, setDesigners] = useState([]);
  const [designerId, setDesignerId] = useState(creative.assignedDesigner?.id || '');
  const [activePin, setActivePin] = useState('');

  useEffect(() => {
    if (!['approved', 'redo'].includes(creative.designOutput?.status)) return undefined;
    let cancelled = false;
    api.get(`/sme/creatives/${creative.id}/client-feedback`)
      .then((r) => !cancelled && setFb(r.data))
      .catch(() => !cancelled && setFb({ comments: [] }));
    api.get('/sme/designers')
      .then((r) => !cancelled && setDesigners(r.data.designers || []))
      .catch(() => {});
    return () => { cancelled = true; };
  }, [creative.id, creative.designOutput?.status]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && !busy && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, busy]);

  const review = async (action) => {
    if (action === 'redo' && !note.trim()) {
      setError('Please tell the designer what to change.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const { data } = await api.put(`/sme/creatives/${creative.id}/design-review`, {
        action,
        note: action === 'redo' ? note.trim() : '',
      });
      onUpdated(data.creative);
      onClose();
    } catch (err) {
      setError(errMsg(err));
      setBusy(false);
    }
  };

  const sendBack = async () => {
    if (!designerId) {
      setError('Please choose a designer.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const { data } = await api.put(`/sme/creatives/${creative.id}/send-to-designer`, {
        designerId,
        note: fbNote.trim(),
      });
      onUpdated(data.creative);
      onClose();
    } catch (err) {
      setError(errMsg(err));
      setBusy(false);
    }
  };

  if (!out) return null;
  const pins = fb?.comments || [];
  const openPins = pins.filter((p) => p.status === 'open');
  const showPins = ['approved', 'redo'].includes(out.status) && isImg(out.mimeType) && pins.length > 0;
  const st = out.status === 'redo' && out.redoBy === 'client'
    ? { label: 'Client redo requested', className: 'rejected' }
    : (STATUS[out.status] || STATUS.submitted);

  return createPortal(
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="modal-card design-modal" role="dialog" aria-modal="true" aria-labelledby="design-output-title">
        <div className="modal-head">
          <h2 id="design-output-title">Designer Output</h2>
          <button type="button" className="modal-close" aria-label="Close" onClick={onClose} disabled={busy}>
            <X size={16} />
          </button>
        </div>
        <div className="modal-body">
          <div className="sops-form">
            <div className="design-compare">
              <section className="design-col">
                <h3>Reference</h3>
                {creative.uploads?.length > 0 ? (
                  <div className="design-ref-list">
                    {creative.uploads.map((u, i) => (
                      <a key={`${u.url}-${i}`} className="design-preview" href={u.url} target="_blank" rel="noopener noreferrer" title="Open reference">
                        <img src={u.url} alt={u.name || `Reference ${i + 1}`} />
                      </a>
                    ))}
                  </div>
                ) : (
                  <div className="design-preview"><div className="design-preview-file"><FileText size={30} /><span>No reference image</span></div></div>
                )}
                {creative.referenceLinks?.length > 0 && (
                  <div className="design-ref-links">
                    {creative.referenceLinks.map((l, i) => (
                      <a key={`${l}-${i}`} href={l} target="_blank" rel="noopener noreferrer"><ExternalLink size={12} /> Reference link {i + 1}</a>
                    ))}
                  </div>
                )}
              </section>
              <section className="design-col">
                <h3>Designer output <span className="muted">· v{out.version}</span></h3>
                <div className="design-preview">
                  {showPins ? (
                    <div className="dfb-stage">
                      <FilePreview url={out.url} name={out.name} mimeType={out.mimeType} />
                      {pins.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          className={`dfb-pin ${p.status} ${p.id === activePin ? 'active' : ''}`}
                          style={{ left: `${p.x}%`, top: `${p.y}%` }}
                          title={`${p.author.name}: ${p.text}`}
                          aria-label={`Client comment ${p.n}: ${p.text}`}
                          onClick={() => setActivePin(p.id)}
                        >{p.n}</button>
                      ))}
                    </div>
                  ) : (
                    <FilePreview url={out.url} name={out.name} mimeType={out.mimeType} />
                  )}
                </div>
              </section>
            </div>

            <div className="design-meta">
              <div><span>Creative</span><b>{creative.contentPillar.title}</b></div>
              <div><span>Company</span><b>{creative.companyName || 'Brand'}</b></div>
              <div><span>Designer</span><b>{creative.assignedDesigner?.name || '—'}</b></div>
              <div><span>For date</span><b>{fmtDay(creative.date)}</b></div>
              <div><span>Uploaded</span><b>{fmtDateTime(out.uploadedAt)}</b></div>
              <div><span>File</span><b>{out.name || '—'} · {formatSize(out.size)}</b></div>
              <div><span>Version</span><b>v{out.version}{out.redoCount ? ` · ${out.redoCount} redo${out.redoCount > 1 ? 's' : ''} asked` : ''}</b></div>
              <div><span>Status</span><b><span className={`status-pill ${st.className}`}>{st.label}</span></b></div>
            </div>

            {out.status === 'redo' && out.note && (
              <p className="mom-note sent_back">{out.redoBy === 'client' ? 'Client feedback' : 'Your redo note'}: {out.note}</p>
            )}
            {out.status === 'approved' && (
              <p className="mom-note approved"><CheckCircle2 size={15} /> Approved {fmtDateTime(out.reviewedAt)}.</p>
            )}

            {['approved', 'redo'].includes(out.status) && pins.length > 0 && (
              <section className="dfb" aria-label="Client improvements">
                <h3><MessageSquare size={15} /> Client improvements <span className="muted">· v{fb.version || out.version}</span>
                  <i className={`status-pill ${openPins.length ? 'rejected' : 'approved'}`}>{openPins.length ? `${openPins.length} open` : 'All resolved'}</i>
                </h3>
                <ul className="dfb-list">
                  {pins.map((p) => (
                    <li key={p.id} className={`${p.status} ${p.id === activePin ? 'active' : ''}`} onClick={() => setActivePin(p.id)}>
                      <span className="dfb-badge">{p.n}</span>
                      <div>
                        <b>{p.author.name}</b> <small>{fmtDateTime(p.createdAt)}{p.status === 'resolved' ? ' · resolved' : ''}</small>
                        <p>{p.text}</p>
                        {p.replies.map((r) => <p key={r.id} className="dfb-reply"><b>{r.author.name}:</b> {r.text}</p>)}
                      </div>
                    </li>
                  ))}
                </ul>
                {out.status === 'approved' && openPins.length > 0 && (
                  <div className="dfb-send">
                    <label className="x-field">
                      <span>Designer</span>
                      <select value={designerId} disabled={busy} onChange={(e) => setDesignerId(e.target.value)}>
                        <option value="">Choose a designer</option>
                        {creative.assignedDesigner && !designers.some((d) => d.id === creative.assignedDesigner.id) && (
                          <option value={creative.assignedDesigner.id}>{creative.assignedDesigner.name}</option>
                        )}
                        {designers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    </label>
                    <label className="x-field">
                      <span>Note for the designer (optional)</span>
                      <textarea
                        rows={3}
                        maxLength={500}
                        value={fbNote}
                        disabled={busy}
                        placeholder="Leave empty to send the client's comments as they are…"
                        onChange={(e) => setFbNote(e.target.value)}
                      />
                    </label>
                  </div>
                )}
              </section>
            )}

            {redoing && out.status === 'submitted' && (
              <label className="x-field">
                <span>What should the designer change? *</span>
                <textarea
                  rows={4}
                  maxLength={500}
                  value={note}
                  autoFocus
                  placeholder="Describe the changes you want…"
                  onChange={(e) => setNote(e.target.value)}
                />
              </label>
            )}

            {out.history?.length > 0 && (
              <section className="design-history">
                <h3>History <span className="muted">· earlier versions sent back for redo</span></h3>
                {out.history.map((h) => (
                  <div className="design-history-item" key={`${h.url}-${h.version}`}>
                    <div className="design-preview small">
                      <FilePreview url={h.url} name={h.name} mimeType={h.mimeType} />
                    </div>
                    <div className="design-history-body">
                      <div className="design-history-top">
                        <b>Version {h.version}</b>
                        <span className="status-pill rejected">Redo</span>
                      </div>
                      <p className="muted">Uploaded {fmtDateTime(h.uploadedAt)}{h.reviewedAt ? ` · sent back ${fmtDateTime(h.reviewedAt)}` : ''}</p>
                      {h.note && <p className="mom-note sent_back">Your redo note: {h.note}</p>}
                      <a className="design-history-open" href={h.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={12} /> Open file</a>
                    </div>
                  </div>
                ))}
              </section>
            )}

            {error && <p className="error-message" role="alert">{error}</p>}

            <div className="btn-row">
              {out.status === 'submitted' && !redoing && (
                <>
                  <button type="button" className="btn-primary" disabled={busy} onClick={() => review('approve')}>
                    <CheckCircle2 size={15} /> {busy ? 'Saving…' : 'Approve'}
                  </button>
                  <button type="button" className="btn-ghost" disabled={busy} onClick={() => { setRedoing(true); setError(''); }}>
                    <RotateCcw size={15} /> Redo
                  </button>
                </>
              )}
              {out.status === 'submitted' && redoing && (
                <>
                  <button type="button" className="btn-primary" disabled={busy} onClick={() => review('redo')}>
                    {busy ? 'Sending…' : 'Send redo to designer'}
                  </button>
                  <button type="button" className="btn-ghost" disabled={busy} onClick={() => { setRedoing(false); setError(''); }}>Back</button>
                </>
              )}
              {out.status === 'approved' && openPins.length > 0 && (
                <button type="button" className="btn-primary" disabled={busy || !designerId} onClick={sendBack}>
                  <Send size={15} /> {busy ? 'Sending…' : 'Send to designer again'}
                </button>
              )}
              <a className="btn-ghost design-open" href={out.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink size={14} /> Open file
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
