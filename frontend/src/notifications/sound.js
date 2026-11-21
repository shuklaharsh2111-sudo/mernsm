// Notification sounds are generated with the Web Audio API, so no audio files are needed.
// Browsers keep audio LOCKED until the person has clicked or pressed a key on the page once.
// After a page refresh it is locked again until the next click.
let ctx = null;
let master = null;
// a notification that arrived while the browser was blocking sound: it rings on the very next click / key press
let pending = null;
// Sound is ON by default. (v2 key: an old saved "muted" value from earlier versions is ignored.)
const KEY = 'notifSoundMuted_v2';
const listeners = new Set();

let muted = (() => {
  try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
})();

const ENABLED_KEY = 'notifSoundEnabled';
// true once the person has unlocked sound in this browser (browsers still re-lock audio after a refresh,
// but the very next click or key press unlocks it again by itself, so no prompt is needed).
export const wasEnabled = () => {
  try { return localStorage.getItem(ENABLED_KEY) === '1'; } catch { return false; }
};
export const isMuted = () => muted;
export const setMuted = (value) => {
  muted = Boolean(value);
  try { localStorage.setItem(KEY, muted ? '1' : '0'); } catch { /* storage unavailable */ }
};

// 'running' = sound will play, anything else = the browser is still blocking it
export const audioState = () => (ctx ? ctx.state : 'locked');
export const subscribeAudio = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const emit = () => listeners.forEach((fn) => fn(audioState()));

const getCtx = () => {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    ctx.onstatechange = emit;
    // Every note goes through one chain: low-pass (removes harshness) -> compressor (keeps it loud without
    // distortion) with a soft echo tail, so the ding sounds smooth, round and clearly audible.
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 4500;
    lp.Q.value = 0.3;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -20;
    comp.knee.value = 24;
    comp.ratio.value = 3;
    comp.attack.value = 0.01;
    comp.release.value = 0.3;
    const echo = ctx.createDelay(1);
    echo.delayTime.value = 0.16;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.25;
    const wet = ctx.createGain();
    wet.gain.value = 0.15;
    master = ctx.createGain();
    master.gain.value = 1.6;
    master.connect(lp);
    lp.connect(comp);
    lp.connect(echo);
    echo.connect(feedback);
    feedback.connect(echo);
    echo.connect(wet);
    wet.connect(comp);
    comp.connect(ctx.destination);
  }
  return ctx;
};

// Called from a real click / key press: this is what lets the browser play sound later without a click.
let asked = false;
const unlock = () => {
  if (!asked) { asked = true; askSystemNotifications(); }
  const c = getCtx();
  if (!c) return;
  const done = () => {
    // a one-sample silent buffer fully unlocks Safari / iOS
    try {
      const src = c.createBufferSource();
      src.buffer = c.createBuffer(1, 1, 22050);
      src.connect(c.destination);
      src.start(0);
    } catch { /* ignore */ }
    if (c.state === 'running') { try { localStorage.setItem(ENABLED_KEY, '1'); } catch { /* ignore */ } }
    emit();
    if (c.state === 'running' && pending) {
      const t = pending;
      pending = null;
      play((cc, tt) => ding(cc, tt, t));
    }
    if (c.state === 'running') EVENTS.forEach((e) => window.removeEventListener(e, unlock, true));
  };
  if (c.state === 'running') done();
  else c.resume().then(done).catch(() => { });
};
// The button that switches sound on (needs a real click). Plays a ding so the person hears it works.
export const enableSound = () => {
  unlock();
  askSystemNotifications();
  playTest();
};
const EVENTS = ['pointerdown', 'mousedown', 'touchend', 'click', 'keydown'];
if (typeof window !== 'undefined') {
  EVENTS.forEach((e) => window.addEventListener(e, unlock, true));
  try { const c0 = getCtx(); if (c0 && c0.state !== 'running') c0.resume().catch(() => { }); } catch { /* ignore */ }
  // Safari/iOS and some browsers suspend audio when the tab is hidden; wake it up again on return.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && ctx && ctx.state !== 'running') ctx.resume().catch(() => { });
  });
}


