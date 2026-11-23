import notiUrl from '../assets/noti.mp3';

// Notification sound: the default is noti.mp3 (src/assets/noti.mp3). In Settings a person can pick another built-in tone or upload their own file
// (saved in this browser). Only notifications play this sound; nothing else in the app makes a sound.
// Browsers keep audio LOCKED until the person has clicked or pressed a key on the page once.
// After a page refresh it is locked again until the next click.
let ctx = null;
let master = null;
// a notification that arrived while the browser was blocking sound: it rings on the very next click / key press
let pending = false;
// Sound is ON by default. (v2 key: an old saved "muted" value from earlier versions is ignored.)
const KEY = 'notifSoundMuted_v2';
const listeners = new Set();

// Every panel (role) keeps its own sound settings: on/off, which sound, the uploaded file and the volume.
let owner = 'guest';
const keyFor = (base) => `${base}_${owner}`;

export const setSoundOwner = (role) => {
  owner = String(role || 'guest').trim().toLowerCase();
  muted = loadMuted();
};
const loadMuted = () => {
  try { return localStorage.getItem(keyFor(KEY)) === '1'; } catch { return false; }
};
let muted = false;

const ENABLED_KEY = 'notifSoundEnabled';
// true once the person has unlocked sound in this browser (browsers still re-lock audio after a refresh,
// but the very next click or key press unlocks it again by itself, so no prompt is needed).
export const wasEnabled = () => {
  try { return localStorage.getItem(ENABLED_KEY) === '1'; } catch { return false; }
};
export const isMuted = () => muted;
export const setMuted = (value) => {
  muted = Boolean(value);
  try { localStorage.setItem(keyFor(KEY), muted ? '1' : '0'); } catch { /* storage unavailable */ }
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
  primeFile();
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
    if (pending && (usesFile() || c.state === 'running')) {
      pending = false;
      ring(() => { pending = true; });
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


// ---- Notification sound preferences (saved in this browser)
const SOUND_KEY = 'notifSoundChoice';
const CUSTOM_KEY = 'notifSoundCustom'; // JSON { name, data } where data is a data: URL
const VOLUME_KEY = 'notifSoundVolume';
export const MAX_SOUND_BYTES = 1024 * 1024;
export const SOUND_PRESETS = [
  { id: 'default', name: 'Default', hint: 'The standard notification sound' },
  { id: 'classic', name: 'Classic ding', hint: 'Two rising notes' },
  { id: 'soft', name: 'Soft bell', hint: 'One gentle note' },
  { id: 'alert', name: 'Alert', hint: 'Two falling notes' }
];
const readKey = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const writeKey = (k, v) => { try { localStorage.setItem(k, v); return true; } catch { return false; } };

let file = null; // the <audio> element used for the default / custom file
let custom = (() => {
  try { const j = JSON.parse(readKey(CUSTOM_KEY)); return j && j.data ? j : null; } catch { return null; }
})();

export const getCustomSound = () => (custom ? { name: custom.name } : null);
export const getSoundChoice = () => {
  const c = readKey(SOUND_KEY);
  if (c === 'custom') return custom ? 'custom' : 'default';
  return SOUND_PRESETS.some((p) => p.id === c) ? c : 'default';
};
export const setSoundChoice = (id) => { writeKey(SOUND_KEY, id); file = null; };
export const getVolume = () => {
  const v = parseFloat(readKey(VOLUME_KEY));
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 1;
};
export const setVolume = (v) => {
  const x = Math.min(1, Math.max(0, v));
  writeKey(VOLUME_KEY, String(x));
  if (file) file.volume = x;
};
// Saves an uploaded audio file as the custom sound and selects it. Rejects with a readable message.
export const saveCustomSound = (f) => new Promise((resolve, reject) => {
  if (!f || !/^audio\//.test(f.type)) { reject(new Error('Please choose an audio file (MP3, WAV, OGG or M4A).')); return; }
  if (f.size > MAX_SOUND_BYTES) { reject(new Error('The sound must be 1 MB or smaller.')); return; }
  const reader = new FileReader();
  reader.onerror = () => reject(new Error('Could not read that file.'));
  reader.onload = () => {
    const next = { name: f.name.slice(0, 60), data: String(reader.result) };
    if (!writeKey(CUSTOM_KEY, JSON.stringify(next))) { reject(new Error('This browser has no room left to save the sound.')); return; }
    custom = next;
    setSoundChoice('custom');
    resolve(getCustomSound());
  };
  reader.readAsDataURL(f);
});
export const removeCustomSound = () => {
  try { localStorage.removeItem(CUSTOM_KEY); } catch { /* ignore */ }
  custom = null;
  if (readKey(SOUND_KEY) === 'custom') setSoundChoice('default');
  file = null;
};

// ---- Playing it
const usesFile = () => { const c = getSoundChoice(); return c === 'default' || c === 'custom'; };
const makeAudio = (id) => {
  const a = new Audio(id === 'custom' && custom ? custom.data : notiUrl);
  a.preload = 'auto';
  a.volume = getVolume();
  return a;
};
const getFile = () => {
  if (!file && typeof Audio !== 'undefined') file = makeAudio(getSoundChoice() === 'custom' ? 'custom' : 'default');
  return file;
};
// Inside a real click: play it silently once so the browser allows the file to play later without a click.
const primeFile = () => {
  try {
    const a = getFile();
    if (!a || !a.paused) return;
    a.muted = true;
    a.play().then(() => { a.pause(); a.currentTime = 0; a.muted = false; }).catch(() => { a.muted = false; });
  } catch { /* ignore */ }
};
const ringFile = (onBlocked) => {
  try {
    const a = getFile();
    if (!a) return;
    a.muted = false;
    a.volume = getVolume();
    a.currentTime = 0;
    a.play().catch(() => { if (onBlocked) onBlocked(); });
  } catch { if (onBlocked) onBlocked(); }
};
// Plays whichever sound is chosen. onBlocked runs when the browser is still blocking sound.
const ring = (onBlocked) => {
  if (usesFile()) { ringFile(onBlocked); return; }
  if (ctx && ctx.state === 'running') { play((c, t) => generated(c, t, getSoundChoice()), true); return; }
  try { const c = getCtx(); if (c) c.resume().catch(() => { }); } catch { /* ignore */ }
  if (onBlocked) onBlocked();
};
let previewing = null;
// Settings page: hear any sound without selecting it (works even when sound is switched off).
export const previewSound = (id) => {
  try { if (previewing) { previewing.pause(); previewing = null; } } catch { /* ignore */ }
  if (id === 'default' || id === 'custom') {
    try {
      previewing = makeAudio(id);
      previewing.play().catch(() => { });
    } catch { /* ignore */ }
    return;
  }
  const c = getCtx();
  if (c) c.resume().catch(() => { });
  play((cc, t) => generated(cc, t, id), true);
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

// Built-in tones: [frequency Hz, start s, length s, volume]
const GEN = {
  classic: [[784, 0, 0.4, 0.85], [1175, 0.12, 0.85, 0.9]],
  soft: [[587, 0, 1.2, 0.8]],
  alert: [[659, 0, 0.5, 0.9], [523, 0.16, 0.9, 0.95]]
};
const generated = (c, t, id) => {
  (GEN[id] || GEN.classic).forEach(([freq, at, len, vol]) => note(c, freq, t + at, len, vol, 'sine'));
};

// Waits until the browser has actually unlocked audio, THEN schedules the notes (scheduling on a
// suspended context would put them in the past and they would never be heard).
const play = (fn, force = false) => {
  if (muted && !force) return;
  try {
    const c = getCtx();
    if (!c) return;
    const go = () => { if (master) master.gain.value = 1.6 * getVolume(); fn(c, c.currentTime + 0.03); };
    if (c.state === 'running') go();
    else c.resume().then(() => { if (c.state === 'running') go(); }).catch(() => { });
  } catch { /* sound is optional */ }
};

// Someone else did something for you: plays the chosen notification sound. If the browser is still blocking sound, it rings on the next click / key press.
export const playNotification = () => {
  if (muted) return;
  ring(() => { pending = true; });
};

// The "Test sound" button in the bell panel: plays even when sound is switched off, so it can be checked.
export const playTest = () => {
  ring();
};
