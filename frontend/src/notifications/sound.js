// Notification sounds are generated with the Web Audio API, so no audio files are needed.
// Browsers only allow sound after the person has clicked or typed once; we unlock on the first interaction.
let ctx = null;
const KEY = 'notifSoundMuted';

let muted = (() => {
  try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
})();

export const isMuted = () => muted;
export const setMuted = (value) => {
  muted = Boolean(value);
  try { localStorage.setItem(KEY, muted ? '1' : '0'); } catch { /* storage unavailable */ }
};

const getCtx = () => {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => { });
  return ctx;
};

if (typeof window !== 'undefined') {
  const unlock = () => {
    getCtx();
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
}

// One soft note with a quick fade in and out.
const note = (c, freq, start, length, volume, type = 'sine') => {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
  osc.connect(gain).connect(c.destination);
  osc.start(start);
  osc.stop(start + length + 0.02);
};

const play = (fn) => {
  if (muted) return;
  try {
    const c = getCtx();
    if (c) fn(c, c.currentTime + 0.01);
  } catch { /* sound is optional */ }
};

// Someone else did something for you: a two-note "ding". Warnings and rejections get a lower, falling tone.
export const playNotification = (tone = 'info') => play((c, t) => {
  if (tone === 'danger' || tone === 'warning') {
    note(c, 622, t, 0.22, 0.16, 'triangle');
    note(c, 466, t + 0.14, 0.34, 0.16, 'triangle');
  } else if (tone === 'success') {
    note(c, 784, t, 0.16, 0.16);
    note(c, 1047, t + 0.1, 0.18, 0.16);
    note(c, 1568, t + 0.2, 0.34, 0.14);
  } else {
    note(c, 880, t, 0.18, 0.16);
    note(c, 1319, t + 0.12, 0.38, 0.15);
  }
});

// You did something and it worked: a short soft tick.
let lastTick = 0;
export const playAction = () => {
  const now = Date.now();
  if (now - lastTick < 350) return;
  lastTick = now;
  play((c, t) => note(c, 740, t, 0.09, 0.09));
};

// You did something and it failed.
export const playError = () => play((c, t) => {
  note(c, 220, t, 0.16, 0.12, 'sawtooth');
  note(c, 165, t + 0.1, 0.24, 0.12, 'sawtooth');
});
