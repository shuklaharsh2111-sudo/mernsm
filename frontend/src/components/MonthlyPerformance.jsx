import { useEffect, useState } from 'react';
import api from '../api';
import { errMsg, fmtDay, todayStr } from '../sopUtils';

/*
  Performance part of the monthly report (creatives, companies, platforms, SOPs, meetings).
  It sits inside the printable report in SmeMonthlyReports and loads from GET /sme/monthly-report.
*/

const HEALTH_LABEL = { healthy: 'Healthy', risk: 'At Risk', critical: 'Critical', nodata: 'No data' };
const STATUS_LABEL = { approved: 'Approved', pending: 'Pending', rejected: 'Redo' };
const MOM_LABEL = { not_sent: 'Not sent', pending: 'Pending', approved: 'Approved', sent_back: 'Sent back', rejected: 'Rejected' };
const PLATFORM_LABEL = { instagram: 'Instagram', facebook: 'Facebook', linkedin: 'LinkedIn', x: 'X', youtube: 'YouTube' };
const platformName = (p) => PLATFORM_LABEL[p] || p;

const num = (v) => Number(v || 0).toLocaleString('en-IN');
const signed = (v) => (v > 0 ? `+${v}` : `${v}`);

const Health = ({ value }) => (
    <span className={`mr-health mr-health-${value}`}>{HEALTH_LABEL[value] || value}</span>
);

