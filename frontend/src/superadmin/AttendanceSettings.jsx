import { useEffect, useState } from 'react';
import { MapPin, Clock, LocateFixed, Save, ExternalLink, ShieldCheck } from 'lucide-react';
import api from '../api';
import { errMsg } from '../sopUtils';
import '../style.css';
import '../styles/dashboard-glass.css';
import './superadmin.css';

const fmtWhen = (d) => {
  const date = d ? new Date(d) : null;
  return date && !Number.isNaN(date.getTime())
    ? date.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
    : '';
};

// Super admin only: office location, allowed radius and late time (used to be OFFICE_* / HR_LATE_AFTER in .env).
const AttendanceSettings = () => {
  const [form, setForm] = useState(null);
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);

  const apply = (s) => {
    setMeta(s);
    setForm({
      lat: s.lat ?? '',
      lng: s.lng ?? '',
      radius: s.radius ?? 200,
      lateAfter: s.lateAfter || '10:30',
      enforceStaff: !!s.enforceStaff,
      enforceAdmin: !!s.enforceAdmin,
    });
  };

  useEffect(() => {
    let cancelled = false;
    api.get('/superadmin/attendance-settings')
      .then((r) => !cancelled && apply(r.data.settings))
      .catch((e) => !cancelled && setError(errMsg(e)));
    return () => { cancelled = true; };
  }, []);

  const set = (key, value) => { setForm((f) => ({ ...f, [key]: value })); setNotice(''); };

  const useMyLocation = () => {
    if (!navigator.geolocation) { setError('This browser cannot share its location.'); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f) => ({ ...f, lat: pos.coords.latitude.toFixed(6), lng: pos.coords.longitude.toFixed(6) }));
        setError(''); setNotice(''); setLocating(false);
      },
      () => { setError('Could not read your location. Allow location access, or type the coordinates.'); setLocating(false); },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true); setError(''); setNotice('');
    try {
      const r = await api.put('/superadmin/attendance-settings', form);
      apply(r.data.settings);
      setNotice('Saved. The new rules apply to the next login.');
    } catch (err) { setError(errMsg(err)); } finally { setSaving(false); }
  };

  const hasPoint = form && form.lat !== '' && form.lng !== '' && Number.isFinite(Number(form.lat)) && Number.isFinite(Number(form.lng));
  const mapUrl = hasPoint ? `https://www.google.com/maps?q=${Number(form.lat)},${Number(form.lng)}` : '';

  return (
    <div className="dashboard-content scrollable dash-glass">
      <div className="page-header">
        <div>
          <span className="page-label">SUPER ADMIN</span>
          <h1>Office &amp; Attendance Settings</h1>
          <p>Where the office is, how close people must be to log in, and when a first login counts as late.</p>
        </div>
      </div>

      {error && <p className="error-message" role="alert">{error}</p>}
      {notice && <p className="success-message" role="status" onClick={() => setNotice('')}>{notice}</p>}
      {!form && !error && <p className="muted">Loading…</p>}

      {form && (
        <form onSubmit={save} className="as-grid">
          <section className="glass-panel">
            <h2><MapPin size={16} /> Office location</h2>
            <div className="as-fields">
              <label>Latitude
                <input type="number" step="any" value={form.lat} onChange={(e) => set('lat', e.target.value)} placeholder="e.g. 19.076090" required />
              </label>
              <label>Longitude
                <input type="number" step="any" value={form.lng} onChange={(e) => set('lng', e.target.value)} placeholder="e.g. 72.877426" required />
              </label>
              <label>Allowed radius (metres)
                <input type="number" min="10" max="50000" value={form.radius} onChange={(e) => set('radius', e.target.value)} required />
              </label>
            </div>
            <div className="as-actions">
              <button type="button" className="dash-btn" onClick={useMyLocation} disabled={locating}>
                <LocateFixed size={15} /> {locating ? 'Locating…' : 'Use my current location'}
              </button>
              {mapUrl && <a className="dash-btn" href={mapUrl} target="_blank" rel="noreferrer"><ExternalLink size={15} /> Check on map</a>}
            </div>
            <p className="as-hint">
              {meta && !meta.savedInApp.location && meta.configured
                ? 'Currently read from the .env file. Saving here replaces it.'
                : 'Stand in the office and use your current location for the most accurate point.'}
            </p>
          </section>

          <section className="glass-panel">
            <h2><Clock size={16} /> Late time</h2>
            <div className="as-fields">
              <label>Late after (24-hour)
                <input type="time" value={form.lateAfter} onChange={(e) => set('lateAfter', e.target.value)} required />
              </label>
            </div>
            <p className="as-hint">The first login of the day after this time is marked late on the HR attendance pages.</p>
          </section>

          <section className="glass-panel">
            <h2><ShieldCheck size={16} /> Login rule</h2>
            <label className="as-check">
              <input type="checkbox" checked={form.enforceStaff} onChange={(e) => set('enforceStaff', e.target.checked)} />
              <span><strong>Staff must be at the office to log in</strong><small>SME, SMI, designers, HR and reporting managers.</small></span>
            </label>
            <label className="as-check">
              <input type="checkbox" checked={form.enforceAdmin} onChange={(e) => set('enforceAdmin', e.target.checked)} />
              <span><strong>Admins and operation managers too</strong><small>Off means they can log in from anywhere.</small></span>
            </label>
          </section>

          <div className="as-save">
            <button type="submit" className="btn-primary" disabled={saving}><Save size={15} /> {saving ? 'Saving…' : 'Save settings'}</button>
            {meta?.updatedAt && <small>Last changed {fmtWhen(meta.updatedAt)}{meta.updatedBy ? ` by ${meta.updatedBy}` : ''}</small>}
          </div>
        </form>
      )}
    </div>
  );
};

export default AttendanceSettings;
