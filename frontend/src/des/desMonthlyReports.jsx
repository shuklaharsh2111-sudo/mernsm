import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle, ArrowDownRight, ArrowUpRight, Building2, CheckCircle2, ChevronLeft, ChevronRight,
  Clock3, Download, Eye, FileText, Layers, Palette, RotateCcw, TrendingUp, X
} from 'lucide-react';
import api from '../api';
import { errMsg, fmtDay, todayStr } from '../sopUtils';
import AnSelect from '../components/AnSelect';
import ReportSignature from '../components/ReportSignature';
import { DesStatusChart, DesWeeklyChart, DesCompareChart, DesCompanyChart } from '../components/DesMonthlyCharts';
import { WORKFLOW } from './desWorkflow';
import '../styles/analytics.css';
import '../styles/monthlyreport.css';
import logo from '../assets/images/company-logo.png';

const ALL = 'all'; // company dropdown value for "every company"

const STEPS = [
    { key: 'overview', label: 'Overview', icon: Layers, title: 'Month at a glance', hint: 'What was assigned to you, delivered and reviewed this month.' },
    { key: 'weekly', label: 'Weekly', icon: TrendingUp, title: 'Weekly activity', hint: 'Designs delivered, approved and sent back, week by week.' },
    { key: 'companies', label: 'Companies', icon: Building2, title: 'Company performance', hint: 'Creative activity grouped by company.' },
    { key: 'creatives', label: 'Creatives', icon: FileText, title: 'Creative details', hint: 'Every creative assigned or worked on during the month.' },
];

const STATUS_LABEL = {
    pending: WORKFLOW.todo.label,
    submitted: WORKFLOW.review.label,
    approved: WORKFLOW.approved.label,
    redo: WORKFLOW.redo.label
};

const fmt = (v) => Number(v || 0).toLocaleString('en-IN');
const signed = (v) => (v > 0 ? `+${v}` : `${v}`);
const pctText = (v) => `${v}%`;

const monthOptions = () => {
    const now = new Date();
    return Array.from({ length: 12 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        return { value, label: d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) };
    });
};
const monthName = (key) => {
    const [y, m] = key.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};
const shortMonth = (key) => {
    const [y, m] = key.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long' });
};
const ordinal = (d) => {
    const x = d % 100;
    if (x >= 11 && x <= 13) return `${d}th`;
    return `${d}${({ 1: 'st', 2: 'nd', 3: 'rd' })[d % 10] || 'th'}`;
};
const periodText = (month) => {
    const [y, m] = month.split('-').map(Number);
    const last = new Date(y, m, 0).getDate();
    return `${ordinal(1)} ${shortMonth(month)} to ${ordinal(last)} ${shortMonth(month)}`;
};
const dayText = (iso) => {
    if (!iso) return '-';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};
// change versus last month, in percent (null when last month had nothing to compare with)
const change = (cur, prv) => (!prv ? null : ((cur - prv) / prv) * 100);

const buildSummary = (name, s, month, companyName) => {
    if (!s.assigned && !s.submitted && !s.approved && !s.redo) return '';
    const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
    const bits = [
        `During the period of ${periodText(month)}, ${name.toUpperCase()} was assigned ${plural(s.assigned, 'creative')}${companyName ? ` for ${companyName}` : ''} and delivered ${plural(s.submitted, 'design')}.`
    ];
    if (s.approved || s.redo) {
        bits.push(`The SME approved ${s.approved} and asked for a redo on ${s.redo}${s.approvalRate ? `, an approval rate of ${s.approvalRate}%` : ''}.`);
    }
    if (s.pending) bits.push(`${plural(s.pending, 'assigned creative')} ${s.pending === 1 ? 'is' : 'are'} still waiting for a first design.`);
    return bits.join(' ');
};

