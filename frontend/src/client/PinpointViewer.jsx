import { useEffect, useRef, useState } from 'react';
import { MessageSquarePlus, Check, RotateCcw, Trash2, Send, X } from 'lucide-react';
import api from '../api';
import { errMsg, fmtDateTime } from '../sopUtils';

const MAX_TEXT = 1000;
const ROLE_LABEL = {
  clients: 'Client',
  sme: 'Social media executive',
  smi: 'Social media intern',
  des: 'Designer',
  admin: 'Admin',
  operation_manager: 'Operation manager',
  reporting_manager: 'Reporting manager'
};
const clamp = (n) => Math.min(100, Math.max(0, n));
const roleOf = (p) => ROLE_LABEL[p?.role] || '';

// Keys typed inside a text box must not reach the preview's own shortcuts
// (arrow keys switch creative, Escape closes it).
const keepKeysInside = (e) => {
  if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') e.stopPropagation();
};

function Thread({ c, active, onSelect, onReply, onStatus, onDelete }) {
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const run = async (fn) => {
    setBusy(true);
    try { return await fn(); } finally { setBusy(false); }
  };
  const sendReply = async () => {
    const text = reply.trim();
    if (!text || busy) return;
    const ok = await run(() => onReply(c.id, text));
    if (ok) setReply('');
  };

  return (
    <li id={`pv-c-${c.id}`} className={`pv-thread ${c.status} ${active ? 'active' : ''}`} onClick={() => onSelect(c.id)}>
      <div className="pv-thread-head">
        <span className="pv-badge">{c.n}</span>
        <div className="pv-who">
          <b>{c.author?.name}{c.author?.isMe ? ' (you)' : ''}</b>
          <small>{[roleOf(c.author), fmtDateTime(c.createdAt)].filter(Boolean).join(' · ')}</small>
        </div>
        {c.status === 'resolved' && <span className="pv-resolved-chip"><Check size={11} /> Resolved</span>}
      </div>

      <p className="pv-text">{c.text}</p>

      {c.status === 'resolved' && c.resolvedBy && (
        <small className="pv-meta">Resolved by {c.resolvedBy.isMe ? 'you' : c.resolvedBy.name} · {fmtDateTime(c.resolvedAt)}</small>
      )}

      {c.replies.length > 0 && (
        <ul className="pv-replies">
          {c.replies.map((r) => (
            <li key={r.id}>
              <b>{r.author?.name}{r.author?.isMe ? ' (you)' : ''}</b>
              <small>{[roleOf(r.author), fmtDateTime(r.createdAt)].filter(Boolean).join(' · ')}</small>
              <p>{r.text}</p>
            </li>
          ))}
        </ul>
      )}

      {active && (
        <div className="pv-actions" onClick={(e) => e.stopPropagation()}>
          <div className="pv-reply">
            <textarea
              rows={2}
              maxLength={MAX_TEXT}
              placeholder="Reply…"
              value={reply}
              aria-label={`Reply to comment ${c.n}`}
              onChange={(e) => setReply(e.target.value)}
              onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); sendReply(); } }}
            />
            <button type="button" className="btn-primary pv-send" disabled={busy || !reply.trim()} onClick={sendReply} aria-label="Send reply">
              <Send size={14} />
            </button>
          </div>
          <div className="pv-row">
            <button type="button" className="btn-ghost" disabled={busy} onClick={() => run(() => onStatus(c.id, c.status === 'open' ? 'resolved' : 'open'))}>
              {c.status === 'open' ? <><Check size={14} /> Mark resolved</> : <><RotateCcw size={14} /> Reopen</>}
            </button>
            {c.author?.isMe && (confirmDelete ? (
              <>
                <button type="button" className="btn-ghost pv-danger" disabled={busy} onClick={() => run(() => onDelete(c.id))}><Trash2 size={14} /> Confirm delete</button>
                <button type="button" className="btn-ghost" onClick={() => setConfirmDelete(false)}>Keep</button>
              </>
            ) : (
              <button type="button" className="btn-ghost pv-danger" disabled={busy} onClick={() => setConfirmDelete(true)}><Trash2 size={14} /> Delete</button>
            ))}
          </div>
        </div>
      )}
    </li>
  );
}

