import { Plus } from 'lucide-react';
import { PERIOD_WORD, fmtDateTime, fmtDay, typeLabel } from '../sopUtils';
import '../styles/smisops.css';

// SME dashboard: every SOP I handed to an SMI, and whether they have ticked it this period.
export default function SmiSopsPanel({ list, onNew, onEdit, onDelete }) {
  return (
    <div className="smi-sop-wrap">
      <div className="dash-section-title">SOPs assigned to SMIs</div>
      <div className="glass-panel sop-panel">
        <div className="sop-head">
          <div>
            <h2>SMI SOPs</h2>
            <p className="sop-sub">
              {list ? `${list.filter((a) => a.done || a.completedBySme).length} of ${list.length} ticked for the current period` : 'Loading…'}
            </p>
          </div>
          <div className="sop-head-actions">
            <button type="button" className="add-meeting-btn" onClick={onNew}>
              <Plus size={16} /> Assign new SOP
            </button>
          </div>
        </div>

        {!list ? (
          <p className="muted">Loading…</p>
        ) : list.length === 0 ? (
          <p className="muted">
            Nothing assigned to an SMI yet. Use “Assign to SMI” on any of your SOPs above, or “Assign new SOP”.
          </p>
        ) : (
          <div className="sop-list">
            {list.map((a) => (
              <div key={a.id} className={`sme-sop smi-sop-item ${a.done || a.completedBySme ? 'done' : ''}`}>
                <div className="sme-sop-body">
                  <div className="sop-item-top">
                    <span className={`sop-pill ${a.type}`}>{typeLabel(a.type)}</span>
                    <b>{a.company.name}</b>
                    <span className="muted">→</span>
                    <span className="smi-name">{a.smi.name}</span>
                    <span className={`sop-status ${a.done || a.completedBySme ? 'done' : 'todo'}`}>
                      {a.completedBySme ? 'Completed by you' : a.done ? `Done ${PERIOD_WORD[a.type]}` : 'Pending'}
                    </span>
                  </div>
                  <p className="sop-item-text">{a.text}</p>
                  <span className="muted">
                    Starts {fmtDay(a.date)} · ticked {a.doneCount}×{a.lastDoneAt ? ` · last ${fmtDateTime(a.lastDoneAt)}` : ''}
                  </span>
                  <div className="sop-row-actions">
                    {a.sourceSop ? (
                      <span className="muted" title="Assigned by admin, so it can’t be edited once it is with an SMI">
                        Assigned by admin · locked
                      </span>
                    ) : (
                      <button type="button" className="btn-ghost" onClick={() => onEdit(a)}>Edit</button>
                    )}
                    <button type="button" className="btn-ghost danger" onClick={() => onDelete(a)}>Remove</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
