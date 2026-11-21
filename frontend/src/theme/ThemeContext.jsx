import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../AuthContext';

/* =========================================================
   Customize Theme
   Every panel (admin, operation manager, reporting manager,
   SME, SMI, designer, HR) shares the same DashboardLayout, so one
   provider that writes CSS variables on <html> themes them all.
   The choice is saved in this browser, separately for each user,
   and can be moved to another device with a theme code.
========================================================= */

/* ---------- option lists (also used by the settings card) ---------- */

export const ACCENTS = [
  { id: 'ember', name: 'Ember', primary: '#f26b0f', secondary: '#d92d0a' },
  { id: 'sunset', name: 'Sunset', primary: '#f97316', secondary: '#db2777' },
  { id: 'gold', name: 'Gold', primary: '#f59e0b', secondary: '#b45309' },
  { id: 'lime', name: 'Lime', primary: '#84cc16', secondary: '#3f6212' },
  { id: 'emerald', name: 'Emerald', primary: '#10b981', secondary: '#047857' },
  { id: 'teal', name: 'Teal', primary: '#14b8a6', secondary: '#0f766e' },
  { id: 'sky', name: 'Sky', primary: '#38bdf8', secondary: '#0369a1' },
  { id: 'ocean', name: 'Ocean', primary: '#3b82f6', secondary: '#1d4ed8' },
  { id: 'violet', name: 'Violet', primary: '#8b5cf6', secondary: '#6d28d9' },
  { id: 'fuchsia', name: 'Fuchsia', primary: '#d946ef', secondary: '#a21caf' },
  { id: 'rose', name: 'Rose', primary: '#f43f5e', secondary: '#be123c' },
  { id: 'silver', name: 'Silver', primary: '#e5e7eb', secondary: '#6b7280' }
];

// the dark colour family of the whole app: background, sidebar, cards
export const TONES = [
  {
    id: 'ember', name: 'Ember black', hint: 'Warm black (default)',
    vars: {
      '--bg': '#09090b', '--surface': '#131316', '--surface-2': '#1a1a1f', '--surface-3': '#222228', '--line': '#2b2b32',
      '--bg-left-1': '#030202', '--bg-left-2': '#060303', '--bg-left-3': '#0b0504',
      '--side-1': '#0e0e11', '--side-2': '#0a0a0c', '--panel-rgb': '18, 14, 14'
    }
  },
  {
    id: 'graphite', name: 'Graphite', hint: 'Neutral dark grey',
    vars: {
      '--bg': '#0b0b0c', '--surface': '#161617', '--surface-2': '#1e1e20', '--surface-3': '#272729', '--line': '#333336',
      '--bg-left-1': '#050505', '--bg-left-2': '#0a0a0a', '--bg-left-3': '#101011',
      '--side-1': '#121213', '--side-2': '#0b0b0c', '--panel-rgb': '20, 20, 22'
    }
  },
  {
    id: 'amoled', name: 'Pure black', hint: 'True black, best for OLED screens',
    vars: {
      '--bg': '#000000', '--surface': '#0a0a0a', '--surface-2': '#111111', '--surface-3': '#181818', '--line': '#242424',
      '--bg-left-1': '#000000', '--bg-left-2': '#000000', '--bg-left-3': '#030303',
      '--side-1': '#050505', '--side-2': '#000000', '--panel-rgb': '8, 8, 8'
    }
  },
  {
    id: 'midnight', name: 'Midnight', hint: 'Deep navy blue',
    vars: {
      '--bg': '#070a12', '--surface': '#0f1422', '--surface-2': '#161d30', '--surface-3': '#1e2740', '--line': '#26304a',
      '--bg-left-1': '#02040a', '--bg-left-2': '#040812', '--bg-left-3': '#070d1c',
      '--side-1': '#0a0f1c', '--side-2': '#060913', '--panel-rgb': '14, 18, 30'
    }
  },
  {
    id: 'forest', name: 'Forest', hint: 'Dark green',
    vars: {
      '--bg': '#060b08', '--surface': '#0e1612', '--surface-2': '#15201a', '--surface-3': '#1c2a22', '--line': '#243329',
      '--bg-left-1': '#020804', '--bg-left-2': '#040b06', '--bg-left-3': '#07120b',
      '--side-1': '#09110d', '--side-2': '#050a07', '--panel-rgb': '12, 20, 16'
    }
  },
  {
    id: 'plum', name: 'Plum', hint: 'Dark purple',
    vars: {
      '--bg': '#0b070e', '--surface': '#161020', '--surface-2': '#1e162b', '--surface-3': '#271d37', '--line': '#33264a',
      '--bg-left-1': '#050207', '--bg-left-2': '#08040c', '--bg-left-3': '#0d0614',
      '--side-1': '#0f0a15', '--side-2': '#09060d', '--panel-rgb': '22, 14, 30'
    }
  }
];

