import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import api from '../api';
import { SOP_TYPES, errMsg, fmtDay, todayStr, typeLabel } from '../sopUtils';
import '../styles/smisops.css';

// SME -> SMI. Three uses:
//  - sop given: forward one of my own SOPs (company / type / text / date are fixed, the admin set them)
//  - edit given: change an SOP I already assigned to an SMI (a forwarded one only lets me change the SMI)
//  - neither: write a brand new SOP for an SMI
export default function AssignSopToSmiModal({ companies, sop = null, edit = null, onSaved, onClose }) {
  const [smis, setSmis] = useState([]);
  const [form, setForm] = useState(() => ({
    smi: edit?.smi.id || '',
    company: edit?.company.id || sop?.company.id || companies[0]?.id || '',
    type: edit?.type || sop?.type || 'daily',
    text: edit?.text || sop?.text || '',
    date: edit?.date || todayStr(),
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const forwarding = Boolean(sop) && !edit;
  // Admin-assigned SOPs keep the admin's company, type, text and date.
  const locked = forwarding || Boolean(edit?.sourceSop);
  const fixed = sop || edit;

  useEffect(() => {
    let cancelled = false;
    api
      .get('/sme/smis')
      .then((res) => {
        if (cancelled) return;
        setSmis(res.data.smis);
        setForm((f) => (f.smi || !res.data.smis[0] ? f : { ...f, smi: res.data.smis[0].id }));
      })
      .catch((err) => !cancelled && setError(errMsg(err)));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const body = {
        ...form,
        ...(locked ? { company: fixed.company.id, type: fixed.type, text: fixed.text, date: fixed.date } : {}),
        today: todayStr(),
        ...(forwarding ? { sourceSop: sop.id } : {}),
      };
      const res = edit
        ? await api.put(`/sme/smi-sops/${edit.id}`, body)
        : await api.post('/sme/smi-sops', body);
      onSaved(res.data.assignment, Boolean(edit));
    } catch (err) {
      setError(errMsg(err));
      setBusy(false);
    }
  };

  const typeName = typeLabel(form.type);
  const title = edit ? 'Edit SMI SOP' : forwarding ? 'Assign SOP to SMI' : 'Assign new SOP to SMI';

  return createPortal(
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="smi-sop-title">
        <div className="modal-head">
          <h2 id="smi-sop-title">{title}</h2>
          <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="modal-body">
          {companies.length === 0 ? (
            <p className="error-message">You have no companies yet, so there is nothing to assign an SOP for.</p>
          ) : (
            <form onSubmit={submit} className="sops-form">
              {locked && (
                <div className="sop-preview">
                  <div className="sop-item-top">
                    <span className={`sop-pill ${fixed.type}`}>{typeLabel(fixed.type)}</span>
                    <b>{fixed.company.name}</b>
                    <span className="muted">Starts {fmtDay(fixed.date)}</span>
                  </div>
                  <p className="sop-item-text">{fixed.text}</p>
                  <p className="muted">Assigned by admin, so its date and details can’t be changed.</p>
                </div>
              )}

              <label className="x-field">
                <span>Assign to SMI *</span>
                <select value={form.smi} required onChange={(e) => setForm({ ...form, smi: e.target.value })}>
                  {smis.length === 0 && <option value="">No SMI users found</option>}
                  {smis.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </label>

              {!locked && (
                <>
                  <label className="x-field">
                    <span>Company *</span>
                    <select value={form.company} required onChange={(e) => setForm({ ...form, company: e.target.value })}>
                      {companies.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </label>

                  <div className="x-field">
                    <span>SOP Type *</span>
                    <div className="sops-types" role="radiogroup" aria-label="SOP type">
                      {SOP_TYPES.map((t) => (
                        <label key={t.value} className={`sops-type ${form.type === t.value ? 'on' : ''}`}>
                          <input
                            type="radio"
                            name="smi-sop-type"
                            value={t.value}
                            checked={form.type === t.value}
                            onChange={() => setForm({ ...form, type: t.value })}
                          />
                          {t.label}
                        </label>
                      ))}
                    </div>
                  </div>

                  <label className="x-field">
                    <span>Enter {typeName} SOP *</span>
                    <textarea
                      rows={5}
                      maxLength={5000}
                      required
                      value={form.text}
                      placeholder={`Write the ${typeName.toLowerCase()} SOP here…`}
                      onChange={(e) => setForm({ ...form, text: e.target.value })}
                    />
                  </label>
                </>
              )}

              {!locked && (
                <label className="x-field">
                  <span>Start date *</span>
                  <input type="date" value={form.date} required onChange={(e) => setForm({ ...form, date: e.target.value })} />
                </label>
              )}

              {error && <p className="error-message" role="alert">{error}</p>}

              <div className="btn-row">
                <button className="btn-primary" disabled={busy || !form.smi}>
                  {busy ? 'Saving…' : edit ? 'Save changes' : 'Assign'}
                </button>
                <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
