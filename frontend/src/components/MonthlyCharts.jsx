/*
  Charts for the bottom of the monthly report. Hand-drawn SVG (same approach as the Analytics page,
  no chart library), coloured for the light printable report.
*/

const C = {
    approved: '#1f9d6b', pending: '#e0a020', redo: '#8b5cf6', rejected: '#e5484d',
    thisMonth: '#0a4633', lastMonth: '#c9a24a', blue: '#3b82f6', pink: '#ec4899',
    ink: '#1b2a24', muted: '#7a857f', grid: '#e3e8e5', track: '#eef3f0'
};
const PLATFORM_LABEL = { instagram: 'Instagram', facebook: 'Facebook', linkedin: 'LinkedIn', x: 'X', youtube: 'YouTube' };

const compact = (v) => {
    if (v === null || v === undefined) return '';
    const a = Math.abs(v);
    if (a >= 1e6) return `${(v / 1e6).toFixed(1).replace(/\.0$/, '')}M`;
    if (a >= 1e3) return `${(v / 1e3).toFixed(1).replace(/\.0$/, '')}K`;
    return String(v);
};
const exact = (v) => Number(v).toLocaleString('en-IN');
const niceMax = (max) => {
    if (max <= 0) return 4;
    const pow = 10 ** Math.floor(Math.log10(max));
    const n = max / pow;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
};
const clip = (t, n) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);

const Legend = ({ items }) => (
    <ul className="mr-legend">
        {items.map(i => <li key={i.label}><i style={{ background: i.color }} />{i.label}{i.value !== undefined && <strong>{i.value}</strong>}</li>)}
    </ul>
);

const Card = ({ title, sub, children }) => (
    <div className="mr-chart">
        <h3>{title}</h3>
        {sub && <p>{sub}</p>}
        {children}
    </div>
);
const Empty = ({ text = 'No data for this month' }) => <div className="mr-chart-empty">{text}</div>;

/* ---- donut ---- */
const Donut = ({ slices, center, sub }) => {
    const total = slices.reduce((a, s) => a + s.value, 0);
    const R = 52, W = 22, CIRC = 2 * Math.PI * R;
    let off = 0;
    return (
        <svg viewBox="0 0 150 150" className="mr-donut" role="img" aria-label={sub}>
            <circle cx="75" cy="75" r={R} fill="none" stroke={C.track} strokeWidth={W} />
            {total > 0 && slices.filter(s => s.value > 0).map(s => {
                const len = (s.value / total) * CIRC;
                const el = (
                    <circle key={s.label} cx="75" cy="75" r={R} fill="none" stroke={s.color} strokeWidth={W}
                        strokeDasharray={`${len} ${CIRC - len}`} strokeDashoffset={-off} transform="rotate(-90 75 75)" />
                );
                off += len;
                return el;
            })}
            <text x="75" y="76" textAnchor="middle" className="mr-donut-num">{center}</text>
            <text x="75" y="92" textAnchor="middle" className="mr-donut-sub">{sub}</text>
        </svg>
    );
};

/* ---- vertical grouped bars ---- */
const GroupedBars = ({ groups, series }) => {
    const W = 420, H = 230, L = 38, R = 10, T = 16, B = 40;
    const max = niceMax(Math.max(0, ...groups.flatMap(g => g.values.map(v => v || 0))));
    const y = (v) => T + (H - T - B) * (1 - v / max);
    const slot = (W - L - R) / groups.length;
    const bw = Math.min(26, (slot * 0.72) / series.length);
    return (
        <svg viewBox={`0 0 ${W} ${H}`} className="mr-svg" role="img">
            {[0, 1, 2, 3, 4].map(i => {
                const v = (max / 4) * i;
                return (
                    <g key={i}>
                        <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke={C.grid} />
                        <text x={L - 6} y={y(v) + 3} textAnchor="end" className="mr-ax">{compact(Math.round(v))}</text>
                    </g>
                );
            })}
            {groups.map((g, gi) => {
                const cx = L + slot * gi + slot / 2;
                const x0 = cx - (bw * series.length) / 2;
                return (
                    <g key={g.label}>
                        {g.values.map((v, si) => (v === null || v === undefined ? null : (
                            <g key={si}>
                                <rect x={x0 + si * bw} y={y(v)} width={bw - 2} height={Math.max(0, H - B - y(v))} rx="3" fill={series[si].color} />
                                <text x={x0 + si * bw + (bw - 2) / 2} y={y(v) - 4} textAnchor="middle" className="mr-val">{exact(v)}</text>
                            </g>
                        )))}
                        <text x={cx} y={H - B + 16} textAnchor="middle" className="mr-ax">{g.label}</text>
                    </g>
                );
            })}
        </svg>
    );
};

