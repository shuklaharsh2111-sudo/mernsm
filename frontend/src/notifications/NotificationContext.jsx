import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../AuthContext';
import { isMuted, setMuted as saveMuted, playNotification } from './sound';

const NotificationContext = createContext(null);
const POLL_MS = 5000;
const TOAST_MS = 7000;

export const NotificationProvider = ({ children }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [toasts, setToasts] = useState([]);
  const [muted, setMutedState] = useState(isMuted());
  // ids already shown. null until the first load, so old notifications do not ring when you open the app.
  const known = useRef(null);
  const baseTitle = useRef(typeof document !== 'undefined' ? document.title : '');

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/notifications');
      const list = data.notifications || [];
      if (known.current === null) {
        known.current = new Set(list.map((n) => n.id));
      } else {
        const fresh = list.filter((n) => !known.current.has(n.id));
        fresh.forEach((n) => known.current.add(n.id));
        if (fresh.length) {
          const order = ['danger', 'warning', 'success', 'info'];
          const loudest = [...fresh].sort((a, b) => order.indexOf(a.tone) - order.indexOf(b.tone))[0];
          playNotification(loudest.tone);
          setToasts((t) => [...fresh.slice(0, 3), ...t].slice(0, 4));
          fresh.slice(0, 3).forEach((n) => setTimeout(() => dismiss(n.id), TOAST_MS));
        }
      }
      setItems(list);
      setUnread(data.unreadCount || 0);
    } catch {
      /* offline or signed out: try again on the next tick */
    }
  }, [dismiss]);

  useEffect(() => {
    if (!user) return undefined;
    known.current = null;
    load();
    const timer = setInterval(load, POLL_MS);
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [user, load]);

  // "(3) Neuro" in the browser tab so it is visible from other tabs too
  useEffect(() => {
    document.title = unread > 0 ? `(${unread}) ${baseTitle.current}` : baseTitle.current;
    return () => { document.title = baseTitle.current; };
  }, [unread]);

  const markRead = useCallback(async (id) => {
    setItems((list) => list.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnread((c) => Math.max(0, c - 1));
    try { await api.put(`/notifications/${id}/read`); } catch { /* ignore */ }
  }, []);

  const markAllRead = useCallback(async () => {
    setItems((list) => list.map((n) => ({ ...n, read: true })));
    setUnread(0);
    try { await api.put('/notifications/read-all'); } catch { /* ignore */ }
  }, []);

  const clearAll = useCallback(async () => {
    setItems([]);
    setUnread(0);
    try { await api.delete('/notifications'); } catch { /* ignore */ }
  }, []);

  const open = useCallback((n) => {
    dismiss(n.id);
    if (!n.read) markRead(n.id);
    if (n.link) navigate(n.link);
  }, [dismiss, markRead, navigate]);

  const toggleMuted = useCallback(() => {
    setMutedState((m) => {
      saveMuted(!m);
      return !m;
    });
  }, []);

  const value = useMemo(() => ({
    items, unread, toasts, muted, dismiss, open, markRead, markAllRead, clearAll, toggleMuted, reload: load
  }), [items, unread, toasts, muted, dismiss, open, markRead, markAllRead, clearAll, toggleMuted, load]);

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
};

export const useNotifications = () => useContext(NotificationContext);
