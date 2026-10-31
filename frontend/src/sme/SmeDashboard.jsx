import { useAuth } from '../AuthContext';
import { useEffect, useState } from 'react';
import api from '../api';
import AddMeetingModal from '../components/AddMeetingModal';
import SendMomModal from '../components/SendMomModal';
import MeetingDetailsModal from '../components/MeetingDetailsModal';
import { CompanyBadge, EmptyBadge } from '../components/CompanyBadge';
import { createPortal } from 'react-dom';
import {
  PERIOD_WORD,
  SOP_TYPES,
  errMsg,
  fmtDay,
  todayStr,
  typeLabel
} from '../sopUtils';
import "../style.css";
import "../styles/smedashboard.css";
import {
  Clock3,
  Video,
  FileText,
  Check,
  XCircle,
  Undo2,
  Flag,
  ListTodo,
  Plus,
  BriefcaseBusiness,
  Repeat,
  CheckCircle2,
  X,
  Play,
  Square,
  Paperclip,
  Building2,
  CalendarDays,
  AlertCircle
} from 'lucide-react';
const SLOTS = 5;
const initialTaskForm = {
  companyId: '',
  title: '',
  category: 'one-time',
  frequencyDays: '',
  tatDays: '',
  taskType: '',
  objective: '',
  customObjective: '',
  priority: ''
};

// Send MOM button: label / icon per approval state.
const MOM_BTN = {
  none: { label: 'Send MOM', icon: <FileText size={15} />, title: 'Write the minutes of meeting' },
  pending: { label: 'MOM Pending', icon: <Clock3 size={15} />, title: 'Waiting for admin approval — click to view or edit' },
  approved: { label: 'MOM Approved', icon: <Check size={15} />, title: 'Approved by admin — click to view' },
  sent_back: { label: 'Changes Needed', icon: <Undo2 size={15} />, title: 'The admin sent this back — click to edit and resubmit' },
  rejected: { label: 'MOM Rejected', icon: <XCircle size={15} />, title: 'Rejected by admin — click to view' },
};

const MAX_AVATARS = 4;
const AVATAR_COLORS = ['#7c5cff', '#2bb3a3', '#e0709a', '#e69b3a', '#4f8cff', '#8f6bd6'];
const initials = (name) =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('');
const avatarColor = (name) => AVATAR_COLORS[[...name].reduce((n, ch) => n + ch.charCodeAt(0), 0) % AVATAR_COLORS.length];

const SLOTS = 5; // a user can have at most 5 companies

