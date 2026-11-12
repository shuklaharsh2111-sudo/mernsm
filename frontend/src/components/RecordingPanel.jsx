import { useState } from 'react';
import { Video, RefreshCw, FileText, ExternalLink, ListChecks, Pencil } from 'lucide-react';
import api from '../api';
import { errMsg, fmtDateTime } from '../sopUtils';
import '../styles/mom.css';

const mins = (ms) => Math.max(1, Math.round((ms || 0) / 60000));

// Tiny markdown view for Grain's AI summary: headings, bullets and plain lines.
const Summary = ({ text }) => {
  const clean = (t) => t.replace(/\*\*(.+?)\*\*/g, '$1').replace(/`/g, '');
  return (
    <div className="rec-summary">
      {text.split('\n').map((raw, i) => {
        const line = raw.trim();
        if (!line) return null;
        if (/^#{1,6}\s/.test(line)) return <h5 key={i}>{clean(line.replace(/^#{1,6}\s+/, ''))}</h5>;
        if (/^[-*•]\s+/.test(line)) return <p key={i} className="rec-bullet">{clean(line.replace(/^[-*•]\s+/, ''))}</p>;
        return <p key={i}>{clean(line)}</p>;
      })}
    </div>
  );
};

// Grain recording of a meeting: video link, AI summary, action items and transcript.
// Pass onUpdated (SME side) to let the SME paste the Grain link + summary.
// showAuto turns on the "Check Grain now" button (only useful once a Grain API token is connected).
export default function RecordingPanel({ meeting, onUpdated, showAuto = false }) {
  const rec = meeting.recording;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [transcript, setTranscript] = useState(null);
  const [editing, setEditing] = useState(false);
  const [url, setUrl] = useState(meeting.recording?.url || '');
  const [summary, setSummary] = useState(meeting.recording?.summary || '');

  if (!rec && !meeting.joined) return null;

  const sync = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await api.post(`/sme/meetings/${meeting.id}/recording/sync`);
      onUpdated?.(res.data.meeting);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const saveManual = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await api.put(`/sme/meetings/${meeting.id}/recording/manual`, { url: url.trim(), summary: summary.trim() });
      onUpdated?.(res.data.meeting);
      setEditing(false);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const toggleTranscript = async () => {
    if (transcript !== null) return setTranscript(null);
    try {
      const res = await api.get(`/sme/meetings/${meeting.id}/recording/transcript`);
      setTranscript(res.data.transcript);
    } catch (err) {
      setError(errMsg(err));
    }
  };

  const ready = rec?.status === 'ready';

  return (
    <section className="rec-panel">
      <div className="rec-head">
        <h4><Video size={15} /> Call recording &amp; AI summary</h4>
        {showAuto && onUpdated && !ready && (
          <button type="button" className="btn-ghost rec-sync" onClick={sync} disabled={busy}>
            <RefreshCw size={13} className={busy ? 'spin' : ''} /> {busy ? 'Checking…' : 'Check Grain now'}
          </button>
        )}
      </div>

      {onUpdated && (!ready || editing) ? (
        <form className="rec-form" onSubmit={saveManual}>
          {!ready && (
            <p className="muted">
              Grain records this call from your calendar. When it ends, open the recording in Grain, then copy its link and the AI
              summary and paste them here to save them with this meeting.
            </p>
          )}
          <input
            type="url"
            value={url}
            maxLength={500}
            placeholder="Grain recording link (https://grain.com/share/…)"
            aria-label="Grain recording link"
            onChange={(e) => setUrl(e.target.value)}
          />
          <textarea
            rows={7}
            value={summary}
            maxLength={20000}
            placeholder="Paste the call summary from Grain"
            aria-label="Call summary"
            onChange={(e) => setSummary(e.target.value)}
          />
          <div className="rec-form-actions">
            <button type="submit" className="btn-primary" disabled={busy || !url.trim() || summary.trim().length < 10}>
              {busy ? 'Saving…' : 'Save recording & summary'}
            </button>
            {editing && (
              <button type="button" className="btn-ghost" onClick={() => setEditing(false)} disabled={busy}>Cancel</button>
            )}
          </div>
        </form>
      ) : !ready ? (
        <p className="muted">The recording and summary have not been added yet.</p>
      ) : null}

      {rec?.url && (
        <div className="rec-video">
          {rec.thumbnailUrl && <img src={rec.thumbnailUrl} alt="" loading="lazy" />}
          <div>
            <b>{rec.title || meeting.subject}</b>
            {rec.durationMs > 0 && <span className="muted"> · {mins(rec.durationMs)} min</span>}
            <a className="rec-watch" href={rec.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink size={13} /> Watch recording
            </a>
          </div>
        </div>
      )}

      {ready && !editing && rec.summary && <Summary text={rec.summary} />}

      {ready && !editing && onUpdated && rec.account === 'manual' && (
        <button type="button" className="rec-link" onClick={() => setEditing(true)}>
          <Pencil size={13} /> Edit link or summary
        </button>
      )}

      {rec?.account === 'default' && <p className="muted" style={{ fontSize: 12 }}>Recorded with the shared test Grain account.</p>}

      {ready && rec.actionItems.length > 0 && (
        <div className="rec-actions">
          <h5><ListChecks size={14} /> Action items</h5>
          <ul>
            {rec.actionItems.map((a, i) => (
              <li key={i}>{a.text}{a.assignee && <span className="muted"> — {a.assignee}</span>}</li>
            ))}
          </ul>
        </div>
      )}

      {ready && rec.hasTranscript && onUpdated && (
        <>
          <button type="button" className="rec-link" onClick={toggleTranscript}>
            <FileText size={13} /> {transcript === null ? 'Show transcript' : 'Hide transcript'}
          </button>
          {transcript !== null && <pre className="rec-transcript">{transcript}</pre>}
        </>
      )}

      {error && <p className="error-message" role="alert">{error}</p>}
    </section>
  );
}
