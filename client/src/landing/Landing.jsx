import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Aurora from './Aurora.jsx';
import PillWord from './PillWord.jsx';
import MotionToggle from '../components/MotionToggle.jsx';
import Icon from '../components/Icon.jsx';
import BrandLogo from '../components/BrandLogo.jsx';
import BgVideo from './BgVideo.jsx';
import { useScrollFx } from './useScrollFx.js';
import './landing.css';
import './landing-fx.css';

const Arrow = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 17 17 7M8 7h9v9" />
  </svg>
);

// Fades [data-reveal] children in (blur + rise) once, when they scroll into view.
function useReveal() {
  const root = useRef(null);
  useEffect(() => {
    const els = root.current.querySelectorAll('[data-reveal]');
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in');
            io.unobserve(e.target);
          }
        }),
      { threshold: 0.15 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return root;
}

const STEPS = [
  { n: '01', t: 'It learns you', d: 'Your website, recent emails and past posts become a brand voice guide — tone, pillars, do’s and don’ts.' },
  { n: '02', t: 'It drafts', d: 'Gemini writes a native version for every platform, with an image or a Veo video when it helps.' },
  { n: '03', t: 'You approve', d: 'One email. Approve, reject, or reply with changes — Loop rewrites and asks again.' },
  { n: '04', t: 'It publishes', d: 'On your schedule, in your timezone. Hourly, daily, weekly or any cron you like.' },
];

const CAPS = [
  {
    icon: 'inbox',
    tags: ['Website', 'Inbox', 'Past posts'],
    t: 'A voice that’s actually yours',
    d: 'Connect a mailbox and Loop reads what you send and what customers ask — then keeps only the insight, never the emails.',
  },
  {
    icon: 'image',
    tags: ['Gemini', 'Imagen', 'Veo'],
    t: 'Copy, images and video',
    d: 'Platform-native captions with the right length and hashtags, plus on-brand visuals in your colours.',
  },
  {
    icon: 'calendar',
    tags: ['Hourly', 'Weekly', 'Cron'],
    t: 'A schedule you set once',
    d: 'Drafts arrive hours before each slot, so there’s always time to say “not quite” before anything goes live.',
  },
];

const PLATFORMS = [
  [<BrandLogo key="x" name="x" size={13} />, 'X', 'x'],
  [<BrandLogo key="li" name="linkedin" size={14} />, 'LinkedIn', 'linkedin'],
  [<BrandLogo key="ig" name="instagram" size={15} />, 'Instagram', 'instagram'],
  [<BrandLogo key="fb" name="facebook" size={15} />, 'Facebook Pages', 'facebook'],
  [<Icon key="m" name="mail" size={15} />, 'Your inbox', 'inbox'],
  [<Icon key="s" name="sparkle" size={15} />, 'Gemini', 'gemini'],
];
const BAND_WORDS = ['draft', 'approve', 'publish', 'repeat'];

