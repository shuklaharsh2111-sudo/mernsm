import { useEffect, useRef, useState } from 'react';
import { X, ChevronDown } from 'lucide-react';
import api from '../api';
import { errMsg } from '../sopUtils';

export default function AssignCompaniesModal({ user, companies, max, onSaved, onClose }) {
  const [selected, setSelected] = useState(() => user.companies.filter((id) => companies.some((c) => c.id === id)));
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const dropRef = useRef(null);

  const byId = Object.fromEntries(companies.map((c) => [c.id, c]));
  const full = selected.length >= max;

  const toggle = (id) =>
    setSelected((s) => {
      if (s.includes(id)) return s.filter((x) => x !== id);
      return s.length >= max ? s : [...s, id];
    });

  // Esc closes the dropdown first, then the modal. Clicking outside closes the dropdown.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (open) setOpen(false);
      else onClose();
    };
    const onDown = (e) => {
      if (open && dropRef.current && !dropRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open, onClose]);

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      await api.put(`/admin/users/${user.id}/companies`, { companies: selected });
      onSaved();
    } catch (err) {
      setError(errMsg(err));
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="assign-title">
        <div className="modal-head">
          <h2 id="assign-title">Assign Companies</h2>
          <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="modal-body">
          <p className="modal-text">
            Select up to {max} companies for <b>{user.name}</b>.
          </p>
          <p className="modal-text">
            Selected: <b className="modal-count">{selected.length}</b>/{max}
          </p>

          <div className="assign-drop" ref={dropRef}>
            <button
              type="button"
              className={`assign-trigger ${open ? 'open' : ''}`}
              aria-haspopup="listbox"
              aria-expanded={open}
              onClick={() => setOpen((o) => !o)}
            >
              <span>{selected.length ? `${selected.length} selected` : 'Select companies'}</span>
              <ChevronDown size={18} />
            </button>

            {open && (
              <ul className="assign-menu" role="listbox" aria-multiselectable="true">
                {companies.length === 0 && <li className="assign-empty">No companies yet. Add some under Companies first.</li>}
                {companies.map((c) => {
                  const on = selected.includes(c.id);
                  const locked = full && !on;
                  return (
                    <li key={c.id} role="option" aria-selected={on}>
                      <label className={`assign-option ${on ? 'on' : ''} ${locked ? 'locked' : ''}`}>
                        <input type="checkbox" checked={on} disabled={locked} onChange={() => toggle(c.id)} />
                        <span>{c.name}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {full && <p className="modal-hint">Maximum of {max} companies reached. Remove one to add another.</p>}

          <div className="assign-chips">
            {selected.map((id) =>
              byId[id] ? (
                <span key={id} className="assign-chip">
                  {byId[id].name}
                  <button type="button" aria-label={`Remove ${byId[id].name}`} onClick={() => toggle(id)}>
                    <X size={12} />
                  </button>
                </span>
              ) : null
            )}
          </div>

          {error && <p className="error-message" role="alert">{error}</p>}
        </div>

        <div className="modal-foot">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="btn-primary" disabled={busy} onClick={save}>
            {busy ? 'Saving…' : 'Save Assignments'}
          </button>
        </div>
      </div>
    </div>
  );
}
