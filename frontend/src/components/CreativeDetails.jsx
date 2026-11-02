import { Link as LinkIcon } from 'lucide-react';

// Caption, hashtags, keywords and reference links of a saved creative (read-only).
export default function CreativeDetails({ creative }) {
  const { caption, hashtags, keywords } = creative.contentPillar;
  const links = creative.referenceLinks || [];
  return (
    <div className="creative-details">
      {caption && <p className="creative-caption">{caption}</p>}
      {hashtags.length > 0 && (
        <div className="creative-tags">{hashtags.map((h) => <span key={h} className="tag-chip static hash">{h}</span>)}</div>
      )}
      {keywords.length > 0 && (
        <div className="creative-tags"><small>Keywords</small>{keywords.map((k) => <span key={k} className="tag-chip static">{k}</span>)}</div>
      )}
      {links.length > 0 && (
        <ul className="creative-links">
          {links.map((l) => (
            <li key={l}><LinkIcon size={12} /> <a className="creative-link" href={l} target="_blank" rel="noreferrer noopener">{l}</a></li>
          ))}
        </ul>
      )}
    </div>
  );
}
