import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import { X, CalendarDays, Building2, Clock3, Play, Upload, Image as ImageIcon, Trash2, LoaderCircle, AlertCircle, Repeat, UserRound, FileText, Flag, Target, FolderOpen, Layers, Hourglass, Check } from 'lucide-react';
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
const TaskDetailsModal = ({ task, onClose }) => {
    const [attachments, setAttachments] = useState([]);
    const [loadingImages, setLoadingImages] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [deletingId, setDeletingId] = useState('');
    const [error, setError] = useState('');
    const [selectedImages, setSelectedImages] = useState([]);
    const fileInputRef = useRef(null);
    useEffect(() => {
        const fetchAttachments = async () => {
            try {
                setLoadingImages(true);
                setError('');
                const response = await api.get(`/sme/tasks/${task._id}/image-attachments`);
                setAttachments(response.data.attachments || []);
            } catch (err) {
                setError(err.response?.data?.message || 'Unable to load task images.');
            } finally {
                setLoadingImages(false);
            }
        };
        fetchAttachments();
    }, [task._id]);
    const handleImageSelection = event => {
        const files = Array.from(event.target.files || []);
        const remaining = 5 - attachments.length;
        if (files.length > remaining) {
            setError(`You can select only ${remaining} more image(s).`);
            setSelectedImages(files.slice(0, Math.max(0, remaining)));
        } else {
            setError('');
            setSelectedImages(files);
        }
        event.target.value = '';
    };
const handleUpload = async () => {
    if (!selectedImages.length) {
        setError('Please choose at least one image first.');
        return;
    }

    const formData = new FormData();

    selectedImages.forEach(file => {
        formData.append('images', file, file.name);
    });

    console.log('Selected files:', selectedImages);
    console.log('FormData files:', [...formData.entries()]);

    try {
        setUploading(true);
        setError('');

        const response = await api.post(
            `/sme/tasks/${task._id}/image-attachments`,
            formData,
            {
                headers: {
                    'Content-Type': undefined
                }
            }
        );

        setAttachments(prev => [
            ...response.data.attachments,
            ...prev
        ]);

        setSelectedImages([]);
        setError('');
    } catch (err) {
        console.error('Upload response:', err.response?.data || err);
        setError(err.response?.data?.message || 'Image upload failed.');
    } finally {
        setUploading(false);
    }
};
    const handleDeleteImage = async attachmentId => {
        if (!window.confirm('Are you sure you want to delete this image?')) return;
        try {
            setDeletingId(attachmentId);
            setError('');
            await api.delete(`/sme/tasks/${task._id}/attachments/${attachmentId}`);
            setAttachments(prev => prev.filter(item => item._id !== attachmentId));
        } catch (err) {
            setError(err.response?.data?.message || 'Image deletion failed.');
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
        { label: 'Assigned To', value: task.assignedTo || 'Not assigned', icon: UserRound },
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
    const timeline = [
        { label: 'Task Assigned', time: formatDate(task.createdAt), state: 'done' },
        { label: 'Task Started', time: task.startedAt ? formatDate(task.startedAt) : 'Not started yet', state: task.startedAt ? (task.status === 'in-progress' ? 'active' : 'done') : 'pending' },
        { label: 'Task Completed', time: task.status === 'completed' ? formatDate(task.endedAt) : 'Not completed yet', state: task.status === 'completed' ? 'done' : 'pending' }
    ];
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
                                <div><span className="tdm-label">{label}</span><strong>{value}</strong></div>
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
                                        <h3><ImageIcon size={17} /> Task Images</h3>
                                        <p>Upload and manage task reference images.</p>
                                    </div>
                                    <span className="tdm-count">{attachments.length}/5</span>
                                </div>
                                <div className="tdm-upload-controls">
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/jpeg,image/png,image/webp"
                                        multiple
                                        hidden
                                        onChange={handleImageSelection}
                                    />
                                    <button
                                        type="button"
                                        className="tdm-upload-btn secondary"
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={uploading || attachments.length >= 5}
                                    >
                                        <FolderOpen size={16} />
                                        Choose Images
                                    </button>
                                    <button
                                        type="button"
                                        className="tdm-upload-btn"
                                        onClick={handleUpload}
                                        disabled={uploading || selectedImages.length === 0 || attachments.length >= 5}
                                    >
                                        {uploading ? <LoaderCircle size={16} className="tdm-spin" /> : <Upload size={16} />}
                                        {uploading ? 'Uploading...' : `Upload ${selectedImages.length || ''} Images`}
                                    </button>
                                </div>
                                {selectedImages.length > 0 && (
                                    <div className="tdm-selected-images">
                                        <strong>Selected Images ({selectedImages.length})</strong>
                                        {selectedImages.map((file, index) => (
                                            <div className="tdm-selected-image" key={`${file.name}-${index}`}>
                                                <ImageIcon size={15} />
                                                <span title={file.name}>{file.name}</span>
                                                <small>{(file.size / (1024 * 1024)).toFixed(2)} MB</small>
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedImages(prev => prev.filter((_, i) => i !== index))}
                                                    disabled={uploading}
                                                    aria-label="Remove selected image"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {error && <div className="tdm-error"><AlertCircle size={16} />{error}</div>}
                                {loadingImages ? (
                                    <div className="tdm-empty"><LoaderCircle size={22} className="tdm-spin" />Loading images...</div>
                                ) : attachments.length === 0 ? (
                                    <div className="tdm-empty"><ImageIcon size={26} /><span>No images uploaded yet.</span></div>
                                ) : (
                                    <div className="tdm-gallery">
                                        {attachments.map(item => (
                                            <div className="tdm-image-card" key={item._id}>
                                                <a href={item.imageUrl} target="_blank" rel="noreferrer" className="tdm-image-link">
                                                    <img src={item.imageUrl} alt={item.originalName} loading="lazy" />
                                                </a>
                                                <div className="tdm-image-info">
                                                    <span title={item.originalName}>{item.originalName}</span>
                                                    <small>{formatDate(item.createdAt)}</small>
                                                </div>
                                                <button
                                                    type="button"
                                                    className="tdm-delete-image"
                                                    disabled={!!deletingId}
                                                    onClick={() => handleDeleteImage(item._id)}
                                                    aria-label="Delete image"
                                                >
                                                    {deletingId === item._id ? <LoaderCircle size={15} className="tdm-spin" /> : <Trash2 size={15} />}
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </section>
                        </div>
                        <aside className="tdm-side">
                            <section className="tdm-card">
                                <h3><Clock3 size={17} /> Progress</h3>
                                <ol className="tdm-timeline">
                                    {timeline.map(step => (
                                        <li className={step.state} key={step.label}>
                                            <span className="tdm-dot">{step.state === 'done' && <Check size={11} strokeWidth={3} />}</span>
                                            <div><strong>{step.label}</strong><small>{step.time}</small></div>
                                        </li>
                                    ))}
                                </ol>
                            </section>
                            <section className="tdm-card">
                                <h3><FileText size={17} /> Task Information</h3>
                                <dl className="tdm-info-list">
                                    {details.map(({ label, value, icon: Icon }) => (
                                        <div className="tdm-info-row" key={label}>
                                            <dt><Icon size={14} />{label}</dt>
                                            <dd>{value}</dd>
                                        </div>
                                    ))}
                                </dl>
                            </section>
                            {isRecurring && (
                                <section className="tdm-card">
                                    <h3><Repeat size={17} /> Recurring</h3>
                                    <div className="tdm-recurring-info">
                                        <span>Frequency <strong>Every {task.frequencyDays} days</strong></span>
                                        <span>Turnaround Time <strong>{task.tatDays} days</strong></span>
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