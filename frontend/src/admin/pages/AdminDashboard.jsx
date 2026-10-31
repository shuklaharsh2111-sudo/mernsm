import { useAdminAuth } from '../context/AdminAuthContext';

export default function AdminDashboard() {
  const { admin } = useAdminAuth();
  return (
    <>
      <h1 className="admin-title">Dashboard</h1>
      <div className="admin-panel">
        <h2>Welcome back, {admin.name}</h2>
        <p>You are signed in as <code>{admin.email}</code></p>
      </div>
    </>
  );
}
