import { useEffect, useMemo, useState } from 'react';
import {
  ThumbsUp, ThumbsDown, Eye, EyeOff, Search, X, Clock, Check, RotateCcw, Layers,
  ChevronDown, ChevronUp, CalendarDays, User, Building2, Image as ImageIcon, TriangleAlert,
} from 'lucide-react';
import CreativeDetails from '../components/CreativeDetails';
import api from '../api';
import PlatformPreviewSwitcher from '../components/PlatformPreviewSwitcher';
import { PLATFORMS } from '../components/creativePlatforms';
import { errMsg, fmtDay, fmtDateTime } from '../sopUtils';
import '../style.css';
import '../styles/mom.css';
import '../styles/calendar.css';
import '../styles/admincreatives.css';

const TABS = [
  { value: 'pending', label: 'Pending', hint: 'Needs your review', icon: Clock },
  { value: 'approved', label: 'Approved', hint: 'Saved on calendars', icon: Check },
  { value: 'rejected', label: 'Rejected', hint: 'Sent back for redo', icon: RotateCcw },
  { value: 'all', label: 'All', hint: 'Everything submitted', icon: Layers },
];

const SORTS = [
  { value: 'oldest', label: 'Oldest submitted first' },
  { value: 'newest', label: 'Newest submitted first' },
  { value: 'date', label: 'Scheduled date' },
];

const GROUPS = [
  { value: 'none', label: 'No grouping' },
  { value: 'company', label: 'Group by company' },
  { value: 'sme', label: 'Group by SME' },
  { value: 'date', label: 'Group by scheduled date' },
];

const dayKey = (c) => String(c.date || '').slice(0, 10);
const ts = (c) => new Date(c.submittedAt || 0).getTime();

// "Waiting 3d" / "2h" style age for the review queue, plus a level so old items stand out.
const waiting = (iso) => {
  if (!iso) return null;
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  const days = Math.floor(mins / 1440);
  const label = days >= 1 ? `${days}d` : mins >= 60 ? `${Math.floor(mins / 60)}h` : `${mins}m`;
  return { label, level: days >= 3 ? 'late' : days >= 1 ? 'warn' : 'ok' };
};