const SmeDashboard = () => {
  const { user } = useAuth();
  const [companies, setCompanies] = useState([]);
  const [assigned, setAssigned] = useState(null);
  const [error, setError] = useState('');
  const [typeTab, setTypeTab] = useState('all');
  const [savingIds, setSavingIds] = useState([]);
  // TASK STATES
  const [startingTaskId, setStartingTaskId] = useState('');
  const [endingTaskId, setEndingTaskId] = useState('');
  const [uploadingTaskId, setUploadingTaskId] = useState('');
  const [tasks, setTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskForm, setTaskForm] = useState(initialTaskForm);
  const [taskError, setTaskError] = useState('');
  const [creatingTask, setCreatingTask] = useState(false);
  // INITIAL DATA
  useEffect(() => {
    let cancelled = false;
    const loadDashboard = async () => {
      try {
        const [c, a] = await Promise.all([
          api.get('/sme/companies'),
          api.get('/sme/sop-assignments', {
            params: { today: todayStr() }
          })
        ]);
        if (cancelled) return;
        setCompanies(c.data.companies || []);
        setAssigned(a.data.assignments || []);
      } catch (err) {
        if (!cancelled) {
          setError(errMsg(err));
        }
      }
    };
    loadDashboard();
  const [meetings, setMeetings] = useState(null);
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [joiningIds, setJoiningIds] = useState([]);
  const [detailId, setDetailId] = useState(null); // meeting whose details are open
  const [momMeeting, setMomMeeting] = useState(null); // meeting whose MOM is being written
  const [savingIds, setSavingIds] = useState([]); // ticks being written right now

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.get('/sme/companies'),
      api.get('/sme/sop-assignments', { params: { today: todayStr() } }),
      api.get('/sme/meetings'),
    ])
      .then(([c, a, m]) => {
        if (cancelled) return;
        setCompanies(c.data.companies);
        setAssigned(a.data.assignments);
        setMeetings(m.data.meetings);
      })
      .catch((err) => !cancelled && setError(errMsg(err)));
    return () => {
      cancelled = true;
    };
  }, []);
  // LOAD TASKS
  useEffect(() => {
    let cancelled = false;
    const loadTasks = async () => {
      try {
        const response = await api.get('/sme/tasks');
        if (!cancelled) {
          setTasks(response.data.tasks || []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(errMsg(err));
        }
      } finally {
        if (!cancelled) {
          setTasksLoading(false);
        }
      }
    };
    loadTasks();
    return () => {
      cancelled = true;
    };
  }, []);
  const slots = Array.from(
    { length: SLOTS },
    (_, i) => companies[i] || null
  );
  const shownSops = (assigned || []).filter(
    (a) => typeTab === 'all' || a.type === typeTab
  );
  // SOP TICK
  const toggleTick = async (a) => {
    if (savingIds.includes(a.id)) return;
    const want = !a.done;
    setError('');
    setSavingIds((ids) => [...ids, a.id]);
    setAssigned((list) =>
      list.map((x) =>
        x.id === a.id ? { ...x, done: want } : x
      )
    );
    try {
      const res = await api.put(
        '/sme/sop-assignments/completions',
        {
          today: todayStr(),
          changes: [{ id: a.id, done: want }]
        }
      );
      setAssigned(res.data.assignments);
    } catch (err) {
      setAssigned((list) =>
        list.map((x) =>
          x.id === a.id ? { ...x, done: !want } : x
        )
      );
      setError(errMsg(err));
    } finally {
      setSavingIds((ids) =>
        ids.filter((id) => id !== a.id)
      );
    }
  };
  // LIVE CLOCK
  const [currentDate, setCurrentDate] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDate(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);
  const hour = currentDate.getHours();
  const greeting =
    hour < 12
      ? 'Good Morning'
      : hour < 17
        ? 'Good Afternoon'
        : 'Good Evening';
  const formattedDate = currentDate.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
  const formattedTime = currentDate.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
  const newTasks = tasks.filter((task) => task.status === 'new');
  const inProgressTasks = tasks.filter((task) => task.status === 'in-progress');
  const recurringTasks = tasks.filter((task) => task.category === 'recurring');
  const completedTasks = tasks.filter((task) => task.status === 'completed');

  const taskCategories = [
    { title: 'New Tasks', count: newTasks.length, icon: ListTodo, color: 'purple', description: 'Tasks waiting to be started', items: newTasks },
    { title: 'Work In Progress', count: inProgressTasks.length, icon: BriefcaseBusiness, color: 'blue', description: 'Currently ongoing tasks', items: inProgressTasks },
    { title: 'Recurring Tasks', count: recurringTasks.length, icon: Repeat, color: 'orange', description: 'All recurring tasks', items: recurringTasks },
    { title: 'Completed Tasks', count: completedTasks.length, icon: CheckCircle2, color: 'green', description: 'Successfully completed tasks', items: completedTasks }
  ];
  // OPEN TASK MODAL
  const handleAddTask = () => {
    setTaskForm({
      ...initialTaskForm,
      companyId: companies[0]?.id || ''
    });
    setTaskError('');
    setShowTaskModal(true);
  };
  // CLOSE TASK MODAL
  const closeTaskModal = () => {
    if (creatingTask) return;
    setShowTaskModal(false);
    setTaskError('');
  };
  // ESCAPE KEY
  useEffect(() => {
    if (!showTaskModal) return;
    const handleEscape = (event) => {
      if (event.key === 'Escape' && !creatingTask) {
        closeTaskModal();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, [showTaskModal, creatingTask]);
  // FORM INPUT CHANGE
  const handleTaskChange = (event) => {
    const { name, value } = event.target;
    setTaskForm((prev) => {
      const updated = {
        ...prev,
        [name]: value
      };
      if (name === 'category' && value === 'one-time') {
        updated.frequencyDays = '';
      }
      if (name === 'objective' && value !== 'Others') {
        updated.customObjective = '';
      }
      return updated;
    });
    setTaskError('');
  };
  // CREATE TASK
  const handleCreateTask = async (event) => {
    event.preventDefault();
    setTaskError('');
    if (!companies.length) {
      setTaskError('No companies have been assigned to you.');
      return;
    }
    if (!taskForm.companyId) {
      setTaskError('Please select a company.');
      return;
    }
    if (
      taskForm.category === 'recurring' &&
      !taskForm.frequencyDays
    ) {
      setTaskError('Please select recurring frequency.');
      return;
    }
    if (
      taskForm.objective === 'Others' &&
      !taskForm.customObjective.trim()
    ) {
      setTaskError('Please enter your custom objective.');
      return;
    }
    try {
      setCreatingTask(true);
      const payload = {
        ...taskForm,
        tatDays: Number(taskForm.tatDays),
        frequencyDays:
          taskForm.category === 'recurring'
            ? Number(taskForm.frequencyDays)
            : null
      };
      const response = await api.post(
        '/sme/tasks',
        payload
      );
      // Immediately update dashboard
      setTasks((prev) => [
        response.data.task,
        ...prev
      ]);
      setShowTaskModal(false);
      setTaskForm(initialTaskForm);
      setTaskError('');
    } catch (err) {
      setTaskError(errMsg(err));
    } finally {
      setCreatingTask(false);
    }
  };
  const formatTaskTime = (date) => {
    if (!date) return 'Not recorded';
    return new Date(date).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const updateTask = (updatedTask) => {
    setTasks((prev) => prev.map((task) =>
      task._id === updatedTask._id ? updatedTask : task
    ));
  };

  const handleStartTask = async (taskId) => {
    try {
      setStartingTaskId(taskId);
      const response = await api.patch(`/sme/tasks/${taskId}/start`);
      updateTask(response.data.task);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setStartingTaskId('');
    }
  };

  const handleEndTask = async (taskId) => {
    if (!window.confirm('Are you sure you want to complete this task?')) return;

    try {
      setEndingTaskId(taskId);
      const response = await api.patch(`/sme/tasks/${taskId}/end`);
      updateTask(response.data.task);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setEndingTaskId('');
    }
  };

  const handleTaskAttachments = async (event, taskId) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    if (files.some((file) => !['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type))) {
      setError('Please select image files only.');
      event.target.value = '';
      return;
    }

    if (files.some((file) => file.size > 5 * 1024 * 1024)) {
      setError('Each image must be smaller than 5 MB.');
      event.target.value = '';
      return;
    }

    if (files.length > 5) {
      setError('You can upload a maximum of 5 images at a time.');
      event.target.value = '';
      return;
    }

    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));

    try {
      setUploadingTaskId(taskId);
      setError('');
      const response = await api.post(`/sme/tasks/${taskId}/attachments`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      updateTask(response.data.task);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setUploadingTaskId('');
      event.target.value = '';
    }
  };
  const handleAddMeeting = () => {
    alert('Add Meeting feature coming soon!');
  const handleAddMeeting = () => setShowMeetingModal(true);

  // Meetings whose MOM is approved are saved under Records; the rest stay active here.
  const activeMeetings = (meetings || []).filter((m) => m.mom?.status !== 'approved');

  const onMeetingSaved = (meeting) => {
    setMeetings((list) =>
      [...(list || []), meeting].sort((x, y) => `${x.date} ${x.time}`.localeCompare(`${y.date} ${y.time}`))
    );
    setShowMeetingModal(false);
  };

  const onMeetingUpdated = (meeting) => setMeetings((list) => list.map((m) => (m.id === meeting.id ? meeting : m)));
  const detailMeeting = (meetings || []).find((m) => m.id === detailId) || null;

  const onMomSaved = (meeting) => {
    setMeetings((list) => list.map((m) => (m.id === meeting.id ? meeting : m)));
    setMomMeeting(null);
  };

  // Join Now: open the meeting, then remember that I joined (this shows the Send MOM button).
  const handleJoin = async (m) => {
    if (!hasStarted(m) || joiningIds.includes(m.id)) return;
    window.open(m.link, '_blank', 'noopener,noreferrer'); // opened straight from the click so it isn't popup-blocked
    setError('');
    setJoiningIds((ids) => [...ids, m.id]);
    try {
      const p = (x) => String(x).padStart(2, '0');
      const n = new Date();
      const now = `${todayStr()}T${p(n.getHours())}:${p(n.getMinutes())}`;
      const res = await api.put(`/sme/meetings/${m.id}/join`, { now });
      setMeetings((list) => list.map((x) => (x.id === m.id ? res.data.meeting : x)));
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setJoiningIds((ids) => ids.filter((id) => id !== m.id));
    }
  };

  // A meeting has started once its date + time has passed (clock ticks every second).
  const hasStarted = (m) => currentDate >= new Date(`${m.date}T${m.time}:00`);

  const fmtTime = (t) => {
    const [h, m] = t.split(':').map(Number);
    return new Date(2000, 0, 1, h, m).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
  };
  return (
    <div className="dashboard-content scrollable">
      {/* TOPBAR */}
      <div className="dashboard-topbar">
        <div className="dashboard-greeting">
          <span className="page-label">
            SME WORKSPACE
          </span>
          <h1>
            {greeting}, {user?.name || 'User'}!
          </h1>
          <p>
            Welcome back! Here's your workspace overview.
          </p>
        </div>
        <div className="dashboard-live-clock">
          <div className="live-date">
            {formattedDate}
          </div>
          <div className="live-time-row">
            <Clock3 size={17} />
            <span className="live-time">
              {formattedTime}
            </span>
            <span className="live-indicator">
              <span className="live-dot"></span>
              LIVE
            </span>
          </div>
        </div>
      </div>
      {/* MY COMPANIES */}
      <div className="company-row" aria-label="Your companies">
        {slots.map((c, i) =>
          c ? (
            <CompanyBadge
              key={c.id}
              company={c}
              size={72}
              showName
            />
          ) : (
            <EmptyBadge
              key={`empty-${i}`}
              size={72}
              showName
            />
          )
        )}
      </div>
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      <div className="sop-meeting-row">
        {/* SOP PANEL */}
        <div className="glass-panel sop-panel">
          <h2>My assigned SOPs</h2>
          <div className="sop-tabs">
            {[
              { value: 'all', label: 'All' },
              ...SOP_TYPES
            ].map((t) => (
              <button
                key={t.value}
                type="button"
                className={
                  typeTab === t.value ? 'active' : ''
                }
                onClick={() => setTypeTab(t.value)}
              >
                {t.label}
              </button>
            ))}
          </div>
          {!assigned ? (
            <p className="muted">Loading…</p>
          ) : shownSops.length === 0 ? (
            <p className="muted">
              No SOPs assigned
              {typeTab === 'all'
                ? ''
                : ` (${typeLabel(typeTab)})`}
              yet.
            </p>
          ) : (
            <div className="sop-list">
              {shownSops.map((a) => (
                <label
                  key={a.id}
                  className={`sme-sop tick ${a.done ? 'done' : ''
                    } ${a.active ? '' : 'upcoming'}`}
                >
                  <input
                    type="checkbox"
                    checked={a.done}
                    disabled={
                      !a.active ||
                      savingIds.includes(a.id)
                    }
                    onChange={() => toggleTick(a)}
                  />
                  <div className="sme-sop-body">
                    <div className="sop-item-top">
                      <span className={`sop-pill ${a.type}`}>
                        {typeLabel(a.type)}
                      </span>
                      <b>{a.company.name}</b>
                      <span className="muted">
                        {a.active
                          ? `Done ${PERIOD_WORD[a.type]}?`
                          : `Starts ${fmtDay(a.date)}`}
                      </span>
                    </div>
                    <p className="sop-item-text">
                      {a.text}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>
        {/* MEETINGS */}
        <div className="glass-panel meeting-panel">
          <div className="meeting-header">
            <h2>Meetings</h2>
            <button
              type="button"
              className="add-meeting-btn"
              onClick={handleAddMeeting}
            >
              <Plus size={16} />
              Add Meeting
            </button>
          </div>
          <p className="muted">
            No meetings scheduled yet.
          </p>
        </div>
      </div>
      {/* TASK MANAGER */}
        {!meetings ? (
          <p className="muted">Loading…</p>
        ) : activeMeetings.length === 0 ? (
          <p className="muted">No meetings scheduled yet.</p>
        ) : (
          <div className="meeting-list">
            {activeMeetings.map((m) => (
              <div
                className="meeting-item clickable"
                key={m.id}
                role="button"
                tabIndex={0}
                title="Click to view details or add attendees"
                onClick={() => setDetailId(m.id)}
                onKeyDown={(e) => {
                  if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    setDetailId(m.id);
                  }
                }}
              >
                <div className="meeting-item-top">
                  <div className="meeting-item-main">
                    <span className="meeting-company">{m.company.name}</span>
                    {m.priority && (
                      <span className={`prio-pill ${m.priority}`} title="Scheduled from the previous meeting's MOM">
                        <Flag size={11} /> {m.priority}
                      </span>
                    )}
                    <h3 className="meeting-title">{m.subject}</h3>
                  </div>
                  <div className="meeting-item-when">
                    <span>{fmtDay(m.date)}</span>
                    <span>{fmtTime(m.time)}</span>
                  </div>
                </div>

                <div className="meeting-item-bottom">
                  <button
                    type="button"
                    className="join-now-btn"
                    disabled={!hasStarted(m) || joiningIds.includes(m.id)}
                    title={hasStarted(m) ? 'Join the meeting' : `Available from ${fmtDay(m.date)}, ${fmtTime(m.time)}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleJoin(m);
                    }}
                  >
                    <Video size={15} /> Join Now
                  </button>

                  {m.joined && (
                    <button
                      type="button"
                      className={`send-mom-btn ${m.mom ? m.mom.status : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setMomMeeting(m);
                      }}
                      title={MOM_BTN[m.mom?.status || 'none'].title}
                    >
                      {MOM_BTN[m.mom?.status || 'none'].icon}
                      {MOM_BTN[m.mom?.status || 'none'].label}
                    </button>
                  )}

                  <div className="avatar-stack" aria-label="Attendees">
                    {m.attendees.slice(0, MAX_AVATARS).map((a, i) => (
                      <span
                        key={`${a.name}-${i}`}
                        className="avatar"
                        style={{ background: avatarColor(a.name) }}
                        title={a.designation ? `${a.name} — ${a.designation}` : a.name}
                      >
                        {initials(a.name)}
                      </span>
                    ))}
                    {m.attendees.length > MAX_AVATARS && (
                      <span className="avatar avatar-more" title={m.attendees.slice(MAX_AVATARS).map((a) => a.name).join(', ')}>
                        +{m.attendees.length - MAX_AVATARS}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      </div>

      {showMeetingModal && (
        <AddMeetingModal companies={companies} onSaved={onMeetingSaved} onClose={() => setShowMeetingModal(false)} />
      )}

      {detailMeeting && <MeetingDetailsModal meeting={detailMeeting} onUpdated={onMeetingUpdated} onClose={() => setDetailId(null)} />}

      {momMeeting && <SendMomModal meeting={momMeeting} onSaved={onMomSaved} onClose={() => setMomMeeting(null)} />}

      {/* Task Manager */}

      <section className="sme-task-manager">
        <div className="sme-task-header">
          <div className="sme-task-heading">
            <div className="sme-task-heading-icon">
              <ListTodo size={21} />
            </div>
            <div>
              <h2>Task Manager</h2>
              <p>
                Manage and track your team's tasks.
              </p>
            </div>
          </div>
        </div>
        <div className="sme-task-grid">
          {taskCategories.map((task, index) => {
            const Icon = task.icon;
            return (
              <div
                className="sme-task-card"
                key={task.title}
              >
                <div className="sme-task-card-top">
                  <div className={`sme-task-icon ${task.color}`}>
                    <Icon size={21} />
                  </div>
                  {index === 0 && (
                    <button
                      type="button"
                      className="sme-add-task-btn"
                      onClick={handleAddTask}
                      title="Add New Task"
                    >
                      <Plus size={19} />
                    </button>
                  )}
                </div>
                <div className="sme-task-info">
                  <h3>
                    {tasksLoading
                      ? '--'
                      : String(task.count).padStart(2, '0')}
                  </h3>
                  <h4>{task.title}</h4>
                  <p>{task.description}</p>
                </div>
              </div>
            );
          })}
        </div>
        {/* NEW TASK LIST */}
        <div className="sme-created-tasks">
          <div className="sme-created-tasks-header">
            <h3>New Tasks</h3>
            <span>
              {newTasks.length} Tasks
            </span>
          </div>
          {tasksLoading ? (
            <p className="sme-task-empty">
              Loading tasks...
            </p>
          ) : newTasks.length === 0 ? (
            <div className="sme-task-empty">
              <ListTodo size={28} />
              <p>No new tasks created yet.</p>
            </div>
          ) : (
            <div className="sme-created-task-list">
              {newTasks.map((task) => (
                <div
                  className="sme-created-task"
                  key={task._id}
                >
                  <div className="sme-created-task-main">
                    <div className="sme-created-task-icon">
                      <ListTodo size={18} />
                    </div>
                    <div className="sme-created-task-details">
                      <h4>{task.title}</h4>
                      <p>
                        <Building2 size={13} />
                        {task.company?.name || 'Company unavailable'}
                      </p>
                    </div>
                  </div>
                  <div className="sme-created-task-meta">
                    <span className="task-meta-type">
                      {task.taskType}
                    </span>
                    <span className="task-meta-category">
                      {task.category === 'recurring'
                        ? `Recurring · Every ${task.frequencyDays} days`
                        : 'One Time'}
                    </span>
                    <span className={`task-priority ${task.priority?.toLowerCase()}`}>
                      {task.priority}
                    </span>
                    <span className="task-meta-tat">
                      TAT: {task.tatDays} days
                    </span>
                  </div>
                  {task.objective === 'Others' && (
                    <p className="sme-created-task-objective">
                      Objective: {task.customObjective}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
      {/* ADD TASK MODAL */}
      {showTaskModal && createPortal(
        <div
          className="sme-task-modal-overlay"
          onClick={closeTaskModal}
        >
          <div
            className="sme-task-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sme-task-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sme-task-modal-header">
              <div>
                <span className="sme-modal-eyebrow">
                  TASK MANAGEMENT
                </span>
                <h2 id="sme-task-modal-title">
                  Create New Task
                </h2>
                <p>
                  Fill in the details to create a new task.
                </p>
              </div>
              <button
                type="button"
                className="sme-modal-close"
                onClick={closeTaskModal}
                disabled={creatingTask}
                aria-label="Close modal"
              >
                <X size={20} />
              </button>
            </div>
            {taskError && (
              <div className="sme-task-form-error">
                <AlertCircle size={17} />
                {taskError}
              </div>
            )}
            <form
              className="sme-task-form"
              onSubmit={handleCreateTask}
            >
              {/* COMPANY */}
              <div className="sme-form-group">
                <label htmlFor="task-company">
                  Company Name <span>*</span>
                </label>
                <select
                  id="task-company"
                  name="companyId"
                  value={taskForm.companyId}
                  onChange={handleTaskChange}
                  required
                  disabled={!companies.length}
                >
                  <option value="">
                    Select Company
                  </option>
                  {companies.map((company) => (
                    <option
                      key={company.id}
                      value={company.id}
                    >
                      {company.name}
                    </option>
                  ))}
                </select>
                {!companies.length && (
                  <small>
                    No companies assigned to your account.
                  </small>
                )}
              </div>
              {/* TASK TITLE */}
              <div className="sme-form-group">
                <label htmlFor="task-title">
                  Task Title <span>*</span>
                </label>
                <input
                  type="text"
                  id="task-title"
                  name="title"
                  placeholder="Enter task title"
                  value={taskForm.title}
                  onChange={handleTaskChange}
                  maxLength={120}
                  required
                />
              </div>
              {/* TASK CATEGORY */}
              <div className="sme-form-group">
                <label htmlFor="task-category">
                  Task Category <span>*</span>
                </label>
                <select
                  id="task-category"
                  name="category"
                  value={taskForm.category}
                  onChange={handleTaskChange}
                  required
                >
                  <option value="one-time">
                    One Time
                  </option>
                  <option value="recurring">
                    Recurring
                  </option>
                </select>
              </div>
              {/* RECURRING FREQUENCY */}
              {taskForm.category === 'recurring' && (
                <div className="sme-form-group">
                  <label htmlFor="task-tat">Turnaround Time (TAT) <span>*</span></label>
                  <div className="sme-input-with-suffix">
                    <input type="number" id="task-tat" name="tatDays" placeholder="Enter number of days" value={taskForm.tatDays} onChange={handleTaskChange} min="1" max="3650" required />
                    <span>Days</span>
                  </div>
                </div>
              )}
              {/* TAT */}
              <div className="sme-form-group">
                <label htmlFor="task-tat">
                  Turnaround Time (TAT) <span>*</span>
                </label>
                <div className="sme-input-with-suffix">
                  <input
                    type="number"
                    id="task-tat"
                    name="tatDays"
                    placeholder="Enter number of days"
                    value={taskForm.tatDays}
                    onChange={handleTaskChange}
                    min="1"
                    max="3650"
                    step="1"
                    required
                  />
                  <span>Days</span>
                </div>
              </div>
              {/* TASK TYPE */}
              <div className="sme-form-group">
                <label htmlFor="task-type">
                  Task Type <span>*</span>
                </label>
                <select
                  id="task-type"
                  name="taskType"
                  value={taskForm.taskType}
                  onChange={handleTaskChange}
                  required
                >
                  <option value="">
                    Select Task Type
                  </option>
                  <option value="Strategy/Pitch Deck">
                    Strategy/Pitch Deck
                  </option>
                  <option value="Mood Board">
                    Mood Board
                  </option>
                  <option value="Shoots">
                    Shoots
                  </option>
                  <option value="Content Planning">
                    Content Planning
                  </option>
                  <option value="Content Writing">
                    Content Writing
                  </option>
                  <option value="Influencer Collaboration">
                    Influencer Collaboration
                  </option>
                </select>
              </div>
              {/* OBJECTIVE */}
              <div className="sme-form-group">
                <label htmlFor="task-objective">
                  Objective <span>*</span>
                </label>
                <select
                  id="task-objective"
                  name="objective"
                  value={taskForm.objective}
                  onChange={handleTaskChange}
                  required
                >
                  <option value="">
                    Select Objective
                  </option>
                  <option value="Brand Awareness">
                    Brand Awareness
                  </option>
                  <option value="Lead Generation">
                    Lead Generation
                  </option>
                  <option value="Brand Positioning">
                    Brand Positioning
                  </option>
                  <option value="Others">
                    Others
                  </option>
                </select>
              </div>
              {/* CUSTOM OBJECTIVE */}
              {taskForm.objective === 'Others' && (
                <div className="sme-form-group">
                  <label htmlFor="custom-objective">
                    Specify Objective <span>*</span>
                  </label>
                  <input
                    type="text"
                    id="custom-objective"
                    name="customObjective"
                    placeholder="Enter your objective"
                    value={taskForm.customObjective}
                    onChange={handleTaskChange}
                    maxLength={120}
                    required
                  />
                </div>
              )}
              <div className="sme-form-group">
                <label htmlFor="task-brief">Brief</label>
                <textarea id="task-brief" name="brief" placeholder="Enter task brief or additional instructions" value={taskForm.brief} onChange={handleTaskChange} maxLength={1000} rows={4} />
              </div>
              <div className="sme-form-group">
                <label htmlFor="task-assigned-to">Assign To</label>
                <select id="task-assigned-to" name="assignedTo" value={taskForm.assignedTo} onChange={handleTaskChange}>
                  <option value="">Select Assignee</option>
                  <option value="Admin">Admin</option>
                  <option value="SME">SME</option>
                  <option value="SMI">SMI</option>
                  <option value="Designer">Designer</option>
                </select>
              </div>
              {/* PRIORITY */}
              <div className="sme-form-group">
                <label htmlFor="task-priority">
                  Priority <span>*</span>
                </label>
                <select
                  id="task-priority"
                  name="priority"
                  value={taskForm.priority}
                  onChange={handleTaskChange}
                  required
                >
                  <option value="">
                    Select Priority
                  </option>
                  <option value="High">
                    High
                  </option>
                  <option value="Low">
                    Low
                  </option>
                  <option value="Critical">
                    Critical
                  </option>
                </select>
              </div>
              {/* FORM BUTTONS */}
              <div className="sme-task-form-actions">
                <button
                  type="button"
                  className="sme-task-cancel-btn"
                  onClick={closeTaskModal}
                  disabled={creatingTask}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="sme-task-submit-btn"
                  disabled={creatingTask || !companies.length}
                >
                  {creatingTask
                    ? 'Creating...'
                    : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default SmeDashboard;