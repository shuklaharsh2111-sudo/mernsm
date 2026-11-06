import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import { X, CalendarDays, Building2, Play, Upload, Image as ImageIcon, Trash2, LoaderCircle, AlertCircle, Repeat, UserRound, FileText, Flag, Target, FolderOpen, Video, File, Download, Eye, Hourglass, Layers, Check, History } from 'lucide-react';
import api from '../api';
import '../styles/taskdetailsmodal.css';

const formatDate = date => {
    if (!date) return '--';
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return '--';
    return parsed.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
};

const formatDuration = (start, end) => {
    if (!start || !end) return '--';
    const seconds = Math.max(0, Math.floor((new Date(end) - new Date(start)) / 1000));
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (days) return `${days}d ${hours}h ${minutes}m`;
    if (hours) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
};

const TaskDetailsModal = ({ task, onClose, basePath = '/sme', readOnly = false }) => {
    const [attachments, setAttachments] = useState([]);
    const [loadingImages, setLoadingImages] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [deletingId, setDeletingId] = useState('');
    const [error, setError] = useState('');
    const [selectedFiles, setSelectedFiles] = useState([]);
    const fileInputRef = useRef(null);

    useEffect(() => {
        let active = true;

        const fetchAttachments = async () => {
            try {
                setLoadingImages(true);
                setError('');
                const response = await api.get(`${basePath}/tasks/${task._id}/attachments`);
                if (active) setAttachments(Array.isArray(response.data.attachments) ? response.data.attachments : []);
            } catch (err) {
                if (active) {
                    setAttachments([]);
                    setError(err.response?.data?.message || 'Unable to load task attachments.');
                }
            } finally {
                if (active) setLoadingImages(false);
            }
        };

        fetchAttachments();
        return () => { active = false; };
    }, [task._id]);

    const handleFileSelection = event => {
        const files = Array.from(event.target.files || []);
        const remaining = Math.max(0, 5 - attachments.length);

        if (!files.length) {
            setSelectedFiles([]);
            return;
        }

        if (files.length > remaining) {
            setError(`You can select only ${remaining} more file(s).`);
            setSelectedFiles(files.slice(0, remaining));
        } else {
            setError('');
            setSelectedFiles(files);
        }

        event.target.value = '';
    };

    const handleUpload = async () => {
        if (!selectedFiles.length) {
            setError('Please choose at least one file first.');
            return;
        }

        const formData = new FormData();
        selectedFiles.forEach(file => formData.append('files', file, file.name));

        try {
            setUploading(true);
            setError('');

            await api.post(
                `${basePath}/tasks/${task._id}/attachments`,
                formData,
                { headers: { 'Content-Type': undefined } }
            );

            const refreshed = await api.get(`${basePath}/tasks/${task._id}/attachments`);
            const savedAttachments = refreshed.data?.attachments;

            if (!Array.isArray(savedAttachments)) {
                throw new Error('Upload completed, but server did not return the saved attachments list.');
            }

            setAttachments(savedAttachments);
            setSelectedFiles([]);

            if (fileInputRef.current) fileInputRef.current.value = '';

            if (!savedAttachments.length) {
                setError('Upload request completed, but no saved attachments were returned. Please check the backend GET route.');
            }
        } catch (err) {
            console.error('Task attachment upload error:', err.response?.data || err);
            setError(err.response?.data?.message || err.message || 'File upload failed.');
        } finally {
            setUploading(false);
        }
    };

    const handleDeleteImage = async attachmentId => {
        if (!window.confirm('Are you sure you want to delete this attachment?')) return;

        try {
            setDeletingId(attachmentId);
            setError('');

            await api.delete(`${basePath}/tasks/${task._id}/attachments/${attachmentId}`);

            setAttachments(prev => prev.filter(item => item._id !== attachmentId));
        } catch (err) {
            setError(err.response?.data?.message || 'Attachment deletion failed.');
        } finally {
            setDeletingId('');
        }
    };

    const statusLabel = task.status?.replace('-', ' ') || '--';
    const priorityKey = (task.priority || '').toLowerCase();
    const isRecurring = task.category === 'recurring';
    const objective = task.objective === 'Others' ? task.customObjective || 'Others' : task.objective || '--';

    const stats = [
        { label: 'Due Date', value: task.dueDate ? formatDate(task.dueDate) : 'No due date', icon: CalendarDays },
        { label: 'Assigned To', value: task.assignedSmi?.name ? `${task.assignedSmi.name} (SMI)` : task.assignedTo || 'Not assigned', icon: UserRound },
        { label: 'Started', value: task.startedAt ? formatDate(task.startedAt) : 'Not started', icon: Play },
        { label: 'Actual TAT', value: formatDuration(task.startedAt, task.endedAt), icon: Hourglass }
    ];

    const details = [
        { label: 'Company', value: task.company?.name || 'Company unavailable', icon: Building2 },
        { label: 'Task Type', value: task.taskType || '--', icon: FileText },
        { label: 'Objective', value: objective, icon: Target },
        { label: 'Category', value: isRecurring ? 'Recurring' : 'One Time', icon: Repeat },
        { label: 'Priority', value: task.priority || '--', icon: Flag }
    ];

    const timelineSource = [
        { label: 'Created', date: task.createdAt, pendingText: '--' },
        { label: 'Started', date: task.startedAt, pendingText: 'Not started yet' },
        {
            label: 'Completed',
            date: task.endedAt,
            pendingText: 'Not completed yet',
            note: task.startedAt && task.endedAt ? `Actual TAT: ${formatDuration(task.startedAt, task.endedAt)}` : ''
        }
    ];
    const activeIndex = timelineSource.findIndex(step => !step.date);
    const timeline = timelineSource.map((step, index) => ({
        ...step,
        state: step.date ? 'done' : index === activeIndex ? 'active' : 'pending'
    }));

    return createPortal(
        <div className="tdm-overlay" onClick={onClose}>
            <div className="tdm-modal" role="dialog" aria-modal="true" aria-labelledby="tdm-title" onClick={event => event.stopPropagation()}>
                <div className="tdm-header">
                    <div className="tdm-header-main">
                        <span className="tdm-eyebrow"><Layers size={13} /> TASK OVERVIEW</span>
                        <h2 id="tdm-title">{task.title}</h2>
                        <div className="tdm-chips">
                            <span className={`tdm-status ${task.status}`}><i />{statusLabel}</span>
                            {task.priority && <span className={`tdm-prio ${priorityKey}`}><Flag size={12} />{task.priority}</span>}
                            <span className="tdm-chip"><Repeat size={12} />{isRecurring ? 'Recurring' : 'One Time'}</span>
                            <span className="tdm-chip"><Building2 size={12} />{task.company?.name || 'Company unavailable'}</span>
                        </div>
                    </div>
                    <button type="button" className="tdm-close" onClick={onClose} aria-label="Close modal"><X size={20} /></button>
                </div>

                <div className="tdm-content">
                    <div className="tdm-stats">
                        {stats.map(({ label, value, icon: Icon }) => (
                            <div className="tdm-stat" key={label}>
                                <span className="tdm-stat-icon"><Icon size={17} /></span>
                                <div>
                                    <span className="tdm-label">{label}</span>
                                    <strong>{value}</strong>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="tdm-layout">
                        <div className="tdm-main">
                            <section className="tdm-card">
                                <h3><FileText size={17} /> Task Brief</h3>
                                <div className="tdm-brief">{task.brief?.trim() || 'No task brief has been added.'}</div>
                            </section>

                            <section className="tdm-card">
                                <div className="tdm-attachments-heading">
                                    <div>
                                        <h3><FolderOpen size={18} /> Task Attachments</h3>
                                        <p>{readOnly ? 'Files shared with you for this task.' : 'Upload and manage images, videos, PDFs and documents. Maximum 5 files.'}</p>
                                    </div>
                                    <span className="tdm-count">{attachments.length}/5</span>
                                </div>

                                {!readOnly && (
                                <div className="tdm-upload-controls">
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
                                        multiple
                                        hidden
                                        onChange={handleFileSelection}
                                    />

                                    <button
                                        type="button"
                                        className="tdm-upload-btn secondary"
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={uploading || attachments.length >= 5}
                                    >
                                        <FolderOpen size={17} />
                                        Choose Files
                                    </button>

                                    <button
                                        type="button"
                                        className="tdm-upload-btn"
                                        onClick={handleUpload}
                                        disabled={uploading || selectedFiles.length === 0 || attachments.length >= 5}
                                    >
                                        {uploading ? <LoaderCircle size={17} className="tdm-spin" /> : <Upload size={17} />}
                                        {uploading ? 'Uploading...' : selectedFiles.length ? `Upload ${selectedFiles.length} File${selectedFiles.length > 1 ? 's' : ''}` : 'Upload'}
                                    </button>
                                </div>
                                )}

                                {!readOnly && selectedFiles.length > 0 && (
                                    <div className="tdm-selected-images">
                                        <strong>Selected Files ({selectedFiles.length})</strong>

                                        {selectedFiles.map((file, index) => {
                                            const extension = file.name.split('.').pop()?.toLowerCase() || '';
                                            const isVideo = file.type.startsWith('video/') || ['mp4', 'mov', 'avi', 'webm', 'mkv'].includes(extension);
                                            const isImage = file.type.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(extension);

                                            return (
                                                <div className="tdm-selected-image" key={`${file.name}-${file.lastModified}-${index}`}>
                                                    {isImage ? <ImageIcon size={18} /> : isVideo ? <Video size={18} /> : <File size={18} />}
                                                    <span title={file.name}>{file.name}</span>
                                                    <small>{(file.size / (1024 * 1024)).toFixed(2)} MB</small>
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedFiles(prev => prev.filter((_, i) => i !== index))}
                                                        disabled={uploading}
                                                        aria-label="Remove selected file"
                                                    >
                                                        <X size={15} />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {error && <div className="tdm-error"><AlertCircle size={16} />{error}</div>}

                                {loadingImages ? (
                                    <div className="tdm-empty"><LoaderCircle size={22} className="tdm-spin" />Loading attachments...</div>
                                ) : attachments.length === 0 ? (
                                    <div className="tdm-empty"><FolderOpen size={26} /><span>No attachments uploaded yet.</span></div>
                                ) : (
                                    <div className="tdm-gallery">
                                        {attachments.map((item, index) => {
                                            const fileUrl = item.url || item.fileUrl || item.imageUrl || '';
                                            const fileName = item.originalName || 'Attachment';
                                            const extension = fileName.split('.').pop()?.toLowerCase() || '';
                                            const mimeType = item.mimeType || '';

                                            const fileType = item.fileType || (
                                                mimeType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(extension) ? 'image' :
                                                    mimeType.startsWith('video/') || ['mp4', 'mov', 'avi', 'webm', 'mkv'].includes(extension) ? 'video' :
                                                        mimeType === 'application/pdf' || extension === 'pdf' ? 'pdf' : 'document'
                                            );

                                            const attachmentId = item._id || item.publicId || fileUrl || `attachment-${index}`;

                                            return (
                                                <div className="tdm-image-card" key={attachmentId}>
                                                    <div className="tdm-attachment-preview">
                                                        {!fileUrl ? (
                                                            <div className="tdm-file-preview">
                                                                <AlertCircle size={30} />
                                                                <span>File URL unavailable</span>
                                                            </div>
                                                        ) : fileType === 'image' ? (
                                                            <a href={fileUrl} target="_blank" rel="noreferrer" className="tdm-image-link">
                                                                <img
                                                                    src={fileUrl}
                                                                    alt={fileName}
                                                                    loading="lazy"
                                                                    onError={event => {
                                                                        console.error('Image failed to load:', fileUrl);
                                                                        event.currentTarget.style.display = 'none';
                                                                    }}
                                                                />
                                                            </a>
                                                        ) : fileType === 'video' ? (
                                                            <video src={fileUrl} controls preload="metadata" />
                                                        ) : fileType === 'pdf' ? (
                                                            <a href={fileUrl} target="_blank" rel="noreferrer" className="tdm-file-preview">
                                                                <FileText size={38} />
                                                                <span>PDF Document</span>
                                                                <Eye size={17} />
                                                            </a>
                                                        ) : (
                                                            <a href={fileUrl} target="_blank" rel="noreferrer" className="tdm-file-preview">
                                                                <File size={38} />
                                                                <span>Document</span>
                                                                <Eye size={17} />
                                                            </a>
                                                        )}
                                                    </div>

                                                    <div className="tdm-image-info">
                                                        <span title={fileName}>{fileName}</span>
                                                        <small>{formatDate(item.uploadedAt || item.createdAt)}</small>
                                                        <small>{((item.size || 0) / (1024 * 1024)).toFixed(2)} MB</small>
                                                    </div>

                                                    <div className="tdm-attachment-actions">
                                                        {fileUrl && (
                                                            <a href={fileUrl} target="_blank" rel="noreferrer" className="tdm-download-btn">
                                                                <Download size={15} /> View / Download
                                                            </a>
                                                        )}

                                                        {!readOnly && item.canDelete !== false && (
                                                            <button
                                                                type="button"
                                                                className="tdm-delete-image"
                                                                disabled={!!deletingId || !item._id}
                                                                onClick={() => handleDeleteImage(item._id)}
                                                                aria-label="Delete attachment"
                                                            >
                                                                {deletingId === item._id ? <LoaderCircle size={16} className="tdm-spin" /> : <Trash2 size={16} />}
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </section>
                        </div>

                        <aside className="tdm-side">
                            <section className="tdm-card">
                                <h3><Layers size={17} /> Task Information</h3>
                                <dl className="tdm-info-list">
                                    {details.map(({ label, value, icon: Icon }) => (
                                        <div className="tdm-info-row" key={label}>
                                            <dt><Icon size={15} />{label}</dt>
                                            <dd>{value}</dd>
                                        </div>
                                    ))}
                                </dl>
                            </section>

                            <section className="tdm-card">
                                <h3><History size={17} /> Timeline</h3>
                                <ol className="tdm-timeline">
                                    {timeline.map(step => (
                                        <li key={step.label} className={step.state}>
                                            <span className="tdm-dot">{step.state === 'done' && <Check size={12} strokeWidth={3} />}</span>
                                            <div>
                                                <strong>{step.label}</strong>
                                                <small>{step.date ? formatDate(step.date) : step.pendingText}</small>
                                                {step.note && <em>{step.note}</em>}
                                            </div>
                                        </li>
                                    ))}
                                </ol>
                            </section>

                            {isRecurring && (
                                <section className="tdm-card">
                                    <h3><Repeat size={17} /> Recurring Information</h3>
                                    <div className="tdm-recurring-info">
                                        <div>
                                            <span>Frequency</span>
                                            <strong>Every {task.frequencyDays} days</strong>
                                        </div>
                                        <div>
                                            <span>Turnaround Time</span>
                                            <strong>{task.tatDays} days</strong>
                                        </div>
                                    </div>
                                </section>
                            )}
                        </aside>
                    </div>
                </div>

                <div className="tdm-footer">
                    <span>Created {formatDate(task.createdAt)}</span>
                    <button type="button" onClick={onClose}>Close</button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default TaskDetailsModal;
