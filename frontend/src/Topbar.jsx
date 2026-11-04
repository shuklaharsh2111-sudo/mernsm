import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Menu, CalendarDays, Clock3 } from 'lucide-react';
import { useAuth } from './AuthContext';
import { titleFor } from './navConfig';

const Topbar = ({ onMenu }) => {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  const found = titleFor(user?.role, pathname);
  const isHome = pathname === '/sme' || pathname === '/admin';
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
  const title = isHome ? `${greeting}, ${user?.name || 'there'}!` : found.title;
  const section = found.section;
  const date = now.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
  const time = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

  return (
    <header className="app-topbar">
      <button type="button" className="top-menu" onClick={onMenu} aria-label="Open menu"><Menu size={20} /></button>
      <div className="top-title">
        <span>{user?.role === 'admin' ? 'Administration' : 'SME Workspace'} · {section}</span>
        <h1>{title}</h1>
      </div>
      <div className="top-meta">
        <span className="top-chip"><CalendarDays size={15} /> {date}</span>
        <span className="top-chip"><Clock3 size={15} /> {time}</span>
        <span className="top-user">
          <i>{(user?.name || 'U').trim()[0]?.toUpperCase()}</i>
          <b>{user?.name}</b>
        </span>
      </div>
    </header>
  );
};

export default Topbar;
