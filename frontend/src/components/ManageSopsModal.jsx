import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import api from '../api';
import { SOP_TYPES, errMsg, fmtDay, todayStr, typeLabel } from '../sopUtils';

const emptyForm = (companyId = '') => ({ id: null, company: companyId, type: 'daily', text: '', date: todayStr() });

export default function ManageSopsModal({ user, companies, onClose }) {
  // Only companies the admin assigned to this user can get an SOP.
  const userCompanies = companies.filter((c) => user.companies.includes(c.id));
  const byId = Object.fromEntries(companies.map((c) => [c.id, c]));

  const [form, setForm] = useState(() => emptyForm(userCompanies[0]?.id || ''));
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey((k) => k + 1);

  useEffect(() => {
    let cancelled = false;
    api
      .get(`/admin/users/${user.id}/sop-assignments`)
      .then((res) => {
        if (cancelled) return;
        setList(res.data.assignments);
        setError('');
      })
      .catch((err) => !cancelled && setError(errMsg(err)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [user.id, reloadKey]);

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
      const { id, ...body } = form;
      if (id) await api.put(`/admin/users/${user.id}/sop-assignments/${id}`, body);
      else await api.post(`/admin/users/${user.id}/sop-assignments`, body);
      setForm(emptyForm(form.company));
      reload();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const onEdit = (a) => setForm({ id: a.id, company: a.company, type: a.type, text: a.text, date: a.date });

  const onDelete = async (a) => {
    if (!window.confirm('Delete this SOP?')) return;
    setError('');
    try {
      await api.delete(`/admin/users/${user.id}/sop-assignments/${a.id}`);
      if (form.id === a.id) setForm(emptyForm(form.company));
      reload();
    } catch (err) {
      setError(errMsg(err));
    }
  };

  const typeName = typeLabel(form.type);

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card wide" role="dialog" aria-modal="true" aria-labelledby="sops-title">
        <div className="modal-head">
          <h2 id="sops-title">Manage SOPs</h2>
          <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="modal-body">
          <p className="modal-text">SME: <b>{user.name}</b></p>

          {userCompanies.length === 0 ? (
            <p className="error-message">
              No companies are assigned to {user.name} yet. Use “Assign Companies” first, then come back here.
            </p>
          ) : (
            <form onSubmit={submit} className="sops-form">
              <label className="x-field">
                <span>Company *</span>
                <select value={form.company} required onChange={(e) => setForm({ ...form, company: e.target.value })}>
                  {userCompanies.map((c) => (
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
                        name="sop-type"
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

              <label className="x-field">
                <span>SOP Date *</span>
                <input type="date" value={form.date} required onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </label>

              {error && <p className="error-message" role="alert">{error}</p>}

              <div className="btn-row">
                <button className="btn-primary" disabled={busy}>
                  {busy ? 'Saving…' : form.id ? 'Save changes' : 'Add SOP'}
                </button>
                {form.id && (
                  <button type="button" className="btn-ghost" onClick={() => setForm(emptyForm(form.company))}>
                    Cancel edit
                  </button>
                )}
              </div>
            </form>
          )}

          {userCompanies.length === 0 && error && <p className="error-message" role="alert">{error}</p>}

          <div className="sops-existing">
            <h3>Assigned SOPs ({list.length})</h3>
            {loading ? (
              <p className="muted">Loading…</p>
            ) : list.length === 0 ? (
              <p className="muted">Nothing assigned yet.</p>
            ) : (
              <ul className="sops-list">
                {list.map((a) => (
                  <li key={a.id} className={form.id === a.id ? 'editing' : ''}>
                    <div className="sop-item-top">
                      <span className={`sop-pill ${a.type}`}>{typeLabel(a.type)}</span>
                      <b>{byId[a.company]?.name || 'Removed company'}</b>
                      <span className="muted">{fmtDay(a.date)}</span>
                      {a.doneCount > 0 && <span className="sop-done-tag">✓ Done {a.doneCount}×</span>}
                    </div>
                    <p className="sop-item-text">{a.text}</p>
                    <div className="btn-row small">
                      <button type="button" className="btn-ghost" onClick={() => onEdit(a)}>Edit</button>
                      <button type="button" className="btn-ghost danger" onClick={() => onDelete(a)}>Delete</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
