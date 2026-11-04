import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, Building2, Palette, CalendarCheck, Receipt, UserCheck,
  ArrowRight, ClipboardCheck
} from 'lucide-react';
import api from '../api';
import { errMsg, fmtDay } from '../sopUtils';
import '../style.css';
import '../styles/dashboard-glass.css';

const QUICK = [
  { title: 'Users', text: 'Add and manage SMEs', path: '/admin/users', icon: Users },
  { title: 'Companies', text: 'Client companies', path: '/admin/companies', icon: Building2 },
  { title: 'Creatives', text: 'Review submissions', path: '/admin/creatives', icon: Palette },
  { title: 'Meetings', text: 'MOM approvals', path: '/admin/meetings', icon: CalendarCheck },
  { title: 'Invoices', text: 'Billing and PDFs', path: '/admin/invoices', icon: Receipt },
  { title: 'Attendance', text: 'SME login sessions', path: '/admin/attendance', icon: UserCheck }
];

const AdminDashboard = () => {
  const [data, setData] = useState({ users: null, companies: null, creatives: null, moms: null });
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([
      api.get('/admin/users'),
      api.get('/admin/companies'),
      api.get('/admin/creatives'),
      api.get('/admin/moms')
    ]).then(([u, c, cr, m]) => {
      if (cancelled) return;
      setData({
        users: u.status === 'fulfilled' ? u.value.data.users : [],
        companies: c.status === 'fulfilled' ? c.value.data.companies : [],
        creatives: cr.status === 'fulfilled' ? cr.value.data.creatives : [],
        moms: m.status === 'fulfilled' ? m.value.data.moms : []
      });
      const failed = [u, c, cr, m].find((r) => r.status === 'rejected');
      if (failed) setError(errMsg(failed.reason));
    });
    return () => { cancelled = true; };
  }, []);

  const loading = data.users === null;
  const val = (list) => (loading ? '–' : list.length);

  const pendingCreatives = (data.creatives || []).filter((c) => c.status === 'pending');
  const pendingMoms = (data.moms || []).filter((m) => m.mom?.status === 'pending');
  const approved = (data.creatives || []).filter((c) => c.status === 'approved').length;
  const total = (data.creatives || []).length;
  const approvalPct = total ? Math.round((approved / total) * 100) : 0;

  return (
    <div className="dashboard-content dash-glass">
      {error && <p className="error-message" role="alert">{error}</p>}

      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-top"><span className="kpi-label">SMEs</span><span className="kpi-icon"><Users size={17} /></span></div>
          <strong className="kpi-value">{val(data.users || [])}</strong>
          <span className="kpi-sub">Team members with access</span>
        </div>
        <div className="kpi-card">
          <div className="kpi-top"><span className="kpi-label">Companies</span><span className="kpi-icon"><Building2 size={17} /></span></div>
          <strong className="kpi-value">{val(data.companies || [])}</strong>
          <span className="kpi-sub">Client accounts</span>
        </div>
        <div className="kpi-card red">
          <div className="kpi-top"><span className="kpi-label">Creatives to review</span><span className="kpi-icon"><Palette size={17} /></span></div>
          <strong className="kpi-value">{val(pendingCreatives)}</strong>
          <span className="kpi-sub">Waiting for approval</span>
        </div>
        <div className="kpi-card amber">
          <div className="kpi-top"><span className="kpi-label">MOMs to review</span><span className="kpi-icon"><CalendarCheck size={17} /></span></div>
          <strong className="kpi-value">{val(pendingMoms)}</strong>
          <span className="kpi-sub">Submitted by SMEs</span>
        </div>
        <div className="kpi-card green">
          <div className="kpi-top"><span className="kpi-label">Approval rate</span><span className="kpi-icon"><ClipboardCheck size={17} /></span></div>
          <strong className="kpi-value">{loading ? '–' : `${approvalPct}%`}</strong>
          <div className="kpi-bar"><i style={{ width: `${approvalPct}%` }} /></div>
        </div>
      </div>

      <div className="dash-section-title">Waiting for you</div>
      <div className="sop-meeting-row">
        <div className="glass-panel">
          <h2>Creatives awaiting approval</h2>
          {loading ? <p className="muted">Loading…</p> : pendingCreatives.length === 0 ? (
            <p className="muted">Nothing pending. You are all caught up.</p>
          ) : (
            <div className="meeting-list">
              {pendingCreatives.slice(0, 5).map((c) => (
                <Link to="/admin/creatives" className="meeting-item clickable" key={c.id} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div className="meeting-item-top">
                    <div className="meeting-item-main">
                      <span className="meeting-company">{c.company.name}</span>
                      <h3 className="meeting-title">{c.contentPillar?.title || 'Untitled creative'}</h3>
                    </div>
                    <div className="meeting-item-when">
                      <span>{c.sme.name}</span>
                      <span>{c.date ? fmtDay(String(c.date).slice(0, 10)) : ''}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
          <Link to="/admin/creatives" className="dash-btn" style={{ marginTop: 14 }}>Open creatives <ArrowRight size={15} /></Link>
        </div>

        <div className="glass-panel">
          <h2>MOMs awaiting review</h2>
          {loading ? <p className="muted">Loading…</p> : pendingMoms.length === 0 ? (
            <p className="muted">No minutes of meeting are waiting.</p>
          ) : (
            <div className="meeting-list">
              {pendingMoms.slice(0, 5).map((m) => (
                <Link to="/admin/meetings" className="meeting-item clickable" key={m.id} style={{ textDecoration: 'none', color: 'inherit' }}>
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
          <Link to="/admin/meetings" className="dash-btn" style={{ marginTop: 14 }}>Open meetings <ArrowRight size={15} /></Link>
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

export default AdminDashboard;
