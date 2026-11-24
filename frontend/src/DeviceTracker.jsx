import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import './styles/devices.css';

const SEND_EVERY_MS = 30000;

// Opened on the registered device (no login). Sends its position so the server can
// record the in-time when it enters a location and the out-time when it leaves.
const DeviceTracker = () => {
  const [params] = useSearchParams();
  const key = params.get('key') || '';
  const [name, setName] = useState('');
  const [state, setState] = useState({ status: 'idle', inside: false, location: null, at: null, error: '' });
  const lastSent = useRef(0);
  const watchId = useRef(null);

  useEffect(() => {
    if (!key) return;
    axios.get('/api/device/whoami', { params: { key } }).then((r) => setName(r.data.name)).catch(() => setState((s) => ({ ...s, error: 'This link is not valid. Ask the admin for a new one.' })));
  }, [key]);

  const send = async (coords) => {
    try {
      const res = await axios.post('/api/device/ping', { key, latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy });
      setState({ status: 'running', inside: res.data.inside, location: res.data.location, at: new Date(), error: '' });
    } catch (e) {
      setState((s) => ({ ...s, status: 'running', error: e?.response?.data?.message || 'Could not reach the server.' }));
    }
  };

  const start = () => {
    if (!navigator.geolocation) return setState((s) => ({ ...s, error: 'This browser cannot read location.' }));
    setState((s) => ({ ...s, status: 'starting', error: '' }));
    watchId.current = navigator.geolocation.watchPosition(
      (p) => {
        const now = Date.now();
        if (now - lastSent.current < SEND_EVERY_MS) return;
        lastSent.current = now;
        send(p.coords);
      },
      (err) => setState((s) => ({ ...s, status: 'idle', error: err.code === 1 ? 'Location permission was denied. Allow it and try again.' : 'Could not get your location.' })),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 30000 }
    );
  };

  const stop = () => {
    if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
    lastSent.current = 0;
    setState({ status: 'idle', inside: false, location: null, at: null, error: '' });
  };

  useEffect(() => () => { if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current); }, []);

  if (!key) return <div className="trk"><div className="trk-card"><h1>Device tracker</h1><p className="trk-err">No device key in this link.</p></div></div>;

  const running = state.status === 'running' || state.status === 'starting';
  return (
    <div className="trk">
      <div className="trk-card">
        <h1>{name || 'Device tracker'}</h1>
        <p>Keep this page open so your in and out times are recorded.</p>
        {running && (
          <div className={`trk-state ${state.inside ? 'in' : ''}`}>
            <strong><span className="trk-dot" />{state.status === 'starting' ? 'Getting location…' : state.inside ? `Inside ${state.location}` : 'Outside all locations'}</strong>
            {state.at && <p>Last update {state.at.toLocaleTimeString('en-IN')}</p>}
          </div>
        )}
        {state.error && <p className="trk-err" role="alert">{state.error}</p>}
        {!running
          ? <button type="button" className="btn-primary" onClick={start} disabled={!name}>Start tracking</button>
          : <button type="button" className="btn-ghost" onClick={stop}>Stop</button>}
      </div>
    </div>
  );
};

export default DeviceTracker;
