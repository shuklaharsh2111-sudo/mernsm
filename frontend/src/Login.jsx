import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, KeyRound, Lock, Mail, MapPin } from 'lucide-react';

import { useAuth } from './AuthContext';
import SpaceSuitViewer from './components/SpaceSuitViewer';
import './styles/login.css';

/* Orange tick: ripple ring + spring-in badge + drawn check + tiny sparks.
   Mounted only while the field has text, so it plays once when the field gets filled. */
const Tick = () => (
  <span className="nl-tick" aria-hidden="true">
    <span className="nl-tick-ripple" />
    <span className="nl-tick-badge">
      <svg viewBox="0 0 24 24" fill="none">
        <path className="nl-tick-check" d="M6.5 12.8l3.6 3.6 7.4-7.8" />
      </svg>
    </span>
    {[0, 1, 2, 3, 4, 5].map((i) => (
      <i key={i} className="nl-spark" style={{ '--a': `${i * 60}deg` }} />
    ))}
  </span>
);

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError('');
    setLoading(true);

    try {
      const user = await login(email, password);

      navigate(
        user.role === 'admin' ? '/admin' : '/sme',
        { replace: true }
      );

    } catch (err) {
      setError(
        err.response?.data?.message ||
        'Unable to login. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const emailFilled = email.trim() !== '';
  const passwordFilled = password !== '';

  return (
    <div className="nl-page">
      <div className="nl-card">

        {/* LEFT: 3D astronaut */}
        <div className="nl-visual">
          <SpaceSuitViewer />
        </div>

        {/* RIGHT: top bar / form / footer note */}
        <div className="nl-panel">

          <header className="nl-top">
            <div className="nl-brand">
              <span className="nl-brand-mark">N</span>
              <span className="nl-brand-name">NURO</span>
            </div>

            <button
              type="button"
              className="nl-forgot"
              onClick={() => setError('Please contact your admin to reset your password.')}
            >
              <span className="nl-forgot-icon"><KeyRound size={16} /></span>
              Forgot password?
            </button>
          </header>

          <div className="nl-form-wrap">
            <p className="nl-eyebrow">Login to</p>
            <h1 className="nl-title">
              Where Creative
              <span>Work Flows</span>
            </h1>

            <form onSubmit={handleSubmit}>
              <div className={`nl-input${emailFilled ? ' is-filled' : ''}`}>
                <Mail size={18} className="nl-input-icon" />
                <input
                  type="email"
                  placeholder="Enter email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                  required
                />
                {emailFilled && <Tick />}
              </div>

              <div className={`nl-input${passwordFilled ? ' is-filled' : ''}`}>
                <Lock size={18} className="nl-input-icon" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="nl-eye"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>

              {error && <div className="nl-error">{error}</div>}

              <button className="nl-submit" type="submit" disabled={loading}>
                {loading ? 'Checking location & signing in...' : (
                  <>Sign In <ArrowRight size={18} /></>
                )}
              </button>
            </form>
          </div>

          <p className="nl-note">
            <MapPin size={14} />
            Staff logins work only from the office. Allow location access when your browser asks.
          </p>

        </div>
      </div>
    </div>
  );
};

export default Login;
