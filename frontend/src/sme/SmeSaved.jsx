import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import api from '../api';
import { SOP_TYPES, errMsg, fmtDateTime, fmtDay, periodLabel, todayStr, typeLabel } from '../sopUtils';

// Every SOP the SME has ticked (saved automatically from the dashboard), newest first.
const SmeSaved = () => {
  const [assigned, setAssigned] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    api
      .get('/sme/sop-assignments', { params: { today: todayStr() } })
      .then((res) => !cancelled && setAssigned(res.data.assignments))
      .catch((err) => !cancelled && setError(errMsg(err)));
    return () => {
      cancelled = true;
    };
  }, []);

  const history = (assigned || [])
    .flatMap((a) => a.completions.map((c) => ({ ...c, sop: a })))
    .sort((x, y) => new Date(y.at) - new Date(x.at));

  const q = query.trim().toLowerCase();
  const shown = history.filter(
    (h) =>
      (tab === 'all' || h.sop.type === tab) &&
      (!q || `${h.sop.company.name} ${h.sop.text}`.toLowerCase().includes(q))
  );
  const countOf = (type) => history.filter((h) => type === 'all' || h.sop.type === type).length;

  return (
    <div className="dashboard-content scrollable">
      <div className="page-header">
        <div>
          <span className="page-label">SME WORKSPACE</span>
          <h1>Saved</h1>
          <p>Every SOP you have ticked is saved here automatically.</p>
        </div>
      </div>

      {error && <p className="error-message" role="alert">{error}</p>}

      <div className="sop-tabs">
        {[{ value: 'all', label: 'All' }, ...SOP_TYPES].map((t) => (
          <button key={t.value} type="button" className={tab === t.value ? 'active' : ''} onClick={() => setTab(t.value)}>
            {t.label} ({countOf(t.value)})
          </button>
        ))}
      </div>

      <div className="search-row">
        <div className="search-box">
          <Search size={16} />
          <input type="search" placeholder="Search company or SOP text…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <span className="muted">{shown.length} of {history.length} saved</span>
      </div>

      {!assigned ? (
        <p className="muted">Loading…</p>
      ) : shown.length === 0 ? (
        <div className="glass-panel">
          <p className="muted">
            {history.length ? 'Nothing matches.' : 'Nothing saved yet. Tick an SOP on your dashboard and it appears here.'}
          </p>
        </div>
      ) : (
        <div className="sop-list">
          {shown.map((h) => (
            <div key={`${h.sop.id}-${h.period}`} className="glass-panel sme-sop done">
              <div className="sop-item-top">
                <span className={`sop-pill ${h.sop.type}`}>{typeLabel(h.sop.type)}</span>
                <b>{h.sop.company.name}</b>
                <span className="sop-done-tag">✓ Done</span>
              </div>
              <p className="sop-item-text">{h.sop.text}</p>
              <dl className="saved-details">
                <div><dt>Done for</dt><dd>{periodLabel(h.sop.type, h.period)}</dd></div>
                <div><dt>SOP date</dt><dd>{fmtDay(h.sop.date)}</dd></div>
                <div><dt>Saved on</dt><dd>{fmtDateTime(h.at)}</dd></div>
              </dl>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SmeSaved;
