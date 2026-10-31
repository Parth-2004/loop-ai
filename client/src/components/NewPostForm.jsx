import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, fromLocalInput } from '../api.js';
import { Alert, Field, Plat } from './ui.jsx';
import Icon from './Icon.jsx';

export default function NewPostForm() {
  const nav = useNavigate();
  const [conns, setConns] = useState([]);
  const [form, setForm] = useState({ topic: '', brief: '', media_type: 'auto', connection_ids: [], scheduled_for: '', require_approval: true });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api('/connections').then((d) => {
      setConns(d.connections);
      setForm((f) => ({ ...f, connection_ids: d.connections.map((c) => c.id) }));
    });
  }, []);

  const toggle = (id) =>
    setForm({ ...form, connection_ids: form.connection_ids.includes(id) ? form.connection_ids.filter((x) => x !== id) : [...form.connection_ids, id] });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { post } = await api('/posts', { method: 'POST', body: { ...form, scheduled_for: fromLocalInput(form.scheduled_for) } });
      nav(`/posts/${post.id}`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <form className="stack" onSubmit={submit}>
      <Alert type="error">{error}</Alert>
      <Field label="Topic (optional)" hint="Leave blank and Loop AI picks the best topic from your content pillars.">
        <input placeholder="e.g. Announce our new mobile app" value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} />
      </Field>
      <div className="grid grid-2">
        <Field label="Media">
          <select value={form.media_type} onChange={(e) => setForm({ ...form, media_type: e.target.value })}>
            <option value="auto">Let AI decide</option>
            <option value="image">Image</option>
            <option value="video">Video (Veo, takes a few minutes)</option>
            <option value="none">Text only</option>
          </select>
        </Field>
        <Field label="Publish at" hint="Empty = publish as soon as approved.">
          <input type="datetime-local" value={form.scheduled_for} onChange={(e) => setForm({ ...form, scheduled_for: e.target.value })} />
        </Field>
      </div>
      {conns.length > 0 && (
        <div>
          <label className="field">
            <span>Post to</span>
          </label>
          <div className="row">
            {conns.map((c) => (
              <label key={c.id} className="check">
                <input type="checkbox" checked={form.connection_ids.includes(c.id)} onChange={() => toggle(c.id)} />
                <Plat p={c.platform} size={20} /> {c.account_name}
              </label>
            ))}
          </div>
        </div>
      )}
      <label className="check">
        <input type="checkbox" checked={form.require_approval} onChange={(e) => setForm({ ...form, require_approval: e.target.checked })} />
        Email me for approval before publishing
      </label>
      <div>
        <button className="btn primary" disabled={busy}>
          {!busy && <Icon name="sparkle" size={17} />}
          {busy ? 'Starting…' : 'Generate post'}
        </button>
      </div>
    </form>
  );
}
