import { useEffect, useState } from 'react';
import { UserPlus, Building2, ClipboardList, Trash2 } from 'lucide-react';
import api from '../api';
import { errMsg } from '../sopUtils';
import AssignCompaniesModal from '../components/AssignCompaniesModal';
import ManageSopsModal from '../components/ManageSopsModal';
const emptyForm = { name: '', contact: '', email: '', password: '', reportingManagerId: '', role: 'SME', profileImage: null };
const AdminUsers = () => {
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
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState('');
  const [assignUser, setAssignUser] = useState(null);
  const [sopUser, setSopUser] = useState(null);
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
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);
  const byId = Object.fromEntries(companies.map((c) => [c.id || c._id, c]));
  const handleChange = (e) => {
    const { name, value, files } = e.target;
    setForm((prev) => ({ ...prev, [name]: name === 'profileImage' ? files?.[0] || null : value }));
  };
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
      if (form.profileImage) payload.append('profileImage', form.profileImage);
      const res = await api.post('/admin/users', payload);
      setCreated(`${res.data.user.name} was added. They can log in with ${res.data.user.email}.`);
      setForm(emptyForm);
      setAdding(false);
      reload();
    } catch (err) {
      setError(err.response?.data?.message || errMsg(err));
    } finally {
      setBusy(false);
    }
  };
  const removeUser = async (u) => {
    if (!window.confirm(`Delete ${u.name}? Their assigned SOPs will be deleted too.`)) return;
    setError('');
    setCreated('');
    try {
      await api.delete(`/admin/users/${u.id}`);
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
          <h1>Users</h1>
          <p>Add Users, assign companies (max {max} each) and manage their SOPs.</p>
        </div>
        <button type="button" className="btn-primary" onClick={() => { setAdding((a) => !a); setCreated(''); setError(''); }}>
          <UserPlus size={16} /> {adding ? 'Close' : 'Add User'}
        </button>
      </div>
      {error && <p className="error-message" role="alert">{error}</p>}
      {created && <p className="success-message" role="status">{created}</p>}
      {adding && (
        <form className="glass-panel add-form" onSubmit={addUser}>
          <label className="x-field">
            <span>Full Name *</span>
            <input name="name" value={form.name} onChange={handleChange} required maxLength={80} />
          </label>
          <label className="x-field">
            <span>Profile Image</span>
            <input name="profileImage" type="file" accept="image/*" onChange={handleChange} />
          </label>
          <label className="x-field">
            <span>Contact *</span>
            <input name="contact" type="tel" value={form.contact} onChange={handleChange} required />
          </label>
          <label className="x-field">
            <span>Email *</span>
            <input name="email" type="email" value={form.email} onChange={handleChange} required />
          </label>
          <label className="x-field">
            <span>Password *</span>
            <input name="password" type="password" value={form.password} onChange={handleChange} required minLength={8} />
          </label>
          <label className="x-field">
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
          <div className="x-field">
            <span>Assign Primary Role *</span>
            {['ADMIN', 'REPORTING_MANAGER', 'SME', 'SMI', 'DES', 'CLIENTS'].map((role) => (
              <label key={role}>
                <input type="radio" name="role" value={role} checked={form.role === role} onChange={handleChange} required />
                {role}
              </label>
            ))}
          </div>
          <div className="btn-row">
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? 'Adding…' : 'Add User'}
            </button>
          </div>
        </form>
      )}
      {loading ? (
        <p className="muted">Loading…</p>
      ) : users.length === 0 ? (
        <div className="glass-panel"><p className="muted">No Users yet. Press “Add User” to create the first one.</p></div>
      ) : (
        <div className="user-list">
          {users.map((u) => {
            const assigned = (u.companies || []).map((id) => byId[id?._id || id]).filter(Boolean);
            return (
              <div key={u.id || u._id} className="glass-panel user-row">
                <div className="user-main">
                  <h3>{u.name || u.fullname}</h3>
                  <p className="muted">{u.email}</p>
                  <div className="user-companies">
                    {assigned.length === 0 ? (
                      <span className="muted">No companies assigned</span>
                    ) : (
                      assigned.map((c) => <span key={c.id || c._id} className="mini-circle" title={c.name}>{c.name}</span>)
                    )}
                  </div>
                </div>
                <div className="btn-row small">
                  {u.collection === 'smes' && (
                    <>
                      <button type="button" className="btn-ghost" onClick={() => setAssignUser(u)}>
                        <Building2 size={15} /> Assign Companies
                      </button>
                      <button type="button" className="btn-ghost" onClick={() => setSopUser(u)}>
                        <ClipboardList size={15} /> Manage SOPs
                      </button>
                    </>
                  )}
                  <button type="button" className="btn-ghost danger" aria-label={`Delete ${u.name}`} onClick={() => removeUser(u)}>
                    <Trash2 size={15} />
                  </button>
                </div>
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
      {sopUser && String(sopUser.role || '').toUpperCase() === 'SME' && (
        <ManageSopsModal user={sopUser} companies={companies} onClose={() => setSopUser(null)} />
      )}
    </div>
  );
};
export default AdminUsers;