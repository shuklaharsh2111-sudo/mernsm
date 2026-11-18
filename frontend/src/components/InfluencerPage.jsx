import InfluencerDashboard from './InfluencerDashboard';
import '../style.css';
import '../styles/dashboard-glass.css';

// Standalone sidebar page for the influencer dashboard (SME and SMI).
const InfluencerPage = ({ role = 'sme' }) => (
  <div className="dashboard-content scrollable dash-glass">
    <InfluencerDashboard role={role} />
  </div>
);

export default InfluencerPage;
