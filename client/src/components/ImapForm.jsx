import { useState } from 'react';
import { api } from '../api.js';
import { Alert, Field } from './ui.jsx';

const PRESETS = {
  gmail: { host: 'imap.gmail.com', port: 993, help: 'Use a Google App Password (Google Account → Security → 2-Step Verification → App passwords).' },
  outlook: { host: 'outlook.office365.com', port: 993, help: 'Use an app password if your account has 2-step verification.' },
  yahoo: { host: 'imap.mail.yahoo.com', port: 993, help: 'Generate an app password in Yahoo account security.' },
  custom: { host: '', port: 993, help: 'Use your provider’s IMAP host. Port 993 (SSL) is standard.' },
};

export default function ImapForm({ connected, onChange }) {
  const [preset, setPreset] = useState('gmail');
  const [form, setForm] = useState({ host: PRESETS.gmail.host, port: 993, user: '', pass: '' });
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const pick = (k) => {
    setPreset(k);
    setForm({ ...form, host: PRESETS[k].host, port: PRESETS[k].port });
  };

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await api('/profile/imap', { method: 'POST', body: form });
      setMsg({ type: 'success', text: 'Mailbox connected. It will be analysed when you build your brand voice.' });
      setForm({ ...form, pass: '' });
      onChange?.(true);
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    await api('/profile/imap', { method: 'DELETE' });
    onChange?.(false);
  };

  if (connected) {
    return (
      <div className="row between">
        <span className="badge published">
          <span className="dot" /> Mailbox connected
        </span>
        <button className="btn sm danger" onClick={disconnect}>
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="stack">
      <p className="muted small">
        Loop AI reads your 25 most recent sent and received emails to learn your writing style and what’s happening in your
        work. Only an AI-written summary is stored — never the raw emails. Credentials are encrypted at rest.
      </p>
      <div className="row">
        {Object.keys(PRESETS).map((k) => (
          <span key={k} className={`chip selectable ${preset === k ? 'on' : ''}`} onClick={() => pick(k)}>
            {k[0].toUpperCase() + k.slice(1)}
          </span>
        ))}
      </div>
      {msg && <Alert type={msg.type}>{msg.text}</Alert>}
      <div className="grid grid-2">
        <Field label="IMAP host">
          <input value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} />
        </Field>
        <Field label="Port">
          <input type="number" value={form.port} onChange={(e) => setForm({ ...form, port: e.target.value })} />
        </Field>
        <Field label="Email address">
          <input value={form.user} onChange={(e) => setForm({ ...form, user: e.target.value })} />
        </Field>
        <Field label="App password" hint={PRESETS[preset].help}>
          <input type="password" value={form.pass} onChange={(e) => setForm({ ...form, pass: e.target.value })} />
        </Field>
      </div>
      <div>
        <button className="btn" disabled={busy || !form.user || !form.pass || !form.host} onClick={save}>
          {busy ? 'Testing connection…' : 'Connect mailbox'}
        </button>
      </div>
    </div>
  );
}
