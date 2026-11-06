import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, KeyRound, MapPin } from 'lucide-react';
import { useAuth } from './AuthContext';
import astronaut from './assets/images/pre-final.png';
import LoginRibbons from './LoginRibbons';
import './styles/login.css';
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
      const dashboardPath = {
        admin: '/admin',
        sme: '/sme',
        des: '/des',
        smi: '/smi'
      }[user.role] || '/login';
      navigate(dashboardPath, { replace: true });
    } catch (err) {
      setError(
        err.response?.data?.message ||
        'Unable to login. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="nl-page">
      <div className="nl-card">
        {/* LEFT: three.js neon ribbons + astronaut */}
        <div className="nl-visual" aria-hidden="true">
          <LoginRibbons />
          <div className="nl-shade" />
          <span className="nl-glow" />
          <img className="nl-astro" src={astronaut} alt="" draggable="false" />
        </div>
        {/* RIGHT: form */}
        <div className="nl-panel">
          <button
            type="button"
            className="nl-forgot"
            onClick={() => setError('Please contact your admin to reset your password.')}
          >
            <span className="nl-forgot-icon"><KeyRound size={16} /></span>
            Forgot password?
          </button>
          <div className="nl-form-wrap">
            <p className="nl-eyebrow">Login to</p>
            <h1 className="nl-title">
              Where Creative
              <span>Work Flows</span>
            </h1>
            <form onSubmit={handleSubmit}>
              <div className="nl-input">
                <input
                  type="email"
                  placeholder="Enter email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>
              <div className="nl-input">
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
            <p className="nl-note">
              <MapPin size={13} />
              Staff logins work only from the office. Allow location access when your browser asks.
            </p>
            <div className="nl-brand">
              <span className="nl-brand-mark">N</span>
              <span className="nl-brand-name">NEURO</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default Login;