const DesMonthlyReports = () => {
    const months = useMemo(() => monthOptions(), []);
    const [month, setMonth] = useState(months[0].value);
    const [companies, setCompanies] = useState([]);
    const [companyId, setCompanyId] = useState(ALL);
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [downloading, setDownloading] = useState(false);
    const [preview, setPreview] = useState(false);
    const [step, setStep] = useState(0);

    useEffect(() => {
        api.get('/des/companies')
            .then(({ data }) => setCompanies(Array.isArray(data) ? data : []))
            .catch(() => setCompanies([]));
    }, []);

    useEffect(() => {
        let cancelled = false;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLoading(true); setError('');
        api.get('/des/monthly-reports', { params: { month, company: companyId === ALL ? undefined : companyId } })
            .then(({ data }) => { if (!cancelled) setReport(data); })
            .catch((err) => { if (!cancelled) { setError(errMsg(err)); setReport(null); } })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [month, companyId]);

    useEffect(() => {
        if (!preview) return undefined;
        const onKey = (e) => { if (e.key === 'Escape') setPreview(false); };
        window.addEventListener('keydown', onKey);
        document.body.style.overflow = 'hidden';
        return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
    }, [preview]);

    const companyOptions = [{ value: ALL, label: 'All companies' }, ...companies.map((c) => ({ value: c.id, label: c.name }))];
    const companyName = companyId === ALL ? '' : companies.find((c) => c.id === companyId)?.name || '';
    const scopeLabel = companyName || 'All companies';

    const s = report?.stats;
    const p = report?.previousStats;
    const designer = report?.designer;
    const prevMonth = report?.previousMonth || '';
    const weekly = report ? report.weekly.filter((w, i) => i < 4 || w.submitted + w.approved + w.redo > 0) : [];
    const summary = report ? buildSummary(designer?.name || 'The designer', s, month, companyName) : '';

    const downloadReport = async () => {
        const el = document.getElementById('designer-report');
        if (!el) return;
        setDownloading(true); setError('');
        try {
            const { default: html2pdf } = await import('html2pdf.js');
            const safe = `${designer?.name || 'Designer'}-${scopeLabel}-${month}`.replace(/[^\w-]+/g, '_');
            await html2pdf().set({
                margin: [10, 8, 10, 8],
                filename: `Designer-Report-${safe}.pdf`,
                image: { type: 'jpeg', quality: 0.95 },
                html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
                pagebreak: { mode: ['css', 'legacy'], avoid: ['tr', '.mr-chart', '.mr-stat'] }
            }).from(el).save();
        } catch (err) {
            setError(errMsg(err) || 'Could not create the report file');
        } finally {
            setDownloading(false);
        }
    };

    const kpis = s ? [
        { label: 'Assigned', value: fmt(s.assigned), pct: change(s.assigned, p.assigned) },
        { label: 'Delivered', value: fmt(s.submitted), pct: change(s.submitted, p.submitted) },
        { label: 'Approved', value: fmt(s.approved), pct: change(s.approved, p.approved) },
        { label: 'Redo requests', value: fmt(s.redo), pct: change(s.redo, p.redo), inverse: true },
        { label: 'Still to do', value: fmt(s.pending), pct: change(s.pending, p.pending), inverse: true },
        { label: 'Approval rate', value: pctText(s.approvalRate) },
    ] : [];

    const compareRows = s ? [
        ['Assigned', s.assigned, p.assigned],
        ['Delivered', s.submitted, p.submitted],
        ['Approved', s.approved, p.approved],
        ['Redo requests', s.redo, p.redo],
        ['Still to do', s.pending, p.pending],
    ] : [];

    const tot = report ? report.companies.reduce((a, c) => {
        ['assigned', 'submitted', 'approved', 'redo', 'pending'].forEach((k) => { a[k] += c[k]; });
        return a;
    }, { assigned: 0, submitted: 0, approved: 0, redo: 0, pending: 0 }) : null;

    const hasActivity = !!report && (report.creatives.length > 0);
    const current = STEPS[step];

    return (
        <div className="dashboard-content scrollable mr-page">
            <div className="mr-noprint mrx">
                <div className="mrx-top">
                    <div className="mrx-title">
                        <span className="page-label">DESIGN WORKSPACE</span>
                        <h1>Monthly Reports</h1>
                        <p>Pick a month and company to review your design activity, then preview or download the report.</p>
                    </div>
                    <div className="mrx-filters">
                        <AnSelect label="Company" value={companyId} options={companyOptions} onChange={setCompanyId} />
                        <AnSelect label="Month" value={month} options={months} onChange={setMonth} />
                    </div>
                </div>

                {error && <div className="an-error"><AlertCircle size={16} /> {error}</div>}
                {loading && <p className="an-loading">Loading…</p>}

                {!loading && report && (
                    <div className="mrx-layout">
                        <section className="mrx-editor mr-form">
                            <nav className="mrx-steps" role="tablist" aria-label="Report sections">
                                {STEPS.map((st, i) => {
                                    const Icon = st.icon;
                                    return (
                                        <button
                                            key={st.key} type="button" role="tab" aria-selected={i === step}
                                            className={`mrx-step ${i === step ? 'active' : ''}`}
                                            onClick={() => setStep(i)}
                                        >
                                            <span className="mrx-step-ico"><Icon size={14} /></span>
                                            <span className="mrx-step-name">{st.label}</span>
                                        </button>
                                    );
                                })}
                            </nav>

                            <div className="mrx-panel">
                                <div className="mrx-panel-head">
                                    <h2><b>{step + 1}</b>{current.title}</h2>
                                    <p>{current.hint}</p>
                                </div>

                                {current.key === 'overview' && (
                                    <>
                                        <div className="mrx-content">
                                            <div className="mrx-bignum">
                                                <strong>{s.submitted}</strong>
                                                <span>designs delivered in {monthName(month)}</span>
                                                <small>{monthName(prevMonth)}: {p.submitted}</small>
                                            </div>
                                            <div className="mrx-chips">
                                                <span className="mrx-chip"><Palette size={14} />Assigned <b>{s.assigned}</b></span>
                                                <span className="mrx-chip"><CheckCircle2 size={14} />Approved <b>{s.approved}</b></span>
                                                <span className="mrx-chip"><RotateCcw size={14} />Redo requests <b>{s.redo}</b></span>
                                                <span className="mrx-chip"><Clock3 size={14} />Still to do <b>{s.pending}</b></span>
                                            </div>
                                        </div>
                                        <div className="mr-calc">
                                            <span>Submission rate = delivered ÷ assigned: <strong>{pctText(s.completionRate)}</strong></span>
                                            <span>Approval rate = approved ÷ reviewed: <strong>{pctText(s.approvalRate)}</strong></span>
                                        </div>
                                        {!hasActivity && <p className="an-empty">No design activity found for {monthName(month)}{companyName ? ` in ${companyName}` : ''}.</p>}
                                    </>
                                )}

                                {current.key === 'weekly' && (
                                    <div className="mrx-all-scroll">
                                        <table className="mrx-all-table">
                                            <thead><tr><th>Week</th><th>Delivered</th><th>Approved</th><th>Redo</th></tr></thead>
                                            <tbody>
                                                {weekly.map((w) => (
                                                    <tr key={w.label}><td>{w.label}</td><td>{w.submitted}</td><td>{w.approved}</td><td>{w.redo}</td></tr>
                                                ))}
                                            </tbody>
                                            <tfoot>
                                                <tr>
                                                    <td>Total</td>
                                                    <td>{weekly.reduce((a, w) => a + w.submitted, 0)}</td>
                                                    <td>{weekly.reduce((a, w) => a + w.approved, 0)}</td>
                                                    <td>{weekly.reduce((a, w) => a + w.redo, 0)}</td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                )}

                                {current.key === 'companies' && (
                                    report.companies.length === 0 ? (
                                        <p className="an-empty">No company activity for {monthName(month)}.</p>
                                    ) : (
                                        <div className="mrx-all-scroll">
                                            <table className="mrx-all-table">
                                                <thead><tr><th>Company</th><th>Assigned</th><th>Delivered</th><th>Approved</th><th>Redo</th><th>To do</th></tr></thead>
                                                <tbody>
                                                    {report.companies.map((c) => (
                                                        <tr key={c.id}>
                                                            <td>
                                                                <span className="mrx-all-plat">
                                                                    {c.logo
                                                                        ? <img src={c.logo} alt="" style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'contain', background: '#fff' }} />
                                                                        : <Building2 size={15} />}
                                                                    {c.name}
                                                                </span>
                                                            </td>
                                                            <td>{c.assigned}</td><td>{c.submitted}</td><td>{c.approved}</td><td>{c.redo}</td><td>{c.pending}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                                <tfoot>
                                                    <tr><td>Total</td><td>{tot.assigned}</td><td>{tot.submitted}</td><td>{tot.approved}</td><td>{tot.redo}</td><td>{tot.pending}</td></tr>
                                                </tfoot>
                                            </table>
                                        </div>
                                    )
                                )}

                                {current.key === 'creatives' && (
                                    report.creatives.length === 0 ? (
                                        <p className="an-empty">No creative activity found for {monthName(month)}.</p>
                                    ) : (
                                        <div className="mrx-all-scroll">
                                            <table className="mrx-all-table">
                                                <thead><tr><th>Creative</th><th>Company</th><th>Scheduled</th><th>Assigned</th><th>Delivered</th><th>Version</th><th>Status</th></tr></thead>
                                                <tbody>
                                                    {report.creatives.map((c) => (
                                                        <tr key={c.id}>
                                                            <td style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis' }} title={c.title}>{c.title}</td>
                                                            <td>{c.company}</td>
                                                            <td>{c.scheduledDate ? fmtDay(c.scheduledDate) : '-'}</td>
                                                            <td>{dayText(c.assignedAt)}</td>
                                                            <td>{dayText(c.uploadedAt)}</td>
                                                            <td>{c.version || '-'}</td>
                                                            <td>{STATUS_LABEL[c.status] || c.status}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )
                                )}
                            </div>

                            <div className="mrx-nav">
                                <button type="button" className="mr-btn" onClick={() => setStep((i) => Math.max(0, i - 1))} disabled={step === 0}><ChevronLeft size={15} /> Back</button>
                                <span>Step {step + 1} of {STEPS.length}</span>
                                {step < STEPS.length - 1
                                    ? <button type="button" className="mr-btn primary" onClick={() => setStep((i) => Math.min(STEPS.length - 1, i + 1))}>Next <ChevronRight size={15} /></button>
                                    : <button type="button" className="mr-btn primary" onClick={() => setPreview(true)}><Eye size={15} /> Preview report</button>}
                            </div>
                        </section>

                        <aside className="mrx-review" aria-label="Report review">
                            <div className="mrx-review-head">
                                <span className="mrx-plat"><Palette size={18} /></span>
                                <div>
                                    <strong>{scopeLabel}</strong>
                                    <small>{monthName(month)} · Designer</small>
                                </div>
                            </div>

                            <div className="mrx-progress">
                                <div className="mrx-progress-top"><span>Submission rate</span><strong>{pctText(s.completionRate)}</strong></div>
                                <div className="mrx-bar"><i style={{ width: `${Math.min(100, s.completionRate)}%` }} /></div>
                                <small>{s.submitted} delivered of {s.assigned} assigned{s.pending > 0 ? ` · ${s.pending} still to do` : ''}</small>
                            </div>

                            <div className="mrx-kpis">
                                {kpis.map((k) => {
                                    const good = k.inverse ? k.pct <= 0 : k.pct >= 0;
                                    return (
                                        <div className="mrx-kpi" key={k.label}>
                                            <span>{k.label}</span>
                                            <strong>{k.value}</strong>
                                            {k.pct !== undefined && k.pct !== null && (
                                                <em className={good ? 'up' : 'down'} title="Change vs last month">
                                                    {k.pct >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}{Math.abs(k.pct).toFixed(0)}%
                                                </em>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="mrx-sum">
                                <h4>Summary</h4>
                                <p>{summary || 'No design activity yet for this month.'}</p>
                            </div>

                            <div className="mrx-actions">
                                <div className="mrx-actions-row">
                                    <button type="button" className="mr-btn" onClick={() => setPreview(true)}><Eye size={15} /> Preview</button>
                                    <button type="button" className="mr-btn primary" onClick={downloadReport} disabled={downloading}><Download size={15} /> {downloading ? 'Preparing…' : 'Download'}</button>
                                </div>
                            </div>
                        </aside>
                    </div>
                )}
            </div>

            {/* ---------------- printable report ---------------- */}
            {!loading && report && (
                <div className={preview ? 'mr-preview-overlay' : 'mr-offscreen'} onClick={(e) => { if (preview && e.target === e.currentTarget) setPreview(false); }}>
                    {preview && (
                        <div className="mr-preview-bar">
                            <strong>Report preview <small>{designer?.name} · {scopeLabel} · {monthName(month)}</small></strong>
                            <div>
                                <button type="button" className="mr-btn primary" onClick={downloadReport} disabled={downloading}><Download size={15} /> {downloading ? 'Preparing…' : 'Download Report'}</button>
                                <button type="button" className="mr-btn" onClick={() => setPreview(false)}><X size={15} /> Close</button>
                            </div>
                        </div>
                    )}
                    <article className="mr-doc" id="designer-report">
                        <header className="mr-doc-head">
                            <img src={logo} alt="Unstoppable" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                            <h1>Designer Performance Report</h1>
                            <p>{designer?.name} · {scopeLabel} · {monthName(month)}</p>
                        </header>

                        <section>
                            <h2>Report Details</h2>
                            <table className="mr-table mr-left mr-meta">
                                <tbody>
                                    <tr><th>Prepared for</th><td>{designer?.name || '-'}</td><th>Position</th><td>{designer?.position}</td></tr>
                                    <tr><th>Department</th><td>{designer?.department}</td><th>Email</th><td>{designer?.email || '-'}</td></tr>
                                    <tr><th>Reporting manager</th><td>{designer?.manager || '-'}</td><th>Assigned companies</th><td>{report.companyCount}</td></tr>
                                    <tr><th>Reporting period</th><td>{fmtDay(report.periodFrom)} – {fmtDay(report.periodTo)}</td><th>Compared with</th><td>{monthName(prevMonth)}</td></tr>
                                    <tr><th>Scope</th><td>{companyName ? `Creatives of ${companyName}` : 'Creatives of every assigned company'}</td><th>Basis</th><td>Designs delivered and reviewed in the month</td></tr>
                                </tbody>
                            </table>
                        </section>

                        <section>
                            <h2>Summary</h2>
                            <p>{summary || 'No design activity for this month.'}</p>
                        </section>

                        <section>
                            <h2>Executive Summary</h2>
                            <div className="mr-stats-grid">
                                <div className="mr-stat"><span>Assigned</span><strong>{fmt(s.assigned)}</strong><small>Creatives given to you this month</small></div>
                                <div className="mr-stat"><span>Delivered</span><strong>{fmt(s.submitted)}</strong><small>{pctText(s.completionRate)} submission rate</small></div>
                                <div className="mr-stat"><span>Approved</span><strong>{fmt(s.approved)}</strong><small>{pctText(s.approvalRate)} approval rate</small></div>
                                <div className="mr-stat"><span>Redo requests</span><strong>{fmt(s.redo)}</strong><small>Sent back by the SME</small></div>
                                <div className="mr-stat"><span>Still to do</span><strong>{fmt(s.pending)}</strong><small>Assigned, nothing delivered</small></div>
                                <div className="mr-stat"><span>Versions sent</span><strong>{fmt(s.totalVersions)}</strong><small>Including redo versions</small></div>
                            </div>
                            <DesStatusChart r={report} monthLabel={monthName(month)} />
                        </section>

                        <section>
                            <h2>Weekly Activity</h2>
                            <table className="mr-table">
                                <thead><tr><th>Week</th><th>Delivered</th><th>Approved</th><th>Redo</th></tr></thead>
                                <tbody>{weekly.map((w) => <tr key={w.label}><td>{w.label}</td><td>{w.submitted}</td><td>{w.approved}</td><td>{w.redo}</td></tr>)}</tbody>
                            </table>
                            <DesWeeklyChart r={report} />
                        </section>

                        <section>
                            <h2>Month-over-Month Comparison</h2>
                            <table className="mr-table">
                                <thead><tr><th>Metric</th><th>{monthName(month)}</th><th>{monthName(prevMonth)}</th><th>Change</th></tr></thead>
                                <tbody>
                                    {compareRows.map(([label, a, b]) => (
                                        <tr key={label}><td>{label}</td><td>{fmt(a)}</td><td>{fmt(b)}</td><td>{signed(a - b)}</td></tr>
                                    ))}
                                    <tr><td>Submission rate</td><td>{pctText(s.completionRate)}</td><td>{pctText(p.completionRate)}</td><td>{signed(Math.round((s.completionRate - p.completionRate) * 10) / 10)} pts</td></tr>
                                    <tr><td>Approval rate</td><td>{pctText(s.approvalRate)}</td><td>{pctText(p.approvalRate)}</td><td>{signed(Math.round((s.approvalRate - p.approvalRate) * 10) / 10)} pts</td></tr>
                                </tbody>
                            </table>
                            <DesCompareChart r={report} monthLabel={shortMonth(month)} previousLabel={shortMonth(prevMonth)} />
                        </section>

                        <section className="mr-flow">
                            <h2>Company-wise Performance</h2>
                            {report.companies.length === 0 ? <p>No company activity for this month.</p> : (
                                <>
                                    <table className="mr-table mr-wide">
                                        <thead><tr><th>Company</th><th>Assigned</th><th>Delivered</th><th>Approved</th><th>Redo</th><th>To do</th></tr></thead>
                                        <tbody>
                                            {report.companies.map((c) => (
                                                <tr key={c.id}><td>{c.name}</td><td>{c.assigned}</td><td>{c.submitted}</td><td>{c.approved}</td><td>{c.redo}</td><td>{c.pending}</td></tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr><td>Total</td><td>{tot.assigned}</td><td>{tot.submitted}</td><td>{tot.approved}</td><td>{tot.redo}</td><td>{tot.pending}</td></tr>
                                        </tfoot>
                                    </table>
                                    <DesCompanyChart r={report} />
                                </>
                            )}
                        </section>

                        {report.creatives.length > 0 && (
                            <section className="mr-flow">
                                <h2>Creative Details</h2>
                                <table className="mr-table mr-left">
                                    <thead><tr><th>Scheduled</th><th>Title</th><th>Company</th><th>Delivered</th><th>Version</th><th>Status</th><th>Remark</th></tr></thead>
                                    <tbody>
                                        {report.creatives.map((c) => (
                                            <tr key={c.id}>
                                                <td>{c.scheduledDate ? fmtDay(c.scheduledDate) : '-'}</td><td>{c.title}</td><td>{c.company}</td>
                                                <td>{dayText(c.uploadedAt)}</td><td>{c.version || '-'}</td>
                                                <td>{STATUS_LABEL[c.status] || c.status}</td>
                                                <td>{c.status === 'redo' ? c.reviewNote || '-' : '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </section>
                        )}

                        <ReportSignature preparedBy={designer?.name} position={designer?.position} manager={designer?.manager} date={fmtDay(todayStr())} />
                        <footer className="mr-doc-foot">Generated on {todayStr()} · figures come from the designer’s uploads and the SME’s reviews.</footer>
                    </article>
                </div>
            )}
        </div>
    );
};

export default DesMonthlyReports;