export default function Landing() {
  const [ready, setReady] = useState(false);
  const root = useReveal();
  useScrollFx(root);

  return (
    <div className={`landing ${ready ? 'ready' : ''}`} ref={root}>
      <div className="l-progress" aria-hidden="true">
        <i />
      </div>

      {/* NAV — centered glass pill */}
      <header className="l-nav">
        <a href="#top" className="l-logo glass" aria-label="Loop AI home">
          <span className="l-logo-ring" />
        </a>
        <nav className="l-nav-pill glass">
          <a href="#loop">How it works</a>
          <a href="#approval">Approval</a>
          <a href="#features">Features</a>
          <Link to="/login" className="l-nav-signin">Sign in</Link>
          <Link to="/register" className="l-btn l-btn-white sm magnetic">
            Start free <Arrow />
          </Link>
        </nav>
        <span className="l-nav-spacer" />
      </header>

      <MotionToggle className="motion-float" />

      {/* HERO */}
      <section className="l-hero" id="top">
        <BgVideo src="/video/hero-web.mp4" poster="/video/hero-poster.jpg" className="l-hero-video" />
        <Aurora variant="hero" />
        <div className="l-hero-inner">
          <div className="l-badge glass rise" style={{ '--d': '0s' }}>
            <span className="l-chip">New</span> Approve every post from your inbox
          </div>

          <PillWord onReady={() => setReady(true)} />

          <p className="l-tagline rise" style={{ '--d': '.1s' }}>
            Posts that write themselves. <em>Approved</em> by you.
          </p>
          <p className="l-sub rise" style={{ '--d': '.25s' }}>
            Loop AI learns your voice, drafts posts with images and video for X, LinkedIn, Instagram and Facebook, and
            emails you before anything goes live.
          </p>

          <div className="l-ctas rise" style={{ '--d': '.4s' }}>
            <Link to="/register" className="l-btn l-btn-accent magnetic">
              Put my socials on a loop <Arrow />
            </Link>
            <a href="#loop" className="l-textlink">
              <span className="l-play">
                <Icon name="play" size={12} />
              </span>{' '}
              See the loop
            </a>
          </div>

          <div className="l-stats rise" style={{ '--d': '.55s' }}>
            <div className="glass l-stat" data-tilt="12">
              <span className="l-stat-num">~15s</span>
              <span className="l-stat-lbl">to draft for 4 platforms</span>
            </div>
            <div className="glass l-stat" data-tilt="12">
              <span className="l-stat-num">1 email</span>
              <span className="l-stat-lbl">to approve or revise</span>
            </div>
            <div className="glass l-stat" data-tilt="12">
              <span className="l-stat-num">0</span>
              <span className="l-stat-lbl">posts without your OK</span>
            </div>
          </div>
        </div>
        <div className="l-scroll-hint rise" style={{ '--d': '.8s' }}>
          <span /> Scroll
        </div>
      </section>

      {/* PLATFORM MARQUEE */}
      <section className="l-marquee" aria-label="Works with" data-band="38" data-orient="-1">
        <div className="l-marquee-track">
          {[0, 1].map((half) =>
            [...PLATFORMS, ...PLATFORMS, ...PLATFORMS].map(([g, n, k], i) => (
              <span key={`${half}-${i}`} className={`l-mchip ${k}`}>
                <b>{g}</b> {n}
              </span>
            )),
          )}
        </div>
      </section>

      {/* THE LOOP */}
      <section className="l-section" id="loop">
        <div className="l-kicker" data-reveal>
          // The loop
        </div>
        <h2 className="l-h2" data-reveal style={{ '--d': '.08s' }}>
          Four steps. <em>One</em> of them is yours.
        </h2>
        <div className="l-steps">
          <div className="l-steps-line" aria-hidden="true">
            <i />
          </div>
          {STEPS.map((s, i) => (
            <div key={s.n} className={`l-step ${i === 2 ? 'mine' : ''}`} data-reveal style={{ '--d': `${0.12 * i}s` }}>
              <span className="l-step-n">{s.n}</span>
              <h3>{s.t}</h3>
              <p>{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* APPROVAL SHOWCASE */}
      <section className="l-section l-split" id="approval">
        <div className="l-split-copy">
          <div className="l-kicker" data-reveal>
            // Human in the loop
          </div>
          <h2 className="l-h2" data-reveal style={{ '--d': '.08s' }}>
            Nothing posts <em>until</em> you say so.
          </h2>
          <p className="l-body" data-reveal style={{ '--d': '.16s' }}>
            Every draft lands in your inbox with the copy for each platform and its visual. Approve in one tap, or write
            “mention the 15 Nov launch and the 11am workshop” — Loop revises and sends a fresh version. Older links stop working, so an
            outdated draft can never slip through.
          </p>
          <ul className="l-checks" data-reveal style={{ '--d': '.24s' }}>
            <li>Review links that can’t be approved by email scanners</li>
            <li>Unlimited revision rounds, with full feedback history</li>
            <li>Send approvals to a shared team inbox</li>
          </ul>
        </div>

        <div className="l-mail" data-tilt="6">
          <div className="l-mail-bar">
            <i />
            <i />
            <i />
            <span>Inbox</span>
          </div>
          <div className="l-mail-head">
            <div className="l-mail-from">
              <span className="l-mail-avatar">
                <span className="l-logo-ring" />
              </span>
              <div>
                <b>Loop AI</b>
                <small>[Review] November Subscription Box &amp; Saturday Workshop</small>
              </div>
            </div>
            <span className="l-mail-time">7:30 AM</span>
          </div>
          <div className="l-mail-body">
            <div className="l-mail-visual">
              <span className="l-mail-visual-tag">Pour-over home brewing setup, generated with Gemini</span>
            </div>
            <div className="l-mail-post">
              <span className="fc-plat x">
                <BrandLogo name="x" size={12} />
              </span>
              <p>Nov 15th: Our new subscription box drops! Plus, FREE brewing workshop this Sat, 11 AM in Indiranagar. Link in bio. #BrewlineCoffee</p>
            </div>
            <div className="l-mail-post">
              <span className="fc-plat linkedin">
                <BrandLogo name="linkedin" size={12} />
              </span>
              <p>Get ready to elevate your home coffee game! Our November subscription box launches on November 15th, featuring three single-origin beans from Karnataka estates…</p>
            </div>
            <div className="l-mail-actions">
              <span className="l-mbtn ok">
                <Icon name="check" size={15} stroke={2.4} /> Approve
              </span>
              <span className="l-mbtn edit">
                <Icon name="pen" size={14} /> Request changes
              </span>
              <span className="l-mbtn ghost">Reject</span>
            </div>
          </div>
        </div>
      </section>

      {/* CAPABILITIES */}
      <section className="l-section" id="features">
        <div className="l-kicker" data-reveal>
          // Capabilities
        </div>
        <h2 className="l-h2" data-reveal style={{ '--d': '.08s' }}>
          A whole marketing team, <em>minus</em> the meetings.
        </h2>
        <div className="l-caps">
          {CAPS.map((c, i) => (
            <div key={c.t} data-reveal style={{ '--d': `${0.12 * i}s` }}>
            <article className="l-cap glass" data-tilt="8">
              <div className="l-cap-top">
                <span className="l-cap-icon">
                  <Icon name={c.icon} size={22} />
                </span>
                <div className="l-cap-tags">
                  {c.tags.map((t) => (
                    <span key={t}>{t}</span>
                  ))}
                </div>
              </div>
              <div className="l-cap-bottom">
                <h3>{c.t}</h3>
                <p>{c.d}</p>
              </div>
            </article>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="l-section">
        <div className="l-cta">
          <BgVideo src="/video/cta-web.mp4" poster="/video/cta-poster.jpg" className="l-cta-video" />
          <Aurora variant="cta" />
          <div className="l-cta-inner" data-reveal>
            <h2 className="l-h2">
              Set the schedule. <em>Keep</em> the final say.
            </h2>
            <p>Five minutes of onboarding. Then your next post is already waiting in your inbox.</p>
            <Link to="/register" className="l-btn l-btn-white magnetic">
              Start free <Arrow />
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="l-footer">
        <div className="l-foot glass" data-reveal>
          <div className="l-foot-brand">
            <div className="l-foot-logo">
              <span className="l-logo-ring" /> Loop AI
            </div>
            <p>The social media agent that drafts, designs and schedules — and always asks first.</p>
          </div>
          <div className="l-foot-cols">
            <div>
              <h4>Product</h4>
              <a href="#loop">How it works</a>
              <a href="#approval">Approvals</a>
              <a href="#features">Features</a>
            </div>
            <div>
              <h4>Platforms</h4>
              <span>X</span>
              <span>LinkedIn</span>
              <span>Instagram &amp; Facebook</span>
            </div>
            <div>
              <h4>Account</h4>
              <Link to="/login">Sign in</Link>
              <Link to="/register">Create account</Link>
            </div>
          </div>
          <div className="l-foot-bar">
            <span>© {new Date().getFullYear()} Loop AI</span>
            <span>Powered by Gemini</span>
          </div>
        </div>
      </footer>

      {/* THE LOOP — two bands that slide on their own and follow your scrolling */}
      <div className="l-bands" aria-hidden="true">
        <div className="l-band l-band-outline" data-band="55" data-orient="1">
          <div className="l-band-track">
            {[0, 1].map((half) =>
              [0, 1, 2].flatMap((r) =>
                BAND_WORDS.map((w) => (
                  <span key={`${half}-${r}-${w}`}>
                    {w}
                    <i>
                      <Icon name="asterisk" size={40} stroke={2.6} />
                    </i>
                  </span>
                )),
              ),
            )}
          </div>
        </div>
        <div className="l-band l-band-main" data-band="80" data-orient="-1">
          <div className="l-band-track">
            {[0, 1].map((half) =>
              [0, 1, 2].map((r) => (
                <span key={`${half}-${r}`}>
                  loop
                  <i className="l-band-ring" />
                </span>
              )),
            )}
          </div>
        </div>
      </div>
      <footer className="l-footer-end">
        <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
          <filter id="glass-type" x="-10%" y="-10%" width="120%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#000" floodOpacity=".35" result="drop" />
            <feOffset in="SourceAlpha" dy="4" result="off" />
            <feGaussianBlur in="off" stdDeviation="4" result="offb" />
            <feComposite in="SourceAlpha" in2="offb" operator="out" result="hi" />
            <feFlood floodColor="#fff" floodOpacity=".35" />
            <feComposite in2="hi" operator="in" result="hiC" />
            <feGaussianBlur in="SourceAlpha" stdDeviation="6" result="edge" />
            <feComposite in="SourceAlpha" in2="edge" operator="out" result="edgeO" />
            <feFlood floodColor="#000" floodOpacity=".3" />
            <feComposite in2="edgeO" operator="in" result="edgeC" />
            <feMerge>
              <feMergeNode in="drop" />
              <feMergeNode in="SourceGraphic" />
              <feMergeNode in="hiC" />
              <feMergeNode in="edgeC" />
            </feMerge>
          </filter>
        </svg>
      </footer>
    </div>
  );
}
