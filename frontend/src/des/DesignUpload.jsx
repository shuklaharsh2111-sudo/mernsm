import { useEffect, useRef, useState } from 'react';
import {
  Palette, UploadCloud, FileText, ExternalLink, CheckCircle2, Clock3, RotateCcw, UserCheck, Eye,
  BadgeCheck, X, LoaderCircle, AlertCircle, Layers, CalendarClock, Hourglass, Info, ChevronDown, MessageSquare
} from 'lucide-react';
import api from '../api';
import { fmtDateTime } from '../sopUtils';
import { workflowOf } from './desWorkflow';
import '../styles/desupload.css';
import '../styles/designfeedback.css';

const MAX_FILE_MB = 10;
const TYPE_LABEL = {
  'image/jpeg': 'JPG', 'image/png': 'PNG', 'image/webp': 'WEBP', 'image/gif': 'GIF',
  'video/mp4': 'MP4', 'video/webm': 'WEBM', 'video/quicktime': 'MOV', 'application/pdf': 'PDF'
};
const ACCEPT = Object.keys(TYPE_LABEL).join(',');
const FORMATS = Object.values(TYPE_LABEL).join(', ');

const typeLabel = (mime) => TYPE_LABEL[mime] || (mime ? mime.split('/')[1]?.toUpperCase() : '') || 'FILE';
const isImg = (m) => (m || '').startsWith('image/');
const isVid = (m) => (m || '').startsWith('video/');
const formatSize = (bytes) => {
  if (!bytes) return '';
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

// How close the scheduled date is. Only matters while the designer still owes a file.
const dueInfo = (creative, flowKey) => {
  if (!creative.date || !['todo', 'redo'].includes(flowKey)) return null;
  const [y, m, d] = creative.date.split('-').map(Number);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((new Date(y, m - 1, d) - today) / 86400000);
  if (days < 0) return { text: `Overdue by ${-days} day${days === -1 ? '' : 's'}`, tone: 'bad' };
  if (days === 0) return { text: 'Due today', tone: 'warn' };
  if (days === 1) return { text: 'Due tomorrow', tone: 'warn' };
  return { text: `Due in ${days} days`, tone: days <= 3 ? 'warn' : 'ok' };
};

const STEPS = [
  { id: 'assigned', label: 'Assigned', icon: UserCheck },
  { id: 'delivered', label: 'Delivered', icon: UploadCloud },
  { id: 'review', label: 'SME review', icon: Eye },
  { id: 'approved', label: 'Approved', icon: BadgeCheck }
];
const STEP_STATES = {
  todo: ['done', 'current', 'idle', 'idle'],
  review: ['done', 'done', 'current', 'idle'],
  redo: ['done', 'done', 'error', 'idle'],
  approved: ['done', 'done', 'done', 'done']
};

const BANNER = {
  todo: { icon: Info, title: 'Nothing delivered yet', text: 'Upload your finished design. It goes straight to the SME for review.' },
  review: { icon: Hourglass, title: 'Waiting for the SME', text: 'Your file was delivered. The SME will approve it or ask for a redo.' },
  redo: { icon: RotateCcw, title: 'Redo requested', text: 'The SME sent this back. Upload a corrected version below.' },
  approved: { icon: CheckCircle2, title: 'Approved', text: 'The SME approved this design. It is final and can no longer be changed.' }
};

function FilePreview({ file }) {
  if (isImg(file.mimeType)) return <img src={file.url} alt="" loading="lazy" />;
  if (isVid(file.mimeType)) return <video src={file.url} muted preload="metadata" />;
  return <span className="dsu-doc"><FileText size={24} /><small>{typeLabel(file.mimeType)}</small></span>;
}

// Everything about one creative's design delivery: where it stands, the delivered file, the SME's feedback,
// earlier versions, and the uploader. One file per creative; uploading again sends a new version.
export default function DesignUpload({ creative, onChange }) {
  const output = creative.designOutput || null;
  const flow = workflowOf(creative);
  const locked = flow.key === 'approved';
  const banner = BANNER[flow.key];
  const BannerIcon = banner.icon;
  const steps = STEP_STATES[flow.key];
  const due = dueInfo(creative, flow.key);
  // the client's pinned improvements, shown while this design is sent back
  const pins = flow.key === 'redo' ? (creative.clientFeedback?.pins || []) : [];
  const openPins = pins.filter((p) => p.status === 'open');
  const [activePin, setActivePin] = useState('');
  const stepTime = [
    creative.assignedAt,
    output?.uploadedAt,
    ['redo', 'approved'].includes(flow.key) ? output?.reviewedAt : null,
    flow.key === 'approved' ? output?.reviewedAt : null
  ];

  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [localUrl, setLocalUrl] = useState('');
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    if (!file) { setLocalUrl(''); return undefined; }
    const url = URL.createObjectURL(file);
    setLocalUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const clearFile = () => {
    setFile(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const pick = (f) => {
    setMessage({ type: '', text: '' });
    if (!f) return;
    if (!TYPE_LABEL[f.type]) {
      clearFile();
      setMessage({ type: 'error', text: `${f.name} is not supported. Use ${FORMATS}.` });
      return;
    }
    if (f.size > MAX_FILE_MB * 1024 * 1024) {
      clearFile();
      setMessage({ type: 'error', text: `${f.name} is ${formatSize(f.size)}. The limit is ${MAX_FILE_MB} MB.` });
      return;
    }
    setFile(f);
  };

  const upload = async () => {
    if (!file || busy) return;
    const fd = new FormData();
    fd.append('file', file, file.name);
    setBusy(true);
    setProgress(0);
    setMessage({ type: '', text: '' });
    try {
      const res = await api.post(`/des/creatives/${creative._id}/design`, fd, {
        onUploadProgress: (e) => { if (e.total) setProgress(Math.round((e.loaded / e.total) * 100)); }
      });
      onChange(res.data.designOutput);
      clearFile();
      const v = res.data.designOutput?.version;
      setMessage({ type: 'success', text: v ? `Version ${v} sent to the SME for review.` : 'Sent to the SME for review.' });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Upload failed. Please try again.' });
    } finally {
      setBusy(false);
    }
  };

  const nextVersion = (output?.version || 0) + 1;
  const uploadTitle = flow.key === 'redo' ? `Upload version ${nextVersion}` : output ? 'Replace your file' : 'Upload your design';
  const uploadHint = flow.key === 'redo'
    ? 'Fix what the SME asked for. The earlier version stays in the history.'
    : output
      ? 'The SME has not reviewed it yet, so a new file simply replaces the current one.'
      : 'One finished file per creative.';

  return (
    <section className={`dsu ${flow.key}`} aria-label="Design delivery">
      <header className="dsu-head">
        <h4><Palette size={14} /> My design</h4>
        <div className="dsu-tags">
          {due && <span className={`dsu-due ${due.tone}`}><CalendarClock size={12} /> {due.text}</span>}
          {output && (
            <span className="dsu-ver">
              <Layers size={12} /> v{output.version}{output.redoCount ? ` · ${output.redoCount} redo${output.redoCount > 1 ? 's' : ''}` : ''}
            </span>
          )}
        </div>
      </header>

      <div className={`dsu-banner ${flow.key}`} role="status">
        <span className="dsu-banner-icon"><BannerIcon size={18} aria-hidden="true" /></span>
        <div>
          <strong>{banner.title}</strong>
          <span>{banner.text}</span>
          {flow.key === 'redo' && (
            <p className="dsu-quote">
              <b>{output?.redoBy === 'client' ? 'Client’s feedback' : 'SME’s note'}</b>
              {output?.note || 'No note was added.'}
            </p>
          )}
          {flow.key === 'approved' && output?.reviewedAt && <small>Approved {fmtDateTime(output.reviewedAt)}</small>}
        </div>
      </div>

      <ol className="dsu-steps" aria-label="Progress">
        {STEPS.map((st, i) => {
          const Icon = st.icon;
          const state = steps[i];
          const time = stepTime[i];
          return (
            <li key={st.id} className={`dsu-step ${state}`} aria-current={state === 'current' ? 'step' : undefined}>
              <span className="dsu-dot">
                {state === 'done' ? <CheckCircle2 size={14} /> : state === 'error' ? <RotateCcw size={13} /> : <Icon size={13} />}
              </span>
              <span className="dsu-step-label">{i === 2 && flow.key === 'redo' ? 'Redo asked' : st.label}</span>
              <small>{(state === 'done' || state === 'error') && time ? fmtDateTime(time) : state === 'current' ? 'In progress' : ''}</small>
            </li>
          );
        })}
      </ol>

      {output && (
        <div className="dsu-file">
          <a className="dsu-thumb" href={output.url} target="_blank" rel="noopener noreferrer" title="Open delivered file">
            <FilePreview file={output} />
            <span className="dsu-thumb-tag">v{output.version}</span>
          </a>
          <div className="dsu-file-info">
            <b title={output.originalName}>{output.originalName || 'Design file'}</b>
            <div className="dsu-meta">
              <span>{typeLabel(output.mimeType)}</span>
              {output.size ? <span>{formatSize(output.size)}</span> : null}
              <span>Delivered {fmtDateTime(output.uploadedAt)}</span>
            </div>
            <a className="dsu-open" href={output.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={12} /> Open full file</a>
          </div>
        </div>
      )}

      {pins.length > 0 && output && (
        <div className="dfb" aria-label="Client improvements">
          <h3><MessageSquare size={15} /> What the client wants improved <span className="muted">· {openPins.length} open</span></h3>
          {isImg(output.mimeType) && (
            <div className="dfb-stage">
              <img src={output.url} alt="Your delivered design with the client's pins" />
              {pins.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`dfb-pin ${p.status} ${p.id === activePin ? 'active' : ''}`}
                  style={{ left: `${p.x}%`, top: `${p.y}%` }}
                  title={p.text}
                  aria-label={`Client comment ${p.n}: ${p.text}`}
                  onClick={() => setActivePin(p.id)}
                >{p.n}</button>
              ))}
            </div>
          )}
          <ul className="dfb-list">
            {pins.map((p) => (
              <li key={p.id} className={`${p.status} ${p.id === activePin ? 'active' : ''}`} onClick={() => setActivePin(p.id)}>
                <span className="dfb-badge">{p.n}</span>
                <div>
                  <b>{p.author}</b> <small>{fmtDateTime(p.createdAt)}{p.status === 'resolved' ? ' · resolved' : ''}</small>
                  <p>{p.text}</p>
                  {p.replies.map((r) => <p key={r.id} className="dfb-reply"><b>{r.author}:</b> {r.text}</p>)}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!locked && (
        <div className="dsu-upload">
          <div className="dsu-upload-head">
            <strong>{uploadTitle}</strong>
            <span>{uploadHint}</span>
          </div>

          {!file ? (
            <div
              className={`dsu-drop ${dragging ? 'over' : ''}`}
              role="button"
              tabIndex={0}
              onClick={() => inputRef.current?.click()}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click(); } }}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); pick(e.dataTransfer.files?.[0]); }}
            >
              <UploadCloud size={26} />
              <span><b>Drag and drop</b> a file here, or <u>browse</u></span>
              <small>{FORMATS} · one file · up to {MAX_FILE_MB} MB</small>
            </div>
          ) : (
            <div className="dsu-chosen">
              <div className="dsu-thumb small">
                <FilePreview file={{ url: localUrl, mimeType: file.type }} />
              </div>
              <div className="dsu-file-info">
                <b title={file.name}>{file.name}</b>
                <div className="dsu-meta">
                  <span>{typeLabel(file.type)}</span>
                  <span>{formatSize(file.size)}</span>
                  <span>Will be version {nextVersion}</span>
                </div>
                {busy && (
                  <div className="dsu-progress" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
                    <i style={{ width: `${progress}%` }} />
                  </div>
                )}
              </div>
              {!busy && (
                <button type="button" className="dsu-x" onClick={clearFile} aria-label="Remove selected file"><X size={15} /></button>
              )}
            </div>
          )}

          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            hidden
            disabled={busy}
            onChange={(e) => pick(e.target.files?.[0])}
          />

          {file && (
            <button type="button" className="dsu-send" onClick={upload} disabled={busy}>
              {busy ? <LoaderCircle size={16} className="des-spin" /> : <UploadCloud size={16} />}
              {busy ? (progress >= 100 ? 'Processing…' : `Uploading ${progress}%`) : flow.key === 'redo' ? `Send version ${nextVersion} to SME` : 'Send to SME for review'}
            </button>
          )}
        </div>
      )}

      {message.text && (
        <p className={`dsu-msg ${message.type}`} role="alert">
          {message.type === 'error' ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />} {message.text}
        </p>
      )}

      {output?.history?.length > 0 && (
        <details className="dsu-history">
          <summary>
            <Clock3 size={13} /> Earlier versions <span>({output.history.length})</span>
            <ChevronDown size={14} className="dsu-caret" />
          </summary>
          <div className="dsu-hist-list">
            {output.history.map((h) => (
              <div className="dsu-hist-item" key={`${h.version}-${h.url}`}>
                <a className="dsu-thumb tiny" href={h.url} target="_blank" rel="noopener noreferrer" title="Open this version">
                  <FilePreview file={h} />
                </a>
                <div className="dsu-file-info">
                  <b>Version {h.version}</b>
                  <div className="dsu-meta">
                    <span title={h.originalName}>{h.originalName || 'Design file'}</span>
                    {h.size ? <span>{formatSize(h.size)}</span> : null}
                    {h.uploadedAt ? <span>Delivered {fmtDateTime(h.uploadedAt)}</span> : null}
                  </div>
                  {h.note && <p className="dsu-quote"><b>SME’s redo note</b>{h.note}</p>}
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}
