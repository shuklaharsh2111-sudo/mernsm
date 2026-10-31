import { useEffect, useMemo, useState } from 'react';
import { Search, Users } from 'lucide-react';
import api from '../api';
import MomDetails from '../components/MomDetails';
import { errMsg, fmtDay, fmtDateTime, fmtClock } from '../sopUtils';
import '../style.css';
import '../styles/mom.css';

// Approved MOMs, saved with all their details.
const SmeRecords = () => {
  const [records, setRecords] = useState(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    api
      .get('/sme/records')
      .then((res) => !cancelled && setRecords(res.data.records))
      .catch((err) => !cancelled && setError(errMsg(err)));
    return () => {
      cancelled = true;
    };
  }, []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (records || []).filter((r) => !q || r.subject.toLowerCase().includes(q) || r.company.name.toLowerCase().includes(q));
  }, [records, query]);

  return (
    <div className="dashboard-content scrollable">
      <div className="page-header">
        <div>
          <span className="page-label">SME WORKSPACE</span>
          <h1>Records</h1>
          <p>Minutes of meeting approved by the admin are saved here with all their details.</p>
        </div>
      </div>

      <label className="search-box" style={{ marginBottom: 18, maxWidth: 420 }}>
        <Search size={16} />
        <input value={query} placeholder="Search by subject or company" onChange={(e) => setQuery(e.target.value)} />
      </label>

      {error && <p className="error-message" role="alert">{error}</p>}

      {!records ? (
        !error && <p className="muted">Loading…</p>
      ) : shown.length === 0 ? (
        <div className="glass-panel">
          <p className="muted">{records.length === 0 ? 'No approved MOMs yet. They appear here once the admin approves them.' : 'No records match your search.'}</p>
        </div>
      ) : (
        <div className="mom-list">
          {shown.map((r) => (
            <div key={r.id} className="glass-panel mom-card">
              <div className="mom-card-head">
                <div>
                  <span className="mom-card-company">{r.company.name}</span>
                  <h3 className="mom-card-title">{r.subject}</h3>
                  <p className="mom-card-sub">
                    <Users size={12} style={{ verticalAlign: '-2px' }} /> {r.attendees.length} attendees · Meeting held {fmtDay(r.date)}, {fmtClock(r.time)}
                  </p>
                </div>
                <div className="mom-card-side">
                  <span className="status-pill approved">approved</span>
                  <span>Approved {fmtDateTime(r.mom.reviewedAt)}</span>
                </div>
              </div>

              <MomDetails mom={r.mom} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SmeRecords;
