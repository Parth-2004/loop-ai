import { Link } from 'react-router-dom';
import Aurora from './Aurora.jsx';
import MotionToggle from '../components/MotionToggle.jsx';
import Icon from '../components/Icon.jsx';
import BgVideo from './BgVideo.jsx';
import './landing.css';

// Shared cinematic frame for sign-in / sign-up: form card on the left, pitch on the right.
export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="landing auth-page ready">
      <BgVideo src="/video/cta-web.mp4" poster="/video/cta-poster.jpg" className="auth-video" />
      <Aurora variant="hero" />
      <MotionToggle className="motion-float" />
      <Link to="/" className="auth-home">
        <span className="l-logo-ring" /> Loop AI
      </Link>
      <div className="auth-grid">
        <div className="auth-card glass" data-tilt="3">
          <h1 className="auth-title">{title}</h1>
          {subtitle && <p className="auth-sub">{subtitle}</p>}
          {children}
          {footer && <p className="auth-foot">{footer}</p>}
        </div>
        <aside className="auth-pitch" aria-hidden="true">
          <p className="auth-quote">
            “Drafted at 7:30, <em>approved</em> over coffee, live by 9:30.”
          </p>
          <div className="auth-steps">
            <span>
              <Icon name="sparkle" size={16} /> Learns your voice
            </span>
            <span>
              <Icon name="image" size={16} /> Writes, designs &amp; schedules
            </span>
            <span>
              <Icon name="mail" size={16} /> Asks you first — every time
            </span>
          </div>
        </aside>
      </div>
    </div>
  );
}
