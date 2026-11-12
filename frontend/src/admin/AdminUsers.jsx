import { useEffect, useMemo, useState } from 'react';
import { UserPlus, Building2, ClipboardList, Trash2, Mail, Phone, UserCheck, CalendarDays, ImagePlus, Eye, EyeOff, X, Users } from 'lucide-react';
import api from '../api';
import { useAuth } from '../AuthContext';
import { errMsg } from '../sopUtils';
import AssignCompaniesModal from '../components/AssignCompaniesModal';
import ManageSopsModal from '../components/ManageSopsModal';
import "../styles/adminusers.css";
import { roleName } from '../roleNames';

const ROLES = ['ADMIN', 'REPORTING_MANAGER', 'SME', 'SMI', 'DES', 'CLIENTS'];
const roleLabel = roleName; // full role name, e.g. SME -> Social Media Executive
const emptyForm = { name: '', contact: '', email: '', password: '', reportingManagerId: '', role: 'SME', profileImage: null };
const initialsOf = (name = '') => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('') || 'U';
const fmtJoined = (d) => {
  const date = d ? new Date(d) : null;
  return date && !Number.isNaN(date.getTime())
    ? date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';
};

const AdminUsers = () => {
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [reportingManagers, setReportingManagers] = useState([]);
  const [max, setMax] = useState(5);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey((k) => k + 1);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState('');
  const [assignUser, setAssignUser] = useState(null);
  const [sopUser, setSopUser] = useState(null);
  const [roleFilter, setRoleFilter] = useState('ALL');

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.get('/admin/users'),
      api.get('/admin/companies'),
      api.get('/admin/reporting-managers')
    ])
      .then(([u, c, r]) => {
        if (cancelled) return;
        setUsers(u.data.users || []);
        setMax(u.data.maxAssigned || 5);
        setCompanies(c.data.companies || []);
        setReportingManagers(r.data.reportingManagers || []);
        setError('');
      })
      .catch((err) => !cancelled && setError(errMsg(err)))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [reloadKey]);

  // preview of the chosen profile image
  const previewUrl = useMemo(() => (form.profileImage ? URL.createObjectURL(form.profileImage) : ''), [form.profileImage]);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const byId = Object.fromEntries(companies.map((c) => [c.id || c._id, c]));
  const managerById = Object.fromEntries(reportingManagers.map((m) => [m.id || m._id, m]));

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    setForm((prev) => ({ ...prev, [name]: name === 'profileImage' ? files?.[0] || null : value }));
  };

  const closeForm = () => { setAdding(false); setForm(emptyForm); setShowPassword(false); };

  const addUser = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setCreated('');
    try {
      const payload = new FormData();
      payload.append('name', form.name.trim());
      payload.append('contact', form.contact.trim());
      payload.append('email', form.email.trim().toLowerCase());
      payload.append('password', form.password);
      payload.append('role', form.role);
      if (form.reportingManagerId) payload.append('reportingManagerId', form.reportingManagerId);
      // the backend upload field is called "image"
      if (form.profileImage) payload.append('image', form.profileImage);
      const res = await api.post('/admin/users', payload);
      setCreated(`${res.data.user.name} was added. They can log in with ${res.data.user.email}.`);
      closeForm();
      reload();
    } catch (err) {
      setError(err.response?.data?.message || errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const removeUser = async (u) => {
    if (String(u.id) === String(me?.id)) {
      setError('You cannot delete your own account.');
      return;
    }
    if (!window.confirm(`Delete ${u.name}? Their assigned SOPs will be deleted too.`)) return;
    setError('');
    setCreated('');
    try {
      // the server needs to know which collection (role group) the user lives in
      await api.delete(`/admin/users/${u.id}`, { params: { collection: u.collection } });
      reload();
    } catch (err) {
      setError(errMsg(err));
    }
  };

  const counts = users.reduce((acc, u) => ({ ...acc, [u.role]: (acc[u.role] || 0) + 1 }), {});
  const shown = roleFilter === 'ALL' ? users : users.filter((u) => u.role === roleFilter);

  return (
    <div className="dashboard-content scrollable au-page">
      <div className="page-header">
        <div>
          <span className="page-label">ADMINISTRATION</span>
          <h1>Users</h1>
          <p>Add Users, assign companies (max {max} each) and manage their SOPs.</p>
        </div>
        <button type="button" className="btn-primary" onClick={() => { adding ? closeForm() : setAdding(true); setCreated(''); setError(''); }}>
          {adding ? <><X size={16} /> Close</> : <><UserPlus size={16} /> Add User</>}
        </button>
      </div>

      {error && <p className="error-message" role="alert">{error}</p>}
      {created && <p className="success-message" role="status">{created}</p>}

      {adding && (
        <form className="au-form" onSubmit={addUser}>
          <div className="au-form-head">
            <h3><UserPlus size={17} /> New User</h3>
            <p>Fields marked * are required.</p>
          </div>

          <div className="au-form-body">
            <div className="au-avatar-pick">
              <div className="au-avatar-preview">
                {previewUrl ? <img src={previewUrl} alt="Profile preview" /> : <span>{initialsOf(form.name)}</span>}
              </div>
              <label className="au-upload">
                <ImagePlus size={15} /> {form.profileImage ? 'Change image' : 'Upload image'}
                <input name="profileImage" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleChange} hidden />
              </label>
              <small>{form.profileImage ? form.profileImage.name : 'JPG, PNG or WEBP · max 10 MB'}</small>
            </div>

            <div className="au-fields">
              <label className="x-field">
                <span>Full Name *</span>
                <input name="name" value={form.name} onChange={handleChange} required maxLength={80} placeholder="e.g. Priya Sharma" />
              </label>
              <label className="x-field">
                <span>Contact *</span>
                <input name="contact" type="tel" value={form.contact} onChange={handleChange} required placeholder="e.g. 98765 43210" />
              </label>
              <label className="x-field">
                <span>Email *</span>
                <input name="email" type="email" value={form.email} onChange={handleChange} required placeholder="name@company.com" />
              </label>
              <label className="x-field">
                <span>Password *</span>
                <div className="au-password">
                  <input name="password" type={showPassword ? 'text' : 'password'} value={form.password} onChange={handleChange} required minLength={8} placeholder="At least 8 characters" />
                  <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </label>
              <label className="x-field au-span-2">
                <span>Reporting Manager</span>
                <select name="reportingManagerId" value={form.reportingManagerId} onChange={handleChange}>
                  <option value="">Select Reporting Manager</option>
                  {reportingManagers.map((manager) => (
                    <option key={manager.id || manager._id} value={manager.id || manager._id}>
                      {manager.name || manager.fullname} ({manager.email})
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="au-roles">
            <span>Assign Primary Role *</span>
            <div className="au-role-pills">
              {ROLES.map((role) => (
                <label key={role} className={form.role === role ? 'active' : ''}>
                  <input type="radio" name="role" value={role} checked={form.role === role} onChange={handleChange} required />
                  {roleLabel(role)}
                </label>
              ))}
            </div>
          </div>

          <div className="au-form-actions">
            <button type="button" className="btn-ghost" onClick={closeForm} disabled={busy}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? 'Adding…' : 'Add User'}
            </button>
          </div>
        </form>
      )}

      {!loading && users.length > 0 && (
        <div className="au-filters">
          {['ALL', ...ROLES.filter((r) => counts[r])].map((r) => (
            <button key={r} type="button" className={roleFilter === r ? 'active' : ''} onClick={() => setRoleFilter(r)}>
              {r === 'ALL' ? 'All' : roleLabel(r)} <em>{r === 'ALL' ? users.length : counts[r]}</em>
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <p className="muted">Loading…</p>
      ) : users.length === 0 ? (
        <div className="au-empty">
          <Users size={30} />
          <p>No Users yet. Press “Add User” to create the first one.</p>
        </div>
      ) : (
        <div className="au-list">
          {shown.map((u) => {
            const assigned = (u.companies || []).map((id) => byId[id?._id || id]).filter(Boolean);
            const manager = managerById[u.reportingManagerId];
            const isSme = u.collection === 'smes';
            const isMe = String(u.id) === String(me?.id); // your own account can't be deleted
            return (
              <div key={`${u.collection}-${u.id}`} className="au-card">
                <div className="au-card-top">
                  <div className="au-avatar">
                    {u.profileImage ? <img src={u.profileImage} alt={u.name} /> : <span>{initialsOf(u.name)}</span>}
                  </div>
                  <div className="au-id">
                    <h3>{u.name}{isMe && <span className="au-you">You</span>}</h3>
                    <span className={`au-role ${String(u.role).toLowerCase()}`}>{roleLabel(u.role)}</span>
                  </div>
                  {!isMe && (
                    <button type="button" className="btn-ghost danger au-delete" aria-label={`Delete ${u.name}`} title="Delete user" onClick={() => removeUser(u)}>
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>

                <dl className="au-meta">
                  <div><dt><Mail size={14} /> Email</dt><dd>{u.email}</dd></div>
                  <div><dt><Phone size={14} /> Contact</dt><dd>{u.contact || '—'}</dd></div>
                  <div><dt><UserCheck size={14} /> Reporting Manager</dt><dd>{manager ? manager.name : '—'}</dd></div>
                  <div><dt><CalendarDays size={14} /> Joined</dt><dd>{fmtJoined(u.createdAt)}</dd></div>
                </dl>

                {isSme && (
                  <div className="au-card-actions">
                    <button type="button" className="btn-ghost" onClick={() => setAssignUser(u)}>
                      <Building2 size={15} /> Assign Companies
                    </button>
                    <button type="button" className="btn-ghost" onClick={() => setSopUser(u)}>
                      <ClipboardList size={15} /> Manage SOPs
                    </button>
                  </div>
                )}

                {isSme && (
                  <div className="au-companies">
                    <span>Companies ({assigned.length}/{max})</span>
                    <div>
                      {assigned.length === 0 ? (
                        <em>No companies assigned</em>
                      ) : (
                        assigned.map((c) => <span key={c.id || c._id} className="au-chip" title={c.name}>{c.name}</span>)
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {assignUser?.collection === 'smes' && (
        <AssignCompaniesModal
          user={assignUser}
          companies={companies}
          max={max}
          onSaved={() => { setAssignUser(null); reload(); }}
          onClose={() => setAssignUser(null)}
        />
      )}
      {sopUser?.collection === 'smes' && (
        <ManageSopsModal user={sopUser} companies={companies} onClose={() => setSopUser(null)} />
      )}
    </div>
  );
};

export default AdminUsers;
