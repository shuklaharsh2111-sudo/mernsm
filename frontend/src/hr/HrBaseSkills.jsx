import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, X, ListChecks, Search, Layers, Zap, Target, Sparkles } from 'lucide-react';
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

// Smallest number of matching skills that reaches the percentage (same rounding as the server)
const neededCount = (total, pct) => {
  for (let k = 0; k <= total; k += 1) if (Math.round((k / total) * 100) >= pct) return k;
  return total;
};
const initials = (name) => String(name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join('');
const hue = (name) => String(name || '').split('').reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 360, 0);

// Percentage slider: moves freely, saves when released
const MatchSlider = ({ value, total, onCommit }) => {
  const [v, setV] = useState(value);
  const commit = () => v !== value && onCommit(v);
  return (
    <div className="hr-rule">
      <div className="hr-rule-top">
        <span className="hr-field-label">Shortlist when</span>
        <strong className="hr-rule-val">{v}%</strong>
      </div>
      <input
        type="range" min={10} max={100} step={5} value={v} className="hr-range"
        style={{ '--fill': `${((v - 10) / 90) * 100}%` }}
        aria-label="Minimum skill match percentage"
        onChange={(e) => setV(Number(e.target.value))}
        onPointerUp={commit} onKeyUp={commit} onBlur={commit}
      />
      <small className="hr-rule-hint">At least <b>{neededCount(total, v)}</b> of the {total} base skill{total === 1 ? '' : 's'} must be on the resume.</small>
    </div>
  );
};

// One saved role. Everything saves as soon as it changes.
const RoleCard = ({ item, onSave, onRemove }) => {
  const [name, setName] = useState(item.role);
  return (
    <article className={`hr-role${item.autoShortlist ? ' is-auto' : ''}`}>
      <header className="hr-role-head">
        <span className="hr-role-icon" style={{ background: `hsl(${hue(item.role)} 45% 32%)` }} aria-hidden="true">{initials(item.role)}</span>
        <div className="hr-role-title">
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
          <small>{item.skills.length} base skill{item.skills.length === 1 ? '' : 's'}</small>
        </div>
        <button type="button" className="btn-ghost danger" onClick={() => onRemove(item)} aria-label={`Remove ${item.role}`}><Trash2 size={15} /></button>
      </header>

      <section className="hr-role-sec">
        <h4>Base skills</h4>
        <SkillBadgeInput skills={item.skills} minOne onChange={(next) => onSave(item.id, { skills: next })} />
      </section>

      <footer className="hr-role-foot">
        <MatchSlider key={`${item.id}-${item.minMatch}-${item.skills.length}`} value={item.minMatch} total={item.skills.length} onCommit={(v) => onSave(item.id, { minMatch: v })} />
        <div className="hr-rule">
          <span className="hr-field-label">Auto-shortlist</span>
          <label className="hr-switch-row">
            <input type="checkbox" className="hr-switch" checked={item.autoShortlist} onChange={(e) => onSave(item.id, { autoShortlist: e.target.checked })} aria-label={`Shortlist automatically for ${item.role}`} />
            <span>{item.autoShortlist ? 'On' : 'Off'}</span>
          </label>
          <small className="hr-rule-hint">{item.autoShortlist ? 'Matching resumes get “CV shortlisted” ticked.' : 'Resumes are only scored, never shortlisted.'}</small>
        </div>
      </footer>
    </article>
  );
};