// The creative with clickable pins, and the feedback thread list beside it.
// creative: { id, version, file: { url, isVideo, name } }.   arrows / info: extra nodes from the page around it.
export default function PinpointViewer({ creative, arrows = null, info = null }) {
  const { id, file } = creative;
  const canPin = !file.isVideo;

  const [version, setVersion] = useState(creative.version || 1);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pinMode, setPinMode] = useState(true);
  const [draft, setDraft] = useState(null); // { x, y } in % of the image, not saved yet
  const [draftText, setDraftText] = useState('');
  const [posting, setPosting] = useState(false);
  const [activeId, setActiveId] = useState('');
  const [filter, setFilter] = useState('open');
  const stageRef = useRef(null);
  const draftBoxRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    api.get(`/client/creatives/${id}/comments`)
      .then((res) => {
        if (cancelled) return;
        setComments(res.data.comments || []);
        setVersion(res.data.version);
      })
      .catch((e) => !cancelled && setError(errMsg(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [id]);

  // a new pin: bring the text box into view (matters on phones, where it sits below the image)
  useEffect(() => {
    if (!draft) return;
    draftBoxRef.current?.focus();
    draftBoxRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [draft]);

  // a pin was picked: bring its thread into view
  useEffect(() => {
    if (activeId) document.getElementById(`pv-c-${activeId}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activeId]);

  const upsert = (c) => setComments((list) => (list.some((x) => x.id === c.id)
    ? list.map((x) => (x.id === c.id ? c : x))
    : [...list, c].sort((a, b) => a.n - b.n)));

  const openCount = comments.filter((c) => c.status === 'open').length;
  const resolvedCount = comments.length - openCount;
  const shown = comments.filter((c) => c.status === filter);

  const placePin = (e) => {
    if (!canPin || !pinMode || !stageRef.current) return;
    const r = stageRef.current.getBoundingClientRect();
    if (!r.width || !r.height) return;
    setDraft({
      x: clamp(((e.clientX - r.left) / r.width) * 100),
      y: clamp(((e.clientY - r.top) / r.height) * 100)
    });
    setActiveId('');
    setError('');
  };

  const cancelDraft = () => { setDraft(null); setDraftText(''); };

  const submitDraft = async () => {
    const text = draftText.trim();
    if (!draft || !text || posting) return;
    setPosting(true);
    setError('');
    try {
      const res = await api.post(`/client/creatives/${id}/comments`, { x: draft.x, y: draft.y, text });
      upsert(res.data.comment);
      cancelDraft();
      setFilter('open');
      setActiveId(res.data.comment.id);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setPosting(false);
    }
  };

  // Each returns true when it worked, so a thread can clear its own text box.
  const sendReply = async (cid, text) => {
    try {
      const res = await api.post(`/client/creatives/${id}/comments/${cid}/replies`, { text });
      upsert(res.data.comment);
      setError('');
      return true;
    } catch (e) { setError(errMsg(e)); return false; }
  };
  const setStatus = async (cid, status) => {
    try {
      const res = await api.patch(`/client/creatives/${id}/comments/${cid}`, { status });
      upsert(res.data.comment);
      setError('');
      if (status === 'resolved') setActiveId('');
      return true;
    } catch (e) { setError(errMsg(e)); return false; }
  };
  const remove = async (cid) => {
    try {
      await api.delete(`/client/creatives/${id}/comments/${cid}`);
      setComments((list) => list.filter((x) => x.id !== cid));
      setActiveId('');
      setError('');
      return true;
    } catch (e) { setError(errMsg(e)); return false; }
  };

  const hint = !canPin
    ? 'Pinpoint comments are available on images'
    : pinMode ? 'Click anywhere on the creative to drop a pin' : 'Turn commenting on to drop a pin';

  return (
    <div className="cv-body">
      <div className="pv-media-col">
        <div className="pv-toolbar">
          <button
            type="button"
            className={`pv-mode ${pinMode && canPin ? 'on' : ''}`}
            aria-pressed={pinMode && canPin}
            disabled={!canPin}
            onClick={() => setPinMode((v) => !v)}
          >
            <MessageSquarePlus size={15} /> {pinMode && canPin ? 'Commenting on' : 'Add comment'}
          </button>
          <span className="pv-hint">{hint}</span>
          <span className="pv-version" title="Version of the design these comments belong to">v{version}</span>
        </div>

        <div className="cv-media pv-media">
          {file.isVideo ? (
            <video src={file.url} controls playsInline preload="metadata" />
          ) : (
            <div className={`pv-stage ${pinMode ? 'pinning' : ''}`} ref={stageRef} onClick={placePin}>
              <img src={file.url} alt={file.name || 'Final creative'} draggable={false} />
              {shown.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`pv-pin ${c.status} ${c.id === activeId ? 'active' : ''}`}
                  style={{ left: `${c.x}%`, top: `${c.y}%` }}
                  title={`${c.author?.name || 'Comment'}: ${c.text}`}
                  aria-label={`Comment ${c.n}: ${c.text}`}
                  onClick={(e) => { e.stopPropagation(); setActiveId(c.id); }}
                >
                  {c.n}
                </button>
              ))}
              {draft && <span className="pv-pin draft" style={{ left: `${draft.x}%`, top: `${draft.y}%` }} aria-hidden="true">+</span>}
            </div>
          )}
          {arrows}
        </div>
      </div>

      <div className="cv-info">
        <section className="pv-panel" aria-label="Feedback" onKeyDown={keepKeysInside}>
          <div className="pv-panel-head">
            <h3>Feedback</h3>
            <div className="cl-tabs">
              <button type="button" className={filter === 'open' ? 'active' : ''} onClick={() => setFilter('open')}>Open {openCount}</button>
              <button type="button" className={filter === 'resolved' ? 'active' : ''} onClick={() => setFilter('resolved')}>Resolved {resolvedCount}</button>
            </div>
          </div>

          {error && <p className="error-message" role="alert">{error}</p>}

          {draft && (
            <div className="pv-composer">
              <label htmlFor="pv-draft">New comment on the pin you placed</label>
              <textarea
                id="pv-draft"
                ref={draftBoxRef}
                rows={3}
                maxLength={MAX_TEXT}
                placeholder="What should change here?"
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') { e.stopPropagation(); cancelDraft(); }
                  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); submitDraft(); }
                }}
              />
              <div className="pv-row">
                <small className="pv-count">{draftText.length}/{MAX_TEXT}</small>
                <button type="button" className="btn-ghost" onClick={cancelDraft}><X size={14} /> Cancel</button>
                <button type="button" className="btn-primary" disabled={posting || !draftText.trim()} onClick={submitDraft}>
                  <Send size={14} /> {posting ? 'Posting…' : 'Post comment'}
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <p className="muted">Loading comments…</p>
          ) : shown.length === 0 ? (
            <p className="muted pv-empty">
              {filter === 'open'
                ? (canPin ? 'No open comments. Click on the creative to leave one.' : 'No open comments.')
                : 'Nothing has been resolved yet.'}
            </p>
          ) : (
            <ul className="pv-list">
              {shown.map((c) => (
                <Thread
                  key={c.id}
                  c={c}
                  active={c.id === activeId}
                  onSelect={setActiveId}
                  onReply={sendReply}
                  onStatus={setStatus}
                  onDelete={remove}
                />
              ))}
            </ul>
          )}
        </section>

        {info}
      </div>
    </div>
  );
}
