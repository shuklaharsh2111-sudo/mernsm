import { Palette, Clock3, CheckCircle2, FileBarChart, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import '../styles/desdashboard.css';

const DesHome = () => {
  const navigate = useNavigate();

  return (
    <div className="des-page">
      <div className="des-header">
        <div>
          <div className="des-eyebrow">
            <Palette size={15} />
            DESIGN WORKSPACE
          </div>
          <h1>Dashboard</h1>
          <p>Welcome to your Design Executive workspace.</p>
        </div>
      </div>

      <div className="des-stats">
        <div className="des-stat-card">
          <div className="des-stat-icon total"><Palette size={21} /></div>
          <div>
            <span>My Creatives</span>
            <h2>Manage</h2>
          </div>
        </div>

        <div className="des-stat-card">
          <div className="des-stat-icon pending"><Clock3 size={21} /></div>
          <div>
            <span>Creative Workflow</span>
            <h2>Track</h2>
          </div>
        </div>

        <div className="des-stat-card">
          <div className="des-stat-icon approved"><CheckCircle2 size={21} /></div>
          <div>
            <span>Monthly Reports</span>
            <h2>Review</h2>
          </div>
        </div>
      </div>

      <div className="des-empty">
        <div className="des-empty-icon">
          <Palette size={35} />
        </div>
        <h3>Welcome to Your Design Dashboard</h3>
        <p>Manage your assigned creatives and track your design workflow from one place.</p>
        <button className="des-refresh" onClick={() => navigate('/des/creatives')}>
          View My Creatives <ArrowRight size={17} />
        </button>
      </div>
    </div>
  );
};

export default DesHome;