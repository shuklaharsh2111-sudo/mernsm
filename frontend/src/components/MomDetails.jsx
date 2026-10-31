import { Check, X, Flag } from 'lucide-react';
import { fmtDay, fmtClock } from '../sopUtils';
import '../styles/mom.css';

// Read-only view of a submitted MOM (used by the admin approval page and the SME records page).
export default function MomDetails({ mom }) {
  const present = mom.attendance.filter((a) => a.present).length;

  return (
    <div className="mom-grid">
      <div className="mom-block">
        <h4>Points Discussed</h4>
        <ol>
          {mom.points.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ol>
      </div>

      <div className="mom-block">
        <h4>
          Attendance ({present}/{mom.attendance.length} present)
        </h4>
        <ul className="plain">
          {mom.attendance.map((a, i) => (
            <li key={i}>
              <span className={`att-mark ${a.present ? 'in' : 'out'}`} aria-label={a.present ? 'Present' : 'Absent'}>
                {a.present ? <Check size={13} /> : <X size={13} />}
              </span>
              <span className={a.present ? '' : 'att-out-text'}>{a.name}</span>
              <span className="muted">{a.designation}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mom-block">
        <h4>Next Steps</h4>
        <ul>
          {mom.nextSteps.map((s, i) => (
            <li key={i}>
              {s.text} <span className="muted">— {fmtDay(s.date)}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mom-block">
        <h4>Next Meeting</h4>
        <div className="mom-next">
          <div className="mom-next-top">
            <span>
              {fmtDay(mom.nextMeeting.date)} · {fmtClock(mom.nextMeeting.time)}
            </span>
            <span className={`prio-pill ${mom.nextMeeting.priority}`}>
              <Flag size={12} /> {mom.nextMeeting.priority}
            </span>
          </div>
          <span>Agenda: {mom.nextMeeting.agenda}</span>
        </div>
      </div>
    </div>
  );
}
