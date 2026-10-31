import { useEffect, useState } from 'react';
import { UserPlus, Building2, ClipboardList, Trash2 } from 'lucide-react';
import api from '../api';
import { errMsg } from '../sopUtils';
import AssignCompaniesModal from '../components/AssignCompaniesModal';
import ManageSopsModal from '../components/ManageSopsModal';

const emptyForm = { name: '', email: '', password: '' };

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [max, setMax] = useState(5);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey((k) => k + 1);

  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState('');

  const [assignUser, setAssignUser] = useState(null); // user whose companies are being assigned
  const [sopUser, setSopUser] = useState(null); // user whose SOPs are being managed

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.get('/admin/users'), api.get('/admin/companies')])
      .then(([u, c]) => {
        if (cancelled) return;
        setUsers(u.data.users);
        setMax(u.data.maxAssigned);
        setCompanies(c.data.companies);
        setError('');
      })
      .catch((err) => !cancelled && setError(errMsg(err)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const byId = Object.fromEntries(companies.map((c) => [c.id, c]));

  const addUser = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await api.post('/admin/users', form);
      setCreated(`${res.data.user.name} was added. They can log in with ${res.data.user.email}.`);
      setForm(emptyForm);
      setAdding(false);
      reload();
    } catch (err) {
      setError(errMsg(err));
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
          <p>Add SMEs, assign companies (max {max} each) and manage their SOPs.</p>
        </div>
        <button type="button" className="btn-primary" onClick={() => { setAdding((a) => !a); setCreated(''); }}>
          <UserPlus size={16} /> {adding ? 'Close' : 'Add SME'}
        </button>
      </div>

      {error && <p className="error-message" role="alert">{error}</p>}
      {created && <p className="success-message" role="status">{created}</p>}

      {adding && (
        <form className="glass-panel add-form" onSubmit={addUser}>
          <label className="x-field">
            <span>Full name *</span>
            <input value={form.name} required maxLength={80} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <label className="x-field">
            <span>Email *</span>
            <input type="email" value={form.email} required onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </label>
          <label className="x-field">
            <span>Password * (min 8 characters)</span>
            <input type="text" value={form.password} required minLength={8} autoComplete="off" onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </label>
          <div className="btn-row">
            <button className="btn-primary" disabled={busy}>{busy ? 'Adding…' : 'Add SME'}</button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="muted">Loading…</p>
      ) : users.length === 0 ? (
        <div className="glass-panel"><p className="muted">No SMEs yet. Press “Add SME” to create the first one.</p></div>
      ) : (
        <div className="user-list">
          {users.map((u) => {
            const assigned = u.companies.map((id) => byId[id]).filter(Boolean);
            return (
              <div key={u.id} className="glass-panel user-row">
                <div className="user-main">
                  <h3>{u.name}</h3>
                  <p className="muted">{u.email}</p>
                  <div className="user-companies">
                    {assigned.length === 0 ? (
                      <span className="muted">No companies assigned</span>
                    ) : (
                      assigned.map((c) => <span key={c.id} className="mini-circle" title={c.name}>{c.name}</span>)
                    )}
                  </div>
                </div>
                <div className="btn-row small">
                  <button type="button" className="btn-ghost" onClick={() => setAssignUser(u)}>
                    <Building2 size={15} /> Assign Companies
                  </button>
                  <button type="button" className="btn-ghost" onClick={() => setSopUser(u)}>
                    <ClipboardList size={15} /> Manage SOPs
                  </button>
                  <button type="button" className="btn-ghost danger" aria-label={`Delete ${u.name}`} onClick={() => removeUser(u)}>
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {assignUser && (
        <AssignCompaniesModal
          user={assignUser}
          companies={companies}
          max={max}
          onSaved={() => { setAssignUser(null); reload(); }}
          onClose={() => setAssignUser(null)}
        />
      )}

      {sopUser && <ManageSopsModal user={sopUser} companies={companies} onClose={() => setSopUser(null)} />}
    </div>
  );
};

export default AdminUsers;
