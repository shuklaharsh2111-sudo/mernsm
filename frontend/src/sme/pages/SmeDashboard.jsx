import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSmeAuth } from '../context/SmeAuthContext';
<<<<<<< HEAD
=======
<<<<<<< HEAD
>>>>>>> c86954fd1b281ba1f0f38af41524f26256ebf5f0
import { getMyCompanies, getMySops } from '../api/smeApi';
import { STATUS_LABEL, fmt } from '../../shared/sop';
import CompanyBadge, { EmptyBadge } from '../../shared/CompanyBadge';

const SLOTS = 5;

const isoWeek = (d) => {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t - yearStart) / 86400000 + 1) / 7);
};

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="sme-clock" aria-live="off">
      <div className="sme-clock-time">
        {now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </div>
      <div className="sme-clock-date">
        {now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
      </div>
      <div className="sme-clock-week">Week {isoWeek(now)}</div>
    </div>
  );
}
<<<<<<< HEAD
=======
=======
import { getMySops } from '../api/smeApi';
import { STATUS_LABEL, fmt } from '../../shared/sop';
>>>>>>> adc7900227aadaf9e0a6f9f972499593c8ff0896
>>>>>>> c86954fd1b281ba1f0f38af41524f26256ebf5f0

export default function SmeDashboard() {
  const { sme, token } = useSmeAuth();
  const [data, setData] = useState(null);
<<<<<<< HEAD
  const [companies, setCompanies] = useState([]);
=======
<<<<<<< HEAD
  const [companies, setCompanies] = useState([]);
=======
>>>>>>> adc7900227aadaf9e0a6f9f972499593c8ff0896
>>>>>>> c86954fd1b281ba1f0f38af41524f26256ebf5f0
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
<<<<<<< HEAD
=======
<<<<<<< HEAD
>>>>>>> c86954fd1b281ba1f0f38af41524f26256ebf5f0
    Promise.all([getMySops(token), getMyCompanies(token)])
      .then(([sops, comps]) => {
        if (cancelled) return;
        setData(sops);
        setCompanies(comps.companies);
      })
<<<<<<< HEAD
=======
=======
    getMySops(token)
      .then((d) => !cancelled && setData(d))
>>>>>>> adc7900227aadaf9e0a6f9f972499593c8ff0896
>>>>>>> c86954fd1b281ba1f0f38af41524f26256ebf5f0
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [token]);

  const counts = data?.counts || { pending: 0, approved: 0, rejected: 0, revision: 0 };
  const total = counts.pending + counts.approved + counts.rejected + counts.revision;
  const attention = (data?.sops || []).filter((s) => s.status === 'revision' || s.status === 'rejected');
<<<<<<< HEAD
=======
<<<<<<< HEAD
>>>>>>> c86954fd1b281ba1f0f38af41524f26256ebf5f0
  const slots = Array.from({ length: SLOTS }, (_, i) => companies[i] || null);

  return (
    <>
      <div className="sme-header">
        <div>
          <h1 className="sme-welcome">
            Welcome, <span>{sme.name}</span>
          </h1>
          <p className="sme-sub">
            {sme.roleLabel} · <code>{sme.userId}</code>
            {sme.reportingManager && <> · Reports to {sme.reportingManager}</>}
          </p>
        </div>
        <Clock />
      </div>

      <div className="company-row" aria-label="Your companies">
        {slots.map((c, i) =>
          c ? (
            <CompanyBadge key={c.id} company={c} assigned={c.assigned} size={72} showName />
          ) : (
            <EmptyBadge key={`empty-${i}`} size={72} showName />
          )
        )}
<<<<<<< HEAD
=======
=======

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
>>>>>>> adc7900227aadaf9e0a6f9f972499593c8ff0896
>>>>>>> c86954fd1b281ba1f0f38af41524f26256ebf5f0
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
