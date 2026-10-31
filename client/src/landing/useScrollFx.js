import { useEffect } from 'react';
import { isFullMotion } from '../motion.js';

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const easeOut = (t) => 1 - (1 - t) ** 3;

/**
 * One rAF clock for every scroll-linked effect on the landing page:
 *  - [data-band] marquees: drift on their own, speed up with scroll velocity, follow scroll direction,
 *    and lean (skew) into fast scrolls — the "loop" bands in the footer and the platform strip.
 *  - top progress bar, steps timeline drawing, inbox card settling into place.
 *  (Hero parallax and CTA scaling were removed: moving glass over playing video re-blurs every frame.)
 *
 * Performance rules (this runs every frame):
 *  - READ everything first (scrollY + rects), THEN write — never interleave, so the browser never
 *    has to recalculate layout mid-frame.
 *  - Only touch elements that are on screen (IntersectionObserver flags) and only when a value changes.
 *  - Writes are transforms/opacity/custom properties only (compositor-friendly).
 */
export function useScrollFx(rootRef) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const $ = (s) => root.querySelector(s);

    const bands = [...root.querySelectorAll('[data-band]')].map((el) => ({
      el,
      track: el.firstElementChild,
      speed: Number(el.dataset.band) || 60,
      orient: Number(el.dataset.orient) || -1,
      x: 0,
      half: 0,
      on: false,
      last: '',
    }));
    const measure = () => bands.forEach((b) => (b.half = b.track.scrollWidth / 2));
    measure();
    document.fonts?.ready.then(measure);
    window.addEventListener('resize', measure);

    const progress = $('.l-progress i');
    const heroSection = $('.l-hero');
    const steps = $('.l-steps');
    const stepEls = steps ? [...steps.querySelectorAll('.l-step')] : [];
    const mail = $('.l-mail');

    // Visibility flags — off-screen elements cost nothing.
    const seen = new Map();
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          seen.set(e.target, e.isIntersecting);
          const band = bands.find((b) => b.el === e.target);
          if (band) band.on = e.isIntersecting;
          if (e.target === heroSection) root.classList.toggle('hero-off', !e.isIntersecting);
        }),
      { rootMargin: '120px 0px' },
    );
    [...bands.map((b) => b.el), heroSection, steps, mail].filter(Boolean).forEach((el) => io.observe(el));
    const visible = (el) => el && seen.get(el);

    let last = performance.now();
    let lastY = window.scrollY;
    let vel = 0;
    let dir = 1;
    let skew = 0;
    const prev = { y: -1, stepsP: -1, mailQ: -1 };
    let raf;

    const frame = (t) => {
      // ---------- READ ----------
      const dt = Math.min(50, t - last) || 16;
      last = t;
      const y = window.scrollY;
      const vh = window.innerHeight;
      const H = document.documentElement.scrollHeight - vh;
      const full = isFullMotion();
      const stepsRect = visible(steps) ? steps.getBoundingClientRect() : null;
      const mailRect = full && visible(mail) ? mail.getBoundingClientRect() : null;

      // ---------- COMPUTE ----------
      const dy = y - lastY;
      lastY = y;
      vel += ((dy / dt) * 1000 - vel) * (1 - Math.exp((-dt / 1000) * 5));
      if (Math.abs(dy) > 0.5) dir = dy > 0 ? 1 : -1;
      const targetSkew = full ? clamp(vel * 0.0045, -9, 9) : 0;
      skew += (targetSkew - skew) * (1 - Math.exp((-dt / 1000) * 8));

      // ---------- WRITE ----------
      if (y !== prev.y && progress) progress.style.transform = `scaleX(${H > 0 ? clamp(y / H).toFixed(4) : 0})`;

      for (const b of bands) {
        if (!b.half || !b.on) continue;
        if (full) {
          const boost = Math.min(Math.abs(vel) * 0.45, 1600);
          b.x += (b.speed + boost) * (dt / 1000) * dir * b.orient;
        }
        b.x = (((b.x % b.half) + b.half) % b.half) - b.half;
        const tr = `translate3d(${b.x.toFixed(1)}px,0,0) skewX(${(-skew * b.orient).toFixed(2)}deg)`;
        if (tr !== b.last) {
          b.track.style.transform = tr;
          b.last = tr;
        }
      }


      if (stepsRect) {
        const p = Math.round(clamp((vh * 0.82 - stepsRect.top) / (stepsRect.height + vh * 0.3)) * 1000) / 1000;
        if (p !== prev.stepsP) {
          steps.style.setProperty('--p', p);
          stepEls.forEach((s, i) => s.classList.toggle('lit', p >= (i + 0.25) / stepEls.length));
          prev.stepsP = p;
        }
      }

      if (mailRect) {
        const q = Math.round(easeOut(clamp((vh - mailRect.top) / (vh * 0.85))) * 500) / 500;
        if (q !== prev.mailQ) {
          mail.style.setProperty('--mail-r', `${(7 - 8.2 * q).toFixed(2)}deg`);
          mail.style.setProperty('--mail-y', `${((1 - q) * 80).toFixed(1)}px`);
          mail.style.opacity = String(clamp(q * 1.6));
          prev.mailQ = q;
        }
      } else if (!full && mail && prev.mailQ !== 1) {
        mail.style.opacity = '1';
        prev.mailQ = 1;
      }


      prev.y = y;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [rootRef]);
}
