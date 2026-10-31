import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, BUSY, CHAR_LIMIT, fmtDate, fromLocalInput, PLATFORM_LABEL, toLocalInput } from '../api.js';
import { Alert, MediaView, Plat, Spinner, StatusBadge } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';

export default function PostDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [post, setPost] = useState(null);
  const [conns, setConns] = useState([]);
  const [draft, setDraft] = useState({});
  const [when, setWhen] = useState('');
  const [targets, setTargets] = useState([]);
  const [feedback, setFeedback] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const hydrate = (p) => {
    setPost(p);
    setDraft(p.content || {});
    setWhen(toLocalInput(p.scheduled_for));
    setTargets(p.connection_ids || []);
  };

  useEffect(() => {
    api('/connections').then((d) => setConns(d.connections));
  }, []);

  useEffect(() => {
    let timer;
    const load = () =>
      api(`/posts/${id}`)
        .then(({ post: p }) => {
          hydrate(p);
          if (BUSY.includes(p.status)) timer = setTimeout(load, 4000);
        })
        .catch((err) => setMsg({ type: 'error', text: err.message }));
    load();
    return () => clearTimeout(timer);
  }, [id]);

  const act = async (fn, success) => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fn();
      if (res?.post) {
        hydrate(res.post);
        // Keep polling while work happens in the background.
        if (BUSY.includes(res.post.status) || res.post.status === 'approved') {
          const poll = async () => {
            const { post: p } = await api(`/posts/${id}`);
            hydrate(p);
            if (BUSY.includes(p.status) || (p.status === 'approved' && new Date(p.scheduled_for) <= new Date())) setTimeout(poll, 4000);
          };
          setTimeout(poll, 3000);
        }
      }
      if (success) setMsg({ type: 'success', text: success });
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  };

  if (!post) return msg ? <Alert type="error">{msg.text}</Alert> : <Spinner />;

  const locked = ['generating', 'publishing', 'published', 'changes_requested'].includes(post.status);
  const dirty =
    JSON.stringify(draft) !== JSON.stringify(post.content || {}) ||
    when !== toLocalInput(post.scheduled_for) ||
    JSON.stringify(targets) !== JSON.stringify(post.connection_ids || []);

  const save = () =>
    act(
      () => api(`/posts/${id}`, { method: 'PUT', body: { content: draft, scheduled_for: fromLocalInput(when), connection_ids: targets } }),
      'Changes saved',
    );

  return (
    <>
      <div className="page-head">
        <div>
          <Link to="/posts" className="small">
            ← All posts
          </Link>
          <h1 style={{ marginTop: 6 }}>{post.topic || 'Drafting your post…'}</h1>
          <div className="row">
            <StatusBadge status={post.status} />
            <span className="muted small">
              Revision {post.revision} · {post.scheduled_for ? `Scheduled ${fmtDate(post.scheduled_for)}` : 'Publishes on approval'}
            </span>
          </div>
        </div>
        <div className="row">
          {['pending_approval', 'failed', 'draft'].includes(post.status) && (
            <button className="btn success" disabled={busy || dirty} onClick={() => act(() => api(`/posts/${id}/approve`, { method: 'POST' }), 'Approved — it will publish at the scheduled time.')}>
              <Icon name="check" size={17} stroke={2.2} /> Approve
            </button>
          )}
          {!locked && post.status !== 'rejected' && (
            <button
              className="btn primary"
              disabled={busy || dirty}
              onClick={() => confirm('Publish to all selected accounts right now?') && act(() => api(`/posts/${id}/publish`, { method: 'POST' }), 'Publishing…')}
            >
              <Icon name="send" size={17} /> Publish now
            </button>
          )}
        </div>
      </div>

      {msg && <Alert type={msg.type} onClose={() => setMsg(null)}>{msg.text}</Alert>}
      {post.error && <Alert type={post.status === 'failed' ? 'error' : 'warn'}>{post.error}</Alert>}
      {post.status === 'generating' && (
        <Alert type="info">
          <span className="row">
            <Spinner /> Gemini is writing copy and creating media. Videos can take a few minutes.
          </span>
        </Alert>
      )}
      {post.status === 'changes_requested' && (
        <Alert type="info">
          <span className="row">
            <Spinner /> Applying your feedback… a fresh approval email will be sent when the new revision is ready.
          </span>
        </Alert>
      )}

      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <div className="stack">
          {Object.keys(draft).map((p) => {
            const len = (draft[p] || '').length;
            return (
              <div key={p} className={`platform-text card ${['generating', 'changes_requested'].includes(post.status) ? 'shimmer' : ''}`} style={{ padding: 20 }}>
                <div className="head">
                  <Plat p={p} /> {PLATFORM_LABEL[p]}
                  <span className={`counter ${len > CHAR_LIMIT[p] ? 'over' : ''}`}>
                    {len}/{CHAR_LIMIT[p]}
                  </span>
                </div>
                <textarea rows={p === 'x' ? 4 : 9} disabled={locked} value={draft[p] || ''} onChange={(e) => setDraft({ ...draft, [p]: e.target.value })} />
              </div>
            );
          })}
          {post.hashtags?.length > 0 && (
            <div>
              {post.hashtags.map((h) => (
                <span key={h} className="chip">
                  #{h}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="stack">
          <div className="card">
            <div className="row between">
              <h2 style={{ margin: 0 }}>Media</h2>
              {!locked && (
                <button className="btn sm" disabled={busy} onClick={() => act(() => api(`/posts/${id}/regenerate`, { method: 'POST', body: { media: true } }), 'Regenerating…')}>
                  <Icon name="refresh" size={15} /> New visuals & copy
                </button>
              )}
            </div>
            <div style={{ marginTop: 12 }}>
              {post.media?.length ? <MediaView media={post.media} /> : <p className="muted">Text-only post.</p>}
              {post.media_prompt && <p className="muted small" style={{ marginTop: 8 }}>Prompt: {post.media_prompt}</p>}
            </div>
          </div>

          <div className="card stack">
            <h2 style={{ margin: 0 }}>Publishing</h2>
            <label className="field">
              <span>Publish at</span>
              <input type="datetime-local" disabled={locked} value={when} onChange={(e) => setWhen(e.target.value)} />
            </label>
            <div>
              <label className="field">
                <span>Accounts</span>
              </label>
              {!conns.length && (
                <p className="muted">
                  No accounts connected. <Link to="/connections">Connect one</Link>.
                </p>
              )}
              <div className="stack">
                {conns.map((c) => (
                  <label key={c.id} className="check">
                    <input
                      type="checkbox"
                      disabled={locked}
                      checked={targets.includes(c.id)}
                      onChange={() => setTargets(targets.includes(c.id) ? targets.filter((x) => x !== c.id) : [...targets, c.id])}
                    />
                    <Plat p={c.platform} size={20} /> {c.account_name}
                    {!draft[c.platform] && <span className="muted small">(no {PLATFORM_LABEL[c.platform]} copy — regenerate to add)</span>}
                  </label>
                ))}
              </div>
            </div>
            {dirty && (
              <div className="row">
                <button className="btn primary" disabled={busy} onClick={save}>
                  Save changes
                </button>
                <button className="btn ghost" onClick={() => hydrate(post)}>
                  Discard
                </button>
              </div>
            )}
          </div>

          {!locked && post.status !== 'rejected' && (
            <div className="card stack">
              <h2 style={{ margin: 0 }}>Ask the AI for changes</h2>
              <textarea
                placeholder="e.g. Make it shorter, mention our webinar on Friday, use a brighter image with a laptop"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
              />
              <div className="row">
                <button
                  className="btn primary"
                  disabled={busy || !feedback.trim()}
                  onClick={() =>
                    act(() => api(`/posts/${id}/regenerate`, { method: 'POST', body: { feedback } }), 'Revision requested').then(() => setFeedback(''))
                  }
                >
                  <Icon name="pen" size={16} /> Revise with feedback
                </button>
                {post.status === 'pending_approval' && (
                  <button className="btn" disabled={busy} onClick={() => act(() => api(`/posts/${id}/send-approval`, { method: 'POST' }), 'Approval email sent')}>
                    <Icon name="mail" size={16} /> Resend approval email
                  </button>
                )}
              </div>
            </div>
          )}

          {Object.keys(post.publish_results || {}).length > 0 && (
            <div className="card">
              <h2>Results</h2>
              <div className="stack">
                {Object.values(post.publish_results).map((r) => (
                  <div key={r.platform + r.account} className="row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
                    <Plat p={r.platform} size={20} />
                    <div style={{ minWidth: 0 }}>
                      <b>{r.account}</b> —{' '}
                      {r.ok ? (
                        <>
                          <span className="status-line">
                            <Icon name="checkCircle" size={16} className="ok" /> Published
                            {r.url && (
                              <a href={r.url} target="_blank" rel="noreferrer" className="status-line">
                                view post <Icon name="external" size={13} />
                              </a>
                            )}
                          </span>
                        </>
                      ) : (
                        <span className="status-line" style={{ color: 'var(--red)', wordBreak: 'break-word', alignItems: 'flex-start' }}>
                          <Icon name="xCircle" size={16} className="bad" /> {r.error}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {post.feedback_history?.length > 0 && (
            <div className="card">
              <h2>Feedback history</h2>
              <ul className="clean">
                {post.feedback_history.map((f, i) => (
                  <li key={i}>
                    <span className="muted small">Rev {f.revision} · {fmtDate(f.at)}:</span> {f.feedback}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="row">
            {!['published', 'publishing', 'rejected'].includes(post.status) && (
              <button className="btn danger sm" disabled={busy} onClick={() => act(() => api(`/posts/${id}/reject`, { method: 'POST' }), 'Post rejected')}>
                Reject
              </button>
            )}
            <button
              className="btn danger sm"
              disabled={busy}
              onClick={async () => {
                if (!confirm('Delete this post permanently?')) return;
                await api(`/posts/${id}`, { method: 'DELETE' });
                nav('/posts');
              }}
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
