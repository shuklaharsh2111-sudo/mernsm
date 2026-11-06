import { useEffect, useState } from 'react';
import { Plus, Trash2, Building2, ImagePlus, X } from 'lucide-react';
import api from '../api';
import axios from 'axios';
import { errMsg } from '../sopUtils';
const AdminCompanies = () => {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [logo, setLogo] = useState(null);
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey((k) => k + 1);
  useEffect(() => {
    let cancelled = false;
    api.get('/admin/companies')
      .then((res) => {
        if (cancelled) return;
        setCompanies(res.data.companies || []);
        setError('');
      })
      .catch((err) => !cancelled && setError(errMsg(err)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);
  useEffect(() => {
    if (!logo) {
      setPreview('');
      return;
    }
    const url = URL.createObjectURL(logo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [logo]);
  const handleLogo = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setError('Only JPG, PNG and WEBP images are allowed');
      e.target.value = '';
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Logo size must be less than 10MB');
      e.target.value = '';
      return;
    }
    setError('');
    setLogo(file);
  };
  const add = async (e) => {
    e.preventDefault();
    if (!logo) {
      setError('Please select a company logo');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('name', name.trim());
      formData.append('logo', logo);
      await axios.post('/api/admin/companies', formData, {
        withCredentials: true
      });
      setName('');
      setLogo(null);
      reload();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };
  const remove = async (c) => {
    if (!window.confirm(`Delete ${c.name}? It will be removed from every SME and its SOPs will also be deleted.`)) return;
    setError('');
    try {
      await api.delete(`/admin/companies/${c.id}`);
      reload();
    } catch (err) {
      setError(errMsg(err));
    }
  };
  return (
    <div className="dashboard-content scrollable">
      <div className="page-header">
        <div>
          <span className="page-label">ADMINISTRATION</span>
          <h1>Companies</h1>
          <p>Add companies with their logos and assign them to SMEs from the Users page.</p>
        </div>
      </div>
      <form className="glass-panel add-form inline" onSubmit={add}>
        <label className="x-field grow">
          <span>Company name *</span>
          <input
            value={name}
            required
            maxLength={60}
            placeholder="e.g. Lumina Creative"
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="x-field">
          <span>Company logo *</span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            required
            onChange={handleLogo}
          />
        </label>
        {preview && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img
              src={preview}
              alt="Logo preview"
              style={{ width: 54, height: 54, objectFit: 'contain', borderRadius: 10, background: '#fff', padding: 5 }}
            />
            <button
              type="button"
              className="btn-ghost danger"
              onClick={() => setLogo(null)}
              aria-label="Remove selected logo"
            >
              <X size={16} />
            </button>
          </div>
        )}
        <button className="btn-primary" disabled={busy}>
          <Plus size={16} />
          {busy ? 'Uploading…' : 'Add company'}
        </button>
      </form>
      {error && <p className="error-message" role="alert">{error}</p>}
      {loading ? (
        <p className="muted">Loading…</p>
      ) : companies.length === 0 ? (
        <div className="glass-panel">
          <p className="muted">No companies yet.</p>
        </div>
      ) : (
        <div className="user-list">
          {companies.map((c) => (
            <div key={c.id} className="glass-panel user-row">
              <div className="user-main" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                {c.logo ? (
                  <img
                    src={c.logo}
                    alt={`${c.name} logo`}
                    style={{ width: 52, height: 52, objectFit: 'contain', borderRadius: 10, background: '#fff', padding: 5 }}
                  />
                ) : (
                  <div style={{ width: 52, height: 52, display: 'grid', placeItems: 'center', borderRadius: 10, background: 'rgba(128,128,128,0.12)' }}>
                    <Building2 size={23} />
                  </div>
                )}
                <div>
                  <h3>{c.name}</h3>
                  <span className="muted" style={{ fontSize: 12 }}>
                    {c.logo ? 'Logo uploaded' : 'No logo available'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="btn-ghost danger"
                aria-label={`Delete ${c.name}`}
                onClick={() => remove(c)}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
export default AdminCompanies;