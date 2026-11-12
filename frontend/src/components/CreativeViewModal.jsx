import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Pencil } from 'lucide-react';
import CreativeDetails from './CreativeDetails';
import CreativeStatusBadge from './CreativeStatusBadge';
import PlatformPreviewSwitcher from './PlatformPreviewSwitcher';
import { fmtDay } from '../sopUtils';
// Read-only view of a saved creative: its image in every chosen platform's shape.
export default function CreativeViewModal({ creative, company, platforms, onEdit, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  const { title, caption, hashtags, platforms: keys } = creative.contentPillar;
  const image = creative.uploads[0]?.url || '';
  const chosen = platforms.filter((p) => keys.includes(p.key));
  return createPortal(
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card creative-wide" role="dialog" aria-modal="true" aria-labelledby="creative-view-title">
        <div className="modal-head">
          <div>
            <h2 id="creative-view-title">{title}</h2>
            <p className="creative-sub">{company?.name} · {fmtDay(creative.date)} <CreativeStatusBadge status={creative.status} /></p>
          </div>
          <button type="button" className="modal-close" aria-label="Close" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          {creative.status === 'rejected' && (
            <p className="mom-note rejected">Admin asked for a redo{creative.reviewNote ? `: ${creative.reviewNote}` : '.'}</p>
          )}
          <CreativeDetails creative={creative} />
          {creative.uploads.length > 1 && (
            <div className="creative-thumbs">
              {creative.uploads.map((u, i) => (
                <a key={u.url + i} className="creative-thumb" href={u.url} target="_blank" rel="noreferrer noopener" title={u.name}><img src={u.url} alt={u.name || 'Reference'} /></a>
              ))}
            </div>
          )}
          <PlatformPreviewSwitcher platforms={chosen} image={image} title={title} caption={caption} hashtags={hashtags} />
        </div>
        <div className="modal-foot">
          <button type="button" className="btn-ghost" onClick={onClose}>Close</button>
          {creative.status === 'rejected' && onEdit && (
            <button type="button" className="btn-primary" onClick={() => onEdit(creative)}><Pencil size={15} /> Edit &amp; resubmit</button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
