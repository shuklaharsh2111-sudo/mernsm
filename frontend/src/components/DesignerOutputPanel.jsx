import { Palette, FileText, ExternalLink, Clock, UserX, CheckCircle2, RotateCcw, Hourglass, UserCheck, Upload, Eye, BadgeCheck, Layers } from 'lucide-react';
import { fmtDateTime } from '../sopUtils';
import '../styles/admincreatives.css';

// Where the designer's work on an approved creative stands. The SME reviews the designer's file,
// so "approved" / "redo" is the SME's call; the admin only watches.
export const designerState = (c) => {
  if (!c.assignedDesigner) {
    return { key: 'unassigned', label: 'No designer assigned', short: 'Not assigned', icon: UserX, text: 'The SME has not assigned a designer to this creative yet.' };
  }
  const out = c.designOutput;
  const name = c.assignedDesigner.name;
  if (!out) return { key: 'working', label: 'Designer working', short: 'In design', icon: Hourglass, text: `${name} is working on it. Nothing has been delivered yet.` };
  if (out.status === 'approved') return { key: 'approved', label: 'Design approved', short: 'Approved', icon: CheckCircle2, text: 'The SME approved the designer’s file. This creative is final.' };
  if (out.status === 'redo') return { key: 'redo', label: 'Redo requested', short: 'Redo', icon: RotateCcw, text: `The SME sent it back. ${name} is working on a new version.` };
  return { key: 'submitted', label: 'Awaiting SME review', short: 'In review', icon: Clock, text: 'Delivered by the designer. Waiting for the SME to approve it or ask for a redo.' };
};

// 4-step tracker. Each step is done / current / error / idle for the given state.
const STEPS = [
  { id: 'assigned', label: 'Assigned', icon: UserCheck },
  { id: 'delivered', label: 'Delivered', icon: Upload },
  { id: 'review', label: 'SME review', icon: Eye },
  { id: 'approved', label: 'Approved', icon: BadgeCheck },
];
const stepStates = (key) => ({
  unassigned: ['idle', 'idle', 'idle', 'idle'],
  working: ['done', 'current', 'idle', 'idle'],
  submitted: ['done', 'done', 'current', 'idle'],
  redo: ['done', 'done', 'error', 'idle'],
  approved: ['done', 'done', 'done', 'done'],
}[key]);

const isImg = (m) => (m || '').startsWith('image/');
const isVid = (m) => (m || '').startsWith('video/');
const formatSize = (bytes) => {
  if (!bytes) return '';
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

function Preview({ file }) {
  if (isImg(file.mimeType)) return <img src={file.url} alt={file.name || 'Designer output'} loading="lazy" />;
  if (isVid(file.mimeType)) return <video src={file.url} controls preload="metadata" />;
  return <span className="dso-file"><FileText size={26} /><small>{file.name || 'Design file'}</small></span>;
}

// Small pill for cards / lists. Renders nothing unless the creative is approved.
export function DesignerStatusPill({ creative }) {
  if (creative.status !== 'approved') return null;
  const st = designerState(creative);
  const Icon = st.icon;
  return (
    <span className={`dso-pill ${st.key}`} title={creative.assignedDesigner ? `Designer: ${creative.assignedDesigner.name} · ${st.label}` : st.label}>
      <Icon size={11} aria-hidden="true" /> {st.label}
    </span>
  );
}

// Read-only designer section for an approved creative.
export default function DesignerOutputPanel({ creative }) {
  if (creative.status !== 'approved') return null;
  const st = designerState(creative);
  const Icon = st.icon;
  const out = creative.designOutput;
  const designer = creative.assignedDesigner;
  const steps = stepStates(st.key);
  const stepTime = [creative.assignedAt, out?.uploadedAt, out && out.status !== 'submitted' ? out.reviewedAt : null, out?.status === 'approved' ? out.reviewedAt : null];

  return (
    <section className={`dso ${st.key}`} aria-label="Designer output">
      <header className="dso-head">
        <h4><Palette size={14} /> Designer output</h4>
        {designer && (
          <span className="dso-designer" title={designer.email || ''}>
            <span className="dso-avatar">{(designer.name || '?').trim().charAt(0).toUpperCase()}</span>
            {designer.name}
          </span>
        )}
      </header>

      <div className={`dso-banner ${st.key}`} role="status">
        <span className="dso-banner-icon"><Icon size={20} aria-hidden="true" /></span>
        <div className="dso-banner-text">
          <strong>{st.label}</strong>
          <span>{st.text}</span>
        </div>
        {out && <span className="dso-ver"><Layers size={12} /> v{out.version}{out.redoCount ? ` · ${out.redoCount} redo${out.redoCount > 1 ? 's' : ''}` : ''}</span>}
      </div>

      <ol className="dso-steps" aria-label="Progress">
        {STEPS.map((s, i) => {
          const StepIcon = s.icon;
          return (
            <li key={s.id} className={`dso-step ${steps[i]}`} aria-current={steps[i] === 'current' ? 'step' : undefined}>
              <span className="dso-step-dot">{steps[i] === 'done' ? <CheckCircle2 size={15} /> : steps[i] === 'error' ? <RotateCcw size={14} /> : <StepIcon size={14} />}</span>
              <span className="dso-step-label">{i === 2 && st.key === 'redo' ? 'Redo asked' : s.label}</span>
              <small>{steps[i] === 'done' || steps[i] === 'error' ? (stepTime[i] ? fmtDateTime(stepTime[i]) : '') : steps[i] === 'current' ? 'In progress' : ''}</small>
            </li>
          );
        })}
      </ol>

      {out && (
        <>
          <div className="dso-file-row">
            <a className="dso-preview" href={out.url} target="_blank" rel="noreferrer noopener" title="Open designer output">
              <Preview file={out} />
              <span className="dso-preview-tag">v{out.version}</span>
            </a>
            <div className="dso-file-info">
              <b>{out.name || 'Design file'}</b>
              <small>{[formatSize(out.size), `Delivered ${fmtDateTime(out.uploadedAt)}`].filter(Boolean).join(' · ')}</small>
              <a className="dso-open" href={out.url} target="_blank" rel="noreferrer noopener"><ExternalLink size={12} /> Open full file</a>
              {out.status === 'redo' && out.note && <p className="dso-note redo"><b>SME’s redo note</b>{out.note}</p>}
              {out.status === 'approved' && out.reviewedAt && <p className="dso-note approved"><b>Approved</b>{fmtDateTime(out.reviewedAt)}</p>}
            </div>
          </div>

          {out.history?.length > 0 && (
            <div className="dso-history">
              <h5>Earlier versions <span>· sent back for redo</span></h5>
              {out.history.map((h) => (
                <div className="dso-hist-item" key={`${h.url}-${h.version}`}>
                  <a className="dso-preview small" href={h.url} target="_blank" rel="noreferrer noopener" title="Open this version"><Preview file={h} /></a>
                  <div className="dso-file-info">
                    <b>Version {h.version}</b>
                    <small>{h.name || 'Design file'}{h.size ? ` · ${formatSize(h.size)}` : ''}</small>
                    {h.note && <p className="dso-note redo"><b>Redo note</b>{h.note}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
