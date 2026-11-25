import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Palette, Search, RefreshCw, CalendarDays, Building2, UserRound, ExternalLink, Clock3, CheckCircle2,
  AlertCircle, LoaderCircle, Hourglass, FileText, ChevronDown, Copy, Check, ArrowRight
} from 'lucide-react';
import api from '../api';
import { workflowOf, byPriority, countByWorkflow } from './desWorkflow';
import DesignUpload from './DesignUpload';
import '../style.css';
import '../styles/dashboard-glass.css';
import '../styles/desdashboard.css';
import '../styles/desdashboard-clean.css';

const formatDate = (date) => {
  if (!date) return 'Not specified';
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

// reference files are shown as thumbnails when the browser can draw them
const fileKind = (upload) => {
  const name = `${upload.originalName || ''} ${upload.url || ''}`.toLowerCase();
  if (/\.(jpe?g|png|webp|gif|avif|svg)(\?|\s|$)/.test(name)) return 'image';
  if (/\.(mp4|webm|mov)(\?|\s|$)/.test(name)) return 'video';
  return 'file';
};

// The page is read top to bottom: what to fix first, what to start, what is waiting, what is done.
const STAGES = [
  { key: 'redo', title: 'Redo requested', hint: 'Changes were asked for. Fix these first.', tone: 'redo' },
  { key: 'todo', title: 'To do', hint: 'Nothing delivered yet. Upload the finished design.', tone: 'todo' },
  { key: 'review', title: 'Waiting for review', hint: 'Delivered. The SME will approve it or ask for changes.', tone: 'review' },
  { key: 'approved', title: 'Approved', hint: 'Final. Nothing more to do.', tone: 'approved' }
];

// One plain sentence per stage: what the designer should do with this creative right now.
const nextStep = (creative, flow) => {
  const out = creative.designOutput;
  if (flow.key === 'redo') {
    const who = out?.redoBy === 'client' ? 'The client' : 'The SME';
    return { text: `${who} asked for changes. Read the feedback, then upload version ${(out?.version || 1) + 1}.`, tone: 'redo' };
  }
  if (flow.key === 'todo') return { text: 'Read the brief, then upload your finished design.', tone: 'todo' };
  if (flow.key === 'review') return { text: 'Your file is delivered. Waiting for the SME to review it.', tone: 'review' };
  return { text: 'Approved by the SME. This design is final.', tone: 'approved' };
};

function CopyButton({ text }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 1500);
    } catch { /* clipboard blocked: nothing to do */ }
  };
  return (
    <button type="button" className="dcc-copy" onClick={copy}>
      {done ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
    </button>
  );
}

