import { useEffect, useMemo, useState } from 'react';
import { KeyRound, Eye, EyeOff, Pencil, Trash2, Plus, Save, X, Lock } from 'lucide-react';
import api from '../api';
import { errMsg } from '../sopUtils';
import '../style.css';
import '../styles/dashboard-glass.css';
import '../styles/superadmin.css';

// Super admin only: the credentials / settings stored in backend/.env.
const EnvCredentials = () => {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [revealed, setRevealed] = useState({}); // key -> real value
  const [editing, setEditing] = useState(null); // key being edited
  const [draft, setDraft] = useState('');
  const [adding, setAdding] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newVal, setNewVal] = useState('');

  const load = () => api.get('/superadmin/env')
    .then((r) => { setItems(r.data.items); setError(''); })
    .catch((e) => setError(errMsg(e)));
  useEffect(() => { load(); }, []);

  const grouped = useMemo(() => {
    const g = {};
    (items || []).forEach((i) => { (g[i.group] ||= []).push(i); });
    return Object.entries(g);
  }, [items]);

  const fetchReal = async (key) => (await api.get(`/superadmin/env/${key}/reveal`)).data.value;
  const toggleReveal = async (key) => {
    if (key in revealed) { setRevealed(({ [key]: _, ...rest }) => rest); return; }
    try { const value = await fetchReal(key); setRevealed((r) => ({ ...r, [key]: value })); }
    catch (e) { setError(errMsg(e)); }
  };
  const startEdit = async (it) => {
    try { setDraft(await fetchReal(it.key)); setEditing(it.key); setNotice(''); }
    catch (e) { setError(errMsg(e)); }
  };
  const saveEdit = async () => {
    try {
      const r = await api.put(`/superadmin/env/${editing}`, { value: draft });
      setNotice(r.data.message); setEditing(null); setRevealed({}); load();
    } catch (e) { setError(errMsg(e)); }
  };
  const remove = async (key) => {
    if (!window.confirm(`Remove ${key} from .env?`)) return;
    try { const r = await api.delete(`/superadmin/env/${key}`); setNotice(r.data.message); load(); }
    catch (e) { setError(errMsg(e)); }
  };
  const addKey = async () => {
    try {
      const r = await api.post('/superadmin/env', { key: newKey.trim(), value: newVal });
      setNotice(r.data.message); setAdding(false); setNewKey(''); setNewVal(''); load();
    } catch (e) { setError(errMsg(e)); }
  };

  return (
    <div className="dash-page">
      <div className="dash-hero glass-panel">
        <div>
          <h1><KeyRound size={22} /> Environment Credentials</h1>
          <p className="muted">Values stored in <code>backend/.env</code>. Visible to super admins only. Secrets are masked until you click the eye.</p>
        </div>
        <button className="btn-primary" onClick={() => setAdding((v) => !v)}><Plus size={15} /> Add variable</button>
      </div>

      {error && <div className="form-error" onClick={() => setError('')}>{error}</div>}
      {notice && <div className="form-success" onClick={() => setNotice('')}>{notice}</div>}

      {adding && (
        <div className="glass-panel env-row env-add">
          <input placeholder="KEY_NAME" value={newKey} onChange={(e) => setNewKey(e.target.value.toUpperCase())} />
          <input placeholder="value" value={newVal} onChange={(e) => setNewVal(e.target.value)} />
          <button className="btn-primary" onClick={addKey} disabled={!newKey.trim()}><Save size={14} /> Save</button>
          <button className="btn-ghost" onClick={() => setAdding(false)}><X size={14} /></button>
        </div>
      )}

      {!items && !error && <p className="muted">Loading…</p>}
      {grouped.map(([group, list]) => (
        <div className="glass-panel env-group" key={group}>
          <h2>{group}</h2>
          {list.map((it) => (
            <div className="env-row" key={it.key}>
              <span className="env-key">{it.secret && <Lock size={12} />} {it.key}</span>
              {editing === it.key ? (
                <>
                  <input className="env-input" value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus />
                  <button className="btn-primary" onClick={saveEdit}><Save size={14} /></button>
                  <button className="btn-ghost" onClick={() => setEditing(null)}><X size={14} /></button>
                </>
              ) : (
                <>
                  <span className="env-val">{it.key in revealed ? revealed[it.key] : (it.hasValue ? it.value : <em className="muted">empty</em>)}</span>
                  {it.secret && it.hasValue && (
                    <button className="btn-ghost" title={it.key in revealed ? 'Hide' : 'Show'} onClick={() => toggleReveal(it.key)}>
                      {it.key in revealed ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  )}
                  <button className="btn-ghost" title="Edit" onClick={() => startEdit(it)}><Pencil size={14} /></button>
                  <button className="btn-ghost" title="Remove" onClick={() => remove(it.key)}><Trash2 size={14} /></button>
                </>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

export default EnvCredentials;
