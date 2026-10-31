// Site-wide motion preference.
// "full"    → every animation (drifting light, scroll-driven bands, tilt, magnetic buttons).
// "reduced" → gentle fades and the hero reveal only; nothing drifts or scrolls by itself.
// Motion is part of the brand, so it is ON by default; anyone can switch it off with the
// in-page toggle (remembered per browser). Choosing "system" follows the OS setting instead.
const KEY = 'loop-motion';
const media = () => window.matchMedia('(prefers-reduced-motion: reduce)');

export function getMotionPref() {
  try {
    return localStorage.getItem(KEY) || 'on';
  } catch {
    return 'on';
  }
}

export function resolveMotion(pref = getMotionPref()) {
  if (pref === 'on') return 'full';
  if (pref === 'off') return 'reduced';
  return media().matches ? 'reduced' : 'full';
}

export function setMotionPref(pref) {
  try {
    if (pref === 'on') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, pref);
  } catch {
    /* private mode: preference lasts for this page only */
  }
  applyMotion(pref);
}

export function applyMotion(pref = getMotionPref()) {
  document.documentElement.dataset.motion = resolveMotion(pref);
  window.dispatchEvent(new Event('loop-motion'));
}

export const isFullMotion = () => document.documentElement.dataset.motion !== 'reduced';

export function initMotion() {
  applyMotion();
  media().addEventListener?.('change', () => getMotionPref() === 'system' && applyMotion());
}
