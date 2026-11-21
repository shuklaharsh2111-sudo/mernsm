// Notification sounds are generated with the Web Audio API, so no audio files are needed.
// Browsers keep audio LOCKED until the person has clicked or pressed a key on the page once.
// After a page refresh it is locked again until the next click.
let ctx = null;
let master = null;
// a notification that arrived while the browser was blocking sound: it rings on the very next click / key press
let pending = null;
const KEY = 'notifSoundMuted';
const listeners = new Set();

let muted = (() => {
  try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
})();

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
    // every note goes through one compressor + gain so the ding is clearly audible
    const comp = ctx.createDynamicsCompressor();
    master = ctx.createGain();
    master.gain.value = 1.6;
    master.connect(comp);
    comp.connect(ctx.destination);
  }
  return ctx;
};

// Called from a real click / key press: this is what lets the browser play sound later without a click.
const unlock = () => {
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
  // Safari/iOS and some browsers suspend audio when the tab is hidden; wake it up again on return.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && ctx && ctx.state !== 'running') ctx.resume().catch(() => { });
  });
}


// ---- Backup sound: a plain <audio> element playing a generated WAV file.
// Used whenever the Web Audio context is still locked/suspended, so a new notification is never silent.
const TONES = {
  info: [[880, 0, 0.25, 0.6], [1319, 0.15, 0.55, 0.55]],
  success: [[784, 0, 0.22, 0.55], [1047, 0.12, 0.24, 0.55], [1568, 0.24, 0.5, 0.5]],
  danger: [[622, 0, 0.3, 0.6, 1], [466, 0.17, 0.5, 0.6, 1]]
};
const wavCache = {};
const makeWav = (notes) => {
  const rate = 22050;
  const total = Math.ceil(rate * (Math.max(...notes.map((n) => n[1] + n[2])) + 0.1));
  const pcm = new Int16Array(total);
  notes.forEach(([freq, start, len, vol, tri]) => {
    const from = Math.floor(start * rate);
    const count = Math.floor(len * rate);
    for (let i = 0; i < count && from + i < total; i += 1) {
      const t = i / rate;
      const env = Math.min(1, t / 0.015) * Math.exp(-4.5 * (t / len));
      const phase = 2 * Math.PI * freq * t;
      const wave = tri ? (2 / Math.PI) * Math.asin(Math.sin(phase)) : Math.sin(phase);
      pcm[from + i] = Math.max(-32767, Math.min(32767, pcm[from + i] + wave * env * vol * 22000));
    }
  });
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

// One soft note with a quick fade in and out.
const note = (c, freq, start, length, volume, type = 'sine') => {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
  osc.connect(gain).connect(master || c.destination);
  osc.start(start);
  osc.stop(start + length + 0.05);
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
  if (tone === 'danger' || tone === 'warning') {
    note(c, 622, t, 0.3, 0.6, 'triangle');
    note(c, 466, t + 0.17, 0.5, 0.6, 'triangle');
  } else if (tone === 'success') {
    note(c, 784, t, 0.22, 0.55);
    note(c, 1047, t + 0.12, 0.24, 0.55);
    note(c, 1568, t + 0.24, 0.5, 0.5);
  } else {
    note(c, 880, t, 0.25, 0.6);
    note(c, 1319, t + 0.15, 0.55, 0.55);
  }
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
