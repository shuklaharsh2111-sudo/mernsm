import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import { X, CheckCircle2, RotateCcw, ExternalLink, FileText } from 'lucide-react';
import api from '../api';
import { errMsg, fmtDay, fmtDateTime } from '../sopUtils';

const STATUS = {
  submitted: { label: 'Waiting for review', className: 'pending' },
  approved: { label: 'Approved', className: 'approved' },
  redo: { label: 'Redo requested', className: 'rejected' },
};

const formatSize = (bytes) => {
  if (!bytes) return '—';
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

// SME: what the designer delivered for one creative. Approve it, or send it back with a redo note.
export default function DesignOutputModal({ creative, onUpdated, onClose }) {
  const out = creative.designOutput;
  const [redoing, setRedoing] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

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

  if (!out) return null;
  const st = STATUS[out.status] || STATUS.submitted;
  const isImage = (out.mimeType || '').startsWith('image/');
  const isVideo = (out.mimeType || '').startsWith('video/');

  return createPortal(
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="modal-card wide" role="dialog" aria-modal="true" aria-labelledby="design-output-title">
        <div className="modal-head">
          <h2 id="design-output-title">Designer Output</h2>
          <button type="button" className="modal-close" aria-label="Close" onClick={onClose} disabled={busy}>
            <X size={16} />
          </button>
        </div>
        <div className="modal-body">
          <div className="sops-form">
            <div className="design-preview">
              {isImage && <img src={out.url} alt={out.name || 'Designer output'} />}
              {isVideo && <video src={out.url} controls />}
              {!isImage && !isVideo && (
                <div className="design-preview-file">
                  <FileText size={34} />
                  <span>{out.name || 'Design file'}</span>
                </div>
              )}
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
              <p className="mom-note sent_back">Your redo note: {out.note}</p>
            )}
            {out.status === 'approved' && (
              <p className="mom-note approved"><CheckCircle2 size={15} /> Approved {fmtDateTime(out.reviewedAt)}.</p>
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
