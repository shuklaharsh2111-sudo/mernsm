import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import { X, CalendarDays, Building2, Clock3, Play, Square, Upload, Image as ImageIcon, Trash2, LoaderCircle, AlertCircle, Repeat, UserRound, FileText, Flag, Target, FolderOpen } from 'lucide-react';
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
    const details = [
        { label: 'Company', value: task.company?.name || 'Company unavailable', icon: Building2 },
        { label: 'Assigned Date', value: formatDate(task.createdAt), icon: CalendarDays },
        { label: 'Due Date', value: task.dueDate ? formatDate(task.dueDate) : 'No due date', icon: CalendarDays },
        { label: 'Assigned To', value: task.assignedTo || 'Not assigned', icon: UserRound },
        { label: 'Category', value: task.category === 'recurring' ? 'Recurring' : 'One Time', icon: Repeat },
        { label: 'Task Type', value: task.taskType || '--', icon: FileText },
        { label: 'Objective', value: task.objective === 'Others' ? task.customObjective || 'Others' : task.objective || '--', icon: Target },
        { label: 'Priority', value: task.priority || '--', icon: Flag },
        { label: 'Status', value: task.status?.replace('-', ' ').toUpperCase() || '--', icon: Clock3 },
        { label: 'Started Date', value: formatDate(task.startedAt), icon: Play },
        { label: 'Completed Date', value: task.status === 'completed' ? formatDate(task.endedAt) : 'Not completed', icon: Square },
        { label: 'Actual TAT', value: formatDuration(task.startedAt, task.endedAt), icon: Clock3 }
    ];
    return createPortal(
        <div className="tdm-overlay" onClick={onClose}>
            <div className="tdm-modal" role="dialog" aria-modal="true" aria-labelledby="tdm-title" onClick={event => event.stopPropagation()}>
                <div className="tdm-header">
                    <div>
                        <span className="tdm-eyebrow">TASK OVERVIEW</span>
                        <h2 id="tdm-title">{task.title}</h2>
                        <span className={`tdm-status ${task.status}`}>{task.status?.replace('-', ' ')}</span>
                    </div>
                    <button type="button" className="tdm-close" onClick={onClose} aria-label="Close modal"><X size={21} /></button>
                </div>
                <div className="tdm-content">
                    <section className="tdm-section">
                        <h3><FileText size={18} /> Task Information</h3>
                        <div className="tdm-details-grid">
                            {details.map(({ label, value, icon: Icon }) => (
                                <div className="tdm-detail" key={label}>
                                    <span className="tdm-detail-icon"><Icon size={16} /></span>
                                    <div><span className="tdm-label">{label}</span><strong>{value}</strong></div>
                                </div>
                            ))}
                        </div>
                    </section>
                    {task.category === 'recurring' && (
                        <section className="tdm-section">
                            <h3><Repeat size={18} /> Recurring Information</h3>
                            <div className="tdm-recurring-info">
                                <span>Frequency <strong>Every {task.frequencyDays} days</strong></span>
                                <span>Turnaround Time <strong>{task.tatDays} days</strong></span>
                            </div>
                        </section>
                    )}
                    <section className="tdm-section">
                        <h3><FileText size={18} /> Task Brief</h3>
                        <div className="tdm-brief">{task.brief?.trim() || 'No task brief has been added.'}</div>
                    </section>
                    <section className="tdm-section">
                        <div className="tdm-attachments-heading">
                            <div>
                                <h3><ImageIcon size={18} /> Task Images</h3>
                                <p>Upload and manage task reference images.</p>
                            </div>
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
                                className="tdm-upload-btn"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploading || attachments.length >= 5}
                            >
                                <FolderOpen size={17} />
                                Choose Images
                            </button>
                            <button
                                type="button"
                                className="tdm-upload-btn"
                                onClick={handleUpload}
                                disabled={uploading || selectedImages.length === 0 || attachments.length >= 5}
                            >
                                {uploading ? <LoaderCircle size={17} className="tdm-spin" /> : <Upload size={17} />}
                                {uploading ? 'Uploading...' : `Upload ${selectedImages.length || ''} Images`}
                            </button>
                        </div>
                        {selectedImages.length > 0 && (
                            <div className="tdm-selected-images">
                                <strong>Selected Images ({selectedImages.length})</strong>
                                {selectedImages.map((file, index) => (
                                    <div className="tdm-selected-image" key={`${file.name}-${index}`}>
                                        <ImageIcon size={16} />
                                        <span title={file.name}>{file.name}</span>
                                        <small>{(file.size / (1024 * 1024)).toFixed(2)} MB</small>
                                        <button
                                            type="button"
                                            onClick={() => setSelectedImages(prev => prev.filter((_, i) => i !== index))}
                                            disabled={uploading}
                                            aria-label="Remove selected image"
                                        >
                                            <X size={15} />
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
                                            {deletingId === item._id ? <LoaderCircle size={16} className="tdm-spin" /> : <Trash2 size={16} />}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
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
