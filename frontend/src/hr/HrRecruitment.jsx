import { useEffect, useMemo, useRef, useState } from 'react';
import { UploadCloud, FileText, Search, Trash2, X, LoaderCircle, Users, UserCheck, PhoneCall, CalendarClock, Download } from 'lucide-react';
import api from '../api';
import { errMsg, fmtDateTime, todayStr } from '../sopUtils';
import { fmtDate } from './hrUtils';
import '../style.css';
import '../styles/dashboard-glass.css';
import '../styles/hr.css';

const csvCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

const emptyFields = { name: '', mobile: '', email: '', position: '' };
const FIELD_LABELS = { name: 'name', mobile: 'mobile number', email: 'email', position: 'position' };

// ISO -> value for <input type="datetime-local"> (local time)
const toLocalInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

const FILTERS = [
  { id: 'all', label: 'All', test: () => true },
  { id: 'shortlisted', label: 'Shortlisted', test: (c) => c.shortlisted },
  { id: 'not', label: 'Not shortlisted', test: (c) => !c.shortlisted },
  { id: 'callPending', label: 'Call pending', test: (c) => c.shortlisted && !c.callDone },
  { id: 'interview', label: 'Interview scheduled', test: (c) => !!c.interviewAt },
];

// Remark box: edits locally, saves when you click away
const RemarkCell = ({ value, at, onSave }) => {
  const [text, setText] = useState(value);
  return (
    <div className="hr-remark">
      <textarea
        rows={2}
        maxLength={1000}
        value={text}
        placeholder="Add a note…"
        onChange={(e) => setText(e.target.value)}
        onBlur={() => text.trim() !== value && onSave(text)}
      />
      {at && value && <small>Updated {fmtDate(at)}</small>}
    </div>
  );
};

// Small inline-editable cell: edits locally, saves on blur / Enter, reverts if the server says no
const EditCell = ({ value, onSave, type = 'text', placeholder = '—', label }) => {
  const [text, setText] = useState(value);
  const commit = async () => {
    const next = text.trim();
    if (next === value) return;
    const ok = await onSave(next);
    if (!ok) setText(value);
  };
  return (
    <input
      className="hr-edit"
      type={type}
      value={text}
      placeholder={placeholder}
      aria-label={label}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
    />
  );
};

