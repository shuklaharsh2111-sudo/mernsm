import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import api from '../api';
import { errMsg } from '../sopUtils';
import '../styles/influencer.css';
import {
  Megaphone, Users, Plus, Pencil, Trash2, X, ExternalLink, Wallet,
  TrendingUp, Radio, Search, AlertCircle, Building2
} from 'lucide-react';

const PLATFORMS = ['Instagram', 'YouTube', 'Facebook', 'X', 'LinkedIn', 'Snapchat', 'Other'];
const STATUSES = [
  { value: 'shortlisted', label: 'Shortlisted' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'negotiating', label: 'Negotiating' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'live', label: 'Live' },
  { value: 'completed', label: 'Completed' },
  { value: 'rejected', label: 'Rejected' }
];
const SPEND_STATUSES = ['confirmed', 'live', 'completed'];
const ACTIVE_STATUSES = ['confirmed', 'live'];

const emptyForm = {
  name: '', handle: '', platform: 'Instagram', profileUrl: '', niche: '', followers: '',
  engagementRate: '', avgViews: '', location: '', contact: '', companyId: '', campaign: '',
  deliverables: '', fee: '', status: 'shortlisted', postDate: '', postLink: '', reach: '', notes: ''
};

const compact = (n) => new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 }).format(n || 0);
const money = (n) => `₹${new Intl.NumberFormat('en-IN').format(n || 0)}`;
const initials = (name) => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('');

