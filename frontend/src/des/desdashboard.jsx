import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Palette, Search, RefreshCw, CalendarDays, Building2,
  UserRound, ExternalLink, Image, Clock3, CheckCircle2,
  XCircle, AlertCircle, LoaderCircle, Hourglass, FileText
} from 'lucide-react';
import api from '../api';
import { WORKFLOW, workflowOf, byPriority, countByWorkflow } from './desWorkflow';
import DesignUpload from './DesignUpload';
import '../style.css';
import '../styles/dashboard-glass.css';
import '../styles/desdashboard.css';
const PLATFORM_ICONS = {
  instagram: ExternalLink,
  facebook: ExternalLink,
  linkedin: ExternalLink,
  x: ExternalLink,
  youtube: ExternalLink
};
const formatDate = (date) => {
  if (!date) return 'Not specified';
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};
const statusConfig = {
  pending: {
    label: 'Pending',
    icon: Clock3,
    className: 'pending'
  },
  approved: {
    label: 'Approved',
    icon: CheckCircle2,
    className: 'approved'
  },
  rejected: {
    label: 'Changes Requested',
    icon: XCircle,
    className: 'rejected'
  }
};
// reference files are shown as thumbnails when the browser can draw them
const fileKind = (upload) => {
  const name = `${upload.originalName || ''} ${upload.url || ''}`.toLowerCase();
  if (/\.(jpe?g|png|webp|gif|avif|svg)(\?|\s|$)/.test(name)) return 'image';
  if (/\.(mp4|webm|mov)(\?|\s|$)/.test(name)) return 'video';
  return 'file';
};
const DesDashboard = () => {
  const [creatives, setCreatives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
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
      setError(
        err.response?.data?.message ||
        'Unable to load assigned creatives'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  useEffect(() => {
    fetchCreatives();
  }, []);
  const filteredCreatives = useMemo(() => {
    const query = search.trim().toLowerCase();
    return creatives
      .filter((creative) => {
        const companyName = creative.company?.name || '';
        const title = creative.contentPillar?.title || '';
        const platforms = creative.contentPillar?.platforms || [];
        const matchesStatus = activeStatus === 'all' || workflowOf(creative).key === activeStatus;
        const matchesSearch =
          !query ||
          title.toLowerCase().includes(query) ||
          companyName.toLowerCase().includes(query) ||
          platforms.some((platform) => platform.toLowerCase().includes(query));
        return matchesStatus && matchesSearch;
      })
      .sort(byPriority);
  }, [creatives, activeStatus, search]);
  const counts = useMemo(() => countByWorkflow(creatives), [creatives]);
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
          <p>Everything assigned to you, with redo requests and unfinished work shown first.</p>
        </div>
        <button
          className="des-refresh"
          onClick={() => fetchCreatives(true)}
          disabled={refreshing}
        >
          <RefreshCw
            size={17}
            className={refreshing ? 'des-spin' : ''}
          />
          Refresh
        </button>
      </div>
      <div className="des-stats">
        {[
          { key: 'todo', label: 'To do', icon: Clock3, tone: 'pending' },
          { key: 'redo', label: 'Redo requested', icon: AlertCircle, tone: 'rejected' },
          { key: 'review', label: 'Awaiting review', icon: Hourglass, tone: 'total' },
          { key: 'approved', label: 'Approved', icon: CheckCircle2, tone: 'approved' }
        ].map(({ key, label, icon: Icon, tone }) => (
          <button
            type="button"
            key={key}
            className={`des-stat-card des-stat-link ${activeStatus === key ? 'selected' : ''}`}
            onClick={() => setActiveStatus(activeStatus === key ? 'all' : key)}
          >
            <div className={`des-stat-icon ${tone}`}>
              <Icon size={21} />
            </div>
            <div>
              <span>{label}</span>
              <h2>{counts[key]}</h2>
            </div>
          </button>
        ))}
      </div>
      <div className="des-toolbar">
        <div className="des-search">
          <Search size={18} />
          <input
            type="text"
            placeholder="Search company, creative or platform..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="des-filters">
          {[
            { value: 'all', label: 'All' },
            { value: 'todo', label: WORKFLOW.todo.label },
            { value: 'redo', label: WORKFLOW.redo.label },
            { value: 'review', label: WORKFLOW.review.label },
            { value: 'approved', label: WORKFLOW.approved.label }
          ].map((filter) => (
            <button
              key={filter.value}
              className={
                activeStatus === filter.value ? 'active' : ''
              }
              onClick={() => setActiveStatus(filter.value)}
            >
              {filter.label}
              <span>{counts[filter.value]}</span>
            </button>
          ))}
        </div>
      </div>
      {error && (
        <div className="des-error">
          <AlertCircle size={18} />
          <span>{error}</span>
          <button onClick={() => fetchCreatives()}>Retry</button>
        </div>
      )}
      {!error && filteredCreatives.length === 0 && (
        <div className="des-empty">
          <div className="des-empty-icon">
            <Palette size={35} />
          </div>
          <h3>
            {creatives.length === 0
              ? 'No Creatives Assigned'
              : 'No Matching Creatives'}
          </h3>
          <p>
            {creatives.length === 0
              ? 'Your assigned creatives will appear here once an SME assigns them to you.'
              : 'Try changing your search or stage filter.'}
          </p>
        </div>
      )}
      <div className="des-creative-grid">
        {filteredCreatives.map((creative) => {
          const pillar = creative.contentPillar || {};
          const flow = workflowOf(creative);

          return (
            <div className="des-creative-card" key={creative._id}>
              <div className="des-card-info">
                <div className="des-card-top">
                  <div className="des-company">
                    <div className="des-company-icon">
                      {creative.company?.logo
                        ? <img src={creative.company.logo} alt="" />
                        : <Building2 size={19} />}
                    </div>
                    <div>
                      <h4>{creative.company?.name || 'Company'}</h4>
                      <span>Scheduled {formatDate(creative.date)}</span>
                    </div>
                  </div>
                  <span className={`des-status ${flow.badge}`}>{flow.label}</span>
                </div>

                <div className="des-card-content">
                  <h3>{pillar.title || 'Untitled Creative'}</h3>
                  {creative.reviewNote && (
                    <div className="des-review-note">
                      <AlertCircle size={15} />
                      <span>{creative.reviewNote}</span>
                    </div>
                  )}
                </div>

                <div className="des-block">
                  <span className="des-block-label">Caption</span>
                  <p className="des-caption full">{pillar.caption || 'No caption provided.'}</p>
                </div>

                {(pillar.hashtags?.length > 0 || pillar.keywords?.length > 0) && (
                  <div className="des-block">
                    {pillar.hashtags?.length > 0 && (
                      <>
                        <span className="des-block-label">Hashtags</span>
                        <div className="des-tags">
                          {pillar.hashtags.map((tag) => <span key={tag}>#{tag.replace(/^#/, '')}</span>)}
                        </div>
                      </>
                    )}
                    {pillar.keywords?.length > 0 && (
                      <>
                        <span className="des-block-label">Keywords</span>
                        <div className="des-tags plain">
                          {pillar.keywords.map((word) => <span key={word}>{word}</span>)}
                        </div>
                      </>
                    )}
                  </div>
                )}

                <div className="des-block">
                  <span className="des-block-label">Platforms</span>
                  <div className="des-platforms">
                    {(pillar.platforms || []).map((platform) => {
                      const PlatformIcon = PLATFORM_ICONS[platform] || ExternalLink;
                      return (
                        <span key={platform}>
                          <PlatformIcon size={14} />
                          {platform}
                        </span>
                      );
                    })}
                  </div>
                </div>

                <dl className="des-details">
                  <div>
                    <dt><UserRound size={13} /> Assigned by</dt>
                    <dd>{creative.user?.name || creative.user?.fullname || creative.user?.email || 'SME'}</dd>
                  </div>
                  <div>
                    <dt><CalendarDays size={13} /> Scheduled for</dt>
                    <dd>{formatDate(creative.date)}</dd>
                  </div>
                  <div>
                    <dt><Clock3 size={13} /> Assigned on</dt>
                    <dd>{creative.assignedAt ? formatDate(creative.assignedAt) : 'Not specified'}</dd>
                  </div>
                </dl>

                {creative.referenceLinks?.length > 0 && (
                  <div className="des-block">
                    <span className="des-block-label">Reference links</span>
                    <div className="des-reference-links">
                      {creative.referenceLinks.map((link, index) => (
                        <a href={link} target="_blank" rel="noopener noreferrer" key={`${link}-${index}`}>
                          <ExternalLink size={14} />
                          Reference {index + 1}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {creative.uploads?.length > 0 && (
                  <div className="des-block">
                    <span className="des-block-label">Reference files ({creative.uploads.length})</span>
                    <div className="des-ref-grid">
                      {creative.uploads.map((upload, index) => {
                        const label = upload.originalName || `Creative ${index + 1}`;
                        const kind = fileKind(upload);
                        return (
                          <a
                            key={`${upload.publicId || upload.url}-${index}`}
                            className="des-ref-thumb"
                            href={upload.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={label}
                          >
                            <span className="des-ref-media">
                              {kind === 'image' && <img src={upload.url} alt="" loading="lazy" />}
                              {kind === 'video' && <video src={upload.url} muted preload="metadata" />}
                              {kind === 'file' && <FileText size={22} />}
                            </span>
                            <small>{label}</small>
                          </a>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="des-card-footer">
                  <span>
                    <Image size={16} />
                    {creative.uploads?.length || 0} Reference Files
                  </span>
                  <span className="des-assigned-label">Assigned to You</span>
                </div>
              </div>
              <div className="des-card-delivery">
                <DesignUpload
                  creative={creative}
                  onChange={(designOutput) =>
                    setCreatives((prev) => prev.map((c) => (c._id === creative._id ? { ...c, designOutput } : c)))
                  }
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
export default DesDashboard;
