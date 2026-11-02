import { useState } from 'react';
import PlatformPreview, { PREVIEW_SHAPES } from './PlatformPreview';

// One large preview on the left (default = first platform); a toggle rail on the right switches
// it to any other platform. Pass activeKey + onActiveChange to control it from outside
// (the creative popup does this so that clicking a platform option shows its preview).
export default function PlatformPreviewSwitcher({ platforms, image, title, caption, hashtags, activeKey, onActiveChange }) {
  const [inner, setInner] = useState('');
  if (!platforms.length) return null;
  const current = activeKey !== undefined ? activeKey : inner;
  const active = platforms.find((p) => p.key === current) || platforms[0];
  const pick = (key) => (onActiveChange ? onActiveChange(key) : setInner(key));

  return (
    <div className="pps">
      <div className="pps-stage">
        <PlatformPreview key={active.key} platform={active} image={image} title={title} caption={caption} hashtags={hashtags} />
      </div>
      <div className="pps-rail" role="tablist" aria-label="Switch platform preview" aria-orientation="vertical">
        {platforms.map((p) => {
          const on = p.key === active.key;
          return (
            <button
              key={p.key}
              type="button"
              role="tab"
              aria-selected={on}
              className={`pps-tab ${on ? 'on' : ''}`}
              onClick={() => pick(p.key)}
              title={`${p.label} · ${PREVIEW_SHAPES[p.key]?.shape || ''}`}
            >
              <p.icon size={16} />
              <span className="pps-tab-text">
                <b>{p.label}</b>
                <small>{PREVIEW_SHAPES[p.key]?.shape}</small>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
