import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Download, Eye, Plus, Save, Trash2, X } from 'lucide-react';
import api from '../api';
import { errMsg, todayStr } from '../sopUtils';
import AnSelect from '../components/AnSelect';
import MonthlyPerformance from '../components/MonthlyPerformance';
import { GrowthChart, OverviewCharts } from '../components/MonthlyCharts';
import '../styles/analytics.css';
import '../styles/monthlyreport.css';

const NUM_FIELDS = [
    'followersStart', 'newFollowers', 'unfollowers', 'followersEnd',
    'accountsReached', 'accountsEngaged', 'views', 'profileVisits', 'websiteVisits',
    'nonFollowerInteractionPct', 'posts', 'reels', 'stories',
    'ovPrevFollowers', 'ovPrevReach', 'ovPrevEngagement', 'ovEarlierFollowers', 'ovEarlierReach', 'ovEarlierEngagement'
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
        periodFrom: '', periodTo: '', // monthly report: always the whole month
        paidPromotion: !!d.paidPromotion, paidNote: d.paidNote || '',
        bestContent: d.bestContent?.length
            ? d.bestContent.map(b => ({ title: b.title, note: b.note, views: b.views ?? '', boosted: !!b.boosted }))
            : base.bestContent,
        keyInsights: d.keyInsights?.length ? d.keyInsights : [''],
        improvements: d.improvements?.length ? d.improvements : [''],
        summaryNote: d.summaryNote || ''
    };
};

