import { useEffect, useState } from 'react';
import { api } from '../api.js';
import ImapForm from '../components/ImapForm.jsx';
import { Alert, Field, Spinner, TzSelect } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';

export default function Settings() {
  const [p, setP] = useState(null);
  const [health, setHealth] = useState(null);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    api('/profile').then((d) => setP(d.profile));
    api('/health').then(setHealth);
  }, []);

  if (!p) return <Spinner />;

  const save = async () => {
    try {
      const { profile } = await api('/profile', { method: 'PUT', body: { approval_email: p.approval_email, timezone: p.timezone } });
      setP(profile);
      setMsg({ type: 'success', text: 'Settings saved.' });
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Settings</h1>
          <p className="subtitle">Approvals, mailbox and system status.</p>
        </div>
      </div>
      {msg && <Alert type={msg.type} onClose={() => setMsg(null)}>{msg.text}</Alert>}

      <div className="card stack">
        <h2>Approvals</h2>
        <div className="grid grid-2">
          <Field label="Approval emails go to" hint="Use a shared inbox (e.g. marketing@company.com) so your team can approve.">
            <input type="email" value={p.approval_email || ''} onChange={(e) => setP({ ...p, approval_email: e.target.value })} />
          </Field>
          <Field label="Timezone">
            <TzSelect value={p.timezone} onChange={(timezone) => setP({ ...p, timezone })} />
          </Field>
        </div>
        <div>
          <button className="btn primary" onClick={save}>
            Save
          </button>
        </div>
      </div>

      <div className="card stack">
        <h2>Mailbox (for tailoring)</h2>
        <ImapForm connected={p.imap_connected} onChange={(v) => setP({ ...p, imap_connected: v })} />
      </div>

      {health && (
        <div className="card">
          <h2>System status</h2>
          <ul className="clean">
            <li className="status-line">
              <Icon name={health.gemini ? 'checkCircle' : 'xCircle'} size={17} className={health.gemini ? 'ok' : 'bad'} />
              Gemini API: {health.gemini ? 'configured' : 'GEMINI_API_KEY missing'}
            </li>
            <li className="status-line">
              <Icon name={health.email ? 'checkCircle' : 'alert'} size={17} className={health.email ? 'ok' : 'warn'} />
              Email delivery: {health.email ? 'configured' : 'not configured (emails are logged only)'}
            </li>
            <li className="mono">
              text: {health.models.textModel} · image: {health.models.imageModel} · video: {health.models.videoModel}
            </li>
          </ul>
        </div>
      )}
    </>
  );
}
