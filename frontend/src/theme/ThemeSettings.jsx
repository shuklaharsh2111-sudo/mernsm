import { useEffect, useRef, useState } from 'react';
import { Check, Copy, RotateCcw, Download, CheckCircle2, AlertCircle } from 'lucide-react';
import {
    ACCENTS, DENSITIES, FONTS, GLOWS, GLOW_POSITIONS, PRESETS, TONES,
    activePreset, decodeTheme, encodeTheme, isHex, pick, resolveAccent, useTheme
} from './ThemeContext';

const hexA = (hex, a) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

/* ---------- small building blocks ---------- */

// a titled step with a plain-language description
const Section = ({ n, title, desc, children }) => (
    <div className="th-section">
        <div className="th-section-head">
            <span className="th-step">{n}</span>
            <div>
                <h3>{title}</h3>
                <p>{desc}</p>
            </div>
        </div>
        <div className="th-section-body">{children}</div>
    </div>
);

// one setting: a label, a one-line explanation, then the choices
const Row = ({ label, hint, children }) => (
    <div className="th-row">
        <div className="th-row-text">
            <strong>{label}</strong>
            {hint && <span>{hint}</span>}
        </div>
        {children}
    </div>
);

const Choices = ({ label, value, options, onChange }) => (
    <div className="th-choices" role="radiogroup" aria-label={label}>
        {options.map((o) => (
            <button
                key={o.id}
                type="button"
                role="radio"
                aria-checked={value === o.id}
                title={o.hint || o.name}
                className={`th-choice ${value === o.id ? 'active' : ''}`}
                onClick={() => onChange(o.id)}
            >
                {o.name}
            </button>
        ))}
    </div>
);

/* ---------- live preview: a tiny copy of the app that follows every change ---------- */
const Preview = () => (
    <div className="th-preview" aria-hidden="true">
        <div className="th-preview-title">
            <strong>Live preview</strong>
            <span>This is how your workspace will look</span>
        </div>
        <div className="th-screen">
            <div className="th-side">
                <span className="th-logo" />
                <span className="th-nav active" />
                <span className="th-nav" />
                <span className="th-nav" />
                <span className="th-nav short" />
            </div>
            <div className="th-main">
                <div className="th-top"><span /><i /></div>
                <div className="th-cards">
                    <div className="th-card"><small>Tasks</small><b>24</b></div>
                    <div className="th-card"><small>Done</small><b>18</b></div>
                </div>
                <div className="th-card wide">
                    <small>Monthly progress</small>
                    <span className="th-bar"><b /></span>
                    <div className="th-actions">
                        <em className="th-btn">Save</em>
                        <em className="th-chip">Active</em>
                    </div>
                </div>
            </div>
        </div>
    </div>
);

