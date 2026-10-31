// Crafted 24px stroke icons (1.75 stroke, round joins) — replaces emoji glyphs.
const PATHS = {
  grid: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="2" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="2" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="2" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="2" />
    </>
  ),
  posts: (
    <>
      <path d="M14 3.5H7.5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V8z" />
      <path d="M14 3.5V8h4.5M9 12.5h6M9 16h3.5" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M8 3v4M16 3v4M3.5 10h17M8 14h1.5M12 14h1.5M16 14h.5M8 17h1.5M12 17h1.5" />
    </>
  ),
  link: (
    <>
      <path d="M10 13.5a4.5 4.5 0 0 0 6.4.2l2.9-2.9a4.5 4.5 0 0 0-6.4-6.4l-1.3 1.3" />
      <path d="M14 10.5a4.5 4.5 0 0 0-6.4-.2l-2.9 2.9a4.5 4.5 0 0 0 6.4 6.4l1.3-1.3" />
    </>
  ),
  sparkle: (
    <>
      <path d="M11 3.5 12.7 8.3 17.5 10l-4.8 1.7L11 16.5l-1.7-4.8L4.5 10l4.8-1.7z" />
      <path d="M18 14.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" />
    </>
  ),
  sliders: (
    <>
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="17" r="2" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="m4 7.5 8 5.5 8-5.5" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  send: <path d="M7 17 17 7M8.5 7H17v8.5" />,
  alert: (
    <>
      <path d="M10.3 4.3 2.8 17.5A2 2 0 0 0 4.5 20.5h15a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0z" />
      <path d="M12 9.5v4M12 17h.01" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  image: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="m20.5 15.5-4.5-4.5-8.5 8.5" />
    </>
  ),
  pen: (
    <>
      <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z" />
      <path d="m13.5 6.5 4 4" />
    </>
  ),
  inbox: (
    <>
      <path d="M3.5 13.5 6 5.5a1.5 1.5 0 0 1 1.4-1h9.2a1.5 1.5 0 0 1 1.4 1l2.5 8" />
      <path d="M3.5 13.5V18a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-4.5H16l-1.5 2.5h-5L8 13.5z" />
    </>
  ),
  wave: <path d="M3 12h3.5l2.5-6 4 12 2.5-6H21" />,
  user: (
    <>
      <circle cx="12" cy="8" r="3.75" />
      <path d="M4.5 20.25c.9-3.6 3.9-5.75 7.5-5.75s6.6 2.15 7.5 5.75" />
    </>
  ),
  building: (
    <>
      <path d="M4.5 20.5V5.5a1.5 1.5 0 0 1 1.5-1.5h7a1.5 1.5 0 0 1 1.5 1.5v15M14.5 9.5H18a1.5 1.5 0 0 1 1.5 1.5v9.5M3 20.5h18" />
      <path d="M8 8h3M8 11.5h3M8 15h3M17 13.5h.01M17 17h.01" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 11.5A8 8 0 0 0 6.2 6.3L4 8.5" />
      <path d="M4 4v4.5h4.5M4 12.5a8 8 0 0 0 13.8 5.2L20 15.5" />
      <path d="M20 20v-4.5h-4.5" />
    </>
  ),
  close: <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,
  play: <path d="M8 5.5v13l10-6.5z" fill="currentColor" stroke="none" />,
  checkCircle: (
    <>
      <circle cx="12" cy="12" r="8.75" />
      <path d="m8.5 12.2 2.4 2.4 4.6-4.9" />
    </>
  ),
  xCircle: (
    <>
      <circle cx="12" cy="12" r="8.75" />
      <path d="m9.25 9.25 5.5 5.5M14.75 9.25l-5.5 5.5" />
    </>
  ),
  external: <path d="M14 4h6v6M20 4l-8.5 8.5M18 13.5V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4.5" />,
  asterisk: <path d="M12 4v16M5.1 8l13.8 8M5.1 16l13.8-8" />,
  logout: <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16.5 14.5 12 10 7.5M14.5 12H3.5" />,
};

export default function Icon({ name, size = 20, stroke = 1.75, className = '' }) {
  return (
    <svg
      className={`icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}
