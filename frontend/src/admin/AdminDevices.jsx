import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, MapPin, Smartphone, ListChecks, Plus, Copy, Crosshair, Trash2 } from 'lucide-react';
import api from '../api';
import { errMsg } from '../sopUtils';
import '../styles/devices.css';

const pad = (n) => String(n).padStart(2, '0');
const dayKey = (v) => { const d = new Date(v); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const today = () => dayKey(new Date());
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return dayKey(d); };
const fmtTime = (v) => new Date(v).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
const fmtDay = (v) => new Date(v).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
const hm = (m) => (m == null ? null : `${Math.floor(m / 60)}h ${pad(m % 60)}m`);

const QUICK = [
  { id: 'today', label: 'Today', get: () => [today(), today()] },
  { id: 'yesterday', label: 'Yesterday', get: () => [daysAgo(1), daysAgo(1)] },
  { id: 'week', label: 'Last 7 days', get: () => [daysAgo(6), today()] },
  { id: 'month', label: 'Last 30 days', get: () => [daysAgo(29), today()] }
];

// One row = one device in one location on one day:
// first in-time of the day, and the LAST out-time of the day.
const buildDays = (visits) => {
  const map = new Map();
  visits.forEach((v) => {
    const key = `${v.deviceId}|${v.locationId}|${dayKey(v.inAt)}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(v);
  });
  return [...map.entries()].map(([key, list]) => {
    list.sort((a, b) => new Date(a.inAt) - new Date(b.inAt));
    const first = list[0];
    const last = list[list.length - 1];
    const inside = list.some((v) => !v.outAt);
    const lastOut = inside ? null : list.reduce((m, v) => (new Date(v.outAt) > new Date(m) ? v.outAt : m), list[0].outAt);
    const minutes = list.reduce((t, v) => t + Math.max(0, Math.round(((v.outAt ? new Date(v.outAt) : new Date()) - new Date(v.inAt)) / 60000)), 0);
    return { key, day: first.inAt, dayKey: dayKey(first.inAt), deviceName: first.deviceName, ownerName: first.ownerName, locationName: first.locationName, firstIn: first.inAt, lastOut, inside, minutes, entries: list.length, last };
  }).sort((a, b) => new Date(b.firstIn) - new Date(a.firstIn));
};

const AdminDevices = ({ base = '/devices', canEdit = true, label = 'ADMINISTRATION' }) => {
  const [tab, setTab] = useState('log');
  const [devices, setDevices] = useState([]);
  const [locations, setLocations] = useState([]);
  const [visits, setVisits] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [range, setRange] = useState({ from: today(), to: today() });
  const [deviceId, setDeviceId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [newKey, setNewKey] = useState(null); // { name, key }
  const [cfg, setCfg] = useState({ publicUrl: '', lanIps: [] });

  const [devForm, setDevForm] = useState({ name: '', type: 'phone', ownerId: '', ownerName: '' });
  const [locForm, setLocForm] = useState({ name: '', lat: '', lng: '', radius: 100 });
  const [officeForm, setOfficeForm] = useState({ lat: '', lng: '', radius: 100 });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, l, v] = await Promise.all([
        api.get(`${base}/devices`),
        api.get(`${base}/locations`),
        api.get(`${base}/visits`, { params: { from: range.from, to: range.to, deviceId: deviceId || undefined, locationId: locationId || undefined, limit: 5000 } })
      ]);
      setDevices(d.data.devices);
      setLocations(l.data.locations);
      setVisits(v.data.visits);
      setError('');
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [base, range, deviceId, locationId]);

  useEffect(() => { load(); }, [load, reloadKey]);

  // refresh the live status every 30s while the page is open
  useEffect(() => {
    const t = setInterval(() => setReloadKey((k) => k + 1), 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    api.get(`${base}/config`).then((r) => setCfg(r.data)).catch(() => {});
  }, [base]);

  useEffect(() => {
    if (!canEdit) return;
    api.get('/admin/users').then((r) => setUsers(r.data.users || [])).catch(() => {});
  }, [canEdit]);

  const office = locations.find((l) => l.isOffice) || null;
  useEffect(() => {
    if (office) setOfficeForm({ lat: String(office.lat), lng: String(office.lng), radius: office.radius });
  }, [office?.lat, office?.lng, office?.radius]); // eslint-disable-line react-hooks/exhaustive-deps

  const days = useMemo(() => buildDays(visits), [visits]);
  const activeQuick = QUICK.find((q) => { const [f, t] = q.get(); return f === range.from && t === range.to; })?.id;
  const insideNow = devices.filter((d) => d.currentLocationId).length;

  const act = async (fn) => {
    try { setError(''); await fn(); setReloadKey((k) => k + 1); } catch (e) { setError(errMsg(e)); }
  };

  const addDevice = (e) => {
    e.preventDefault();
    act(async () => {
      const res = await api.post(`${base}/devices`, devForm);
      setNewKey({ name: res.data.device.name, key: res.data.device.deviceKey });
      setDevForm({ name: '', type: 'phone', ownerId: '', ownerName: '' });
    });
  };

  const addLocation = (e) => {
    e.preventDefault();
    act(async () => {
      await api.post(`${base}/locations`, { ...locForm, lat: Number(locForm.lat), lng: Number(locForm.lng), radius: Number(locForm.radius) });
      setLocForm({ name: '', lat: '', lng: '', radius: 100 });
    });
  };

  const saveOffice = (e) => {
    e.preventDefault();
    act(() => api.put(`${base}/office`, { lat: Number(officeForm.lat), lng: Number(officeForm.lng), radius: Number(officeForm.radius) }));
  };

  const useMyPosition = (target = 'loc') => {
    if (!navigator.geolocation) return setError('This browser cannot read your location.');
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const lat = p.coords.latitude.toFixed(6);
        const lng = p.coords.longitude.toFixed(6);
        if (target === 'office') setOfficeForm((f) => ({ ...f, lat, lng }));
        else setLocForm((f) => ({ ...f, lat, lng }));
      },
      () => setError('Location permission was denied.'),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  // The link must be reachable from the phone: never "localhost".
  const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);
  const linkBase = cfg.publicUrl
    || (isLocal && cfg.lanIps[0] ? `${window.location.protocol}//${cfg.lanIps[0]}${window.location.port ? `:${window.location.port}` : ''}` : window.location.origin);
  const insecure = linkBase.startsWith('http://') && !/^http:\/\/(localhost|127\.0\.0\.1)/.test(linkBase);
  const trackerLink = (key) => `${linkBase}/track?key=${key}`;
  const copy = (text) => navigator.clipboard?.writeText(text).catch(() => {});

  return (
    <div className="dashboard-content scrollable">
      <div className="page-header">
        <div>
          <span className="page-label">{label}</span>
          <h1>Devices &amp; Locations</h1>
          <p>Register devices and places. When a device enters a place its in-time is recorded; when it leaves, the out-time. The last out-time of the day is what you see in the log.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {canEdit && <button type="button" className="btn-primary" onClick={() => setTab('devices')}><Plus size={15} /> Add device</button>}
          <button type="button" className="btn-ghost" onClick={() => setReloadKey((k) => k + 1)}><RefreshCw size={15} /> Refresh</button>
        </div>
      </div>

      <div className="dv-tabs" role="tablist">
        <button type="button" className={tab === 'log' ? 'active' : ''} onClick={() => setTab('log')}><ListChecks size={15} /> In / Out log</button>
        <button type="button" className={tab === 'devices' ? 'active' : ''} onClick={() => setTab('devices')}><Smartphone size={15} /> Devices ({devices.length})</button>
        <button type="button" className={tab === 'locations' ? 'active' : ''} onClick={() => setTab('locations')}><MapPin size={15} /> Locations ({locations.length})</button>
      </div>

      {error && <p className="error-message" role="alert">{error}</p>}

      {tab === 'devices' && (
        <div className="dv-key">
          <div style={{ flex: '1 1 100%' }}>
            <b>Tracker links use: {linkBase}</b>
            {insecure
              ? ' — phones block GPS on plain http:// pages, so the phone will refuse to share location. For a phone, run an https tunnel (e.g. ngrok http 5173 or cloudflared) and put its address in PUBLIC_URL in backend/.env. To test without a tunnel, open the link in a browser on this same computer.'
              : cfg.publicUrl ? ' (from PUBLIC_URL).' : '.'}
          </div>
        </div>
      )}

      {newKey && (
        <div className="dv-key">
          <div style={{ flex: '1 1 100%' }}><b>“{newKey.name}” registered.</b> Open this link once on that device and allow location. Keep it private — anyone with the link can report as this device.</div>
          <code>{trackerLink(newKey.key)}</code>
          <button type="button" className="btn-ghost" onClick={() => copy(trackerLink(newKey.key))}><Copy size={14} /> Copy link</button>
          <button type="button" className="btn-ghost" onClick={() => setNewKey(null)}>Done</button>
        </div>
      )}

      {/* ================= LOG ================= */}
      {tab === 'log' && (
        <>
          <div className="dv-bar">
            <div className="dv-chips">
              {QUICK.map((q) => (
                <button key={q.id} type="button" className={activeQuick === q.id ? 'active' : ''} onClick={() => { const [f, t] = q.get(); setRange({ from: f, to: t }); }}>{q.label}</button>
              ))}
            </div>
            <input type="date" value={range.from === range.to ? range.from : ''} max={today()} onChange={(e) => e.target.value && setRange({ from: e.target.value, to: e.target.value })} aria-label="Pick a date" />
            <select value={deviceId} onChange={(e) => setDeviceId(e.target.value)} aria-label="Device">
              <option value="">All devices</option>
              {devices.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <select value={locationId} onChange={(e) => setLocationId(e.target.value)} aria-label="Location">
              <option value="">All locations</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
            <span className="grow" />
            <span className="dv-pill in">{insideNow} inside now</span>
          </div>

          <div className="dv-table dv-log" role="table">
            <div className="dv-tr dv-th" role="row">
              <span>Device</span><span>Location</span><span>Date</span><span>In time</span><span>Out time (last)</span><span>Time inside</span>
            </div>
            {loading && days.length === 0 ? <div className="dv-empty">Loading…</div>
              : days.length === 0 ? <div className="dv-empty">No entries for this period.</div>
              : days.map((g) => (
                <div key={g.key} className="dv-tr" role="row">
                  <span><b>{g.deviceName}</b>{g.ownerName && <small>{g.ownerName}</small>}</span>
                  <span>{g.locationName}</span>
                  <span>{fmtDay(g.day)}{g.entries > 1 && <small>{g.entries} entries</small>}</span>
                  <span>{fmtTime(g.firstIn)}</span>
                  <span>{g.inside ? <span className="dv-pill in">Still inside</span> : fmtTime(g.lastOut)}</span>
                  <span>{hm(g.minutes) || <em>—</em>}</span>
                </div>
              ))}
          </div>
        </>
      )}

      {/* ================= DEVICES ================= */}
      {tab === 'devices' && (
        <>
          {canEdit && (
            <form className="dv-form" onSubmit={addDevice}>
              <label>Device name<input required value={devForm.name} onChange={(e) => setDevForm({ ...devForm, name: e.target.value })} placeholder="e.g. Rahul’s iPhone" maxLength={80} /></label>
              <label>Type
                <select value={devForm.type} onChange={(e) => setDevForm({ ...devForm, type: e.target.value })}>
                  <option value="phone">Phone</option><option value="laptop">Laptop</option><option value="tablet">Tablet</option><option value="tag">Tag / reader</option><option value="other">Other</option>
                </select>
              </label>
              <label>Belongs to (user)
                <select value={devForm.ownerId} onChange={(e) => setDevForm({ ...devForm, ownerId: e.target.value })}>
                  <option value="">— none —</option>
                  {[...users].sort((a, b) => String(a.name).localeCompare(String(b.name))).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </label>
              <label>…or owner name<input value={devForm.ownerName} onChange={(e) => setDevForm({ ...devForm, ownerName: e.target.value })} placeholder="Optional" maxLength={80} /></label>
              <button type="submit" className="btn-primary"><Plus size={15} /> Register device</button>
            </form>
          )}
          <div className="dv-table dv-devs" role="table">
            <div className="dv-tr dv-th" role="row"><span>Device</span><span>Owner</span><span>Status</span><span>Last seen</span><span /></div>
            {devices.length === 0 ? <div className="dv-empty">No devices registered yet.</div> : devices.map((d) => (
              <div key={d.id} className="dv-tr" role="row">
                <span><b>{d.name}</b><small>{d.type}</small></span>
                <span>{d.ownerName || <em>—</em>}</span>
                <span>{!d.active ? <span className="dv-pill off">Disabled</span> : d.currentLocation ? <span className="dv-pill in">Inside · {d.currentLocation}</span> : <span className="dv-pill out">Outside</span>}</span>
                <span>{d.lastSeenAt ? `${fmtDay(d.lastSeenAt)}, ${fmtTime(d.lastSeenAt)}` : <em>Never</em>}</span>
                <span className="dv-actions">
                  <button type="button" onClick={() => copy(trackerLink(d.deviceKey))}><Copy size={12} /> Link</button>
                  {canEdit && <button type="button" onClick={() => act(() => api.put(`${base}/devices/${d.id}`, { active: !d.active }))}>{d.active ? 'Disable' : 'Enable'}</button>}
                  {canEdit && <button type="button" onClick={() => window.confirm('Create a new link? The old one stops working.') && act(async () => { const r = await api.put(`${base}/devices/${d.id}`, { regenerateKey: true }); setNewKey({ name: r.data.device.name, key: r.data.device.deviceKey }); })}>New key</button>}
                  {canEdit && <button type="button" className="danger" onClick={() => window.confirm(`Delete ${d.name} and its history?`) && act(() => api.delete(`${base}/devices/${d.id}`))}><Trash2 size={12} /></button>}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ================= LOCATIONS ================= */}
      {tab === 'locations' && (
        <>
          <form className="dv-form dv-office" onSubmit={saveOffice}>
            <div className="full dv-office-head">
              <b><MapPin size={14} /> Office (fixed location)</b>
              <small>{office ? 'Devices entering this area are marked in; leaving marks them out.' : 'Not set yet — enter the office coordinates, or set OFFICE_LAT / OFFICE_LNG in backend/.env.'}</small>
            </div>
            <label>Latitude<input required type="number" step="any" disabled={!canEdit} value={officeForm.lat} onChange={(e) => setOfficeForm({ ...officeForm, lat: e.target.value })} /></label>
            <label>Longitude<input required type="number" step="any" disabled={!canEdit} value={officeForm.lng} onChange={(e) => setOfficeForm({ ...officeForm, lng: e.target.value })} /></label>
            <label>Radius (m)<input required type="number" min="10" max="50000" disabled={!canEdit} value={officeForm.radius} onChange={(e) => setOfficeForm({ ...officeForm, radius: e.target.value })} /></label>
            {canEdit && <button type="button" className="btn-ghost" onClick={() => useMyPosition('office')}><Crosshair size={15} /> Use my position</button>}
            {canEdit && <button type="submit" className="btn-primary">{office ? 'Save office location' : 'Set office location'}</button>}
            {canEdit && <button type="button" className="btn-ghost" onClick={() => setTab('devices')}><Plus size={15} /> Add device</button>}
          </form>
          {canEdit && (
            <form className="dv-form" onSubmit={addLocation}>
              <label>Location name<input required value={locForm.name} onChange={(e) => setLocForm({ ...locForm, name: e.target.value })} placeholder="e.g. Head office" maxLength={80} /></label>
              <label>Latitude<input required type="number" step="any" value={locForm.lat} onChange={(e) => setLocForm({ ...locForm, lat: e.target.value })} placeholder="19.0760" /></label>
              <label>Longitude<input required type="number" step="any" value={locForm.lng} onChange={(e) => setLocForm({ ...locForm, lng: e.target.value })} placeholder="72.8777" /></label>
              <label>Radius (m)<input required type="number" min="10" max="50000" value={locForm.radius} onChange={(e) => setLocForm({ ...locForm, radius: e.target.value })} /></label>
              <button type="button" className="btn-ghost" onClick={() => useMyPosition('loc')}><Crosshair size={15} /> Use my position</button>
              <button type="submit" className="btn-primary"><Plus size={15} /> Add location</button>
            </form>
          )}
          <div className="dv-table dv-locs" role="table">
            <div className="dv-tr dv-th" role="row"><span>Location</span><span>Radius</span><span>Coordinates</span><span>Code</span><span /></div>
            {locations.length === 0 ? <div className="dv-empty">No locations yet. Add your office to get started.</div> : locations.map((l) => (
              <div key={l.id} className="dv-tr" role="row">
                <span><b>{l.name}</b>{l.isOffice && <small>Fixed office location</small>}{!l.active && <small>Disabled</small>}</span>
                <span>{l.radius} m</span>
                <span>{l.lat.toFixed(5)}, {l.lng.toFixed(5)}</span>
                <span><code>{l.code}</code></span>
                <span className="dv-actions">
                  {canEdit && <button type="button" onClick={() => act(() => api.put(`${base}/locations/${l.id}`, { active: !l.active }))}>{l.active ? 'Disable' : 'Enable'}</button>}
                  {canEdit && !l.isOffice && <button type="button" className="danger" onClick={() => window.confirm(`Delete ${l.name} and its history?`) && act(() => api.delete(`${base}/locations/${l.id}`))}><Trash2 size={12} /></button>}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default AdminDevices;
