import { useEffect, useRef, useState } from 'react';
import { MessageSquarePlus, Check, CheckCircle2, Trash2, Send, X, Minus, Plus, ChevronDown } from 'lucide-react';
import api from '../api';
import { errMsg, fmtDateTime } from '../sopUtils';
import '../styles/pinfeedback.css';

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

const AV_COLORS = ['#f26b0f', '#d92d0a', '#c2410c', '#a16207', '#0f766e', '#6d28d9', '#be185d'];
const initialsOf = (name = '') => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('') || '?';
const colorOf = (name = '') => AV_COLORS[[...name].reduce((n, ch) => n + ch.charCodeAt(0), 0) % AV_COLORS.length];

function Avatar({ name, small = false }) {
  return <span className={`pf-av ${small ? 'small' : ''}`} style={{ background: colorOf(name) }} aria-hidden="true">{initialsOf(name)}</span>;
}

// One comment card: avatar, name, text, resolve tick; replies sit underneath, indented.
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
  const resolved = c.status === 'resolved';

  return (
    <li id={`pv-c-${c.id}`} className={`pf-thread ${c.status} ${active ? 'active' : ''}`} onClick={() => onSelect(c.id)}>
      <div className="pf-c-head">
        <Avatar name={c.author?.name} />
        <div className="pf-c-who">
          <b>{c.author?.name}{c.author?.isMe ? ' (you)' : ''}</b>
          <small>{[roleOf(c.author), fmtDateTime(c.createdAt)].filter(Boolean).join(' · ')}</small>
        </div>
        <span className="pf-c-num" title={`Marker ${c.n} on the creative`}>{c.n}</span>
        <button
          type="button"
          className={`pf-tick ${resolved ? 'on' : ''}`}
          disabled={busy}
          title={resolved ? 'Reopen this comment' : 'Mark as resolved'}
          aria-label={resolved ? `Reopen comment ${c.n}` : `Resolve comment ${c.n}`}
          onClick={(e) => { e.stopPropagation(); run(() => onStatus(c.id, resolved ? 'open' : 'resolved')); }}
        >
          <CheckCircle2 size={18} />
        </button>
      </div>

      <p className="pf-c-text">{c.text}</p>

      {resolved && c.resolvedBy && (
        <small className="pf-c-meta"><Check size={11} /> Resolved by {c.resolvedBy.isMe ? 'you' : c.resolvedBy.name} · {fmtDateTime(c.resolvedAt)}</small>
      )}

      {c.replies.length > 0 && (
        <ul className="pf-replies">
          {c.replies.map((r) => (
            <li key={r.id}>
              <Avatar name={r.author?.name} small />
              <div>
                <b>{r.author?.name}{r.author?.isMe ? ' (you)' : ''}</b>
                <small>{[roleOf(r.author), fmtDateTime(r.createdAt)].filter(Boolean).join(' · ')}</small>
                <p>{r.text}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {active && (
        <div className="pf-reply-wrap" onClick={(e) => e.stopPropagation()}>
          <div className="pf-reply">
            <textarea
              rows={1}
              maxLength={MAX_TEXT}
              placeholder="Reply…"
              value={reply}
              aria-label={`Reply to comment ${c.n}`}
              onChange={(e) => setReply(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
            />
            <button type="button" disabled={busy || !reply.trim()} onClick={sendReply} aria-label="Send reply"><Send size={14} /></button>
          </div>
          {c.author?.isMe && (confirmDelete ? (
            <div className="pf-confirm">
              <span>Delete this comment?</span>
              <button type="button" className="danger" disabled={busy} onClick={() => run(() => onDelete(c.id))}>Delete</button>
              <button type="button" onClick={() => setConfirmDelete(false)}>Keep</button>
            </div>
          ) : (
            <button type="button" className="pf-del" disabled={busy} onClick={() => setConfirmDelete(true)}><Trash2 size={13} /> Delete comment</button>
          ))}
        </div>
      )}
    </li>
  );
}

// The creative with clickable pins, and the feedback thread list beside it.
// creative: { id, version, file: { url, isVideo, name } }.   arrows / info: extra nodes from the page around it.
export default function PinpointViewer({ creative, arrows = null, info = null, onOpenCount = null, onRevisionSent = null }) {
  const { id, file } = creative;
  const revised = !!creative.revisionSent; // the revision already went to the team
  const canPin = !file.isVideo && !revised;

  const [version, setVersion] = useState(creative.version || 1);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pinMode, setPinMode] = useState(true);
  const [draft, setDraft] = useState(null); // { x, y } in % of the image, not saved yet
  const [draftText, setDraftText] = useState('');
  const [posting, setPosting] = useState(false);
  const [sending, setSending] = useState(false);
  const [activeId, setActiveId] = useState('');
  const [filter, setFilter] = useState('open');
  const [showMarkers, setShowMarkers] = useState(true);
  const [zoom, setZoom] = useState(100);
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
  // tell the page, so the creative's status badge follows the pins right away
  useEffect(() => {
    if (!loading && onOpenCount) onOpenCount(id, openCount);
  }, [loading, openCount]); // eslint-disable-line react-hooks/exhaustive-deps
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

  const sendRevision = async () => {
    if (sending || openCount === 0) return;
    setSending(true);
    setError('');
    try {
      await api.post(`/client/creatives/${id}/revision`);
      cancelDraft();
      if (onRevisionSent) onRevisionSent(id);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setSending(false);
    }
  };

  const hint = revised
    ? 'Revision sent. Your team is working on a new version'
    : !canPin
    ? 'Pinpoint comments are available on images'
    : pinMode ? 'Click anywhere on the creative to drop a pin' : 'Turn commenting on to drop a pin';

  return (
    <div className="pf">
      {/* LEFT: comments */}
      <aside className="pf-side" aria-label="Feedback" onKeyDown={keepKeysInside}>
        <div className="pf-side-head">
          <h3>Comments <span>{comments.length}</span></h3>
          <div className="pf-seg" role="tablist">
            <button type="button" role="tab" aria-selected={filter === 'open'} className={filter === 'open' ? 'active' : ''} onClick={() => setFilter('open')}>Open {openCount}</button>
            <button type="button" role="tab" aria-selected={filter === 'resolved'} className={filter === 'resolved' ? 'active' : ''} onClick={() => setFilter('resolved')}>Resolved {resolvedCount}</button>
          </div>
        </div>

        <div className="pf-side-scroll">
          {error && <p className="error-message" role="alert">{error}</p>}

          {revised && <p className="pf-note" role="status">Revision sent. The creative stays in Redo until your team sends the new version.</p>}
          {!revised && openCount > 0 && (
            <div className="pf-revise">
              <small>Finished commenting? Send everything to your team.</small>
              <button type="button" className="btn-primary" disabled={sending} onClick={sendRevision}>
                <Send size={14} /> {sending ? 'Sending…' : `Send revision (${openCount})`}
              </button>
            </div>
          )}

          {draft && (
            <div className="pf-composer">
              <div className="pf-c-head">
                <Avatar name="You" />
                <label htmlFor="pv-draft">New comment on the marker you placed</label>
              </div>
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
              <div className="pf-composer-row">
                <small>{draftText.length}/{MAX_TEXT}</small>
                <button type="button" className="btn-ghost" onClick={cancelDraft}><X size={14} /> Cancel</button>
                <button type="button" className="btn-primary" disabled={posting || !draftText.trim()} onClick={submitDraft}>
                  <Send size={14} /> {posting ? 'Posting…' : 'Comment'}
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <p className="pf-empty">Loading comments…</p>
          ) : shown.length === 0 && !draft ? (
            <div className="pf-empty">
              <MessageSquarePlus size={22} />
              <p>
                {filter === 'open'
                  ? (canPin ? 'No open comments yet. Click anywhere on the creative to leave one.' : 'No open comments.')
                  : 'Nothing has been resolved yet.'}
              </p>
            </div>
          ) : (
            <ul className="pf-list">
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

          {info && (
            <details className="pf-details">
              <summary>Creative details <ChevronDown size={14} /></summary>
              <div className="pf-details-body">{info}</div>
            </details>
          )}
        </div>
      </aside>

      {/* RIGHT: the creative */}
      <section className="pf-stage-col">
        <div className="pf-toolbar">
          <button
            type="button"
            className={`pf-mode ${pinMode && canPin ? 'on' : ''}`}
            aria-pressed={pinMode && canPin}
            disabled={!canPin}
            onClick={() => setPinMode((v) => !v)}
          >
            <MessageSquarePlus size={15} /> {pinMode && canPin ? 'Commenting on' : 'Add comment'}
          </button>
          <span className="pf-hint">{hint}</span>
          <span className="pf-version" title="Version of the design these comments belong to">v{version}</span>
        </div>

        <div className="pf-canvas-wrap">
          <div className="pf-canvas">
            {file.isVideo ? (
              <video src={file.url} controls playsInline preload="metadata" />
            ) : (
              <div className={`pf-stage ${pinMode && canPin ? 'pinning' : ''}`} ref={stageRef} style={{ width: `${zoom}%` }} onClick={placePin}>
                <img src={file.url} alt={file.name || 'Final creative'} draggable={false} />
                {showMarkers && shown.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`pf-pin ${c.status} ${c.id === activeId ? 'active' : ''}`}
                    style={{ left: `${c.x}%`, top: `${c.y}%` }}
                    title={`${c.author?.name || 'Comment'}: ${c.text}`}
                    aria-label={`Comment ${c.n}: ${c.text}`}
                    onClick={(e) => { e.stopPropagation(); setActiveId(c.id); }}
                  >
                    {c.n}
                  </button>
                ))}
                {draft && <span className="pf-pin draft" style={{ left: `${draft.x}%`, top: `${draft.y}%` }} aria-hidden="true">+</span>}
              </div>
            )}
          </div>
          {arrows}
        </div>

        {!file.isVideo && (
          <div className="pf-bottom">
            <label className="pf-switch">
              <input type="checkbox" checked={!showMarkers} onChange={(e) => setShowMarkers(!e.target.checked)} />
              <i aria-hidden="true" />
              Hide markers
            </label>
            <div className="pf-zoom" aria-label="Zoom">
              <button type="button" onClick={() => setZoom((z) => Math.max(50, z - 25))} disabled={zoom <= 50} aria-label="Zoom out"><Minus size={14} /></button>
              <button type="button" className="pf-zoom-val" onClick={() => setZoom(100)} title="Reset zoom">{zoom}%</button>
              <button type="button" onClick={() => setZoom((z) => Math.min(250, z + 25))} disabled={zoom >= 250} aria-label="Zoom in"><Plus size={14} /></button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
