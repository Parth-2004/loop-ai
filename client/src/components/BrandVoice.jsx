import Icon from './Icon.jsx';

export default function BrandVoice({ voice }) {
  if (!voice) return null;
  const List = ({ title, items, icon, tone }) =>
    items?.length ? (
      <div>
        <h3 className={`vlist-title ${tone || ''}`}>
          {icon && <Icon name={icon} size={17} stroke={2} />}
          {title}
        </h3>
        <ul className="clean">
          {items.map((i, n) => (
            <li key={i} className="pop" style={{ '--i': n }}>
              {i}
            </li>
          ))}
        </ul>
      </div>
    ) : null;

  return (
    <div className="stack">
      <p style={{ fontSize: 15 }}>{voice.summary}</p>
      <div>
        {(voice.tone_attributes || []).map((t, n) => (
          <span key={t} className="chip pop" style={{ '--i': n }}>
            {t}
          </span>
        ))}
      </div>
      <div>
        <h3>Voice</h3>
        <p className="muted">{voice.voice}</p>
      </div>
      <div>
        <h3>Content pillars</h3>
        {(voice.content_pillars || []).map((t, n) => (
          <span key={t} className="chip pop" style={{ background: 'var(--blue-soft)', color: 'var(--blue)', borderColor: 'rgba(96,165,250,.25)', '--i': n + 5 }}>
            {t}
          </span>
        ))}
      </div>
      <div className="grid grid-2">
        <List title="Do" icon="check" items={voice.do} />
        <List title="Don’t" icon="close" tone="dont" items={voice.dont} />
      </div>
      <div className="grid grid-2">
        {voice.audience && (
          <div>
            <h3>Audience</h3>
            <p className="muted">{voice.audience}</p>
          </div>
        )}
        {voice.visual_style && (
          <div>
            <h3>Visual style</h3>
            <p className="muted">{voice.visual_style}</p>
          </div>
        )}
        {voice.hashtag_strategy && (
          <div>
            <h3>Hashtags</h3>
            <p className="muted">{voice.hashtag_strategy}</p>
          </div>
        )}
        {voice.emoji_usage && (
          <div>
            <h3>Emoji</h3>
            <p className="muted">{voice.emoji_usage}</p>
          </div>
        )}
      </div>
      <List title="Hooks in your voice" items={voice.sample_hooks} />
    </div>
  );
}
