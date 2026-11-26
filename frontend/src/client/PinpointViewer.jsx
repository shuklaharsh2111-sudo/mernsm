import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { MessageSquare, SlidersHorizontal, ZoomIn, MessageSquarePlus, Check, CheckCircle2, Trash2, Send, X, Minus, Plus, ChevronDown } from 'lucide-react';
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
const MIN_ZOOM = 50;
const MAX_ZOOM = 400;
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
  const [sideTab, setSideTab] = useState('tools'); // 'tools' | 'comments'
  const [box, setBox] = useState(null); // size of the picture area
  const [nat, setNat] = useState(null); // natural size of the image
  const stageRef = useRef(null);
  const canvasRef = useRef(null);
  const [zoomTool, setZoomTool] = useState(false); // drag a box over the picture to zoom into that area
  const [sel, setSel] = useState(null); // the box being drawn, in % of the image
  const zoomRef = useRef(100);
  const anchorRef = useRef(null); // { fx, fy, px, py }: keep image point (fx, fy) under viewport point (px, py) after a zoom
  const draggedRef = useRef(false); // the last mouse press moved: it was a pan or a box, not a click
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

  // keep the picture area's size, so 100% always means "whole image visible"
  useEffect(() => {
    const el = canvasRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setBox({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, [file.isVideo]);

  zoomRef.current = zoom;

  // after the image changes size, put the remembered point back where it was
  useLayoutEffect(() => {
    const a = anchorRef.current;
    const el = canvasRef.current;
    const st = stageRef.current;
    if (!a || !el || !st) return;
    anchorRef.current = null;
    el.scrollLeft = st.offsetLeft + a.fx * st.offsetWidth - a.px;
    el.scrollTop = st.offsetTop + a.fy * st.offsetHeight - a.py;
  }, [zoom, box, nat]); // eslint-disable-line react-hooks/exhaustive-deps

  // zoom to `next`, keeping image point (fx, fy) under viewport point (px, py)
  const zoomTo = (next, fx, fy, px, py) => {
    const v = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(next)));
    if (v === zoomRef.current) return;
    anchorRef.current = { fx, fy, px, py };
    setZoom(v);
  };
  // zoom from the buttons: around the middle of what is on screen
  const zoomBy = (delta) => {
    const el = canvasRef.current;
    const st = stageRef.current;
    if (!el || !st) { setZoom((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z + delta))); return; }
    const px = el.clientWidth / 2;
    const py = el.clientHeight / 2;
    const fx = clamp(((el.scrollLeft + px - st.offsetLeft) / st.offsetWidth) * 100) / 100;
    const fy = clamp(((el.scrollTop + py - st.offsetTop) / st.offsetHeight) * 100) / 100;
    zoomTo(zoomRef.current + delta, fx, fy, px, py);
  };

  // mouse wheel zooms toward the pointer (needs a non-passive listener to stop the page scrolling)
  useEffect(() => {
    const el = canvasRef.current;
    if (!el || file.isVideo) return undefined;
    const onWheel = (e) => {
      const st = stageRef.current;
      if (!st) return;
      e.preventDefault();
      const r = st.getBoundingClientRect();
      const c = el.getBoundingClientRect();
      const fx = clamp(((e.clientX - r.left) / r.width) * 100) / 100;
      const fy = clamp(((e.clientY - r.top) / r.height) * 100) / 100;
      zoomTo(zoomRef.current + (e.deltaY < 0 ? 10 : -10), fx, fy, e.clientX - c.left, e.clientY - c.top);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [file.isVideo]); // eslint-disable-line react-hooks/exhaustive-deps

  // press on the picture: drag = pan (when zoomed in) or, with the Zoom area tool, draw a box to zoom into
  const onCanvasDown = (e) => {
    if (file.isVideo || e.button !== 0 || e.target.closest('.pf-pin')) return;
    const el = canvasRef.current;
    const st = stageRef.current;
    if (!el || !st) return;
    draggedRef.current = false;
    const x0 = e.clientX;
    const y0 = e.clientY;
    const sl = el.scrollLeft;
    const stp = el.scrollTop;
    const r = st.getBoundingClientRect();
    const fx = (x) => clamp(((x - r.left) / r.width) * 100);
    const fy = (y) => clamp(((y - r.top) / r.height) * 100);
    const boxMode = zoomTool;
    if (!boxMode && el.scrollWidth <= el.clientWidth && el.scrollHeight <= el.clientHeight) return; // nothing to pan
    if (boxMode) e.preventDefault();

    const move = (ev) => {
      const dx = ev.clientX - x0;
      const dy = ev.clientY - y0;
      if (Math.abs(dx) + Math.abs(dy) > 4) draggedRef.current = true;
      if (!draggedRef.current) return;
      if (boxMode) {
        setSel({ x0: fx(x0), y0: fy(y0), x1: fx(ev.clientX), y1: fy(ev.clientY) });
      } else {
        el.scrollLeft = sl - dx;
        el.scrollTop = stp - dy;
      }
    };
    const up = (ev) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setSel(null);
      if (!boxMode || !draggedRef.current) return;
      const ax = fx(x0); const bx = fx(ev.clientX);
      const ay = fy(y0); const by = fy(ev.clientY);
      const fw = Math.abs(bx - ax) / 100;
      const fh = Math.abs(by - ay) / 100;
      if (fw < 0.02 || fh < 0.02) return;
      const k = Math.min((el.clientWidth - 44) / (fw * r.width), (el.clientHeight - 44) / (fh * r.height));
      // the middle of the box ends up in the middle of the picture area
      zoomTo(zoomRef.current * k, (ax + bx) / 200, (ay + by) / 200, el.clientWidth / 2, el.clientHeight / 2);
      setZoomTool(false);
      if (canPin) setPinMode(true); // zoomed in: ready to comment on the spot
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const placePin = (e) => {
    if (draggedRef.current) { draggedRef.current = false; return; } // that press was a pan or a zoom box
    if (!canPin || !pinMode || zoomTool || !stageRef.current) return;
    const r = stageRef.current.getBoundingClientRect();
    if (!r.width || !r.height) return;
    setDraft({
      x: clamp(((e.clientX - r.left) / r.width) * 100),
      y: clamp(((e.clientY - r.top) / r.height) * 100)
    });
    setActiveId('');
    setSideTab('comments');
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

  // width at 100% = the largest size where the whole image still fits the picture area
  const fitW = box && nat && nat.w && nat.h ? Math.max(120, Math.min(box.w - 44, (box.h - 44) * (nat.w / nat.h))) : 0;
  const stageW = fitW ? Math.round((fitW * zoom) / 100) : 0;

  const hint = zoomTool
    ? 'Drag a box over the part you want to zoom into'
    : revised
    ? 'Revision sent. Your team is working on a new version'
    : !canPin
    ? 'Pinpoint comments are available on images'
    : pinMode ? 'Click anywhere on the creative to drop a pin' : 'Turn commenting on to drop a pin';

  return (
    <div className="pf">
      {/* LEFT: comments */}
      <aside className="pf-side" aria-label="Feedback" onKeyDown={keepKeysInside}>
        <div className="pf-tabs" role="tablist" aria-label="Review panel">
          <button type="button" role="tab" aria-selected={sideTab === 'tools'} className={sideTab === 'tools' ? 'active' : ''} onClick={() => setSideTab('tools')}>
            <SlidersHorizontal size={14} /> Options
          </button>
          <button type="button" role="tab" aria-selected={sideTab === 'comments'} className={sideTab === 'comments' ? 'active' : ''} onClick={() => setSideTab('comments')}>
            <MessageSquare size={14} /> Comments <span>{comments.length}</span>
          </button>
        </div>

        {sideTab === 'comments' && (
          <div className="pf-side-head">
            <div className="pf-seg" role="tablist">
              <button type="button" role="tab" aria-selected={filter === 'open'} className={filter === 'open' ? 'active' : ''} onClick={() => setFilter('open')}>Open {openCount}</button>
              <button type="button" role="tab" aria-selected={filter === 'resolved'} className={filter === 'resolved' ? 'active' : ''} onClick={() => setFilter('resolved')}>Resolved {resolvedCount}</button>
            </div>
          </div>
        )}

        {sideTab === 'tools' && (
        <div className="pf-tools">
          <div className="pf-toolbar">
            <button
              type="button"
              className={`pf-mode ${pinMode && canPin && !zoomTool ? 'on' : ''}`}
              aria-pressed={pinMode && canPin && !zoomTool}
              disabled={!canPin}
              onClick={() => { setZoomTool(false); setPinMode((v) => (zoomTool ? true : !v)); }}
            >
              <MessageSquarePlus size={15} /> {pinMode && canPin && !zoomTool ? 'Commenting on' : 'Add comment'}
            </button>
            {!file.isVideo && (
              <button
                type="button"
                className={`pf-mode ${zoomTool ? 'on' : ''}`}
                aria-pressed={zoomTool}
                onClick={() => setZoomTool((v) => !v)}
              >
                <ZoomIn size={15} /> {zoomTool ? 'Drag over an area' : 'Zoom area'}
              </button>
            )}
            <span className="pf-hint">{hint}</span>
            <span className="pf-version" title="Version of the design these comments belong to">v{version}</span>
          </div>
          {!file.isVideo && (
            <div className="pf-bottom">
              <label className="pf-switch">
                <input type="checkbox" checked={!showMarkers} onChange={(e) => setShowMarkers(!e.target.checked)} />
                <i aria-hidden="true" />
                Hide markers
              </label>
              <div className="pf-zoom" aria-label="Zoom">
                <button type="button" onClick={() => zoomBy(-10)} disabled={zoom <= MIN_ZOOM} aria-label="Zoom out"><Minus size={14} /></button>
                <button type="button" className="pf-zoom-val" onClick={() => { anchorRef.current = { fx: 0.5, fy: 0.5, px: (canvasRef.current?.clientWidth || 0) / 2, py: (canvasRef.current?.clientHeight || 0) / 2 }; setZoom(100); }} title="Reset zoom (fit whole image)">{zoom}%</button>
                <button type="button" onClick={() => zoomBy(10)} disabled={zoom >= MAX_ZOOM} aria-label="Zoom in"><Plus size={14} /></button>
              </div>
            </div>
          )}
        </div>
        )}

        <div className="pf-side-scroll">
          {error && <p className="error-message" role="alert">{error}</p>}

          {sideTab === 'tools' && (
            <>
          {revised && <p className="pf-note" role="status">Revision sent. The creative stays in Redo until your team sends the new version.</p>}
          {!revised && openCount > 0 && (
            <div className="pf-revise">
              <small>Finished commenting? Send everything to your team.</small>
              <button type="button" className="btn-primary" disabled={sending} onClick={sendRevision}>
                <Send size={14} /> {sending ? 'Sending…' : `Send revision (${openCount})`}
              </button>
            </div>
          )}
            </>
          )}

          {sideTab === 'comments' && (
            <>
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
            </>
          )}

          {sideTab === 'tools' && info && (
            <details className="pf-details">
              <summary>Creative details <ChevronDown size={14} /></summary>
              <div className="pf-details-body">{info}</div>
            </details>
          )}
        </div>
      </aside>

      {/* RIGHT: the creative */}
      <section className="pf-stage-col">
        <div className="pf-canvas-wrap">
          <div className={`pf-canvas ${zoom > 100 && !zoomTool ? 'pan' : ''}`} ref={canvasRef} onPointerDown={onCanvasDown}>
            {file.isVideo ? (
              <video src={file.url} controls playsInline preload="metadata" />
            ) : (
              <div className={`pf-stage ${stageW ? '' : 'fit'} ${pinMode && canPin && !zoomTool ? 'pinning' : ''} ${zoomTool ? 'zooming' : ''}`} ref={stageRef} style={stageW ? { width: `${stageW}px` } : undefined} onClick={placePin}>
                <img src={file.url} alt={file.name || 'Final creative'} draggable={false} onLoad={(e) => setNat({ w: e.target.naturalWidth, h: e.target.naturalHeight })} />
                {showMarkers && shown.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`pf-pin ${c.status} ${c.id === activeId ? 'active' : ''}`}
                    style={{ left: `${c.x}%`, top: `${c.y}%` }}
                    title={`${c.author?.name || 'Comment'}: ${c.text}`}
                    aria-label={`Comment ${c.n}: ${c.text}`}
                    onClick={(e) => { e.stopPropagation(); setFilter(c.status); setActiveId(c.id); setSideTab('comments'); }}
                  >
                    {c.n}
                  </button>
                ))}
                {sel && <span className="pf-sel" style={{ left: `${Math.min(sel.x0, sel.x1)}%`, top: `${Math.min(sel.y0, sel.y1)}%`, width: `${Math.abs(sel.x1 - sel.x0)}%`, height: `${Math.abs(sel.y1 - sel.y0)}%` }} aria-hidden="true" />}
                {draft && <span className="pf-pin draft" style={{ left: `${draft.x}%`, top: `${draft.y}%` }} aria-hidden="true">+</span>}
              </div>
            )}
          </div>
          {arrows}
        </div>

      </section>
    </div>
  );
}
