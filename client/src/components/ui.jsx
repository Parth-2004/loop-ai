import { useEffect, useState } from 'react';
import { BUSY, PLATFORM_LABEL, STATUS_LABEL } from '../api.js';
import BrandLogo from './BrandLogo.jsx';
import Icon from './Icon.jsx';

export function StatusBadge({ status }) {
  return (
    <span className={`badge ${status} ${BUSY.includes(status) ? 'pulse' : ''}`}>
      <span className="dot" /> {STATUS_LABEL[status] || status}
    </span>
  );
}

// Platform tile: the network's real logo on its brand colour. Logo scales with the tile (≈55%).
export function Plat({ p, size }) {
  const style = size ? { width: size, height: size, '--logo': `${Math.round(size * 0.56)}px` } : undefined;
  if (p === 'meta') {
    return (
      <span className="plat-duo" title="Facebook & Instagram" style={size ? { '--duo': `${size}px` } : undefined}>
        <Plat p="facebook" size={size ? Math.round(size * 0.72) : undefined} />
        <Plat p="instagram" size={size ? Math.round(size * 0.72) : undefined} />
      </span>
    );
  }
  return (
    <span className={`plat ${p}`} title={PLATFORM_LABEL[p]} style={style}>
      <BrandLogo name={p} />
    </span>
  );
}

export function Field({ label, hint, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

export function Alert({ type = 'info', children, onClose }) {
  if (!children) return null;
  return (
    <div className={`alert ${type}`}>
      <div className="row between" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
        <div>{children}</div>
        {onClose && (
          <button className="btn ghost sm" onClick={onClose} aria-label="Dismiss">
            <Icon name="close" size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

export function Spinner() {
  return <span className="spinner" />;
}

export function MediaView({ media, className = 'media-preview' }) {
  const m = media?.[0];
  if (!m) return null;
  // Use a relative path so it works behind the dev proxy as well as in production.
  const src = new URL(m.url).pathname;
  return m.kind === 'video' ? (
    <video className={className} src={src} controls playsInline />
  ) : (
    <img className={className} src={src} alt="Generated visual" />
  );
}

export function Thumb({ post }) {
  const m = post.media?.[0];
  if (!m)
    return (
      <div className="thumb">
        <Icon name="posts" size={26} stroke={1.4} />
      </div>
    );
  const src = new URL(m.url).pathname;
  return m.kind === 'video' ? <video className="thumb" src={src} muted /> : <img className="thumb" src={src} alt="" />;
}

export const TIMEZONES = (() => {
  try {
    return Intl.supportedValuesOf('timeZone');
  } catch {
    return ['UTC', 'America/New_York', 'Europe/London', 'Asia/Kolkata', 'Asia/Singapore', 'Australia/Sydney'];
  }
})();

export function TzSelect({ value, onChange }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {!TIMEZONES.includes(value) && <option value={value}>{value}</option>}
      {TIMEZONES.map((tz) => (
        <option key={tz}>{tz}</option>
      ))}
    </select>
  );
}

// Rolls a number up from 0 with an ease-out when it first renders (tabular figures keep width steady).
export function CountUp({ value, duration = 1100 }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf;
    const t0 = performance.now();
    const tick = (t) => {
      const k = Math.min(1, (t - t0) / duration);
      setN(Math.round(value * (1 - (1 - k) ** 3)));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return n;
}
