import { Palette, FileText, ExternalLink, Clock, UserX, CheckCircle2, RotateCcw, Hourglass } from 'lucide-react';
import { fmtDateTime } from '../sopUtils';
import '../styles/admincreatives.css';

// Where the designer's work on an approved creative stands. The SME is the one who reviews the
// designer's file, so "approved" / "redo" here is the SME's call; the admin only watches.
export const designerState = (c) => {
  if (!c.assignedDesigner) return { key: 'unassigned', label: 'No designer assigned', icon: UserX };
  const out = c.designOutput;
  if (!out) return { key: 'working', label: 'Designer working', icon: Hourglass };
  if (out.status === 'approved') return { key: 'approved', label: 'Design approved', icon: CheckCircle2 };
  if (out.status === 'redo') return { key: 'redo', label: 'Redo requested', icon: RotateCcw };
  return { key: 'submitted', label: 'Awaiting SME review', icon: Clock };
};

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
    <span className={`dso-pill ${st.key}`} title={creative.assignedDesigner ? `Designer: ${creative.assignedDesigner.name}` : st.label}>
      <Icon size={11} aria-hidden="true" /> {st.label}
    </span>
  );
}

// Read-only designer section for an approved creative: who the designer is, the status of the
// delivered file, the file itself, and the earlier versions that were sent back for a redo.
export default function DesignerOutputPanel({ creative }) {
  if (creative.status !== 'approved') return null;
  const st = designerState(creative);
  const Icon = st.icon;
  const out = creative.designOutput;
  const designer = creative.assignedDesigner;

  return (
    <section className="dso" aria-label="Designer output">
      <header className="dso-head">
        <h4><Palette size={14} /> Designer output</h4>
        <span className={`dso-pill ${st.key}`}><Icon size={11} aria-hidden="true" /> {st.label}</span>
      </header>

      <div className="dso-meta">
        <div><span>Designer</span><b>{designer ? designer.name : '—'}</b></div>
        {creative.assignedAt && <div><span>Assigned</span><b>{fmtDateTime(creative.assignedAt)}</b></div>}
        {out && <div><span>Delivered</span><b>{fmtDateTime(out.uploadedAt)}</b></div>}
        {out && <div><span>Version</span><b>v{out.version}{out.redoCount ? ` · ${out.redoCount} redo${out.redoCount > 1 ? 's' : ''}` : ''}</b></div>}
      </div>

      {!out ? (
        <p className="dso-empty">
          {designer ? `${designer.name} has not delivered a design yet.` : 'The SME has not assigned a designer to this creative yet.'}
        </p>
      ) : (
        <>
          <div className="dso-file-row">
            <a className="dso-preview" href={out.url} target="_blank" rel="noreferrer noopener" title="Open designer output">
              <Preview file={out} />
            </a>
            <div className="dso-file-info">
              <b>{out.name || 'Design file'}</b>
              <small>{formatSize(out.size)}</small>
              <a className="dso-open" href={out.url} target="_blank" rel="noreferrer noopener"><ExternalLink size={12} /> Open full file</a>
              {out.status === 'redo' && out.note && <p className="dso-note redo">SME asked for a redo: {out.note}</p>}
              {out.status === 'approved' && <p className="dso-note approved">Approved by the SME {fmtDateTime(out.reviewedAt)}.</p>}
              {out.status === 'submitted' && <p className="dso-note">Waiting for the SME to approve or ask for a redo.</p>}
            </div>
          </div>

          {out.history?.length > 0 && (
            <div className="dso-history">
              <h5>Earlier versions · sent back for redo</h5>
              {out.history.map((h) => (
                <div className="dso-hist-item" key={`${h.url}-${h.version}`}>
                  <a className="dso-preview small" href={h.url} target="_blank" rel="noreferrer noopener" title="Open this version"><Preview file={h} /></a>
                  <div className="dso-file-info">
                    <b>v{h.version}</b>
                    <small>{h.name || 'Design file'}{h.size ? ` · ${formatSize(h.size)}` : ''}</small>
                    {h.note && <p className="dso-note redo">Redo note: {h.note}</p>}
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
