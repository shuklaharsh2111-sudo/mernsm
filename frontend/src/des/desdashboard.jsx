import { useEffect, useMemo, useState } from 'react';
import {
  Palette, Search, RefreshCw, CalendarDays, Building2,
  UserRound, ExternalLink, Image, Clock3, CheckCircle2,
  XCircle, AlertCircle, LoaderCircle
} from 'lucide-react';
import api from '../api';
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
const DesDashboard = () => {
  const [creatives, setCreatives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [activeStatus, setActiveStatus] = useState('all');
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
    return creatives.filter((creative) => {
      const status = creative.status || 'pending';
      const companyName = creative.company?.name || '';
      const title = creative.contentPillar?.title || '';
      const platforms = creative.contentPillar?.platforms || [];
      const matchesStatus =
        activeStatus === 'all' || status === activeStatus;
      const query = search.trim().toLowerCase();
      const matchesSearch =
        !query ||
        title.toLowerCase().includes(query) ||
        companyName.toLowerCase().includes(query) ||
        platforms.some((platform) =>
          platform.toLowerCase().includes(query)
        );
      return matchesStatus && matchesSearch;
    });
  }, [creatives, activeStatus, search]);
  const counts = useMemo(() => ({
    all: creatives.length,
    pending: creatives.filter((c) => c.status === 'pending').length,
    approved: creatives.filter((c) => c.status === 'approved').length,
    rejected: creatives.filter((c) => c.status === 'rejected').length
  }), [creatives]);
  if (loading) {
    return (
      <div className="des-loading">
        <LoaderCircle className="des-spinner" size={35} />
        <p>Loading assigned creatives...</p>
      </div>
    );
  }
  return (
    <div className="des-page">
      <div className="des-header">
        <div>
          <div className="des-eyebrow">
            <Palette size={15} />
            DESIGN WORKSPACE
          </div>
          <h1>My Creatives</h1>
          <p>Manage and review creatives assigned to you.</p>
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
        <div className="des-stat-card">
          <div className="des-stat-icon total">
            <Palette size={21} />
          </div>
          <div>
            <span>Total Assigned</span>
            <h2>{counts.all}</h2>
          </div>
        </div>
        <div className="des-stat-card">
          <div className="des-stat-icon pending">
            <Clock3 size={21} />
          </div>
          <div>
            <span>Pending</span>
            <h2>{counts.pending}</h2>
          </div>
        </div>
        <div className="des-stat-card">
          <div className="des-stat-icon approved">
            <CheckCircle2 size={21} />
          </div>
          <div>
            <span>Approved</span>
            <h2>{counts.approved}</h2>
          </div>
        </div>
        <div className="des-stat-card">
          <div className="des-stat-icon rejected">
            <AlertCircle size={21} />
          </div>
          <div>
            <span>Changes Requested</span>
            <h2>{counts.rejected}</h2>
          </div>
        </div>
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
            { value: 'pending', label: 'Pending' },
            { value: 'approved', label: 'Approved' },
            { value: 'rejected', label: 'Changes Requested' }
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
              : 'Try changing your search or status filter.'}
          </p>
        </div>
      )}
      <div className="des-creative-grid">
        {filteredCreatives.map((creative) => {
          const pillar = creative.contentPillar || {};
          const status = statusConfig[creative.status] || statusConfig.pending;
          const StatusIcon = status.icon;
          return (
            <div className="des-creative-card" key={creative._id}>
              <div className="des-card-top">
                <div className="des-company">
                  <div className="des-company-icon">
                    <Building2 size={19} />
                  </div>
                  <div>
                    <h4>{creative.company?.name || 'Company'}</h4>
                    <span>{formatDate(creative.date)}</span>
                  </div>
                </div>
                <span className={`des-status ${status.className}`}>
                  <StatusIcon size={14} />
                  {status.label}
                </span>
              </div>
              <div className="des-card-content">
                <h3>{pillar.title || 'Untitled Creative'}</h3>
                <p className="des-caption">
                  {pillar.caption || 'No caption provided.'}
                </p>
                {creative.reviewNote && (
                  <div className="des-review-note">
                    <AlertCircle size={15} />
                    <span>{creative.reviewNote}</span>
                  </div>
                )}
              </div>
              <div className="des-platforms">
                {(pillar.platforms || []).map((platform) => {
                  const PlatformIcon =
                    PLATFORM_ICONS[platform] || ExternalLink;
                  return (
                    <span key={platform}>
                      <PlatformIcon size={14} />
                      {platform}
                    </span>
                  );
                })}
              </div>
              <div className="des-card-meta">
                <div>
                  <UserRound size={15} />
                  <span>
                    {creative.user?.name ||
                     creative.user?.fullname ||
                     creative.user?.email ||
                     'SME'}
                  </span>
                </div>
                <div>
                  <CalendarDays size={15} />
                  <span>{formatDate(creative.date)}</span>
                </div>
              </div>
              {creative.referenceLinks?.length > 0 && (
                <div className="des-reference-links">
                  <span className="des-reference-label">
                    Reference Links
                  </span>
                  {creative.referenceLinks.map((link, index) => (
                    <a
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      key={`${link}-${index}`}
                    >
                      <ExternalLink size={14} />
                      Reference {index + 1}
                    </a>
                  ))}
                </div>
              )}
              <div className="des-card-footer">
                <span>
                  <Image size={16} />
                  {creative.uploads?.length || 0} Uploaded Files
                </span>
                <span className="des-assigned-label">
                  Assigned to You
                </span>
              </div>
              {creative.uploads?.length > 0 && (
                <div className="des-upload-list">
                  {creative.uploads.map((upload, index) => (
                    <a
                      key={`${upload.publicId || upload.url}-${index}`}
                      href={upload.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Image size={15} />
                      <span>
                        {upload.originalName || `Creative ${index + 1}`}
                      </span>
                      <ExternalLink size={14} />
                    </a>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
export default DesDashboard;
