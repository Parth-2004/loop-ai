import { createContext, useContext, useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { api } from './api.js';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Onboarding from './pages/Onboarding.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Posts from './pages/Posts.jsx';
import PostDetail from './pages/PostDetail.jsx';
import Schedules from './pages/Schedules.jsx';
import Connections from './pages/Connections.jsx';
import Brand from './pages/Brand.jsx';
import Settings from './pages/Settings.jsx';
import Approve from './pages/Approve.jsx';
import Landing from './landing/Landing.jsx';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

function Protected({ children }) {
  const { user } = useAuth();
  const loc = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  const allowedBeforeOnboarding = ['/onboarding', '/connections'];
  if (!user.onboarded && !allowedBeforeOnboarding.includes(loc.pathname)) return <Navigate to="/onboarding" replace />;
  return children;
}

export default function App() {
  const [user, setUser] = useState(undefined);

  const refresh = () =>
    api('/auth/me')
      .then((d) => setUser(d.user))
      .catch(() => setUser(null));

  useEffect(() => {
    refresh();
  }, []);

  if (user === undefined) {
    return (
      <div className="center-page">
        <span className="spinner" />
      </div>
    );
  }

  return (
    <AuthCtx.Provider value={{ user, setUser, refresh }}>
      <Routes>
        <Route path="/" element={user ? <Navigate to="/dashboard" replace /> : <Landing />} />
        <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <Login />} />
        <Route path="/register" element={user ? <Navigate to="/dashboard" /> : <Register />} />
        <Route path="/approve/:token" element={<Approve />} />
        <Route
          element={
            <Protected>
              <Layout />
            </Protected>
          }
        >
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/posts" element={<Posts />} />
          <Route path="/posts/:id" element={<PostDetail />} />
          <Route path="/schedules" element={<Schedules />} />
          <Route path="/connections" element={<Connections />} />
          <Route path="/brand" element={<Brand />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </AuthCtx.Provider>
  );
}
