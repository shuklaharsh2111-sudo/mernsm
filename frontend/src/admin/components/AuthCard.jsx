export default function AuthCard({ title, subtitle, children, footer }) {
  return (
    <main className="admin-page">
      <div className="admin-card">
        <h1>{title}</h1>
        <p className="admin-subtitle">{subtitle}</p>
        {children}
        <p className="admin-footer">{footer}</p>
      </div>
    </main>
  );
}
