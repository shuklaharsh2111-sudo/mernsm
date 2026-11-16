import { useEffect, useRef, useState } from 'react';
import { Check, Download } from 'lucide-react';

// Put the real manual at frontend/public/NEURO-User-Manual.pdf (same file name) to replace the sample.
const FILE = 'NEURO-User-Manual.pdf';
const PREPARE_MS = 1400;   // keep in sync with the nlFill animation in styles/login.css
const DONE_MS = 2400;

const TIP = {
  idle: 'Download user manual',
  loading: 'Preparing your manual…',
  done: 'Manual downloaded'
};

const DownloadManual = () => {
  const [state, setState] = useState('idle');   // 'idle' | 'loading' | 'done'
  const timers = useRef([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const start = () => {
    if (state !== 'idle') return;
    setState('loading');
    timers.current.push(setTimeout(() => {
      const a = document.createElement('a');
      a.href = `${import.meta.env.BASE_URL}${FILE}`;
      a.download = FILE;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setState('done');
      timers.current.push(setTimeout(() => setState('idle'), DONE_MS));
    }, PREPARE_MS));
  };

  return (
    <button
      type="button"
      className={`nl-dl is-${state}`}
      onClick={start}
      disabled={state === 'loading'}
      aria-label="Download user manual (PDF)"
    >
      <span className="nl-dl-icon" aria-hidden="true">
        <i className="nl-dl-fill" />
        <Download size={16} className="nl-dl-ic nl-dl-down" />
        <Check size={16} strokeWidth={2.8} className="nl-dl-ic nl-dl-check" />
      </span>
      <span className="nl-dl-tip" role="status">{TIP[state]}</span>
    </button>
  );
};
export default DownloadManual;
