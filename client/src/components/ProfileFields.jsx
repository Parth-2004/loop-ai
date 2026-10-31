import { Field, TzSelect } from './ui.jsx';
import Icon from './Icon.jsx';

const TONES = ['Professional', 'Friendly', 'Witty', 'Bold', 'Inspirational', 'Educational', 'Casual', 'Authoritative', 'Empathetic', 'Playful'];

export function IdentityFields({ p, set }) {
  const company = p.account_type === 'company';
  return (
    <div className="stack">
      <div className="grid grid-2">
        <button type="button" className={`choice ${!company ? 'on' : ''}`} onClick={() => set({ account_type: 'individual' })}>
          <div className="t">
            <span className="choice-ico">
              <Icon name="user" size={19} />
            </span>
            Individual
          </div>
          <div className="muted">Creator, founder, consultant or professional building a personal brand.</div>
        </button>
        <button type="button" className={`choice ${company ? 'on' : ''}`} onClick={() => set({ account_type: 'company' })}>
          <div className="t">
            <span className="choice-ico">
              <Icon name="building" size={19} />
            </span>
            Company
          </div>
          <div className="muted">A business or organisation marketing its products, services and team.</div>
        </button>
      </div>
      <div className="grid grid-2">
        <Field label={company ? 'Your name' : 'Name shown on posts'}>
          <input value={p.display_name || ''} onChange={(e) => set({ display_name: e.target.value })} />
        </Field>
        {company && (
          <Field label="Company name">
            <input value={p.company_name || ''} onChange={(e) => set({ company_name: e.target.value })} />
          </Field>
        )}
        <Field label="Website" hint="We read it to learn your offering and tone.">
          <input placeholder="https://…" value={p.website || ''} onChange={(e) => set({ website: e.target.value })} />
        </Field>
        <Field label="Industry / niche">
          <input placeholder="e.g. B2B SaaS, fitness coaching, real estate" value={p.industry || ''} onChange={(e) => set({ industry: e.target.value })} />
        </Field>
        <Field label="Timezone" hint="Schedules and approval emails use this timezone.">
          <TzSelect value={p.timezone || 'UTC'} onChange={(timezone) => set({ timezone })} />
        </Field>
      </div>
    </div>
  );
}

export function AudienceFields({ p, set }) {
  const tones = (p.tone || '').split(',').map((t) => t.trim()).filter(Boolean);
  const toggle = (t) => set({ tone: (tones.includes(t) ? tones.filter((x) => x !== t) : [...tones, t]).join(', ') });
  return (
    <div className="stack">
      <Field label="Who is your audience?">
        <textarea placeholder="e.g. Heads of marketing at mid-size e-commerce brands in India and the US" value={p.audience || ''} onChange={(e) => set({ audience: e.target.value })} />
      </Field>
      <Field label="What should social media achieve?">
        <textarea placeholder="e.g. Generate demo requests, grow followers, hire engineers, build thought leadership" value={p.goals || ''} onChange={(e) => set({ goals: e.target.value })} />
      </Field>
      <div>
        <label className="field">
          <span>Tone of voice</span>
        </label>
        {TONES.map((t) => (
          <span key={t} className={`chip selectable ${tones.includes(t) ? 'on' : ''}`} onClick={() => toggle(t)}>
            {t}
          </span>
        ))}
      </div>
      <Field label="Topics to post about" hint="Comma-separated themes. Loop AI rotates through them.">
        <textarea value={p.topics || ''} onChange={(e) => set({ topics: e.target.value })} />
      </Field>
      <Field label="Never mention / avoid">
        <input placeholder="e.g. competitors by name, politics, pricing" value={p.avoid || ''} onChange={(e) => set({ avoid: e.target.value })} />
      </Field>
    </div>
  );
}

export function StyleFields({ p, set }) {
  const company = p.account_type === 'company';
  return (
    <div className="stack">
      <div className="grid grid-2">
        <Field label="Brand colours">
          <input placeholder="e.g. deep navy #0B1F3A, coral #FF6B5B" value={p.brand_colors || ''} onChange={(e) => set({ brand_colors: e.target.value })} />
        </Field>
        <Field label="Visual style for images & videos">
          <input placeholder="e.g. clean flat illustrations, warm lifestyle photography" value={p.visual_style || ''} onChange={(e) => set({ visual_style: e.target.value })} />
        </Field>
      </div>
      <Field label="Example posts" hint="Paste 3–10 posts you wrote or love. This is the strongest signal for matching your voice.">
        <textarea rows={7} value={p.sample_posts || ''} onChange={(e) => set({ sample_posts: e.target.value })} />
      </Field>
      <Field
        label={company ? 'Company context' : 'About you'}
        hint={
          company
            ? 'Products, launches, management priorities, partners or key clients you are allowed to mention, upcoming events.'
            : 'Your story, expertise, current projects, achievements and opinions you want to be known for.'
        }
      >
        <textarea rows={6} value={p.company_notes || ''} onChange={(e) => set({ company_notes: e.target.value })} />
      </Field>
    </div>
  );
}