const MonthlyPerformance = ({ month }) => {
    const [r, setR] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        let cancelled = false;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setR(null); setError('');
        api.get('/sme/monthly-report', { params: { month, today: todayStr() } })
            .then(({ data }) => { if (!cancelled) setR(data); })
            .catch(err => { if (!cancelled) setError(errMsg(err)); });
        return () => { cancelled = true; };
    }, [month]);

    if (error) return <p className="mr-note mr-noprint">Performance report: {error}</p>;
    if (!r) return <p className="mr-note mr-noprint">Loading performance report…</p>;
    if (!r.companyCount) return null;

    const s = r.stats;
    const p = r.previousStats;
    const compare = [
        ['Total creatives', s.total, p.total],
        ['Approved', s.approved, p.approved],
        ['Pending', s.pending, p.pending],
        ['Redo', s.redo, p.redo],
        ['Rejected', s.rejected, p.rejected],
        ['Delays', s.delays, p.delays],
        ['Overdue', s.overdue, p.overdue],
    ];
    const meetingPct = r.meetingStats.total ? Math.round((r.meetingStats.done / r.meetingStats.total) * 100) : 0;
    const tot = r.companyReports.reduce((a, c) => {
        ['total', 'approved', 'pending', 'redo', 'rejected', 'delays', 'overdue'].forEach(k => { a[k] += c[k]; });
        return a;
    }, { total: 0, approved: 0, pending: 0, redo: 0, rejected: 0, delays: 0, overdue: 0 });

    return (
        <>
            <section>
                <h2>Performance Report <Health value={r.overallHealth} /></h2>
                <table className="mr-table mr-left mr-meta">
                    <tbody>
                        <tr><th>Prepared for</th><td>{r.sme.name || '-'}</td><th>Position</th><td>{r.sme.position}</td></tr>
                        <tr><th>Department</th><td>{r.sme.department}</td><th>Email</th><td>{r.sme.email || '-'}</td></tr>
                        <tr><th>Reporting manager</th><td>{r.sme.manager || '-'}</td><th>Assigned companies</th><td>{r.companyCount}</td></tr>
                        <tr><th>Reporting period</th><td>{fmtDay(r.periodFrom)} – {fmtDay(r.periodTo)}</td><th>Compared with</th><td>{r.previousMonth}</td></tr>
                    </tbody>
                </table>
            </section>

            <section>
                <h2>Executive Summary</h2>
                <div className="mr-stats-grid">
                    <div className="mr-stat"><span>Total creatives</span><strong>{num(s.total)}</strong>
                        <small>{r.creativeChange === null ? 'No data last month' : `${signed(r.creativeChange)}% vs last month`}</small></div>
                    <div className="mr-stat"><span>Approved</span><strong>{num(s.approved)}</strong><small>{r.approvalRate}% approval rate</small></div>
                    <div className="mr-stat"><span>Pending review</span><strong>{num(s.pending)}</strong><small>Awaiting the admin</small></div>
                    <div className="mr-stat"><span>Redo</span><strong>{num(s.redo)}</strong><small>Sent back for changes</small></div>
                    <div className="mr-stat"><span>Rejected</span><strong>{num(s.rejected)}</strong><small>Times rejected</small></div>
                    <div className="mr-stat"><span>Delays</span><strong>{num(s.delays)}</strong><small>Sent after the creative date</small></div>
                    <div className="mr-stat"><span>Overdue</span><strong>{num(s.overdue)}</strong><small>Not approved, date passed</small></div>
                </div>
            </section>

            <section>
                <h2>Month-over-Month Comparison</h2>
                <table className="mr-table">
                    <thead><tr><th>Metric</th><th>{r.month}</th><th>{r.previousMonth}</th><th>Change</th></tr></thead>
                    <tbody>
                        {compare.map(([label, a, b]) => (
                            <tr key={label}><td>{label}</td><td>{num(a)}</td><td>{num(b)}</td><td>{signed(a - b)}</td></tr>
                        ))}
                        <tr>
                            <td>Approval rate</td><td>{r.approvalRate}%</td><td>{r.previousApprovalRate}%</td>
                            <td>{signed(Math.round((r.approvalRate - r.previousApprovalRate) * 10) / 10)} pts</td>
                        </tr>
                    </tbody>
                </table>
            </section>

            <section className="mr-flow">
                <h2>Company-wise Performance</h2>
                <table className="mr-table mr-wide">
                    <thead>
                        <tr><th>Company</th><th>Total</th><th>Approved</th><th>Pending</th><th>Redo</th><th>Rejected</th><th>Delays</th><th>Overdue</th><th>Approval</th><th>Health</th></tr>
                    </thead>
                    <tbody>
                        {r.companyReports.map(c => (
                            <tr key={c.id}>
                                <td>{c.name}</td><td>{c.total}</td><td>{c.approved}</td><td>{c.pending}</td><td>{c.redo}</td>
                                <td>{c.rejected}</td><td>{c.delays}</td><td>{c.overdue}</td><td>{c.approvalRate}%</td>
                                <td><Health value={c.health} /></td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td>Total</td><td>{tot.total}</td><td>{tot.approved}</td><td>{tot.pending}</td><td>{tot.redo}</td>
                            <td>{tot.rejected}</td><td>{tot.delays}</td><td>{tot.overdue}</td><td>{r.approvalRate}%</td><td><Health value={r.overallHealth} /></td>
                        </tr>
                    </tfoot>
                </table>
                <p className="mr-note">
                    <strong>Health rules.</strong> Healthy: no delays, redo, rejections or overdue · At Risk: 2+ delays, 4+ redo, 2+ rejections or 2+ overdue · Critical: 3+ delays, 5+ redo, 3+ rejections or 3+ overdue.
                </p>
            </section>

            {r.platformReports.length > 0 && (
                <section>
                    <h2>Platform Performance</h2>
                    <table className="mr-table">
                        <thead><tr><th>Platform</th><th>Total</th><th>Approved</th><th>Pending</th><th>Redo</th><th>Rejected</th><th>Delays</th><th>Overdue</th></tr></thead>
                        <tbody>
                            {r.platformReports.map(x => (
                                <tr key={x.platform}>
                                    <td>{platformName(x.platform)}</td><td>{x.total}</td><td>{x.approved}</td><td>{x.pending}</td>
                                    <td>{x.redo}</td><td>{x.rejected}</td><td>{x.delays}</td><td>{x.overdue}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <p className="mr-note">A creative planned for more than one platform is counted once for each platform.</p>
                </section>
            )}

            <section>
                <h2>SOP Schedule</h2>
                <table className="mr-table">
                    <thead><tr><th>Total SOPs</th><th>Daily</th><th>Weekly</th><th>Monthly</th><th>Ticks saved</th></tr></thead>
                    <tbody><tr><td>{r.sopStats.total}</td><td>{r.sopStats.daily}</td><td>{r.sopStats.weekly}</td><td>{r.sopStats.monthly}</td><td>{r.sopStats.ticks}</td></tr></tbody>
                </table>
                <p className="mr-note">SOPs are counted by their start date. Ticks saved are the completions marked during this month.</p>
            </section>

            <section className="mr-flow">
                <h2>Meetings</h2>
                <table className="mr-table">
                    <thead><tr><th>Total meetings</th><th>Completed</th><th>Pending</th><th>Completion rate</th></tr></thead>
                    <tbody><tr><td>{r.meetingStats.total}</td><td>{r.meetingStats.done}</td><td>{r.meetingStats.notDone}</td><td>{meetingPct}%</td></tr></tbody>
                </table>

                <h3 className="mr-sub">By company</h3>
                <table className="mr-table">
                    <thead><tr><th>Company</th><th>Total meetings</th><th>Completed</th><th>Pending</th></tr></thead>
                    <tbody>{r.meetingReports.map(m => <tr key={m.name}><td>{m.name}</td><td>{m.total}</td><td>{m.done}</td><td>{m.notDone}</td></tr>)}</tbody>
                </table>

                {r.meetingList.length > 0 && (
                    <>
                        <h3 className="mr-sub">Meeting details</h3>
                        <table className="mr-table mr-left">
                            <thead><tr><th>Date</th><th>Time</th><th>Company</th><th>Subject</th><th>Status</th><th>MOM</th></tr></thead>
                            <tbody>
                                {r.meetingList.map(m => (
                                    <tr key={m.id}>
                                        <td>{fmtDay(m.date)}</td><td>{m.time}</td><td>{m.company}</td><td>{m.subject}</td>
                                        <td>{m.done ? 'Completed' : 'Pending'}</td><td>{MOM_LABEL[m.momStatus] || m.momStatus}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </>
                )}
            </section>

            {r.creatives.length > 0 && (
                <section className="mr-flow">
                    <h2>Creative Details</h2>
                    <table className="mr-table mr-left">
                        <thead><tr><th>Date</th><th>Title</th><th>Company</th><th>Platform</th><th>Status</th><th>Timing</th><th>Remark</th></tr></thead>
                        <tbody>
                            {r.creatives.map(c => (
                                <tr key={c.id}>
                                    <td>{fmtDay(c.date)}</td><td>{c.title}</td><td>{c.company}</td>
                                    <td>{c.platforms.map(platformName).join(', ')}</td>
                                    <td>{STATUS_LABEL[c.status] || c.status}</td>
                                    <td>{c.delayed ? 'Delayed' : c.overdue ? 'Overdue' : 'On time'}</td>
                                    <td>{c.remark || '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </section>
            )}
        </>
    );
};

export default MonthlyPerformance;
