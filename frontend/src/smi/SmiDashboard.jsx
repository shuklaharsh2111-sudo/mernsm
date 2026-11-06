import TaskManager from '../components/TaskManager';
import "../style.css";
import "../styles/dashboard-glass.css";

const SmiDashboard = () => (
  <div className="dashboard-content scrollable dash-glass">
    <TaskManager role="smi" />
  </div>
);

export default SmiDashboard;
