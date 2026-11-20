import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { UploadCloud, FileText, Search, Trash2, X, LoaderCircle, Users, UserCheck, PhoneCall, CalendarClock, Download, ChevronDown, Mail, Phone, Pencil } from 'lucide-react';
import api from '../api';
import { errMsg, todayStr } from '../sopUtils';
import { buildXlsx, downloadBlob } from './xlsxExport';
import { fmtDate } from './hrUtils';
import '../style.css';


import '../styles/dashboard-glass.css';
import '../styles/hr.css';

const emptyFields = { name: '', mobile: '', email: '', position: '', skills: '' };
const FIELD_LABELS = { name: 'name', mobile: 'mobile number', email: 'email', position: 'position' };
const MAX_BULK = 30;
const RESUME_RE = /\.(pdf|docx?|txt|rtf|jpe?g|png|webp)$/i;
const BULK_LABELS = { queued: 'Waiting', reading: 'Reading…', adding: 'Adding…', added: 'Added', review: 'Needs your check', error: 'Not added' };
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
  { id: 'auto', label: 'Auto-shortlisted', test: (c) => !!c.match?.auto && c.shortlisted },
  { id: 'callPending', label: 'Call pending', test: (c) => c.shortlisted && !c.callDone },
  { id: 'interview', label: 'Interview scheduled', test: (c) => !!c.interviewAt },
];
// Dropdown choices (colours follow the recruitment sheet)
const REMARK_OPTIONS = [
  { value: 'Shortlisted', bg: '#cfe3f5', fg: '#1f5f99' },
  { value: 'HOLD', bg: '#111111', fg: '#ffd84d' },
  { value: 'Absconded', bg: '#9b1c1c', fg: '#ffe3e3' },
  { value: 'Rejected by Candidate', bg: '#f6cfc7', fg: '#a3402c' },
  { value: 'Unanswered', bg: '#f3dc8f', fg: '#7a5a00' },
  { value: 'Telephonic Rejected', bg: '#2b2160', fg: '#ffffff' },
  { value: 'Out of Mumbai', bg: '#d3e1ea', fg: '#2c6b7a' },
];
const INTERVIEW_OPTIONS = [
  { value: 'Selected', bg: '#cfe3f5', fg: '#1f6a8a' },
  { value: 'HOLD', bg: '#111111', fg: '#ffd84d' },
  { value: 'Absconded', bg: '#9b1c1c', fg: '#ffe3e3' },
  { value: 'Rejected 1st Round', bg: '#1c1c1c', fg: '#ffffff' },
  { value: 'Rejected 2nd Round', bg: '#1f5666', fg: '#ffffff' },
  { value: 'Rejected', bg: '#c0392b', fg: '#ffffff' },
];
// Coloured pill dropdown (the menu opens in a portal so the scrolling table never clips it)
const StatusSelect = ({ value, options, onChange, label, disabled = false, disabledHint = '' }) => {
  const [pos, setPos] = useState(null);
  const btnRef = useRef(null);
  const current = options.find((o) => o.value === value);
  useEffect(() => {
    if (!pos) return undefined;
    const close = () => setPos(null);
    const onKey = (e) => e.key === 'Escape' && close();
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [pos]);
  const toggle = () => {
    if (disabled) return undefined;
    if (pos) return setPos(null);
    const r = btnRef.current.getBoundingClientRect();
    const menuH = (options.length + 1) * 38 + 16;
    const top = r.bottom + menuH > window.innerHeight ? Math.max(8, r.top - menuH - 4) : r.bottom + 4;
    setPos({ top, left: r.left, width: Math.max(r.width, 190) });
  };
  const pick = (v) => { setPos(null); if (v !== value) onChange(v); };
  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={`hr-status-btn${current ? '' : ' empty'}`}
        style={current ? { background: current.bg, color: current.fg } : undefined}
        onClick={toggle}
        disabled={disabled}
        title={disabled ? disabledHint : ''}
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={!!pos}
      >
        <span>{current ? current.value : 'Select'}</span>
        <ChevronDown size={13} />
      </button>
      {pos && createPortal(
        <>
          <div className="hr-status-backdrop" onClick={() => setPos(null)} />
          <div className="hr-status-menu" role="listbox" style={{ top: pos.top, left: pos.left, minWidth: pos.width }}>
            {options.map((o) => (
              <button key={o.value} type="button" role="option" aria-selected={o.value === value} className="hr-status-opt" onClick={() => pick(o.value)}>
                <span className="hr-status-pill" style={{ background: o.bg, color: o.fg }}>{o.value}</span>
              </button>
            ))}
            {value && <button type="button" className="hr-status-clear" onClick={() => pick('')}>Clear</button>}
          </div>
        </>,
        document.body
      )}
    </>
  );
};
// Skills shown as badges; click the pencil to edit the comma separated list
const SKILL_PREVIEW = 10;
const SkillsCell = ({ value, onSave, label }) => {
  const [editing, setEditing] = useState(false);
  const [all, setAll] = useState(false);
  const [text, setText] = useState(value);
  const list = value.split(',').map((x) => x.trim()).filter(Boolean);
  const visible = all ? list : list.slice(0, SKILL_PREVIEW);
  if (editing) {
    return (
      <textarea
        className="hr-skills"
        rows={3}
        maxLength={500}
        autoFocus
        value={text}
        placeholder="Photoshop, Figma, Canva…"
        aria-label={label}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Escape') { setText(value); setEditing(false); } }}
        onBlur={() => { setEditing(false); if (text.trim() !== value) onSave(text.trim()); }}
      />
    );
  }
  return (
    <div className="hr-skill-list">
      {list.length === 0 && <button type="button" className="hr-skill-add" onClick={() => setEditing(true)}>+ Add skills</button>}
      {visible.map((sk) => <span key={sk} className="hr-skill-tag">{sk}</span>)}
      {list.length > SKILL_PREVIEW && (
        <button type="button" className="hr-skill-more" onClick={() => setAll((v) => !v)}>{all ? 'Show less' : `+${list.length - SKILL_PREVIEW} more`}</button>
      )}
      {list.length > 0 && (
        <button type="button" className="hr-skill-edit" aria-label={label} title="Edit skills" onClick={() => { setText(value); setEditing(true); }}><Pencil size={12} /></button>
      )}
    </div>
  );
};
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
const EditCell = ({ value, onSave, type = 'text', placeholder = '—', label, className = '' }) => {
  const [text, setText] = useState(value);
  const commit = async () => {
    const next = text.trim();
    if (next === value) return;
    const ok = await onSave(next);
    if (!ok) setText(value);
  };
  return (
    <input
      className={`hr-edit ${className}`}
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
const avatarStyle = (name) => {
  let h = 0;
  String(name || '?').split('').forEach((ch) => { h = (h * 31 + ch.charCodeAt(0)) % 360; });
  return { background: `hsl(${h} 45% 32%)` };
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
  const [bulk, setBulk] = useState([]); // files of a multi-file upload, with the result for each
  const [bulkRunning, setBulkRunning] = useState(false);
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
  const postCandidate = async (f, data) => {
    const body = new FormData();
    Object.entries(data).forEach(([k, v]) => body.append(k, v));
    if (f) body.append('resume', f);
    const res = await api.post('/hr/recruitment', body);
    setCandidates((list) => [res.data.candidate, ...list]);
    return res;
  };
  const patchBulk = (id, patch) => setBulk((list) => list.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  // Several resumes at once: read and add them one after another; the ones that need a human are listed
  const pickFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    if (files.length === 1) return pickFile(files[0]);
    if (bulkRunning) return undefined;
    setNotice(''); setError(''); setFormError('');
    const stamp = Date.now();
    const items = files.slice(0, MAX_BULK).map((f, i) => {
      let status = 'queued';
      let message = '';
      if (!RESUME_RE.test(f.name)) { status = 'error'; message = 'Unsupported file type.'; }
      else if (f.size > 8 * 1024 * 1024) { status = 'error'; message = 'Larger than 8MB.'; }
      return { id: `${stamp}-${i}`, file: f, name: f.name, status, message };
    });
    if (files.length > MAX_BULK) setError(`Only the first ${MAX_BULK} files were taken. Upload the rest as another batch.`);
    setBulk(items);
    setBulkRunning(true);
    const reviewFirst = review;
    for (const it of items) {
      if (it.status !== 'queued') continue;
      patchBulk(it.id, { status: 'reading' });
      try {
        const body = new FormData();
        body.append('resume', it.file);
        const res = await api.post('/hr/recruitment/parse', body);
        const found = { ...emptyFields, ...res.data.fields };
        const missingNow = res.data.missing || ['name', 'mobile', 'email', 'position'].filter((k) => !found[k]);
        const complete = found.name && found.position && (found.email || found.mobile);
        if (reviewFirst || !complete) {
          patchBulk(it.id, {
            status: 'review', fields: found, missing: missingNow, name: found.name || it.name,
            message: complete ? 'Ready for you to check.' : `Couldn't find: ${missingNow.map((k) => FIELD_LABELS[k]).join(', ')}.`,
          });
          continue;
        }
        patchBulk(it.id, { status: 'adding', name: found.name });
        const saved = await postCandidate(it.file, found);
        const cand = saved.data.candidate;
        const m = cand.match;
        const note = !m ? '' : cand.shortlisted && m.auto ? `${m.score}% skill match · CV shortlisted` : `${m.score}% skill match (needs ${m.needed}%)`;
        patchBulk(it.id, { status: 'added', name: cand.name, message: [note, saved.data.warning].filter(Boolean).join(' · ') });
      } catch (err) {
        patchBulk(it.id, { status: 'error', message: err.response?.data?.message || errMsg(err) });
      }
    }
    setBulkRunning(false);
    return undefined;
  };
  // Open one unfinished file in the normal form to complete it
  const completeBulk = (it) => {
    setBulk((list) => list.filter((b) => b.id !== it.id));
    setFile(it.file); setFields(it.fields || emptyFields); setMissing(it.missing || []); setFormError('');
  };
  const submit = async (f, data) => {
    const res = await postCandidate(f, data);
    const cand = res.data.candidate;
    const m = cand.match;
    const matchNote = !m ? '' : cand.shortlisted && m.auto
      ? ` Skills match ${m.score}% for ${m.role} — CV shortlisted automatically.`
      : ` Skills match ${m.score}% for ${m.role} (needs ${m.needed}%) — not shortlisted.`;
    setNotice(res.data.warning || `${cand.name} was added automatically.${matchNote} Click any detail in the table to correct it.`);
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
      test(c) && (!q || [c.name, c.email, c.mobile, c.position, c.skills].some((v) => String(v || '').toLowerCase().includes(q)))
    );
  }, [candidates, query, filter]);
  const setField = (k) => (e) => {
    setFields((f) => ({ ...f, [k]: e.target.value }));
    setMissing((m) => m.filter((x) => x !== k)); // typed in -> no longer "missing"
  };

  // Styled Excel file: coloured header, widths, status colours, real dates, clickable resume links
  const exportExcel = (listToExport = candidates) => {
    if (!listToExport || !listToExport.length) return;
    const pill = (list, value) => {
      const o = list.find((x) => x.value === value);
      return o ? { v: value, fill: o.bg.replace('#', ''), color: o.fg.replace('#', ''), bold: true, align: 'center' } : '';
    };
    const yesNo = (on) => (on
      ? { v: 'Yes', fill: 'D6F0E0', color: '1E7A4A', bold: true, align: 'center' }
      : { v: 'No', color: '8A8F94', align: 'center' });
    const matchCell = (m) => {
      if (!m) return '';
      const good = m.auto || m.score >= m.needed;
      return { v: m.score, type: 'num', fmt: '0"%"', fill: good ? 'D6F0E0' : 'FBEFC5', color: good ? '1E7A4A' : '8A6100', bold: true, align: 'center' };
    };
    const columns = [
      { header: '#', width: 5, align: 'center' },
      { header: 'Candidate Name', width: 24 },
      { header: 'Email', width: 30 },
      { header: 'Mobile', width: 16 },
      { header: 'Position', width: 24 },
      { header: 'Skills', width: 40 },
      { header: 'Skill Match', width: 12, align: 'center' },
      { header: 'CV Shortlisted', width: 14, align: 'center' },
      { header: 'Call Done', width: 11, align: 'center' },
      { header: 'Interview Schedule', width: 24, align: 'center' },
      { header: 'Remark', width: 24 },
      { header: 'Interview Status', width: 24 },
      { header: 'Last Remark', width: 38 },
      { header: 'Remark Date', width: 16, align: 'center' },
      { header: 'Resume', width: 14, align: 'center' },
      { header: 'Date Added', width: 16, align: 'center' },
    ];
    const rows = listToExport.map((c, i) => [
      i + 1,
      { v: c.name || '', bold: true },
      c.email || '',
      c.mobile || '',
      c.position || '',
      { v: c.skills || '', wrap: true },
      matchCell(c.match),
      yesNo(c.shortlisted),
      yesNo(c.callDone),
      c.interviewAt ? { v: c.interviewAt, type: 'datetime' } : '',
      pill(REMARK_OPTIONS, c.remarkStatus),
      pill(INTERVIEW_OPTIONS, c.interviewStatus),
      { v: c.remark || '', wrap: true },
      c.remark && c.remarkAt ? { v: c.remarkAt, type: 'date' } : '',
      c.resume?.url ? { v: 'View resume', type: 'link', url: c.resume.url, align: 'center' } : '',
      c.createdAt ? { v: c.createdAt, type: 'date' } : '',
    ]);
    const isFiltered = listToExport.length !== candidates.length;
    const filterLabel = FILTERS.find((f) => f.id === filter)?.label;
    const blob = buildXlsx({
      sheetName: 'Candidates',
      title: 'Recruitment — Candidates',
      subtitle: `Exported on ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} · ${listToExport.length} candidate${listToExport.length === 1 ? '' : 's'}${isFiltered ? ` (filtered${filter !== 'all' ? `: ${filterLabel}` : ''})` : ''}`,
      columns,
      rows,
    });
    const filterTag = isFiltered && filter !== 'all' ? `-${filter}` : isFiltered ? '-filtered' : '';
    downloadBlob(blob, `candidates${filterTag}-${todayStr()}.xlsx`);
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
          onClick={() => exportExcel(candidates)}
          disabled={!candidates.length}
          title="Export all candidates to a formatted Excel file"
        >
          <Download size={15} />
          <span>Export Excel</span>
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
        <div className="hr-card-head"><h3>Add candidate from resume</h3><small>PDF, Word, TXT or image (JPG, PNG) · max 8MB each · up to 30 files at once</small></div>
        <label className="hr-review-toggle">
          <input type="checkbox" checked={review} onChange={(e) => setReview(e.target.checked)} />
          Review the details before adding
        </label>
        {!file ? (
          <label
            className={`hr-drop ${dragging ? 'drag' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); pickFiles(e.dataTransfer.files); }}
          >
            <UploadCloud size={28} />
            <strong>Click to upload or drop resumes here</strong>
            <span>Select several files at once to add them in bulk · we'll read the name, mobile, email, position and skills</span>
            <input ref={fileRef} type="file" multiple disabled={bulkRunning} accept=".pdf,.doc,.docx,.txt,.rtf,.jpg,.jpeg,.png,.webp" hidden onChange={(e) => { const chosen = Array.from(e.target.files || []); e.target.value = ''; pickFiles(chosen); }} />
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
                      : 'Name, mobile, email, position and skills were fetched from the resume — check them and save.'}
                </p>
                {formError && <p className="error-message" role="alert">{formError}</p>}
                <div className="hr-form-grid">
                  <label className={`x-field${missing.includes('name') ? ' hr-missing' : ''}`}><span>Candidate name *</span><input value={fields.name} onChange={setField('name')} required maxLength={80} /></label>
                  <label className={`x-field${missing.includes('mobile') ? ' hr-missing' : ''}`}><span>Mobile</span><input value={fields.mobile} onChange={setField('mobile')} inputMode="tel" /></label>
                  <label className={`x-field${missing.includes('email') ? ' hr-missing' : ''}`}><span>Email</span><input type="email" value={fields.email} onChange={setField('email')} /></label>
                  <label className={`x-field${missing.includes('position') ? ' hr-missing' : ''}`}><span>Position</span><input value={fields.position} onChange={setField('position')} maxLength={80} /></label>
                  <label className="x-field hr-wide"><span>Skills</span><input value={fields.skills} onChange={setField('skills')} maxLength={500} placeholder="Read from the resume — comma separated" /></label>
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
      {bulk.length > 0 && (
        <section className="hr-card hr-bulk">
          <div className="hr-card-head">
            <h3>Bulk upload</h3>
            <small>
              {bulk.filter((b) => !['queued', 'reading', 'adding'].includes(b.status)).length}/{bulk.length} done
              {' · '}{bulk.filter((b) => b.status === 'added').length} added
              {bulk.some((b) => b.status === 'review') && ` · ${bulk.filter((b) => b.status === 'review').length} need a check`}
              {bulk.some((b) => b.status === 'error') && ` · ${bulk.filter((b) => b.status === 'error').length} not added`}
            </small>
          </div>
          <ul className="hr-bulk-list">
            {bulk.map((it) => (
              <li key={it.id} className={`hr-bulk-item ${it.status}`}>
                <FileText size={15} />
                <div className="hr-bulk-main">
                  <strong>{it.name}</strong>
                  {it.name !== it.file.name && <em>{it.file.name}</em>}
                  {it.message && <small>{it.message}</small>}
                </div>
                <span className="hr-bulk-status">
                  {(it.status === 'reading' || it.status === 'adding') && <LoaderCircle size={13} className="hr-spin" />}
                  {BULK_LABELS[it.status]}
                </span>
                {it.status === 'review' && (
                  <button type="button" className="btn-ghost" disabled={!!file} title={file ? 'Finish the open form first' : ''} onClick={() => completeBulk(it)}>Complete</button>
                )}
              </li>
            ))}
          </ul>
          {!bulkRunning && (
            <div className="hr-form-actions"><button type="button" className="btn-ghost" onClick={() => setBulk([])}>Clear list</button></div>
          )}
        </section>
      )}
      {/* ---------- Candidates ---------- */}
      <div className="hr-toolbar">
        <div className="hr-search">
          <Search size={15} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, email, mobile, position or skill" />
        </div>
        <div className="hr-toolbar-actions">
          {shown.length !== candidates.length ? (
            <>
              <button
                type="button"
                className="hr-export-btn"
                onClick={() => exportExcel(shown)}
                disabled={!shown.length}
                title="Export the filtered candidates to a formatted Excel file"
              >
                <Download size={15} />
                <span>Export Filtered ({shown.length})</span>
              </button>
              <button
                type="button"
                className="hr-export-btn ghost"
                onClick={() => exportExcel(candidates)}
                disabled={!candidates.length}
                title="Export all candidates to a formatted Excel file"
              >
                <Download size={15} />
                <span>Export All ({candidates.length})</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              className="hr-export-btn"
              onClick={() => exportExcel(candidates)}
              disabled={!candidates.length}
              title="Export all candidates to a formatted Excel file"
            >
              <Download size={15} />
              <span>Export Excel</span>
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
        <div className="hr-cand-list">
          {shown.length === 0 && (
            <p className="hr-empty">{candidates.length ? 'No candidates match.' : 'No candidates yet. Upload a resume above to add the first one.'}</p>
          )}
          {shown.map((c) => {
            const m = c.match;
            const lock = c.shortlisted ? '' : 'Shortlist the CV first';
            return (
              <article key={c.id} className={`hr-cand${c.shortlisted ? ' is-shortlisted' : ''}`}>
                <header className="hr-cand-head">
                  <span className="hr-avatar" style={avatarStyle(c.name)} aria-hidden="true">{(c.name || '?').trim().charAt(0).toUpperCase()}</span>
                  <div className="hr-cand-id">
                    <EditCell className="hr-edit-name" key={`n-${c.id}-${c.name}`} value={c.name} label={`Name of ${c.name}`} onSave={(v) => update(c.id, { name: v })} />
                    <EditCell className="hr-edit-role" key={`p-${c.id}-${c.position}`} value={c.position} placeholder="Add position" label={`Position of ${c.name}`} onSave={(v) => update(c.id, { position: v })} />
                  </div>
                  <div className="hr-cand-tools">
                    <span
                      className={`hr-match ${!m ? 'none' : m.auto ? 'pass' : m.score >= m.needed ? 'ok' : 'low'}`}
                      title={!m ? 'No base skills saved for this role yet (see Base Skills in the sidebar)' : `Role: ${m.role}\nNeeds ${m.needed}% to be shortlisted${m.missing.length ? `\nMissing: ${m.missing.join(', ')}` : ''}`}
                    >
                      {!m ? 'No role match' : `${m.auto ? '✓ ' : ''}${m.score}% match`}
                    </span>
                    {c.resume ? <a className="hr-resume-btn" href={c.resume.url} target="_blank" rel="noreferrer"><FileText size={14} /> Resume</a> : <span className="hr-resume-btn off">No resume</span>}
                    <button type="button" className="btn-ghost danger" onClick={() => remove(c)} aria-label={`Remove ${c.name}`}><Trash2 size={15} /></button>
                  </div>
                </header>

                <div className="hr-cand-body">
                  <section className="hr-block">
                    <h4>Contact</h4>
                    <div className="hr-contact-row"><Mail size={14} /><EditCell key={`e-${c.id}-${c.email}`} type="email" value={c.email} placeholder="Add email" label={`Email of ${c.name}`} onSave={(v) => update(c.id, { email: v })} /></div>
                    <div className="hr-contact-row"><Phone size={14} /><EditCell key={`m-${c.id}-${c.mobile}`} value={c.mobile} placeholder="Add mobile" label={`Mobile of ${c.name}`} onSave={(v) => update(c.id, { mobile: v })} /></div>
                  </section>
                  <section className="hr-block">
                    <h4>Skills</h4>
                    <SkillsCell key={`s-${c.id}-${c.skills}`} value={c.skills} label={`Skills of ${c.name}`} onSave={(v) => update(c.id, { skills: v })} />
                  </section>
                  <section className="hr-block">
                    <h4>Last remark</h4>
                    <RemarkCell key={`${c.id}-${c.remark}`} value={c.remark} at={c.remarkAt} onSave={(remark) => update(c.id, { remark })} />
                  </section>
                </div>

                <div className="hr-cand-flow">
                  <div className="hr-field">
                    <span className="hr-field-label">CV shortlisted</span>
                    <label className="hr-switch-row">
                      <input type="checkbox" className="hr-switch" checked={c.shortlisted} onChange={(e) => update(c.id, { shortlisted: e.target.checked })} aria-label={`CV shortlisted: ${c.name}`} />
                      <span>{c.shortlisted ? 'Yes' : 'No'}</span>
                    </label>
                  </div>
                  <div className="hr-field">
                    <span className="hr-field-label">Call done</span>
                    <label className="hr-switch-row" title={lock}>
                      <input type="checkbox" className="hr-switch" checked={c.callDone} disabled={!c.shortlisted} onChange={(e) => update(c.id, { callDone: e.target.checked })} aria-label={`Call done: ${c.name}`} />
                      <span>{c.callDone ? 'Yes' : 'No'}</span>
                    </label>
                  </div>
                  <div className="hr-field">
                    <span className="hr-field-label">Interview schedule</span>
                    <input
                      type="datetime-local"
                      className="hr-dt"
                      value={toLocalInput(c.interviewAt)}
                      disabled={!c.shortlisted}
                      title={lock}
                      onChange={(e) => update(c.id, { interviewAt: e.target.value ? new Date(e.target.value).toISOString() : null })}
                    />
                  </div>
                  <div className="hr-field">
                    <span className="hr-field-label">Remark</span>
                    <StatusSelect value={c.remarkStatus} options={REMARK_OPTIONS} label={`Remark for ${c.name}`} disabled={!c.shortlisted} disabledHint={lock} onChange={(v) => update(c.id, { remarkStatus: v })} />
                  </div>
                  <div className="hr-field">
                    <span className="hr-field-label">Interview status</span>
                    <StatusSelect value={c.interviewStatus} options={INTERVIEW_OPTIONS} label={`Interview status for ${c.name}`} disabled={!c.shortlisted} disabledHint={lock} onChange={(v) => update(c.id, { interviewStatus: v })} />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
export default HrRecruitment;
