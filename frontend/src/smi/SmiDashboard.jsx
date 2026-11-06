import TaskManager from '../components/TaskManager';
import SmiSopPanel from '../components/SmiSopPanel';
import "../style.css";
import "../styles/dashboard-glass.css";

const SmiDashboard = () => (
  <div className="dashboard-content scrollable dash-glass">
    <SmiSopPanel />
    <TaskManager role="smi" />
  </div>
);

export default SmiDashboard;
