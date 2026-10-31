import { useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import Avatar from './Avatar';
import { useAdminAuth } from '../context/AdminAuthContext';
import { updateAvatar } from '../api/adminApi';
import { toAvatarDataUrl } from '../../shared/avatar';

export default function Sidebar() {
  const { admin, token, setAdmin, logout } = useAdminAuth();
  const fileRef = useRef(null);
  const [error, setError] = useState('');

  const onPick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    try {
      const dataUrl = await toAvatarDataUrl(file);
      const data = await updateAvatar(token, dataUrl);
      setAdmin(data.admin);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <aside className="admin-sidebar">
      <div className="admin-profile">
        <button
          type="button"
          className="admin-avatar-btn"
          onClick={() => fileRef.current.click()}
          title="Change profile picture"
        >
          <Avatar name={admin.name} src={admin.avatar} />
          <span className="admin-avatar-edit">Change</span>
        </button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPick} />
        <h2>{admin.name}</h2>
        <p className="admin-profile-email">{admin.email}</p>
        {error && <p className="admin-error">{error}</p>}
      </div>

      <nav className="admin-nav">
        <NavLink to="/admin/dashboard">Dashboard</NavLink>
        <NavLink to="/admin/sops">SOP Review</NavLink>
      </nav>

      <button type="button" className="admin-logout" onClick={logout}>
        Logout
      </button>
    </aside>
  );
}
