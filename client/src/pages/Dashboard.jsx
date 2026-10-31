import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, fmtDate } from '../api.js';
import { CountUp, Plat, Spinner, StatusBadge } from '../components/ui.jsx';
import { useAuth } from '../App.jsx';
import Icon from '../components/Icon.jsx';
import NewPostForm from '../components/NewPostForm.jsx';
import BgVideo from '../landing/BgVideo.jsx';

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? 'Up late' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [health, setHealth] = useState(null);

  useEffect(() => {
    api('/posts/stats').then(setData);
    api('/health').then(setHealth);
  }, []);

  if (!data) return <Spinner />;
  const c = data.counts;
  const stats = [
    { n: c.pending_approval || 0, l: 'Awaiting your approval', to: '/posts?tab=review', icon: 'mail', tint: 't-amber' },
    { n: c.approved || 0, l: 'Approved & scheduled', to: '/posts?tab=scheduled', icon: 'clock', tint: 't-blue' },
    { n: c.published || 0, l: 'Published', to: '/posts?tab=published', icon: 'send', tint: 't-green' },
    { n: c.failed || 0, l: 'Need attention', to: '/posts?tab=failed', icon: 'alert', tint: 't-red' },
  ];

  return (
    <>
      <div className="card hero-banner">
        <BgVideo src="/video/hero-web.mp4" poster="/video/hero-poster.jpg" />
        <h1>
          {greeting()}, {(user.name || 'there').split(' ')[0]}
        </h1>
        <p className="subtitle">
          {data.nextSchedule
            ? `Next scheduled slot: ${data.nextSchedule.name} · ${fmtDate(data.nextSchedule.next_run_at)}`
            : 'No active schedules yet — set one up and Loop starts drafting for you.'}
        </p>
        <div className="row">
          <Link className="btn primary" to={data.nextSchedule ? '/posts?tab=review' : '/schedules?new=1'}>
            {data.nextSchedule ? 'Review drafts' : 'Create a schedule'} <Icon name="send" size={16} />
          </Link>
          <Link className="btn" to="/brand">
            <Icon name="sparkle" size={16} /> Brand voice
          </Link>
        </div>
      </div>

      {health && (!health.gemini || !health.email) && (
        <div className="alert warn">
          {!health.gemini && 'GEMINI_API_KEY is not configured on the server — content generation will fail. '}
          {!health.email && 'No email provider configured (RESEND_API_KEY or SMTP_*) — approval emails are only logged to the server console.'}
        </div>
      )}

      <div className="grid grid-4">
        {stats.map((s) => (
          <Link key={s.l} to={s.to} className={`card stat ${s.tint}`} data-tilt="8" style={{ textDecoration: 'none' }}>
            <span className="stat-ico">
              <Icon name={s.icon} size={19} />
            </span>
            <div className="num">
              <CountUp value={s.n} />
            </div>
            <div className="lbl">{s.l}</div>
          </Link>
        ))}
      </div>

      <div className="grid grid-2" style={{ marginTop: 22, alignItems: 'start' }}>
        <div className="card">
          <h2>Pipeline</h2>
          {!data.upcoming.length && <p className="muted">Nothing in the pipeline. Generate a post or add a schedule.</p>}
          <div className="stack">
            {data.upcoming.map((p) => (
              <Link key={p.id} to={`/posts/${p.id}`} className="row" style={{ color: 'inherit', flexWrap: 'nowrap' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.topic || 'Drafting…'}
                  </div>
                  <div className="row small muted" style={{ gap: 6 }}>
                    {p.platforms.map((pl) => (
                      <Plat key={pl} p={pl} size={18} />
                    ))}
                    {p.scheduled_for ? fmtDate(p.scheduled_for) : 'On approval'}
                  </div>
                </div>
                <StatusBadge status={p.status} />
              </Link>
            ))}
          </div>
        </div>
        <div className="card">
          <h2>Generate a post now</h2>
          <NewPostForm />
        </div>
      </div>
    </>
  );
}
