import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { api, fmtDate, PLATFORM_LABEL } from '../api.js';
import { Alert, MediaView, Plat, Spinner, StatusBadge } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';

// Public review page reached from the approval email. Actions require a click here (POST),
// so link-scanning email security tools can never approve a post by prefetching the URL.
export default function Approve() {
  const { token } = useParams();
  const [params] = useSearchParams();
  const intent = params.get('intent');
  const [post, setPost] = useState(null);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [done, setDone] = useState('');
  const [busy, setBusy] = useState(false);
  const feedbackRef = useRef(null);

  useEffect(() => {
    api(`/approvals/${token}`)
      .then((d) => setPost(d.post))
      .catch((err) => setError(err.message));
  }, [token]);

  useEffect(() => {
    if (post && intent === 'changes') feedbackRef.current?.focus();
  }, [post, intent]);

  const act = async (action, body, message) => {
    setBusy(true);
    setError('');
    try {
      const d = await api(`/approvals/${token}/${action}`, { method: 'POST', body });
      setPost(d.post);
      setDone(message);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const open = post?.status === 'pending_approval';

  return (
    <div className="center-page" style={{ alignItems: 'start' }}>
      <div style={{ width: '100%', maxWidth: 760 }} className="stack">
        <div className="brand" style={{ color: 'var(--text)', padding: 0 }}>
          <div className="brand-mark">
            <span className="brand-ring" />
          </div>{' '}
          Loop AI · Post review
        </div>

        {error && <Alert type="error">{error}</Alert>}
        {!post && !error && <Spinner />}

        {post && (
          <>
            <div className="card">
              <div className="row between">
                <div>
                  <div className="muted small">{post.owner} · revision {post.revision}</div>
                  <h1>{post.topic}</h1>
                  <div className="muted">
                    {post.scheduled_for ? `Scheduled for ${fmtDate(post.scheduled_for, post.timezone)}` : 'Publishes as soon as approved'}
                  </div>
                </div>
                <StatusBadge status={post.status} />
              </div>
            </div>

            {done && <Alert type="success">{done}</Alert>}
            {!open && !done && (
              <Alert type="info">
                {post.status === 'approved' && 'This post is approved and scheduled.'}
                {post.status === 'published' && 'This post has been published.'}
                {post.status === 'rejected' && 'This post was rejected.'}
                {['generating', 'changes_requested'].includes(post.status) && 'A new revision is being written. You’ll receive a new email shortly.'}
                {post.status === 'failed' && `Something went wrong: ${post.error}`}
              </Alert>
            )}

            {post.media?.length > 0 && (
              <div className="card">
                <MediaView media={post.media} />
              </div>
            )}

            {Object.entries(post.content || {}).map(([p, text]) =>
              text ? (
                <div key={p} className="card platform-text">
                  <div className="head">
                    <Plat p={p} /> {PLATFORM_LABEL[p]}
                  </div>
                  <pre>{text}</pre>
                </div>
              ) : null,
            )}

            {open && (
              <div className="card stack">
                <div className="row">
                  <button
                    className={`btn success lg ${intent === 'approve' ? '' : ''}`}
                    disabled={busy}
                    onClick={() => act('approve', null, 'Approved! It will be published at the scheduled time.')}
                  >
                    <Icon name="check" size={18} stroke={2.2} /> Approve & schedule
                  </button>
                  <button
                    className="btn lg"
                    disabled={busy}
                    onClick={() => confirm('Reject this post? It will not be published.') && act('reject', null, 'Rejected. This post will not be published.')}
                  >
                    <Icon name="close" size={17} /> Reject
                  </button>
                </div>
                <hr className="divider" />
                <label className="field">
                  <span>Request changes</span>
                </label>
                <textarea
                  ref={feedbackRef}
                  rows={4}
                  placeholder="Tell the AI what to change — tone, length, facts to include, a different image…"
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                />
                <div>
                  <button
                    className="btn primary"
                    disabled={busy || !feedback.trim()}
                    onClick={() => act('changes', { feedback }, 'Got it — Loop AI is revising the post and will email you the new version.')}
                  >
                    <Icon name="pen" size={16} /> Send feedback & revise
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