// ---- Backup sound: a plain <audio> element playing a generated WAV file.
// Used whenever the Web Audio context is still locked/suspended, so a new notification is never silent.
// [frequency Hz, start s, length s, volume, triangle?]  info/success rise, danger/warning fall
const TONES = {
  info: [[784, 0, 0.4, 0.85], [1175, 0.12, 0.85, 0.9]],
  success: [[784, 0, 0.35, 0.85], [988, 0.1, 0.35, 0.85], [1319, 0.2, 0.9, 0.9]],
  danger: [[659, 0, 0.5, 0.9], [523, 0.16, 0.9, 0.95]]
};
const wavCache = {};
const makeWav = (notes) => {
  const rate = 22050;
  const tail = 1.1; // room for the echo
  const total = Math.ceil(rate * (Math.max(...notes.map((n) => n[1] + n[2])) + tail));
  const mix = new Float32Array(total);
  const parts = [[1, 1], [2, 0.12]];
  const sum = parts.reduce((a, [, amp]) => a + amp, 0);
  notes.forEach(([freq, start, len, vol, tri]) => {
    const from = Math.floor(start * rate);
    const count = Math.floor(len * 1.75 * rate);
    const tau = len / 4;
    for (let i = 0; i < count && from + i < total; i += 1) {
      const t = i / rate;
      const env = Math.min(1, t / 0.025) * Math.exp(-t / tau);
      let v = 0;
      parts.forEach(([mult, amp]) => {
        const phase = 2 * Math.PI * freq * mult * (t - 0.015 * 0.02 * (1 - Math.exp(-t / 0.02)));
        v += (tri ? (2 / Math.PI) * Math.asin(Math.sin(phase)) : Math.sin(phase)) * amp;
      });
      mix[from + i] += (v / sum) * env * vol;
    }
  });
  // soft echo tail
  const d = Math.floor(0.16 * rate);
  for (let i = d; i < total; i += 1) mix[i] += 0.25 * mix[i - d];
  // soften it: one-pole low-pass (about 4.5 kHz) takes the sharp edge off
  const a = 1 - Math.exp((-2 * Math.PI * 4500) / rate);
  for (let i = 1; i < total; i += 1) mix[i] = mix[i - 1] + a * (mix[i] - mix[i - 1]);
  // normalise to a loud level (about 90% of full scale)
  let peak = 0;
  for (let i = 0; i < total; i += 1) peak = Math.max(peak, Math.abs(mix[i]));
  const k = peak ? (0.9 * 32767) / peak : 0;
  const pcm = new Int16Array(total);
  for (let i = 0; i < total; i += 1) pcm[i] = Math.round(mix[i] * k);
  const bytes = new Uint8Array(44 + pcm.length * 2);
  const dv = new DataView(bytes.buffer);
  const str = (o, v) => [...v].forEach((ch, i) => dv.setUint8(o + i, ch.charCodeAt(0)));
  str(0, 'RIFF'); dv.setUint32(4, 36 + pcm.length * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, rate, true); dv.setUint32(28, rate * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
  str(36, 'data'); dv.setUint32(40, pcm.length * 2, true);
  pcm.forEach((v, i) => dv.setInt16(44 + i * 2, v, true));
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:audio/wav;base64,${btoa(bin)}`;
};
const playFallback = (tone, onBlocked) => {
  try {
    const key = tone === 'warning' ? 'danger' : (TONES[tone] ? tone : 'info');
    if (!wavCache[key]) wavCache[key] = makeWav(TONES[key]);
    const a = new Audio(wavCache[key]);
    a.volume = 1;
    a.play().catch(() => { if (onBlocked) onBlocked(); });
  } catch { if (onBlocked) onBlocked(); }
};

// ---- System notification: the operating system plays its own notification sound, even with the tab in the background.
export const askSystemNotifications = () => {
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') Notification.requestPermission();
  } catch { /* not supported */ }
};
export const showSystemNotification = (n) => {
  try {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const sys = new Notification(n.title || 'New notification', { body: n.message || '', tag: n.id, silent: false });
    sys.onclick = () => { window.focus(); sys.close(); };
  } catch { /* not supported */ }
};

// One smooth, bell-like note: soft 25 ms attack, long natural decay (no abrupt cut), a little 2nd harmonic.
const PARTIALS = [[1, 1], [2, 0.07]];
const note = (c, freq, start, length, volume, type = 'sine') => {
  const rich = type === 'sine' || type === 'triangle';
  const parts = rich ? PARTIALS : [[1, 1]];
  const total = parts.reduce((sum, [, amp]) => sum + amp, 0);
  const tau = length / 4; // decay time constant: it has faded out by `length`
  const gain = c.createGain();
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + 0.025);
  gain.gain.setTargetAtTime(0, start + 0.025, tau);
  gain.connect(master || c.destination);
  const end = start + 0.025 + tau * 7;
  parts.forEach(([mult, amp]) => {
    const osc = c.createOscillator();
    const part = c.createGain();
    osc.type = type;
    if (rich) {
      osc.frequency.setValueAtTime(freq * mult * 0.985, start);
      osc.frequency.exponentialRampToValueAtTime(freq * mult, start + 0.05);
    } else {
      osc.frequency.value = freq * mult;
    }
    part.gain.value = amp / total;
    osc.connect(part).connect(gain);
    osc.start(start);
    osc.stop(end);
  });
};

// Waits until the browser has actually unlocked audio, THEN schedules the notes (scheduling on a
// suspended context would put them in the past and they would never be heard).
const play = (fn, force = false) => {
  if (muted && !force) return;
  try {
    const c = getCtx();
    if (!c) return;
    const go = () => fn(c, c.currentTime + 0.03);
    if (c.state === 'running') go();
    else c.resume().then(() => { if (c.state === 'running') go(); }).catch(() => { });
  } catch { /* sound is optional */ }
};

const ding = (c, t, tone) => {
  (TONES[tone === 'warning' ? 'danger' : tone] || TONES.info).forEach(([freq, at, len, vol, tri]) => {
    note(c, freq, t + at, len, vol, 'sine');
  });
};

// Someone else did something for you: a two-note "ding". Warnings and rejections get a lower, falling tone.
export const playNotification = (tone = 'info') => {
  if (muted) return;
  if (ctx && ctx.state === 'running') play((c, t) => ding(c, t, tone));
  else playFallback(tone, () => { pending = tone; });
};

// The "Test sound" button in the bell panel: plays even when sound is switched off, so it can be checked.
export const playTest = () => {
  if (ctx && ctx.state === 'running') play((c, t) => ding(c, t, 'info'), true);
  else {
    // locked context: ask the browser to wake it (this runs inside the click), and play the backup sound right away
    try { const c = getCtx(); if (c) c.resume().catch(() => { }); } catch { /* ignore */ }
    playFallback('info');
  }
};

// You did something and it worked: a short, clear tick.
let lastTick = 0;
export const playAction = () => {
  const now = Date.now();
  if (now - lastTick < 350) return;
  lastTick = now;
  play((c, t) => {
    note(c, 740, t, 0.13, 0.3);
    note(c, 988, t + 0.07, 0.15, 0.25);
  });
};

// You did something and it failed.
export const playError = () => play((c, t) => {
  note(c, 220, t, 0.2, 0.3, 'sawtooth');
  note(c, 165, t + 0.12, 0.3, 0.3, 'sawtooth');
});
