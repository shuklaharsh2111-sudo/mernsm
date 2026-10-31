import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthCard from '../admin/components/AuthCard';
import Field from '../admin/components/Field';
import { loginUser } from './authApi';
import '../admin/admin.css';

// Where each role keeps its token + lands after login.
const ROLES = {
  admin: { tokenKey: 'adminToken', home: '/admin/dashboard' },
  sme: { tokenKey: 'smeToken', home: '/sme/dashboard' },
};

export default function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { token, role } = await loginUser(form);
      const target = ROLES[role];
      if (!target) throw new Error('Unknown account type');
      // Only one role signed in at a time on this browser.
      Object.values(ROLES).forEach((r) => localStorage.removeItem(r.tokenKey));
      localStorage.setItem(target.tokenKey, token);
      // The role's auth provider mounts fresh on that route and reads the token.
      navigate(target.home, { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <AuthCard
      title="Login"
      subtitle="Sign in as an admin or an SME"
      footer={
        <>
          New here? <Link to="/sme/register">Register as SME</Link>
          {' · '}
          <Link to="/admin/register">Register as admin</Link>
        </>
      }
    >
      <form onSubmit={onSubmit}>
        <Field label="Email" type="email" name="email" value={form.email} onChange={onChange} required autoComplete="email" />
        <Field label="Password" type="password" name="password" value={form.password} onChange={onChange} required autoComplete="current-password" />
        {error && <p className="admin-error" role="alert">{error}</p>}
        <button className="admin-btn" disabled={busy}>{busy ? 'Signing in…' : 'Login'}</button>
      </form>
    </AuthCard>
  );
}
