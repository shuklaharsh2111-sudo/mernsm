import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import api from '../api';
import { errMsg } from '../sopUtils';

const AdminCompanies = () => {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey((k) => k + 1);

  useEffect(() => {
    let cancelled = false;
    api
      .get('/admin/companies')
      .then((res) => {
        if (cancelled) return;
        setCompanies(res.data.companies);
        setError('');
      })
      .catch((err) => !cancelled && setError(errMsg(err)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const add = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.post('/admin/companies', { name });
      setName('');
      reload();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (c) => {
    if (!window.confirm(`Delete ${c.name}? It is removed from every SME and its SOPs are deleted.`)) return;
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
          <p>Add the companies you can assign to SMEs from the Users page.</p>
        </div>
      </div>

      <form className="glass-panel add-form inline" onSubmit={add}>
        <label className="x-field grow">
          <span>Company name *</span>
          <input value={name} required maxLength={60} placeholder="e.g. Lumina Creative" onChange={(e) => setName(e.target.value)} />
        </label>
        <button className="btn-primary" disabled={busy}><Plus size={16} /> {busy ? 'Adding…' : 'Add company'}</button>
      </form>

      {error && <p className="error-message" role="alert">{error}</p>}

      {loading ? (
        <p className="muted">Loading…</p>
      ) : companies.length === 0 ? (
        <div className="glass-panel"><p className="muted">No companies yet.</p></div>
      ) : (
        <div className="user-list">
          {companies.map((c) => (
            <div key={c.id} className="glass-panel user-row">
              <div className="user-main"><h3>{c.name}</h3></div>
              <button type="button" className="btn-ghost danger" aria-label={`Delete ${c.name}`} onClick={() => remove(c)}>
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
