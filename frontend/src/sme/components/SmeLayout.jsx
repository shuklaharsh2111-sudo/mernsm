import { Outlet } from 'react-router-dom';
import SmeSidebar from './SmeSidebar';

export default function SmeLayout() {
  return (
    <div className="admin-shell">
      <SmeSidebar />
      <main className="admin-content">
        <Outlet />
      </main>
    </div>
  );
}
