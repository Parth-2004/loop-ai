import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, fmtDate } from '../api.js';
import { Alert, Field, Plat, Spinner, TzSelect } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const LEAD = [
  [0, 'At posting time (no lead)'],
  [30, '30 minutes before'],
  [60, '1 hour before'],
  [120, '2 hours before'],
  [360, '6 hours before'],
  [720, '12 hours before'],
  [1440, '1 day before'],
  [2880, '2 days before'],
];

const blank = (tz, conns) => ({
  name: 'Weekday thought leadership',
  frequency: 'daily',
  every_hours: 4,
  time_of_day: '09:30',
  days_of_week: [1, 3, 5],
  cron: '0 9 * * 1-5',
  timezone: tz,
  connection_ids: conns.map((c) => c.id),
  content_brief: '',
  media_type: 'auto',
  require_approval: true,
  lead_minutes: 120,
  active: true,
});

function ScheduleForm({ initial, conns, onSaved, onCancel }) {
  const [s, setS] = useState(initial);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (patch) => setS({ ...s, ...patch });
  const toggleDay = (d) => set({ days_of_week: s.days_of_week.includes(d) ? s.days_of_week.filter((x) => x !== d) : [...s.days_of_week, d] });
  const toggleConn = (id) =>
    set({ connection_ids: s.connection_ids.includes(id) ? s.connection_ids.filter((x) => x !== id) : [...s.connection_ids, id] });

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = s.id
        ? await api(`/schedules/${s.id}`, { method: 'PUT', body: s })
        : await api('/schedules', { method: 'POST', body: s });
      onSaved(res.schedule);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="card stack" onSubmit={save}>
      <h2>{s.id ? 'Edit schedule' : 'New schedule'}</h2>
      <Alert type="error">{error}</Alert>
      <div className="grid grid-2">
        <Field label="Name">
          <input value={s.name} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <Field label="Frequency">
          <select value={s.frequency} onChange={(e) => set({ frequency: e.target.value })}>
            <option value="hourly">Hourly</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="custom">Custom (cron)</option>
          </select>
        </Field>
        {s.frequency === 'hourly' && (
          <Field label="Every N hours">
            <input type="number" min={1} max={23} value={s.every_hours} onChange={(e) => set({ every_hours: e.target.value })} />
          </Field>
        )}
        {['daily', 'weekly', 'hourly'].includes(s.frequency) && (
          <Field label={s.frequency === 'hourly' ? 'Minute past the hour' : 'Time'} hint={s.frequency === 'hourly' ? 'Only the minutes are used.' : undefined}>
            <input type="time" value={s.time_of_day} onChange={(e) => set({ time_of_day: e.target.value })} />
          </Field>
        )}
        {s.frequency === 'custom' && (
          <Field label="Cron expression" hint="minute hour day-of-month month day-of-week — e.g. 0 9 * * 1-5">
            <input className="mono" value={s.cron || ''} onChange={(e) => set({ cron: e.target.value })} />
          </Field>
        )}
        <Field label="Timezone">
          <TzSelect value={s.timezone} onChange={(timezone) => set({ timezone })} />
        </Field>
      </div>
      {s.frequency === 'weekly' && (
        <div>
          <label className="field">
            <span>Days</span>
          </label>
          {DAYS.map((d, i) => (
            <span key={d} className={`chip selectable ${s.days_of_week.includes(i) ? 'on' : ''}`} onClick={() => toggleDay(i)}>
              {d}
            </span>
          ))}
        </div>
      )}
      <div>
        <label className="field">
          <span>Post to</span>
        </label>
        {!conns.length ? (
          <p className="muted">
            No accounts connected yet — <Link to="/connections">connect accounts</Link>. Drafts will still be generated for review.
          </p>
        ) : (
          <div className="row">
            {conns.map((c) => (
              <label key={c.id} className="check">
                <input type="checkbox" checked={s.connection_ids.includes(c.id)} onChange={() => toggleConn(c.id)} />
                <Plat p={c.platform} size={20} /> {c.account_name}
              </label>
            ))}
          </div>
        )}
      </div>
      <Field label="Content brief" hint="What this schedule should focus on. Leave blank to rotate through your brand’s content pillars.">
        <textarea
          placeholder="e.g. Share one practical tip for small-business owners each day; promote our free audit on Fridays"
          value={s.content_brief || ''}
          onChange={(e) => set({ content_brief: e.target.value })}
        />
      </Field>
      <div className="grid grid-2">
        <Field label="Media">
          <select value={s.media_type} onChange={(e) => set({ media_type: e.target.value })}>
            <option value="auto">Let AI decide</option>
            <option value="image">Always an image</option>
            <option value="video">Always a video</option>
            <option value="none">Text only</option>
          </select>
        </Field>
        <Field label="Draft & email for approval" hint="How long before posting time the draft is created.">
          <select value={s.lead_minutes} onChange={(e) => set({ lead_minutes: Number(e.target.value) })}>
            {LEAD.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <label className="check">
        <input type="checkbox" checked={s.require_approval} onChange={(e) => set({ require_approval: e.target.checked })} />
        Require my approval by email before publishing (recommended)
      </label>
      <label className="check">
        <input type="checkbox" checked={s.active} onChange={(e) => set({ active: e.target.checked })} />
        Active
      </label>
      <div className="row">
        <button className="btn primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save schedule'}
        </button>
        <button type="button" className="btn ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function Schedules() {
  const [params, setParams] = useSearchParams();
  const [list, setList] = useState(null);
  const [conns, setConns] = useState([]);
  const [tz, setTz] = useState('UTC');
  const [editing, setEditing] = useState(null);
  const [msg, setMsg] = useState('');
  const nav = useNavigate();

  const load = () => api('/schedules').then((d) => setList(d.schedules));

  useEffect(() => {
    Promise.all([api('/connections'), api('/profile'), load()]).then(([c, p]) => {
      setConns(c.connections);
      setTz(p.profile.timezone);
      if (params.get('new')) {
        setEditing(blank(p.profile.timezone, c.connections));
        setParams({});
      }
    });
  }, []);

  if (!list) return <Spinner />;

  const toggle = async (s) => {
    await api(`/schedules/${s.id}`, { method: 'PUT', body: { ...s, active: !s.active } });
    load();
  };
  const remove = async (s) => {
    if (!confirm(`Delete schedule "${s.name}"?`)) return;
    await api(`/schedules/${s.id}`, { method: 'DELETE' });
    load();
  };
  const runNow = async (s) => {
    const { post } = await api(`/schedules/${s.id}/run`, { method: 'POST' });
    nav(`/posts/${post.id}`);
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Schedules</h1>
          <p className="subtitle">Loop AI drafts a post before each slot, emails you to approve, then publishes on time.</p>
        </div>
        {!editing && (
          <button className="btn primary" onClick={() => setEditing(blank(tz, conns))}>
            + New schedule
          </button>
        )}
      </div>

      {msg && <Alert type="success" onClose={() => setMsg('')}>{msg}</Alert>}

      {editing && (
        <div style={{ marginBottom: 18 }}>
          <ScheduleForm
            initial={editing}
            conns={conns}
            onCancel={() => setEditing(null)}
            onSaved={(s) => {
              setEditing(null);
              setMsg(`Saved. Next post: ${fmtDate(s.next_run_at, s.timezone)} (${s.timezone}).`);
              load();
            }}
          />
        </div>
      )}

      {!list.length && !editing ? (
        <div className="card empty">
          <div className="big">
            <Icon name="calendar" size={34} stroke={1.4} />
          </div>
          <p>No schedules yet. Create one to put your social media on autopilot.</p>
        </div>
      ) : (
        <div className="stack">
          {list.map((s) => (
            <div key={s.id} className="card">
              <div className="row between">
                <div>
                  <div className="row">
                    <h2 style={{ margin: 0 }}>{s.name}</h2>
                    <span className={`badge ${s.active ? 'published' : ''}`}>{s.active ? 'Active' : 'Paused'}</span>
                    {s.require_approval && <span className="badge approved">Approval required</span>}
                  </div>
                  <div className="muted" style={{ marginTop: 4 }}>
                    {s.label} · {s.timezone} · media: {s.media_type}
                    {s.active && s.next_run_at && <> · next: <b>{fmtDate(s.next_run_at, s.timezone)}</b></>}
                  </div>
                  <div className="row" style={{ marginTop: 8, gap: 6 }}>
                    {conns
                      .filter((c) => s.connection_ids.includes(c.id))
                      .map((c) => (
                        <span key={c.id} className="row small" style={{ gap: 4 }}>
                          <Plat p={c.platform} size={18} /> {c.account_name}
                        </span>
                      ))}
                  </div>
                  {s.content_brief && <p className="muted small" style={{ marginTop: 8 }}>Brief: {s.content_brief}</p>}
                </div>
                <div className="row">
                  <button className="btn sm" onClick={() => runNow(s)}>
                    <Icon name="sparkle" size={15} /> Draft one now
                  </button>
                  <button className="btn sm" onClick={() => toggle(s)}>
                    {s.active ? 'Pause' : 'Resume'}
                  </button>
                  <button className="btn sm" onClick={() => setEditing(s)}>
                    Edit
                  </button>
                  <button className="btn sm danger" onClick={() => remove(s)}>
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
