import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Upload, Plus, Eye, EyeOff } from 'lucide-react';
import api from '../api';
import PlatformPreviewSwitcher from './PlatformPreviewSwitcher';
import TagInput from './TagInput';
import { errMsg, fmtDay } from '../sopUtils';

const MAX_FILES = 5;
const MAX_SIZE = 5 * 1024 * 1024;
const MAX_LINKS = 5;
const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const LINK_RE = /^https?:\/\/\S+\.\S+$/i;

// Add a reference creative to one calendar day of one brand.
// platforms = [{ key, label, icon }] — the same list the calendar uses.
// With `editing` (a creative the admin sent back for a redo) the form opens filled in with that same creative;
// saving updates it and sends it to the admin again.
export default function ReferenceCreativeModal({ company, date, platforms, defaultPlatform = '', editing = null, onSaved, onClose }) {
  const pillar = editing?.contentPillar;
  const [title, setTitle] = useState(pillar?.title || '');
  const [caption, setCaption] = useState(pillar?.caption || '');
  const [hashtags, setHashtags] = useState(pillar?.hashtags || []);
  const [keywords, setKeywords] = useState(pillar?.keywords || []);
  const [links, setLinks] = useState(editing?.referenceLinks?.length ? editing.referenceLinks : ['']);
  const [picked, setPicked] = useState(pillar?.platforms || (defaultPlatform ? [defaultPlatform] : [])); // platform keys ticked (multi-select)
  const [activeKey, setActiveKey] = useState(pillar?.platforms?.[0] || defaultPlatform || ''); // platform whose preview is shown large
  const [files, setFiles] = useState([]); // newly chosen images
  const [kept, setKept] = useState(editing?.uploads || []); // images already saved on the creative being edited
  const [showPreview, setShowPreview] = useState(true); // toggle the preview column
  const [cover, setCover] = useState(0); // which uploaded image the previews show
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);
  // saved images first, then the new ones: one list for thumbnails and previews
  const images = useMemo(
    () => [
      ...kept.map((u) => ({ src: u.url, name: u.name || 'Saved image', saved: true })),
      ...files.map((f, i) => ({ src: previews[i], name: f.name, saved: false })),
    ],
    [kept, files, previews]
  );

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const errors = useMemo(() => {
    const e = { title: '', platforms: '', links: links.map(() => '') };
    if (!title.trim()) e.title = 'Title is required';
    if (!picked.length) e.platforms = 'Select at least one platform';
    links.forEach((l, i) => {
      if (l.trim() && !LINK_RE.test(l.trim())) e.links[i] = 'Enter a valid link starting with http:// or https://';
    });
    return e;
  }, [title, picked, links]);
  const valid = !errors.title && !errors.platforms && !errors.links.some(Boolean);
  const show = (k) => (submitted || touched[k]) && errors[k];
  const showLink = (i) => (submitted || touched[`link-${i}`]) && errors.links[i];
  const touch = (k) => () => setTouched((t) => ({ ...t, [k]: true }));

  // Clicking a platform option ticks it AND shows its preview large.
  const togglePlatform = (key) => {
    setTouched((t) => ({ ...t, platforms: true }));
    if (picked.includes(key)) {
      const rest = picked.filter((k) => k !== key);
      setPicked(rest);
      if (activeKey === key) setActiveKey(rest[0] || '');
    } else {
      setPicked([...picked, key]);
      setActiveKey(key);
      setShowPreview(true);
    }
  };

  const addFiles = (e) => {
    const chosen = Array.from(e.target.files || []);
    e.target.value = '';
    let msg = '';
    const next = [...files];
    for (const f of chosen) {
      if (!TYPES.includes(f.type)) { msg = 'Only JPG, PNG, WEBP and GIF images are allowed'; continue; }
      if (f.size > MAX_SIZE) { msg = `${f.name} is larger than 5 MB`; continue; }
      if (kept.length + next.length >= MAX_FILES) { msg = `You can upload up to ${MAX_FILES} images`; break; }
      next.push(f);
    }
    setFiles(next);
    setCover((c) => Math.min(c, Math.max(next.length - 1, 0)));
    setError(msg);
  };

  const setLink = (i, v) => setLinks((l) => l.map((x, j) => (j === i ? v : x)));
  const removeLink = (i) => setLinks((l) => (l.length === 1 ? [''] : l.filter((_, j) => j !== i)));

  const submit = async (e) => {
    e.preventDefault();
    setSubmitted(true);
    if (!valid) return;
    setBusy(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('companyId', company.id);
      fd.append('date', date);
      fd.append('title', title.trim());
      fd.append('caption', caption.trim());
      fd.append('hashtags', JSON.stringify(hashtags));
      fd.append('keywords', JSON.stringify(keywords));
      fd.append('referenceLinks', JSON.stringify(links.map((l) => l.trim()).filter(Boolean)));
      fd.append('platforms', JSON.stringify(picked));
      if (editing) fd.append('keepUploads', JSON.stringify(kept.map((u) => u.url)));
      files.forEach((f) => fd.append('files', f));
      const cfg = { headers: { 'Content-Type': 'multipart/form-data' } };
      const res = editing ? await api.put(`/sme/creatives/${editing.id}`, fd, cfg) : await api.post('/sme/creatives', fd, cfg);
      onSaved(res.data.creative);
    } catch (err) {
      setError(errMsg(err));
      setBusy(false);
    }
  };

  // Preview shows the ticked platforms; before any is ticked it shows the default (first) platform.
  const previewPlatforms = picked.length ? platforms.filter((p) => picked.includes(p.key)) : [platforms[0]];

  return createPortal(
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className={`modal-card creative-wide ${showPreview ? '' : 'compact'}`} role="dialog" aria-modal="true" aria-labelledby="creative-title" onSubmit={submit} noValidate>
        <div className="modal-head">
          <div>
            <h2 id="creative-title">{editing ? 'Edit Creative' : 'Reference Creative'}</h2>
            <p className="creative-sub">{company.name} · {fmtDay(date)}</p>
          </div>
          <div className="creative-head-actions">
            <button
              type="button"
              className={`creative-toggle ${showPreview ? 'on' : ''}`}
              aria-pressed={showPreview}
              onClick={() => setShowPreview((v) => !v)}
              title={showPreview ? 'Hide preview' : 'Show preview'}
            >
              {showPreview ? <EyeOff size={15} /> : <Eye size={15} />} {showPreview ? 'Hide preview' : 'Show preview'}
            </button>
            <button type="button" className="modal-close" aria-label="Close" onClick={onClose}><X size={16} /></button>
          </div>
        </div>

        <div className={`modal-body creative-layout ${showPreview ? '' : 'no-preview'}`}>
          <div className="creative-col">
            {/* Upload */}
            <div className="x-field">
              <span>Upload reference <small className="creative-opt">(optional · up to {MAX_FILES} images, 5 MB each)</small></span>
              <input ref={fileRef} type="file" accept={TYPES.join(',')} multiple hidden onChange={addFiles} />
              <button type="button" className="creative-drop" onClick={() => fileRef.current?.click()} disabled={images.length >= MAX_FILES}>
                <Upload size={18} /> Choose images
              </button>
              {images.length > 0 && (
                <div className="creative-thumbs">
                  {images.map((im, i) => (
                    <div className={`creative-thumb ${i === cover ? 'cover' : ''}`} key={`${im.src}-${i}`}>
                      <img src={im.src} alt={im.name} title="Use for preview" onClick={() => setCover(i)} />
                      <button
                        type="button"
                        aria-label={`Remove ${im.name}`}
                        onClick={() => {
                          if (im.saved) setKept((l) => l.filter((u) => u.url !== im.src));
                          else setFiles((l) => l.filter((_, j) => j !== i - kept.length));
                          setCover(0);
                        }}
                      ><X size={12} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Content */}
            <div className="creative-pillar">
              <h3>Content</h3>

              <label className={`x-field ${show('title') ? 'invalid' : ''}`}>
                <span>Title <em className="req">*</em></span>
                <input type="text" value={title} maxLength={120} placeholder="e.g. Product launch teaser" onChange={(e) => setTitle(e.target.value)} onBlur={touch('title')} />
                {show('title') && <small className="field-error">{errors.title}</small>}
              </label>

              <label className="x-field">
                <span>Caption <small className="creative-opt">({caption.length}/2200)</small></span>
                <textarea value={caption} maxLength={2200} placeholder="Write the caption for the post" onChange={(e) => setCaption(e.target.value)} />
              </label>

              <div className="x-field">
                <span>Hashtags <small className="creative-opt">(press Enter or space to add)</small></span>
                <TagInput value={hashtags} onChange={setHashtags} prefix="#" max={30} placeholder="#launch #newarrival" ariaLabel="Hashtags" />
              </div>

              <div className="x-field">
                <span>Keywords <small className="creative-opt">(press Enter or comma to add)</small></span>
                <TagInput value={keywords} onChange={setKeywords} max={20} placeholder="e.g. summer sale" ariaLabel="Keywords" />
              </div>

              <div className="x-field">
                <span className="creative-links-head">
                  Reference links <small className="creative-opt">(optional · up to {MAX_LINKS})</small>
                  <button type="button" className="attendee-add" title="Add link" aria-label="Add link" disabled={links.length >= MAX_LINKS} onClick={() => setLinks((l) => [...l, ''])}><Plus size={16} /></button>
                </span>
                {links.map((l, i) => (
                  <div key={i} className="creative-link-row">
                    <input
                      type="url"
                      className={showLink(i) ? 'invalid' : ''}
                      value={l}
                      maxLength={500}
                      placeholder="https://…"
                      aria-label={`Reference link ${i + 1}`}
                      onChange={(e) => setLink(i, e.target.value)}
                      onBlur={touch(`link-${i}`)}
                    />
                    <button type="button" className="attendee-remove" aria-label={`Remove link ${i + 1}`} onClick={() => removeLink(i)}><X size={14} /></button>
                    {showLink(i) && <small className="field-error">{errors.links[i]}</small>}
                  </div>
                ))}
              </div>

              <div className={`x-field ${show('platforms') ? 'invalid' : ''}`}>
                <span>Platforms <em className="req">*</em> <small className="creative-opt">(click to tick one or more and see its preview)</small></span>
                <div className="creative-platforms" role="group" aria-label="Platforms">
                  {platforms.map(({ key, label, icon: Icon }) => {
                    const on = picked.includes(key);
                    return (
                      <label key={key} className={`creative-check ${on ? 'on' : ''} ${on && activeKey === key ? 'viewing' : ''}`}>
                        <input type="checkbox" checked={on} onChange={() => togglePlatform(key)} />
                        <Icon size={16} />
                        <b>{label}</b>
                      </label>
                    );
                  })}
                </div>
                {show('platforms') && <small className="field-error">{errors.platforms}</small>}
              </div>
            </div>

            {error && <p className="error-message" role="alert">{error}</p>}
          </div>

          {showPreview && (
            <aside className="creative-col creative-preview" aria-label="Preview">
              <h3>Preview</h3>
              <PlatformPreviewSwitcher
                platforms={previewPlatforms}
                image={images[cover]?.src}
                title={title.trim()}
                caption={caption.trim()}
                hashtags={hashtags}
                activeKey={activeKey}
                onActiveChange={setActiveKey}
              />
              {picked.length === 0 && <p className="modal-hint">Default preview. Click a platform to choose where this creative goes.</p>}
              {images.length > 1 && <p className="modal-hint">Click an image on the right to choose which one is previewed.</p>}
            </aside>
          )}
        </div>

        <div className="modal-foot">
          <span className="creative-foot-note">{editing ? 'Saving sends this same creative back to the admin for approval.' : 'Goes to the admin for approval. It shows on the calendar as Pending.'}</span>
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={busy || !valid} title={valid ? '' : 'Fill in the title and pick a platform'}>
            {busy ? 'Sending…' : editing ? 'Save & Resubmit' : 'Save & Send for Approval'}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}