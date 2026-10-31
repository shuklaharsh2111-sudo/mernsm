import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSmeAuth } from '../context/SmeAuthContext';
import { getMySops } from '../api/smeApi';
import { STATUS_LABEL, fmt } from '../../shared/sop';

export default function SmeDashboard() {
  const { sme, token } = useSmeAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    getMySops(token)
      .then((d) => !cancelled && setData(d))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [token]);

  const counts = data?.counts || { pending: 0, approved: 0, rejected: 0, revision: 0 };
  const total = counts.pending + counts.approved + counts.rejected + counts.revision;
  const attention = (data?.sops || []).filter((s) => s.status === 'revision' || s.status === 'rejected');

  return (
    <>
      <h1 className="admin-title">SME Dashboard</h1>

      <div className="admin-panel">
        <h2>Welcome, {sme.name}</h2>
        <p>{sme.roleLabel} · User ID <code>{sme.userId}</code></p>
        <dl className="sme-profile">
          <div><dt>Reporting manager</dt><dd>{sme.reportingManager || '—'}</dd></div>
          <div><dt>Contact</dt><dd>{sme.contact}</dd></div>
          <div>
            <dt>Assigned companies</dt>
            <dd>
              {sme.assignedCompanies?.length
                ? sme.assignedCompanies.map((c) => <span key={c} className="chip">{c}</span>)
                : '—'}
            </dd>
          </div>
        </dl>
      </div>

      {error && <p className="admin-error" role="alert">{error}</p>}

      <div className="sop-stats sme-stats">
        <div className="sop-stat"><strong>{total}</strong><span>My SOPs</span></div>
        <div className="sop-stat"><strong>{counts.pending}</strong><span>Pending</span></div>
        <div className="sop-stat"><strong>{counts.approved}</strong><span>Approved</span></div>
        <div className="sop-stat"><strong>{counts.rejected}</strong><span>Rejected</span></div>
        <div className="sop-stat"><strong>{counts.revision}</strong><span>Needs redo</span></div>
      </div>

      <div className="admin-panel">
        <h2>Needs your attention</h2>
        {!data ? (
          <p>Loading…</p>
        ) : attention.length === 0 ? (
          <p>Nothing to fix right now. <Link to="/sme/sops">Write a new SOP</Link></p>
        ) : (
          <div className="sop-list">
            {attention.map((sop) => (
              <div key={sop._id} className={`sop-reason ${sop.status}`}>
                <strong>
                  {sop.title} — {sop.status === 'revision' ? 'Why redo' : 'Why rejected'}
                </strong>
                <p>{sop.reviewReason}</p>
                <small>
                  {STATUS_LABEL[sop.status]} · {sop.reviewedByName}, {fmt(sop.reviewedAt)}
                </small>
              </div>
            ))}
            <Link to="/sme/sops">Open My SOPs to fix and resubmit →</Link>
          </div>
        )}
      </div>
    </>
  );
}
