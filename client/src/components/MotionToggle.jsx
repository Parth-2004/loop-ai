import { useEffect, useState } from 'react';
import { isFullMotion, setMotionPref } from '../motion.js';

// Small switch that overrides the OS "reduce motion" setting for this site.
export default function MotionToggle({ className = '' }) {
  const [on, setOn] = useState(isFullMotion);

  useEffect(() => {
    const sync = () => setOn(isFullMotion());
    window.addEventListener('loop-motion', sync);
    return () => window.removeEventListener('loop-motion', sync);
  }, []);

  return (
    <button
      type="button"
      className={`motion-toggle ${on ? 'on' : ''} ${className}`}
      aria-pressed={on}
      title={on ? 'Turn animations off' : 'Turn animations on'}
      onClick={() => setMotionPref(on ? 'off' : 'on')}
    >
      <span className="mt-track">
        <span className="mt-knob" />
      </span>
      Animations {on ? 'on' : 'off'}
    </button>
  );
}
