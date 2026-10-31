import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, BUSY, fmtDate } from '../api.js';
import { Plat, Spinner, StatusBadge, Thumb } from '../components/ui.jsx';
import NewPostForm from '../components/NewPostForm.jsx';
import Icon from '../components/Icon.jsx';

const TABS = {
  all: { label: 'All', status: '' },
  review: { label: 'Needs review', status: 'pending_approval,changes_requested,generating' },
  scheduled: { label: 'Scheduled', status: 'approved,publishing' },
  published: { label: 'Published', status: 'published' },
  failed: { label: 'Failed', status: 'failed' },
  rejected: { label: 'Rejected', status: 'rejected' },
};

export default function Posts() {
  const [params, setParams] = useSearchParams();
  const tab = TABS[params.get('tab')] ? params.get('tab') : 'all';
  const [posts, setPosts] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const nav = useNavigate();

  useEffect(() => {
    let timer;
    const load = () =>
      api(`/posts${TABS[tab].status ? `?status=${TABS[tab].status}` : ''}`).then((d) => {
        setPosts(d.posts);
        if (d.posts.some((p) => BUSY.includes(p.status))) timer = setTimeout(load, 5000);
      });
    load();
    return () => clearTimeout(timer);
  }, [tab]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Posts</h1>
          <p className="subtitle">Every draft, approval and published post in one place.</p>
        </div>
        <button className="btn primary" onClick={() => setShowNew(!showNew)}>
          {showNew ? 'Close' : '+ New post'}
        </button>
      </div>

      {showNew && (
        <div className="card" style={{ marginBottom: 18 }}>
          <h2>Generate a new post</h2>
          <NewPostForm />
        </div>
      )}

      <div className="tabs">
        {Object.entries(TABS).map(([k, t]) => (
          <button key={k} className={`tab ${tab === k ? 'on' : ''}`} onClick={() => setParams(k === 'all' ? {} : { tab: k })}>
            {t.label}
          </button>
        ))}
      </div>

      {!posts ? (
        <Spinner />
      ) : !posts.length ? (
        <div className="card empty">
          <div className="big">
            <Icon name="posts" size={34} stroke={1.4} />
          </div>
          <p>No posts here yet.</p>
        </div>
      ) : (
        <div className="grid grid-2">
          {posts.map((p) => {
            const preview = Object.values(p.content || {}).find(Boolean);
            return (
              <div key={p.id} className={`card post-card ${BUSY.includes(p.status) ? 'shimmer' : ''}`} data-tilt="4" onClick={() => nav(`/posts/${p.id}`)}>
                <Thumb post={p} />
                <div className="body">
                  <div className="row between" style={{ flexWrap: 'nowrap' }}>
                    <div className="title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.topic || 'Drafting…'}
                    </div>
                    <StatusBadge status={p.status} />
                  </div>
                  <div className="clamp">{preview || (p.status === 'generating' ? 'Gemini is writing this post…' : '')}</div>
                  <div className="row small muted" style={{ marginTop: 8, gap: 6 }}>
                    {p.platforms.map((pl) => (
                      <Plat key={pl} p={pl} size={18} />
                    ))}
                    <span>{p.published_at ? `Published ${fmtDate(p.published_at)}` : p.scheduled_for ? fmtDate(p.scheduled_for) : 'On approval'}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
