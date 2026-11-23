import { useRef, useState } from 'react';
import { Play, Upload, Trash2, Volume2, VolumeX, Check, Music2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useNotifications } from '../notifications/NotificationContext';
import {
    SOUND_PRESETS, MAX_SOUND_BYTES, getSoundChoice, setSoundChoice, getCustomSound, saveCustomSound,
    removeCustomSound, getVolume, setVolume, previewSound
} from '../notifications/sound';

// "Notifications" section: sound on/off, pick a sound, upload your own, volume. Saved in this browser.
const NotificationSettings = () => {
    const { muted, toggleMuted } = useNotifications();
    const fileRef = useRef(null);
    const [choice, setChoice] = useState(getSoundChoice());
    const [custom, setCustom] = useState(getCustomSound());
    const [volume, setVol] = useState(Math.round(getVolume() * 100));
    const [notice, setNotice] = useState(null);

    const pick = (id) => {
        setSoundChoice(id);
        setChoice(id);
        setNotice(null);
        previewSound(id);
    };

    const onUpload = async (event) => {
        const picked = event.target.files?.[0];
        event.target.value = '';
        if (!picked) return;
        try {
            const saved = await saveCustomSound(picked);
            setCustom(saved);
            setChoice('custom');
            setNotice({ type: 'success', text: 'Your sound is saved and selected.' });
            previewSound('custom');
        } catch (err) {
            setNotice({ type: 'error', text: err.message });
        }
    };

    const onRemove = () => {
        removeCustomSound();
        setCustom(null);
        setChoice(getSoundChoice());
        setNotice({ type: 'success', text: 'Custom sound removed. Back to the default sound.' });
    };

    const onVolume = (event) => {
        const v = Number(event.target.value);
        setVol(v);
        setVolume(v / 100);
    };

    const options = [
        ...SOUND_PRESETS,
        ...(custom ? [{ id: 'custom', name: 'Your sound', hint: custom.name }] : [])
    ];

    return (
        <div className="st-stack">
            <section className="st-card">
                <div className="st-row">
                    <div className="st-row-text">
                        <h2>Notification sound</h2>
                        <p>Play a sound when a new notification arrives.</p>
                    </div>
                    <button
                        type="button"
                        role="switch"
                        aria-checked={!muted}
                        className={`st-switch ${muted ? '' : 'on'}`}
                        onClick={toggleMuted}
                        aria-label="Notification sound"
                    >
                        <i />
                    </button>
                </div>

                <div className={`st-sounds ${muted ? 'disabled' : ''}`}>
                    {options.map((o) => (
                        <div key={o.id} className={`st-sound ${choice === o.id ? 'active' : ''}`}>
                            <button type="button" className="st-sound-main" onClick={() => pick(o.id)} disabled={muted} aria-pressed={choice === o.id}>
                                <span className="st-sound-icon">{choice === o.id ? <Check size={16} /> : <Music2 size={16} />}</span>
                                <span className="st-sound-text">
                                    <strong>{o.name}</strong>
                                    <small>{o.hint}</small>
                                </span>
                            </button>
                            <button type="button" className="st-sound-play" onClick={() => previewSound(o.id)} aria-label={`Play ${o.name}`} title="Play">
                                <Play size={14} />
                            </button>
                        </div>
                    ))}
                </div>
            </section>

            <section className="st-card">
                <div className="st-row-text">
                    <h2>Your own sound</h2>
                    <p>Upload an MP3, WAV, OGG or M4A file, up to {Math.round(MAX_SOUND_BYTES / 1024 / 1024)} MB. Keep it short, a second or two works best.</p>
                </div>
                <input ref={fileRef} type="file" accept="audio/*" onChange={onUpload} hidden />
                <div className="st-avatar-actions">
                    <button type="button" className="st-btn ghost" onClick={() => fileRef.current?.click()}>
                        <Upload size={15} /> {custom ? 'Replace sound' : 'Upload sound'}
                    </button>
                    {custom && (
                        <button type="button" className="st-btn danger" onClick={onRemove}>
                            <Trash2 size={15} /> Remove
                        </button>
                    )}
                    {custom && <small className="st-file">Current: {custom.name}</small>}
                </div>
                {notice && (
                    <div className={`st-notice ${notice.type}`} role="alert">
                        {notice.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                        {notice.text}
                    </div>
                )}
            </section>

            <section className="st-card">
                <div className="st-row-text">
                    <h2>Volume</h2>
                    <p>How loud the notification sound plays.</p>
                </div>
                <div className="st-volume">
                    <VolumeX size={16} />
                    <input type="range" min="0" max="100" step="5" value={volume} onChange={onVolume} onPointerUp={() => previewSound(choice)} aria-label="Volume" />
                    <Volume2 size={16} />
                    <b>{volume}%</b>
                </div>
                <small className="st-foot">These sound settings are saved in this browser only.</small>
            </section>
        </div>
    );
};

export default NotificationSettings;