const PLATFORM_LABEL = { instagram: 'Instagram', facebook: 'Facebook', linkedin: 'LinkedIn', x: 'X', youtube: 'YouTube' };

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
    const when = periodText(month, '', '');
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
    const [prev, setPrev] = useState(null);
    const [earlier, setEarlier] = useState(null);
    const [output, setOutput] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [saved, setSaved] = useState('');
    const [downloading, setDownloading] = useState(false);
    const [preview, setPreview] = useState(false);

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
                setForm(f); setPrev(data.previous); setEarlier(data.earlier); setOutput(data.output || null);
            })
            .catch(err => { if (!cancelled) setError(errMsg(err)); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [companyId, month]);

    useEffect(() => {
        if (!preview) return undefined;
        const onKey = (e) => { if (e.key === 'Escape') setPreview(false); };
        window.addEventListener('keydown', onKey);
        document.body.style.overflow = 'hidden';
        return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
    }, [preview]);

    const set = (k) => (v) => { setSaved(''); setForm(f => ({ ...f, [k]: v })); };
    const companyName = companies.find(c => c.id === companyId)?.name || '';
    const d = derive(form);
    const pForm = prev ? fromDoc(prev) : null;
    const pd = pForm ? derive(pForm) : null;
    const eForm = earlier ? fromDoc(earlier) : null;
    const ed = eForm ? derive(eForm) : null;
    const autoSummary = buildSummary(companyName, form, d, month);
    const prevLabelKey = shiftMonth(month, -1);
    const chartMonth = (key) => {
        const [y, m] = key.split('-').map(Number);
        return `${new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short' })} ${String(y).slice(2)}`;
    };
    // content output comes from the approved creatives (not typed in)
    const outNow = output?.[month] || { total: 0, platforms: {} };
    const outPrev = output?.[shiftMonth(month, -1)] || { total: 0, platforms: {} };
    const outPlatforms = [...new Set([...Object.keys(outNow.platforms), ...Object.keys(outPrev.platforms)])];
    // 3-month overview: typed value first, otherwise what was saved for that month
    const ovPrev = {
        followers: n(form.ovPrevFollowers) ?? pd?.end ?? null,
        reach: n(form.ovPrevReach) ?? n(pForm?.accountsReached),
        engagement: n(form.ovPrevEngagement) ?? n(pForm?.accountsEngaged)
    };
    const ovEarlier = {
        followers: n(form.ovEarlierFollowers) ?? ed?.end ?? null,
        reach: n(form.ovEarlierReach) ?? n(eForm?.accountsReached),
        engagement: n(form.ovEarlierEngagement) ?? n(eForm?.accountsEngaged)
    };
    // numbers for the charts at the bottom of the report
    const chartSocial = {
        labels: [chartMonth(shiftMonth(month, -2)), chartMonth(prevLabelKey), chartMonth(month)],
        followers: [ovEarlier.followers, ovPrev.followers, d.end],
        reach: [ovEarlier.reach, ovPrev.reach, n(form.accountsReached)],
        engagement: [ovEarlier.engagement, ovPrev.engagement, n(form.accountsEngaged)],
        growth: { start: n(form.followersStart), added: n(form.newFollowers), lost: n(form.unfollowers), end: d.end }
    };

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

    const downloadReport = async () => {
        const el = document.getElementById('social-report');
        if (!el) return;
        setDownloading(true); setError('');
        try {
            const { default: html2pdf } = await import('html2pdf.js');
            const safe = `${companyName || 'Company'}-${month}`.replace(/[^\w-]+/g, '_');
            await html2pdf().set({
                margin: [10, 8, 10, 8],
                filename: `Monthly-Report-${safe}.pdf`,
                image: { type: 'jpeg', quality: 0.95 },
                html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
                pagebreak: { mode: ['css', 'legacy'], avoid: ['tr', '.mr-chart', '.mr-stat', '.mr-best-card'] }
            }).from(el).save();
        } catch (err) {
            setError(errMsg(err) || 'Could not create the report file');
        } finally {
            setDownloading(false);
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
        ['Content published (approved creatives)', fmt(outPrev.total), fmt(outNow.total)]
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
                        <p>Type in the social-media numbers that are not in the system, then download the monthly report.</p>
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

                        <h3>1. Summary</h3>
                        <div className="mr-grid">
                            <label className="mr-field"><span>Platform</span>
                                <div className="mr-input-wrap"><input type="text" value={form.platform} maxLength={30} onChange={e => set('platform')(e.target.value)} /></div>
                            </label>
                        </div>
                        <div className="mr-grid one" style={{ marginTop: 14 }}>
                            <label className="mr-field wide"><span>Summary (optional)</span>
                                <textarea rows={4} maxLength={1000} value={form.summaryNote} onChange={e => set('summaryNote')(e.target.value)}
                                    placeholder="Leave empty to auto-write the summary from the numbers below" />
                                {!form.summaryNote && autoSummary && <small>Auto summary: {autoSummary}</small>}
                            </label>
                        </div>

                        <h3>2. Audience growth</h3>
                        <div className="mr-grid">
                            <NumInput label="Followers (started with)" value={form.followersStart} onChange={set('followersStart')} />
                            <NumInput label="New followers" value={form.newFollowers} onChange={set('newFollowers')} />
                            <NumInput label="Unfollowers" value={form.unfollowers} onChange={set('unfollowers')} />
                            <NumInput label="Followers (total at end)" value={form.followersEnd} onChange={set('followersEnd')}
                                hint={d.end !== null && n(form.followersEnd) === null ? `Will save as ${fmt(d.end)} (start + net)` : 'Leave empty to calculate it'} />
                        </div>
                        <div className="mr-calc">
                            <span>Net followers = new − unfollowers: <strong>{signed(d.net)}</strong></span>
                            <span>Closing followers = start + net: <strong>{d.end !== null ? fmt(d.end) : '-'}</strong></span>
                        </div>
                        <h4 className="mr-subh">Reach &amp; engagement</h4>
                        <div className="mr-grid">
                            <NumInput label="Accounts reached (viewers)" value={form.accountsReached} onChange={set('accountsReached')} />
                            <NumInput label="Accounts engaged (interactions)" value={form.accountsEngaged} onChange={set('accountsEngaged')} />
                            <NumInput label="Impressions / views" value={form.views} onChange={set('views')} />
                            <NumInput label="Profile visits" value={form.profileVisits} onChange={set('profileVisits')} />
                            <NumInput label="Website visits (bio link taps)" value={form.websiteVisits} onChange={set('websiteVisits')} />
                        </div>

                        <h3>3. Content output</h3>
                        <p className="an-note" style={{ marginTop: 0 }}>
                            No input needed. It is filled automatically from your approved creatives: {outNow.total} approved in {monthName(month)}
                            {outPlatforms.length > 0 && ` (${outPlatforms.map(p => `${PLATFORM_LABEL[p] || p} ${outNow.platforms[p] || 0}`).join(' · ')})`}.
                        </p>

                        <h3>4. 3-month social media overview</h3>
                        <p className="an-note" style={{ marginTop: 0 }}>
                            {monthName(month)} uses the audience numbers above (followers {d.end !== null ? fmt(d.end) : '-'}, reach {fmt(form.accountsReached)}, engagement {fmt(form.accountsEngaged)}).
                            Type the figures for the two earlier months; an empty box uses what was saved for that month.
                        </p>
                        <h4 className="mr-subh">{monthName(prevLabel)}</h4>
                        <div className="mr-grid">
                            <NumInput label="Followers" value={form.ovPrevFollowers} onChange={set('ovPrevFollowers')} hint={ovPrev.followers !== null ? `Saved: ${fmt(ovPrev.followers)}` : undefined} />
                            <NumInput label="Reach" value={form.ovPrevReach} onChange={set('ovPrevReach')} hint={n(pForm?.accountsReached) !== null ? `Saved: ${fmt(pForm.accountsReached)}` : undefined} />
                            <NumInput label="Engagement" value={form.ovPrevEngagement} onChange={set('ovPrevEngagement')} hint={n(pForm?.accountsEngaged) !== null ? `Saved: ${fmt(pForm.accountsEngaged)}` : undefined} />
                        </div>
                        <h4 className="mr-subh">{monthName(shiftMonth(month, -2))}</h4>
                        <div className="mr-grid">
                            <NumInput label="Followers" value={form.ovEarlierFollowers} onChange={set('ovEarlierFollowers')} hint={ed?.end != null ? `Saved: ${fmt(ed.end)}` : undefined} />
                            <NumInput label="Reach" value={form.ovEarlierReach} onChange={set('ovEarlierReach')} hint={n(eForm?.accountsReached) !== null ? `Saved: ${fmt(eForm.accountsReached)}` : undefined} />
                            <NumInput label="Engagement" value={form.ovEarlierEngagement} onChange={set('ovEarlierEngagement')} hint={n(eForm?.accountsEngaged) !== null ? `Saved: ${fmt(eForm.accountsEngaged)}` : undefined} />
                        </div>
                        <h4 className="mr-subh">Paid promotion note</h4>
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


                        <h3>5. Best performing content</h3>
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


                        <h3>6. Key insights &amp; improvements</h3>
                        <div className="mr-grid one">
                            <div className="mr-grid">
                                <NumInput label="Interactions from non-followers" suffix="%" value={form.nonFollowerInteractionPct} onChange={set('nonFollowerInteractionPct')} />
                            </div>
                            <LineList label="Key insights" items={form.keyInsights} onChange={set('keyInsights')} placeholder="What worked, e.g. 98.7% of interactions came from non-followers" />
                            <LineList label="What needs improvement" items={form.improvements} onChange={set('improvements')} placeholder="e.g. Keep a balanced mix of Reels, carousels and property highlights" />
                        </div>

                        <div className="mr-actions">
                            <button type="button" className="mr-btn primary" onClick={save} disabled={saving}><Save size={15} /> {saving ? 'Saving…' : 'Save numbers'}</button>
                            <button type="button" className="mr-btn" onClick={() => setPreview(true)}><Eye size={15} /> Preview Report</button>
                            <button type="button" className="mr-btn" onClick={downloadReport} disabled={downloading}><Download size={15} /> {downloading ? 'Preparing…' : 'Download Report'}</button>
                            {saved && <span className="mr-saved"><CheckCircle2 size={14} /> {saved}</span>}
                        </div>
                    </div>
                )}
            </div>

            {/* ---------------- printable report ---------------- */}
            {!loading && companyId && (
                <div className={preview ? 'mr-preview-overlay' : 'mr-offscreen'} onClick={e => { if (preview && e.target === e.currentTarget) setPreview(false); }}>
                    {preview && (
                        <div className="mr-preview-bar">
                            <strong>Report preview <small>{companyName} · {monthName(month)}</small></strong>
                            <div>
                                <button type="button" className="mr-btn primary" onClick={downloadReport} disabled={downloading}><Download size={15} /> {downloading ? 'Preparing…' : 'Download Report'}</button>
                                <button type="button" className="mr-btn" onClick={() => setPreview(false)}><X size={15} /> Close</button>
                            </div>
                        </div>
                    )}
                <article className="mr-doc" id="social-report">
                    <MonthlyPerformance
                        month={month}
                        header={(
                            <>
                    <header className="mr-doc-head">
                        <img src="/assets/images/logo.png" alt="Unstoppable" onError={e => { e.currentTarget.style.display = 'none'; }} />
                        <h1>Social Media Report</h1>
                        <p>{companyName} · {monthName(month)}</p>
                    </header>
                            </>
                        )}
                        socialSection={(
                            <>
                    <section>
                        <h2>Summary</h2>
                        <p>{form.summaryNote || autoSummary || 'No numbers entered yet.'}</p>
                    </section>

                    <section>
                        <h2>Audience Growth</h2>
                        <table className="mr-table">
                            <thead><tr><th>Metric</th><th>{monthName(prevLabel)}</th><th>{monthName(month)}</th></tr></thead>
                            <tbody>{rows.map(r => <tr key={r[0]}><td>{r[0]}</td><td>{r[1]}</td><td>{r[2]}</td></tr>)}</tbody>
                        </table>
                        <GrowthChart social={chartSocial} month={monthName(month)} />
                    </section>

                    <section>
                        <h2>Content Output</h2>
                        <table className="mr-table">
                            <thead><tr><th>Approved creatives</th><th>{shortMonth(prevLabel)}</th><th>{shortMonth(month)}</th></tr></thead>
                            <tbody>
                                {outPlatforms.map(pf => (
                                    <tr key={pf}><td>{PLATFORM_LABEL[pf] || pf}</td><td>{fmt(outPrev.platforms[pf] || 0)}</td><td>{fmt(outNow.platforms[pf] || 0)}</td></tr>
                                ))}
                                <tr><td><strong>Total approved creatives</strong></td><td><strong>{fmt(outPrev.total)}</strong></td><td><strong>{fmt(outNow.total)}</strong></td></tr>
                            </tbody>
                        </table>
                    </section>

                    <section>
                        <h2>3-Month Social Media Overview</h2>
                        <table className="mr-table">
                            <thead><tr><th>Key metric</th><th>{shortMonth(shiftMonth(month, -2))}</th><th>{shortMonth(prevLabel)}</th><th>{shortMonth(month)}</th></tr></thead>
                            <tbody>
                                <tr><td>Followers</td><td>{fmt(ovEarlier.followers)}</td><td>{fmt(ovPrev.followers)}</td><td>{fmt(d.end)}</td></tr>
                                <tr><td>Reach</td><td>{fmt(ovEarlier.reach)}</td><td>{fmt(ovPrev.reach)}</td><td>{fmt(form.accountsReached)}</td></tr>
                                <tr><td>Engagement</td><td>{fmt(ovEarlier.engagement)}</td><td>{fmt(ovPrev.engagement)}</td><td>{fmt(form.accountsEngaged)}</td></tr>
                            </tbody>
                        </table>
                        <OverviewCharts social={chartSocial} />
                        {form.paidPromotion && (
                            <p className="mr-note"><strong>Paid Promotion Note:</strong> {form.paidNote || `Some posts during ${shortMonth(month)} were boosted to increase visibility, expand reach, and drive engagement. The reported performance includes the impact of paid promotions.`}</p>
                        )}
                    </section>

                    {bestList.length > 0 && (
                        <section>
                            <h2>Best Performing Content</h2>
                            <div className="mr-best-list">
                                {bestList.map((b, i) => (
                                    <div key={i} className="mr-best-card">
                                        <strong>{b.title}</strong>
                                        {n(b.views) !== null && <span>{fmt(b.views)} views</span>}
                                        {b.note && <p>{b.note}</p>}
                                        {b.boosted && <p><strong>Paid Promotion:</strong> This content was boosted, which helped increase visibility and reach beyond the existing follower base.</p>}
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {(form.keyInsights.some(t => t.trim()) || form.improvements.some(t => t.trim()) || n(form.nonFollowerInteractionPct) !== null) && (
                        <section>
                            <h2>{shortMonth(month)} Insights</h2>
                            <div className="mr-two">
                                <div>
                                    <h3>Key insight</h3>
                                    <ul>
                                        {n(form.nonFollowerInteractionPct) !== null && <li>High non-follower discovery: {form.nonFollowerInteractionPct}% of interactions came from non-followers.</li>}
                                        {form.keyInsights.filter(t => t.trim()).map((t, i) => <li key={i}>{t}</li>)}
                                    </ul>
                                </div>
                                <div>
                                    <h3>What needs improvement</h3>
                                    <ul>{form.improvements.filter(t => t.trim()).map((t, i) => <li key={i}>{t}</li>)}</ul>
                                </div>
                            </div>
                        </section>
                    )}
                            </>
                        )}
                        footer={(
                    <footer className="mr-doc-foot">Generated on {todayStr()} · figures are entered by the SME from platform insights.</footer>
                        )}
                    />
                </article>
                </div>
            )}
        </div>
    );
};

export default SmeMonthlyReports;