const InfluencerDashboard = ({ role = 'sme' }) => {
  const base = `/${role}/influencers`;
  const [list, setList] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [error, setError] = useState('');
  const [stage, setStage] = useState('all');
  const [platform, setPlatform] = useState('all');
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState(null); // { edit } or {} for new
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState('');

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.get(base), api.get(`${base}/companies`)])
      .then(([a, c]) => {
        if (cancelled) return;
        setList(a.data.influencers);
        setCompanies(c.data.companies);
      })
      .catch((err) => {
        if (cancelled) return;
        setList([]);
        setError(errMsg(err));
      });
    return () => {
      cancelled = true;
    };
  }, [base]);

  const stats = useMemo(() => {
    const items = list || [];
    const live = items.filter((i) => i.status !== 'rejected');
    const withEr = live.filter((i) => i.engagementRate > 0);
    return {
      total: live.length,
      active: items.filter((i) => ACTIVE_STATUSES.includes(i.status)).length,
      followers: live.reduce((n, i) => n + (i.followers || 0), 0),
      spend: items.filter((i) => SPEND_STATUSES.includes(i.status)).reduce((n, i) => n + (i.fee || 0), 0),
      avgEr: withEr.length ? withEr.reduce((n, i) => n + i.engagementRate, 0) / withEr.length : 0
    };
  }, [list]);

  const countFor = (value) => (list || []).filter((i) => value === 'all' || i.status === value).length;

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (list || []).filter((i) => {
      if (stage !== 'all' && i.status !== stage) return false;
      if (platform !== 'all' && i.platform !== platform) return false;
      if (!q) return true;
      return [i.name, i.handle, i.niche, i.campaign, i.company?.name].some((v) => (v || '').toLowerCase().includes(q));
    });
  }, [list, stage, platform, query]);

  const openNew = () => {
    setForm(emptyForm);
    setFormError('');
    setModal({});
  };
  const openEdit = (i) => {
    setForm({
      ...emptyForm,
      name: i.name, handle: i.handle, platform: i.platform, profileUrl: i.profileUrl, niche: i.niche,
      followers: i.followers || '', engagementRate: i.engagementRate || '', avgViews: i.avgViews || '',
      location: i.location, contact: i.contact, companyId: i.company?.id || '', campaign: i.campaign,
      deliverables: i.deliverables, fee: i.fee || '', status: i.status, postDate: i.postDate,
      postLink: i.postLink, reach: i.reach || '', notes: i.notes
    });
    setFormError('');
    setModal({ edit: i });
  };
  const closeModal = () => {
    if (!saving) setModal(null);
  };
  const onField = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      if (modal.edit) {
        const res = await api.put(`${base}/${modal.edit.id}`, form);
        setList((l) => l.map((x) => (x.id === modal.edit.id ? res.data.influencer : x)));
      } else {
        const res = await api.post(base, form);
        setList((l) => [res.data.influencer, ...(l || [])]);
      }
      setModal(null);
    } catch (err) {
      setFormError(errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (i, status) => {
    if (status === i.status) return;
    setBusyId(i.id);
    setError('');
    try {
      const res = await api.patch(`${base}/${i.id}/status`, { status });
      setList((l) => l.map((x) => (x.id === i.id ? res.data.influencer : x)));
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusyId('');
    }
  };

  const remove = async (i) => {
    if (!window.confirm(`Remove ${i.name} from your influencers?`)) return;
    setBusyId(i.id);
    setError('');
    try {
      await api.delete(`${base}/${i.id}`);
      setList((l) => l.filter((x) => x.id !== i.id));
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusyId('');
    }
  };

  return (
    <section className="inf-dash glass-panel" aria-label="Influencer dashboard">
      <div className="inf-header">
        <div className="inf-heading">
          <div className="inf-heading-icon"><Megaphone size={22} /></div>
          <div>
            <h2>Influencer Dashboard</h2>
            <p>Track creators from shortlist to live post</p>
          </div>
        </div>
        <button type="button" className="inf-add-btn" onClick={openNew}>
          <Plus size={16} /> Add Influencer
        </button>
      </div>

      <div className="inf-kpis">
        <div className="inf-kpi"><span className="inf-kpi-icon"><Users size={16} /></span><b>{list ? stats.total : '--'}</b><small>Influencers</small></div>
        <div className="inf-kpi"><span className="inf-kpi-icon"><Radio size={16} /></span><b>{list ? stats.active : '--'}</b><small>Active campaigns</small></div>
        <div className="inf-kpi"><span className="inf-kpi-icon"><TrendingUp size={16} /></span><b>{list ? compact(stats.followers) : '--'}</b><small>Total followers</small></div>
        <div className="inf-kpi"><span className="inf-kpi-icon"><TrendingUp size={16} /></span><b>{list ? `${stats.avgEr.toFixed(1)}%` : '--'}</b><small>Avg engagement</small></div>
        <div className="inf-kpi"><span className="inf-kpi-icon"><Wallet size={16} /></span><b>{list ? money(stats.spend) : '--'}</b><small>Committed spend</small></div>
      </div>

      <div className="inf-toolbar">
        <div className="inf-tabs" role="tablist">
          {[{ value: 'all', label: 'All' }, ...STATUSES].map((s) => (
            <button key={s.value} type="button" role="tab" aria-selected={stage === s.value}
              className={stage === s.value ? 'active' : ''} onClick={() => setStage(s.value)}>
              {s.label}<span className="inf-tab-count">{countFor(s.value)}</span>
            </button>
          ))}
        </div>
        <div className="inf-filters">
          <label className="inf-search">
            <Search size={14} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, niche, campaign" />
          </label>
          <select value={platform} onChange={(e) => setPlatform(e.target.value)} aria-label="Filter by platform">
            <option value="all">All platforms</option>
            {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>

      {error && <p className="error-message" role="alert">{error}</p>}

      {!list ? (
        <p className="muted">Loading…</p>
      ) : shown.length === 0 ? (
        <p className="muted">
          {list.length === 0 ? 'No influencers yet. Add the first one to start tracking.' : 'No influencers match these filters.'}
        </p>
      ) : (
        <div className="inf-grid">
          {shown.map((i) => (
            <article className={`inf-card ${i.status}`} key={i.id}>
              <div className="inf-card-top">
                <span className="inf-avatar" aria-hidden="true">{initials(i.name)}</span>
                <div className="inf-id">
                  <h3>{i.name}</h3>
                  <span className="inf-handle">{i.handle ? (i.handle.startsWith('@') ? i.handle : `@${i.handle}`) : 'No handle'}</span>
                </div>
                <div className="inf-card-actions">
                  {i.profileUrl && (
                    <a href={i.profileUrl} target="_blank" rel="noopener noreferrer" title="Open profile" aria-label="Open profile">
                      <ExternalLink size={15} />
                    </a>
                  )}
                  <button type="button" title="Edit" aria-label="Edit influencer" onClick={() => openEdit(i)}><Pencil size={15} /></button>
                  <button type="button" title="Remove" aria-label="Remove influencer" disabled={busyId === i.id} onClick={() => remove(i)}><Trash2 size={15} /></button>
                </div>
              </div>

              <div className="inf-tags">
                <span className="inf-pill platform">{i.platform}</span>
                <span className="inf-pill tier">{i.tier}</span>
                {i.niche && <span className="inf-pill">{i.niche}</span>}
              </div>

              <div className="inf-stats">
                <div><b>{compact(i.followers)}</b><small>Followers</small></div>
                <div><b>{i.engagementRate ? `${i.engagementRate}%` : '-'}</b><small>Engagement</small></div>
                <div><b>{i.fee ? money(i.fee) : '-'}</b><small>Fee</small></div>
              </div>

              {(i.company || i.campaign) && (
                <p className="inf-meta">
                  {i.company && <span><Building2 size={13} /> {i.company.name}</span>}
                  {i.campaign && <span>{i.campaign}</span>}
                </p>
              )}
              {i.deliverables && <p className="inf-note">{i.deliverables}</p>}

              <div className="inf-card-foot">
                <select className={`inf-status ${i.status}`} value={i.status} disabled={busyId === i.id}
                  onChange={(e) => changeStatus(i, e.target.value)} aria-label={`Status of ${i.name}`}>
                  {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                {i.postLink && (
                  <a className="inf-post-link" href={i.postLink} target="_blank" rel="noopener noreferrer">
                    View post <ExternalLink size={12} />
                  </a>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {modal && createPortal(
        <div className="inf-overlay" onClick={closeModal}>
          <div className="inf-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="inf-modal-head">
              <div>
                <span className="inf-eyebrow">INFLUENCER DASHBOARD</span>
                <h2>{modal.edit ? 'Edit Influencer' : 'Add Influencer'}</h2>
              </div>
              <button type="button" className="inf-close" onClick={closeModal} disabled={saving} aria-label="Close"><X size={20} /></button>
            </div>
            {formError && <div className="inf-error"><AlertCircle size={16} /> {formError}</div>}
            <form className="inf-form" onSubmit={submit}>
              <div className="inf-field"><label>Name <span>*</span></label>
                <input name="name" value={form.name} onChange={onField} maxLength={80} required placeholder="Full name" /></div>
              <div className="inf-field"><label>Handle</label>
                <input name="handle" value={form.handle} onChange={onField} maxLength={60} placeholder="@username" /></div>
              <div className="inf-field"><label>Platform <span>*</span></label>
                <select name="platform" value={form.platform} onChange={onField} required>
                  {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select></div>
              <div className="inf-field"><label>Niche</label>
                <input name="niche" value={form.niche} onChange={onField} maxLength={60} placeholder="Fashion, tech, food…" /></div>
              <div className="inf-field"><label>Followers</label>
                <input type="number" min="0" name="followers" value={form.followers} onChange={onField} placeholder="e.g. 125000" /></div>
              <div className="inf-field"><label>Engagement rate (%)</label>
                <input type="number" min="0" max="100" step="0.01" name="engagementRate" value={form.engagementRate} onChange={onField} placeholder="e.g. 3.4" /></div>
              <div className="inf-field"><label>Avg. views</label>
                <input type="number" min="0" name="avgViews" value={form.avgViews} onChange={onField} /></div>
              <div className="inf-field"><label>Location</label>
                <input name="location" value={form.location} onChange={onField} maxLength={60} /></div>
              <div className="inf-field full"><label>Profile link</label>
                <input type="url" name="profileUrl" value={form.profileUrl} onChange={onField} maxLength={300} placeholder="https://" /></div>
              <div className="inf-field full"><label>Contact (email / phone / agency)</label>
                <input name="contact" value={form.contact} onChange={onField} maxLength={120} /></div>
              <div className="inf-field"><label>Company</label>
                <select name="companyId" value={form.companyId} onChange={onField}>
                  <option value="">Not linked</option>
                  {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select></div>
              <div className="inf-field"><label>Campaign</label>
                <input name="campaign" value={form.campaign} onChange={onField} maxLength={120} /></div>
              <div className="inf-field full"><label>Deliverables</label>
                <input name="deliverables" value={form.deliverables} onChange={onField} maxLength={300} placeholder="2 reels + 3 stories" /></div>
              <div className="inf-field"><label>Fee (₹)</label>
                <input type="number" min="0" name="fee" value={form.fee} onChange={onField} /></div>
              <div className="inf-field"><label>Status</label>
                <select name="status" value={form.status} onChange={onField}>
                  {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select></div>
              <div className="inf-field"><label>Post date</label>
                <input type="date" name="postDate" value={form.postDate} onChange={onField} /></div>
              <div className="inf-field"><label>Reach achieved</label>
                <input type="number" min="0" name="reach" value={form.reach} onChange={onField} /></div>
              <div className="inf-field full"><label>Post link</label>
                <input type="url" name="postLink" value={form.postLink} onChange={onField} maxLength={300} placeholder="https://" /></div>
              <div className="inf-field full"><label>Notes</label>
                <textarea name="notes" value={form.notes} onChange={onField} maxLength={1000} rows={3} /></div>
              <div className="inf-actions">
                <button type="button" className="inf-cancel" onClick={closeModal} disabled={saving}>Cancel</button>
                <button type="submit" className="inf-save" disabled={saving}>
                  {saving ? 'Saving…' : modal.edit ? 'Save changes' : 'Add influencer'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </section>
  );
};

export default InfluencerDashboard;
