import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import AuthCard from '../components/AuthCard';
import Field from '../components/Field';
import { loginAdmin } from '../api/adminApi';
import { useAdminAuth } from '../context/AdminAuthContext';

export default function AdminLogin() {
  const { admin, saveSession } = useAdminAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (admin) return <Navigate to="/admin/dashboard" replace />;

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      saveSession(await loginAdmin(form));
      navigate('/admin/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard
      title="Admin login"
      subtitle="Sign in to manage your site"
      footer={<>Need an admin account? <Link to="/admin/register">Register</Link></>}
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
