import { useEffect, useRef, useState } from 'react';
import { Plus, Trash2, Building2, ImagePlus, X, Key } from 'lucide-react';
import api from '../api';
import { errMsg } from '../sopUtils';
import '../styles/admincompanies.css';
const AdminCompanies = () => {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loginFor, setLoginFor] = useState(null); // company whose login is being edited
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPw, setLoginPw] = useState('');
  const [logo, setLogo] = useState(null);
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const fileRef = useRef(null);
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
  const clearLogo = () => {
    setLogo(null);
    if (fileRef.current) fileRef.current.value = '';
  };
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
      formData.append('email', email.trim());
      formData.append('password', password);
      formData.append('logo', logo);
      await api.post('/admin/companies', formData);
      setName('');
      setEmail('');
      setPassword('');
      clearLogo();
      reload();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };
  const openLogin = (c) => {
    if (loginFor === c.id) { setLoginFor(null); return; }
    setLoginFor(c.id);
    setLoginEmail(c.email || '');
    setLoginPw('');
  };
  const saveLogin = async (e, c) => {
    e.preventDefault();
    setError('');
    try {
      await api.put(`/admin/companies/${c.id}/login`, { email: loginEmail.trim(), password: loginPw });
      setLoginFor(null);
      reload();
    } catch (err) {
      setError(errMsg(err));
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
      <form className="ac-form" onSubmit={add}>
        <div className="ac-logo-pick">
          <div className="ac-logo-preview">
            {preview ? <img src={preview} alt="Logo preview" /> : <Building2 size={28} />}
          </div>
          <label className="ac-upload">
            <ImagePlus size={15} /> {logo ? 'Change logo' : 'Upload logo'}
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleLogo}
              hidden
            />
          </label>
          <small>{logo ? logo.name : 'JPG, PNG or WEBP · max 10 MB'}</small>
          {logo && (
            <button type="button" className="ac-remove" onClick={clearLogo}>
              <X size={13} /> Remove
            </button>
          )}
        </div>
        <div className="ac-fields">
          <label className="x-field">
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
            <span>Company email *</span>
            <input
              type="email"
              value={email}
              required
              autoComplete="off"
              placeholder="company@example.com"
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="x-field">
            <span>Password * (min 8 characters)</span>
            <input
              type={showPw ? 'text' : 'password'}
              value={password}
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="Set a password"
              onChange={(e) => setPassword(e.target.value)}
            />
            <button type="button" className="ac-remove" onClick={() => setShowPw((v) => !v)}>{showPw ? 'Hide' : 'Show'} password</button>
          </label>
          <button className="btn-primary" disabled={busy}>
            <Plus size={16} />
            {busy ? 'Uploading…' : 'Add company'}
          </button>
        </div>
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
            <div key={c.id}>
            <div className="glass-panel user-row">
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
                    {c.email || 'No email set'}
                  </span>
                </div>
              </div>
              <button type="button" className="btn-ghost" onClick={() => openLogin(c)}>
                <Key size={15} /> {c.hasLogin ? 'Login' : 'Set login'}
              </button>
              <button
                type="button"
                className="btn-ghost danger"
                aria-label={`Delete ${c.name}`}
                onClick={() => remove(c)}
              >
                <Trash2 size={15} />
              </button>
            </div>
            {loginFor === c.id && (
              <form className="ac-login" onSubmit={(e) => saveLogin(e, c)}>
                <input type="email" required value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder="Company email" autoComplete="off" />
                <input type="password" minLength={8} required={!c.hasLogin} value={loginPw} onChange={(e) => setLoginPw(e.target.value)} placeholder={c.hasLogin ? 'New password (leave empty to keep)' : 'Password (min 8)'} autoComplete="new-password" />
                <button className="btn-primary">Save login</button>
              </form>
            )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
export default AdminCompanies;