// how strong the coloured glow behind the app is
export const GLOWS = [
  { id: 'strong', name: 'Vivid', hint: 'Big, bright glow', k: 1 },
  { id: 'soft', name: 'Soft', hint: 'Gentle glow', k: 0.4 },
  { id: 'off', name: 'Off', hint: 'No glow, flat background', k: 0 }
];

// where the glow sits on the screen
export const GLOW_POSITIONS = [
  { id: 'right', name: 'Right', x: '84%', y: '58%', wx: '100%', wy: '35%' },
  { id: 'left', name: 'Left', x: '16%', y: '58%', wx: '0%', wy: '35%' },
  { id: 'top', name: 'Top', x: '50%', y: '6%', wx: '50%', wy: '0%' },
  { id: 'bottom', name: 'Bottom', x: '50%', y: '100%', wx: '50%', wy: '100%' }
];

// how see-through the cards are
export const GLASS = [
  { id: 'clear', name: 'See-through', hint: 'Frosted glass, the background shows through', alpha: 0.28, blur: 22 },
  { id: 'balanced', name: 'Balanced', hint: 'A little see-through (default)', alpha: 0.42, blur: 20 },
  { id: 'solid', name: 'Solid', hint: 'Plain solid cards, easiest to read', alpha: 0.93, blur: 0 }
];

export const RADII = [
  { id: 'sharp', name: 'Sharp', hint: 'Almost square corners', px: 6 },
  { id: 'rounded', name: 'Rounded', hint: 'Default', px: 14 },
  { id: 'pill', name: 'Extra round', hint: 'Very soft corners', px: 22 }
];

export const DENSITIES = [
  { id: 'compact', name: 'Compact', hint: 'Less space, more on screen', pad: '16px 20px 32px' },
  { id: 'comfortable', name: 'Comfortable', hint: 'Default', pad: '26px 32px 48px' },
  { id: 'spacious', name: 'Spacious', hint: 'More breathing room', pad: '36px 46px 64px' }
];

const SYS = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
export const FONTS = [
  { id: 'poppins', name: 'Poppins', hint: 'Default, round and friendly', stack: `'Poppins', ${SYS}` },
  { id: 'inter', name: 'Inter', hint: 'Clean and neutral', stack: `'Inter', ${SYS}` },
  { id: 'dmsans', name: 'DM Sans', hint: 'Modern and light', stack: `'DM Sans', ${SYS}` },
  { id: 'nunito', name: 'Nunito', hint: 'Soft and rounded', stack: `'Nunito', ${SYS}` },
  { id: 'grotesk', name: 'Space Grotesk', hint: 'Techy look', stack: `'Space Grotesk', ${SYS}` },
  { id: 'system', name: 'System', hint: "Your device's own font", stack: SYS }
];

export const DEFAULT_THEME = {
  accent: 'ember',      // an ACCENTS id, or 'custom'
  primary: '#f26b0f',   // used when accent === 'custom'
  secondary: '#d92d0a',
  tone: 'ember',
  glow: 'strong',
  glowPos: 'right',
  grid: 'on',
  glass: 'balanced',
  radius: 'rounded',
  sidebar: 'dark',      // 'dark' | 'tinted'
  density: 'comfortable',
  font: 'poppins',
  motion: 'on'          // 'on' | 'off'
};