const HrRecruitment = () => {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');

  // upload flow
  const fileRef = useRef(null);
  const [file, setFile] = useState(null);
  const [fields, setFields] = useState(emptyFields);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [formError, setFormError] = useState('');
  const [missing, setMissing] = useState([]); // details the resume did not contain
  const [review, setReview] = useState(false); // false = add straight to the table once details are found

  useEffect(() => {
    let cancelled = false;
    api.get('/hr/recruitment')
      .then((res) => !cancelled && setCandidates(res.data.candidates || []))
      .catch((err) => !cancelled && setError(errMsg(err)))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, []);

  const resetUpload = () => {
    setFile(null); setFields(emptyFields); setFormError(''); setMissing([]);
    if (fileRef.current) fileRef.current.value = '';
  };

  const pickFile = async (f) => {
    if (!f) return;
    setNotice(''); setError(''); setFormError('');
    if (!/\.(pdf|docx?|txt|rtf|jpe?g|png|webp)$/i.test(f.name)) { setFormError('Upload a PDF, Word, TXT or image (JPG, PNG, WEBP) file.'); return; }
    if (f.size > 8 * 1024 * 1024) { setFormError('The resume must be 8MB or smaller.'); return; }
    setFile(f);
    setFields(emptyFields);
    setMissing([]);
    setParsing(true);
    try {
      const body = new FormData();
      body.append('resume', f);
      const res = await api.post('/hr/recruitment/parse', body);
      const found = { ...emptyFields, ...res.data.fields };
      setFields(found);
      setMissing(res.data.missing || ['name', 'mobile', 'email', 'position'].filter((k) => !found[k]));
      // Everything found -> add it to the table straight away (unless "review first" is ticked).
      // If the position (or contact details) could not be read, keep the form open so HR can complete it.
      if (!review && found.name && found.position && (found.email || found.mobile)) {
        setSaving(true);
        try {
          await submit(f, found);
        } catch (err) {
          setFormError(err.response?.data?.message || errMsg(err)); // e.g. duplicate -> keep the form open
        } finally {
          setSaving(false);
        }
      }
    } catch (err) {
      // Reading failed — keep the file and let HR type the details
      setFormError(`${err.response?.data?.message || errMsg(err)}`);
    } finally {
      setParsing(false);
    }
  };

  const submit = async (f, data) => {
    const body = new FormData();
    Object.entries(data).forEach(([k, v]) => body.append(k, v));
    if (f) body.append('resume', f);
    const res = await api.post('/hr/recruitment', body);
    setCandidates((list) => [res.data.candidate, ...list]);
    setNotice(res.data.warning || `${res.data.candidate.name} was added automatically. Click any detail in the table to correct it.`);
    resetUpload();
  };

  const saveCandidate = async (e) => {
    e.preventDefault();
    setSaving(true); setFormError('');
    try {
      await submit(file, fields);
    } catch (err) {
      setFormError(err.response?.data?.message || errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  const update = async (id, patch) => {
    setError('');
    const before = candidates;
    setCandidates((list) => list.map((c) => (c.id === id ? { ...c, ...patch } : c))); // instant UI
    try {
      const res = await api.put(`/hr/recruitment/${id}`, patch);
      setCandidates((list) => list.map((c) => (c.id === id ? res.data.candidate : c)));
      return true;
    } catch (err) {
      setCandidates(before);
      setError(err.response?.data?.message || errMsg(err));
      return false;
    }
  };

  const remove = async (c) => {
    if (!window.confirm(`Remove ${c.name} from recruitment? The resume will be deleted too.`)) return;
    try {
      await api.delete(`/hr/recruitment/${c.id}`);
      setCandidates((list) => list.filter((x) => x.id !== c.id));
    } catch (err) {
      setError(err.response?.data?.message || errMsg(err));
    }
  };

  const stats = useMemo(() => ({
    total: candidates.length,
    shortlisted: candidates.filter((c) => c.shortlisted).length,
    called: candidates.filter((c) => c.callDone).length,
    interviews: candidates.filter((c) => c.interviewAt && new Date(c.interviewAt) >= new Date()).length,
  }), [candidates]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const test = FILTERS.find((f) => f.id === filter).test;
    return candidates.filter((c) =>
      test(c) && (!q || [c.name, c.email, c.mobile, c.position].some((v) => String(v || '').toLowerCase().includes(q)))
    );
  }, [candidates, query, filter]);

  const setField = (k) => (e) => {
    setFields((f) => ({ ...f, [k]: e.target.value }));
    setMissing((m) => m.filter((x) => x !== k)); // typed in -> no longer "missing"
  };

  const exportCsv = (listToExport = candidates) => {
    if (!listToExport || !listToExport.length) return;
    const header = [
      'Candidate Name',
      'Email',
      'Mobile',
      'Position',
      'CV Shortlisted',
      'Call Done',
      'Interview Schedule',
      'Last Remark',
      'Remark Date',
      'Resume URL',
      'Resume Name',
      'Date Added'
    ];
    const rows = listToExport.map((c) => [
      c.name || '',
      c.email || '',
      c.mobile || '',
      c.position || '',
      c.shortlisted ? 'Yes' : 'No',
      c.callDone ? 'Yes' : 'No',
      fmtDateTime(c.interviewAt),
      c.remark || '',
      fmtDateTime(c.remarkAt),
      c.resume?.url || '',
      c.resume?.name || '',
      fmtDateTime(c.createdAt)
    ]);
    const csvContent = [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const isFiltered = listToExport.length !== candidates.length;
    const filterTag = isFiltered && filter !== 'all' ? `-${filter}` : isFiltered ? '-filtered' : '';
    link.download = `candidates${filterTag}-${todayStr()}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="dashboard-content scrollable dash-glass hr-page">
      <div className="page-header">
        <div>
          <span className="page-label">HUMAN RESOURCES</span>
          <h1>Recruitment</h1>
          <p>Upload a resume and the candidate's details are filled in for you. Then track shortlisting, calls and interviews.</p>
        </div>
        <button
          type="button"
          className="hr-export-btn"
          onClick={() => exportCsv(candidates)}
          disabled={!candidates.length}
          title="Export all candidates to CSV"
        >
          <Download size={15} />
          <span>Export CSV</span>
        </button>
      </div>

      {error && <p className="error-message" role="alert">{error}</p>}
      {notice && <p className="success-message" role="status">{notice}</p>}

      <div className="kpi-grid">
        <div className="kpi-card"><div className="kpi-top"><span className="kpi-label">Candidates</span><span className="kpi-icon"><Users size={17} /></span></div><div className="kpi-value">{stats.total}</div></div>
        <div className="kpi-card green"><div className="kpi-top"><span className="kpi-label">CV shortlisted</span><span className="kpi-icon"><UserCheck size={17} /></span></div><div className="kpi-value">{stats.shortlisted}</div></div>
        <div className="kpi-card amber"><div className="kpi-top"><span className="kpi-label">Calls done</span><span className="kpi-icon"><PhoneCall size={17} /></span></div><div className="kpi-value">{stats.called}</div></div>
        <div className="kpi-card"><div className="kpi-top"><span className="kpi-label">Upcoming interviews</span><span className="kpi-icon"><CalendarClock size={17} /></span></div><div className="kpi-value">{stats.interviews}</div></div>
      </div>

      {/* ---------- Upload resume ---------- */}
      <section className="hr-card">
        <div className="hr-card-head"><h3>Add candidate from resume</h3><small>PDF, Word, TXT or image (JPG, PNG) · max 8MB</small></div>

        <label className="hr-review-toggle">
          <input type="checkbox" checked={review} onChange={(e) => setReview(e.target.checked)} />
          Review the details before adding
        </label>

        {!file ? (
          <label
            className={`hr-drop ${dragging ? 'drag' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); pickFile(e.dataTransfer.files?.[0]); }}
          >
            <UploadCloud size={28} />
            <strong>Click to upload or drop a resume here</strong>
            <span>We'll read the name, mobile, email and position</span>
            <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.txt,.rtf,.jpg,.jpeg,.png,.webp" hidden onChange={(e) => pickFile(e.target.files?.[0])} />
            {formError && <em className="hr-drop-error">{formError}</em>}
          </label>
        ) : (
          <form onSubmit={saveCandidate} className="hr-upload-form">
            <div className="hr-file-chip">
              <FileText size={16} /> <span>{file.name}</span>
              <button type="button" onClick={resetUpload} aria-label="Remove file" disabled={saving}><X size={14} /></button>
            </div>
            {parsing ? (
              <p className="hr-parsing"><LoaderCircle size={16} className="hr-spin" /> Reading resume and fetching details… {/\.(jpe?g|png|webp)$/i.test(file.name) && '(images take a little longer)'}</p>
            ) : (
              <>
                <p className="hr-hint">
                  {saving
                    ? 'Adding candidate…'
                    : missing.length
                      ? `Fetched from the resume — couldn't find: ${missing.map((k) => FIELD_LABELS[k]).join(', ')}. Please fill ${missing.length > 1 ? 'these' : 'this'} in.`
                      : 'Name, mobile, email and position were fetched from the resume — check them and save.'}
                </p>
                {formError && <p className="error-message" role="alert">{formError}</p>}
                <div className="hr-form-grid">
                  <label className={`x-field${missing.includes('name') ? ' hr-missing' : ''}`}><span>Candidate name *</span><input value={fields.name} onChange={setField('name')} required maxLength={80} /></label>
                  <label className={`x-field${missing.includes('mobile') ? ' hr-missing' : ''}`}><span>Mobile</span><input value={fields.mobile} onChange={setField('mobile')} inputMode="tel" /></label>
                  <label className={`x-field${missing.includes('email') ? ' hr-missing' : ''}`}><span>Email</span><input type="email" value={fields.email} onChange={setField('email')} /></label>
                  <label className={`x-field${missing.includes('position') ? ' hr-missing' : ''}`}><span>Position</span><input value={fields.position} onChange={setField('position')} maxLength={80} /></label>
                </div>
                <div className="hr-form-actions">
                  <button type="button" className="btn-ghost" onClick={resetUpload} disabled={saving}>Cancel</button>
                  <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save candidate'}</button>
                </div>
              </>
            )}
          </form>
        )}
      </section>

      {/* ---------- Candidates ---------- */}
      <div className="hr-toolbar">
        <div className="hr-search">
          <Search size={15} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, email, mobile or position" />
        </div>
        <div className="hr-toolbar-actions">
          {shown.length !== candidates.length ? (
            <>
              <button
                type="button"
                className="hr-export-btn"
                onClick={() => exportCsv(shown)}
                disabled={!shown.length}
                title="Export currently filtered candidates to CSV"
              >
                <Download size={15} />
                <span>Export Filtered ({shown.length})</span>
              </button>
              <button
                type="button"
                className="hr-export-btn ghost"
                onClick={() => exportCsv(candidates)}
                disabled={!candidates.length}
                title="Export all candidates to CSV"
              >
                <Download size={15} />
                <span>Export All ({candidates.length})</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              className="hr-export-btn"
              onClick={() => exportCsv(candidates)}
              disabled={!candidates.length}
              title="Export all candidates to CSV"
            >
              <Download size={15} />
              <span>Export CSV</span>
            </button>
          )}
        </div>
      </div>
      <div className="hr-chips">
        {FILTERS.map((f) => (
          <button key={f.id} type="button" className={filter === f.id ? 'active' : ''} onClick={() => setFilter(f.id)}>
            {f.label}<em>{candidates.filter(f.test).length}</em>
          </button>
        ))}
      </div>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : (
        <div className="hr-table-wrap">
          <table className="hr-table hr-recruit-table">
            <thead>
              <tr>
                <th>Candidate</th><th>Mobile</th><th>Position</th><th>Resume</th>
                <th className="center">CV shortlisted</th><th className="center">Call done</th>
                <th>Interview schedule</th><th>Last remark</th><th />
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 && (
                <tr><td colSpan={9}><p className="hr-empty">{candidates.length ? 'No candidates match.' : 'No candidates yet. Upload a resume above to add the first one.'}</p></td></tr>
              )}
              {shown.map((c) => (
                <tr key={c.id}>
                  <td>
                    <EditCell key={`n-${c.id}-${c.name}`} value={c.name} label={`Name of ${c.name}`} onSave={(v) => update(c.id, { name: v })} />
                    <EditCell key={`e-${c.id}-${c.email}`} type="email" value={c.email} placeholder="Add email" label={`Email of ${c.name}`} onSave={(v) => update(c.id, { email: v })} />
                  </td>
                  <td><EditCell key={`m-${c.id}-${c.mobile}`} value={c.mobile} placeholder="Add mobile" label={`Mobile of ${c.name}`} onSave={(v) => update(c.id, { mobile: v })} /></td>
                  <td><EditCell key={`p-${c.id}-${c.position}`} value={c.position} placeholder="Add position" label={`Position of ${c.name}`} onSave={(v) => update(c.id, { position: v })} /></td>
                  <td>{c.resume ? <a className="hr-link" href={c.resume.url} target="_blank" rel="noreferrer"><FileText size={14} /> View</a> : '—'}</td>
                  <td className="center">
                    <input type="checkbox" className="hr-check" checked={c.shortlisted} onChange={(e) => update(c.id, { shortlisted: e.target.checked })} aria-label={`CV shortlisted: ${c.name}`} />
                  </td>
                  <td className="center">
                    <input type="checkbox" className="hr-check" checked={c.callDone} disabled={!c.shortlisted} title={c.shortlisted ? '' : 'Shortlist the CV first'} onChange={(e) => update(c.id, { callDone: e.target.checked })} aria-label={`Call done: ${c.name}`} />
                  </td>
                  <td>
                    <input
                      type="datetime-local"
                      className="hr-dt"
                      value={toLocalInput(c.interviewAt)}
                      disabled={!c.shortlisted}
                      title={c.shortlisted ? '' : 'Shortlist the CV first'}
                      onChange={(e) => update(c.id, { interviewAt: e.target.value ? new Date(e.target.value).toISOString() : null })}
                    />
                  </td>
                  <td><RemarkCell key={`${c.id}-${c.remark}`} value={c.remark} at={c.remarkAt} onSave={(remark) => update(c.id, { remark })} /></td>
                  <td><button type="button" className="btn-ghost danger" onClick={() => remove(c)} aria-label={`Remove ${c.name}`}><Trash2 size={15} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default HrRecruitment;
