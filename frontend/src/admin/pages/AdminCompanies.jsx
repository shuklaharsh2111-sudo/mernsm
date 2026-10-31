import { useEffect, useRef, useState } from 'react';
import { useAdminAuth } from '../context/AdminAuthContext';
import { createCompany, deleteCompany, getCompanies, updateCompany } from '../api/adminApi';
import CompanyBadge from '../../shared/CompanyBadge';
import { toLogoDataUrl } from '../../shared/logo';

export default function AdminCompanies() {
  const { token } = useAdminAuth();
  const fileRef = useRef(null);
  const [companies, setCompanies] = useState([]);
  const [max, setMax] = useState(5);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(null); // { id?, name, logo }
  const [busy, setBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey((k) => k + 1);

  useEffect(() => {
    let cancelled = false;
    getCompanies(token)
      .then((d) => {
        if (cancelled) return;
        setError('');
        setCompanies(d.companies);
        setMax(d.max);
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [token, reloadKey]);

  const onPickLogo = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    try {
      const logo = await toLogoDataUrl(file);
      setForm((f) => ({ ...f, logo }));
    } catch (err) {
      setError(err.message);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { id, ...body } = form;
      if (id) await updateCompany(token, id, body);
      else await createCompany(token, body);
      setForm(null);
      reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (c) => {
    if (!window.confirm(`Delete ${c.name}? It will be unassigned from every user.`)) return;
    setError('');
    try {
      await deleteCompany(token, c.id);
      reload();
    } catch (err) {
      setError(err.message);
    }
  };

  const full = companies.length >= max;

  return (
    <>
      <div className="sop-head">
        <h1 className="admin-title">Companies</h1>
        <button
          type="button"
          className="admin-btn sop-new"
          disabled={full}
          title={full ? `Limit of ${max} companies reached` : ''}
          onClick={() => setForm({ name: '', logo: '' })}
        >
          + Add Company
        </button>
      </div>
      <p className="sop-meta companies-note">
        {companies.length} of {max} companies. Each one appears as a round badge on the dashboard of
        users you assign it to (grey for users who don’t have it).
      </p>

      {error && <p className="admin-error" role="alert">{error}</p>}

      {form && (
        <form className="admin-panel sop-form" onSubmit={submit}>
          <h2>{form.id ? 'Edit company' : 'Add company'}</h2>
          <div className="company-form-row">
            <CompanyBadge company={{ name: form.name || '?', logo: form.logo }} size={88} />
            <div className="company-form-fields">
              <label className="admin-field">
                <span>Company name</span>
                <input value={form.name} maxLength={80} required onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </label>
              <div className="sop-actions company-logo-actions">
                <button type="button" className="sop-btn ghost" onClick={() => fileRef.current.click()}>
                  {form.logo ? 'Change logo' : 'Upload logo'}
                </button>
                {form.logo && (
                  <button type="button" className="sop-btn ghost danger" onClick={() => setForm({ ...form, logo: '' })}>
                    Remove logo
                  </button>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPickLogo} />
            </div>
          </div>
          <div className="sop-actions">
            <button className="admin-btn sop-inline" disabled={busy}>
              {busy ? 'Saving…' : form.id ? 'Save changes' : 'Add company'}
            </button>
            <button type="button" className="sop-btn ghost" onClick={() => setForm(null)}>Cancel</button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="admin-loading">Loading companies…</p>
      ) : companies.length === 0 ? (
        <div className="admin-panel"><p>No companies yet. Click “+ Add Company”.</p></div>
      ) : (
        <div className="company-grid">
          {companies.map((c) => (
            <div key={c.id} className="admin-panel company-card">
              <CompanyBadge company={c} size={84} />
              <h3>{c.name}</h3>
              <div className="sop-actions">
                <button
                  type="button"
                  className="sop-btn ghost"
                  onClick={() => setForm({ id: c.id, name: c.name, logo: c.logo })}
                >
                  Edit
                </button>
                <button type="button" className="sop-btn ghost danger" onClick={() => remove(c)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
