import { useEffect, useState } from 'react';
import api from '../api';
import { errMsg } from '../sopUtils';
import TaskManager from '../components/TaskManager';
import SmiSopPanel from '../components/SmiSopPanel';
import { CompanyBadge, EmptyBadge } from '../components/CompanyBadge';
import "../style.css";
import "../styles/dashboard-glass.css";

const SLOTS = 5; // five circles by default, like the SME dashboard

const SmiDashboard = () => {
  const [companies, setCompanies] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    api
      .get('/smi/companies')
      .then((res) => !cancelled && setCompanies(res.data.companies))
      .catch((err) => !cancelled && setError(errMsg(err)));
    return () => {
      cancelled = true;
    };
  }, []);

  const slots = Array.from({ length: Math.max(SLOTS, companies.length) }, (_, i) => companies[i] || null);

  return (
    <div className="dashboard-content scrollable dash-glass">
      <div className="dash-section-title">My companies</div>
      <div className="company-row" aria-label="Your companies">
        {slots.map((c, i) =>
          c ? <CompanyBadge key={c.id} company={c} size={72} showName /> : <EmptyBadge key={`empty-${i}`} size={72} showName />
        )}
      </div>
      {error && <p className="error-message" role="alert">{error}</p>}
      <SmiSopPanel />
      <TaskManager role="smi" />
    </div>
  );
};

export default SmiDashboard;
