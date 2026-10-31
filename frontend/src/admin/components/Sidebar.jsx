import { useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import Avatar from './Avatar';
import { useAdminAuth } from '../context/AdminAuthContext';
import { updateAvatar } from '../api/adminApi';

// Resize to a small square JPEG so it stays light in MongoDB.
const toAvatarDataUrl = (file, size = 256) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      const side = Math.min(img.width, img.height);
      const sx = (img.width - side) / 2;
      const sy = (img.height - side) / 2;
      canvas.getContext('2d').drawImage(img, sx, sy, side, side, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => reject(new Error('Could not read that image'));
    img.src = url;
  });

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
      </nav>

      <button type="button" className="admin-logout" onClick={logout}>
        Logout
      </button>
    </aside>
  );
}
