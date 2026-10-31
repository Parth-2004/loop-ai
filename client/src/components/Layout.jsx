import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../App.jsx';
import MotionToggle from './MotionToggle.jsx';
import Icon from './Icon.jsx';
import Aurora from '../landing/Aurora.jsx';

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: 'grid', end: true },
  { to: '/posts', label: 'Posts', icon: 'posts', countKey: 'pending_approval' },
  { to: '/schedules', label: 'Schedules', icon: 'calendar' },
  { to: '/connections', label: 'Accounts', icon: 'link' },
  { to: '/brand', label: 'Brand voice', icon: 'sparkle' },
  { to: '/settings', label: 'Settings', icon: 'sliders' },
];
const ONBOARDING_NAV = [
  { to: '/onboarding', label: 'Onboarding', icon: 'sparkle' },
  { to: '/connections', label: 'Accounts', icon: 'link' },
];

export default function Layout() {
  const { user, setUser } = useAuth();
  const [counts, setCounts] = useState({});
  const nav = useNavigate();
  const loc = useLocation();

  useEffect(() => {
    if (!user.onboarded) return;
    api('/posts/stats')
      .then((d) => setCounts(d.counts))
      .catch(() => {});
  }, [loc.pathname, user.onboarded]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [loc.pathname]);

  const logout = async () => {
    await api('/auth/logout', { method: 'POST' });
    setUser(null);
    nav('/login');
  };

  return (
    <div className="app">
      <div className="app-bg" aria-hidden="true">
        <Aurora variant="hero" />
      </div>
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <span className="brand-ring" />
          </div>
          Loop AI
        </div>
        {(user.onboarded ? NAV : ONBOARDING_NAV).map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className="nav-link">
            <span className="nav-ico">
              <Icon name={n.icon} size={19} />
            </span> {n.label}
            {n.countKey && counts[n.countKey] ? <span className="nav-count">{counts[n.countKey]}</span> : null}
          </NavLink>
        ))}
        <div className="sidebar-footer">
          <MotionToggle />
          <div className="who" title={user.email}>
            {user.email}
          </div>
          <button className="btn sm" onClick={logout}>
            <Icon name="logout" size={15} /> Sign out
          </button>
        </div>
      </aside>
      <main className="main">
        {/* Keyed by path so every page plays its entry choreography */}
        <div className="page" key={loc.pathname}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
