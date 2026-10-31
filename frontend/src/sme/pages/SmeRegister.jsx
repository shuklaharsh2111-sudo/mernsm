import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import Field from '../../admin/components/Field';
import { registerSme } from '../api/smeApi';
import { useSmeAuth } from '../context/SmeAuthContext';

<<<<<<< HEAD
// Add more departments here later.
const DEPARTMENTS = ['SME'];

=======
>>>>>>> 28c3d6cc6e87ebe9a78ddfb9bd1064398e9eae37
export default function SmeRegister() {
  const { sme, saveSession } = useSmeAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    email: '',
<<<<<<< HEAD
    department: DEPARTMENTS[0],
=======
    department: '',
    expertise: '',
    employeeId: '',
>>>>>>> 28c3d6cc6e87ebe9a78ddfb9bd1064398e9eae37
    password: '',
    confirm: '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (sme) return <Navigate to="/sme/dashboard" replace />;

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) {
      setError('Passwords do not match');
      return;
    }
    setBusy(true);
    try {
      const { confirm, ...body } = form; // eslint-disable-line no-unused-vars
      saveSession(await registerSme(body));
      navigate('/sme/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="admin-page">
      <div className="admin-card wide">
        <span className="sme-role-pill">Subject Matter Expert</span>
        <h1>Create your SME account</h1>
        <p className="admin-subtitle">
          Write SOPs for your department and track their review. No admin code needed.
        </p>

        <form onSubmit={onSubmit}>
          <div className="admin-grid-2">
            <Field label="Full name" name="name" value={form.name} onChange={onChange} required autoComplete="name" />
            <Field label="Work email" type="email" name="email" value={form.email} onChange={onChange} required autoComplete="email" />
<<<<<<< HEAD
            <label className="admin-field">
              <span>Department</span>
              <select name="department" value={form.department} onChange={onChange} required>
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </label>
=======
            <Field label="Department" name="department" value={form.department} onChange={onChange} required maxLength={80} />
            <Field label="Area of expertise" name="expertise" value={form.expertise} onChange={onChange} maxLength={120} placeholder="e.g. Quality control" />
            <Field label="Employee ID (optional)" name="employeeId" value={form.employeeId} onChange={onChange} maxLength={40} />
>>>>>>> 28c3d6cc6e87ebe9a78ddfb9bd1064398e9eae37
            <span />
            <Field label="Password (min 8 characters)" type="password" name="password" value={form.password} onChange={onChange} required minLength={8} autoComplete="new-password" />
            <Field label="Confirm password" type="password" name="confirm" value={form.confirm} onChange={onChange} required minLength={8} autoComplete="new-password" />
          </div>
          {error && <p className="admin-error" role="alert">{error}</p>}
          <button className="admin-btn" disabled={busy}>{busy ? 'Creating account…' : 'Create SME account'}</button>
        </form>

        <p className="admin-footer">
          Already registered? <Link to="/login">Login</Link>
        </p>
      </div>
    </main>
  );
}
