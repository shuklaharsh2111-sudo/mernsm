import { useEffect, useState } from 'react';
import { Palette, Clock3, CheckCircle2, ArrowRight, Building2, LoaderCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import '../styles/desdashboard.css';
const DesHome = () => {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const { data } = await api.get('/des/companies');
        setCompanies(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load assigned companies.');
      } finally {
        setLoading(false);
      }
    };
    fetchCompanies();
  }, []);
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
      <section className="des-companies-section">
        <div className="des-companies-heading">
          <div>
            <h2>My Assigned Companies</h2>
            <p>Companies whose creatives have been assigned to you.</p>
          </div>
          <span className="des-company-total">
            {companies.length} {companies.length === 1 ? 'Company' : 'Companies'}
          </span>
        </div>
        {loading ? (
          <div className="des-companies-loading">
            <LoaderCircle size={24} className="des-loader" />
            <span>Loading assigned companies...</span>
          </div>
        ) : error ? (
          <div className="des-companies-error">{error}</div>
        ) : companies.length === 0 ? (
          <div className="des-companies-empty">
            <Building2 size={30} />
            <h3>No Companies Assigned</h3>
            <p>Companies will appear here when creatives are assigned to you.</p>
          </div>
        ) : (
          <div className="des-companies-grid">
            {companies.map((company) => (
              <div className="des-company-card" key={company._id}>
                <div className="des-company-logo">
                  {company.logo ? (
                    <img src={company.logo} alt={company.name} />
                  ) : (
                    <Building2 size={32} />
                  )}
                </div>
                <h3>{company.name}</h3>
              </div>
            ))}
          </div>
        )}
      </section>
      <div className="des-stats">
        <div className="des-stat-card">
          <div className="des-stat-icon total">
            <Palette size={21} />
          </div>
          <div>
            <span>My Creatives</span>
            <h2>Manage</h2>
          </div>
        </div>
        <div className="des-stat-card">
          <div className="des-stat-icon pending">
            <Clock3 size={21} />
          </div>
          <div>
            <span>Creative Workflow</span>
            <h2>Track</h2>
          </div>
        </div>
        <div className="des-stat-card">
          <div className="des-stat-icon approved">
            <CheckCircle2 size={21} />
          </div>
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
        <button
          className="des-refresh"
          onClick={() => navigate('/des/creatives')}
        >
          View My Creatives <ArrowRight size={17} />
        </button>
      </div>
    </div>
  );
};
export default DesHome;
