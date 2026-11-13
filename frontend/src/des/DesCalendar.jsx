import { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays, ChevronLeft, ChevronRight, RefreshCw,
  LoaderCircle, AlertCircle, Palette, Building2, Clock3,
  CheckCircle2, XCircle, Layers
} from 'lucide-react';
import api from '../api';
import { PLATFORMS } from '../components/creativePlatforms';
import '../styles/descalendar.css';
const getDateKey = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};
const getCompanyId = (creative) => {
  const company = creative.company;
  return String(company?._id || company?.id || company || '');
};
const formatDate = (date) => {
  if (!date) return '';
  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day) return date;
  return new Date(year, month - 1, day).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const STATUS_CONFIG = {
  submitted: {
    label: 'Pending',
    icon: Clock3,
    className: 'pending'
  },
  approved: {
    label: 'Approved',
    icon: CheckCircle2,
    className: 'approved'
  },
  redo: {
    label: 'Changes Requested',
    icon: XCircle,
    className: 'rejected'
  }
};
const DesCalendar = () => {
  const [companies, setCompanies] = useState([]);
  const [creatives, setCreatives] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState('all');
  const [activePlatform, setActivePlatform] = useState('all');
  const [currentMonth, setCurrentMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const fetchCalendarData = async (refresh = false) => {
    try {
      setError('');
      if (refresh) setRefreshing(true);
      else setLoading(true);
      const [companyResponse, creativeResponse] = await Promise.all([
        api.get('/des/companies'),
        api.get('/des/creatives')
      ]);
      setCompanies(Array.isArray(companyResponse.data)
        ? companyResponse.data
        : companyResponse.data?.companies || []);
      setCreatives(creativeResponse.data?.creatives || []);
    } catch (err) {
      setError(
        err.response?.data?.message ||
        'Unable to load your calendar. Please try again.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  useEffect(() => {
    fetchCalendarData();
  }, []);
  const filteredCreatives = useMemo(() => {
    return creatives.filter((creative) => {
      const companyMatch =
        selectedCompany === 'all' ||
        getCompanyId(creative) === String(selectedCompany);
      const platforms = (creative.contentPillar?.platforms || [])
        .map((platform) => platform.toLowerCase());
      const platformMatch =
        activePlatform === 'all' ||
        platforms.includes(activePlatform);
      return companyMatch && platformMatch;
    });
  }, [creatives, selectedCompany, activePlatform]);
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const startDay = firstDay.getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const totalCells = Math.ceil((startDay + totalDays) / 7) * 7;
    const todayKey = getDateKey(new Date());
    const creativesByDate = filteredCreatives.reduce((acc, creative) => {
      if (!creative.date) return acc;
      if (!acc[creative.date]) acc[creative.date] = [];
      acc[creative.date].push(creative);
      return acc;
    }, {});
    return Array.from({ length: totalCells }, (_, index) => {
      const date = new Date(year, month, index - startDay + 1);
      const dateKey = getDateKey(date);
      return {
        date,
        dateKey,
        day: date.getDate(),
        isCurrentMonth: date.getMonth() === month,
        isToday: dateKey === todayKey,
        creatives: creativesByDate[dateKey] || []
      };
    });
  }, [currentMonth, filteredCreatives]);
  const monthCreatives = useMemo(() => {
    const month = currentMonth.getMonth();
    const year = currentMonth.getFullYear();
    return filteredCreatives.filter((creative) => {
      if (!creative.date) return false;
      const [y, m] = creative.date.split('-').map(Number);
      return y === year && m === month + 1;
    });
  }, [filteredCreatives, currentMonth]);
  const changeMonth = (amount) => {
    setCurrentMonth((prev) =>
      new Date(prev.getFullYear(), prev.getMonth() + amount, 1)
    );
  };
  const selectToday = () => {
    const today = new Date();
    setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
  };
  if (loading) {
    return (
      <div className="descal-loading">
        <LoaderCircle size={34} className="descal-spin" />
        <p>Loading your calendar...</p>
      </div>
    );
  }
  return (
    <div className="descal-page dashboard-content scrollable dash-glass">
      <div className="descal-header">
        <div>
          <span className="descal-eyebrow">DESIGN WORKSPACE</span>
          <h1>Creative Calendar</h1>
          <p>Manage your assigned companies and scheduled creatives.</p>
        </div>
        <button
          type="button"
          className="descal-refresh"
          onClick={() => fetchCalendarData(true)}
          disabled={refreshing}
        >
          <RefreshCw
            size={16}
            className={refreshing ? 'descal-spin' : ''}
          />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>
      {error && (
        <div className="descal-error">
          <AlertCircle size={18} />
          <span>{error}</span>
          <button type="button" onClick={() => fetchCalendarData()}>
            Retry
          </button>
        </div>
      )}
      {/* ASSIGNED COMPANIES */}
      <section className="descal-companies-section">
        <div className="descal-section-heading">
          <div>
            <span className="descal-eyebrow">YOUR WORKSPACE</span>
            <h2>Assigned Companies</h2>
          </div>
          <span className="descal-count">
            {companies.length} Companies
          </span>
        </div>
        {companies.length === 0 ? (
          <div className="descal-no-companies">
            <Building2 size={24} />
            <span>No companies assigned yet.</span>
          </div>
        ) : (
          <div className="descal-company-list">
            <button
              type="button"
              className={`descal-company-item ${selectedCompany === 'all' ? 'active' : ''}`}
              onClick={() => setSelectedCompany('all')}
            >
              <div className="descal-company-logo descal-all-logo">
                <Layers size={25} />
              </div>
              <span className="descal-company-name">All Companies</span>
              <span className="descal-company-number">
                {creatives.length} Creatives
              </span>
            </button>
            {companies.map((company) => {
              const companyId = String(company._id || company.id);
              const active = selectedCompany === companyId;
              return (
                <button
                  type="button"
                  key={companyId}
                  className={`descal-company-item ${active ? 'active' : ''}`}
                  onClick={() => setSelectedCompany(companyId)}
                >
                  <div className="descal-company-logo">
                    {company.logo ? (
                      <img
                        src={company.logo}
                        alt={company.name}
                        loading="lazy"
                      />
                    ) : (
                      <Building2 size={25} />
                    )}
                  </div>
                  <span className="descal-company-name">
                    {company.name}
                  </span>
                  <span className="descal-company-number">
                    {company.creativeCount || 0} Creatives
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>
      {/* SOCIAL PLATFORM TABS */}
      <section className="descal-platform-section">
        <div className="descal-section-heading">
          <div>
            <span className="descal-eyebrow">FILTER YOUR CREATIVES</span>
            <h2>Social Platforms</h2>
          </div>
        </div>
        <div className="descal-platform-tabs">
          <button
            type="button"
            className={`descal-platform-tab descal-all-tab ${activePlatform === 'all' ? 'active' : ''}`}
            onClick={() => setActivePlatform('all')}
          >
            <Layers size={19} />
            <span>All</span>
          </button>
          {PLATFORMS.map((platform) => {
            const PlatformIcon = platform.icon;
            return (
              <button
                type="button"
                key={platform.key}
                className={`descal-platform-tab ${activePlatform === platform.key ? 'active' : ''}`}
                onClick={() => setActivePlatform(platform.key)}
              >
                <PlatformIcon size={20} />
                <span>{platform.label}</span>
              </button>
            );
          })}
        </div>
      </section>
      {/* CALENDAR */}
      <section className="descal-calendar-section">
        <div className="descal-calendar-toolbar">
          <div className="descal-month-title">
            <CalendarDays size={21} />
            <div>
              <h2>
                {MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}
              </h2>
              <span>{monthCreatives.length} Scheduled Creatives</span>
            </div>
          </div>
          <div className="descal-month-controls">
            <button type="button" onClick={selectToday}>
              Today
            </button>
            <button
              type="button"
              className="descal-month-arrow"
              onClick={() => changeMonth(-1)}
              aria-label="Previous month"
            >
              <ChevronLeft size={19} />
            </button>
            <button
              type="button"
              className="descal-month-arrow"
              onClick={() => changeMonth(1)}
              aria-label="Next month"
            >
              <ChevronRight size={19} />
            </button>
          </div>
        </div>
        <div className="descal-calendar-grid">
          {WEEKDAYS.map((day) => (
            <div className="descal-weekday" key={day}>
              {day}
            </div>
          ))}
          {calendarDays.map((day) => (
            <div
              key={day.dateKey}
              className={`descal-day ${!day.isCurrentMonth ? 'outside' : ''} ${day.isToday ? 'today' : ''} ${day.creatives.length ? 'has-creatives' : ''}`}
            >
              <div className="descal-day-number">
                <span>{day.day}</span>
                {day.creatives.length > 0 && (
                  <span className="descal-day-count">
                    {day.creatives.length}
                  </span>
                )}
              </div>
              <div className="descal-day-creatives">
                {day.creatives.map((creative) => {
                  const design = creative.designOutput;
                  if (!design?.url) return null;
                  const status = STATUS_CONFIG[design.status] || STATUS_CONFIG.submitted;
                  const StatusIcon = status.icon;
                  const mimeType = design.mimeType || '';
                  return (
                    <div
                      key={creative._id}
                      className={`descal-event descal-design-card ${status.className}`}
                      title={`${creative.contentPillar?.title || 'Untitled Creative'} · ${creative.company?.name || 'Company'}`}
                    >
                      <div className="descal-design-preview">
                        {mimeType.startsWith('image/') ? (
                          <img
                            src={design.url}
                            alt={creative.contentPillar?.title || 'Uploaded design'}
                            loading="lazy"
                          />
                        ) : mimeType.startsWith('video/') ? (
                          <video
                            src={design.url}
                            controls
                            preload="metadata"
                          />
                        ) : (
                          <a
                            href={design.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="descal-file-preview"
                          >
                            <Palette size={25} />
                            <span>View Uploaded File</span>
                          </a>
                        )}
                        <span className={`descal-design-status ${status.className}`}>
                          <StatusIcon size={12} />
                          {status.label}
                        </span>
                      </div>
                      <div className="descal-design-info">
                        <span className="descal-event-company">
                          {creative.company?.name || 'Company'}
                        </span>
                        <span className="descal-event-title">
                          {creative.contentPillar?.title || 'Untitled Creative'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        {monthCreatives.length === 0 && (
          <div className="descal-empty">
            <div className="descal-empty-icon">
              <Palette size={30} />
            </div>
            <h3>No Creatives Scheduled</h3>
            <p>
              No creatives found for the selected company and platform
              in this month.
            </p>
          </div>
        )}
        <div className="descal-legend">
          <span><i className="pending"></i> Pending</span>
          <span><i className="approved"></i> Approved</span>
          <span><i className="rejected"></i> Changes Requested</span>
        </div>
      </section>
    </div>
  );
};
export default DesCalendar;
