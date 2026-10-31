import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import AuthCard from '../components/AuthCard';
import Field from '../components/Field';
import { registerAdmin } from '../api/adminApi';
import { useAdminAuth } from '../context/AdminAuthContext';

export default function AdminRegister() {
  const { admin, saveSession } = useAdminAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', adminCode: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (admin) return <Navigate to="/admin/dashboard" replace />;

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      saveSession(await registerAdmin(form));
      navigate('/admin/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard
      title="Admin register"
      subtitle="Only people with the admin code can create an account"
      footer={<>Already an admin? <Link to="/login">Login</Link></>}
    >
      <form onSubmit={onSubmit}>
        <Field label="Name" name="name" value={form.name} onChange={onChange} required autoComplete="name" />
        <Field label="Email" type="email" name="email" value={form.email} onChange={onChange} required autoComplete="email" />
        <Field label="Password (min 8 characters)" type="password" name="password" value={form.password} onChange={onChange} required minLength={8} autoComplete="new-password" />
        <Field label="Admin code" type="password" name="adminCode" value={form.adminCode} onChange={onChange} required autoComplete="off" />
        {error && <p className="admin-error" role="alert">{error}</p>}
        <button className="admin-btn" disabled={busy}>{busy ? 'Creating account…' : 'Register'}</button>
      </form>
    </AuthCard>
  );
}
