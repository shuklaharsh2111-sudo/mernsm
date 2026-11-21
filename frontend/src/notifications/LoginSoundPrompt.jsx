import { useEffect, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { audioState, subscribeAudio, enableSound, wasEnabled } from './sound';
import '../styles/loginSound.css';

// Shown on the login page only while the browser is blocking sound.
// One click here unlocks audio for the whole session, so notification sounds work after signing in.
const LoginSoundPrompt = () => {
  const [state, setState] = useState(audioState());
  const [done, setDone] = useState(false);

  useEffect(() => subscribeAudio((s) => {
    setState(s);
    if (s === 'running') setDone(true);
  }), []);

  // already enabled before in this browser: the first click on the page unlocks it silently, so do not ask again
  if ((state === 'running' || wasEnabled()) && !done) return null;

  return done ? (
    <p className="nl-sound is-on" role="status"><Volume2 size={15} /> Notification sound is on.</p>
  ) : (
    <button type="button" className="nl-sound" onClick={enableSound}>
      <VolumeX size={15} />
      <span>Your browser is blocking notification sound. <strong>Click to enable</strong></span>
    </button>
  );
};

export default LoginSoundPrompt;
