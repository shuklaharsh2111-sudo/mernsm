import { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, Video, CalendarDays } from 'lucide-react';
import api from '../api';
import { errMsg } from '../sopUtils';
import '../styles/settings.css';

const SOURCE_TEXT = {
  own: 'Connected with your own account',
  default: 'Using the shared test account',
  none: 'Not connected',
};

// Each person connects their own Grain + Google Calendar, so their meetings are recorded by their own Grain.
// base = '/sme' or '/admin' (which API router to talk to).
export default function IntegrationsCard({ base }) {
  const [st, setSt] = useState(null);
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState({ type: '', text: '' });

  const load = () =>
    api.get(`${base}/integrations`).then((r) => setSt(r.data)).catch((e) => setMsg({ type: 'error', text: errMsg(e) }));

  useEffect(() => {
    load();
    const flag = new URLSearchParams(window.location.search).get('google');
    if (flag === 'connected') setMsg({ type: 'ok', text: 'Google Calendar connected.' });
    if (flag === 'failed') setMsg({ type: 'error', text: 'Could not connect Google Calendar. Please try again.' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = async (name, fn, okText) => {
    setBusy(name);
    setMsg({ type: '', text: '' });
    try {
      const res = await fn();
      if (res?.data?.grain) setSt(res.data);
      if (okText) setMsg({ type: 'ok', text: okText });
    } catch (e) {
      setMsg({ type: 'error', text: errMsg(e) });
    } finally {
      setBusy('');
    }
  };

  const saveGrain = (e) => {
    e.preventDefault();
    run('grain', () => api.put(`${base}/integrations/grain`, { token: token.trim() }), 'Grain account connected.').then(() => setToken(''));
  };
  const connectGoogle = () =>
    run('google', async () => {
      const r = await api.get(`${base}/integrations/google/start`);
      window.location.href = r.data.url;
    });

  const Row = ({ icon, title, info, children }) => (
    <div className="st-field">
      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{icon} {title}</label>
      <p className="muted" style={{ margin: '2px 0 8px', fontSize: 13 }}>
        {info.connected ? <CheckCircle2 size={13} style={{ verticalAlign: '-2px', color: '#79dcba' }} /> : <AlertCircle size={13} style={{ verticalAlign: '-2px' }} />}{' '}
        {SOURCE_TEXT[info.source]}{info.name ? ` (${info.name})` : ''}
        {info.source === 'default' && st.sharedAccountEmail ? ` — ${st.sharedAccountEmail}` : ''}
      </p>
      {children}
    </div>
  );

  return (
    <div className="st-card">
      <h2>Grain &amp; Calendar</h2>
      <p className="muted" style={{ fontSize: 13, marginTop: -4 }}>
        Your meetings are recorded by <b>your</b> Grain account and scheduled on <b>your</b> Google Calendar. Until you connect them, the shared test account is used.
      </p>

      {!st ? (
        <p className="muted">Loading…</p>
      ) : (
        <>
          <Row icon={<Video size={15} />} title="Grain" info={st.grain}>
            <form onSubmit={saveGrain} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input
                type="password"
                autoComplete="off"
                value={token}
                placeholder="Paste your Grain access token"
                onChange={(e) => setToken(e.target.value)}
                style={{ flex: '1 1 220px' }}
              />
              <button type="submit" className="st-btn" disabled={busy === 'grain' || token.trim().length < 10}>
                {busy === 'grain' ? 'Checking…' : 'Connect'}
              </button>
              {st.grain.source === 'own' && (
                <button type="button" className="st-btn danger" onClick={() => run('grain', () => api.delete(`${base}/integrations/grain`), 'Grain disconnected.')}>
                  Disconnect
                </button>
              )}
            </form>
            <small className="muted">Create one in Grain → Settings → Integrations → API. It is stored encrypted and never shown again.</small>
          </Row>

          <Row icon={<CalendarDays size={15} />} title="Google Calendar" info={st.google}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="st-btn" onClick={connectGoogle} disabled={busy === 'google' || !st.googleReady}>
                {st.google.source === 'own' ? 'Reconnect Google' : 'Connect Google'}
              </button>
              {st.google.source === 'own' && (
                <button type="button" className="st-btn danger" onClick={() => run('google', () => api.delete(`${base}/integrations/google`), 'Google disconnected.')}>
                  Disconnect
                </button>
              )}
            </div>
            <small className="muted">
              {st.googleReady ? 'Use the same Google account your Grain is connected to.' : 'Google is not set up on the server yet.'}
            </small>
          </Row>
        </>
      )}

      {msg.text && (
        <p className={msg.type === 'ok' ? 'success-message' : 'error-message'} role="status">{msg.text}</p>
      )}
    </div>
  );
}
