import { useEffect, useMemo, useState } from 'react';
import api from '../api';
import { errMsg } from '../sopUtils';
import '../styles/influencer.css';
import {
  Megaphone, Users, Eye, TrendingUp, Search, X,
  Mail, Phone, MapPin, Building2, ArrowUp, ArrowDown, IndianRupee
} from 'lucide-react';
import { YoutubeIcon, InstagramIcon } from './SocialIcons';

const PAGE = 25;
const CHANNELS = [
  { value: 'youtube', label: 'YouTube' },
  { value: 'instagram', label: 'Instagram' }
];

const compact = (n) => new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 }).format(n || 0);
const initials = (name = '') => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('') || 'I';
// only open real web links
const safeUrl = (u) => (/^https?:\/\//i.test(u || '') ? u : '');

const money = (n) => (n == null ? '—' : `₹${new Intl.NumberFormat('en-IN').format(n)}`);

const COLUMNS = [
  { key: 'followers', label: 'Followers' },
  { key: 'avgReelViews', label: 'Avg reel views' },
  { key: 'engagement', label: 'Engagement' }
];

const InfluencerDashboard = ({ role = 'sme' }) => {
  const [list, setList] = useState(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [channel, setChannel] = useState('all');
  const [category, setCategory] = useState('all');
  const [location, setLocation] = useState('all');
  const [collab, setCollab] = useState('all');
  const [sort, setSort] = useState({ key: 'followers', dir: 'desc' });
  const [visible, setVisible] = useState(PAGE);

  useEffect(() => {
    let cancelled = false;
    api.get(`/${role}/influencers`)
      .then((res) => !cancelled && setList(res.data.influencers))
      .catch((err) => {
        if (cancelled) return;
        setList([]);
        setError(errMsg(err));
      });
    return () => {
      cancelled = true;
    };
  }, [role]);

  const categories = useMemo(() => [...new Set((list || []).map((i) => i.category).filter(Boolean))].sort(), [list]);
  const locations = useMemo(() => [...new Set((list || []).map((i) => i.location).filter(Boolean))].sort(), [list]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const items = (list || []).filter((i) => {
      if (channel !== 'all' && !i.channels.includes(channel)) return false;
      if (category !== 'all' && i.category !== category) return false;
      if (location !== 'all' && i.location !== location) return false;
      if (collab !== 'all' && i.collaborationType !== collab) return false;
      if (!q) return true;
      return [i.name, i.category, i.location, i.managementAgency, i.email, i.contact, i.youtubeStats?.handle, i.youtubeStats?.title]
        .some((v) => (v || '').toLowerCase().includes(q));
    });
    const sign = sort.dir === 'asc' ? 1 : -1;
    return [...items].sort((a, b) => sign * ((a[sort.key] || 0) - (b[sort.key] || 0)));
  }, [list, query, channel, category, location, collab, sort]);

  // numbers for whatever is currently filtered
  const stats = useMemo(() => {
    const n = shown.length;
    const sum = (k) => shown.reduce((t, i) => t + (i[k] || 0), 0);
    return {
      total: n,
      followers: sum('followers'),
      avgViews: n ? sum('avgReelViews') / n : 0,
      avgEr: n ? sum('engagement') / n : 0
    };
  }, [shown]);

  const filtered = query || channel !== 'all' || category !== 'all' || location !== 'all' || collab !== 'all';
  const clearFilters = () => {
    setQuery('');
    setChannel('all');
    setCategory('all');
    setLocation('all');
    setCollab('all');
  };
  const toggleSort = (key) => {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: 'desc' }));
    setVisible(PAGE);
  };
  const resetPage = (setter) => (e) => {
    setter(e.target.value);
    setVisible(PAGE);
  };

  return (
    <section className="inf-dash glass-panel" aria-label="Influencer dashboard">
      <div className="inf-header">
        <div className="inf-heading">
          <div className="inf-heading-icon"><Megaphone size={22} /></div>
          <div>
            <h2>Influencer Dashboard</h2>
            <p>Creators, their reach and how to contact them</p>
          </div>
        </div>
      </div>

      <div className="inf-kpis">
        <div className="inf-kpi"><span className="inf-kpi-icon"><Users size={16} /></span><b>{list ? stats.total : '--'}</b><small>{filtered ? 'Matching influencers' : 'Influencers'}</small></div>
        <div className="inf-kpi"><span className="inf-kpi-icon"><TrendingUp size={16} /></span><b>{list ? compact(stats.followers) : '--'}</b><small>Total followers</small></div>
        <div className="inf-kpi"><span className="inf-kpi-icon"><Eye size={16} /></span><b>{list ? compact(stats.avgViews) : '--'}</b><small>Avg reel views</small></div>
        <div className="inf-kpi"><span className="inf-kpi-icon"><TrendingUp size={16} /></span><b>{list ? `${stats.avgEr.toFixed(1)}%` : '--'}</b><small>Avg engagement</small></div>
      </div>

      <div className="inf-toolbar">
        <label className="inf-search">
          <Search size={14} />
          <input value={query} onChange={resetPage(setQuery)} placeholder="Search name, category, agency, email" aria-label="Search influencers" />
          {query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search"><X size={14} /></button>}
        </label>
        <div className="inf-filters">
          <select value={channel} onChange={resetPage(setChannel)} aria-label="Filter by channel">
            <option value="all">All channels</option>
            {CHANNELS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <select value={category} onChange={resetPage(setCategory)} aria-label="Filter by category">
            <option value="all">All categories</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={location} onChange={resetPage(setLocation)} aria-label="Filter by location">
            <option value="all">All locations</option>
            {locations.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
          <select value={collab} onChange={resetPage(setCollab)} aria-label="Filter by collaboration type">
            <option value="all">Paid &amp; unpaid</option>
            <option value="paid">Paid</option>
            <option value="unpaid">Unpaid</option>
          </select>
          {filtered && <button type="button" className="inf-clear" onClick={clearFilters}>Clear</button>}
        </div>
      </div>

      {error && <p className="error-message" role="alert">{error}</p>}

      {!list ? (
        <p className="muted">Loading…</p>
      ) : shown.length === 0 ? (
        <p className="muted">{list.length === 0 ? 'No influencers in the database yet.' : 'No influencers match these filters.'}</p>
      ) : (
        <>
          <div className="inf-table-wrap">
            <table className="inf-table">
              <thead>
                <tr>
                  <th>Influencer</th>
                  <th>Channels</th>
                  {COLUMNS.map((c) => (
                    <th key={c.key} className="num">
                      <button type="button" className={sort.key === c.key ? 'sorted' : ''} onClick={() => toggleSort(c.key)}>
                        {c.label}
                        {sort.key === c.key && (sort.dir === 'desc' ? <ArrowDown size={12} /> : <ArrowUp size={12} />)}
                      </button>
                    </th>
                  ))}
                  <th>Contact &amp; agency</th>
                  <th>Collaboration</th>
                </tr>
              </thead>
              <tbody>
                {shown.slice(0, visible).map((i) => (
                  <tr key={i.id}>
                    <td data-label="Influencer">
                      <div className="inf-person">
                        <span className="inf-avatar" aria-hidden="true">{initials(i.name)}</span>
                        <div>
                          <strong>{i.name}</strong>
                          <span className="inf-pill">{i.category}</span>
                          <span className="inf-loc"><MapPin size={12} /> {i.location}</span>
                        </div>
                      </div>
                    </td>
                    <td data-label="Channels">
                      <div className="inf-channels">
                        {i.channels.includes('youtube') && (safeUrl(i.youtubeLink)
                          ? <a className="inf-chan yt" href={safeUrl(i.youtubeLink)} target="_blank" rel="noopener noreferrer" title="Open YouTube"><YoutubeIcon size={14} /> YouTube</a>
                          : <span className="inf-chan yt"><YoutubeIcon size={14} /> YouTube</span>)}
                        {i.channels.includes('youtube') && i.youtubeStats?.channelId && (
                          <span className="inf-yt-stats" title={i.youtubeStats.title}>
                            {i.youtubeStats.handle && <em>{i.youtubeStats.handle}</em>}
                            <span>{i.youtubeStats.subscribers == null ? 'Subs hidden' : `${compact(i.youtubeStats.subscribers)} subs`} · {compact(i.youtubeStats.avgViews)} avg views</span>
                            <span>{compact(i.youtubeStats.totalViews)} total views · {i.youtubeStats.videoCount} videos · {i.youtubeStats.engagement}% eng.</span>
                          </span>
                        )}
                        {i.channels.includes('instagram') && (safeUrl(i.instagramLink)
                          ? <a className="inf-chan ig" href={safeUrl(i.instagramLink)} target="_blank" rel="noopener noreferrer" title="Open Instagram"><InstagramIcon size={14} /> Instagram</a>
                          : <span className="inf-chan ig"><InstagramIcon size={14} /> Instagram</span>)}
                      </div>
                    </td>
                    <td className="num" data-label="Followers"><b>{compact(i.followers)}</b></td>
                    <td className="num" data-label="Avg reel views">{compact(i.avgReelViews)}</td>
                    <td className="num" data-label="Engagement">{i.engagement}%</td>
                    <td data-label="Contact">
                      <div className="inf-contact">
                        <span><Phone size={12} /> {i.contact}</span>
                        <a href={`mailto:${i.email}`}><Mail size={12} /> {i.email}</a>
                        {i.managementAgency && <span className="inf-agency"><Building2 size={12} /> {i.managementAgency}</span>}
                      </div>
                    </td>
                    <td data-label="Collaboration">
                      <span className={`inf-collab ${i.collaborationType}`}>{i.collaborationType === 'paid' ? 'Paid' : 'Unpaid'}</span>
                      {i.collaborationType === 'paid' && <span className="inf-price"><IndianRupee size={12} />{money(i.collaborationPrice).replace('₹','')}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="inf-foot">
            <span className="muted">Showing {Math.min(visible, shown.length)} of {shown.length}</span>
            {visible < shown.length && (
              <button type="button" className="inf-more" onClick={() => setVisible((v) => v + PAGE)}>Show more</button>
            )}
          </div>
        </>
      )}
    </section>
  );
};

export default InfluencerDashboard;
