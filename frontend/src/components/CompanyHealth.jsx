import { useEffect, useMemo, useState } from 'react';
import api from '../api';
import { errMsg, todayStr } from '../sopUtils';
import '../styles/companyhealth.css';
import { Building2, Layers, CheckCircle2, Clock3, Search, Download, AlertCircle, HeartPulse } from 'lucide-react';

const HEALTH_LABELS = {
    healthy: 'Healthy',
    risk: 'Risk',
    critical: 'Critical'
};

const COLUMNS = [
    { key: 'total', label: 'Total' },
    { key: 'approved', label: 'Approved' },
    { key: 'pending', label: 'Pending' },
    { key: 'redo', label: 'Redo' },
    { key: 'rejected', label: 'Rejected' },
    { key: 'delays', label: 'Delays' },
    { key: 'overdue', label: 'Overdue' }
];

const csvCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

const CompanyHealth = () => {
    const [companies, setCompanies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');

    useEffect(() => {
        let cancelled = false;

        (async () => {
            try {
                const response = await api.get('/sme/company-health', { params: { today: todayStr() } });
                if (!cancelled) setCompanies(response.data.companies || []);
            } catch (err) {
                if (!cancelled) setError(errMsg(err));
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => { cancelled = true; };
    }, []);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return q ? companies.filter(c => c.name.toLowerCase().includes(q)) : companies;
    }, [companies, search]);

    const totals = useMemo(() => companies.reduce((sum, c) => ({
        total: sum.total + c.total,
        approved: sum.approved + c.approved,
        delays: sum.delays + c.delays
    }), { total: 0, approved: 0, delays: 0 }), [companies]);

    const exportCsv = () => {
        const header = ['Company', ...COLUMNS.map(c => c.label), 'Approval %', 'Health'];
        const rows = filtered.map(c => [
            c.name,
            ...COLUMNS.map(col => c[col.key]),
            `${c.approvalRate}%`,
            HEALTH_LABELS[c.health]
        ]);
        const csv = [header, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `company-health-${todayStr()}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    };

    const summary = [
        { label: 'Companies', value: companies.length, icon: Building2, color: 'purple' },
        { label: 'Total Creatives', value: totals.total, icon: Layers, color: 'blue' },
        { label: 'Approved', value: totals.approved, icon: CheckCircle2, color: 'green' },
        { label: 'Delays', value: totals.delays, icon: Clock3, color: 'orange' }
    ];

    return (
        <section className="ch-section">
            <div className="ch-header">
                <div className="ch-heading-icon"><HeartPulse size={22} /></div>
                <div>
                    <h2>Company Health</h2>
                    <p>Track creative approvals, delays and overdue work for each company</p>
                </div>
            </div>

            <div className="ch-summary">
                {summary.map(({ label, value, icon: Icon, color }) => (
                    <div key={label} className={`ch-summary-card ${color}`}>
                        <span className={`ch-summary-icon ${color}`}><Icon size={20} /></span>
                        <div>
                            <strong>{value}</strong>
                            <p>{label}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="ch-panel">
                <div className="ch-toolbar">
                    <label className="ch-search">
                        <Search size={16} />
                        <input
                            type="text"
                            value={search}
                            onChange={event => setSearch(event.target.value)}
                            placeholder="Search your companies..."
                        />
                    </label>
                    <button type="button" className="ch-export-btn" onClick={exportCsv} disabled={!filtered.length}>
                        <Download size={15} /> Export CSV
                    </button>
                </div>

                {error && (
                    <div className="tm-error"><AlertCircle size={16} /> {error}</div>
                )}

                <div className="ch-table-wrap">
                    <table className="ch-table">
                        <thead>
                            <tr>
                                <th>Company</th>
                                {COLUMNS.map(col => <th key={col.key}>{col.label}</th>)}
                                <th>Approval</th>
                                <th>Health</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={COLUMNS.length + 3} className="ch-empty">Loading company health...</td></tr>
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={COLUMNS.length + 3} className="ch-empty">
                                        {companies.length ? 'No companies match your search.' : 'No companies assigned yet.'}
                                    </td>
                                </tr>
                            ) : filtered.map(company => (
                                <tr key={company.id}>
                                    <td>
                                        <div className="ch-company">
                                            <span className="ch-avatar">{company.name.charAt(0).toUpperCase()}</span>
                                            <div>
                                                <strong>{company.name}</strong>
                                                <small>Company #{company.id.slice(-4).toUpperCase()}</small>
                                            </div>
                                        </div>
                                    </td>
                                    {COLUMNS.map(col => (
                                        <td key={col.key} className={company[col.key] ? `ch-num ch-${col.key}` : 'ch-num ch-zero'}>
                                            {company[col.key]}
                                        </td>
                                    ))}
                                    <td className="ch-num">{company.approvalRate}%</td>
                                    <td>
                                        <span className={`ch-health ${company.health}`}>
                                            {HEALTH_LABELS[company.health]}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </section>
    );
};

export default CompanyHealth;