const AdminCreatives = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [tab, setTab] = useState('pending');
  const [busyId, setBusyId] = useState('');
  const [rejecting, setRejecting] = useState('');
  const [note, setNote] = useState('');
  const [expanded, setExpanded] = useState({}); // id -> details open
  const [open, setOpen] = useState({}); // id -> platform preview shown

  const [q, setQ] = useState('');
  const [company, setCompany] = useState('all');
  const [sme, setSme] = useState('all');
  const [sort, setSort] = useState('oldest');
  const [group, setGroup] = useState('company');

  useEffect(() => {
    let cancelled = false;
    api.get('/admin/creatives')
      .then((r) => !cancelled && setItems(r.data.creatives))
      .catch((err) => !cancelled && setError(errMsg(err)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const counts = useMemo(() => {
    const c = { all: items.length, pending: 0, approved: 0, rejected: 0 };
    items.forEach((i) => (c[i.status] += 1));
    return c;
  }, [items]);

  const oldestPending = useMemo(() => {
    const p = items.filter((i) => i.status === 'pending');
    return p.length ? waiting(p.reduce((a, b) => (ts(a) < ts(b) ? a : b)).submittedAt) : null;
  }, [items]);

  const companies = useMemo(() => [...new Set(items.map((i) => i.company.name))].sort(), [items]);
  const smes = useMemo(() => [...new Set(items.map((i) => i.sme.name))].sort(), [items]);

  const shown = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const list = items.filter((c) => {
      if (tab !== 'all' && c.status !== tab) return false;
      if (company !== 'all' && c.company.name !== company) return false;
      if (sme !== 'all' && c.sme.name !== sme) return false;
      if (!words.length) return true;
      const p = c.contentPillar;
      const hay = [p.title, p.caption, ...(p.hashtags || []), ...(p.keywords || []), c.company.name, c.sme.name].join(' ').toLowerCase();
      return words.every((w) => hay.includes(w));
    });
    const cmp = {
      oldest: (a, b) => ts(a) - ts(b),
      newest: (a, b) => ts(b) - ts(a),
      date: (a, b) => dayKey(a).localeCompare(dayKey(b)) || ts(a) - ts(b),
    }[sort];
    return list.sort(cmp);
  }, [items, tab, company, sme, q, sort]);

  const groups = useMemo(() => {
    if (group === 'none') return [{ key: 'all', label: '', items: shown }];
    const keyOf = { company: (c) => c.company.name, sme: (c) => c.sme.name, date: dayKey }[group];
    const map = new Map();
    shown.forEach((c) => {
      const k = keyOf(c) || 'Unscheduled';
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(c);
    });
    const arr = [...map.entries()].map(([key, list]) => ({ key, label: group === 'date' && key !== 'Unscheduled' ? fmtDay(key) : key, items: list }));
    return group === 'date' ? arr.sort((a, b) => a.key.localeCompare(b.key)) : arr.sort((a, b) => a.label.localeCompare(b.label));
  }, [shown, group]);

  const filtered = q.trim() || company !== 'all' || sme !== 'all';
  const clearFilters = () => { setQ(''); setCompany('all'); setSme('all'); };

  const review = async (c, action) => {
    setBusyId(c.id);
    setError('');
    setSuccess('');
    try {
      const res = await api.put(`/admin/creatives/${c.id}/${action}`, action === 'reject' ? { note } : {});
      setItems((list) => list.map((x) => (x.id === c.id ? res.data.creative : x)));
      setRejecting('');
      setNote('');
      setSuccess(action === 'approve' ? `Approved. It is now on ${c.sme.name}’s calendar for ${fmtDay(c.date)}.` : `Rejected. ${c.sme.name} can see your reason.`);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusyId('');
    }
  };

  const renderCard = (c) => {
    const { title, caption, platforms: keys } = c.contentPillar;
    const isOpen = Boolean(expanded[c.id]);
    const showPrev = Boolean(open[c.id]);
    const wait = c.status === 'pending' ? waiting(c.submittedAt) : null;
    const cover = c.uploads[0];
    return (
      <article key={c.id} className={`acq-card ${c.status}`}>
        <div className="acq-main">
          <div className="acq-thumb">
            {cover ? (
              <a href={cover.url} target="_blank" rel="noreferrer noopener" title="Open full image"><img src={cover.url} alt={cover.name || 'Reference'} loading="lazy" /></a>
            ) : (
              <span className="acq-thumb-empty"><ImageIcon size={22} /><small>No image</small></span>
            )}
            {c.uploads.length > 1 && <span className="acq-thumb-count">+{c.uploads.length - 1}</span>}
          </div>

          <div className="acq-body">
            <div className="acq-top">
              <h3 className="acq-title">{title || 'Untitled creative'}</h3>
              <div className="acq-badges">
                {wait && <span className={`acq-wait ${wait.level}`} title={`Submitted ${fmtDateTime(c.submittedAt)}`}>{wait.level === 'late' && <TriangleAlert size={11} />} Waiting {wait.label}</span>}
                <span className={`status-pill ${c.status}`}>{c.status}</span>
              </div>
            </div>

            <div className="acq-meta">
              <span><Building2 size={13} /> {c.company.name}</span>
              <span><User size={13} /> {c.sme.name}</span>
              <span><CalendarDays size={13} /> For {fmtDay(dayKey(c))}</span>
              <span className="acq-sub">Submitted {fmtDateTime(c.submittedAt)}</span>
            </div>

            {caption && <p className={`acq-caption ${isOpen ? 'full' : ''}`}>{caption}</p>}

            <div className="acq-foot-row">
              <div className="acq-platforms">
                {keys.map((pk) => {
                  const P = PLATFORMS.find((p) => p.key === pk);
                  return P ? <span key={pk} className="creative-chip"><P.icon size={13} /> {P.label}</span> : null;
                })}
              </div>
              <button type="button" className="acq-toggle" aria-expanded={isOpen} onClick={() => setExpanded((o) => ({ ...o, [c.id]: !o[c.id] }))}>
                {isOpen ? <>Hide details <ChevronUp size={14} /></> : <>View details <ChevronDown size={14} /></>}
              </button>
            </div>
          </div>
        </div>

        {isOpen && (
          <div className="acq-details">
            <div className="acq-section">
              <h4>Content</h4>
              <CreativeDetails creative={c} />
            </div>

            {c.uploads.length > 0 && (
              <div className="acq-section">
                <h4>References ({c.uploads.length})</h4>
                <div className="creative-thumbs">
                  {c.uploads.map((u, i) => (
                    <a key={u.url + i} className="creative-thumb" href={u.url} target="_blank" rel="noreferrer noopener" title={u.name}><img src={u.url} alt={u.name || 'Reference'} /></a>
                  ))}
                </div>
              </div>
            )}

            <div className="acq-section">
              <h4>Platform preview</h4>
              <button type="button" className="btn-ghost creative-prev-btn" aria-pressed={showPrev} onClick={() => setOpen((o) => ({ ...o, [c.id]: !o[c.id] }))}>
                {showPrev ? <EyeOff size={14} /> : <Eye size={14} />} {showPrev ? 'Hide preview' : 'Show preview'}
              </button>
              {showPrev && (
                <PlatformPreviewSwitcher
                  platforms={PLATFORMS.filter((p) => keys.includes(p.key))}
                  image={c.uploads[0]?.url || ''}
                  title={title}
                  caption={caption}
                  hashtags={c.contentPillar.hashtags}
                />
              )}
            </div>
          </div>
        )}

        {c.status === 'rejected' && c.reviewNote && <p className="mom-note rejected acq-note">Rejected: {c.reviewNote}</p>}
        {c.status === 'approved' && <p className="mom-note approved acq-note">Approved {fmtDateTime(c.reviewedAt)}. Saved on the calendar.</p>}

        {c.status === 'pending' && (
          <div className="acq-actions">
            {rejecting === c.id ? (
              <div className="mom-reject-box acq-reject">
                <label className="x-field">
                  <span>Reason for rejecting *</span>
                  <textarea value={note} maxLength={500} placeholder="The SME will see this" onChange={(e) => setNote(e.target.value)} />
                </label>
                <div className="btn-row">
                  <button type="button" className="btn-ghost danger" disabled={busyId === c.id || note.trim().length < 3} onClick={() => review(c, 'reject')}>
                    <ThumbsDown size={15} /> {busyId === c.id ? 'Rejecting…' : 'Confirm Reject'}
                  </button>
                  <button type="button" className="btn-ghost" onClick={() => { setRejecting(''); setNote(''); }}>Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <button type="button" className="btn-primary btn-approve" disabled={busyId === c.id} onClick={() => review(c, 'approve')}>
                  <ThumbsUp size={15} /> {busyId === c.id ? 'Approving…' : 'Approve'}
                </button>
                <button type="button" className="btn-ghost danger" onClick={() => { setRejecting(c.id); setNote(''); }}>
                  <ThumbsDown size={15} /> Reject
                </button>
              </>
            )}
          </div>
        )}
      </article>
    );
  };

  return (
    <div className="dashboard-content scrollable">
      <div className="page-header">
        <div>
          <span className="page-label">ADMINISTRATION</span>
          <h1>Creatives</h1>
          <p>Review the reference creatives your SMEs submit. Approved ones are saved on the SME’s calendar.</p>
        </div>
      </div>

      <div className="acq-tabs" role="tablist" aria-label="Filter by status">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.value} type="button" role="tab" aria-selected={tab === t.value} className={`acq-tab ${t.value} ${tab === t.value ? 'active' : ''}`} onClick={() => setTab(t.value)}>
              <span className="acq-tab-icon"><Icon size={17} /></span>
              <span className="acq-tab-text">
                <strong>{counts[t.value]}</strong>
                <span>{t.label}</span>
                <small>{t.value === 'pending' && counts.pending > 0 && oldestPending ? `Oldest waiting ${oldestPending.label}` : t.hint}</small>
              </span>
            </button>
          );
        })}
      </div>

      <div className="acq-toolbar">
        <div className="acq-search">
          <Search size={15} />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title, caption, hashtag, SME or company…" aria-label="Search creatives" />
          {q && <button type="button" onClick={() => setQ('')} aria-label="Clear search"><X size={14} /></button>}
        </div>
        <select value={company} onChange={(e) => setCompany(e.target.value)} aria-label="Filter by company">
          <option value="all">All companies</option>
          {companies.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <select value={sme} onChange={(e) => setSme(e.target.value)} aria-label="Filter by SME">
          <option value="all">All SMEs</option>
          {smes.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort">
          {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select value={group} onChange={(e) => setGroup(e.target.value)} aria-label="Group">
          {GROUPS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
        </select>
      </div>

      {error && <p className="error-message" role="alert">{error}</p>}
      {success && <p className="success-message" role="status">{success}</p>}

      {!loading && (
        <div className="acq-count">
          Showing <b>{shown.length}</b> {tab === 'all' ? '' : `${tab} `}creative{shown.length === 1 ? '' : 's'}
          {filtered && <button type="button" className="acq-clear" onClick={clearFilters}>Clear filters</button>}
        </div>
      )}

      {loading ? (
        <p className="muted">Loading…</p>
      ) : shown.length === 0 ? (
        <div className="glass-panel acq-empty">
          {tab === 'pending' && !filtered
            ? <><Check size={26} /><h3>All caught up</h3><p className="muted">No creatives are waiting for review.</p></>
            : <><Search size={26} /><h3>No creatives found</h3><p className="muted">Nothing matches these filters{tab === 'all' ? '' : ` in ${tab}`}.</p>{filtered && <button type="button" className="btn-ghost" onClick={clearFilters}>Clear filters</button>}</>}
        </div>
      ) : (
        <div className="acq-groups">
          {groups.map((g) => (
            <section key={g.key} className="acq-group">
              {group !== 'none' && (
                <header className="acq-group-head">
                  <h2>{g.label}</h2>
                  <span>{g.items.length}</span>
                </header>
              )}
              <div className="acq-list">{g.items.map(renderCard)}</div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminCreatives;
