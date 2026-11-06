import { useEffect, useState } from 'react';
import api from '../api';
import { PERIOD_WORD, SOP_TYPES, errMsg, fmtDay, todayStr, typeLabel } from '../sopUtils';
import '../styles/smisops.css';

// SMI: the SOPs an SME assigned to me. Tick one and it is saved (see the Saved page).
export default function SmiSopPanel() {
  const [assigned, setAssigned] = useState(null);
  const [error, setError] = useState('');
  const [typeTab, setTypeTab] = useState('all');
  const [savingIds, setSavingIds] = useState([]);

  useEffect(() => {
    let cancelled = false;
    api
      .get('/smi/sop-assignments', { params: { today: todayStr() } })
      .then((res) => !cancelled && setAssigned(res.data.assignments))
      .catch((err) => !cancelled && setError(errMsg(err)));
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleTick = async (a) => {
    if (savingIds.includes(a.id) || a.completedBySme) return;
    const want = !a.done;
    setError('');
    setSavingIds((ids) => [...ids, a.id]);
    setAssigned((list) => list.map((x) => (x.id === a.id ? { ...x, done: want } : x)));
    try {
      const res = await api.put('/smi/sop-assignments/completions', {
        today: todayStr(),
        changes: [{ id: a.id, done: want }],
      });
      setAssigned(res.data.assignments);
    } catch (err) {
      setAssigned((list) => list.map((x) => (x.id === a.id ? { ...x, done: !want } : x)));
      setError(errMsg(err));
    } finally {
      setSavingIds((ids) => ids.filter((id) => id !== a.id));
    }
  };

  const shown = (assigned || []).filter((a) => typeTab === 'all' || a.type === typeTab);
  const active = (assigned || []).filter((a) => a.active);
  const isDone = (a) => a.done || a.completedBySme;
  const doneCount = active.filter(isDone).length;
  const pct = active.length ? Math.round((doneCount / active.length) * 100) : 0;
  const countFor = (t) => (assigned || []).filter((a) => t === 'all' || a.type === t).length;

  const groups = Object.values(
    shown.reduce((acc, a) => {
      const k = a.company.id || a.company.name;
      (acc[k] = acc[k] || { name: a.company.name, items: [] }).items.push(a);
      return acc;
    }, {})
  );

  return (
    <div className="smi-sop-wrap">
      <div className="dash-section-title">My SOPs</div>
      <div className="glass-panel sop-panel">
        <div className="sop-head">
          <div>
            <h2>SOPs assigned to me</h2>
            <p className="sop-sub">{assigned ? `${doneCount} of ${active.length} completed` : 'Loading…'}</p>
          </div>
          <div className="sop-progress" aria-label={`${pct}% complete`}>
            <strong>{pct}%</strong>
            <div className="kpi-bar"><i style={{ width: `${pct}%` }} /></div>
          </div>
        </div>

        <div className="sop-tabs">
          {[{ value: 'all', label: 'All' }, ...SOP_TYPES].map((t) => (
            <button key={t.value} type="button" className={typeTab === t.value ? 'active' : ''} onClick={() => setTypeTab(t.value)}>
              {t.label}
              <span className="sop-tab-count">{countFor(t.value)}</span>
            </button>
          ))}
        </div>

        {error && <p className="error-message" role="alert">{error}</p>}

        {!assigned ? (
          <p className="muted">Loading…</p>
        ) : shown.length === 0 ? (
          <p className="muted">No SOPs assigned{typeTab === 'all' ? '' : ` (${typeLabel(typeTab)})`} yet.</p>
        ) : (
          <div className="sop-list">
            {groups.map((g) => {
              const gDone = g.items.filter(isDone).length;
              return (
                <div className="sop-group" key={g.name}>
                  <div className="sop-group-head">
                    <span className="sop-co">{g.name}</span>
                    <span className="sop-count">{gDone}/{g.items.length}</span>
                  </div>
                  {g.items.map((a) => (
                    <label key={a.id} className={`sme-sop tick ${isDone(a) ? 'done' : ''} ${a.active ? '' : 'upcoming'}`}>
                      <input
                        type="checkbox"
                        checked={isDone(a)}
                        disabled={!a.active || a.completedBySme || savingIds.includes(a.id)}
                        onChange={() => toggleTick(a)}
                      />
                      <div className="sme-sop-body">
                        <div className="sop-item-top">
                          <span className={`sop-pill ${a.type}`}>{typeLabel(a.type)}</span>
                          <span className="muted">
                            {a.completedBySme ? 'Already handled' : a.active ? `Done ${PERIOD_WORD[a.type]}?` : `Starts ${fmtDay(a.date)}`}
                          </span>
                          <span className={`sop-status ${isDone(a) ? 'done' : a.active ? 'todo' : 'later'}`}>
                            {a.completedBySme ? 'Completed by SME' : a.done ? 'Done' : a.active ? 'To do' : 'Upcoming'}
                          </span>
                        </div>
                        <p className="sop-item-text">{a.text}</p>
                        <span className="muted">Assigned by {a.assignedBy.name}</span>
                      </div>
                    </label>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
