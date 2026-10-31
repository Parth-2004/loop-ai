import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, fmtDate } from '../api.js';
import { useAuth } from '../App.jsx';
import { Alert, Plat, Spinner } from '../components/ui.jsx';

const PROVIDERS = [
  { key: 'x', title: 'X (Twitter)', platforms: ['x'], desc: 'Publish posts with images or video to your X profile.', env: 'X_CLIENT_ID / X_CLIENT_SECRET' },
  { key: 'linkedin', title: 'LinkedIn', platforms: ['linkedin'], desc: 'Post to your profile or to a company page you admin.', env: 'LINKEDIN_CLIENT_ID / LINKEDIN_CLIENT_SECRET' },
  {
    key: 'meta',
    title: 'Facebook & Instagram',
    platforms: ['facebook', 'instagram'],
    desc: 'Facebook Pages and their linked Instagram Business accounts.',
    env: 'META_APP_ID / META_APP_SECRET',
  },
];

function LinkedInAuthor({ conn, onSaved }) {
  const [urn, setUrn] = useState(conn.meta?.authorUrn || '');
  const [err, setErr] = useState('');
  const save = async () => {
    setErr('');
    try {
      await api(`/connections/${conn.id}`, { method: 'PATCH', body: { authorUrn: urn } });
      onSaved();
    } catch (e) {
      setErr(e.message);
    }
  };
  return (
    <div className="stack" style={{ marginTop: 8 }}>
      <div className="row" style={{ flexWrap: 'nowrap' }}>
        <input className="mono" value={urn} onChange={(e) => setUrn(e.target.value)} />
        <button className="btn sm" onClick={save} disabled={urn === conn.meta?.authorUrn}>
          Save
        </button>
      </div>
      <small className="muted">Post as yourself (urn:li:person:…) or a company page (urn:li:organization:ID — requires the Community Management API).</small>
      {err && <small style={{ color: 'var(--red)' }}>{err}</small>}
    </div>
  );
}

export default function Connections() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(params.get('error') || '');
  const connected = params.get('connected');

  const load = () => api('/connections').then(setData);
  useEffect(() => {
    load();
  }, []);

  const connect = async (key) => {
    setError('');
    try {
      const { url } = await api(`/connections/${key}/start`);
      window.location.href = url;
    } catch (err) {
      setError(err.message);
    }
  };

  const remove = async (c) => {
    if (!confirm(`Disconnect ${c.account_name}?`)) return;
    await api(`/connections/${c.id}`, { method: 'DELETE' });
    load();
  };

  if (!data) return <Spinner />;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Connected accounts</h1>
          <p className="subtitle">Loop AI publishes approved posts here and learns from what you posted before.</p>
        </div>
        {!user.onboarded && (
          <Link className="btn primary" to="/onboarding">
            Continue onboarding →
          </Link>
        )}
      </div>

      {connected && (
        <Alert type="success" onClose={() => setParams({})}>
          Connected: {connected}
        </Alert>
      )}
      <Alert type="error" onClose={error ? () => (setError(''), setParams({})) : undefined}>
        {error}
      </Alert>

      <div className="grid grid-3">
        {PROVIDERS.map((p) => {
          const accounts = data.connections.filter((c) => p.platforms.includes(c.platform));
          const ready = data.available[p.key];
          return (
            <div key={p.key} className={`card provider ${p.key}`} data-tilt="5">
              <div className="provider-head">
                <Plat p={p.key === 'meta' ? 'meta' : p.key} />
                <div>
                  <h2>{p.title}</h2>
                  <p>{p.desc}</p>
                </div>
              </div>
              {accounts.map((c) => (
                <div key={c.id} className="provider-account">
                  <div className="row between">
                    <span className="row" style={{ gap: 8 }}>
                      <Plat p={c.platform} size={22} /> <b>{c.account_name}</b>
                    </span>
                    <button className="btn sm danger" onClick={() => remove(c)}>
                      Remove
                    </button>
                  </div>
                  {c.expires_at && <div className="muted small">Token renews {fmtDate(c.expires_at)}</div>}
                  {c.platform === 'linkedin' && <LinkedInAuthor conn={c} onSaved={load} />}
                </div>
              ))}
              <div className="provider-foot">
                {ready ? (
                  <button className="btn primary" onClick={() => connect(p.key)}>
                    {accounts.length ? 'Reconnect / add more' : `Connect ${p.title.split(' ')[0]}`} →
                  </button>
                ) : (
                  <>
                    <span className="badge pending_approval">
                      <span className="dot" /> Setup needed
                    </span>
                    <span className="muted small">Add these app keys to the server’s .env, then restart:</span>
                    <div className="env-keys">
                      {p.env.split(' / ').map((k) => (
                        <code key={k} className="env">
                          {k}
                        </code>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
