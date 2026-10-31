import { useEffect, useState } from 'react';
import { api, fmtDate } from '../api.js';
import BrandVoice from '../components/BrandVoice.jsx';
import { AudienceFields, IdentityFields, StyleFields } from '../components/ProfileFields.jsx';
import { Alert, Spinner } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';

export default function Brand() {
  const [p, setP] = useState(null);
  const [tab, setTab] = useState('voice');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [rawVoice, setRawVoice] = useState('');

  useEffect(() => {
    api('/profile').then(({ profile }) => {
      setP(profile);
      setRawVoice(JSON.stringify(profile.brand_voice || {}, null, 2));
    });
  }, []);

  if (!p) return <Spinner />;
  const set = (patch) => setP({ ...p, ...patch });

  const run = async (fn, success) => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fn();
      if (res.profile) {
        setP(res.profile);
        setRawVoice(JSON.stringify(res.profile.brand_voice || {}, null, 2));
      }
      setMsg({
        type: 'success',
        text: res.report
          ? `${success} Website: ${res.report.website || 'skipped'} · Email: ${res.report.email || 'skipped'} · Social: ${res.report.social || 'no past posts'}`
          : success,
      });
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  };

  const saveProfile = () => run(() => api('/profile', { method: 'PUT', body: p }), 'Profile saved.');
  const reanalyze = () =>
    run(async () => {
      await api('/profile', { method: 'PUT', body: p });
      return api('/profile/analyze', { method: 'POST', body: {} });
    }, 'Brand voice rebuilt.');
  const saveRaw = () =>
    run(() => {
      const voice = JSON.parse(rawVoice);
      return api('/profile', { method: 'PUT', body: { brand_voice: voice } });
    }, 'Brand voice updated.');

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Brand voice</h1>
          <p className="subtitle">
            Every post is written from this guide. {p.analyzed_at && `Last analysed ${fmtDate(p.analyzed_at)}.`}
          </p>
        </div>
        <button className="btn primary" onClick={reanalyze} disabled={busy}>
          {!busy && <Icon name="refresh" size={17} />}
          {busy ? 'Working…' : 'Re-analyse all sources'}
        </button>
      </div>

      {msg && <Alert type={msg.type} onClose={() => setMsg(null)}>{msg.text}</Alert>}

      <div className="tabs">
        {[
          ['voice', 'Voice guide'],
          ['profile', 'Profile & inputs'],
          ['insights', 'Source insights'],
          ['raw', 'Advanced'],
        ].map(([k, l]) => (
          <button key={k} className={`tab ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>
            {l}
          </button>
        ))}
      </div>

      {tab === 'voice' && <div className="card">{p.brand_voice ? <BrandVoice voice={p.brand_voice} /> : <p className="muted">Not analysed yet.</p>}</div>}

      {tab === 'profile' && (
        <div className="stack">
          <div className="card">
            <IdentityFields p={p} set={set} />
          </div>
          <div className="card">
            <AudienceFields p={p} set={set} />
          </div>
          <div className="card">
            <StyleFields p={p} set={set} />
          </div>
          <div className="row">
            <button className="btn primary" disabled={busy} onClick={saveProfile}>
              Save profile
            </button>
            <button className="btn" disabled={busy} onClick={reanalyze}>
              Save & rebuild voice
            </button>
          </div>
        </div>
      )}

      {tab === 'insights' && (
        <div className="stack">
          {[
            ['Website summary', p.website_summary],
            ['Email insights', p.email_insights],
            ['Past social posts', p.social_insights],
          ].map(([t, v]) => (
            <div key={t} className="card">
              <h2>{t}</h2>
              <p className="muted" style={{ whiteSpace: 'pre-wrap' }}>
                {v || 'Nothing analysed yet.'}
              </p>
            </div>
          ))}
        </div>
      )}

      {tab === 'raw' && (
        <div className="card stack">
          <p className="muted">Fine-tune the guide directly. This JSON is injected into every generation prompt.</p>
          <textarea className="mono" rows={22} value={rawVoice} onChange={(e) => setRawVoice(e.target.value)} />
          <div>
            <button className="btn primary" disabled={busy} onClick={saveRaw}>
              Save voice JSON
            </button>
          </div>
        </div>
      )}
    </>
  );
}
