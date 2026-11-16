import { useEffect, useMemo, useState } from 'react';
import {
  FileBarChart, CalendarDays, Download, CheckCircle2, Clock3,
  RotateCcw, UploadCloud, Building2, TrendingUp, Palette,
  FileText, AlertCircle, RefreshCw, ChevronDown
} from 'lucide-react';
import api from '../api';
const currentMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};
const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};
const formatMonth = (value) => {
  if (!value) return '';
  const [year, month] = value.split('-');
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
};
const statusLabel = (status) => ({
  pending: 'Pending',
  submitted: 'Submitted',
  approved: 'Approved',
  redo: 'Redo'
}[status] || status || 'Pending');
const DesMonthlyReports = () => {
  const [month, setMonth] = useState(currentMonth);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const loadReport = async () => {
    try {
      setLoading(true);
      setError('');
      const { data } = await api.get('/des/monthly-reports', { params: { month } });
      setReport(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load monthly report.');
      setReport(null);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    loadReport();
  }, [month]);
  const stats = report?.stats || {};
  const weekly = report?.weekly || [];
  const companies = report?.companies || [];
  const creatives = report?.creatives || [];
  const maxWeekly = useMemo(() => Math.max(1, ...weekly.map((w) => w.submitted + w.approved + w.redo)), [weekly]);
  const exportPDF = () => {
    const reportElement = document.getElementById('des-monthly-report-print');
    if (!reportElement) {
      alert('Monthly report content not found.');
      return;
    }
    const printWindow = window.open('', '_blank', 'width=1200,height=900');
    if (!printWindow) {
      alert('Please allow pop-ups to export the PDF.');
      return;
    }
    const clone = reportElement.cloneNode(true);
    clone.querySelector('style')?.remove();
    const toolbar = clone.querySelector('.mr-toolbar');
    if (toolbar) toolbar.remove();
    const reportHTML = clone.outerHTML;
    const printStyles = `
    * {
      box-sizing: border-box !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      background: #ffffff !important;
      color: #222222 !important;
      font-family: Arial, Helvetica, sans-serif !important;
      font-size: 12px !important;
    }
    body {
      padding: 22px !important;
    }
    #des-monthly-report-print {
      display: block !important;
      width: 100% !important;
      max-width: 100% !important;
      margin: 0 auto !important;
      padding: 0 !important;
      background: #ffffff !important;
      color: #222222 !important;
      opacity: 1 !important;
      visibility: visible !important;
    }
    #des-monthly-report-print * {
      visibility: visible !important;
      opacity: 1 !important;
      text-shadow: none !important;
    }
    .des-header {
      display: block !important;
      margin-bottom: 22px !important;
      color: #222222 !important;
    }
    .des-header h1 {
      color: #222222 !important;
      font-size: 27px !important;
      font-weight: 800 !important;
      margin: 8px 0 !important;
    }
    .des-header p,
    .des-eyebrow {
      color: #666666 !important;
    }
    .mr-panel,
    .mr-card {
      display: block !important;
      background: #ffffff !important;
      color: #222222 !important;
      border: 1px solid #dddddd !important;
      border-radius: 12px !important;
      box-shadow: none !important;
      backdrop-filter: none !important;
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }
    .mr-panel {
      padding: 18px !important;
      margin-bottom: 15px !important;
    }
    .mr-grid {
      display: grid !important;
      grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
      gap: 12px !important;
      margin-bottom: 16px !important;
    }
    .mr-card {
      padding: 15px !important;
      min-width: 0 !important;
    }
    .mr-card-top {
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      color: #666666 !important;
      font-size: 11px !important;
    }
    .mr-icon {
      width: 32px !important;
      height: 32px !important;
      display: grid !important;
      place-items: center !important;
      background: #f1f1f1 !important;
      border-radius: 8px !important;
    }
    .mr-icon svg {
      width: 17px !important;
      height: 17px !important;
    }
    .mr-value {
      display: block !important;
      color: #222222 !important;
      font-size: 27px !important;
      font-weight: 800 !important;
      margin-top: 12px !important;
    }
    .mr-sub,
    .mr-section-sub,
    .mr-panel-head p,
    .mr-company-info small,
    .mr-creative-company {
      color: #666666 !important;
    }
    .mr-layout {
      display: grid !important;
      grid-template-columns: 1.35fr 1fr !important;
      gap: 14px !important;
      margin-bottom: 15px !important;
    }
    .mr-panel-head {
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      margin-bottom: 16px !important;
    }
    .mr-panel-head h3,
    .mr-section-title {
      color: #222222 !important;
      font-size: 15px !important;
      font-weight: 800 !important;
    }
    .mr-rate {
      color: #222222 !important;
      font-size: 26px !important;
      font-weight: 800 !important;
    }
    .mr-week-chart {
      display: flex !important;
      height: 170px !important;
      align-items: flex-end !important;
      justify-content: space-around !important;
      gap: 10px !important;
    }
    .mr-week {
      display: flex !important;
      flex: 1 !important;
      height: 100% !important;
      flex-direction: column !important;
      align-items: center !important;
      justify-content: flex-end !important;
      gap: 8px !important;
    }
    .mr-bars {
      display: flex !important;
      width: 100% !important;
      height: 140px !important;
      align-items: flex-end !important;
      justify-content: center !important;
      gap: 4px !important;
    }
    .mr-bar {
      display: block !important;
      width: 22% !important;
      max-width: 22px !important;
      border-radius: 5px 5px 0 0 !important;
    }
    .mr-bar.submitted { background: #f59a45 !important; }
    .mr-bar.approved { background: #35c99a !important; }
    .mr-bar.redo { background: #ed7180 !important; }
    .mr-week small {
      color: #555555 !important;
      font-size: 10px !important;
    }
    .mr-legend {
      display: flex !important;
      flex-wrap: wrap !important;
      gap: 14px !important;
      margin-top: 15px !important;
    }
    .mr-legend span {
      display: flex !important;
      align-items: center !important;
      gap: 6px !important;
      color: #555555 !important;
      font-size: 10px !important;
    }
    .mr-dot {
      display: inline-block !important;
      width: 8px !important;
      height: 8px !important;
      border-radius: 50% !important;
    }
    .mr-progress {
      height: 9px !important;
      background: #eeeeee !important;
      border-radius: 20px !important;
      overflow: hidden !important;
      margin: 14px 0 !important;
    }
    .mr-progress span {
      display: block !important;
      height: 100% !important;
      background: #f59a45 !important;
    }
    .mr-company-list {
      display: flex !important;
      flex-direction: column !important;
      gap: 14px !important;
    }
    .mr-company {
      display: flex !important;
      align-items: center !important;
      gap: 12px !important;
    }
    .mr-company-logo {
      width: 38px !important;
      height: 38px !important;
      object-fit: cover !important;
      border-radius: 10px !important;
      background: #eeeeee !important;
    }
    .mr-company-info {
      flex: 1 !important;
      min-width: 0 !important;
    }
    .mr-company-info strong,
    .mr-company-count {
      color: #222222 !important;
    }
    .mr-company-info small {
      display: block !important;
      font-size: 10px !important;
    }
    .mr-table-wrap {
      display: block !important;
      overflow: visible !important;
    }
    .mr-table {
      width: 100% !important;
      min-width: 0 !important;
      border-collapse: collapse !important;
      table-layout: auto !important;
    }
    .mr-table th {
      color: #555555 !important;
      background: #f3f3f3 !important;
      text-align: left !important;
      padding: 10px 8px !important;
      font-size: 9px !important;
      border-bottom: 1px solid #dddddd !important;
    }
    .mr-table td {
      color: #222222 !important;
      padding: 11px 8px !important;
      font-size: 10px !important;
      border-bottom: 1px solid #eeeeee !important;
    }
    .mr-creative-title {
      color: #222222 !important;
      font-weight: 700 !important;
    }
    .mr-creative-company {
      font-size: 9px !important;
      margin-top: 4px !important;
    }
    .mr-status {
      display: inline-block !important;
      padding: 5px 8px !important;
      border-radius: 20px !important;
      font-size: 9px !important;
      font-weight: 800 !important;
      border: 1px solid #dddddd !important;
      color: #333333 !important;
      background: #f3f3f3 !important;
    }
    .mr-status.approved {
      color: #087c58 !important;
      background: #e3f7ef !important;
    }
    .mr-status.redo {
      color: #b52e43 !important;
      background: #fdecef !important;
    }
    .mr-status.submitted {
      color: #a85b08 !important;
      background: #fff1df !important;
    }
    .mr-status.pending {
      color: #666666 !important;
      background: #eeeeee !important;
    }
    .mr-empty,
    .mr-loading {
      color: #555555 !important;
    }
    .mr-error,
    .mr-toolbar {
      display: none !important;
    }
    #des-monthly-report-print > div:last-child {
      color: #666666 !important;
    }
    svg {
      color: #555555;
      flex-shrink: 0;
    }
    @page {
      size: A4 landscape;
      margin: 10mm;
    }
  `;
    printWindow.document.open();
    printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Designer Monthly Report - ${month}</title>
        <style>${printStyles}</style>
      </head>
      <body>
        ${reportHTML}
      </body>
    </html>
  `);
    printWindow.document.close();
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
      }, 700);
    };
    setTimeout(() => {
      if (!printWindow.closed) {
        printWindow.focus();
        printWindow.print();
      }
    }, 1500);
  };
  return (
    <div className="des-page des-monthly-page" id="des-monthly-report-print">
      <style>{`
        .des-monthly-page{color:var(--ink,#f4f1ff)}
        .mr-toolbar{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;margin:22px 0}
        .mr-month-control{display:flex;align-items:center;gap:10px;padding:10px 14px;border:1px solid rgba(255,255,255,.12);border-radius:14px;background:rgba(255,255,255,.055);color:inherit}
        .mr-month-control input{background:transparent;border:0;color:inherit;outline:none;font:inherit;color-scheme:dark}
        .mr-export{display:flex;align-items:center;gap:8px;border:0;border-radius:12px;padding:12px 17px;background:linear-gradient(135deg,#f59a45,#f06c37);color:#fff;font-weight:700;cursor:pointer;box-shadow:0 8px 24px #ed793333}
        .mr-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:14px;margin-bottom:18px}
        .mr-card,.mr-panel{border:1px solid rgba(255,255,255,.1);background:linear-gradient(145deg,rgba(255,255,255,.075),rgba(255,255,255,.025));backdrop-filter:blur(18px);border-radius:18px;box-shadow:0 12px 35px rgba(0,0,0,.12)}
        .mr-card{padding:18px;min-width:0}
        .mr-card-top{display:flex;align-items:center;justify-content:space-between;gap:8px;color:var(--ink-3,#aaa4ba);font-size:12px;font-weight:700}
        .mr-icon{width:36px;height:36px;display:grid;place-items:center;border-radius:11px;background:rgba(255,255,255,.08)}
        .mr-value{font-size:29px;font-weight:800;letter-spacing:-1px;margin-top:15px}
        .mr-sub{font-size:11px;color:var(--ink-3,#aaa4ba);margin-top:5px}
        .mr-layout{display:grid;grid-template-columns:1.35fr 1fr;gap:16px;margin-bottom:16px}
        .mr-panel{padding:20px;min-width:0}
        .mr-panel-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:20px}
        .mr-panel-head h3{margin:0;font-size:15px;font-weight:800}
        .mr-panel-head p{margin:5px 0 0;color:var(--ink-3,#aaa4ba);font-size:12px}
        .mr-rate{font-size:27px;font-weight:800}
        .mr-progress{height:9px;border-radius:20px;background:rgba(255,255,255,.09);overflow:hidden;margin:14px 0}
        .mr-progress span{display:block;height:100%;border-radius:20px;background:linear-gradient(90deg,#f59a45,#f06c37);transition:width .4s}
        .mr-week-chart{height:180px;display:flex;align-items:flex-end;justify-content:space-around;gap:12px;padding:8px 4px 0}
        .mr-week{flex:1;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:9px;min-width:0}
        .mr-bars{height:145px;width:100%;display:flex;align-items:flex-end;justify-content:center;gap:4px}
        .mr-bar{width:22%;max-width:22px;min-height:3px;border-radius:6px 6px 2px 2px;transition:height .3s}
        .mr-bar.submitted{background:#f59a45}.mr-bar.approved{background:#35c99a}.mr-bar.redo{background:#ed7180}
        .mr-week small{font-size:10px;color:var(--ink-3,#aaa4ba)}
        .mr-legend{display:flex;gap:14px;flex-wrap:wrap;margin-top:17px}
        .mr-legend span{font-size:11px;color:var(--ink-3,#aaa4ba);display:flex;align-items:center;gap:6px}
        .mr-dot{width:8px;height:8px;border-radius:50%;display:inline-block}
        .mr-company-list{display:flex;flex-direction:column;gap:15px}
        .mr-company{display:flex;align-items:center;gap:12px}
        .mr-company-logo{width:38px;height:38px;border-radius:12px;object-fit:cover;background:rgba(255,255,255,.09);display:grid;place-items:center;flex-shrink:0}
        .mr-company-info{flex:1;min-width:0}
        .mr-company-info strong{display:block;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .mr-company-info small{font-size:10px;color:var(--ink-3,#aaa4ba)}
        .mr-company-count{font-size:12px;font-weight:800}
        .mr-table-wrap{overflow-x:auto}
        .mr-table{width:100%;border-collapse:collapse;min-width:680px}
        .mr-table th{text-align:left;padding:12px 14px;font-size:10px;text-transform:uppercase;letter-spacing:.7px;color:var(--ink-3,#aaa4ba);border-bottom:1px solid rgba(255,255,255,.1)}
        .mr-table td{padding:14px;font-size:12px;border-bottom:1px solid rgba(255,255,255,.065)}
        .mr-table tr:last-child td{border-bottom:0}
        .mr-creative-title{font-weight:700}
        .mr-creative-company{font-size:10px;color:var(--ink-3,#aaa4ba);margin-top:4px}
        .mr-status{display:inline-flex;align-items:center;padding:5px 9px;border-radius:20px;font-size:10px;font-weight:800;background:rgba(255,255,255,.08)}
        .mr-status.approved{color:#53d9ac;background:rgba(53,201,154,.12)}
        .mr-status.redo{color:#ff8795;background:rgba(237,113,128,.12)}
        .mr-status.submitted{color:#ffbd76;background:rgba(245,154,69,.12)}
        .mr-status.pending{color:#b8b0ca;background:rgba(184,176,202,.1)}
        .mr-empty,.mr-loading{padding:45px 20px;text-align:center;color:var(--ink-3,#aaa4ba)}
        .mr-empty svg,.mr-loading svg{margin-bottom:12px;opacity:.65}
        .mr-error{padding:16px;border-radius:12px;background:rgba(237,113,128,.1);color:#ff9aa5;display:flex;align-items:center;gap:10px;margin:15px 0}
        .mr-section-title{font-size:15px;font-weight:800;margin:0}
        .mr-section-sub{font-size:11px;color:var(--ink-3,#aaa4ba);margin:5px 0 0}
        @media(max-width:1050px){.mr-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
        @media(max-width:700px){.mr-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.mr-layout{grid-template-columns:1fr}.mr-card{padding:14px}.mr-value{font-size:25px}.mr-panel{padding:15px}}
        @media(max-width:420px){.mr-grid{grid-template-columns:1fr 1fr}.mr-card-top{font-size:10px}.mr-icon{width:30px;height:30px}}
        @media print{
          @page{size:A4 landscape;margin:12mm}
          body{background:#fff!important;color:#222!important}
          .des-monthly-page{color:#222!important}
          .des-header p,.mr-panel-head p,.mr-sub,.mr-card-top,.mr-company-info small,.mr-creative-company,.mr-table th,.mr-week small,.mr-legend span{color:#666!important}
          .mr-toolbar .mr-month-control{color:#222!important;background:#fff!important}
          .mr-export{display:none!important}
          .mr-card,.mr-panel{background:#fff!important;color:#222!important;border:1px solid #ddd!important;box-shadow:none!important;break-inside:avoid}
          .mr-table td{border-color:#ddd!important}
          .mr-status{border:1px solid #ddd}
          .mr-progress{background:#eee!important}
          .mr-empty{color:#555!important}
        }
      `}</style>
      <div className="des-header">
        <div>
          <div className="des-eyebrow">
            <FileBarChart size={15} />
            DESIGN WORKSPACE
          </div>
          <h1>Monthly Reports</h1>
          <p>Track your creative output, approvals and monthly performance.</p>
        </div>
      </div>
      <div className="mr-toolbar">
        <div className="mr-month-control">
          <CalendarDays size={17} />
          <input type="month" value={month} max={currentMonth()} onChange={(e) => setMonth(e.target.value)} />
          <ChevronDown size={15} />
        </div>
        <button className="mr-export" onClick={exportPDF} disabled={loading || !report}>
          <Download size={16} /> Export PDF
        </button>
      </div>
      {error && <div className="mr-error"><AlertCircle size={18} />{error}<button onClick={loadReport} style={{ marginLeft: 'auto', background: 'transparent', border: 0, color: 'inherit', cursor: 'pointer' }}><RefreshCw size={16} /></button></div>}
      {loading ? (
        <div className="mr-panel mr-loading"><RefreshCw size={25} /><p>Generating your monthly report...</p></div>
      ) : report ? (
        <>
          <div className="mr-panel" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div className="des-eyebrow"><CalendarDays size={14} /> MONTHLY OVERVIEW</div>
              <h2 style={{ margin: '8px 0 4px', fontSize: 22 }}>{formatMonth(month)}</h2>
              <p className="mr-section-sub">Your design performance and creative activity for this month.</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="mr-rate">{stats.completionRate || 0}%</div>
              <div className="mr-sub">Submission rate</div>
            </div>
          </div>
          <div className="mr-grid">
            {[
              { label: 'Assigned', value: stats.assigned || 0, sub: 'Creatives assigned this month', icon: Palette, color: '#b49aff' },
              { label: 'Submitted', value: stats.submitted || 0, sub: 'Designs uploaded this month', icon: UploadCloud, color: '#f5a14d' },
              { label: 'Approved', value: stats.approved || 0, sub: 'Designs approved this month', icon: CheckCircle2, color: '#35c99a' },
              { label: 'Redo', value: stats.redo || 0, sub: 'Designs sent back this month', icon: RotateCcw, color: '#ed7180' },
              { label: 'Pending', value: stats.pending || 0, sub: 'Assigned without an upload', icon: Clock3, color: '#a9a0bf' }
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div className="mr-card" key={item.label}>
                  <div className="mr-card-top">
                    <span>{item.label}</span>
                    <span className="mr-icon" style={{ color: item.color }}><Icon size={18} /></span>
                  </div>
                  <div className="mr-value">{item.value}</div>
                  <div className="mr-sub">{item.sub}</div>
                </div>
              );
            })}
          </div>
          <div className="mr-layout">
            <div className="mr-panel">
              <div className="mr-panel-head">
                <div><h3>Weekly Performance</h3><p>Submissions, approvals and redo activity</p></div>
                <TrendingUp size={19} />
              </div>
              {weekly.length ? (
                <>
                  <div className="mr-week-chart">
                    {weekly.map((week) => (
                      <div className="mr-week" key={week.label}>
                        <div className="mr-bars">
                          <div className="mr-bar submitted" title={`Submitted: ${week.submitted}`} style={{ height: `${Math.max(3, week.submitted / maxWeekly * 100)}%` }} />
                          <div className="mr-bar approved" title={`Approved: ${week.approved}`} style={{ height: `${Math.max(3, week.approved / maxWeekly * 100)}%` }} />
                          <div className="mr-bar redo" title={`Redo: ${week.redo}`} style={{ height: `${Math.max(3, week.redo / maxWeekly * 100)}%` }} />
                        </div>
                        <small>{week.label}</small>
                      </div>
                    ))}
                  </div>
                  <div className="mr-legend">
                    <span><i className="mr-dot" style={{ background: '#f59a45' }} />Submitted</span>
                    <span><i className="mr-dot" style={{ background: '#35c99a' }} />Approved</span>
                    <span><i className="mr-dot" style={{ background: '#ed7180' }} />Redo</span>
                  </div>
                </>
              ) : <div className="mr-empty">No weekly activity available.</div>}
            </div>
            <div className="mr-panel">
              <div className="mr-panel-head">
                <div><h3>Submission Progress</h3><p>Submitted vs assigned creatives</p></div>
                <FileBarChart size={19} />
              </div>
              <div className="mr-rate">{stats.submitted || 0} <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-3,#aaa4ba)' }}>/ {stats.assigned || 0} assigned</span></div>
              <div className="mr-progress"><span style={{ width: `${Math.min(100, stats.completionRate || 0)}%` }} /></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 11, color: 'var(--ink-3,#aaa4ba)' }}>
                <span>{stats.completionRate || 0}% completed</span>
                <span>{Math.max(0, (stats.assigned || 0) - (stats.submitted || 0))} not submitted</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 22 }}>
                <div style={{ padding: 13, borderRadius: 12, background: 'rgba(53,201,154,.09)' }}>
                  <CheckCircle2 size={17} color="#35c99a" />
                  <div style={{ fontSize: 21, fontWeight: 800, marginTop: 8 }}>{stats.approved || 0}</div>
                  <small style={{ color: 'var(--ink-3,#aaa4ba)' }}>Approved</small>
                </div>
                <div style={{ padding: 13, borderRadius: 12, background: 'rgba(237,113,128,.09)' }}>
                  <RotateCcw size={17} color="#ed7180" />
                  <div style={{ fontSize: 21, fontWeight: 800, marginTop: 8 }}>{stats.redo || 0}</div>
                  <small style={{ color: 'var(--ink-3,#aaa4ba)' }}>Redo requests</small>
                </div>
              </div>
            </div>
          </div>
          <div className="mr-panel" style={{ marginBottom: 16 }}>
            <div className="mr-panel-head">
              <div><h3>Company Performance</h3><p>Creative activity grouped by assigned company</p></div>
              <Building2 size={19} />
            </div>
            {companies.length ? (
              <div className="mr-company-list">
                {companies.map((company) => (
                  <div className="mr-company" key={company.id}>
                    {company.logo ? <img className="mr-company-logo" src={company.logo} alt="" /> : <div className="mr-company-logo"><Building2 size={17} /></div>}
                    <div className="mr-company-info">
                      <strong>{company.name}</strong>
                      <small>{company.submitted} submitted · {company.approved} approved · {company.redo} redo</small>
                    </div>
                    <div className="mr-company-count">{company.assigned} assigned</div>
                  </div>
                ))}
              </div>
            ) : <div className="mr-empty"><Building2 size={25} /><p>No company activity for this month.</p></div>}
          </div>
          <div className="mr-panel">
            <div className="mr-panel-head">
              <div><h3>Creative Details</h3><p>All creatives assigned or worked on during {formatMonth(month)}</p></div>
              <FileText size={19} />
            </div>
            {creatives.length ? (
              <div className="mr-table-wrap">
                <table className="mr-table">
                  <thead>
                    <tr><th>Creative</th><th>Scheduled</th><th>Assigned</th><th>Submitted</th><th>Version</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {creatives.map((creative) => (
                      <tr key={creative.id}>
                        <td><div className="mr-creative-title">{creative.title}</div><div className="mr-creative-company">{creative.company}</div></td>
                        <td>{creative.scheduledDate || '—'}</td>
                        <td>{formatDate(creative.assignedAt)}</td>
                        <td>{formatDate(creative.uploadedAt)}</td>
                        <td>{creative.version || '—'}</td>
                        <td><span className={`mr-status ${creative.status}`}>{statusLabel(creative.status)}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <div className="mr-empty"><FileText size={28} /><p>No creative activity found for {formatMonth(month)}.</p></div>}
          </div>
          <div style={{ textAlign: 'center', fontSize: 10, color: 'var(--ink-3,#aaa4ba)', margin: '18px 0 5px' }}>
            Report generated on {new Date().toLocaleDateString('en-IN')} · Designer Monthly Performance
          </div>
        </>
      ) : !error ? (
        <div className="mr-panel mr-empty"><FileBarChart size={30} /><h3>No report available</h3><p>Select a month to view your design performance.</p></div>
      ) : null}
    </div>
  );
};
export default DesMonthlyReports;