/* ---- horizontal stacked bars (one row per company / platform) ---- */
const StackedRows = ({ rows, parts }) => {
    const LABEL = 118, W = 420, RIGHT = 34, ROW = 30;
    const H = rows.length * ROW + 8;
    const max = niceMax(Math.max(1, ...rows.map(r => parts.reduce((a, p) => a + (r[p.key] || 0), 0))));
    const scale = (W - LABEL - RIGHT) / max;
    return (
        <svg viewBox={`0 0 ${W} ${H}`} className="mr-svg" role="img">
            {rows.map((r, i) => {
                let x = LABEL;
                const total = parts.reduce((a, p) => a + (r[p.key] || 0), 0);
                return (
                    <g key={r.label} transform={`translate(0 ${i * ROW + 4})`}>
                        <text x={LABEL - 8} y="14" textAnchor="end" className="mr-ax mr-ink">{clip(r.label, 18)}</text>
                        <rect x={LABEL} y="3" width={W - LABEL - RIGHT} height="16" rx="4" fill={C.track} />
                        {parts.map(p => {
                            const w = (r[p.key] || 0) * scale;
                            const el = w > 0 ? <rect key={p.key} x={x} y="3" width={w} height="16" fill={p.color} /> : null;
                            x += w;
                            return el;
                        })}
                        <text x={W - RIGHT + 6} y="15" className="mr-val mr-left-anchor">{total}</text>
                    </g>
                );
            })}
        </svg>
    );
};

