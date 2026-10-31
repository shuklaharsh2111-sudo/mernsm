import { useEffect, useMemo, useState } from 'react';
import { ThumbsUp, ThumbsDown, Undo2, CalendarCheck } from 'lucide-react';
import api from '../api';
import MomDetails from '../components/MomDetails';
import { errMsg, fmtDay, fmtDateTime, fmtClock } from '../sopUtils';
import '../styles/mom.css';

const TABS = [
  { value: 'pending', label: 'Pending' },
  { value: 'sent_back', label: 'Sent Back' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'all', label: 'All' },
];

const STATUS_LABEL = { pending: 'pending', sent_back: 'sent back', approved: 'approved', rejected: 'rejected' };

// What each "need a reason" action looks like in the reason box.
const REASON = {
  'send-back': { title: 'What needs to change? *', hint: 'The SME will see this, edit the MOM and submit it again', confirm: 'Send Back', busy: 'Sending back…', icon: Undo2, tone: 'warn' },
  reject: { title: 'Reason for rejecting *', hint: 'Rejecting is final. The SME cannot resubmit', confirm: 'Confirm Reject', busy: 'Rejecting…', icon: ThumbsDown, tone: 'danger' },
};

const AdminMeetings = () => {
  const [moms, setMoms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [tab, setTab] = useState('pending');
  const [busyId, setBusyId] = useState('');
  const [reviewing, setReviewing] = useState(null); // { id, action: 'send-back' | 'reject' }
  const [note, setNote] = useState('');

  useEffect(() => {
    let cancelled = false;
    api
      .get('/admin/moms')
      .then((res) => !cancelled && setMoms(res.data.moms))
      .catch((err) => !cancelled && setError(errMsg(err)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const counts = useMemo(() => {
    const c = { all: moms.length, pending: 0, sent_back: 0, approved: 0, rejected: 0 };
    moms.forEach((m) => (c[m.mom.status] += 1));
    return c;
  }, [moms]);
  const shown = moms.filter((m) => tab === 'all' || m.mom.status === tab);

  const closeReason = () => {
    setReviewing(null);
    setNote('');
  };

  const review = async (m, action) => {
    setBusyId(m.id);
    setError('');
    setSuccess('');
    try {
      const res = await api.put(`/admin/moms/${m.id}/${action}`, action === 'approve' ? {} : { note });
      setMoms((list) => list.map((x) => (x.id === m.id ? res.data.mom : x)));
      closeReason();
      if (action === 'approve') {
        setSuccess(
          res.data.nextScheduled
            ? `Approved. The next meeting (${fmtDay(res.data.mom.mom.nextMeeting.date)}) is now scheduled for ${m.sme.name}, and the MOM is saved in their records.`
            : 'Approved. The MOM is saved in the SME’s records.'
        );
      } else if (action === 'send-back') {
        setSuccess(`Sent back to ${m.sme.name} for changes.`);
      }
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusyId('');
    }
  };

  return (
    <div className="dashboard-content scrollable">
      <div className="page-header">
        <div>
          <span className="page-label">ADMINISTRATION</span>
          <h1>Meetings</h1>
          <p>Review the minutes of meeting submitted by your SMEs: approve them, or send them back for changes.</p>
        </div>
      </div>

      <div className="sop-tabs">
        {TABS.map((t) => (
          <button key={t.value} type="button" className={tab === t.value ? 'active' : ''} onClick={() => setTab(t.value)}>
            {t.label} ({counts[t.value]})
          </button>
        ))}
      </div>

      {error && <p className="error-message" role="alert">{error}</p>}
      {success && <p className="success-message" role="status">{success}</p>}

      {loading ? (
        <p className="muted">Loading…</p>
      ) : shown.length === 0 ? (
        <div className="glass-panel"><p className="muted">No {tab === 'all' ? '' : `${STATUS_LABEL[tab]} `}MOMs yet.</p></div>
      ) : (
        <div className="mom-list">
          {shown.map((m) => {
            const { mom } = m;
            const r = reviewing?.id === m.id ? REASON[reviewing.action] : null;
            return (
              <div key={m.id} className="glass-panel mom-card">
                <div className="mom-card-head">
                  <div>
                    <span className="mom-card-company">{m.company.name}</span>
                    <h3 className="mom-card-title">{m.subject}</h3>
                    <p className="mom-card-sub">
                      Meeting: {fmtDay(m.date)}, {fmtClock(m.time)} · By <b>{m.sme.name}</b>
                    </p>
                  </div>
                  <div className="mom-card-side">
                    <span className={`status-pill ${mom.status}`}>{STATUS_LABEL[mom.status]}</span>
                    <span>Submitted {fmtDateTime(mom.submittedAt)}</span>
                  </div>
                </div>

                <MomDetails mom={mom} />

                {(mom.status === 'sent_back' || mom.status === 'rejected') && mom.reviewNote && (
                  <p className={`mom-note ${mom.status}`}>
                    {mom.status === 'sent_back' ? 'Sent back — waiting for the SME to resubmit: ' : 'Rejected: '}
                    {mom.reviewNote}
                  </p>
                )}
                {mom.status === 'approved' && (
                  <p className="mom-note approved">
                    <CalendarCheck size={14} /> Approved {fmtDateTime(mom.reviewedAt)}. Saved in the SME’s records, and the next meeting is on their dashboard.
                  </p>
                )}

                {mom.status === 'pending' && (
                  <div className="mom-actions">
                    {r ? (
                      <div className="mom-reject-box">
                        <label className="x-field">
                          <span>{r.title}</span>
                          <textarea value={note} maxLength={500} placeholder={r.hint} onChange={(e) => setNote(e.target.value)} />
                        </label>
                        <div className="btn-row">
                          <button
                            type="button"
                            className={`btn-ghost ${r.tone === 'danger' ? 'danger' : 'warn'}`}
                            disabled={busyId === m.id || note.trim().length < 3}
                            onClick={() => review(m, reviewing.action)}
                          >
                            <r.icon size={15} /> {busyId === m.id ? r.busy : r.confirm}
                          </button>
                          <button type="button" className="btn-ghost" onClick={closeReason}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <button type="button" className="btn-primary btn-approve" disabled={busyId === m.id} onClick={() => review(m, 'approve')}>
                          <ThumbsUp size={15} /> {busyId === m.id ? 'Approving…' : 'Approve'}
                        </button>
                        <button type="button" className="btn-ghost warn" onClick={() => { setReviewing({ id: m.id, action: 'send-back' }); setNote(''); }}>
                          <Undo2 size={15} /> Send Back
                        </button>
                        <button type="button" className="btn-ghost danger" onClick={() => { setReviewing({ id: m.id, action: 'reject' }); setNote(''); }}>
                          <ThumbsDown size={15} /> Reject
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminMeetings;
