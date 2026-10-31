import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, browserTz } from '../api.js';
import { useAuth } from '../App.jsx';
import { AudienceFields, IdentityFields, StyleFields } from '../components/ProfileFields.jsx';
import ImapForm from '../components/ImapForm.jsx';
import BrandVoice from '../components/BrandVoice.jsx';
import { Alert, Field, Plat, Spinner } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';

const STEPS = ['About you', 'Audience & goals', 'Style & context', 'Data sources', 'Brand voice'];

export default function Onboarding() {
  const { refresh } = useAuth();
  const nav = useNavigate();
  const [step, setStepRaw] = useState(0);
  const [dir, setDir] = useState('fwd');
  const setStep = (n) => {
    setDir(n < step ? 'back' : 'fwd');
    setStepRaw(n);
  };
  const [p, setP] = useState(null);
  const [conns, setConns] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState(null);

  useEffect(() => {
    api('/profile').then(({ profile }) => {
      setP({ ...profile, timezone: profile.timezone === 'UTC' ? browserTz() : profile.timezone });
      if (profile.brand_voice) setStep(4);
    });
    api('/connections').then((d) => setConns(d.connections));
  }, []);

  if (!p) return <Spinner />;
  const set = (patch) => setP({ ...p, ...patch });

  const save = async () => {
    const { profile } = await api('/profile', { method: 'PUT', body: p });
    setP((cur) => ({ ...cur, ...profile }));
  };

  const next = async () => {
    setError('');
    setBusy(true);
    try {
      await save();
      setStep(step + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const analyze = async () => {
    setError('');
    setBusy(true);
    try {
      await save();
      const res = await api('/profile/analyze', { method: 'POST', body: {} });
      setP(res.profile);
      setReport(res.report);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    await api('/profile', { method: 'PUT', body: { onboarded: true } });
    await refresh();
    nav('/schedules?new=1');
  };

  return (
    <div style={{ maxWidth: 1040 }}>
      <div className="page-head">
        <div>
          <h1>Let’s teach Loop AI your voice</h1>
          <p className="subtitle">A few minutes now means every future post sounds like you.</p>
        </div>
      </div>
      <div className="steps">
        <div className="steps-track">
          <div className="steps-fill" style={{ '--p': `${(step / (STEPS.length - 1)) * 100}%` }} />
        </div>
        {STEPS.map((s, i) => (
          <div key={s} className={`step ${i === step ? 'on' : ''} ${i < step ? 'done' : ''}`}>
            <span className="n">{i < step ? <Icon name="check" size={15} stroke={2.4} /> : i + 1}</span> {s}
          </div>
        ))}
      </div>

      <Alert type="error">{error}</Alert>

      <div className={`card step-panel ${dir === 'back' ? 'back' : ''}`} key={step} style={{ padding: 36 }}>
        {step === 0 && <IdentityFields p={p} set={set} />}
        {step === 1 && <AudienceFields p={p} set={set} />}
        {step === 2 && <StyleFields p={p} set={set} />}
        {step === 3 && (
          <div className="stack">
            <h2>Connect your mailbox (optional)</h2>
            <ImapForm connected={p.imap_connected} onChange={(v) => set({ imap_connected: v })} />
            <hr className="divider" />
            <h2>Connect social accounts</h2>
            <p className="muted">
              Loop AI reads your recent posts to learn what works, and publishes approved posts there. You can also do this later.
            </p>
            <div className="row">
              {conns.map((c) => (
                <span key={c.id} className="chip" style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                  <Plat p={c.platform} size={18} /> {c.account_name}
                </span>
              ))}
              {!conns.length && <span className="muted">No accounts connected yet.</span>}
            </div>
            <div>
              <Link className="btn" to="/connections">
                Manage connected accounts →
              </Link>
            </div>
            <hr className="divider" />
            <Field label="Send approval emails to" hint="Every post is emailed here for approval before it goes live.">
              <input type="email" value={p.approval_email || ''} onChange={(e) => set({ approval_email: e.target.value })} />
            </Field>
          </div>
        )}
        {step === 4 && (
          <div className="stack">
            {!p.brand_voice && !busy && (
              <div className="empty">
                <div className="big">
            <Icon name="sparkle" size={34} stroke={1.4} />
          </div>
                <p>Loop AI will read your website, mailbox and past posts, then write your brand voice guide.</p>
              </div>
            )}
            {busy && (
              <div className="empty">
                <Spinner />
                <p style={{ marginTop: 10 }}>Analysing your website, emails and past posts with Gemini… this can take a minute.</p>
              </div>
            )}
            {report && (
              <Alert type="info">
                Sources — Website: {report.website || 'skipped'} · Email: {report.email || 'skipped'} · Social:{' '}
                {report.social || 'no past posts found'}
              </Alert>
            )}
            {p.brand_voice && !busy && <BrandVoice voice={p.brand_voice} />}
          </div>
        )}
      </div>

      <div className="row" style={{ marginTop: 18 }}>
        {step > 0 && (
          <button className="btn" onClick={() => setStep(step - 1)} disabled={busy}>
            ← Back
          </button>
        )}
        <div className="spacer" />
        {step < 4 && (
          <button className="btn primary" onClick={next} disabled={busy}>
            Continue →
          </button>
        )}
        {step === 4 && (
          <>
            <button className={`btn ${p.brand_voice ? '' : 'primary'}`} onClick={analyze} disabled={busy}>
              <Icon name={p.brand_voice ? 'refresh' : 'sparkle'} size={17} />
              {p.brand_voice ? 'Re-analyse' : 'Build my brand voice'}
            </button>
            {p.brand_voice && (
              <button className="btn primary" onClick={finish} disabled={busy}>
                Looks good — set up my schedule →
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