/* ---------- the card ---------- */
const ThemeSettings = () => {
    const { theme, update, replace, reset } = useTheme();
    const { primary, secondary } = resolveAccent(theme);
    const current = activePreset(theme);

    const [saved, setSaved] = useState(false);
    const [code, setCode] = useState('');
    const [codeNotice, setCodeNotice] = useState(null);
    const timer = useRef(null);

    useEffect(() => () => clearTimeout(timer.current), []);

    // every change is saved straight away; show a small "Saved" tick so people know
    const flash = () => {
        setSaved(true);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setSaved(false), 1800);
    };
    const change = (patch) => { update(patch); flash(); };
    const doReset = () => { reset(); setCodeNotice(null); flash(); };

    const copyCode = async () => {
        const text = encodeTheme(theme);
        try {
            await navigator.clipboard.writeText(text);
            setCodeNotice({ type: 'success', text: 'Theme code copied. Paste it on another device to get the same look.' });
        } catch {
            setCode(text);
            setCodeNotice({ type: 'success', text: 'Copy the code from the box below.' });
        }
    };

    const applyCode = () => {
        const next = decodeTheme(code);
        if (!next) {
            setCodeNotice({ type: 'error', text: 'That code is not valid. Copy it again from the other device.' });
            return;
        }
        replace(next);
        setCode('');
        setCodeNotice({ type: 'success', text: 'Theme applied.' });
        flash();
    };

    return (
        <section className="st-card st-wide th-card-root" aria-labelledby="th-title">
            <div className="th-head">
                <div>
                    <h2 id="th-title">Customize theme</h2>
                    <p>Make the workspace look the way you like. Pick a ready-made look, or change things one by one. The preview updates as you click.</p>
                </div>
                <div className="th-head-actions">
                    <span className={`th-saved ${saved ? 'show' : ''}`} role="status">
                        <Check size={14} /> Saved
                    </span>
                    <button type="button" className="st-btn ghost" onClick={doReset}>
                        <RotateCcw size={14} /> Reset to default
                    </button>
                </div>
            </div>

            <div className="th-layout">
                <div className="th-controls">
                    <Section n="1" title="Quick themes" desc="Start here. One click sets the colours and background. You can still tweak anything after.">
                        <div className="th-presets">
                            {PRESETS.map((p) => {
                                const a = pick(ACCENTS, p.set.accent, ACCENTS[0]);
                                const t = pick(TONES, p.set.tone, TONES[0]);
                                const g = pick(GLOWS, p.set.glow, GLOWS[0]);
                                const pos = GLOW_POSITIONS[0];
                                const circle = g.k > 0
                                    ? `radial-gradient(circle at ${pos.x} ${pos.y}, ${hexA(a.primary, 0.95 * Math.max(g.k, 0.55))} 0%, ${hexA(a.secondary, 0.65 * Math.max(g.k, 0.55))} 38%, transparent 72%), `
                                    : '';
                                return (
                                    <button
                                        key={p.id}
                                        type="button"
                                        className={`th-preset ${current === p.id ? 'active' : ''}`}
                                        aria-pressed={current === p.id}
                                        onClick={() => change(p.set)}
                                    >
                                        <i style={{ background: `${circle}${t.vars['--bg-left-2']}` }}>
                                            {current === p.id && <Check size={16} />}
                                        </i>
                                        <strong>{p.name}</strong>
                                        <span>{p.note}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </Section>

                    <Section n="2" title="Colours" desc="The accent colour is used for buttons, active menu items, badges, charts and highlights.">
                        <Row label="Accent colour" hint="Pick one of the colours below.">
                            <div className="th-swatches" role="radiogroup" aria-label="Accent colour">
                                {ACCENTS.map((a) => (
                                    <button
                                        key={a.id}
                                        type="button"
                                        role="radio"
                                        aria-checked={theme.accent === a.id}
                                        title={a.name}
                                        className={`th-swatch ${theme.accent === a.id ? 'active' : ''}`}
                                        onClick={() => change({ accent: a.id })}
                                    >
                                        <i style={{ background: `linear-gradient(135deg, ${a.primary}, ${a.secondary})` }}>
                                            {theme.accent === a.id && <Check size={15} />}
                                        </i>
                                        <span>{a.name}</span>
                                    </button>
                                ))}
                            </div>
                        </Row>
                        <Row label="Your own colours" hint="Want something different? Choose a main colour and a second colour. They blend together in buttons and highlights.">
                            <div className="th-custom">
                                <label className="th-color">
                                    <input
                                        type="color"
                                        value={isHex(primary) ? primary : '#f26b0f'}
                                        onChange={(e) => change({ accent: 'custom', primary: e.target.value, secondary })}
                                        aria-label="Main colour"
                                    />
                                    <span>Main <b>{primary.toUpperCase()}</b></span>
                                </label>
                                <label className="th-color">
                                    <input
                                        type="color"
                                        value={isHex(secondary) ? secondary : '#d92d0a'}
                                        onChange={(e) => change({ accent: 'custom', primary, secondary: e.target.value })}
                                        aria-label="Second colour"
                                    />
                                    <span>Second <b>{secondary.toUpperCase()}</b></span>
                                </label>
                                {theme.accent === 'custom' && <em className="th-tag">Using your own colours</em>}
                            </div>
                        </Row>
                    </Section>

                    <Section n="3" title="Side menu" desc="Choose how the menu on the left side of the screen looks.">
                        <Row label="Side menu colour" hint="Keep the menu dark, or tint it with your accent colour.">
                            <Choices
                                label="Side menu colour"
                                value={theme.sidebar}
                                options={[
                                    { id: 'dark', name: 'Dark', hint: 'Plain dark menu' },
                                    { id: 'tinted', name: 'Colour tint', hint: 'Menu picks up your accent colour' }
                                ]}
                                onChange={(id) => change({ sidebar: id })}
                            />
                        </Row>
                    </Section>

                    <Section n="4" title="Use on another device" desc="Your theme is saved in this browser. Copy a code to get the same look on your phone or another computer.">
                        <div className="th-share">
                            <button type="button" className="st-btn ghost" onClick={copyCode}>
                                <Copy size={14} /> Copy my theme code
                            </button>
                            <div className="th-paste">
                                <input
                                    type="text"
                                    value={code}
                                    placeholder="Paste a theme code here"
                                    onChange={(e) => { setCode(e.target.value); setCodeNotice(null); }}
                                    aria-label="Theme code"
                                    spellCheck={false}
                                />
                                <button type="button" className="st-btn primary" onClick={applyCode} disabled={!code.trim()}>
                                    <Download size={14} /> Apply
                                </button>
                            </div>
                        </div>
                        {codeNotice && (
                            <div className={`st-notice ${codeNotice.type}`} role="status">
                                {codeNotice.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                                {codeNotice.text}
                            </div>
                        )}
                    </Section>

                    <div className="th-reset-row">
                        <button type="button" className="st-btn ghost" onClick={doReset}>
                            <RotateCcw size={14} /> Reset to default theme
                        </button>
                        <span>Puts every colour and style back to how the app first looked.</span>
                    </div>
                </div>

                <aside className="th-aside">
                    <Preview />
                </aside>
            </div>
        </section>
    );
};

export default ThemeSettings;