// Everything the designer needs to read before designing.
function Brief({ creative }) {
  const pillar = creative.contentPillar || {};
  const hashtags = (pillar.hashtags || []).map((t) => `#${t.replace(/^#/, '')}`);
  const refs = creative.uploads || [];
  const links = creative.referenceLinks || [];
  const by = creative.user?.name || creative.user?.fullname || creative.user?.email || 'SME';

  return (
    <div className="dcc-brief">
      <dl className="dcc-facts">
        <div><dt><CalendarDays size={13} /> Post date</dt><dd>{formatDate(creative.date)}</dd></div>
        <div><dt><UserRound size={13} /> Assigned by</dt><dd>{by}</dd></div>
        <div><dt><Clock3 size={13} /> Assigned on</dt><dd>{creative.assignedAt ? formatDate(creative.assignedAt) : 'Not specified'}</dd></div>
      </dl>

      <section className="dcc-section">
        <div className="dcc-section-head">
          <h5>Caption</h5>
          {pillar.caption && <CopyButton text={pillar.caption} />}
        </div>
        <p className="dcc-caption">{pillar.caption || 'No caption provided.'}</p>
      </section>

      {(hashtags.length > 0 || pillar.keywords?.length > 0) && (
        <section className="dcc-section">
          {hashtags.length > 0 && (
            <>
              <h5>Hashtags</h5>
              <div className="dcc-chips">{hashtags.map((t) => <span key={t}>{t}</span>)}</div>
            </>
          )}
          {pillar.keywords?.length > 0 && (
            <>
              <h5>Keywords</h5>
              <div className="dcc-chips plain">{pillar.keywords.map((w) => <span key={w}>{w}</span>)}</div>
            </>
          )}
        </section>
      )}

      {(refs.length > 0 || links.length > 0) && (
        <section className="dcc-section">
          <h5>References</h5>
          {refs.length > 0 && (
            <div className="dcc-refs">
              {refs.map((upload, i) => {
                const label = upload.originalName || `Reference ${i + 1}`;
                const kind = fileKind(upload);
                return (
                  <a key={`${upload.publicId || upload.url}-${i}`} className="dcc-ref" href={upload.url} target="_blank" rel="noopener noreferrer" title={label}>
                    <span className="dcc-ref-media">
                      {kind === 'image' && <img src={upload.url} alt="" loading="lazy" />}
                      {kind === 'video' && <video src={upload.url} muted preload="metadata" />}
                      {kind === 'file' && <FileText size={22} />}
                    </span>
                    <small>{label}</small>
                  </a>
                );
              })}
            </div>
          )}
          {links.length > 0 && (
            <div className="dcc-links">
              {links.map((link, i) => (
                <a href={link} target="_blank" rel="noopener noreferrer" key={`${link}-${i}`}><ExternalLink size={13} /> Reference link {i + 1}</a>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function CreativeCard({ creative, onChange }) {
  const pillar = creative.contentPillar || {};
  const flow = workflowOf(creative);
  const step = nextStep(creative, flow);
  // open the brief while there is still work to do; closed once it is delivered
  const [briefOpen, setBriefOpen] = useState(flow.key === 'todo' || flow.key === 'redo');
  const platforms = pillar.platforms || [];

  return (
    <article className={`dcc-card ${flow.key}`}>
      <header className="dcc-head">
        <div className="dcc-company">
          <span className="dcc-logo">{creative.company?.logo ? <img src={creative.company.logo} alt="" /> : <Building2 size={18} />}</span>
          <div>
            <b>{creative.company?.name || 'Company'}</b>
            <small>Post date {formatDate(creative.date)}</small>
          </div>
        </div>
        <span className={`des-status ${flow.badge}`}>{flow.label}</span>
      </header>

      <h3 className="dcc-title">{pillar.title || 'Untitled Creative'}</h3>
      {platforms.length > 0 && <div className="dcc-platforms">{platforms.map((p) => <span key={p}>{p}</span>)}</div>}

      <div className={`dcc-next ${step.tone}`} role="status">
        <ArrowRight size={15} aria-hidden="true" />
        <span><b>Next step:</b> {step.text}</span>
      </div>

      {creative.reviewNote && (
        <div className="des-review-note">
          <AlertCircle size={15} />
          <span>{creative.reviewNote}</span>
        </div>
      )}

      <div className="dcc-body">
        <section className="dcc-panel">
          <button type="button" className="dcc-panel-toggle" aria-expanded={briefOpen} onClick={() => setBriefOpen((v) => !v)}>
            <span>The brief</span>
            <small>{briefOpen ? 'Hide' : 'Show caption, hashtags and references'}</small>
            <ChevronDown size={16} className={briefOpen ? 'open' : ''} />
          </button>
          {briefOpen && <Brief creative={creative} />}
        </section>

        <section className="dcc-panel delivery">
          <DesignUpload creative={creative} onChange={onChange} />
        </section>
      </div>
    </article>
  );
}

const DesDashboard = () => {
  const [creatives, setCreatives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [showApproved, setShowApproved] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get('filter');
  const activeStatus = ['all', 'todo', 'redo', 'review', 'approved'].includes(requested) ? requested : 'all';
  const setActiveStatus = (value) => setSearchParams(value === 'all' ? {} : { filter: value }, { replace: true });

  const fetchCreatives = async (refresh = false) => {
    try {
      setError('');
      if (refresh) setRefreshing(true);
      else setLoading(true);
      const response = await api.get('/des/creatives');
      setCreatives(response.data?.creatives || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load assigned creatives');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  useEffect(() => { fetchCreatives(); }, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return creatives
      .filter((creative) => {
        const companyName = creative.company?.name || '';
        const title = creative.contentPillar?.title || '';
        const platforms = creative.contentPillar?.platforms || [];
        const matchesStatus = activeStatus === 'all' || workflowOf(creative).key === activeStatus;
        const matchesSearch = !query
          || title.toLowerCase().includes(query)
          || companyName.toLowerCase().includes(query)
          || platforms.some((platform) => platform.toLowerCase().includes(query));
        return matchesStatus && matchesSearch;
      })
      .sort(byPriority);
  }, [creatives, activeStatus, search]);

  const counts = useMemo(() => countByWorkflow(creatives), [creatives]);
  const byStage = (key) => filtered.filter((c) => workflowOf(c).key === key);
  const needsAction = counts.redo + counts.todo;

  const updateOutput = (id) => (designOutput) => setCreatives((prev) => prev.map((c) => (c._id === id ? { ...c, designOutput } : c)));

  if (loading) {
    return (
      <div className="des-loading">
        <LoaderCircle className="des-spinner" size={35} />
        <p>Loading assigned creatives...</p>
      </div>
    );
  }

  return (
    <div className="des-page dashboard-content scrollable dash-glass">
      <div className="page-header des-header">
        <div>
          <span className="page-label">DESIGN WORKSPACE</span>
          <h1>My Creatives</h1>
          <p>
            {creatives.length === 0
              ? 'Everything assigned to you will show up here.'
              : needsAction > 0
                ? `${needsAction} creative${needsAction === 1 ? '' : 's'} need${needsAction === 1 ? 's' : ''} your work. Redo requests come first.`
                : 'You are all caught up. Nothing needs your work right now.'}
          </p>
        </div>
        <button className="des-refresh" onClick={() => fetchCreatives(true)} disabled={refreshing}>
          <RefreshCw size={17} className={refreshing ? 'des-spin' : ''} />
          Refresh
        </button>
      </div>

      <div className="des-stats">
        {[
          { key: 'redo', label: 'Redo requested', icon: AlertCircle, tone: 'rejected' },
          { key: 'todo', label: 'To do', icon: Clock3, tone: 'pending' },
          { key: 'review', label: 'Waiting for review', icon: Hourglass, tone: 'total' },
          { key: 'approved', label: 'Approved', icon: CheckCircle2, tone: 'approved' }
        ].map(({ key, label, icon: Icon, tone }) => (
          <button
            type="button"
            key={key}
            className={`des-stat-card des-stat-link ${activeStatus === key ? 'selected' : ''}`}
            onClick={() => setActiveStatus(activeStatus === key ? 'all' : key)}
            aria-pressed={activeStatus === key}
          >
            <div className={`des-stat-icon ${tone}`}><Icon size={21} /></div>
            <div><span>{label}</span><h2>{counts[key]}</h2></div>
          </button>
        ))}
      </div>

      <div className="dcc-toolbar">
        <div className="des-search">
          <Search size={18} />
          <input type="text" placeholder="Search company, creative or platform..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {activeStatus !== 'all' && (
          <button type="button" className="dcc-clear" onClick={() => setActiveStatus('all')}>Show all stages</button>
        )}
      </div>

      {error && (
        <div className="des-error">
          <AlertCircle size={18} />
          <span>{error}</span>
          <button onClick={() => fetchCreatives()}>Retry</button>
        </div>
      )}

      {!error && filtered.length === 0 && (
        <div className="des-empty">
          <div className="des-empty-icon"><Palette size={35} /></div>
          <h3>{creatives.length === 0 ? 'No Creatives Assigned' : 'No Matching Creatives'}</h3>
          <p>
            {creatives.length === 0
              ? 'Your assigned creatives will appear here once an SME assigns them to you.'
              : 'Try changing your search or the stage you picked.'}
          </p>
        </div>
      )}

      {STAGES.map((stage) => {
        const list = byStage(stage.key);
        if (list.length === 0) return null;
        // Approved work is finished, so it stays folded until asked for (unless it is the stage being viewed)
        const folded = stage.key === 'approved' && activeStatus === 'all' && !search.trim() && !showApproved;
        return (
          <section className={`dcc-stage ${stage.tone}`} key={stage.key} aria-label={stage.title}>
            <header className="dcc-stage-head">
              <h2>{stage.title} <span>{list.length}</span></h2>
              <p>{stage.hint}</p>
              {stage.key === 'approved' && activeStatus === 'all' && !search.trim() && (
                <button type="button" className="dcc-fold" onClick={() => setShowApproved((v) => !v)}>
                  {showApproved ? 'Hide approved' : `Show ${list.length} approved`}
                </button>
              )}
            </header>
            {!folded && (
              <div className="dcc-list">
                {list.map((creative) => (
                  <CreativeCard key={creative._id} creative={creative} onChange={updateOutput(creative._id)} />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
};
export default DesDashboard;
