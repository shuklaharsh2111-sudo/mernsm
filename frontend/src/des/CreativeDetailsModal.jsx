
import { useState } from 'react';
import {
  X, Building2, CalendarDays, UserRound, Image as ImageIcon,
  ExternalLink, Upload, Clock3, CheckCircle2, AlertCircle,
  LoaderCircle, FileImage, Layers
} from 'lucide-react';
import api from '../api';
import '../styles/descreativemodal.css';
const formatDate = (date) => {
  if (!date) return 'Not specified';
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? date : parsed.toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
};

const CreativeDetailsModal = ({ creative, onClose, onUpdate }) => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  if (!creative) return null;

  const pillar = creative.contentPillar || {};
  const designerUploads = creative.designerWork?.uploads || [];
  const originalUploads = creative.uploads || [];

  const status = {
    pending: { label: 'Pending', icon: Clock3 },
    approved: { label: 'Approved', icon: CheckCircle2 },
    rejected: { label: 'Changes Requested', icon: AlertCircle }
  }[creative.status || 'pending'];

  const StatusIcon = status.icon;

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please select an image first.');
      return;
    }

    try {
      setUploading(true);
      setError('');
      setSuccess('');

      const formData = new FormData();
      formData.append('image', file);

      const response = await api.post(
        `/des/creatives/${creative._id}/work-upload`,
        formData
      );

      onUpdate(response.data.creative);
      setFile(null);
      setSuccess('Your work uploaded successfully!');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to upload image.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="creative-modal-overlay" onClick={onClose}>
      <div className="creative-modal" onClick={(e) => e.stopPropagation()}>
        <div className="creative-modal-header">
          <div>
            <span className="creative-modal-eyebrow">CREATIVE WORKSPACE</span>
            <h2>Creative Details</h2>
            <p>Review the brief and upload your completed work.</p>
          </div>
          <button className="creative-modal-close" onClick={onClose}>
            <X size={21} />
          </button>
        </div>

        <div className="creative-modal-body">
          <div className="creative-detail-top">
            <div className="creative-detail-company-icon">
              <Building2 size={23} />
            </div>
            <div>
              <span>COMPANY</span>
              <h3>{creative.company?.name || 'Company'}</h3>
            </div>
            <div className={`creative-detail-status ${creative.status || 'pending'}`}>
              <StatusIcon size={15} />
              {status.label}
            </div>
          </div>

          <div className="creative-detail-section">
            <h3>{pillar.title || 'Untitled Creative'}</h3>
            <p>{pillar.caption || 'No caption provided.'}</p>
          </div>

          <div className="creative-detail-grid">
            <div className="creative-detail-item">
              <CalendarDays size={17} />
              <div><span>Creative Date</span><strong>{formatDate(creative.date)}</strong></div>
            </div>
            <div className="creative-detail-item">
              <UserRound size={17} />
              <div>
                <span>Assigned By</span>
                <strong>{creative.user?.name || creative.user?.fullname || creative.user?.email || 'SME'}</strong>
              </div>
            </div>
          </div>

          <div className="creative-detail-section">
            <h4><Layers size={17} /> Platforms</h4>
            <div className="creative-detail-platforms">
              {(pillar.platforms || []).length ? pillar.platforms.map(platform => (
                <span key={platform}>{platform}</span>
              )) : <p>No platforms specified.</p>}
            </div>
          </div>

          {creative.reviewNote && (
            <div className="creative-detail-note">
              <AlertCircle size={17} />
              <div><strong>Review Note</strong><p>{creative.reviewNote}</p></div>
            </div>
          )}

          {creative.referenceLinks?.length > 0 && (
            <div className="creative-detail-section">
              <h4><ExternalLink size={17} /> Reference Links</h4>
              <div className="creative-detail-links">
                {creative.referenceLinks.map((link, index) => (
                  <a href={link} target="_blank" rel="noopener noreferrer" key={`${link}-${index}`}>
                    Reference {index + 1} <ExternalLink size={13} />
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="creative-detail-section">
            <h4><ImageIcon size={17} /> Original Files ({originalUploads.length})</h4>
            {originalUploads.length ? (
              <div className="creative-detail-files">
                {originalUploads.map((upload, index) => (
                  <a href={upload.url} target="_blank" rel="noopener noreferrer" key={upload.publicId || index}>
                    <FileImage size={17} />
                    <span>{upload.originalName || `Original File ${index + 1}`}</span>
                    <ExternalLink size={14} />
                  </a>
                ))}
              </div>
            ) : <p className="creative-detail-muted">No original files uploaded.</p>}
          </div>

          <div className="creative-upload-section">
            <div className="creative-upload-heading">
              <div>
                <h3><Upload size={19} /> Upload Your Work</h3>
                <p>Upload your completed creative design.</p>
              </div>
              <span>{designerUploads.length} Uploaded</span>
            </div>

            <form onSubmit={handleUpload}>
              <label className="creative-upload-dropzone">
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    setFile(e.target.files?.[0] || null);
                    setError('');
                    setSuccess('');
                  }}
                />
                <Upload size={27} />
                <strong>{file ? file.name : 'Choose your creative image'}</strong>
                <span>{file ? 'Click to change image' : 'PNG, JPG, WEBP or other image formats · Max 10 MB'}</span>
              </label>

              {file && (
                <div className="creative-selected-file">
                  <FileImage size={17} />
                  <span>{file.name}</span>
                  <button type="button" onClick={() => setFile(null)}><X size={15} /></button>
                </div>
              )}

              {error && <div className="creative-upload-message error">{error}</div>}
              {success && <div className="creative-upload-message success">{success}</div>}

              <button type="submit" className="creative-upload-btn" disabled={!file || uploading}>
                {uploading ? <><LoaderCircle className="creative-upload-spin" size={18} /> Uploading...</> : <><Upload size={17} /> Upload Image</>}
              </button>
            </form>

            {designerUploads.length > 0 && (
              <div className="creative-work-gallery">
                <h4>Your Uploaded Work</h4>
                <div className="creative-work-grid">
                  {designerUploads.map((upload, index) => (
                    <a href={upload.url} target="_blank" rel="noopener noreferrer" key={upload.publicId || index} className="creative-work-image">
                      <img src={upload.url} alt={upload.originalName || `Designer Work ${index + 1}`} />
                      <div>
                        <span>{upload.originalName || `Work ${index + 1}`}</span>
                        <ExternalLink size={14} />
                      </div>
                      <small>{formatDate(upload.uploadedAt)}</small>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreativeDetailsModal;
