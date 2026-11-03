import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, Check, Loader2, KeyRound } from 'lucide-react';

import { useAuth } from './AuthContext';
import LoginLiquid from './LoginLiquid';
import './login.css';

const EMAIL_RE = /^\S+@\S+\.\S+$/;

// where the "Contact admin" link sends people; change to your admin's address or a support page
const ADMIN_EMAIL = 'admin@yourcompany.com';

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // interaction state
  const [focused, setFocused] = useState(null); // 'email' | 'password' | null
  const [pulse, setPulse] = useState(0);        // bumps on every keystroke -> liquid reacts
  const [caps, setCaps] = useState(false);
  const [shake, setShake] = useState(false);

  const [lite, setLite] = useState(false);    // slow GPU -> drop the decorative CSS effects

  const shakeTimer = useRef(0);

  useEffect(() => () => clearTimeout(shakeTimer.current), []);

  const handleLowPerf = useCallback(() => setLite(true), []);

  const emailOk = EMAIL_RE.test(email);
  const mode = loading ? 'loading' : error ? 'error' : focused ? 'focus' : 'idle';

  // button: magnetic pull + click ripple
  const handleBtnMove = (e) => {
    const b = e.currentTarget;
    const r = b.getBoundingClientRect();
    const x = (e.clientX - (r.left + r.width / 2)) / r.width;
    const y = (e.clientY - (r.top + r.height / 2)) / r.height;
    b.style.setProperty('--bx', `${(x * 10).toFixed(1)}px`);
    b.style.setProperty('--by', `${(y * 6).toFixed(1)}px`);
  };

  const handleBtnLeave = (e) => {
    e.currentTarget.style.removeProperty('--bx');
    e.currentTarget.style.removeProperty('--by');
  };

  const handleBtnDown = (e) => {
    const b = e.currentTarget;
    const r = b.getBoundingClientRect();
    const dot = document.createElement('span');
    dot.className = 'lx-ripple';
    dot.style.left = `${e.clientX - r.left}px`;
    dot.style.top = `${e.clientY - r.top}px`;
    dot.addEventListener('animationend', () => dot.remove());
    b.appendChild(dot);
  };

  const handleCaps = (e) => {
    if (e.getModifierState) setCaps(e.getModifierState('CapsLock'));
  };

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
      setShake(true);
      clearTimeout(shakeTimer.current);
      shakeTimer.current = setTimeout(() => setShake(false), 600);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`lx-page${lite ? ' lx-lite' : ''}`}
    >

      <div className="lx-bg" aria-hidden="true">
        <span className="lx-blob b1" />
        <span className="lx-blob b2" />
        <span className="lx-blob b3" />
        <span className="lx-glow" />
        <span className="lx-sweep" />
        <span className="lx-grain" />
      </div>

      <div
        className={`lx-tilt${shake ? ' shake' : ''}`}
        data-mode={mode}
      >
        <div className="lx-card">

          {/* left: liquid metal */}
          <aside className="lx-art">
            <LoginLiquid mode={mode} pulse={pulse} onLowPerf={handleLowPerf} />
          </aside>

          {/* right: form */}
          <section className="lx-panel">

            <a
              className="lx-help"
              href={`mailto:${ADMIN_EMAIL}?subject=${encodeURIComponent('Password reset request')}${emailOk ? `&body=${encodeURIComponent(`Please reset the password for ${email}.`)}` : ''}`}
            >
              <span className="lx-help-ico" aria-hidden="true"><KeyRound size={13} /></span>
              <span className="lx-help-text">Forgot password?</span>
            </a>

            <p className="lx-kicker">Login to</p>
            <h1 className="lx-title">
              Where Creative<br />Work Flows
            </h1>

            <form className="lx-form" onSubmit={handleSubmit}>

              <div className="lx-field">
                <input
                  id="lx-email"
                  type="email"
                  aria-label="Email address"
                  placeholder="Enter email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setPulse((p) => p + 1); }}
                  onFocus={() => setFocused('email')}
                  onBlur={() => setFocused(null)}
                  autoComplete="username"
                  required
                />
                {emailOk && <Check size={15} className="lx-ok" aria-hidden="true" />}
              </div>

              <div className="lx-field">
                <input
                  id="lx-password"
                  type={showPassword ? 'text' : 'password'}
                  aria-label="Password"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setPulse((p) => p + 1); }}
                  onFocus={() => setFocused('password')}
                  onBlur={() => { setFocused(null); setCaps(false); }}
                  onKeyDown={handleCaps}
                  onKeyUp={handleCaps}
                  autoComplete="current-password"
                  required
                />

                <button
                  type="button"
                  className="lx-eye"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>

              {caps && <div className="lx-hint" role="status">Caps Lock is on</div>}

              {error && (
                <div className="lx-error" role="alert">
                  {error}
                </div>
              )}

              <button
                className="lx-btn"
                type="submit"
                disabled={loading}
                onPointerMove={handleBtnMove}
                onPointerLeave={handleBtnLeave}
                onPointerDown={handleBtnDown}
              >
                {loading
                  ? (<><Loader2 size={17} className="lx-spinner" /> Checking location...</>)
                  : (<>Sign In <ArrowRight size={17} /></>)}
              </button>

              <p className="lx-hint" style={{ margin: '6px 0 0 4px' }}>
                Staff logins work only from the office. Allow location access when your browser asks.
              </p>

            </form>

            <div className="lx-brand">
              <div className="lx-logo" aria-label="Nuro">
                <span className="lx-logo-mark" aria-hidden="true">
                  <svg viewBox="0 0 32 32">
                    <path d="M10.5 22V10l11 12V10" fill="none" stroke="#1c1e22" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span className="lx-logo-name">Nuro</span>
              </div>
            </div>

          </section>
        </div>
      </div>

    </div>
  );
};

export default Login;