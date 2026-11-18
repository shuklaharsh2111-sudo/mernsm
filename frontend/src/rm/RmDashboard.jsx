import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, Building2, Palette, CalendarCheck, UserCheck, ArrowRight, ClipboardCheck, ListChecks
} from 'lucide-react';
import api from '../api';
import { errMsg, fmtDay } from '../sopUtils';
import { roleName } from '../roleNames';
import '../style.css';
import '../styles/dashboard-glass.css';
import '../styles/rmteam.css';

const initialsOf = (name = '') => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('') || 'U';

const QUICK = [
  { title: 'Team', text: 'People who report to you', path: '/rm/team', icon: Users },
  { title: 'Creatives', text: 'Approve submissions', path: '/rm/creatives', icon: Palette },
  { title: 'Meetings', text: 'MOM approvals', path: '/rm/meetings', icon: CalendarCheck },
  { title: 'Attendance', text: 'Team login sessions', path: '/rm/attendance', icon: UserCheck }
];

const RmDashboard = () => {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    api.get('/rm/overview')
      .then((r) => !cancelled && setData(r.data))
      .catch((err) => !cancelled && setError(errMsg(err)));
    return () => { cancelled = true; };
  }, []);

  const loading = data === null && !error;
  const c = data?.counts || {};
  const val = (n) => (loading ? '–' : (n ?? 0));
  const approvalPct = c.creativesTotal ? Math.round((c.creativesApproved / c.creativesTotal) * 100) : 0;
  const tasksTotal = (c.tasksNew || 0) + (c.tasksInProgress || 0) + (c.tasksCompleted || 0);

  return (
    <div className="dashboard-content dash-glass">
      {error && <p className="error-message" role="alert">{error}</p>}

      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-top"><span className="kpi-label">My team</span><span className="kpi-icon"><Users size={17} /></span></div>
          <strong className="kpi-value">{val(c.team)}</strong>
          <span className="kpi-sub">{loading ? 'People reporting to you' : `${c.smes} SME${c.smes === 1 ? '' : 's'} among them`}</span>
        </div>
        <div className="kpi-card">
          <div className="kpi-top"><span className="kpi-label">Companies</span><span className="kpi-icon"><Building2 size={17} /></span></div>
          <strong className="kpi-value">{val(c.companies)}</strong>
          <span className="kpi-sub">Handled by your team</span>
        </div>
        <div className="kpi-card red">
          <div className="kpi-top"><span className="kpi-label">Creatives to review</span><span className="kpi-icon"><Palette size={17} /></span></div>
          <strong className="kpi-value">{val(c.creativesPending)}</strong>
          <span className="kpi-sub">Waiting for approval</span>
        </div>
        <div className="kpi-card amber">
          <div className="kpi-top"><span className="kpi-label">MOMs to review</span><span className="kpi-icon"><CalendarCheck size={17} /></span></div>
          <strong className="kpi-value">{val(c.momsPending)}</strong>
          <span className="kpi-sub">Submitted by your SMEs</span>
        </div>
        <div className="kpi-card green">
          <div className="kpi-top"><span className="kpi-label">Approval rate</span><span className="kpi-icon"><ClipboardCheck size={17} /></span></div>
          <strong className="kpi-value">{loading ? '–' : `${approvalPct}%`}</strong>
          <div className="kpi-bar"><i style={{ width: `${approvalPct}%` }} /></div>
        </div>
        <div className="kpi-card">
          <div className="kpi-top"><span className="kpi-label">Tasks</span><span className="kpi-icon"><ListChecks size={17} /></span></div>
          <strong className="kpi-value">{loading ? '–' : `${c.tasksCompleted || 0}/${tasksTotal}`}</strong>
          <span className="kpi-sub">{loading ? 'Completed' : `${c.tasksInProgress || 0} in progress · ${c.tasksNew || 0} new`}</span>
        </div>
      </div>

      <div className="dash-section-title">My team</div>
      <div className="glass-panel rm-team-panel">
        {loading ? <p className="muted">Loading…</p> : data.team.length === 0 ? (
          <p className="muted">Nobody reports to you yet. The admin can set you as the Reporting Manager when adding a user.</p>
        ) : (
          <>
            <div className="rm-team-summary">
              {Object.entries(data.team.reduce((acc, m) => ({ ...acc, [m.role]: (acc[m.role] || 0) + 1 }), {})).map(([role, n]) => (
                <span key={role} className="rm-team-count">{n} {roleName(role)}{n === 1 ? '' : 's'}</span>
              ))}
            </div>
            <div className="rm-team-list">
              {data.team.map((m) => (
                <Link to="/rm/team" className="rm-team-member" key={`${m.role}-${m.id}`} title={m.email}>
                  <span className="rm-team-avatar">
                    {m.profileImage ? <img src={m.profileImage} alt="" /> : initialsOf(m.name)}
                  </span>
                  <span className="rm-team-text">
                    <strong>{m.name}</strong>
                    <small className={`rm-team-role ${m.role.toLowerCase()}`}>{roleName(m.role)}</small>
                  </span>
                </Link>
              ))}
            </div>
            <Link to="/rm/team" className="dash-btn" style={{ marginTop: 14 }}>Open team <ArrowRight size={15} /></Link>
          </>
        )}
      </div>

      <div className="dash-section-title">Waiting for you</div>
      <div className="sop-meeting-row">
        <div className="glass-panel">
          <h2>Creatives awaiting approval</h2>
          {loading ? <p className="muted">Loading…</p> : data.pendingCreatives.length === 0 ? (
            <p className="muted">Nothing pending. You are all caught up.</p>
          ) : (
            <div className="meeting-list">
              {data.pendingCreatives.map((cr) => (
                <Link to="/rm/creatives" className="meeting-item clickable" key={cr.id} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div className="meeting-item-top">
                    <div className="meeting-item-main">
                      <span className="meeting-company">{cr.company.name}</span>
                      <h3 className="meeting-title">{cr.contentPillar?.title || 'Untitled creative'}</h3>
                    </div>
                    <div className="meeting-item-when">
                      <span>{cr.sme.name}</span>
                      <span>{cr.date ? fmtDay(String(cr.date).slice(0, 10)) : ''}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
          <Link to="/rm/creatives" className="dash-btn" style={{ marginTop: 14 }}>Open creatives <ArrowRight size={15} /></Link>
        </div>

        <div className="glass-panel">
          <h2>MOMs awaiting review</h2>
          {loading ? <p className="muted">Loading…</p> : data.pendingMoms.length === 0 ? (
            <p className="muted">No minutes of meeting are waiting.</p>
          ) : (
            <div className="meeting-list">
              {data.pendingMoms.map((m) => (
                <Link to="/rm/meetings" className="meeting-item clickable" key={m.id} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div className="meeting-item-top">
                    <div className="meeting-item-main">
                      <span className="meeting-company">{m.company.name}</span>
                      <h3 className="meeting-title">{m.subject}</h3>
                    </div>
                    <div className="meeting-item-when">
                      <span>{m.sme.name}</span>
                      <span>{m.date ? fmtDay(m.date) : ''}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
          <Link to="/rm/meetings" className="dash-btn" style={{ marginTop: 14 }}>Open meetings <ArrowRight size={15} /></Link>
        </div>
      </div>

      <div className="dash-section-title">Quick access</div>
      <div className="quick-grid">
        {QUICK.map(({ title, text, path, icon: Icon }) => (
          <Link to={path} className="quick-card" key={path}>
            <span className="kpi-icon"><Icon size={19} /></span>
            <div><strong>{title}</strong><span>{text}</span></div>
            <ArrowRight size={16} />
          </Link>
        ))}
      </div>
    </div>
  );
};

export default RmDashboard;
