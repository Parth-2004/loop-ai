// Cinematic fallback media: drifting aurora light + film grain. No footage needed.
export default function Aurora({ variant = 'hero' }) {
  return (
    <div className={`aurora aurora-${variant}`} aria-hidden="true">
      <span className="blob b1" />
      <span className="blob b2" />
      <span className="blob b3" />
      <span className="blob b4" />
      <span className="horizon" />
      <svg className="grain" width="100%" height="100%">
        <filter id={`grain-${variant}`}>
          <feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="3" stitchTiles="stitch" />
          <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .55 0" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#grain-${variant})`} />
      </svg>
    </div>
  );
}
