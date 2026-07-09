# AEM Baltic — scroll-driven showcase

Live scroll-scrubbed video site for AEM Baltic (deployed at x.aembaltic.com).
Four background videos are split into image frames and drawn on a single
full-screen canvas in sync with scroll position (the technique Apple uses on
product pages — smooth on iOS where `<video>` scrubbing is not). GSAP
ScrollTrigger drives the text choreography; a WebGL fluid simulation renders
the cursor smoke trail. Static site, no backend, deploys to Vercel as-is.

## Architecture in 60 seconds

- **One shared `#stage` canvas** (fixed, behind everything) renders the
  active scene's frame. `renderStage()` in `src/main.js` maps any scroll
  position to exactly one scene + frame progress — deterministic, so fast
  jumps can never desync the background. Scene handoffs are seamless because
  each video's last frame matches the next video's first frame (they were
  generated that way — keep doing this for new clips).
- **Scenes** are transparent 320vh sections (260vh mobile) that act as
  scroll runways; each has a sticky viewport holding only the text layers,
  animated by a per-scene GSAP timeline padded to duration 1 so tween
  positions map 1:1 to scene progress (`at` / `out` in `src/content.js`).
- **Frames** live in `public/frames/<scene-id>/{desktop,mobile}/` as WebP
  (1920px wide / 900px 9:16 center-crop) with a `manifest.json`. They load
  progressively (every 8th, 4th, 2nd, then all) so scrubbing works early.
  If a scene has no frames, an animated gradient fallback renders instead.
- **Cursor layer**: `src/fluid.js` is a compact WebGL2 stable-fluids sim
  (splat → vorticity → pressure projection → advection) blended over the
  page with `mix-blend-mode: screen`. `src/cursor.js` adds the dot+ring
  cursor and magnetic CTA buttons. All of it degrades gracefully (no
  WebGL2 / touch / reduced-motion).
- **Contact form** (`src/form.js`): modal opened by both "Start a project"
  buttons; submits via FormSubmit's AJAX endpoint to `aksels@aembaltic.com`
  (honeypot field for spam). NOTE: FormSubmit needs a one-time activation —
  the first live submission emails a confirmation link to that inbox;
  inquiries are only delivered after it's clicked.

## Develop / build

```bash
npm install
npm run dev       # local dev server
npm run build     # production build to dist/
```

## Adding / replacing a scene video

Drop the file in `videos/` (git-ignored), then:

```bash
npm run frames -- videos/clip.mp4 scene-1        # ffmpeg required on PATH
npm run frames -- videos/clip.mp4 scene-1 -- --fps 24 --quality 68
```

This writes both frame variants plus `manifest.json`; commit them. Scene ids
(`scene-1` … `scene-4`) map to entries in `src/content.js`.

**Video guidelines:** ~6–15 s per clip, slow continuous motion (glides,
morphs, reveals — not fast cuts), 4K or 1080p+, key subject center-framed
(mobile crops to 9:16). For seamless scene transitions, generate each clip
so it starts on the exact frame the previous clip ends on.

## Deploy

Vercel, auto-detected Vite build. `vercel.json` adds immutable caching for
frame images. Production currently deploys from branch
`claude/jolly-lamport-flu900`.

## Where things live

| What | Where |
|---|---|
| Scene + copy definitions (texts, timings, CTA) | `src/content.js` |
| Brand colors & fonts | `src/styles.css` (`:root`) |
| Stage renderer, text choreography, parallax | `src/main.js` |
| Canvas frame scrubber + gradient fallback | `src/sequence.js` |
| WebGL fluid cursor trail | `src/fluid.js` |
| Custom cursor + magnetic buttons | `src/cursor.js` |
| Contact form modal (FormSubmit) | `src/form.js` |
| Frame extraction pipeline | `scripts/extract-frames.mjs` |
| Logo (single-color PNG used as CSS mask) | `public/logo-aem-baltic.png` |

## Improvement ideas / known trade-offs

- Frames total ~87 MB; they preload for all scenes on page load. Lazy
  per-scene loading (start a scene's preload when the previous scene is
  entered) would cut initial bandwidth a lot on mobile.
- `mailto:` fallback on the finale CTA is vestigial — the modal intercepts
  the click; safe to repoint if the email changes.
- The fluid sim runs at a fixed 128/512 resolution; tune `SIM_RES` /
  `DYE_RES` in `src/fluid.js` if low-end devices struggle.
