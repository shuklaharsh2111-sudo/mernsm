import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Palette, Search, RefreshCw, CalendarDays, Building2,
  UserRound, ExternalLink, Image, Clock3, CheckCircle2,
  XCircle, AlertCircle, LoaderCircle, Upload
} from 'lucide-react';
import api from '../api';
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
const MAX_FILE_MB = 10;
const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime,application/pdf';
const formatSize = (bytes) => {
  if (!bytes) return '';
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
};
const OUTPUT_STATUS = {
  submitted: { label: 'Waiting for SME review', className: 'pending' },
  approved: { label: 'Approved by SME', className: 'approved' },
  redo: { label: 'Redo requested', className: 'rejected' }
};
// One delivered file per creative. Uploading again replaces it (that is how a redo is sent back).
const DesignUpload = ({ creativeId, output, onChange }) => {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const locked = output?.status === 'approved';
  const pick = (e) => {
    const f = e.target.files?.[0] || null;
    setMessage({ type: '', text: '' });
    if (f && f.size > MAX_FILE_MB * 1024 * 1024) {
      setFile(null);
      e.target.value = '';
      setMessage({ type: 'error', text: `${f.name} is larger than ${MAX_FILE_MB}MB.` });
      return;
    }
    setFile(f);
  };
  const upload = async () => {
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file, file.name);
    setBusy(true);
    setMessage({ type: '', text: '' });
    try {
      // The api client defaults to JSON; clearing Content-Type lets the browser
      // send multipart/form-data with the right boundary so the file arrives.
      const res = await api.post(`/des/creatives/${creativeId}/design`, fd, { headers: { 'Content-Type': undefined } });
      onChange(res.data.designOutput);
      setFile(null);
      if (inputRef.current) inputRef.current.value = '';
      setMessage({ type: 'success', text: 'Sent to the SME for review.' });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Upload failed. Please try again.' });
    } finally {
      setBusy(false);
    }
  };
  const st = output ? OUTPUT_STATUS[output.status] : null;
  return (
    <div className="des-design-uploads">
      <span className="des-reference-label">My Design</span>
      {output && (
        <div className="des-upload-list">
          <div className="des-upload-row">
            <a href={output.url} target="_blank" rel="noopener noreferrer">
              <Image size={15} />
              <span>{output.originalName || 'Design file'}</span>
              {output.size ? <em>{formatSize(output.size)}</em> : null}
              <ExternalLink size={14} />
            </a>
          </div>
          <span className={`des-output-badge ${st?.className || ''}`}>{st?.label}{output.version > 1 ? ` · v${output.version}` : ''}</span>
          {output.status === 'redo' && output.note && (
            <div className="des-review-note">
              <AlertCircle size={15} />
              <span>SME asked for a redo: {output.note}</span>
            </div>
          )}
        </div>
      )}
      {!locked && (
        <>
          <div className="des-upload-controls">
            <input ref={inputRef} type="file" accept={ACCEPT} onChange={pick} disabled={busy} />
            <button type="button" className="des-refresh" onClick={upload} disabled={busy || !file}>
              {busy ? <LoaderCircle size={16} className="des-spin" /> : <Upload size={16} />}
              {busy ? 'Uploading…' : output ? 'Upload new version' : 'Upload'}
            </button>
          </div>
          <p className="des-upload-hint">One file only · JPG, PNG, WEBP, GIF, MP4, WEBM, MOV or PDF · up to {MAX_FILE_MB}MB{output ? ' · uploading again replaces your previous file' : ''}</p>
        </>
      )}
      {locked && <p className="des-upload-hint">Your design was approved, so it is locked.</p>}
      {message.text && <p className={`des-upload-msg ${message.type}`} role="alert">{message.text}</p>}
    </div>
  );
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
    <div className="des-page dashboard-content scrollable dash-glass">
      <div className="page-header des-header">
        <div>
          <span className="page-label">DESIGN WORKSPACE</span>
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
              <DesignUpload
                creativeId={creative._id}
                output={creative.designOutput || null}
                onChange={(designOutput) =>
                  setCreatives((prev) => prev.map((c) => (c._id === creative._id ? { ...c, designOutput } : c)))
                }
              />
              <div className="des-card-footer">
                <span>
                  <Image size={16} />
                  {creative.uploads?.length || 0} Reference Files
                </span>
                <span className="des-assigned-label">
                  Assigned to You
                </span>
              </div>
              {creative.uploads?.length > 0 && (
                <div className="des-upload-list des-ref-files">
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
