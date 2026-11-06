import { ListChecks, CheckCircle2, Hourglass, Clock3 } from 'lucide-react';
import "../style.css";
import "../styles/dashboard-glass.css";
import "../styles/smidashboard.css";

const STATS = [
  { label: 'Total Tasks', value: 0, icon: ListChecks },
  { label: 'In Progress', value: 0, icon: Hourglass },
  { label: 'Completed', value: 0, icon: CheckCircle2 },
  { label: 'Due Today', value: 0, icon: Clock3 }
];

const SmiDashboard = () => (
  <div className="dashboard-content scrollable dash-glass">
    <div className="dash-section-title">Overview</div>
    <section className="smi-stats">
      {STATS.map(({ label, value, icon: Icon }) => (
        <div className="smi-stat" key={label}>
          <span className="smi-stat-icon"><Icon size={18} /></span>
          <div>
            <small>{label}</small>
            <strong>{value}</strong>
          </div>
        </div>
      ))}
    </section>

    <div className="dash-section-title">Today's work</div>
    <div className="glass-panel">
      <h2>My tasks</h2>
      <p className="muted">No tasks assigned to you yet.</p>
    </div>
  </div>
);

export default SmiDashboard;
