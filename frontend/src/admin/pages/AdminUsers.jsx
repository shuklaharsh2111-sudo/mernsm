import { useEffect, useState } from 'react';
import { useAdminAuth } from '../context/AdminAuthContext';
import {
  createUser,
  deleteUser,
  getUsers,
  resetUserPassword,
  setUserActive,
  updateUser,
} from '../api/adminApi';
<<<<<<< HEAD
import CompanyBadge from '../../shared/CompanyBadge';
=======
>>>>>>> adc7900227aadaf9e0a6f9f972499593c8ff0896

// Keep in sync with ROLES in backend/src/admin/models/User.js
const ROLES = [{ value: 'sme', label: 'SME' }];
const roleLabel = (v) => ROLES.find((r) => r.value === v)?.label || v;

const EMPTY_FORM = {
  name: '',
  email: '',
  contact: '',
  role: ROLES[0].value,
  reportingManager: '',
<<<<<<< HEAD
  companies: [],
=======
  companies: '',
>>>>>>> adc7900227aadaf9e0a6f9f972499593c8ff0896
  password: '',
};

export default function AdminUsers() {
  const { token } = useAdminAuth();
  const [users, setUsers] = useState([]);
  const [managers, setManagers] = useState([]);
<<<<<<< HEAD
  const [companies, setCompanies] = useState([]);
=======
>>>>>>> adc7900227aadaf9e0a6f9f972499593c8ff0896
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [form, setForm] = useState(null); // null = hidden
  const [busy, setBusy] = useState(false);
  const [credentials, setCredentials] = useState(null); // shown once
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey((k) => k + 1);

  useEffect(() => {
    let cancelled = false;
    getUsers(token)
      .then((d) => {
        if (cancelled) return;
        setError('');
        setUsers(d.users);
        setManagers(d.managers);
<<<<<<< HEAD
        setCompanies(d.companies);
=======
>>>>>>> adc7900227aadaf9e0a6f9f972499593c8ff0896
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [token, reloadKey]);

  const openAdd = () => {
    setCredentials(null);
    setForm({ ...EMPTY_FORM });
  };

  const openEdit = (u) => {
    setCredentials(null);
    setForm({
      id: u.id,
      name: u.name,
      email: u.email,
      contact: u.contact,
      role: u.role,
      reportingManager: u.reportingManager || '',
<<<<<<< HEAD
      companies: u.companies,
=======
      companies: u.assignedCompanies.join(', '),
>>>>>>> adc7900227aadaf9e0a6f9f972499593c8ff0896
      password: '',
    });
  };

  const submitForm = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
<<<<<<< HEAD
      const { id, password, ...body } = form;
=======
      const { id, companies, password, ...rest } = form;
      const body = { ...rest, assignedCompanies: companies };
>>>>>>> adc7900227aadaf9e0a6f9f972499593c8ff0896
      if (id) {
        await updateUser(token, id, body);
      } else {
        const data = await createUser(token, { ...body, password: password || undefined });
        if (data.tempPassword) {
          setCredentials({
            name: data.user.name,
            userId: data.user.userId,
            email: data.user.email,
            password: data.tempPassword,
            title: 'User created',
          });
        }
      }
      setForm(null);
      reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const onReset = async (u) => {
    if (!window.confirm(`Generate a new password for ${u.name}?`)) return;
    setError('');
    try {
      const data = await resetUserPassword(token, u.id);
      setCredentials({
        name: u.name,
        userId: u.userId,
        email: u.email,
        password: data.tempPassword,
        title: 'Password reset',
      });
    } catch (err) {
      setError(err.message);
    }
  };

  const onToggle = async (u) => {
    setError('');
    try {
      await setUserActive(token, u.id, !u.active);
      reload();
    } catch (err) {
      setError(err.message);
    }
  };

  const onDelete = async (u) => {
    if (!window.confirm(`Delete ${u.name}? This cannot be undone.`)) return;
    setError('');
    try {
      await deleteUser(token, u.id);
      reload();
    } catch (err) {
      setError(err.message);
    }
  };

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* clipboard blocked: the text is visible to copy by hand */
    }
  };

<<<<<<< HEAD
  const byId = Object.fromEntries(companies.map((c) => [c.id, c]));
  const toggleCompany = (id) =>
    setForm((f) => ({
      ...f,
      companies: f.companies.includes(id) ? f.companies.filter((x) => x !== id) : [...f.companies, id],
    }));

  const q = query.trim().toLowerCase();
  const shown = q
    ? users.filter((u) =>
        [u.name, u.email, u.userId, u.contact, u.reportingManager, ...u.companies.map((id) => byId[id]?.name || '')]
=======
  const q = query.trim().toLowerCase();
  const shown = q
    ? users.filter((u) =>
        [u.name, u.email, u.userId, u.contact, u.reportingManager, ...u.assignedCompanies]
>>>>>>> adc7900227aadaf9e0a6f9f972499593c8ff0896
          .join(' ')
          .toLowerCase()
          .includes(q)
      )
    : users;

  const managerOptions = managers.filter((m) => m.id !== form?.id);

  return (
    <>
      <div className="sop-head">
        <h1 className="admin-title">Users</h1>
        <button type="button" className="admin-btn sop-new" onClick={openAdd}>
          + Add User
        </button>
      </div>

      {error && <p className="admin-error" role="alert">{error}</p>}

      {credentials && (
        <div className="admin-panel users-credentials" role="status">
          <h2>{credentials.title}: share these login details</h2>
          <p>Shown only once. {credentials.name} signs in with their email or User ID.</p>
          <dl>
            <div><dt>User ID</dt><dd><code>{credentials.userId}</code></dd></div>
            <div><dt>Email</dt><dd><code>{credentials.email}</code></dd></div>
            <div><dt>Temporary password</dt><dd><code>{credentials.password}</code></dd></div>
          </dl>
          <div className="sop-actions">
            <button
              type="button"
              className="sop-btn approve"
              onClick={() =>
                copy(`User ID: ${credentials.userId}\nEmail: ${credentials.email}\nPassword: ${credentials.password}`)
              }
            >
              Copy details
            </button>
            <button type="button" className="sop-btn ghost" onClick={() => setCredentials(null)}>
              Done
            </button>
          </div>
        </div>
      )}

      {form && (
        <form className="admin-panel sop-form" onSubmit={submitForm}>
          <h2>{form.id ? 'Edit user' : 'Add user'}</h2>
          <div className="admin-grid-2">
            <label className="admin-field">
              <span>Full name</span>
              <input value={form.name} maxLength={80} required onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </label>
            <label className="admin-field">
              <span>Email</span>
              <input type="email" value={form.email} required onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </label>
            <label className="admin-field">
              <span>Contact</span>
              <input type="tel" value={form.contact} maxLength={20} required placeholder="+91 98765 43210" onChange={(e) => setForm({ ...form, contact: e.target.value })} />
            </label>
            <label className="admin-field">
              <span>Role</span>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} required>
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </label>
            <label className="admin-field">
              <span>Reporting manager</span>
              <select value={form.reportingManager} onChange={(e) => setForm({ ...form, reportingManager: e.target.value })}>
                <option value="">None</option>
                {managerOptions.map((m) => (
                  <option key={m.id} value={m.name}>{m.label}</option>
                ))}
              </select>
            </label>
<<<<<<< HEAD
=======
            <label className="admin-field">
              <span>Assigned companies (comma separated)</span>
              <input value={form.companies} placeholder="Acme Ltd, Globex" onChange={(e) => setForm({ ...form, companies: e.target.value })} />
            </label>
>>>>>>> adc7900227aadaf9e0a6f9f972499593c8ff0896
            {!form.id && (
              <label className="admin-field">
                <span>Password (leave empty to auto-generate)</span>
                <input type="text" value={form.password} minLength={8} autoComplete="off" onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </label>
            )}
          </div>
<<<<<<< HEAD
          <div className="company-field">
            <p className="company-field-label">Assigned companies</p>
            {companies.length === 0 ? (
              <p className="sop-meta">No companies yet. Add them under Companies first.</p>
            ) : (
              <div className="company-picks">
                {companies.map((c) => (
                  <label key={c.id} className={`company-pick ${form.companies.includes(c.id) ? 'on' : ''}`}>
                    <input type="checkbox" checked={form.companies.includes(c.id)} onChange={() => toggleCompany(c.id)} />
                    <CompanyBadge company={c} size={28} />
                    <b>{c.name}</b>
                  </label>
                ))}
              </div>
            )}
          </div>
=======
>>>>>>> adc7900227aadaf9e0a6f9f972499593c8ff0896
          <div className="sop-actions">
            <button className="admin-btn sop-inline" disabled={busy}>
              {busy ? 'Saving…' : form.id ? 'Save changes' : 'Add user'}
            </button>
            <button type="button" className="sop-btn ghost" onClick={() => setForm(null)}>Cancel</button>
          </div>
        </form>
      )}

      <div className="users-toolbar">
        <input
          className="users-search"
          type="search"
          placeholder="Search name, email, ID, company…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <span className="sop-meta">{shown.length} of {users.length} users</span>
      </div>

      {loading ? (
        <p className="admin-loading">Loading users…</p>
      ) : shown.length === 0 ? (
        <div className="admin-panel"><p>{users.length ? 'No users match your search.' : 'No users yet. Click “+ Add User”.'}</p></div>
      ) : (
        <div className="admin-panel users-wrap">
          <table className="users-table">
            <thead>
              <tr>
                <th>User ID</th>
                <th>Full Name</th>
                <th>Reporting Manager</th>
                <th>Contact</th>
                <th>Email</th>
                <th>Role</th>
                <th>Assigned Companies</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((u) => (
                <tr key={u.id} className={u.active ? '' : 'inactive'}>
                  <td><code>{u.userId}</code></td>
                  <td>
                    {u.name}
                    {!u.active && <span className="sop-badge rejected users-disabled">Disabled</span>}
                  </td>
                  <td>{u.reportingManager || '—'}</td>
                  <td>{u.contact}</td>
                  <td>{u.email}</td>
                  <td>{roleLabel(u.role)}</td>
                  <td>
<<<<<<< HEAD
                    {u.companies.filter((id) => byId[id]).length
                      ? u.companies.filter((id) => byId[id]).map((id) => (
                          <span key={id} className="chip">{byId[id].name}</span>
                        ))
=======
                    {u.assignedCompanies.length
                      ? u.assignedCompanies.map((c) => <span key={c} className="chip">{c}</span>)
>>>>>>> adc7900227aadaf9e0a6f9f972499593c8ff0896
                      : '—'}
                  </td>
                  <td>
                    <div className="users-actions">
                      <button type="button" className="sop-btn ghost" onClick={() => openEdit(u)}>Edit</button>
                      <button type="button" className="sop-btn ghost" onClick={() => onReset(u)}>Reset password</button>
                      <button type="button" className="sop-btn ghost" onClick={() => onToggle(u)}>
                        {u.active ? 'Disable' : 'Enable'}
                      </button>
                      <button type="button" className="sop-btn ghost danger" onClick={() => onDelete(u)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
