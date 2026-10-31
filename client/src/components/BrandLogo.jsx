// Official platform marks as single-colour vector logos (rendered in currentColor, usually white
// on the platform's own colour tile). Used for nominative reference to the networks Loop AI posts to.
const LOGOS = {
  x: <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />,
  linkedin: (
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452z" />
  ),
  facebook: <path d="M14 13.5h2.5l1-4H14v-2c0-1.03 0-2 2-2h1.5V2.14c-.326-.043-1.557-.14-2.857-.14C11.928 2 10 3.657 10 6.7v2.8H7v4h3V22h4v-8.5z" />,
  instagram: (
    <>
      <rect x="2.75" y="2.75" width="18.5" height="18.5" rx="5.25" fill="none" stroke="currentColor" strokeWidth="2.1" />
      <circle cx="12" cy="12" r="4.35" fill="none" stroke="currentColor" strokeWidth="2.1" />
      <circle cx="17.45" cy="6.55" r="1.25" />
    </>
  ),
};

export default function BrandLogo({ name, size = 16, className = '' }) {
  if (!LOGOS[name]) return null;
  return (
    <svg className={`brand-logo ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      {LOGOS[name]}
    </svg>
  );
}
