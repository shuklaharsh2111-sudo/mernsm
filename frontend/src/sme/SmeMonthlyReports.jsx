import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Plus, Printer, Save, Trash2 } from 'lucide-react';
import api from '../api';
import { errMsg, todayStr } from '../sopUtils';
import AnSelect from '../components/AnSelect';
import '../styles/analytics.css';
import '../styles/monthlyreport.css';
const NUM_FIELDS = [
    'followersStart', 'newFollowers', 'unfollowers', 'followersEnd',
    'accountsReached', 'accountsEngaged', 'views', 'profileVisits', 'websiteVisits',
    'nonFollowerInteractionPct', 'posts', 'reels', 'stories'
];
const emptyForm = () => ({
    platform: 'Instagram',
    periodFrom: '', periodTo: '',
    ...Object.fromEntries(NUM_FIELDS.map(f => [f, ''])),
    paidPromotion: false, paidNote: '',
    bestContent: [{ title: '', note: '', views: '', boosted: false }],
    keyInsights: [''], improvements: [''],
    summaryNote: ''
});
const fromDoc = (d) => {
    if (!d) return emptyForm();
    const base = emptyForm();
    NUM_FIELDS.forEach(f => { base[f] = d[f] ?? ''; });
    return {
        ...base,
        platform: d.platform || 'Instagram',
        periodFrom: d.periodFrom || '', periodTo: d.periodTo || '',
        paidPromotion: !!d.paidPromotion, paidNote: d.paidNote || '',
        bestContent: d.bestContent?.length
            ? d.bestContent.map(b => ({ title: b.title, note: b.note, views: b.views ?? '', boosted: !!b.boosted }))
            : base.bestContent,
        keyInsights: d.keyInsights?.length ? d.keyInsights : [''],
        improvements: d.improvements?.length ? d.improvements : [''],
        summaryNote: d.summaryNote || ''
    };
};
const n = (v) => (v === '' || v === null || v === undefined || Number.isNaN(Number(v)) ? null : Number(v));
const fmt = (v) => (n(v) === null ? '-' : Number(v).toLocaleString('en-IN'));
const signed = (v) => (v === null ? '-' : `${v > 0 ? '+' : ''}${v.toLocaleString('en-IN')}`);
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
const shiftMonth = (key, by) => {
    const [y, m] = key.split('-').map(Number);
    const d = new Date(y, m - 1 + by, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const ordinal = (d) => {
    const x = d % 100;
    if (x >= 11 && x <= 13) return `${d}th`;
    return `${d}${({ 1: 'st', 2: 'nd', 3: 'rd' })[d % 10] || 'th'}`;
};
const periodText = (month, from, to) => {
    const [y, m] = month.split('-').map(Number);
    const last = new Date(y, m, 0).getDate();
    const f = from ? Number(from.slice(8)) : 1;
    const t = to ? Number(to.slice(8)) : last;
    return `${ordinal(f)} ${shortMonth(month)} to ${ordinal(t)} ${shortMonth(month)}`;
};
/* ---------- derived numbers (also used for the written summary) ---------- */
const derive = (f) => {
    const nu = n(f.newFollowers), un = n(f.unfollowers);
    const net = nu === null && un === null ? null : (nu || 0) - (un || 0);
    const start = n(f.followersStart);
    const end = n(f.followersEnd) ?? (start !== null && net !== null ? start + net : null);
    const published = [n(f.posts), n(f.reels), n(f.stories)].some(v => v !== null)
        ? (n(f.posts) || 0) + (n(f.reels) || 0) + (n(f.stories) || 0) : null;
    return { net, end, published };
};
const buildSummary = (company, f, d, month) => {
    const bits = [];
    const when = periodText(month, f.periodFrom, f.periodTo);
    const views = n(f.views), reach = n(f.accountsReached);
    if (views !== null || reach !== null) {
        const parts = [];
        if (views !== null) parts.push(`${fmt(views)} views`);
        if (reach !== null) parts.push(`reached ${fmt(reach)} unique viewers`);
        bits.push(`During the period of ${when}, ${company.toUpperCase()} achieved ${parts.join(' and ')} on ${f.platform}.`);
    }
    const inter = n(f.accountsEngaged);
    const tail = [];
    if (inter !== null) tail.push(`recorded ${fmt(inter)} interactions`);
    if (d.net !== null) tail.push(`a net ${d.net >= 0 ? 'growth' : 'change'} of ${d.net} followers`);
    if (tail.length) bits.push(`The account ${tail.join(' and ')}${d.end !== null ? `, taking the total follower count to ${fmt(d.end)}` : ''}.`);
    const pv = n(f.profileVisits);
    if (pv !== null) bits.push(`The account also recorded ${fmt(pv)} profile visits.`);
    if (d.net !== null) bits.push(`${d.net >= 0 ? 'Positive' : 'Negative'} net follower growth in ${shortMonth(month)}.`);
    return bits.join(' ');
};
/* ---------- small form pieces ---------- */
const NumInput = ({ label, value, onChange, hint, suffix }) => (
    <label className="mr-field">
        <span>{label}</span>
        <div className="mr-input-wrap">
            <input
                type="text" inputMode="numeric" value={value} placeholder="0"
                onChange={e => onChange(e.target.value.replace(/[^\d.,]/g, ''))}
            />
            {suffix && <em>{suffix}</em>}
        </div>
        {hint && <small>{hint}</small>}
    </label>
);
const LineList = ({ label, items, onChange, placeholder }) => (
    <div className="mr-field wide">
        <span>{label}</span>
        {items.map((t, i) => (
            <div className="mr-line" key={i}>
                <input
                    type="text" value={t} maxLength={400} placeholder={placeholder}
                    onChange={e => onChange(items.map((x, j) => (j === i ? e.target.value : x)))}
                />
                {items.length > 1 && (
                    <button type="button" className="mr-icon" aria-label="Remove" onClick={() => onChange(items.filter((_, j) => j !== i))}>
                        <Trash2 size={14} />
                    </button>
                )}
            </div>
        ))}
        {items.length < 10 && (
            <button type="button" className="mr-add" onClick={() => onChange([...items, ''])}><Plus size={13} /> Add</button>
        )}
    </div>
);
/* ---------- page ---------- */
const SmeMonthlyReports = () => {
    const months = useMemo(() => monthOptions(), []);
    const [month, setMonth] = useState(months[0].value);
    const [companies, setCompanies] = useState([]);
    const [companyId, setCompanyId] = useState('');
    const [form, setForm] = useState(emptyForm());
    const [performanceReport, setPerformanceReport] = useState(null);
    const [reportLoading, setReportLoading] = useState(false);
    const [reportError, setReportError] = useState('');
    const [prev, setPrev] = useState(null);
    const [earlier, setEarlier] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [saved, setSaved] = useState('');
    useEffect(() => {
        api.get('/sme/companies')
            .then(({ data }) => {
                setCompanies(data.companies || []);
                if (data.companies?.length) setCompanyId(data.companies[0].id);
                else setLoading(false);
            })
            .catch(err => { setError(errMsg(err)); setLoading(false); });
    }, []);
    useEffect(() => {
        if (!companyId) return undefined;
        let cancelled = false;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLoading(true); setError(''); setSaved('');
        api.get('/sme/social-metrics', { params: { company: companyId, month } })
            .then(({ data }) => {
                if (cancelled) return;
                const f = fromDoc(data.current);
                // first time for this month: carry over what is already known from last month
                if (!data.current && data.previous) {
                    const pd = derive(fromDoc(data.previous));
                    if (pd.end !== null) f.followersStart = pd.end;
                    f.platform = data.previous.platform || f.platform;
                }
                setForm(f); setPrev(data.previous); setEarlier(data.earlier);
            })
            .catch(err => { if (!cancelled) setError(errMsg(err)); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [companyId, month]);
    useEffect(() => {
        let cancelled = false;
        const loadPerformanceReport = async () => {
            setReportLoading(true);
            setReportError('');
            try {
                const { data } = await api.get('/sme/monthly-report', {
                    params: { month }
                });
                if (!cancelled) {
                    setPerformanceReport(data.report);
                }
            } catch (error) {
                if (!cancelled) {
                    setReportError(
                        error.response?.data?.message ||
                        'Unable to load monthly performance report'
                    );
                }
            } finally {
                if (!cancelled) {
                    setReportLoading(false);
                }
            }
        };
        loadPerformanceReport();
        return () => {
            cancelled = true;
        };
    }, [month]);
    const set = (k) => (v) => { setSaved(''); setForm(f => ({ ...f, [k]: v })); };
    const companyName = companies.find(c => c.id === companyId)?.name || '';
    const d = derive(form);
    const pForm = prev ? fromDoc(prev) : null;
    const pd = pForm ? derive(pForm) : null;
    const eForm = earlier ? fromDoc(earlier) : null;
    const ed = eForm ? derive(eForm) : null;
    const autoSummary = buildSummary(companyName, form, d, month);
    const save = async () => {
        setSaving(true); setError(''); setSaved('');
        try {
            const body = {
                ...form, company: companyId, month,
                followersEnd: n(form.followersEnd) ?? d.end ?? '',
                bestContent: form.bestContent.filter(b => b.title.trim())
            };
            const { data } = await api.put('/sme/social-metrics', body);
            setForm(fromDoc(data.metrics));
            setSaved(`Saved at ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`);
        } catch (err) {
            setError(errMsg(err));
        } finally {
            setSaving(false);
        }
    };
    const rows = [
        ['Followers (started with)', fmt(pForm?.followersStart), fmt(form.followersStart)],
        ['New followers', fmt(pForm?.newFollowers), fmt(form.newFollowers)],
        ['Unfollowers', fmt(pForm?.unfollowers), fmt(form.unfollowers)],
        ['Net followers', pd ? signed(pd.net) : '-', signed(d.net)],
        ['Accounts reached (viewers)', fmt(pForm?.accountsReached), fmt(form.accountsReached)],
        ['Accounts engaged (interactions)', fmt(pForm?.accountsEngaged), fmt(form.accountsEngaged)],
        ['Impressions / views', fmt(pForm?.views), fmt(form.views)],
        ['Profile visits', fmt(pForm?.profileVisits), fmt(form.profileVisits)],
        ['Website visits (bio link taps)', fmt(pForm?.websiteVisits), fmt(form.websiteVisits)],
        ['Content published', fmt(pd?.published), fmt(d.published)]
    ];
    const prevLabel = shiftMonth(month, -1);
    const bestList = form.bestContent.filter(b => b.title.trim());
    if (!loading && !companies.length && !error) {
        return <div className="dashboard-content scrollable"><p className="an-empty">No company is assigned to you yet. Ask the admin to assign one.</p></div>;
    }
    return (
        <div className="dashboard-content scrollable mr-page">
            <div className="mr-noprint">
                <div className="page-header">
                    <div>
                        <span className="page-label">SME WORKSPACE</span>
                        <h1>Monthly Reports</h1>
                        <p>Type in the social-media numbers that are not in the system, then print the monthly report.</p>
                    </div>
                </div>
                <div className="an-filters">
                    <AnSelect label="Company" value={companyId} options={companies.map(c => ({ value: c.id, label: c.name }))} onChange={setCompanyId} />
                    <AnSelect label="Month" value={month} options={months} onChange={setMonth} />
                </div>
                {error && <div className="an-error"><AlertCircle size={16} /> {error}</div>}
                {loading && <p className="an-loading">Loading…</p>}
                {!loading && companyId && (
                    <div className="an-card mr-form">
                        <div className="an-card-head">
                            <h2>Social media numbers <small>{companyName} · {monthName(month)}</small></h2>
                        </div>
                        <p className="an-note" style={{ marginTop: 0 }}>
                            Copy these from {form.platform || 'the platform'} Insights. Leave a box empty if the number is not available. “Followers (started with)” is pre-filled from last month’s closing count.
                        </p>
                        <h3>Report window</h3>
                        <div className="mr-grid">
                            <label className="mr-field"><span>Platform</span>
                                <div className="mr-input-wrap"><input type="text" value={form.platform} maxLength={30} onChange={e => set('platform')(e.target.value)} /></div>
                            </label>
                            <label className="mr-field"><span>From (optional)</span>
                                <div className="mr-input-wrap"><input type="date" value={form.periodFrom} min={`${month}-01`} max={`${month}-31`} onChange={e => set('periodFrom')(e.target.value)} /></div>
                                <small>Leave empty for the whole month</small>
                            </label>
                            <label className="mr-field"><span>To (optional)</span>
                                <div className="mr-input-wrap"><input type="date" value={form.periodTo} min={`${month}-01`} max={`${month}-31`} onChange={e => set('periodTo')(e.target.value)} /></div>
                            </label>
                        </div>
                        <h3>Audience growth</h3>
                        <div className="mr-grid">
                            <NumInput label="Followers (started with)" value={form.followersStart} onChange={set('followersStart')} />
                            <NumInput label="New followers" value={form.newFollowers} onChange={set('newFollowers')} />
                            <NumInput label="Unfollowers" value={form.unfollowers} onChange={set('unfollowers')} />
                            <NumInput label="Followers (total at end)" value={form.followersEnd} onChange={set('followersEnd')}
                                hint={d.end !== null && n(form.followersEnd) === null ? `Will save as ${fmt(d.end)} (start + net)` : `Net growth: ${signed(d.net)}`} />
                        </div>
                        <h3>Reach &amp; engagement</h3>
                        <div className="mr-grid">
                            <NumInput label="Accounts reached (viewers)" value={form.accountsReached} onChange={set('accountsReached')} />
                            <NumInput label="Accounts engaged (interactions)" value={form.accountsEngaged} onChange={set('accountsEngaged')} />
                            <NumInput label="Impressions / views" value={form.views} onChange={set('views')} />
                            <NumInput label="Profile visits" value={form.profileVisits} onChange={set('profileVisits')} />
                            <NumInput label="Website visits (bio link taps)" value={form.websiteVisits} onChange={set('websiteVisits')} />
                            <NumInput label="Interactions from non-followers" suffix="%" value={form.nonFollowerInteractionPct} onChange={set('nonFollowerInteractionPct')} />
                        </div>
                        <h3>Content output</h3>
                        <div className="mr-grid">
                            <NumInput label="Posts" value={form.posts} onChange={set('posts')} />
                            <NumInput label="Reels" value={form.reels} onChange={set('reels')} />
                            <NumInput label="Stories" value={form.stories} onChange={set('stories')} />
                        </div>
                        <h3>Paid promotion</h3>
                        <div className="mr-grid">
                            <label className="mr-check">
                                <input type="checkbox" checked={form.paidPromotion} onChange={e => set('paidPromotion')(e.target.checked)} />
                                <span>Some posts were boosted this month</span>
                            </label>
                            {form.paidPromotion && (
                                <label className="mr-field wide"><span>Note (optional)</span>
                                    <div className="mr-input-wrap"><input type="text" maxLength={400} value={form.paidNote} onChange={e => set('paidNote')(e.target.value)}
                                        placeholder="Leave empty to use the standard note" /></div>
                                </label>
                            )}
                        </div>
                        <h3>Best performing content</h3>
                        {form.bestContent.map((b, i) => (
                            <div className="mr-best" key={i}>
                                <input type="text" placeholder="Title, e.g. Diwali Promotional Reel" maxLength={150} value={b.title}
                                    onChange={e => set('bestContent')(form.bestContent.map((x, j) => j === i ? { ...x, title: e.target.value } : x))} />
                                <input type="text" inputMode="numeric" placeholder="Views" value={b.views}
                                    onChange={e => set('bestContent')(form.bestContent.map((x, j) => j === i ? { ...x, views: e.target.value.replace(/[^\d,]/g, '') } : x))} />
                                <input className="grow" type="text" placeholder="Why it worked" maxLength={400} value={b.note}
                                    onChange={e => set('bestContent')(form.bestContent.map((x, j) => j === i ? { ...x, note: e.target.value } : x))} />
                                <label className="mr-check small">
                                    <input type="checkbox" checked={b.boosted}
                                        onChange={e => set('bestContent')(form.bestContent.map((x, j) => j === i ? { ...x, boosted: e.target.checked } : x))} />
                                    <span>Boosted</span>
                                </label>
                                {form.bestContent.length > 1 && (
                                    <button type="button" className="mr-icon" aria-label="Remove" onClick={() => set('bestContent')(form.bestContent.filter((_, j) => j !== i))}><Trash2 size={14} /></button>
                                )}
                            </div>
                        ))}
                        {form.bestContent.length < 5 && (
                            <button type="button" className="mr-add" onClick={() => set('bestContent')([...form.bestContent, { title: '', note: '', views: '', boosted: false }])}><Plus size={13} /> Add content</button>
                        )}
                        <h3>Insights</h3>
                        <div className="mr-grid one">
                            <LineList label="Key insights" items={form.keyInsights} onChange={set('keyInsights')} placeholder="What worked, e.g. 98.7% of interactions came from non-followers" />
                            <LineList label="What needs improvement" items={form.improvements} onChange={set('improvements')} placeholder="e.g. Keep a balanced mix of Reels, carousels and property highlights" />
                            <label className="mr-field wide"><span>Summary (optional)</span>
                                <textarea rows={4} maxLength={1000} value={form.summaryNote} onChange={e => set('summaryNote')(e.target.value)}
                                    placeholder="Leave empty to auto-write the summary from the numbers above" />
                            </label>
                        </div>
                        <div className="mr-actions">
                            <button type="button" className="mr-btn primary" onClick={save} disabled={saving}><Save size={15} /> {saving ? 'Saving…' : 'Save numbers'}</button>
                            <button type="button" className="mr-btn" onClick={() => window.print()}><Printer size={15} /> Print / Save PDF</button>
                            {saved && <span className="mr-saved"><CheckCircle2 size={14} /> {saved}</span>}
                        </div>
                    </div>
                )}
            </div>
            {/* ---------------- printable report ---------------- */}
            {!reportLoading && performanceReport && (
                <article className="mr-doc" id="sme-performance-report">
                    <header className="mr-doc-head">
                        <img
                            src="/assets/images/company-logo.png"
                            alt="Unstoppable Solutions"
                        />
                        <h1>SME Performance Report</h1>
                        <p>
                            {performanceReport.period?.label}
                        </p>
                    </header>
                    <section>
                        <h2>Prepared For</h2>
                        <p>
                            <strong>
                                {performanceReport.profile?.name}
                            </strong>
                        </p>
                        <p>
                            {performanceReport.profile?.email}
                        </p>
                        <p>
                            Reporting Manager:
                            {' '}
                            {performanceReport.profile?.reportingManager || '-'}
                        </p>
                    </section>
                    <section>
                        <h2>Executive Summary</h2>
                        <p>
                            {performanceReport.summary}
                        </p>
                    </section>
                    <section>
                        <h2>Creative Performance</h2>
                        {/* KPI cards yahan render karna */}
                        {/* Creative status graph yahan render karna */}
                    </section>
                    <section>
                        <h2>Month-over-Month Comparison</h2>
                        {/* Previous month comparison table */}
                    </section>
                    <section>
                        <h2>Company-wise Performance</h2>
                        {/* Assigned companies ka table */}
                    </section>
                    <section>
                        <h2>Platform Performance</h2>
                        {/* Platform-wise graph */}
                    </section>
                    <section>
                        <h2>SOP Schedule</h2>
                        {/* Daily / Weekly / Monthly SOP counts */}
                    </section>
                    <section>
                        <h2>Meetings</h2>
                        {/* Meeting summary and meeting details */}
                    </section>
                    <section>
                        <h2>Creative Details</h2>
                        {/* Month ke creatives ki complete table */}
                    </section>
                    <footer className="mr-doc-foot">
                        Generated on{' '}
                        {new Date().toLocaleString('en-IN')}
                    </footer>
                </article>
            )}
        </div>
    );
};
export default SmeMonthlyReports;
