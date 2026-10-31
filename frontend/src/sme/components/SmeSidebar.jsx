import { useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import Avatar from '../../admin/components/Avatar';
import { useSmeAuth } from '../context/SmeAuthContext';
import { updateSmeAvatar } from '../api/smeApi';
import { toAvatarDataUrl } from '../../shared/avatar';

export default function SmeSidebar() {
  const { sme, token, setSme, logout } = useSmeAuth();
  const fileRef = useRef(null);
  const [error, setError] = useState('');

  const onPick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    try {
      const dataUrl = await toAvatarDataUrl(file);
      const data = await updateSmeAvatar(token, dataUrl);
      setSme(data.sme);
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
          <Avatar name={sme.name} src={sme.avatar} />
          <span className="admin-avatar-edit">Change</span>
        </button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPick} />
        <h2>{sme.name}</h2>
        <p className="admin-profile-email">{sme.email}</p>
        <span className="sme-role-pill">SME · {sme.department}</span>
        {error && <p className="admin-error">{error}</p>}
      </div>

      <nav className="admin-nav">
        <NavLink to="/sme/dashboard">Dashboard</NavLink>
        <NavLink to="/sme/sops">My SOPs</NavLink>
      </nav>

      <button type="button" className="admin-logout" onClick={logout}>
        Logout
      </button>
    </aside>
  );
}
