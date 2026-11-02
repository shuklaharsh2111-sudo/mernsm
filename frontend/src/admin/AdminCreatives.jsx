import { useEffect, useMemo, useState } from 'react';
import { ThumbsUp, ThumbsDown, Eye, EyeOff } from 'lucide-react';
import CreativeDetails from '../components/CreativeDetails';
import api from '../api';
import PlatformPreviewSwitcher from '../components/PlatformPreviewSwitcher';
import { PLATFORMS } from '../components/creativePlatforms';
import { errMsg, fmtDay, fmtDateTime } from '../sopUtils';
import '../style.css';
import '../styles/mom.css';
import '../styles/calendar.css';

const TABS = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'all', label: 'All' },
];

const AdminCreatives = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [tab, setTab] = useState('pending');
  const [busyId, setBusyId] = useState('');
  const [rejecting, setRejecting] = useState('');
  const [note, setNote] = useState('');
  const [open, setOpen] = useState({}); // id -> preview shown (toggle)

  useEffect(() => {
    let cancelled = false;
    api.get('/admin/creatives')
      .then((r) => !cancelled && setItems(r.data.creatives))
      .catch((err) => !cancelled && setError(errMsg(err)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const counts = useMemo(() => {
    const c = { all: items.length, pending: 0, approved: 0, rejected: 0 };
    items.forEach((i) => (c[i.status] += 1));
    return c;
  }, [items]);
  const shown = items.filter((i) => tab === 'all' || i.status === tab);

  const review = async (c, action) => {
    setBusyId(c.id);
    setError('');
    setSuccess('');
    try {
      const res = await api.put(`/admin/creatives/${c.id}/${action}`, action === 'reject' ? { note } : {});
      setItems((list) => list.map((x) => (x.id === c.id ? res.data.creative : x)));
      setRejecting('');
      setNote('');
      setSuccess(action === 'approve' ? `Approved. It is now on ${c.sme.name}’s calendar for ${fmtDay(c.date)}.` : `Rejected. ${c.sme.name} can see your reason.`);
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
          <h1>Creatives</h1>
          <p>Review the reference creatives your SMEs submit. Approved ones are saved on the SME’s calendar.</p>
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
        <div className="glass-panel"><p className="muted">No {tab === 'all' ? '' : `${tab} `}creatives yet.</p></div>
      ) : (
        <div className="mom-list">
          {shown.map((c) => {
            const { title, caption, hashtags, platforms: keys } = c.contentPillar;
            const showPrev = Boolean(open[c.id]);
            return (
              <div key={c.id} className="glass-panel mom-card">
                <div className="mom-card-head">
                  <div>
                    <span className="mom-card-company">{c.company.name}</span>
                    <h3 className="mom-card-title">{title}</h3>
                    <p className="mom-card-sub">For {fmtDay(c.date)} · By <b>{c.sme.name}</b></p>
                  </div>
                  <div className="mom-card-side">
                    <span className={`status-pill ${c.status}`}>{c.status}</span>
                    <span>Submitted {fmtDateTime(c.submittedAt)}</span>
                  </div>
                </div>

                <CreativeDetails creative={c} />
                <div className="creative-row-platforms">
                  {keys.map((pk) => {
                    const P = PLATFORMS.find((p) => p.key === pk);
                    return P ? <span key={pk} className="creative-chip"><P.icon size={13} /> {P.label}</span> : null;
                  })}
                </div>

                {c.uploads.length > 0 && (
                  <div className="creative-thumbs">
                    {c.uploads.map((u, i) => (
                      <a key={u.url + i} className="creative-thumb" href={u.url} target="_blank" rel="noreferrer noopener" title={u.name}><img src={u.url} alt={u.name || 'Reference'} /></a>
                    ))}
                  </div>
                )}

                <button type="button" className="btn-ghost creative-prev-btn" aria-pressed={showPrev} onClick={() => setOpen((o) => ({ ...o, [c.id]: !o[c.id] }))}>
                  {showPrev ? <EyeOff size={14} /> : <Eye size={14} />} {showPrev ? 'Hide preview' : 'Show preview'}
                </button>
                {showPrev && (
                  <PlatformPreviewSwitcher
                    platforms={PLATFORMS.filter((p) => keys.includes(p.key))}
                    image={c.uploads[0]?.url || ''}
                    title={title}
                    caption={caption}
                    hashtags={hashtags}
                  />
                )}

                {c.status === 'rejected' && c.reviewNote && <p className="mom-note rejected">Rejected: {c.reviewNote}</p>}
                {c.status === 'approved' && <p className="mom-note approved">Approved {fmtDateTime(c.reviewedAt)}. Saved on the calendar.</p>}

                {c.status === 'pending' && (
                  <div className="mom-actions">
                    {rejecting === c.id ? (
                      <div className="mom-reject-box">
                        <label className="x-field">
                          <span>Reason for rejecting *</span>
                          <textarea value={note} maxLength={500} placeholder="The SME will see this" onChange={(e) => setNote(e.target.value)} />
                        </label>
                        <div className="btn-row">
                          <button type="button" className="btn-ghost danger" disabled={busyId === c.id || note.trim().length < 3} onClick={() => review(c, 'reject')}>
                            <ThumbsDown size={15} /> {busyId === c.id ? 'Rejecting…' : 'Confirm Reject'}
                          </button>
                          <button type="button" className="btn-ghost" onClick={() => { setRejecting(''); setNote(''); }}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <button type="button" className="btn-primary btn-approve" disabled={busyId === c.id} onClick={() => review(c, 'approve')}>
                          <ThumbsUp size={15} /> {busyId === c.id ? 'Approving…' : 'Approve'}
                        </button>
                        <button type="button" className="btn-ghost danger" onClick={() => { setRejecting(c.id); setNote(''); }}>
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

export default AdminCreatives;
