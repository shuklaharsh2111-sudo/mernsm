import { useEffect, useMemo, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import api from '../api';
import { errMsg, todayStr, typeLabel, fmtDay, fmtDateTime, SOP_TYPES, PERIOD_WORD } from '../sopUtils';
import AnSelect from '../components/AnSelect';
import { PLATFORMS } from '../components/creativePlatforms';
import '../styles/analytics.css';

const PERIODS = [
    { value: 3, label: 'Last 3 months' },
    { value: 6, label: 'Last 6 months' },
    { value: 12, label: 'Last 12 months' },
    { value: 0, label: 'All time' }
];

const STATUS_OPTS = [
    { value: 'all', label: 'All statuses' },
    { value: 'approved', label: 'Approved' },
    { value: 'pending', label: 'Pending' },
    { value: 'revision', label: 'Revision' }
];

const METRIC_OPTS = [
    { value: 'all', label: 'All rates' },
    { value: 'approval', label: 'Approval %' },
    { value: 'revision', label: 'Revision %' },
    { value: 'rejection', label: 'Rejection %' }
];

const FREQ_OPTS = [{ value: 'all', label: 'All frequencies' }, ...SOP_TYPES];

const DAY_RANGES = [
    { value: 7, label: 'Last 7 days' },
    { value: 14, label: 'Last 14 days' },
    { value: 30, label: 'Last 30 days' }
];

const SOP_STATE_OPTS = [
    { value: 'all', label: 'All SOPs' },
    { value: 'pending', label: 'Pending now' },
    { value: 'done', label: 'Done now' },
    { value: 'upcoming', label: 'Not started' }
];

const FREQ_COLORS = { daily: '#5ea3fa', weekly: '#a78bfa', monthly: '#f472b6' };
const TICK_COLOR = '#8b5cf6';

const COLORS = {
    approved: '#3ad492',
    pending: '#ffbb4f',
    revision: '#b074ff',
    rejected: '#ff5c7c'
};

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseYmd = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const monthLabel = (key) => {
    const [y, m] = key.split('-').map(Number);
    return `${new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short' })} ${String(y).slice(2)}`;
};
const pct = (n, total) => (total ? Math.round((n / total) * 1000) / 10 : 0);
const pct0 = (n, total) => (total ? Math.round((n / total) * 100) : 0);

/* ---------- derived numbers ---------- */

const enrich = (c, today) => ({
    ...c,
    month: c.date.slice(0, 7),
    revision: c.status === 'rejected',
    rejectedEver: (c.rejectionCount || 0) > 0 || c.status === 'rejected',
    delayed: !!c.createdAt && ymd(new Date(c.createdAt)) > c.date,
    overdue: c.status !== 'approved' && c.date < today
});

const summarize = (list) => {
    const total = list.length;
    return {
        total,
        approved: list.filter(c => c.status === 'approved').length,
        pending: list.filter(c => c.status === 'pending').length,
        revision: list.filter(c => c.revision).length,
        rejected: list.filter(c => c.rejectedEver).length,
        delays: list.filter(c => c.delayed).length,
        overdue: list.filter(c => c.overdue).length
    };
};

/* ---------- small chart pieces ---------- */

const Donut = ({ slices, total, unit = 'creatives' }) => {
    const r = 56;
    const circ = 2 * Math.PI * r;
    let offset = 0;
    return (
        <svg viewBox="0 0 160 160" className="an-donut" role="img" aria-label="Status breakdown">
            <circle cx="80" cy="80" r={r} fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="18" />
            {total > 0 && slices.filter(s => s.value > 0).map(s => {
                const len = (s.value / total) * circ;
                const el = (
                    <circle
                        key={s.key}
                        cx="80" cy="80" r={r}
                        fill="none"
                        stroke={s.color}
                        strokeWidth="18"
                        strokeDasharray={`${len} ${circ - len}`}
                        strokeDashoffset={-offset}
                        transform="rotate(-90 80 80)"
                    />
                );
                offset += len;
                return el;
            })}
            <text x="80" y="78" textAnchor="middle" className="an-donut-num">{total}</text>
            <text x="80" y="96" textAnchor="middle" className="an-donut-sub">{unit}</text>
        </svg>
    );
};

const BarChart = ({ months, showTotals }) => {
    const W = 680, H = 270, L = 40, R = 16, T = 26, B = 34;
    const innerW = W - L - R, innerH = H - T - B;
    const maxTotal = Math.max(1, ...months.map(m => m.total));
    const step = maxTotal <= 4 ? 1 : Math.ceil(maxTotal / 4);
    const top = step * Math.ceil(maxTotal / step);
    const ticks = [];
    for (let v = 0; v <= top; v += step) ticks.push(v);

    const slot = innerW / months.length;
    const barW = Math.min(52, slot * 0.5);
    const y = (v) => T + innerH - (v / top) * innerH;

    return (
        <svg viewBox={`0 0 ${W} ${H}`} className="an-line" role="img" aria-label="Creatives per month by status">
            {ticks.map(v => (
                <g key={v}>
                    <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="an-grid" />
                    <text x={L - 8} y={y(v) + 4} textAnchor="end" className="an-axis">{v}</text>
                </g>
            ))}
            {months.map((m, i) => {
                const cx = L + slot * i + slot / 2;
                let used = 0;
                const segs = [
                    { key: 'approved', value: m.approved },
                    { key: 'pending', value: m.pending },
                    { key: 'revision', value: m.revisionCount }
                ];
                return (
                    <g key={m.key}>
                        {segs.map(seg => {
                            if (!seg.value) return null;
                            const yTop = y(used + seg.value);
                            const h = y(used) - yTop;
                            used += seg.value;
                            return (
                                <rect key={seg.key} x={cx - barW / 2} y={yTop} width={barW} height={Math.max(0, h - 1)} rx="4" fill={COLORS[seg.key]}>
                                    <title>{`${monthLabel(m.key)} · ${seg.key}: ${seg.value}`}</title>
                                </rect>
                            );
                        })}
                        {showTotals && m.total > 0 && (
                            <text x={cx} y={y(m.total) - 8} textAnchor="middle" className="an-bar-val">{m.total}</text>
                        )}
                        <text x={cx} y={H - 10} textAnchor="middle" className="an-axis">{monthLabel(m.key)}</text>
                    </g>
                );
            })}
        </svg>
    );
};

const LineChart = ({ months, showCounts, metric = 'all' }) => {
    const W = 680, H = 250, L = 40, R = 16, T = 14, B = showCounts ? 52 : 34;
    const innerW = W - L - R, innerH = H - T - B;
    const x = (i) => L + (months.length === 1 ? innerW / 2 : (i / (months.length - 1)) * innerW);
    const y = (v) => T + innerH - (v / 100) * innerH;
    const lines = [
        { key: 'approval', color: COLORS.approved },
        { key: 'revision', color: COLORS.revision },
        { key: 'rejection', color: COLORS.rejected }
    ].filter(l => metric === 'all' || l.key === metric);

    const pathFor = (key) => {
        let d = '';
        let pen = false;
        months.forEach((m, i) => {
            if (m[key] === null) { pen = false; return; }
            d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)} ${y(m[key]).toFixed(1)} `;
            pen = true;
        });
        return d;
    };

    return (
        <svg viewBox={`0 0 ${W} ${H}`} className="an-line" role="img" aria-label="Approval vs redo trend">
            {[0, 25, 50, 75, 100].map(v => (
                <g key={v}>
                    <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="an-grid" />
                    <text x={L - 8} y={y(v) + 4} textAnchor="end" className="an-axis">{v}%</text>
                </g>
            ))}
            {months.map((m, i) => (
                <g key={m.key}>
                    <text x={x(i)} y={H - (showCounts ? 28 : 10)} textAnchor="middle" className="an-axis">{monthLabel(m.key)}</text>
                    {showCounts && (
                        <text x={x(i)} y={H - 10} textAnchor="middle" className="an-axis dim">{m.total} {m.total === 1 ? 'creative' : 'creatives'}</text>
                    )}
                </g>
            ))}
            {lines.map(l => (
                <g key={l.key}>
                    <path d={pathFor(l.key)} fill="none" stroke={l.color} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
                    {months.map((m, i) => m[l.key] === null ? null : (
                        <circle key={m.key} cx={x(i)} cy={y(m[l.key])} r="5" fill={l.color}>
                            <title>{`${monthLabel(m.key)}: ${m[l.key]}%`}</title>
                        </circle>
                    ))}
                </g>
            ))}
        </svg>
    );
};

const TickBars = ({ items, labelEvery = 1, ariaLabel, W = 680, color = '', small = false }) => {
    const H = 260, L = 40, R = 16, T = 26, B = 36;
    const innerW = W - L - R, innerH = H - T - B;
    const maxTotal = Math.max(1, ...items.map(i => i.total));
    const step = maxTotal <= 4 ? 1 : Math.ceil(maxTotal / 4);
    const top = step * Math.ceil(maxTotal / step);
    const ticks = [];
    for (let v = 0; v <= top; v += step) ticks.push(v);

    const slot = innerW / items.length;
    const barW = Math.min(48, slot * 0.6);
    const y = (v) => T + innerH - (v / top) * innerH;

    return (
        <svg viewBox={`0 0 ${W} ${H}`} className="an-line" role="img" aria-label={ariaLabel}>
            {ticks.map(v => (
                <g key={v}>
                    <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="an-grid" />
                    <text x={L - 8} y={y(v) + 4} textAnchor="end" className="an-axis">{v}</text>
                </g>
            ))}
            {items.map((it, i) => {
                const cx = L + slot * i + slot / 2;
                let used = 0;
                const showLabel = i % labelEvery === 0 || i === items.length - 1;
                return (
                    <g key={it.key}>
                        {color ? (it.total > 0 && (
                            <rect x={cx - barW / 2} y={y(it.total)} width={barW} height={Math.max(0, y(0) - y(it.total))} rx="3" fill={color}>
                                <title>{`${it.label} · ${it.total} ${it.total === 1 ? 'tick' : 'ticks'}`}</title>
                            </rect>
                        )) : SOP_TYPES.map(t => {
                            const v = it.values[t.value] || 0;
                            if (!v) return null;
                            const yTop = y(used + v);
                            const h = y(used) - yTop;
                            used += v;
                            return (
                                <rect key={t.value} x={cx - barW / 2} y={yTop} width={barW} height={Math.max(0, h - 1)} rx="3" fill={FREQ_COLORS[t.value]}>
                                    <title>{`${it.label} · ${t.label}: ${v}`}</title>
                                </rect>
                            );
                        })}
                        {it.total > 0 && (
                            <text x={cx} y={y(it.total) - 7} textAnchor="middle" className="an-bar-val">{it.total}</text>
                        )}
                        {showLabel && <text x={cx} y={H - 12} textAnchor="middle" className={`an-axis ${small ? 'sm' : ''}`}>{it.label}</text>}
                    </g>
                );
            })}
        </svg>
    );
};

const Legend = ({ items }) => (
    <div className="an-legend">
        {items.map(i => (
            <span key={i.label}><i style={{ background: i.color }} /> {i.label}</span>
        ))}
    </div>
);

const Kpi = ({ label, value, sub, color }) => (
    <div className={`an-kpi ${color || ''}`}>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{sub}</small>
    </div>
);

const RateRow = ({ label, value, color }) => (
    <div className="an-rate">
        <div className="an-rate-head"><span>{label}</span><strong>{value}%</strong></div>
        <div className="an-bar"><div style={{ width: `${Math.min(100, value)}%`, background: color }} /></div>
    </div>
);

/* ---------- page ---------- */

const SmeAnalytics = () => {
    const today = todayStr();

    const [tab, setTab] = useState('creative');
    const [period, setPeriod] = useState(6);
    const [companyId, setCompanyId] = useState('all');
    const [showCounts, setShowCounts] = useState(false);
    const [showTotals, setShowTotals] = useState(true);
    const [chartView, setChartView] = useState('bar');
    const [barStatus, setBarStatus] = useState('all');
    const [trendMetric, setTrendMetric] = useState('all');
    const [platformStatus, setPlatformStatus] = useState('all');

    // Task SOP tab filters
    const [sopFreq, setSopFreq] = useState('all');
    const [sopId, setSopId] = useState('all');
    const [sopPeriod, setSopPeriod] = useState(6);
    const [dayRange, setDayRange] = useState(14);
    const [sopState, setSopState] = useState('all');

    const [companies, setCompanies] = useState([]);
    const [creatives, setCreatives] = useState([]);
    const [meetings, setMeetings] = useState([]);
    const [sops, setSops] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const [c, cr, m, s, t] = await Promise.all([
                    api.get('/sme/companies'),
                    api.get('/sme/creatives'),
                    api.get('/sme/meetings'),
                    api.get('/sme/sop-assignments', { params: { today } }),
                    api.get('/sme/tasks')
                ]);
                if (cancelled) return;
                setCompanies(c.data.companies || []);
                setCreatives((cr.data.creatives || []).map(x => enrich(x, today)));
                setMeetings(m.data.meetings || []);
                setSops(s.data.assignments || []);
                setTasks(t.data.tasks || []);
            } catch (err) {
                if (!cancelled) setError(errMsg(err));
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [today]);

    // window start (first day of the month, N-1 months back); '' = all time
    const startStr = useMemo(() => {
        if (!period) return '';
        const now = parseYmd(today);
        return ymd(new Date(now.getFullYear(), now.getMonth() - (period - 1), 1));
    }, [period, today]);

    const inCompany = (id) => companyId === 'all' || String(id) === companyId;

    const cList = useMemo(
        () => creatives.filter(c => inCompany(c.companyId) && (!startStr || c.date >= startStr)),
        [creatives, companyId, startStr] // eslint-disable-line react-hooks/exhaustive-deps
    );
    const stats = useMemo(() => summarize(cList), [cList]);

    const months = useMemo(() => {
        const now = parseYmd(today);
        const nowKey = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
        const keys = cList.map(c => c.month);
        let first = startStr ? startStr.slice(0, 7) : (keys.length ? keys.reduce((a, b) => (a < b ? a : b)) : nowKey);
        let last = keys.length ? keys.reduce((a, b) => (a > b ? a : b)) : nowKey;
        if (last < nowKey) last = nowKey;
        if (first > nowKey) first = nowKey;

        const out = [];
        let [y, m] = first.split('-').map(Number);
        const [ly, lm] = last.split('-').map(Number);
        while ((y < ly || (y === ly && m <= lm)) && out.length < 24) {
            const key = `${y}-${pad(m)}`;
            const inMonth = cList.filter(c => c.month === key);
            const s = summarize(inMonth);
            out.push({
                key,
                total: s.total,
                approved: s.approved,
                pending: s.pending,
                revisionCount: s.revision,
                approval: s.total ? pct(s.approved, s.total) : null,
                revision: s.total ? pct(s.revision, s.total) : null,
                rejection: s.total ? pct(s.rejected, s.total) : null
            });
            m += 1;
            if (m > 12) { m = 1; y += 1; }
        }
        return out;
    }, [cList, startStr, today]);

    const barMonths = useMemo(() => months.map(m => {
        const approved = barStatus === 'all' || barStatus === 'approved' ? m.approved : 0;
        const pending = barStatus === 'all' || barStatus === 'pending' ? m.pending : 0;
        const revisionCount = barStatus === 'all' || barStatus === 'revision' ? m.revisionCount : 0;
        return { ...m, approved, pending, revisionCount, total: approved + pending + revisionCount };
    }), [months, barStatus]);

    const platformRows = useMemo(() => PLATFORMS.map(p => {
        const list = cList.filter(c => (c.contentPillar?.platforms || []).includes(p.key));
        const s = summarize(list);
        const shown = platformStatus === 'all' ? s.total : s[platformStatus];
        return { ...p, total: s.total, approved: s.approved, pending: s.pending, revision: s.revision, shown };
    }).filter(p => p.shown > 0), [cList, platformStatus]);
    const platformMax = Math.max(1, ...platformRows.map(p => p.shown));

    // scheduled creatives (planned date today or later) in the next 4 weeks, weeks end on Sunday
    const weeks = useMemo(() => {
        const base = parseYmd(today);
        const toSunday = (7 - base.getDay()) % 7;
        const ends = [0, 1, 2, 3].map(i => {
            const e = new Date(base);
            e.setDate(base.getDate() + toSunday + i * 7);
            return ymd(e);
        });
        const labels = ['This week', 'Next week', 'In 2 weeks', 'In 3 weeks'];
        const pool = creatives.filter(c => inCompany(c.companyId) && c.status !== 'rejected');
        return labels.map((label, i) => {
            const from = i === 0 ? today : ymd(new Date(parseYmd(ends[i - 1]).getTime() + 86400000 * 1.5));
            const count = pool.filter(c => c.date >= from && c.date <= ends[i]).length;
            return { label, count };
        });
    }, [creatives, companyId, today]); // eslint-disable-line react-hooks/exhaustive-deps

    const meetingStats = useMemo(() => {
        const now = new Date();
        const list = meetings.filter(m => inCompany(m.company?.id) && (!startStr || m.date >= startStr));
        let done = 0, notDone = 0, upcoming = 0;
        list.forEach(m => {
            const at = new Date(`${m.date}T${m.time || '00:00'}`);
            if (at >= now) upcoming += 1;
            else if (m.joined) done += 1;
            else notDone += 1;
        });
        return { total: list.length, done, notDone, upcoming };
    }, [meetings, companyId, startStr]); // eslint-disable-line react-hooks/exhaustive-deps

    /* ----- Task SOP tab ----- */
    const sopStart = useMemo(() => {
        if (!sopPeriod) return '';
        const now = parseYmd(today);
        return ymd(new Date(now.getFullYear(), now.getMonth() - (sopPeriod - 1), 1));
    }, [sopPeriod, today]);

    const sopScope = useMemo(
        () => sops.filter(s => inCompany(s.company?.id)),
        [sops, companyId] // eslint-disable-line react-hooks/exhaustive-deps
    );

    const sopOptions = useMemo(() => {
        const list = sopScope.filter(s => sopFreq === 'all' || s.type === sopFreq);
        return [
            { value: 'all', label: `All SOPs (${list.length})` },
            ...list.map(s => ({ value: String(s.id), label: `${s.text} — ${s.company?.name || ''}` }))
        ];
    }, [sopScope, sopFreq]);
    const sopPick = sopOptions.some(o => o.value === sopId) ? sopId : 'all';

    const sopView = useMemo(
        () => sopScope.filter(s => (sopFreq === 'all' || s.type === sopFreq) && (sopPick === 'all' || String(s.id) === sopPick)),
        [sopScope, sopFreq, sopPick]
    );

    const sopData = useMemo(() => {
        const base = parseYmd(today);
        const active = sopView.filter(s => s.active);
        const done = active.filter(s => s.done).length;
        const pending = active.length - done;
        const counts = {};
        SOP_TYPES.forEach(t => { counts[t.value] = sopView.filter(s => s.type === t.value).length; });

        const ticks = [];
        sopView.forEach(s => (s.completions || []).forEach(c => {
            if (!c.at) return;
            const day = ymd(new Date(c.at));
            ticks.push({ sopId: String(s.id), day, month: day.slice(0, 7), type: s.type, company: String(s.company?.id || ''), at: c.at });
        }));
        const inPeriod = ticks.filter(t => !sopStart || t.day >= sopStart);

        const weekAgo = ymd(new Date(base.getFullYear(), base.getMonth(), base.getDate() - 6));
        const last7 = ticks.filter(t => t.day >= weekAgo && t.day <= today).length;

        const byFreq = SOP_TYPES
            .filter(t => sopFreq === 'all' || t.value === sopFreq)
            .map(t => {
                const list = active.filter(s => s.type === t.value);
                return { ...t, total: list.length, done: list.filter(s => s.done).length };
            });

        // ticks per month, by frequency
        const nowKey = today.slice(0, 7);
        const keys = inPeriod.map(t => t.month);
        let first = sopStart ? sopStart.slice(0, 7) : (keys.length ? keys.reduce((a, b) => (a < b ? a : b)) : nowKey);
        if (first > nowKey) first = nowKey;
        const monthItems = [];
        let [my, mm] = first.split('-').map(Number);
        const [ny, nm] = nowKey.split('-').map(Number);
        while ((my < ny || (my === ny && mm <= nm)) && monthItems.length < 24) {
            const key = `${my}-${pad(mm)}`;
            const values = {};
            SOP_TYPES.forEach(t => { values[t.value] = inPeriod.filter(x => x.month === key && x.type === t.value).length; });
            monthItems.push({ key, label: monthLabel(key), values, total: Object.values(values).reduce((a, b) => a + b, 0) });
            mm += 1;
            if (mm > 12) { mm = 1; my += 1; }
        }

        // ticks per day, last N days
        const dayItems = [];
        for (let i = dayRange - 1; i >= 0; i -= 1) {
            const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() - i);
            const key = ymd(d);
            const values = {};
            SOP_TYPES.forEach(t => { values[t.value] = ticks.filter(x => x.day === key && x.type === t.value).length; });
            dayItems.push({
                key,
                label: `${d.getDate()} ${d.toLocaleDateString('en-US', { month: 'short' })}`,
                values,
                total: Object.values(values).reduce((a, b) => a + b, 0)
            });
        }

        const byCompany = companies
            .filter(c => inCompany(c.id))
            .map(c => ({ id: c.id, name: c.name, ticks: inPeriod.filter(t => t.company === String(c.id)).length }));

        return { active: active.length, done, pending, counts, inPeriod, last7, byFreq, monthItems, dayItems, byCompany, upcoming: sopView.length - active.length };
    }, [sopView, sopStart, sopFreq, dayRange, companies, today, companyId]); // eslint-disable-line react-hooks/exhaustive-deps

    const sopRows = useMemo(() => sopView.map(s => {
        const own = (s.completions || []).filter(c => c.at && (!sopStart || ymd(new Date(c.at)) >= sopStart));
        const last = own.reduce((a, c) => (!a || new Date(c.at) > new Date(a) ? c.at : a), '');
        const state = !s.active ? 'upcoming' : s.done ? 'done' : 'pending';
        return { ...s, ticks: own.length, last, state };
    }).filter(r => sopState === 'all' || r.state === sopState), [sopView, sopStart, sopState]);

    const sopSlices = [
        { key: 'done', label: 'Done', value: sopData.done, color: COLORS.approved },
        { key: 'pending', label: 'Pending', value: sopData.pending, color: COLORS.pending }
    ];
    const companyMax = Math.max(1, ...sopData.byCompany.map(c => c.ticks));

    const taskList = useMemo(
        () => tasks.filter(t => inCompany(t.company?._id || t.company) && (!sopStart || (t.createdAt || '').slice(0, 10) >= sopStart)),
        [tasks, companyId, sopStart] // eslint-disable-line react-hooks/exhaustive-deps
    );
    const taskStats = useMemo(() => {
        const completed = taskList.filter(t => t.status === 'completed');
        const durations = completed.filter(t => t.startedAt && t.endedAt).map(t => new Date(t.endedAt) - new Date(t.startedAt));
        const avgMs = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
        const hours = avgMs / 3600000;
        return {
            total: taskList.length,
            new: taskList.filter(t => t.status === 'new').length,
            progress: taskList.filter(t => t.status === 'in-progress').length,
            completed: completed.length,
            recurring: taskList.filter(t => t.category === 'recurring').length,
            avg: !durations.length ? '--' : hours >= 24 ? `${(hours / 24).toFixed(1)}d` : `${hours.toFixed(1)}h`
        };
    }, [taskList]);

    const statusSlices = [
        { key: 'approved', label: 'Approved', value: stats.approved, color: COLORS.approved },
        { key: 'pending', label: 'Pending', value: stats.pending, color: COLORS.pending },
        { key: 'revision', label: 'Revision', value: stats.revision, color: COLORS.revision }
    ];
    const meetingMax = Math.max(1, meetingStats.done, meetingStats.notDone, meetingStats.upcoming);

    return (
        <div className="dashboard-content scrollable">
            <div className="page-header">
                <div>
                    <span className="page-label">SME WORKSPACE</span>
                    <h1>{tab === 'creative' ? 'Creative Analytics' : 'Task SOP Analytics'}</h1>
                    <p>{tab === 'creative'
                        ? 'Track approvals, revisions, rejections, delays, overdue and workload across your assigned companies.'
                        : 'Track daily, weekly and monthly SOP completion across your assigned companies.'}</p>
                </div>
            </div>

            <div className="an-filters">
                <AnSelect
                    label="Company"
                    value={companyId}
                    onChange={setCompanyId}
                    options={[{ value: 'all', label: 'All companies' }, ...companies.map(c => ({ value: c.id, label: c.name }))]}
                />
                {tab === 'creative' ? (
                    <AnSelect label="Period" value={period} onChange={setPeriod} options={PERIODS} />
                ) : (
                    <>
                        <AnSelect label="Task SOP" value={sopPick} onChange={setSopId} options={sopOptions} />
                        <AnSelect label="Period" value={sopPeriod} onChange={setSopPeriod} options={PERIODS} />
                        <AnSelect label="Frequency" value={sopFreq} onChange={setSopFreq} options={FREQ_OPTS} />
                    </>
                )}
            </div>

            <div className="an-tabs">
                <button type="button" className={tab === 'creative' ? 'active' : ''} onClick={() => setTab('creative')}>Creative Analytics</button>
                <button type="button" className={tab === 'task' ? 'active' : ''} onClick={() => setTab('task')}>Task SOP Analytics</button>
            </div>

            {error && <div className="an-error"><AlertCircle size={16} /> {error}</div>}
            {loading && <p className="an-loading">Loading analytics...</p>}

            {!loading && !error && tab === 'creative' && (
                <>
                    <div className="an-kpis">
                        <Kpi label="Total Creatives" value={stats.total} sub="All creatives in view" color="purple" />
                        <Kpi label="Approved" value={stats.approved} sub={`${pct(stats.approved, stats.total)}% approval rate`} color="green" />
                        <Kpi label="Pending" value={stats.pending} sub="Waiting for admin" color="blue" />
                        <Kpi label="Revision" value={stats.revision} sub={`${pct(stats.revision, stats.total)}% revision rate`} color="orange" />
                        <Kpi label="Rejected" value={stats.rejected} sub={`${pct(stats.rejected, stats.total)}% rejection rate`} color="red" />
                        <Kpi label="Delays" value={stats.delays} sub={`${pct(stats.delays, stats.total)}% submitted late`} color="orange" />
                        <Kpi label="Overdue" value={stats.overdue} sub={`${pct(stats.overdue, stats.total)}% still pending past date`} color="red" />
                    </div>

                    <div className="an-row two">
                        <section className="an-card">
                            <h2>Status Breakdown</h2>
                            <div className="an-breakdown">
                                <Donut slices={statusSlices} total={stats.total} />
                                <ul className="an-list">
                                    {[...statusSlices, { key: 'rejected', label: 'Rejected', value: stats.rejected, color: COLORS.rejected }].map(s => (
                                        <li key={s.key}>
                                            <i style={{ background: s.color }} />
                                            <span>{s.label}</span>
                                            <strong>{s.value} · {pct0(s.value, stats.total)}%</strong>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <p className="an-note">Rejected counts every creative the admin has rejected at least once, including ones already redone.</p>
                        </section>

                        <section className="an-card">
                            <h2>Performance Rates</h2>
                            <RateRow label="Approval rate" value={pct(stats.approved, stats.total)} color={COLORS.approved} />
                            <RateRow label="Revision rate" value={pct(stats.revision, stats.total)} color={COLORS.revision} />
                            <RateRow label="Rejection rate" value={pct(stats.rejected, stats.total)} color={COLORS.rejected} />
                            <RateRow label="Delay rate" value={pct(stats.delays, stats.total)} color="#f0b66b" />
                            <RateRow label="Overdue rate" value={pct(stats.overdue, stats.total)} color="#ff8998" />
                        </section>
                    </div>

                    <section className="an-card">
                        <div className="an-card-head">
                            {chartView === 'bar' ? (
                                <h2>Creatives per Month <small>by status</small></h2>
                            ) : (
                                <h2>Approval vs Redo Trend <small>% of each month's creatives</small></h2>
                            )}
                            <div className="an-card-tools">
                                {chartView === 'bar' ? (
                                    <>
                                        <AnSelect size="sm" align="right" value={barStatus} onChange={setBarStatus} options={STATUS_OPTS} />
                                        <button type="button" className={`an-toggle ${showTotals ? 'on' : ''}`} onClick={() => setShowTotals(v => !v)}>
                                            {showTotals ? 'Hide totals' : 'Show totals'}
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <AnSelect size="sm" align="right" value={trendMetric} onChange={setTrendMetric} options={METRIC_OPTS} />
                                        <button type="button" className={`an-toggle ${showCounts ? 'on' : ''}`} onClick={() => setShowCounts(v => !v)}>
                                            {showCounts ? 'Hide monthly counts' : 'Show monthly counts'}
                                        </button>
                                    </>
                                )}
                                <div className="an-switch" role="tablist" aria-label="Chart view">
                                    <button type="button" role="tab" aria-selected={chartView === 'bar'} className={chartView === 'bar' ? 'active' : ''} onClick={() => setChartView('bar')}>Monthly</button>
                                    <button type="button" role="tab" aria-selected={chartView === 'trend'} className={chartView === 'trend' ? 'active' : ''} onClick={() => setChartView('trend')}>Trend</button>
                                </div>
                            </div>
                        </div>
                        {chartView === 'bar' ? (
                            <>
                                <BarChart months={barMonths} showTotals={showTotals} />
                                <Legend items={[
                                    { label: 'Approved', color: COLORS.approved },
                                    { label: 'Pending', color: COLORS.pending },
                                    { label: 'Revision', color: COLORS.revision }
                                ].filter(i => barStatus === 'all' || i.label.toLowerCase() === barStatus)} />
                            </>
                        ) : (
                            <>
                                <LineChart months={months} showCounts={showCounts} metric={trendMetric} />
                                <Legend items={[
                                    { key: 'approval', label: 'Approval %', color: COLORS.approved },
                                    { key: 'revision', label: 'Revision %', color: COLORS.revision },
                                    { key: 'rejection', label: 'Rejection %', color: COLORS.rejected }
                                ].filter(i => trendMetric === 'all' || i.key === trendMetric)} />
                            </>
                        )}
                    </section>

                    <section className="an-card">
                        <div className="an-card-head">
                            <h2>Creatives by Platform</h2>
                            <AnSelect size="sm" align="right" value={platformStatus} onChange={setPlatformStatus} options={STATUS_OPTS} />
                        </div>
                        {platformRows.length === 0 ? (
                            <p className="an-empty">No creatives in this view.</p>
                        ) : platformRows.map(p => {
                            const Icon = p.icon;
                            return (
                                <div key={p.key} className="an-platform">
                                    <span className="an-platform-name"><Icon size={14} /> {p.label}</span>
                                    <div className="an-stack" style={{ width: `${(p.shown / platformMax) * 100}%` }}>
                                        {['approved', 'pending', 'revision'].filter(k => platformStatus === 'all' || k === platformStatus).map(k => p[k] > 0 && (
                                            <div key={k} style={{ flex: p[k], background: COLORS[k] }} title={`${k}: ${p[k]}`} />
                                        ))}
                                    </div>
                                    <strong>{p.shown}</strong>
                                </div>
                            );
                        })}
                        <Legend items={[
                            { label: 'Approved', color: COLORS.approved },
                            { label: 'Pending', color: COLORS.pending },
                            { label: 'Revision', color: COLORS.revision }
                        ].filter(i => platformStatus === 'all' || i.label.toLowerCase() === platformStatus)} />
                    </section>

                    <section className="an-card">
                        <h2>Workload &amp; Meetings</h2>
                        <div className="an-row two inner">
                            <div>
                                <h3>Scheduled creatives, next 4 weeks</h3>
                                <div className="an-weeks">
                                    {weeks.map(w => (
                                        <div key={w.label}>
                                            <span>{w.label}</span>
                                            <strong>{w.count}</strong>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <h3>Meetings</h3>
                                <p className="an-big">{meetingStats.total}<small> meetings</small></p>
                                {[
                                    { label: 'Done', value: meetingStats.done, color: COLORS.approved },
                                    { label: 'Not done', value: meetingStats.notDone, color: COLORS.rejected },
                                    { label: 'Upcoming', value: meetingStats.upcoming, color: COLORS.pending }
                                ].map(r => (
                                    <div key={r.label} className="an-rate">
                                        <div className="an-rate-head"><span>{r.label}</span><strong>{r.value}</strong></div>
                                        <div className="an-bar"><div style={{ width: `${(r.value / meetingMax) * 100}%`, background: r.color }} /></div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>
                </>
            )}

            {!loading && !error && tab === 'task' && (
                <>
                    <div className="an-kpis">
                        <Kpi label="Done Now" value={sopData.done} sub="Ticked for the current day / week / month" color="green" />
                        <Kpi label="Pending Now" value={sopData.pending} sub="Still to tick" color="orange" />
                        <Kpi label="Completion" value={`${pct0(sopData.done, sopData.active)}%`} sub="Of current SOPs ticked" color="purple" />
                        <Kpi label="Ticks Saved" value={sopData.inPeriod.length} sub="In the selected period" color="blue" />
                        <Kpi label="Last 7 Days" value={sopData.last7} sub="Ticks saved" color="blue" />
                    </div>

                    <div className="an-row two">
                        <section className="an-card">
                            <h2>Done vs Pending <small className="an-sub">current day / week / month</small></h2>
                            <div className="an-breakdown">
                                <Donut slices={sopSlices} total={sopData.active} unit="SOPs" />
                                <ul className="an-list">
                                    <li className="an-list-head"><span>{sopData.done}/{sopData.active} done now</span></li>
                                    {sopSlices.map(sl => (
                                        <li key={sl.key}>
                                            <i style={{ background: sl.color }} />
                                            <span>{sl.label}</span>
                                            <strong>{sl.value}</strong>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            {sopData.upcoming > 0 && (
                                <p className="an-note">{sopData.upcoming} SOP(s) have a start date in the future and are not counted yet.</p>
                            )}
                        </section>

                        <section className="an-card">
                            <h2>Progress by Frequency</h2>
                            {sopData.byFreq.map(t => (
                                <RateRow
                                    key={t.value}
                                    label={`${t.label} (${PERIOD_WORD[t.value]}) ${t.done}/${t.total}`}
                                    value={pct0(t.done, t.total)}
                                    color={FREQ_COLORS[t.value]}
                                />
                            ))}
                        </section>
                    </div>

                    <section className="an-card">
                        <div className="an-card-head">
                            <h2>SOP Ticks per Month <small>by frequency</small></h2>
                        </div>
                        <TickBars items={sopData.monthItems} ariaLabel="SOP ticks per month by frequency" />
                        <Legend items={SOP_TYPES.map(t => ({ label: t.label, color: FREQ_COLORS[t.value] }))} />
                    </section>

                    <div className="an-row two">
                        <section className="an-card">
                            <div className="an-card-head">
                                <h2>{`Last ${dayRange} Days`} <small>ticks saved per day</small></h2>
                                <AnSelect size="sm" align="right" value={dayRange} onChange={setDayRange} options={DAY_RANGES} />
                            </div>
                            <TickBars items={sopData.dayItems} labelEvery={dayRange > 14 ? 3 : 1} W={460} small color={TICK_COLOR} ariaLabel="SOP ticks saved per day" />
                        </section>

                        <section className="an-card">
                            <h2>Ticks by Company</h2>
                            {sopData.byCompany.length === 0 ? (
                                <p className="an-empty">No companies in this view.</p>
                            ) : sopData.byCompany.map(c => (
                                <div key={c.id} className="an-company-row">
                                    <span className="an-company-name" title={c.name}>{c.name}</span>
                                    <div className="an-track"><div style={{ width: `${(c.ticks / companyMax) * 100}%` }} /></div>
                                    <strong>{c.ticks}</strong>
                                </div>
                            ))}
                        </section>
                    </div>

                    <section className="an-card">
                        <div className="an-card-head">
                            <h2>All SOPs <small>{sopRows.length} in view</small></h2>
                            <AnSelect size="sm" align="right" value={sopState} onChange={setSopState} options={SOP_STATE_OPTS} />
                        </div>
                        {sopRows.length === 0 ? (
                            <p className="an-empty">No SOPs match these filters.</p>
                        ) : (
                            <ul className="an-sop-list">
                                {sopRows.map(r => (
                                    <li key={r.id}>
                                        <div className="an-sop-main">
                                            <strong>{r.text}</strong>
                                            <small>
                                                {r.company?.name} · {typeLabel(r.type)} · {r.ticks} {r.ticks === 1 ? 'tick' : 'ticks'} ·{' '}
                                                {r.last ? `last ${fmtDateTime(r.last)}` : 'never ticked in this period'}
                                            </small>
                                        </div>
                                        <span className={`an-pill ${r.state}`}>
                                            {r.state === 'upcoming' ? `Starts ${fmtDay(r.date)}` : r.state === 'done' ? `Done ${PERIOD_WORD[r.type]}` : `Pending ${PERIOD_WORD[r.type]}`}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>

                    <h2 className="an-section-title">Tasks</h2>
                    <div className="an-kpis">
                        <Kpi label="Tasks" value={taskStats.total} sub={`${taskStats.recurring} recurring`} color="purple" />
                        <Kpi label="Tasks Completed" value={taskStats.completed} sub={`${pct(taskStats.completed, taskStats.total)}% completion rate`} color="green" />
                        <Kpi label="Avg. Task Time" value={taskStats.avg} sub="Start to end, completed tasks" color="blue" />
                    </div>
                    <section className="an-card">
                        <h2>Tasks by Status</h2>
                        <RateRow label={`New (${taskStats.new})`} value={pct(taskStats.new, taskStats.total)} color={COLORS.pending} />
                        <RateRow label={`In progress (${taskStats.progress})`} value={pct(taskStats.progress, taskStats.total)} color={COLORS.revision} />
                        <RateRow label={`Completed (${taskStats.completed})`} value={pct(taskStats.completed, taskStats.total)} color={COLORS.approved} />
                    </section>
                </>
            )}
        </div>
    );
};

export default SmeAnalytics;
