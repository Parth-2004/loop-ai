import { useEffect, useRef } from 'react';
import BrandLogo from '../components/BrandLogo.jsx';

// Signature effect: a pill window opens between the letters of LOOP, pushing them apart.
// Inside it, a feed of drafted posts loops forever — "your feed, on a loop".

const POSTS = [
  { c: 'linkedin', t: 'Three things we learned shipping weekly for a year', s: 'Approved', tone: 'a' },
  { c: 'x', t: 'Small batch. Big flavour. Drops Friday.', s: 'Scheduled 9:30', tone: 'b' },
  { c: 'instagram', t: 'Behind the roast: a morning in the studio', s: 'Awaiting you', tone: 'c' },
  { c: 'facebook', t: 'Free workshop this Saturday — bring a friend', s: 'Published', tone: 'd' },
  { c: 'linkedin', t: 'Why we answer every customer email ourselves', s: 'Revised ×2', tone: 'e' },
  { c: 'instagram', t: 'New colourway, same obsession with detail', s: 'Approved', tone: 'b' },
  { c: 'x', t: 'Hot take: your brand voice is already in your inbox', s: 'Drafting…', tone: 'a' },
  { c: 'facebook', t: 'Thank you for 500 subscribers', s: 'Scheduled Mon', tone: 'c' },
];

function Card({ post }) {
  return (
    <div className={`fc tone-${post.tone}`}>
      <div className="fc-media" />
      <div className="fc-row">
        <span className={`fc-plat ${post.c}`}>
          <BrandLogo name={post.c} />
        </span>
        <span className="fc-status">{post.s}</span>
      </div>
      <div className="fc-text">{post.t}</div>
    </div>
  );
}

function Column({ offset, dir, duration }) {
  const items = [...POSTS.slice(offset), ...POSTS.slice(0, offset)];
  return (
    <div className={`feed-col ${dir}`} style={{ animationDuration: `${duration}s` }}>
      {[...items, ...items].map((p, i) => (
        <Card key={i} post={p} />
      ))}
    </div>
  );
}

export default function PillWord({ onReady }) {
  const word = useRef(null);
  const pill = useRef(null);
  const veil = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const anims = [];
    const start = () => {
      if (cancelled) return;
      const open = getComputedStyle(word.current).getPropertyValue('--open').trim() || '2.35em';
      // The reveal plays in both motion modes (it is the brand moment); only browsers
      // without the Web Animations API jump straight to the final frame.
      if (typeof pill.current.animate !== 'function') {
        pill.current.style.width = open;
        pill.current.style.clipPath = 'inset(0% 0 0% 0 round 999px)';
        word.current.style.gap = '0.085em';
        veil.current.style.opacity = 0;
        onReady?.();
        return;
      }
      const opts = { duration: 2100, fill: 'forwards' };
      // Hairline → slit → circle → stadium (one timeline, per-segment easing)
      anims.push(
        pill.current.animate(
          [
            { width: '0.012em', clipPath: 'inset(50% 0 50% 0 round 999px)', offset: 0, easing: 'cubic-bezier(.22,1,.36,1)' },
            { width: '0.012em', clipPath: 'inset(0% 0 0% 0 round 999px)', offset: 0.14, easing: 'cubic-bezier(.16,1,.3,1)' },
            { width: '0.16em', clipPath: 'inset(0% 0 0% 0 round 999px)', offset: 0.3, easing: 'cubic-bezier(.76,0,.24,1)' },
            { width: 'min(0.78em, ' + open + ')', clipPath: 'inset(0% 0 0% 0 round 999px)', offset: 0.58, easing: 'cubic-bezier(.16,1,.3,1)' },
            { width: open, clipPath: 'inset(0% 0 0% 0 round 999px)', offset: 1 },
          ],
          opts,
        ),
        veil.current.animate(
          [{ opacity: 1, offset: 0 }, { opacity: 1, offset: 0.14 }, { opacity: 0, offset: 0.3 }, { opacity: 0, offset: 1 }],
          opts,
        ),
        word.current.animate(
          [
            { gap: '0.026em', offset: 0 },
            { gap: '0.026em', offset: 0.3, easing: 'cubic-bezier(.16,1,.3,1)' },
            { gap: '0.085em', offset: 1 },
          ],
          opts,
        ),
      );
      // Chrome starts revealing as the pill becomes a circle (~58%).
      setTimeout(() => !cancelled && onReady?.(), 1150);
    };
    // Never trap the page: start after fonts, or after 1.5s regardless.
    const fallback = setTimeout(start, 1500);
    document.fonts?.ready.then(() => {
      clearTimeout(fallback);
      start();
    });
    return () => {
      cancelled = true;
      clearTimeout(fallback);
      anims.forEach((a) => a.cancel());
    };
  }, []);

  return (
    <h1 className="pillword" ref={word} aria-label="Loop">
      <span aria-hidden="true">LO</span>
      <span className="pill" ref={pill} aria-hidden="true">
        <span className="pill-feed">
          <Column offset={0} dir="up" duration={26} />
          <Column offset={3} dir="down" duration={32} />
          <Column offset={5} dir="up" duration={22} />
        </span>
        <span className="pill-veil" ref={veil} />
      </span>
      <span aria-hidden="true">OP</span>
    </h1>
  );
}
