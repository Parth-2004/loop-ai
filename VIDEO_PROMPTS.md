# Loop AI — background video prompts

The site already looks complete without footage: the drifting aurora is the fallback. Video is an
upgrade. Drop finished files into `client/public/video/` with the exact names below, run `npm run build`
in `client/`, and they appear automatically. They fade in, loop with a crossfade, and get tinted by the
aurora. If a file is missing, that slot silently falls back to the aurora.

| Slot | File | Where it plays |
|---|---|---|
| Hero | `client/public/video/hero.mp4` | Behind the giant **LO◯OP** wordmark (first screen) |
| CTA | `client/public/video/cta.mp4` | Inside the rounded "Set the schedule. Keep the final say." card |

Use any text-to-video model (Veo 3, Kling, Runway Gen-4, Sora, Luma). Generate **3–4 takes** of each and
keep the calmest one. Motion that's too busy fights the typography.

## House rules (what keeps it from looking like AI slop)

- **One subject, one light source, one slow move.** No morphing, no "particles exploding", no lens-flare spam.
- **Physical materials:** glass, silk, smoke, water, paper. They read as photographed, not rendered.
- **Palette locked to the brand:** night `#07060d`, violet `#8b5cf6`, magenta `#db2777`, a touch of amber `#f59e0b`.
  Ask for it explicitly in every prompt.
- **No text, logos, UI, faces or hands.** The page provides all the words.
- **Leave the centre calm.** The wordmark and headline sit there.
- **Seamless loop**, 8–10 s, 24 fps, 1920×1080, no hard cuts.

---

## 1. Hero — "the loop" (`hero.mp4`)

```
Cinematic macro shot in a pitch-black studio. A single thick ring of clear optical glass, like a
polished glass torus about the size of a dinner plate, floats slightly below and to the right of the
frame centre, tilted 30 degrees, rotating very slowly on its axis (about one quarter turn over the
whole clip). A narrow softbox from the upper left refracts through the glass, throwing violet (#8b5cf6)
and deep magenta (#db2777) caustic light across a faint haze behind it, with a thin warm amber (#f59e0b)
rim highlight on one edge. Shallow depth of field, the far side of the ring softly out of focus. The
upper half and centre of the frame stay dark and calm, almost empty negative space. Extremely slow,
smooth camera push-in, no cuts. Photorealistic, shot on a 100mm macro lens, subtle film grain, deep
blacks, high contrast. No text, no logos, no people. Seamless 8-second loop, 24fps, 16:9, 1920x1080.
```

**Why it fits:** the ring is literally the loop (it echoes the spinning ring in the logo and the
footer), and glass matches the site's liquid-glass UI.

## 2. CTA card — "keep the final say" (`cta.mp4`)

```
Slow-motion close-up of heavy silk fabric in deep violet (#6d28d9) rippling gently in a soft breeze,
lit from below by a warm magenta (#db2777) glow that slowly travels from left to right across the folds.
Rich dark shadows, satin highlights, very slow graceful movement, as calm as breathing. Camera locked
off, no cuts. The centre of the frame is darker and smooth so white text can sit on top. Photorealistic,
85mm lens, shallow depth of field, fine film grain. No text, no logos, no people. Seamless 8-second loop,
24fps, 16:9, 1920x1080.
```

## 3. Optional — mobile hero (portrait)

If you want a tailored phone version, generate prompt 1 again with
`vertical 9:16, 1080x1920, ring positioned in the lower third` and save it as
`client/public/video/hero-mobile.mp4`. Tell me and I'll wire the `<source media>` switch.

---

## Before you drop the files in

Keep each file under about 6 MB so the page stays fast:

```bash
ffmpeg -i hero_raw.mp4 -vf "scale=1920:-2,fps=24" -c:v libx264 -crf 26 -preset slow -an -movflags +faststart hero.mp4
```

```bash
ffmpeg -i cta_raw.mp4 -vf "scale=1600:-2,fps=24" -c:v libx264 -crf 27 -preset slow -an -movflags +faststart cta.mp4
```

`-an` strips audio (the videos are muted anyway) and `+faststart` lets them start playing before they
finish downloading.
