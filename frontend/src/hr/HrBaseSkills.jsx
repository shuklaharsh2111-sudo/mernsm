import { useEffect, useState } from 'react';
import { Plus, Trash2, X, ListChecks } from 'lucide-react';
import api from '../api';
import { errMsg } from '../sopUtils';
import '../style.css';
import '../styles/dashboard-glass.css';
import '../styles/hr.css';

const emptyForm = { role: '', skills: [], minMatch: 60, autoShortlist: true };

const splitSkills = (text) => String(text || '').split(/[,;\n]/).map((x) => x.trim()).filter(Boolean);

// Type a skill, press Enter (or comma) and it turns into a badge. Pasting "a, b, c" makes three badges.
const SkillBadgeInput = ({ skills, onChange, placeholder = 'Type a skill and press Enter', minOne = false }) => {
  const [draft, setDraft] = useState('');
  const commit = () => {
    const extra = splitSkills(draft);
    setDraft('');
    if (!extra.length) return;
    const have = new Set(skills.map((x) => x.toLowerCase()));
    const fresh = extra.filter((x) => !have.has(x.toLowerCase()) && have.add(x.toLowerCase()));
    if (fresh.length) onChange([...skills, ...fresh]);
  };
  const removeAt = (i) => onChange(skills.filter((_, idx) => idx !== i));
  return (
    <div className="hr-chipbox">
      {skills.map((sk, i) => (
        <span key={sk} className="hr-skill-chip">
          {sk}
          <button
            type="button"
            aria-label={`Remove ${sk}`}
            disabled={minOne && skills.length === 1}
            title={minOne && skills.length === 1 ? 'A role needs at least one skill' : ''}
            onClick={() => removeAt(i)}
          ><X size={11} /></button>
        </span>
      ))}
      <input
        className="hr-chip-input"
        value={draft}
        placeholder={skills.length ? 'Add another skill…' : placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commit(); }
          else if (e.key === 'Backspace' && !draft && skills.length && !(minOne && skills.length === 1)) removeAt(skills.length - 1);
        }}
        onPaste={(e) => {
          const text = e.clipboardData.getData('text');
          if (/[,;\n]/.test(text)) { e.preventDefault(); setDraft((d) => d + text); setTimeout(() => e.target.blur(), 0); }
        }}
        onBlur={commit}
      />
    </div>
  );
};

// One saved role: chips for its base skills, match % and the auto-shortlist switch. Everything saves on change.
const RoleCard = ({ item, onSave, onRemove }) => {
  const [name, setName] = useState(item.role);
  const [min, setMin] = useState(item.minMatch);

  return (
    <section className="hr-card hr-role">
      <div className="hr-role-head">
        <input
          className="hr-edit hr-role-name"
          value={name}
          maxLength={80}
          aria-label="Role name"
          onChange={(e) => setName(e.target.value)}
          onBlur={async () => {
            const next = name.trim();
            if (next === item.role) return;
            if (!next || !(await onSave(item.id, { role: next }))) setName(item.role);
          }}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        />
        <button type="button" className="btn-ghost danger" onClick={() => onRemove(item)} aria-label={`Remove ${item.role}`}><Trash2 size={15} /></button>
      </div>
      <SkillBadgeInput skills={item.skills} minOne onChange={(next) => onSave(item.id, { skills: next })} />
      <div className="hr-role-rules">
        <label>
          Shortlist when at least
          <input
            type="number" min={10} max={100} step={5} value={min}
            onChange={(e) => setMin(e.target.value)}
            onBlur={() => Number(min) !== item.minMatch && onSave(item.id, { minMatch: Number(min) })}
          />
          % of these skills match
        </label>
        <label className="hr-role-auto">
          <input type="checkbox" className="hr-check" checked={item.autoShortlist} onChange={(e) => onSave(item.id, { autoShortlist: e.target.checked })} />
          Shortlist automatically
        </label>
      </div>
    </section>
  );
};

