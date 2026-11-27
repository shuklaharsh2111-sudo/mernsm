import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { UserPlus, Building2, ClipboardList, Trash2, Mail, Phone, UserCheck, CalendarDays, ImagePlus, Eye, EyeOff, X, Users, Ban, ShieldCheck, KeyRound, Crown } from 'lucide-react';
import api from '../api';
import { useAuth } from '../AuthContext';
import { errMsg } from '../sopUtils';
import AssignCompaniesModal from '../components/AssignCompaniesModal';
import ManageSopsModal from '../components/ManageSopsModal';
import "../styles/adminusers.css";
import { roleName } from '../roleNames';
const ROLES = ['ADMIN', 'OPERATION_MANAGER', 'REPORTING_MANAGER', 'SME', 'SMI', 'DES', 'HR',
   'CLIENTS'];
const roleLabel = roleName; // full role name, e.g. SME -> Social Media Executive
const emptyForm = { name: '', contact: '', email: '', password: '', reportingManagerId: '', role: 'SME', profileImage: null };
const initialsOf = (name = '') => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('') || 'U';
const fmtJoined = (d) => {
  const date = d ? new Date(d) : null;
  return date && !Number.isNaN(date.getTime())
    ? date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';
};
// mode: 'all' (Users page) | 'create-admin' | 'admins' (Manage Admins)
const initialForm = (mode) => ({ ...emptyForm, role: mode === 'create-admin' ? 'ADMIN' : 'SME' });
const COPY = {
  all: { label: 'ADMINISTRATION', title: 'Users', text: null, button: 'Add User', formTitle: 'New User', submit: 'Add User' },
  'create-admin': { label: 'SUPER ADMIN', title: 'Create Admin', text: 'Create a new admin account. Normal admins cannot see or create other admins.', button: '', formTitle: 'New Admin', submit: 'Create Admin' },
  admins: { label: 'SUPER ADMIN', title: 'Manage Admins', text: 'Make or remove super admins, change passwords or delete admin accounts.', button: '', formTitle: '', submit: '' },
};
const AdminUsers = ({ mode = 'all' }) => {
  const { user: me } = useAuth();
  const copy = mode === 'all' && me?.isSuperAdmin ? { ...COPY.all, label: 'SUPER ADMIN', title: 'Manage Employee' } : (COPY[mode] || COPY.all);
  const [users, setUsers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [reportingManagers, setReportingManagers] = useState([]);
  const [max, setMax] = useState(5);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey((k) => k + 1);
  const [adding, setAdding] = useState(mode === 'create-admin');
  const [form, setForm] = useState(() => initialForm(mode));
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState('');
  const [assignUser, setAssignUser] = useState(null);
  const [sopUser, setSopUser] = useState(null);
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [banTarget, setBanTarget] = useState(null); // the user being banned (opens the message box)
  const [banMsg, setBanMsg] = useState('');
  const [banBusy, setBanBusy] = useState(false);
  const [pwTarget, setPwTarget] = useState(null); // the user whose password is being changed
  const [pw, setPw] = useState({ next: '', confirm: '' });
  const [pwShow, setPwShow] = useState(false);
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState('');
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
  const closeForm = () => { setAdding(mode === 'create-admin'); setForm(initialForm(mode)); setShowPassword(false); };
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
  const toggleSuper = async (u) => {
    const make = !u.isSuperAdmin;
    if (!window.confirm(make ? `Make ${u.name} a super admin? They will be able to manage all admin accounts.` : `Remove super admin from ${u.name}? They will stay a normal admin.`)) return;
    setError('');
    setCreated('');
    try {
      await api.put(`/superadmin/users/${u.id}/super-admin`, { value: make });
      setCreated(make ? `${u.name} is now a super admin.` : `${u.name} is no longer a super admin.`);
      reload();
    } catch (err) {
      setError(err.response?.data?.message || errMsg(err));
    }
  };
  const openBan = (u) => { setBanTarget(u); setBanMsg(''); setError(''); setCreated(''); };
  const closeBan = () => { setBanTarget(null); setBanMsg(''); };
  const confirmBan = async (e) => {
    e.preventDefault();
    if (!banMsg.trim()) return;
    setBanBusy(true);
    setError('');
    try {
      await api.put(`/admin/users/${banTarget.id}/ban`, { collection: banTarget.collection, reason: banMsg.trim() });
      setCreated(`${banTarget.name} was banned. They will see your message.`);
      closeBan();
      reload();
    } catch (err) {
      setError(err.response?.data?.message || errMsg(err));
    } finally {
      setBanBusy(false);
    }
  };
  const unbanUser = async (u) => {
    if (!window.confirm(`Unban ${u.name}? They will be able to sign in again.`)) return;
    setError('');
    setCreated('');
    try {
      await api.put(`/admin/users/${u.id}/unban`, { collection: u.collection });
      setCreated(`${u.name} was unbanned.`);
      reload();
    } catch (err) {
      setError(err.response?.data?.message || errMsg(err));
    }
  };
  const openPw = (u) => { setPwTarget(u); setPw({ next: '', confirm: '' }); setPwShow(false); setPwError(''); setError(''); setCreated(''); };
  const closePw = () => { setPwTarget(null); setPw({ next: '', confirm: '' }); setPwShow(false); setPwError(''); };
  const confirmPw = async (e) => {
    e.preventDefault();
    if (pw.next.length < 8) return setPwError('Password must be at least 8 characters.');
    if (pw.next !== pw.confirm) return setPwError('The two passwords do not match.');
    setPwBusy(true);
    setPwError('');
    try {
      await api.put(`/admin/users/${pwTarget.id}/password`, { collection: pwTarget.collection, password: pw.next });
      setCreated(`Password changed for ${pwTarget.name}. They can log in with the new password.`);
      closePw();
    } catch (err) {
      setPwError(err.response?.data?.message || errMsg(err));
    } finally {
      setPwBusy(false);
    }
  };
  // which people this page lists
  const list = mode === 'admins' ? users.filter((u) => u.collection === 'admins')
      : users;
  const showList = mode !== 'create-admin';
  const formRoles = mode === 'create-admin' ? ['ADMIN'] : ROLES.filter((r) => r !== 'ADMIN' || (me?.isSuperAdmin && mode === 'all'));
  const counts = list.reduce((acc, u) => ({ ...acc, [u.role]: (acc[u.role] || 0) + 1 }), {});
  const shown = roleFilter === 'ALL' ? list : list.filter((u) => u.role === roleFilter);
  // Super admin sees every department first (admins included), each as its own section.
  const grouped = !!me?.isSuperAdmin && roleFilter === 'ALL' && mode !== 'admins';
  const bySuperFirst = (a, b) => (b.isSuperAdmin ? 1 : 0) - (a.isSuperAdmin ? 1 : 0);
  const departments = [
    ...ROLES.map((r) => ({ role: r, members: list.filter((u) => u.role === r).sort(bySuperFirst) })),
    { role: 'OTHER', members: list.filter((u) => !ROLES.includes(u.role)) },
  ].filter((d) => d.members.length);
  const renderCard = (u) => {
            const assigned = (u.companies || []).map((id) => byId[id?._id || id]).filter(Boolean);
            const manager = managerById[u.reportingManagerId];
            // For a reporting manager: the people who report to them, with their roles.
            const reports = String(u.role).toUpperCase() === 'REPORTING_MANAGER'
              ? users.filter((x) => String(x.reportingManagerId || '') === String(u.id))
              : [];
            // Admin can assign companies and SOPs to Social Media Executives (SME) and Social Media Interns (SMI).
            const canAssign = u.collection === 'smes' || u.collection === 'smis';
            const isMe = String(u.id) === String(me?.id); // your own account can't be deleted
            return (
              <div key={`${u.collection}-${u.id}`} className={`au-card${u.isBanned ? ' banned' : ''}`}>
                <div className="au-card-top">
                  <div className="au-avatar">
                    {u.profileImage ? <img src={u.profileImage} alt={u.name} /> : <span>{initialsOf(u.name)}</span>}
                  </div>
                  <div className="au-id">
                    <h3>{u.name}{isMe && <span className="au-you">You</span>}{u.isBanned && <span className="au-banned-tag">Banned</span>}</h3>
                    <span className={`au-role ${String(u.role).toLowerCase()}`}>{u.isSuperAdmin ? 'Super Admin' : roleLabel(u.role)}</span>
                  </div>
                  {me?.isSuperAdmin && u.collection === 'admins' && !isMe && (
                    <button type="button" className={`btn-ghost au-ban-btn${u.isSuperAdmin ? ' au-super-on' : ''}`} aria-label={u.isSuperAdmin ? `Remove super admin from ${u.name}` : `Make ${u.name} a super admin`} title={u.isSuperAdmin ? 'Remove super admin' : 'Make super admin'} onClick={() => toggleSuper(u)}>
                      <Crown size={15} />
                    </button>
                  )}
                  {(u.collection !== 'admins' || isMe || (me?.isSuperAdmin && !u.isSuperAdmin)) && (
                    <button type="button" className="btn-ghost au-ban-btn" aria-label={`Change password for ${u.name}`} title="Change password" onClick={() => openPw(u)}>
                      <KeyRound size={15} />
                    </button>
                  )}
                  {!isMe && u.collection !== 'admins' && (
                    u.isBanned ? (
                      <button type="button" className="btn-ghost au-ban-btn" aria-label={`Unban ${u.name}`} title="Unban user" onClick={() => unbanUser(u)}>
                        <ShieldCheck size={15} />
                      </button>
                    ) : (
                      <button type="button" className="btn-ghost danger au-ban-btn" aria-label={`Ban ${u.name}`} title="Ban user" onClick={() => openBan(u)}>
                        <Ban size={15} />
                      </button>
                    )
                  )}
                  {!isMe && (u.collection !== 'admins' || me?.isSuperAdmin) && (
                    <button type="button" className="btn-ghost danger au-delete" aria-label={`Delete ${u.name}`} title="Delete user" onClick={() => removeUser(u)}>
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
                <dl className="au-meta">
                  <div><dt><Mail size={14} /> Email</dt><dd>{u.email}</dd></div>
                  <div><dt><Phone size={14} /> Contact</dt><dd>{u.contact || '—'}</dd></div>
                  {u.collection !== 'admins' && <div><dt><UserCheck size={14} /> Reporting Manager</dt><dd>{manager ? manager.name : '—'}</dd></div>}
                  <div><dt><CalendarDays size={14} /> Joined</dt><dd>{fmtJoined(u.createdAt)}</dd></div>
                </dl>
                {u.isBanned && (
                  <div className="au-ban-note">
                    <small>Ban message{u.bannedAt ? ` · ${fmtJoined(u.bannedAt)}` : ''}</small>
                    <p>{u.banReason || 'No message'}</p>
                  </div>
                )}
                {String(u.role).toUpperCase() === 'REPORTING_MANAGER' && (
                  <div className="au-companies">
                    <span>Team ({reports.length})</span>
                    <div>
                      {reports.length === 0 ? (
                        <em>No one reports to this manager</em>
                      ) : (
                        reports.map((r) => (
                          <span key={`${r.collection}-${r.id}`} className="au-chip" title={`${r.name} (${r.email})`}>
                            {r.name} · {roleLabel(r.role)}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                )}
                {canAssign && (
                  <div className="au-card-actions">
                    <button type="button" className="btn-ghost" onClick={() => setAssignUser(u)}>
                      <Building2 size={15} /> Assign Companies
                    </button>
                    <button type="button" className="btn-ghost" onClick={() => setSopUser(u)}>
                      <ClipboardList size={15} /> Manage SOPs
                    </button>
                  </div>
                )}
                {canAssign && (
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
  };
  return (
    <div className="dashboard-content scrollable au-page">
      <div className="page-header">
        <div>
          <span className="page-label">{copy.label}</span>
          <h1>{copy.title}</h1>
          <p>{copy.text || (me?.isSuperAdmin ? `Add Users, assign companies (max ${max} each) and manage their SOPs.` : `Assign companies (max ${max} each) and manage SOPs for your users.`)}</p>
        </div>
        {mode === 'admins' ? (
          <Link to="/superadmin/create-admin" className="btn-primary"><UserPlus size={16} /> Create Admin</Link>
        ) : mode !== 'create-admin' && (mode !== 'all' || me?.isSuperAdmin) && (
          <button type="button" className="btn-primary" onClick={() => { adding ? closeForm() : setAdding(true); setCreated(''); setError(''); }}>
            {adding ? <><X size={16} /> Close</> : <><UserPlus size={16} /> {copy.button}</>}
          </button>
        )}
      </div>
      {error && <p className="error-message" role="alert">{error}</p>}
      {created && (
        <p className="success-message" role="status">
          {created}{mode === 'create-admin' && <> <Link to="/superadmin/manage-admins">Manage admins →</Link></>}
        </p>
      )}
      {adding && mode !== 'admins' && (mode !== 'all' || me?.isSuperAdmin) && (
        <form className="au-form" onSubmit={addUser}>
          <div className="au-form-head">
            <h3><UserPlus size={17} /> {copy.formTitle}</h3>
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
              {form.role !== 'ADMIN' && (
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
              )}
            </div>
          </div>
          {mode !== 'create-admin' && (
          <div className="au-roles">
            <span>Assign Primary Role *</span>
            <div className="au-role-pills">
              {formRoles.map((role) => (
                <label key={role} className={form.role === role ? 'active' : ''}>
                  <input type="radio" name="role" value={role} checked={form.role === role} onChange={handleChange} required />
                  {roleLabel(role)}
                </label>
              ))}
            </div>
          </div>
          )}
          <div className="au-form-actions">
            <button type="button" className="btn-ghost" onClick={closeForm} disabled={busy}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? 'Adding…' : copy.submit}
            </button>
          </div>
        </form>
      )}
      {showList && mode !== 'admins' && !loading && list.length > 0 && (
        <div className="au-filters">
          {['ALL', ...ROLES.filter((r) => counts[r])].map((r) => (
            <button key={r} type="button" className={roleFilter === r ? 'active' : ''} onClick={() => setRoleFilter(r)}>
              {r === 'ALL' ? 'All' : roleLabel(r)} <em>{r === 'ALL' ? users.length : counts[r]}</em>
            </button>
          ))}
        </div>
      )}
      {!showList ? null : loading ? (
        <p className="muted">Loading…</p>
      ) : list.length === 0 ? (
        <div className="au-empty">
          <Users size={30} />
          <p>{mode === 'admins' ? 'No admin accounts found.' : (me?.isSuperAdmin ? 'No Users yet. Press “Add User” to create the first one.' : 'No Users yet. A super admin can add them.')}</p>
        </div>
      ) : (
        grouped ? (
          <div className="au-depts">
            {departments.map((d) => (
              <section key={d.role} className="au-dept">
                <div className="au-dept-head">
                  <h2>{roleLabel(d.role)}</h2>
                  <em>{d.members.length} {d.members.length === 1 ? 'user' : 'users'}</em>
                </div>
                <div className="au-list">{d.members.map(renderCard)}</div>
              </section>
            ))}
          </div>
        ) : (
          <div className="au-list">{shown.map(renderCard)}</div>
        )
      )}
      {banTarget && (
        <div className="modal-overlay" onClick={closeBan}>
          <form className="modal-card au-ban-modal" onClick={(e) => e.stopPropagation()} onSubmit={confirmBan}>
            <div className="au-ban-head">
              <span><Ban size={20} /></span>
              <div>
                <h3>Ban {banTarget.name}?</h3>
                <p>They will be signed out and cannot log in until you unban them.</p>
              </div>
            </div>
            <label className="x-field">
              <span>Message for the user *</span>
              <textarea
                value={banMsg}
                onChange={(e) => setBanMsg(e.target.value)}
                maxLength={300}
                rows={4}
                autoFocus
                required
                placeholder="e.g. Your account is on hold because of repeated policy violations. Contact HR."
              />
              <small className="au-ban-count">{banMsg.length}/300 · they will see this message when they try to sign in</small>
            </label>
            <div className="au-form-actions">
              <button type="button" className="btn-ghost" onClick={closeBan} disabled={banBusy}>Cancel</button>
              <button type="submit" className="btn-primary au-ban-confirm" disabled={banBusy || !banMsg.trim()}>
                {banBusy ? 'Banning…' : 'Ban user'}
              </button>
            </div>
          </form>
        </div>
      )}
      {pwTarget && (
        <div className="modal-overlay" onClick={closePw}>
          <form className="modal-card au-ban-modal" onClick={(e) => e.stopPropagation()} onSubmit={confirmPw}>
            <div className="au-ban-head">
              <span><KeyRound size={20} /></span>
              <div>
                <h3>Change password</h3>
                <p>Set a new password for {pwTarget.name} ({pwTarget.email}).</p>
              </div>
            </div>
            {pwError && <p className="error-message" role="alert">{pwError}</p>}
            <label className="x-field">
              <span>New password *</span>
              <div className="au-password">
                <input type={pwShow ? 'text' : 'password'} value={pw.next} onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))} minLength={8} maxLength={72} required autoFocus autoComplete="new-password" placeholder="At least 8 characters" />
                <button type="button" onClick={() => setPwShow((v) => !v)} aria-label={pwShow ? 'Hide password' : 'Show password'}>
                  {pwShow ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>
            <label className="x-field">
              <span>Confirm new password *</span>
              <input type={pwShow ? 'text' : 'password'} value={pw.confirm} onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))} minLength={8} maxLength={72} required autoComplete="new-password" placeholder="Type it again" />
            </label>
            <div className="au-form-actions">
              <button type="button" className="btn-ghost" onClick={closePw} disabled={pwBusy}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={pwBusy || !pw.next || !pw.confirm}>
                {pwBusy ? 'Saving…' : 'Change password'}
              </button>
            </div>
          </form>
        </div>
      )}
      {assignUser && ['smes', 'smis'].includes(assignUser.collection) && (
        <AssignCompaniesModal
          user={assignUser}
          companies={companies}
          max={max}
          onSaved={() => { setAssignUser(null); reload(); }}
          onClose={() => setAssignUser(null)}
        />
      )}
      {sopUser && ['smes', 'smis'].includes(sopUser.collection) && (
        <ManageSopsModal user={sopUser} companies={companies} onClose={() => setSopUser(null)} />
      )}
    </div>
  );
};
export default AdminUsers;
