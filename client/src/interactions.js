// Global pointer interactions shared by the landing page and the app.
//  - .card / .glass / [data-spot]  → a soft light follows the cursor (--mx / --my)
//  - [data-tilt="6"]               → 3D tilt toward the cursor (--rx / --ry), max N degrees
//  - .magnetic                     → leans toward the cursor (--tx / --ty)
//  - .btn / .l-btn / [data-ripple] → ink ripple from the click point
// One rAF-throttled pointermove listener drives everything; elements reset when the cursor leaves.
import { isFullMotion } from './motion.js';

const SPOT = '.card, .glass, [data-spot]';

function clear(el, props) {
  if (el) props.forEach((p) => el.style.removeProperty(p));
}

export function installInteractions() {
  let raf = 0;
  let spot = null;
  let tilt = null;
  let mag = null;

  const update = (e) => {
    const t = e.target instanceof Element ? e.target : null;
    const full = isFullMotion();

    const s = t?.closest(SPOT) || null;
    if (spot && spot !== s) clear(spot, ['--mx', '--my']);
    if (s) {
      const r = s.getBoundingClientRect();
      s.style.setProperty('--mx', `${e.clientX - r.left}px`);
      s.style.setProperty('--my', `${e.clientY - r.top}px`);
    }
    spot = s;

    const tl = full ? t?.closest('[data-tilt]') || null : null;
    if (tilt && tilt !== tl) clear(tilt, ['--rx', '--ry']);
    if (tl) {
      const r = tl.getBoundingClientRect();
      const max = Number(tl.dataset.tilt) || 6;
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      tl.style.setProperty('--ry', `${(px * max).toFixed(2)}deg`);
      tl.style.setProperty('--rx', `${(-py * max).toFixed(2)}deg`);
    }
    tilt = tl;

    const m = full ? t?.closest('.magnetic, .btn.primary, .btn.success') || null : null;
    if (mag && mag !== m) clear(mag, ['--tx', '--ty']);
    if (m) {
      const r = m.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      m.style.setProperty('--tx', `${(dx * 0.22).toFixed(1)}px`);
      m.style.setProperty('--ty', `${(dy * 0.32).toFixed(1)}px`);
    }
    mag = m;
  };

  document.addEventListener(
    'pointermove',
    (e) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => update(e));
    },
    { passive: true },
  );

  // Cursor left the window: release everything.
  document.addEventListener('mouseout', (e) => {
    if (e.relatedTarget) return;
    clear(spot, ['--mx', '--my']);
    clear(tilt, ['--rx', '--ry']);
    clear(mag, ['--tx', '--ty']);
    spot = tilt = mag = null;
  });

  // Click ripple.
  document.addEventListener('pointerdown', (e) => {
    const b = e.target instanceof Element ? e.target.closest('.btn, .l-btn, [data-ripple]') : null;
    if (!b || b.disabled) return;
    const r = b.getBoundingClientRect();
    const size = Math.max(r.width, r.height) * 2.2;
    const dot = document.createElement('span');
    dot.className = 'ripple';
    dot.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
    b.appendChild(dot);
    dot.addEventListener('animationend', () => dot.remove());
  });
}