const HrBaseSkills = () => {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.get('/hr/role-skills')
      .then((res) => !cancelled && setRoles(res.data.roles || []))
      .catch((err) => !cancelled && setError(errMsg(err)))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, []);

  const add = async (e) => {
    e.preventDefault();
    if (!form.skills.length) { setError('Add at least one base skill — type it and press Enter.'); return; }
    setSaving(true); setError(''); setNotice('');
    try {
      const res = await api.post('/hr/role-skills', { ...form, minMatch: Number(form.minMatch) });
      setRoles((list) => [...list, res.data.role].sort((a, b) => a.role.localeCompare(b.role)));
      setNotice(`Base skills saved for ${res.data.role.role}. New resumes for this role will be compared with them.`);
      setForm(emptyForm);
    } catch (err) {
      setError(err.response?.data?.message || errMsg(err));
    } finally {
      setSaving(false);
    }
  };
  const save = async (id, patch) => {
    setError(''); setNotice('');
    try {
      const res = await api.put(`/hr/role-skills/${id}`, patch);
      setRoles((list) => list.map((r) => (r.id === id ? res.data.role : r)));
      return true;
    } catch (err) {
      setError(err.response?.data?.message || errMsg(err));
      return false;
    }
  };
  const remove = async (r) => {
    if (!window.confirm(`Remove the base skills for ${r.role}? Resumes for this role will no longer be compared.`)) return;
    try {
      await api.delete(`/hr/role-skills/${r.id}`);
      setRoles((list) => list.filter((x) => x.id !== r.id));
    } catch (err) {
      setError(err.response?.data?.message || errMsg(err));
    }
  };

  return (
    <div className="dashboard-content scrollable dash-glass hr-page">
      <div className="page-header">
        <div>
          <span className="page-label">HUMAN RESOURCES</span>
          <h1>Base Skills</h1>
          <p>Set the skills each role needs. When a resume is uploaded in Recruitment, its skills are compared with these and the CV is shortlisted on its own if enough of them match.</p>
        </div>
      </div>
      {error && <p className="error-message" role="alert">{error}</p>}
      {notice && <p className="success-message" role="status">{notice}</p>}

      <section className="hr-card">
        <div className="hr-card-head"><h3>Add a role</h3><small>The role name should match the position on resumes, e.g. “Graphic Designer”. Every skill you enter becomes a badge.</small></div>
        <form onSubmit={add} className="hr-upload-form">
          <div className="hr-form-grid">
            <label className="x-field"><span>Role / position *</span><input value={form.role} maxLength={80} required onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} placeholder="Graphic Designer" /></label>
            <label className="x-field"><span>Shortlist at (% of skills matched)</span><input type="number" min={10} max={100} step={5} value={form.minMatch} onChange={(e) => setForm((f) => ({ ...f, minMatch: e.target.value }))} /></label>
            <div className="x-field hr-wide">
              <span>Base skills * — type each skill and press Enter</span>
              <SkillBadgeInput skills={form.skills} onChange={(next) => setForm((f) => ({ ...f, skills: next }))} placeholder="Photoshop, then Enter…" />
            </div>
          </div>
          <label className="hr-review-toggle">
            <input type="checkbox" checked={form.autoShortlist} onChange={(e) => setForm((f) => ({ ...f, autoShortlist: e.target.checked }))} />
            Shortlist the CV automatically when it matches
          </label>
          <div className="hr-form-actions">
            <button type="submit" className="btn-primary" disabled={saving}><Plus size={14} /> {saving ? 'Saving…' : 'Save role'}</button>
          </div>
        </form>
      </section>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : roles.length === 0 ? (
        <p className="hr-empty"><ListChecks size={16} /> No roles yet. Add one above to start comparing resumes automatically.</p>
      ) : (
        <div className="hr-role-grid">
          {roles.map((r) => (
            <RoleCard key={`${r.id}-${r.updatedAt}`} item={r} onSave={save} onRemove={remove} />
          ))}
        </div>
      )}
    </div>
  );
};
export default HrBaseSkills;
