import { useState } from 'react';
import { X } from 'lucide-react';

// Type a word and press Enter, comma or space to turn it into a chip. Backspace removes the last chip.
// prefix='#' makes every chip a hashtag.
export default function TagInput({ value, onChange, prefix = '', placeholder, max = 30, maxLength = 50, ariaLabel }) {
  const [text, setText] = useState('');

  const clean = (raw) => {
    let t = raw.trim().replace(/[\s,]+/g, '');
    if (prefix) t = prefix + t.replace(new RegExp(`^${prefix}+`), '');
    return t;
  };
  const add = (raw) => {
    const t = clean(raw);
    if (!t || t === prefix || t.length > maxLength) return setText('');
    if (value.length < max && !value.some((v) => v.toLowerCase() === t.toLowerCase())) onChange([...value, t]);
    setText('');
  };
  const onKeyDown = (e) => {
    if (['Enter', ',', ' '].includes(e.key)) {
      e.preventDefault();
      add(text);
    } else if (e.key === 'Backspace' && !text && value.length) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div className="tag-input">
      {value.map((t) => (
        <span key={t} className="tag-chip">
          {t}
          <button type="button" aria-label={`Remove ${t}`} onClick={() => onChange(value.filter((v) => v !== t))}><X size={11} /></button>
        </span>
      ))}
      <input
        type="text"
        value={text}
        aria-label={ariaLabel}
        placeholder={value.length >= max ? `Max ${max}` : placeholder}
        disabled={value.length >= max}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => text && add(text)}
      />
    </div>
  );
}
