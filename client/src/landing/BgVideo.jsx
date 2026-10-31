import { useEffect, useRef, useState } from 'react';

// Optional background footage. Drop a file at client/public/video/<name>.mp4 and it appears;
// if the file is missing the element removes itself and the CSS aurora carries the scene.
// Loops with a soft crossfade so the seam is invisible, and only decodes while on screen.
export default function BgVideo({ src, poster, className = '' }) {
  const ref = useRef(null);
  const [ok, setOk] = useState(true);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const FADE = 600;
    const LEAD = 0.6;
    let raf;
    let fading = false;
    const fadeTo = (to) => {
      cancelAnimationFrame(raf);
      const from = Number(v.style.opacity) || 0;
      const t0 = performance.now();
      const step = (t) => {
        const k = Math.min(1, (t - t0) / FADE);
        v.style.opacity = String(from + (to - from) * k);
        if (k < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    };
    let visible = false;
    const play = () => visible && v.play().catch(() => {});
    const onLoaded = () => {
      play();
      fadeTo(1);
    };
    // Pause decoding whenever the video is scrolled out of view (big win for scroll smoothness).
    // Start only once it is clearly on screen (avoids a decode hitch at the edge of a scroll).
    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible) play();
        else v.pause();
      },
      { threshold: 0.35 },
    );
    io.observe(v);
    const onTime = () => {
      const left = v.duration - v.currentTime;
      if (!fading && left > 0 && left <= LEAD) {
        fading = true;
        fadeTo(0);
      }
    };
    const onEnded = () => {
      v.currentTime = 0;
      play();
      fading = false;
      fadeTo(1);
    };
    v.addEventListener('loadeddata', onLoaded);
    v.addEventListener('timeupdate', onTime);
    v.addEventListener('ended', onEnded);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      v.removeEventListener('loadeddata', onLoaded);
      v.removeEventListener('timeupdate', onTime);
      v.removeEventListener('ended', onEnded);
    };
  }, [ok]);

  if (!ok) return null;
  return (
    <video
      ref={ref}
      className={`bg-video ${className}`}
      src={src}
      poster={poster}
      muted
      playsInline
      preload="auto"
      style={{ opacity: poster ? 1 : 0 }}
      onError={() => setOk(false)}
      aria-hidden="true"
    />
  );
}