// ready-made looks: one click sets colours + background
export const PRESETS = [
  { id: 'ember', name: 'Ember', note: 'The original', set: { accent: 'ember', tone: 'ember', glow: 'strong', glowPos: 'right' } },
  { id: 'ocean-night', name: 'Ocean night', note: 'Calm blue', set: { accent: 'ocean', tone: 'midnight', glow: 'strong', glowPos: 'right' } },
  { id: 'aurora', name: 'Aurora', note: 'Green and teal', set: { accent: 'emerald', tone: 'forest', glow: 'strong', glowPos: 'right' } },
  { id: 'violet-dream', name: 'Violet dream', note: 'Purple glow', set: { accent: 'violet', tone: 'plum', glow: 'strong', glowPos: 'right' } },
  { id: 'sunset', name: 'Sunset', note: 'Orange to pink', set: { accent: 'sunset', tone: 'ember', glow: 'strong', glowPos: 'right' } },
  { id: 'rose-noir', name: 'Rose noir', note: 'Pink on black', set: { accent: 'rose', tone: 'amoled', glow: 'soft', glowPos: 'right' } },
  { id: 'gold-rush', name: 'Gold rush', note: 'Warm and rich', set: { accent: 'gold', tone: 'graphite', glow: 'soft', glowPos: 'right' } },
  { id: 'mono', name: 'Mono', note: 'Quiet and plain', set: { accent: 'silver', tone: 'graphite', glow: 'off', glowPos: 'right' } }
];

/* ---------- colour helpers ---------- */
const HEX = /^#([0-9a-f]{6})$/i;
export const isHex = (v) => HEX.test(String(v || ''));
const toRgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const toHex = ([r, g, b]) =>
  `#${[r, g, b].map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('')}`;
const mix = (hexA, hexB, t) => {
  const a = toRgb(hexA);
  const b = toRgb(hexB);
  return toHex(a.map((v, i) => v + (b[i] - v) * t));
};
const rgbStr = (hex) => toRgb(hex).join(', ');

export const pick = (list, id, fallback) => list.find((x) => x.id === id) || fallback;

export const resolveAccent = (theme) => {
  if (theme.accent === 'custom' && isHex(theme.primary) && isHex(theme.secondary)) {
    return { primary: theme.primary, secondary: theme.secondary };
  }
  const a = pick(ACCENTS, theme.accent, ACCENTS[0]);
  return { primary: a.primary, secondary: a.secondary };
};

// every CSS variable the theme writes onto <html>
export const buildVars = (theme) => {
  const { primary, secondary } = resolveAccent(theme);
  const tone = pick(TONES, theme.tone, TONES[0]);
  const glow = pick(GLOWS, theme.glow, GLOWS[0]);
  const pos = GLOW_POSITIONS[0]; // glow is always on the right; only its colours change with the theme
  const glass = pick(GLASS, theme.glass, GLASS[1]);
  const radius = pick(RADII, theme.radius, RADII[1]);
  const density = pick(DENSITIES, theme.density, DENSITIES[1]);
  const font = pick(FONTS, theme.font, FONTS[0]);
  const light = mix(primary, '#ffffff', 0.35);
  const deep = mix(secondary, '#000000', 0.35);
  const soft = mix(secondary, '#ffffff', 0.5);

  const vars = {
    ...tone.vars,
    '--orange': primary,
    '--orange-light': light,
    '--red': secondary,
    '--red-deep': deep,
    '--red-soft': soft,
    '--grad': `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)`,
    '--accent-rgb': rgbStr(primary),
    '--accent-light-rgb': rgbStr(light),
    '--accent2-rgb': rgbStr(secondary),
    '--accent3-rgb': rgbStr(deep),
    '--royal-dark': mix(primary, '#000000', 0.82),
    '--glow': `0 0 24px rgba(${rgbStr(primary)}, 0.22)`,
    '--glow-k': String(glow.k),
    '--glow-x': pos.x,
    '--glow-y': pos.y,
    '--wash-x': pos.wx,
    '--wash-y': pos.wy,
    '--grid-a': theme.grid === 'off' ? '0' : '0.05',
    '--panel-a': String(glass.alpha),
    '--glass-blur': `${glass.blur}px`,
    '--radius': `${radius.px}px`,
    '--content-pad': density.pad,
    '--app-font': font.stack
  };

  if (theme.sidebar === 'tinted') {
    vars['--side-1'] = mix(tone.vars['--side-1'], primary, 0.2);
    vars['--side-2'] = mix(tone.vars['--side-2'], secondary, 0.14);
  }
  return vars;
};

/* ---------- validation, storage, share codes ---------- */
const oneOf = (list, v, d) => (list.some((x) => x.id === v) ? v : d);
const flag = (v, a, b, d) => (v === a || v === b ? v : d);

