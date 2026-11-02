import { useEffect, useRef, useState } from 'react';
import { Camera, Trash2, Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react';
import api from '../api';
import { useAuth } from '../AuthContext';
import { errMsg } from '../sopUtils';
import '../styles/settings.css';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const Notice = ({ notice }) =>
    notice ? (
        <div className={`st-notice ${notice.type}`} role="alert">
            {notice.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            {notice.text}
        </div>
    ) : null;

const SmeSettings = () => {
    const { user, fetchUser } = useAuth();
    const fileRef = useRef(null);

    const [name, setName] = useState(user?.name || '');
    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState('');
    const [removeAvatar, setRemoveAvatar] = useState(false);
    const [savingProfile, setSavingProfile] = useState(false);
    const [profileNotice, setProfileNotice] = useState(null);

    const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
    const [showPasswords, setShowPasswords] = useState(false);
    const [savingPassword, setSavingPassword] = useState(false);
    const [passwordNotice, setPasswordNotice] = useState(null);

    useEffect(() => {
        if (user?.name) setName(prev => prev || user.name);
    }, [user?.name]);

    useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

    const currentAvatar =
        preview ||
        (removeAvatar ? '' : user?.avatar) ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(name || user?.name || 'User')}&background=6366f1&color=fff&size=256`;

    const pickImage = (event) => {
        const picked = event.target.files?.[0];
        event.target.value = '';
        if (!picked) return;

        if (!IMAGE_TYPES.includes(picked.type)) {
            setProfileNotice({ type: 'error', text: 'Only JPG, PNG, WEBP and GIF images are allowed.' });
            return;
        }
        if (picked.size > MAX_IMAGE_BYTES) {
            setProfileNotice({ type: 'error', text: 'Image must be 5 MB or smaller.' });
            return;
        }

        setProfileNotice(null);
        setFile(picked);
        setRemoveAvatar(false);
        setPreview(URL.createObjectURL(picked));
    };

    const clearImage = () => {
        setFile(null);
        setPreview('');
        setRemoveAvatar(true);
    };

    const nameChanged = name.trim() !== (user?.name || '');
    const profileDirty = nameChanged || !!file || removeAvatar;

    const saveProfile = async (event) => {
        event.preventDefault();
        setProfileNotice(null);

        if (name.trim().length < 2) {
            setProfileNotice({ type: 'error', text: 'Name must be at least 2 characters.' });
            return;
        }

        try {
            setSavingProfile(true);
            const fd = new FormData();
            fd.append('name', name.trim());
            if (file) fd.append('avatar', file);
            else if (removeAvatar) fd.append('removeAvatar', 'true');

            await api.put('/sme/profile', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
            await fetchUser();

            setFile(null);
            setPreview('');
            setRemoveAvatar(false);
            setProfileNotice({ type: 'success', text: 'Profile updated.' });
        } catch (err) {
            setProfileNotice({ type: 'error', text: errMsg(err) });
        } finally {
            setSavingProfile(false);
        }
    };

    const handlePasswordChange = (event) => {
        const { name: field, value } = event.target;
        setPasswords(prev => ({ ...prev, [field]: value }));
        setPasswordNotice(null);
    };

    const savePassword = async (event) => {
        event.preventDefault();
        setPasswordNotice(null);

        if (passwords.newPassword.length < 8) {
            setPasswordNotice({ type: 'error', text: 'New password must be at least 8 characters.' });
            return;
        }
        if (passwords.newPassword !== passwords.confirmPassword) {
            setPasswordNotice({ type: 'error', text: 'New password and confirm password do not match.' });
            return;
        }

        try {
            setSavingPassword(true);
            await api.put('/sme/password', {
                currentPassword: passwords.currentPassword,
                newPassword: passwords.newPassword
            });
            setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
            setPasswordNotice({ type: 'success', text: 'Password changed.' });
        } catch (err) {
            setPasswordNotice({ type: 'error', text: errMsg(err) });
        } finally {
            setSavingPassword(false);
        }
    };

    const passwordType = showPasswords ? 'text' : 'password';

    return (
        <div className="dashboard-content scrollable">
            <div className="page-header">
                <div>
                    <span className="page-label">SME WORKSPACE</span>
                    <h1>Settings</h1>
                    <p>Update your profile image, name and password.</p>
                </div>
            </div>

            <div className="st-grid">
                <form className="st-card" onSubmit={saveProfile}>
                    <h2>Profile</h2>

                    <div className="st-avatar-row">
                        <img className="st-avatar" src={currentAvatar} alt="Profile" />
                        <div className="st-avatar-actions">
                            <input
                                ref={fileRef}
                                type="file"
                                accept={IMAGE_TYPES.join(',')}
                                onChange={pickImage}
                                hidden
                            />
                            <button type="button" className="st-btn ghost" onClick={() => fileRef.current?.click()}>
                                <Camera size={15} /> Change image
                            </button>
                            {(user?.avatar || file) && !removeAvatar && (
                                <button type="button" className="st-btn danger" onClick={clearImage}>
                                    <Trash2 size={15} /> Remove
                                </button>
                            )}
                            <small>JPG, PNG, WEBP or GIF, up to 5 MB</small>
                        </div>
                    </div>

                    <div className="st-field">
                        <label htmlFor="st-name">Name</label>
                        <input
                            id="st-name"
                            type="text"
                            value={name}
                            maxLength={60}
                            onChange={event => { setName(event.target.value); setProfileNotice(null); }}
                            required
                        />
                    </div>

                    <div className="st-field">
                        <label htmlFor="st-email">Email</label>
                        <input id="st-email" type="email" value={user?.email || ''} disabled />
                    </div>

                    <Notice notice={profileNotice} />

                    <div className="st-actions">
                        <button type="submit" className="st-btn primary" disabled={savingProfile || !profileDirty}>
                            {savingProfile ? 'Saving...' : 'Save profile'}
                        </button>
                    </div>
                </form>

                <form className="st-card" onSubmit={savePassword}>
                    <h2>Change password</h2>

                    <div className="st-field">
                        <label htmlFor="st-current">Current password</label>
                        <input
                            id="st-current"
                            name="currentPassword"
                            type={passwordType}
                            value={passwords.currentPassword}
                            onChange={handlePasswordChange}
                            autoComplete="current-password"
                            required
                        />
                    </div>

                    <div className="st-field">
                        <label htmlFor="st-new">New password</label>
                        <input
                            id="st-new"
                            name="newPassword"
                            type={passwordType}
                            value={passwords.newPassword}
                            onChange={handlePasswordChange}
                            autoComplete="new-password"
                            minLength={8}
                            maxLength={72}
                            required
                        />
                    </div>

                    <div className="st-field">
                        <label htmlFor="st-confirm">Confirm new password</label>
                        <input
                            id="st-confirm"
                            name="confirmPassword"
                            type={passwordType}
                            value={passwords.confirmPassword}
                            onChange={handlePasswordChange}
                            autoComplete="new-password"
                            required
                        />
                    </div>

                    <button type="button" className="st-toggle" onClick={() => setShowPasswords(v => !v)}>
                        {showPasswords ? <EyeOff size={15} /> : <Eye size={15} />}
                        {showPasswords ? 'Hide passwords' : 'Show passwords'}
                    </button>

                    <Notice notice={passwordNotice} />

                    <div className="st-actions">
                        <button type="submit" className="st-btn primary" disabled={savingPassword}>
                            {savingPassword ? 'Updating...' : 'Update password'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default SmeSettings;
