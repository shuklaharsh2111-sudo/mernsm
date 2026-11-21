import { Ban } from 'lucide-react';
import { useAuth } from './AuthContext';
import api from './api';
import './styles/banned.css';

// Shown instead of the app when the admin has banned this account.
const BannedScreen = () => {
  const { banned, clearBanned } = useAuth();
  return (
    <div className="ban-page">
      <div className="ban-card" role="alert">
        <span className="ban-icon"><Ban size={30} /></span>
        <h1>Account banned</h1>
        <p className="ban-lead">An admin has stopped this account from using the app.</p>
        {banned?.reason ? (
          <div className="ban-msg">
            <small>Message from admin</small>
            <p>{banned.reason}</p>
          </div>
        ) : (
          <p className="ban-lead">Please contact your admin if you think this is a mistake.</p>
        )}
        <button type="button" className="ban-btn" onClick={async () => {
          // end the old session so the ban screen does not come back on reload
          try { await api.post('/auth/logout'); } catch { /* ignore */ }
          clearBanned();
          window.location.assign('/login');
        }}>
          Back to login
        </button>
      </div>
    </div>
  );
};

export default BannedScreen;