export const sanitize = (raw) => {
  const t = { ...DEFAULT_THEME, ...(raw && typeof raw === 'object' ? raw : {}) };
  return {
    accent: t.accent === 'custom' ? 'custom' : oneOf(ACCENTS, t.accent, DEFAULT_THEME.accent),
    primary: isHex(t.primary) ? t.primary : DEFAULT_THEME.primary,
    secondary: isHex(t.secondary) ? t.secondary : DEFAULT_THEME.secondary,
    tone: oneOf(TONES, t.tone, DEFAULT_THEME.tone),
    glow: oneOf(GLOWS, t.glow, DEFAULT_THEME.glow),
    glowPos: oneOf(GLOW_POSITIONS, t.glowPos, DEFAULT_THEME.glowPos),
    grid: flag(t.grid, 'on', 'off', DEFAULT_THEME.grid),
    glass: oneOf(GLASS, t.glass, DEFAULT_THEME.glass),
    radius: oneOf(RADII, t.radius, DEFAULT_THEME.radius),
    sidebar: flag(t.sidebar, 'dark', 'tinted', DEFAULT_THEME.sidebar),
    density: oneOf(DENSITIES, t.density, DEFAULT_THEME.density),
    font: oneOf(FONTS, t.font, DEFAULT_THEME.font),
    motion: flag(t.motion, 'on', 'off', DEFAULT_THEME.motion)
  };
};

const CODE_PREFIX = 'NEURO1.';
export const encodeTheme = (theme) => {
  try {
    return CODE_PREFIX + btoa(unescape(encodeURIComponent(JSON.stringify(sanitize(theme)))));
  } catch {
    return '';
  }
};
export const decodeTheme = (code) => {
  try {
    const text = String(code || '').trim();
    if (!text.startsWith(CODE_PREFIX)) return null;
    return sanitize(JSON.parse(decodeURIComponent(escape(atob(text.slice(CODE_PREFIX.length))))));
  } catch {
    return null;
  }
};

// is this one of the ready-made looks? (used to highlight it)
export const activePreset = (theme) =>
  PRESETS.find((p) => Object.entries(p.set).every(([k, v]) => theme[k] === v))?.id || null;

const KEY = 'neuro-theme';
const keyFor = (user) => {
  const id = user?.id || user?._id || user?.email;
  return id ? `${KEY}:${id}` : null;
};
const read = (key) => {
  if (!key) return null;
  try {
    const text = localStorage.getItem(key);
    return text ? sanitize(JSON.parse(text)) : null;
  } catch {
    return null;
  }
};
const write = (key, theme) => {
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify(theme));
  } catch { /* storage full or blocked: the theme still applies for this session */ }
};

const apply = (theme) => {
  const root = document.documentElement;
  Object.entries(buildVars(theme)).forEach(([name, value]) => root.style.setProperty(name, value));
  root.dataset.motion = theme.motion;
};

/* ---------- context ---------- */
const ThemeContext = createContext(null);

export const ThemeProvider = ({ children }) => {
  const { user, loading } = useAuth();
  const storageKey = keyFor(user);
  const [theme, setTheme] = useState(() => read(`${KEY}:last`) || DEFAULT_THEME);

  // when the signed-in user is known, load their saved theme (login page uses the default look)
  useEffect(() => {
    if (loading) return;
    setTheme(storageKey ? read(storageKey) || DEFAULT_THEME : DEFAULT_THEME);
  }, [storageKey, loading]);

  useEffect(() => {
    apply(theme);
  }, [theme]);

  const save = useCallback((next) => {
    write(storageKey, next);
    write(`${KEY}:last`, next);
  }, [storageKey]);

  // change one or more settings
  const update = useCallback((patch) => {
    const next = sanitize({ ...theme, ...patch });
    save(next);
    setTheme(next);
  }, [theme, save]);

  // replace everything (reset, or a pasted theme code)
  const replace = useCallback((next) => {
    const clean = sanitize(next);
    save(clean);
    setTheme(clean);
  }, [save]);

  const reset = useCallback(() => replace(DEFAULT_THEME), [replace]);

  const value = useMemo(() => ({ theme, update, replace, reset }), [theme, update, replace, reset]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => useContext(ThemeContext);