import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

// Themed dropdown used across the analytics page.
// options: [{ value, label }]; onChange receives the option's original value.
const AnSelect = ({ label, value, options, onChange, size = 'md', align = 'left' }) => {
    const [open, setOpen] = useState(false);
    const wrapRef = useRef(null);

    useEffect(() => {
        if (!open) return undefined;
        const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
        const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDown);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    const current = options.find(o => String(o.value) === String(value)) || options[0];

    const pick = (opt) => {
        onChange(opt.value);
        setOpen(false);
    };

    return (
        <div className={`an-select ${size} ${open ? 'open' : ''}`} ref={wrapRef}>
            {label && <span className="an-select-label">{label}</span>}
            <button
                type="button"
                className="an-select-btn"
                aria-haspopup="listbox"
                aria-expanded={open}
                onClick={() => setOpen(o => !o)}
            >
                <span className="an-select-value">{current?.label}</span>
                <ChevronDown size={15} className="an-select-caret" />
            </button>
            {open && (
                <ul className={`an-select-menu ${align}`} role="listbox">
                    {options.map(o => {
                        const selected = String(o.value) === String(current?.value);
                        return (
                            <li key={String(o.value)} role="option" aria-selected={selected}>
                                <button type="button" className={selected ? 'selected' : ''} onClick={() => pick(o)}>
                                    <span>{o.label}</span>
                                    {selected && <Check size={14} />}
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
};

export default AnSelect;
