import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Image as ImageIcon, Trash2, Pencil } from 'lucide-react';
import CreativeStatusBadge from './CreativeStatusBadge';
import { fmtDay } from '../sopUtils';

// Opens when a calendar day box is clicked: every creative planned that day.
// Click one to see its full details (onOpen). `paused` while the detail window is on top of this one.
export default function DayCreativesModal({ company, platformLabel, date, creatives, platforms, paused, onOpen, onEdit, onAdd, onDelete, onClose }) {
  useEffect(() => {
    if (paused) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, paused]);

  return createPortal(
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && !paused && onClose()}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="day-creatives-title" style={{ maxWidth: 640 }}>
        <div className="modal-head">
          <div>
            <h2 id="day-creatives-title">{fmtDay(date)}</h2>
            <p className="creative-sub">{company?.name} · {platformLabel} · {creatives.length} {creatives.length === 1 ? 'creative' : 'creatives'}</p>
          </div>
          <button type="button" className="modal-close" aria-label="Close" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="modal-body">
          {creatives.length === 0 ? (
            <p className="muted">Nothing planned for this day yet.</p>
          ) : (
            <ul className="day-list">
              {creatives.map((c) => {
                const { title, platforms: keys } = c.contentPillar;
                return (
                  <li key={c.id} className={`day-item ${c.status}`}>
                    <button type="button" className="day-item-open" onClick={() => onOpen(c)} title="View details">
                      <span className="day-item-thumb">
                        {c.uploads[0] ? <img src={c.uploads[0].url} alt="" /> : <ImageIcon size={20} />}
                      </span>
                      <span className="day-item-text">
                        <b>{title}</b>
                        <span className="day-item-meta">
                          <CreativeStatusBadge status={c.status} />
                          {keys.map((pk) => {
                            const P = platforms.find((p) => p.key === pk);
                            return P ? <P.icon key={pk} size={14} /> : null;
                          })}
                        </span>
                        {c.status === 'rejected' && c.reviewNote && <small className="day-item-note">Admin: {c.reviewNote}</small>}
                      </span>
                    </button>
                    {onEdit && c.status === 'rejected' && (
                      <button type="button" className="day-item-edit" aria-label={`Edit ${title} and resubmit`} title="Edit & resubmit" onClick={() => onEdit(c)}><Pencil size={15} /></button>
                    )}
                    {onDelete && <button type="button" className="day-item-del" aria-label={`Delete ${title}`} title="Delete" onClick={() => onDelete(c.id)}><Trash2 size={15} /></button>}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="modal-foot">
          <button type="button" className="btn-ghost" onClick={onClose}>Close</button>
          {onAdd && <button type="button" className="btn-primary" onClick={onAdd}><Plus size={15} /> Add {platformLabel} creative</button>}
        </div>
      </div>
    </div>,
    document.body
  );
}