const HrBaseSkills = () => {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
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

  const stats = useMemo(() => ({
    roles: roles.length,
    auto: roles.filter((r) => r.autoShortlist).length,
    skills: roles.reduce((n, r) => n + r.skills.length, 0),
    avg: roles.length ? Math.round(roles.reduce((n, r) => n + r.minMatch, 0) / roles.length) : 0,
  }), [roles]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return roles;
    return roles.filter((r) => r.role.toLowerCase().includes(q) || r.skills.some((s) => s.toLowerCase().includes(q)));
  }, [roles, query]);

  const add = async (e) => {
    e.preventDefault();
    if (!form.role.trim()) { setError('Role name is required.'); return; }
    if (!form.skills.length) { setError('Add at least one base skill — type it and press Enter.'); return; }
    setSaving(true); setError(''); setNotice('');
    try {
      const res = await api.post('/hr/role-skills', { ...form, minMatch: Number(form.minMatch) });
      setRoles((list) => [...list, res.data.role].sort((a, b) => a.role.localeCompare(b.role)));
      setNotice(`Base skills saved for ${res.data.role.role}. New resumes for this role will be compared with them.`);
      setForm(emptyForm);
      setAdding(false);
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
      setRoles((list) => list.map((r) => (r.id === id ? res.data.role : r)).sort((a, b) => a.role.localeCompare(b.role)));
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
          <p>Set the skills each role needs. Every resume uploaded in Recruitment is compared with them, and the CV is shortlisted on its own when enough skills match.</p>
        </div>
      </div>
      {error && <p className="error-message" role="alert">{error}</p>}
      {notice && <p className="success-message" role="status">{notice}</p>}

      <div className="kpi-grid">
        <div className="kpi-card"><div className="kpi-top"><span className="kpi-label">Roles</span><span className="kpi-icon"><Layers size={17} /></span></div><div className="kpi-value">{stats.roles}</div></div>
        <div className="kpi-card green"><div className="kpi-top"><span className="kpi-label">Auto-shortlist on</span><span className="kpi-icon"><Zap size={17} /></span></div><div className="kpi-value">{stats.auto}</div></div>
        <div className="kpi-card amber"><div className="kpi-top"><span className="kpi-label">Base skills</span><span className="kpi-icon"><ListChecks size={17} /></span></div><div className="kpi-value">{stats.skills}</div></div>
        <div className="kpi-card"><div className="kpi-top"><span className="kpi-label">Avg. match needed</span><span className="kpi-icon"><Target size={17} /></span></div><div className="kpi-value">{stats.avg}%</div></div>
      </div>

      <div className="hr-toolbar">
        <div className="hr-search">
          <Search size={15} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search a role or a skill" />
        </div>
        <div className="hr-toolbar-actions">
          <button type="button" className="hr-export-btn" onClick={() => setAdding((v) => !v)} aria-expanded={adding}>
            {adding ? <X size={15} /> : <Plus size={15} />}
            <span>{adding ? 'Close' : 'New role'}</span>
          </button>
        </div>
      </div>

      {adding && (
        <form onSubmit={add} className="hr-card hr-newrole">
          <div className="hr-card-head"><h3>New role</h3><small>Use the same name as the position on resumes, e.g. “Graphic Designer”</small></div>
          <div className="hr-newrole-grid">
            <label className="x-field"><span>Role / position *</span><input value={form.role} maxLength={80} autoFocus onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} placeholder="Graphic Designer" /></label>
            <div className="x-field">
              <span>Shortlist at {form.minMatch}% skill match</span>
              <input type="range" min={10} max={100} step={5} className="hr-range" style={{ '--fill': `${((form.minMatch - 10) / 90) * 100}%` }} value={form.minMatch} onChange={(e) => setForm((f) => ({ ...f, minMatch: Number(e.target.value) }))} />
            </div>
            <div className="x-field hr-newrole-wide">
              <span>Base skills * — type each skill and press Enter</span>
              <SkillBadgeInput skills={form.skills} onChange={(next) => setForm((f) => ({ ...f, skills: next }))} placeholder="Photoshop, then Enter…" />
            </div>
          </div>
          <div className="hr-newrole-foot">
            <label className="hr-switch-row">
              <input type="checkbox" className="hr-switch" checked={form.autoShortlist} onChange={(e) => setForm((f) => ({ ...f, autoShortlist: e.target.checked }))} />
              <span>Shortlist the CV automatically when it matches</span>
            </label>
            <div className="hr-form-actions">
              <button type="button" className="btn-ghost" onClick={() => { setAdding(false); setForm(emptyForm); }}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={saving}><Plus size={14} /> {saving ? 'Saving…' : 'Save role'}</button>
            </div>
          </div>
        </form>
      )}

      {loading ? (
        <p className="muted">Loading…</p>
      ) : roles.length === 0 ? (
        <div className="hr-empty-state">
          <span className="hr-empty-icon"><Sparkles size={22} /></span>
          <h3>No roles yet</h3>
          <p>Add a role and the skills it needs. From then on, resumes for that role are scored and shortlisted automatically.</p>
          {!adding && <button type="button" className="btn-primary" onClick={() => setAdding(true)}><Plus size={14} /> Add your first role</button>}
        </div>
      ) : shown.length === 0 ? (
        <p className="hr-empty">No role or skill matches “{query}”.</p>
      ) : (
        <div className="hr-role-grid">
          {shown.map((r) => <RoleCard key={r.id} item={r} onSave={save} onRemove={remove} />)}
        </div>
      )}
    </div>
  );
};
export default HrBaseSkills;
