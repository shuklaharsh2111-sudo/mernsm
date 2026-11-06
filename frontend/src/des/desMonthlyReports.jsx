import { FileBarChart } from 'lucide-react';

const DesMonthlyReports = () => {
  return (
    <div className="des-page">
      <div className="des-header">
        <div>
          <div className="des-eyebrow">
            <FileBarChart size={15} />
            DESIGN WORKSPACE
          </div>
          <h1>Monthly Reports</h1>
          <p>Your monthly design performance reports will appear here.</p>
        </div>
      </div>
      <div className="des-empty">
        <div className="des-empty-icon">
          <FileBarChart size={35} />
        </div>
        <h3>Monthly Reports</h3>
        <p>No monthly reports available yet.</p>
      </div>
    </div>
  );
};

export default DesMonthlyReports;