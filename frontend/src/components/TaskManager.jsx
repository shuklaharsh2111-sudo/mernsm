import { useEffect, useState } from 'react';
import api from '../api';
import { errMsg } from '../sopUtils';
import '../styles/taskmanager.css';
import {
    ListTodo, BriefcaseBusiness, Repeat, CheckCircle2,
    Plus, Play, Square, Clock3, Building2, X, AlertCircle,
    CalendarDays
} from 'lucide-react';
const initialForm = {
    companyId: '',
    title: '',
    category: 'one-time',
    frequencyDays: '',
    tatDays: '',
    taskType: '',
    objective: '',
    customObjective: '',
    priority: '',
    brief: '',
    assignedTo: '',
    dueDate: ''
};
const TaskManager = () => {
    const [companies, setCompanies] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState(initialForm);
    const [taskError, setTaskError] = useState('');
    const [creating, setCreating] = useState(false);
    const [actionId, setActionId] = useState('');
    const [currentTime, setCurrentTime] = useState(new Date());
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);
    const loadData = async () => {
        try {
            setLoading(true);
            const [companyResponse, taskResponse] = await Promise.all([
                api.get('/sme/companies'),
                api.get('/sme/tasks')
            ]);
            setCompanies(companyResponse.data.companies || []);
            setTasks(taskResponse.data.tasks || []);
        } catch (err) {
            setTaskError(errMsg(err));
        } finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        loadData();
    }, []);
    const newTasks = tasks.filter(task => task.status === 'new');
    const inProgressTasks = tasks.filter(task => task.status === 'in-progress');
    const recurringTasks = tasks.filter(task => task.category === 'recurring');
    const completedTasks = tasks.filter(task => task.status === 'completed');
    const formatTimestamp = (date) => {
        if (!date) return '--';
        const parsedDate = new Date(date);
        if (Number.isNaN(parsedDate.getTime())) return '--';
        return parsedDate.toLocaleString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        });
    };
    const formatDueDate = (date) => {
        if (!date) return 'No due date';
        const parsedDate = new Date(date);
        if (Number.isNaN(parsedDate.getTime())) return 'No due date';
        return parsedDate.toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            timeZone: 'UTC'
        });
    };
    const formatDuration = (start, end) => {
        if (!start || !end) return '--';
        const totalSeconds = Math.max(0, Math.floor((new Date(end) - new Date(start)) / 1000));
        const days = Math.floor(totalSeconds / 86400);
        const hours = Math.floor((totalSeconds % 86400) / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        if (days > 0) return `${days}d ${hours}h ${minutes}m`;
        if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
        return `${minutes}m ${seconds}s`;
    };
    const openModal = (category) => {
        setForm({
            ...initialForm,
            category,
            companyId: companies[0]?._id || companies[0]?.id || ''
        });
        setTaskError('');
        setShowModal(true);
    };
    const closeModal = () => {
        if (creating) return;
        setShowModal(false);
        setTaskError('');
    };
    const handleChange = (event) => {
        const { name, value } = event.target;
        setForm(prev => ({
            ...prev,
            [name]: value,
            ...(name === 'objective' && value !== 'Others' ? { customObjective: '' } : {}),
            ...(name === 'category' && value === 'one-time' ? { frequencyDays: '', tatDays: '' } : {})
        }));
        setTaskError('');
    };
    const handleCreateTask = async (event) => {
        event.preventDefault();
        setTaskError('');
        if (!form.companyId) {
            setTaskError('Please select a company.');
            return;
        }
        if (form.category === 'recurring' && !form.frequencyDays) {
            setTaskError('Please select recurring frequency.');
            return;
        }
        if (form.category === 'recurring' && !form.tatDays) {
            setTaskError('Please enter turnaround time.');
            return;
        }
        if (form.objective === 'Others' && !form.customObjective.trim()) {
            setTaskError('Please enter your custom objective.');
            return;
        }
        try {
            setCreating(true);
            const payload = {
                ...form,
                frequencyDays: form.category === 'recurring' ? Number(form.frequencyDays) : null,
                tatDays: form.category === 'recurring' ? Number(form.tatDays) : null,
                customObjective: form.objective === 'Others' ? form.customObjective.trim() : '',
                brief: form.brief.trim(),
                assignedTo: form.assignedTo || '',
                dueDate: form.dueDate || null
            };
            const response = await api.post('/sme/tasks', payload);
            if (!response.data.task) {
                throw new Error('Task was created but no task data was returned.');
            }
            setTasks(prev => [response.data.task, ...prev]);
            setShowModal(false);
            setForm(initialForm);
        } catch (err) {
            setTaskError(errMsg(err));
        } finally {
            setCreating(false);
        }
    };
    const handleStartTask = async (task) => {
        if (actionId || task.status !== 'new') return;
        try {
            setActionId(task._id);
            setTaskError('');
            const response = await api.patch(`/sme/tasks/${task._id}/start`);
            if (!response.data.task) throw new Error('Updated task data was not returned.');
            setTasks(prev => prev.map(item =>
                item._id === task._id ? response.data.task : item
            ));
        } catch (err) {
            setTaskError(errMsg(err));
        } finally {
            setActionId('');
        }
    };
    const handleEndTask = async (task) => {
        if (actionId || task.status !== 'in-progress') return;
        try {
            setActionId(task._id);
            setTaskError('');
            const response = await api.patch(`/sme/tasks/${task._id}/end`);
            if (!response.data.task) throw new Error('Updated task data was not returned.');
            setTasks(prev => prev.map(item =>
                item._id === task._id ? response.data.task : item
            ));
        } catch (err) {
            setTaskError(errMsg(err));
        } finally {
            setActionId('');
        }
    };
    const taskCards = [
        {
            title: 'New',
            description: 'Tasks waiting to be started',
            count: newTasks.length,
            color: 'purple',
            icon: ListTodo,
            items: newTasks,
            category: 'one-time',
            add: true
        },
        {
            title: 'Work In Progress',
            description: 'Currently ongoing tasks',
            count: inProgressTasks.length,
            color: 'blue',
            icon: BriefcaseBusiness,
            items: inProgressTasks
        },
        {
            title: 'Recurring',
            description: 'All recurring tasks',
            count: recurringTasks.length,
            color: 'orange',
            icon: Repeat,
            items: recurringTasks,
            category: 'recurring',
            add: true
        },
        {
            title: 'Completed',
            description: 'Successfully completed tasks',
            count: completedTasks.length,
            color: 'green',
            icon: CheckCircle2,
            items: completedTasks
        }
    ];
    return (
        <section className="sme-task-manager">
            <div className="sme-task-header">
                <div className="sme-task-heading">
                    <div className="sme-task-heading-icon">
                        <ListTodo size={22} />
                    </div>
                    <div>
                        <h2>Task Manager</h2>
                        <p>Manage and track your team's tasks.</p>
                    </div>
                </div>
            </div>
            {taskError && !showModal && (
                <div className="tm-error">
                    <AlertCircle size={16} />
                    {taskError}
                </div>
            )}
            <div className="sme-task-grid">
                {taskCards.map(card => {
                    const Icon = card.icon;
                    return (
                        <div className={`sme-task-card ${card.color}`} key={card.title}>
                            <div className="sme-task-card-top">
                                <div className={`sme-task-icon ${card.color}`}>
                                    <Icon size={22} />
                                </div>
                                {card.add && (
                                    <button
                                        type="button"
                                        className="sme-add-task-btn"
                                        onClick={() => openModal(card.category)}
                                        title={`Add ${card.title} Task`}
                                        aria-label={`Add ${card.title} Task`}
                                    >
                                        <Plus size={20} />
                                    </button>
                                )}
                            </div>
                            <div className="sme-task-info">
                                <h3>{loading ? '--' : String(card.count).padStart(2, '0')}</h3>
                                <h4>{card.title}</h4>
                                <p>{card.description}</p>
                            </div>
                            <div className="sme-task-card-list">
                                {loading ? (
                                    <p className="tm-empty">Loading tasks...</p>
                                ) : card.items.length === 0 ? (
                                    <p className="tm-empty">No tasks available.</p>
                                ) : (
                                    card.items.map(task => (
                                        <div className="tm-task-item" key={`${card.title}-${task._id}`}>
                                            <div className="tm-task-item-heading">
                                                <h4>{task.title}</h4>
                                                <span className={`task-priority ${task.priority?.toLowerCase()}`}>
                                                    {task.priority}
                                                </span>
                                            </div>
                                            <p className="tm-company">
                                                <Building2 size={13} />
                                                {task.company?.name || 'Company unavailable'}
                                            </p>
                                            <p className="tm-due-date">
                                                <CalendarDays size={14} />
                                                <strong>Due Date:</strong>
                                                <span>{formatDueDate(task.dueDate)}</span>
                                            </p>
                                            <div className="tm-task-meta">
                                                <span>{task.taskType}</span>
                                                {task.category === 'recurring' && (
                                                    <span>Every {task.frequencyDays} days</span>
                                                )}
                                                {task.category === 'recurring' && (
                                                    <span>TAT: {task.tatDays} days</span>
                                                )}
                                            </div>
                                            {task.objective === 'Others' && task.customObjective && (
                                                <p className="tm-objective">Objective: {task.customObjective}</p>
                                            )}
                                            {task.brief && <p className="tm-brief">{task.brief}</p>}
                                            {task.status === 'new' && (
                                                <div className="tm-task-action-row">
                                                    <button
                                                        type="button"
                                                        className="tm-icon-action tm-start-btn"
                                                        disabled={!!actionId}
                                                        onClick={() => handleStartTask(task)}
                                                        title="Start Task"
                                                        aria-label="Start Task"
                                                    >
                                                        <Play size={17} fill="currentColor" />
                                                    </button>
                                                </div>
                                            )}
                                            {task.status === 'in-progress' && (
                                                <div className="tm-progress-info">
                                                    <div className="tm-time-details">
                                                        <span>
                                                            <Play size={13} />
                                                            <strong>Start Time:</strong> {formatTimestamp(task.startedAt)}
                                                        </span>
                                                        <span>
                                                            <Clock3 size={13} />
                                                            <strong>Current Time:</strong> {formatTimestamp(currentTime)}
                                                        </span>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        className="tm-icon-action tm-end-btn"
                                                        disabled={!!actionId}
                                                        onClick={() => handleEndTask(task)}
                                                        title="End Task"
                                                        aria-label="End Task"
                                                    >
                                                        <Square size={17} fill="currentColor" />
                                                    </button>
                                                </div>
                                            )}
                                            {task.status === 'completed' && (
                                                <div className="tm-completed-info">
                                                    <span>
                                                        <Play size={13} />
                                                        <strong>Start Time:</strong> {formatTimestamp(task.startedAt)}
                                                    </span>
                                                    <span>
                                                        <Square size={13} />
                                                        <strong>End Time:</strong> {formatTimestamp(task.endedAt)}
                                                    </span>
                                                    <span>
                                                        <Clock3 size={13} />
                                                        <strong>Actual TAT:</strong> {formatDuration(task.startedAt, task.endedAt)}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
            {showModal && (
                <div className="tm-modal-overlay" onClick={closeModal}>
                    <div
                        className="tm-modal"
                        role="dialog"
                        aria-modal="true"
                        onClick={event => event.stopPropagation()}
                    >
                        <div className="tm-modal-header">
                            <div>
                                <span className="tm-modal-eyebrow">TASK MANAGEMENT</span>
                                <h2>Create New Task</h2>
                                <p>Add task details below.</p>
                            </div>
                            <button
                                type="button"
                                className="tm-modal-close"
                                onClick={closeModal}
                                disabled={creating}
                                aria-label="Close modal"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        {taskError && (
                            <div className="tm-error">
                                <AlertCircle size={16} />
                                {taskError}
                            </div>
                        )}
                        <form className="tm-form" onSubmit={handleCreateTask}>
                            <div className="tm-form-group">
                                <label>Company Name <span>*</span></label>
                                <select name="companyId" value={form.companyId} onChange={handleChange} required>
                                    <option value="">Select Company</option>
                                    {companies.map(company => (
                                        <option key={company._id || company.id} value={company._id || company.id}>
                                            {company.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="tm-form-group">
                                <label>Task Title <span>*</span></label>
                                <input
                                    name="title"
                                    value={form.title}
                                    onChange={handleChange}
                                    placeholder="Enter task title"
                                    maxLength={120}
                                    required
                                />
                            </div>
                            <div className="tm-form-group">
                                <label>Due Date</label>
                                <input
                                    type="date"
                                    name="dueDate"
                                    value={form.dueDate}
                                    onChange={handleChange}
                                    min={new Date().toLocaleDateString('en-CA')}
                                />
                            </div>
                            <div className="tm-form-group">
                                <label>Task Category <span>*</span></label>
                                <select name="category" value={form.category} onChange={handleChange} required>
                                    <option value="one-time">One Time</option>
                                    <option value="recurring">Recurring</option>
                                </select>
                            </div>
                            {form.category === 'recurring' && (
                                <>
                                    <div className="tm-form-group">
                                        <label>Frequency <span>*</span></label>
                                        <select name="frequencyDays" value={form.frequencyDays} onChange={handleChange} required>
                                            <option value="">Select Frequency</option>
                                            <option value="7">Every 7 Days</option>
                                            <option value="15">Every 15 Days</option>
                                            <option value="30">Every 30 Days</option>
                                        </select>
                                    </div>
                                    <div className="tm-form-group">
                                        <label>Turnaround Time (TAT) <span>*</span></label>
                                        <div className="tm-input-suffix">
                                            <input
                                                type="number"
                                                name="tatDays"
                                                value={form.tatDays}
                                                onChange={handleChange}
                                                min="1"
                                                max="3650"
                                                placeholder="Enter TAT"
                                                required
                                            />
                                            <span>Days</span>
                                        </div>
                                    </div>
                                </>
                            )}
                            <div className="tm-form-group">
                                <label>Task Type <span>*</span></label>
                                <select name="taskType" value={form.taskType} onChange={handleChange} required>
                                    <option value="">Select Task Type</option>
                                    <option value="Strategy/Pitch Deck">Strategy/Pitch Deck</option>
                                    <option value="Mood Board">Mood Board</option>
                                    <option value="Shoots">Shoots</option>
                                    <option value="Content Planning">Content Planning</option>
                                    <option value="Content Writing">Content Writing</option>
                                    <option value="Influencer Collaboration">Influencer Collaboration</option>
                                </select>
                            </div>
                            <div className="tm-form-group">
                                <label>Objective <span>*</span></label>
                                <select name="objective" value={form.objective} onChange={handleChange} required>
                                    <option value="">Select Objective</option>
                                    <option value="Brand Awareness">Brand Awareness</option>
                                    <option value="Lead Generation">Lead Generation</option>
                                    <option value="Brand Positioning">Brand Positioning</option>
                                    <option value="Others">Others</option>
                                </select>
                            </div>
                            {form.objective === 'Others' && (
                                <div className="tm-form-group">
                                    <label>Specify Objective <span>*</span></label>
                                    <input
                                        name="customObjective"
                                        value={form.customObjective}
                                        onChange={handleChange}
                                        maxLength={120}
                                        placeholder="Enter your objective"
                                        required
                                    />
                                </div>
                            )}
                            <div className="tm-form-group">
                                <label>Priority <span>*</span></label>
                                <select name="priority" value={form.priority} onChange={handleChange} required>
                                    <option value="">Select Priority</option>
                                    <option value="High">High</option>
                                    <option value="Low">Low</option>
                                    <option value="Critical">Critical</option>
                                </select>
                            </div>
                            <div className="tm-form-group">
                                <label>Brief</label>
                                <textarea
                                    name="brief"
                                    value={form.brief}
                                    onChange={handleChange}
                                    maxLength={1000}
                                    rows={3}
                                    placeholder="Enter task brief..."
                                />
                            </div>
                            <div className="tm-form-group">
                                <label>Assign To</label>
                                <select name="assignedTo" value={form.assignedTo} onChange={handleChange}>
                                    <option value="">Not Assigned</option>
                                    <option value="Admin">Admin</option>
                                    <option value="SME">SME</option>
                                    <option value="SMI">SMI</option>
                                    <option value="Designer">Designer</option>
                                </select>
                            </div>
                            <div className="tm-form-actions">
                                <button type="button" className="tm-cancel-btn" onClick={closeModal} disabled={creating}>
                                    Cancel
                                </button>
                                <button type="submit" className="tm-submit-btn" disabled={creating || !companies.length}>
                                    {creating ? 'Creating...' : 'Create Task'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </section>
    );
};
export default TaskManager;