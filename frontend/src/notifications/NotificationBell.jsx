import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bell, BellOff, Volume2, VolumeX, CheckCheck, Trash2, X, CircleCheck, TriangleAlert, OctagonAlert, Info } from 'lucide-react';
import { useNotifications } from './NotificationContext';
import '../styles/notifications.css';

const TONE_ICON = { success: CircleCheck, warning: TriangleAlert, danger: OctagonAlert, info: Info };

const ago = (value) => {
  const secs = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (secs < 45) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

// The toasts that slide in when something new arrives.
const Toasts = () => {
  const { toasts, dismiss, open } = useNotifications();
  if (!toasts.length) return null;
  return createPortal(
    <div className="nt-toasts" role="region" aria-label="New notifications">
      {toasts.map((n) => {
        const Icon = TONE_ICON[n.tone] || Info;
        return (
          <div className={`nt-toast ${n.tone}`} key={n.id} role="status">
            <button type="button" className="nt-toast-body" onClick={() => open(n)}>
              <span className="nt-icon"><Icon size={18} /></span>
              <span className="nt-text">
                <strong>{n.title}</strong>
                {n.message && <span>{n.message}</span>}
              </span>
            </button>
            <button type="button" className="nt-toast-x" onClick={() => dismiss(n.id)} aria-label="Dismiss"><X size={14} /></button>
          </div>
        );
      })}
    </div>,
    document.body
  );
};

const NotificationBell = () => {
  const { items, unread, muted, open, markAllRead, clearAll, toggleMuted } = useNotifications();
  const [show, setShow] = useState(false);
  const box = useRef(null);

  useEffect(() => {
    if (!show) return undefined;
    const onDown = (e) => { if (box.current && !box.current.contains(e.target)) setShow(false); };
    const onKey = (e) => { if (e.key === 'Escape') setShow(false); };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [show]);

  return (
    <>
      <div className="nt-wrap" ref={box}>
        <button
          type="button"
          className={`nt-bell ${unread ? 'has-new' : ''}`}
          onClick={() => setShow((s) => !s)}
          aria-label={unread ? `${unread} unread notifications` : 'Notifications'}
          aria-expanded={show}
        >
          <Bell size={18} />
          {unread > 0 && <span className="nt-badge">{unread > 99 ? '99+' : unread}</span>}
        </button>

        {show && (
          <div className="nt-panel" role="dialog" aria-label="Notifications">
            <div className="nt-head">
              <strong>Notifications</strong>
              <div className="nt-head-actions">
                <button type="button" onClick={toggleMuted} title={muted ? 'Sound is off. Turn on' : 'Sound is on. Turn off'} aria-label="Toggle sound">
                  {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                </button>
                <button type="button" onClick={markAllRead} disabled={!unread} title="Mark all as read" aria-label="Mark all as read"><CheckCheck size={16} /></button>
                <button type="button" onClick={clearAll} disabled={!items.length} title="Clear all" aria-label="Clear all"><Trash2 size={16} /></button>
              </div>
            </div>
            <div className="nt-list">
              {items.length === 0 ? (
                <div className="nt-empty"><BellOff size={26} /><p>You are all caught up.</p></div>
              ) : items.map((n) => {
                const Icon = TONE_ICON[n.tone] || Info;
                return (
                  <button type="button" key={n.id} className={`nt-item ${n.tone} ${n.read ? '' : 'unread'}`} onClick={() => { setShow(false); open(n); }}>
                    <span className="nt-icon"><Icon size={17} /></span>
                    <span className="nt-text">
                      <strong>{n.title}</strong>
                      {n.message && <span>{n.message}</span>}
                      <em>{ago(n.createdAt)}</em>
                    </span>
                    {!n.read && <i className="nt-dot" aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
      <Toasts />
    </>
  );
};

export default NotificationBell;