/* ---- line with points ---- */
const Line = ({ labels, values, color }) => {
    const W = 420, H = 210, L = 44, R = 18, T = 20, B = 36;
    const vals = values.filter(v => v !== null && v !== undefined);
    const lo = vals.length ? Math.min(...vals) : 0;
    const hi = vals.length ? Math.max(...vals) : 1;
    const pad = (hi - lo) * 0.25 || Math.max(1, hi * 0.2);
    const min = Math.max(0, lo - pad), max = hi + pad;
    const x = (i) => L + ((W - L - R) * (labels.length === 1 ? 0.5 : i / (labels.length - 1)));
    const y = (v) => T + (H - T - B) * (1 - (v - min) / (max - min));
    let d = '', pen = false;
    values.forEach((v, i) => {
        if (v === null || v === undefined) { pen = false; return; }
        d += `${pen ? 'L' : 'M'}${x(i)} ${y(v)} `;
        pen = true;
    });
    return (
        <svg viewBox={`0 0 ${W} ${H}`} className="mr-svg" role="img">
            {[0, 1, 2, 3].map(i => {
                const v = min + ((max - min) / 3) * i;
                return (
                    <g key={i}>
                        <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke={C.grid} />
                        <text x={L - 6} y={y(v) + 3} textAnchor="end" className="mr-ax">{compact(Math.round(v))}</text>
                    </g>
                );
            })}
            {d && <path d={d} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" />}
            {values.map((v, i) => (v === null || v === undefined ? null : (
                <g key={i}>
                    <circle cx={x(i)} cy={y(v)} r="4.5" fill="#fff" stroke={color} strokeWidth="2.5" />
                    <text x={x(i)} y={y(v) - 10} textAnchor="middle" className="mr-val">{exact(v)}</text>
                </g>
            )))}
            {labels.map((l, i) => <text key={l} x={x(i)} y={H - B + 18} textAnchor="middle" className="mr-ax">{l}</text>)}
        </svg>
    );
};

const PARTS = [
    { key: 'approved', color: C.approved }, { key: 'pending', color: C.pending }, { key: 'redo', color: C.redo }
];
const PART_LEGEND = [
    { label: 'Approved', color: C.approved }, { label: 'Pending', color: C.pending }, { label: 'Redo', color: C.redo }
];

/* Each chart is its own block so the report can place it right under its table. */

export const StatusChart = ({ r }) => {
    const s = r.stats;
    const slices = [
        { label: 'Approved', value: s.approved, color: C.approved },
        { label: 'Pending', value: s.pending, color: C.pending },
        { label: 'Redo', value: s.redo, color: C.redo }
    ];
    return (
        <div className="mr-charts one">
            <Card title="Creative status" sub={`${r.month}`}>
                {s.total > 0 ? (
                    <div className="mr-donut-row">
                        <Donut slices={slices} center={s.total} sub="creatives" />
                        <Legend items={slices} />
                    </div>
                ) : <Empty />}
            </Card>
        </div>
    );
};

export const CompareChart = ({ r }) => {
    const s = r.stats, p = r.previousStats;
    const groups = [
        ['Total', 'total'], ['Approved', 'approved'], ['Pending', 'pending'], ['Redo', 'redo'], ['Delays', 'delays'], ['Overdue', 'overdue']
    ].map(([label, k]) => ({ label, values: [p[k], s[k]] }));
    return (
        <div className="mr-charts one">
            <Card title="This month vs last month" sub="Creative counts">
                {s.total > 0 || p.total > 0 ? (
                    <>
                        <GroupedBars groups={groups} series={[{ color: C.lastMonth }, { color: C.thisMonth }]} />
                        <Legend items={[{ label: r.previousMonth, color: C.lastMonth }, { label: r.month, color: C.thisMonth }]} />
                    </>
                ) : <Empty />}
            </Card>
        </div>
    );
};

export const CompanyChart = ({ r }) => {
    const rows = r.companyReports.filter(c => c.total > 0)
        .map(c => ({ label: c.name, approved: c.approved, pending: c.pending, redo: c.redo }));
    return (
        <div className="mr-charts one">
            <Card title="Company-wise creatives" sub="Approved, pending and redo per company">
                {rows.length ? (<><StackedRows rows={rows} parts={PARTS} /><Legend items={PART_LEGEND} /></>) : <Empty />}
            </Card>
        </div>
    );
};

export const PlatformChart = ({ r }) => {
    const rows = r.platformReports
        .map(x => ({ label: PLATFORM_LABEL[x.platform] || x.platform, approved: x.approved, pending: x.pending, redo: x.redo }));
    return (
        <div className="mr-charts one">
            <Card title="Platform-wise creatives" sub="A creative on several platforms counts for each">
                {rows.length ? (<><StackedRows rows={rows} parts={PARTS} /><Legend items={PART_LEGEND} /></>) : <Empty />}
            </Card>
        </div>
    );
};

export const MeetingsChart = ({ r }) => {
    const m = r.meetingStats;
    return (
        <div className="mr-charts one">
            <Card title="Meetings" sub="Completed vs pending">
                {m.total > 0 ? (
                    <div className="mr-donut-row">
                        <Donut slices={[{ label: 'Completed', value: m.done, color: C.approved }, { label: 'Pending', value: m.notDone, color: C.pending }]} center={m.total} sub="meetings" />
                        <Legend items={[{ label: 'Completed', color: C.approved, value: m.done }, { label: 'Pending', color: C.pending, value: m.notDone }]} />
                    </div>
                ) : <Empty text="No meetings this month" />}
            </Card>
        </div>
    );
};

/* social = { labels, followers, reach, engagement, growth: { start, added, lost, end } } typed in on the page */

export const GrowthChart = ({ social, month }) => {
    const g = social.growth;
    const has = [g.start, g.added, g.lost, g.end].some(v => v !== null);
    return (
        <div className="mr-charts one">
            <Card title="Audience growth" sub={`${month} — followers movement`}>
                {has ? (
                    <GroupedBars
                        groups={[
                            { label: 'Started', values: [g.start] }, { label: 'New', values: [g.added] },
                            { label: 'Unfollowed', values: [g.lost] }, { label: 'Closing', values: [g.end] }
                        ]}
                        series={[{ color: C.thisMonth }]}
                    />
                ) : <Empty text="Enter the audience growth numbers" />}
            </Card>
        </div>
    );
};

export const OverviewCharts = ({ social }) => {
    const hasReach = social.reach.some(v => v !== null) || social.engagement.some(v => v !== null);
    return (
        <div className="mr-charts">
            <Card title="Followers — 3 months" sub="Total followers at the end of each month">
                {social.followers.some(v => v !== null) ? <Line labels={social.labels} values={social.followers} color={C.thisMonth} /> : <Empty text="Enter the 3-month overview" />}
            </Card>
            <Card title="Reach &amp; engagement — 3 months" sub="Accounts reached vs accounts engaged">
                {hasReach ? (
                    <>
                        <GroupedBars
                            groups={social.labels.map((label, i) => ({ label, values: [social.reach[i], social.engagement[i]] }))}
                            series={[{ color: C.blue }, { color: C.pink }]}
                        />
                        <Legend items={[{ label: 'Reach', color: C.blue }, { label: 'Engagement', color: C.pink }]} />
                    </>
                ) : <Empty text="Enter the 3-month overview" />}
            </Card>
        </div>
    );
};
