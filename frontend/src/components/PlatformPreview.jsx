import { ImageIcon, Play } from 'lucide-react';

// Each platform shows the image in its own post shape.
export const PREVIEW_SHAPES = {
  instagram: { ratio: '1 / 1', shape: 'Square 1:1' },
  facebook: { ratio: '4 / 5', shape: 'Portrait 4:5' },
  linkedin: { ratio: '1.91 / 1', shape: 'Landscape 1.91:1' },
  x: { ratio: '16 / 9', shape: 'Wide 16:9' },
  youtube: { ratio: '16 / 9', shape: 'Thumbnail 16:9' },
};

// One platform's preview card: image (cropped to the platform shape) + title, caption and hashtags.
export default function PlatformPreview({ platform, image, title, caption, hashtags = [] }) {
  const { key, label, icon: Icon } = platform;
  const spec = PREVIEW_SHAPES[key] || PREVIEW_SHAPES.instagram;
  return (
    <figure className={`pp pp-${key}`}>
      <figcaption className="pp-head">
        <Icon size={14} />
        <b>{label}</b>
        <span>{spec.shape}</span>
      </figcaption>
      <div className="pp-card">
        <div className="pp-media" style={{ aspectRatio: spec.ratio }}>
          {image ? <img src={image} alt={`${label} preview`} /> : <span className="pp-empty"><ImageIcon size={22} /> No image</span>}
          {key === 'youtube' && <span className="pp-play"><Play size={18} fill="currentColor" /></span>}
        </div>
        <div className="pp-text">
          <b>{title || 'Title'}</b>
          {caption && <p>{caption}</p>}
          {hashtags.length > 0 && <p className="pp-tags">{hashtags.join(' ')}</p>}
        </div>
      </div>
    </figure>
  );
}
