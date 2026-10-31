
import { useAuth } from '../AuthContext';
import { useEffect, useState } from 'react';

import {
  LayoutDashboard,
  Briefcase,
  Activity,
  Clock3,
  ListTodo,
  Plus,
  BriefcaseBusiness,
  Repeat,
  CheckCircle2
} from 'lucide-react';

import '../style.css';
import '../styles/smedashboard.css';

const SmeDashboard = () => {
  const { user } = useAuth();

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

  const taskCategories = [
    {
      title: 'New Tasks',
      count: '00',
      icon: ListTodo,
      color: 'purple',
      description: 'Tasks waiting to be assigned'
    },
    {
      title: 'Work In Progress',
      count: '00',
      icon: BriefcaseBusiness,
      color: 'blue',
      description: 'Currently ongoing tasks'
    },
    {
      title: 'Recurring Tasks',
      count: '00',
      icon: Repeat,
      color: 'orange',
      description: 'Regularly scheduled tasks'
    },
    {
      title: 'Completed Tasks',
      count: '00',
      icon: CheckCircle2,
      color: 'green',
      description: 'Successfully completed tasks'
    }
  ];

  const handleAddTask = () => {
    alert('Add New Task feature coming soon!');
  };

  return (
    <div className="dashboard-content sme-dashboard-content">

      {/* Dashboard Header */}

      <div className="dashboard-topbar">

        <div className="dashboard-greeting">
          <span className="page-label">SME WORKSPACE</span>

          <h1>
            {greeting}, {user?.name || 'User'}!
          </h1>

          <p>Welcome back! Here's your workspace overview.</p>
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

      {/* Statistics */}

      <div className="stats-grid">

        <div className="stat-card">
          <div className="stat-icon purple">
            <LayoutDashboard />
          </div>

          <span>Dashboard</span>
          <h2>SME</h2>
        </div>

        <div className="stat-card">
          <div className="stat-icon blue">
            <Briefcase />
          </div>

          <span>Workspace</span>
          <h2>Active</h2>
        </div>

        <div className="stat-card">
          <div className="stat-icon green">
            <Activity />
          </div>

          <span>Account Status</span>
          <h2>Active</h2>
        </div>

      </div>

      {/* Welcome Card */}

      <div className="welcome-card">
        <h2>SME Dashboard</h2>

        <p>
          Your SME workspace is ready.
          Your future modules will be added here.
        </p>
      </div>

      {/* Task Manager */}

      <section className="sme-task-manager">

        <div className="sme-task-header">

          <div className="sme-task-heading">

            <div className="sme-task-heading-icon">
              <ListTodo size={21} />
            </div>

            <div>
              <h2>Task Manager</h2>
              <p>Manage and track your team's tasks.</p>
            </div>

          </div>

        </div>

        <div className="sme-task-grid">

          {taskCategories.map((task, index) => {
            const Icon = task.icon;

            return (
              <div className="sme-task-card" key={task.title}>

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
                  <h3>{task.count}</h3>
                  <h4>{task.title}</h4>
                  <p>{task.description}</p>
                </div>

              </div>
            );
          })}

        </div>

      </section>

    </div>
  );
};

export default SmeDashboard;
