
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LockKeyhole, Mail, Eye, EyeOff } from 'lucide-react';

import { useAuth } from './AuthContext';

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

  return (
    <div className="login-page">

      <div className="login-card">

        <div className="login-logo">CM</div>

        <h1>Welcome Back</h1>
        <p className="login-subtitle">
          Sign in to your Creative Manager account
        </p>

        <form onSubmit={handleSubmit}>

          <label>Email Address</label>

          <div className="input-wrapper">
            <Mail size={19} />
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </div>

          <label>Password</label>

          <div className="input-wrapper">
            <LockKeyhole size={19} />
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />

            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
            </button>
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <button
            className="login-button"
            type="submit"
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>

        </form>

        <p className="login-footer">
          Creative Manager | Unstoppable Solutions
        </p>

      </div>

    </div>
  );
};

export default Login;
