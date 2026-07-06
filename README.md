# AEM Baltic — scroll-driven showcase

Scroll-scrubbed video preview page for AEM Baltic. Each of the 3–4 background
videos is split into image frames and drawn on a full-screen canvas in sync
with scroll position (the technique Apple uses on product pages — smooth on
iOS where `<video>` scrubbing is not). GSAP ScrollTrigger drives the text
choreography. Static site, deploys to Vercel as-is.

## Status

- ✅ Scroll engine, text animations, loader, mobile layout — done
- ✅ Frame-extraction pipeline (`npm run frames`) — done
- ⏳ Real videos — until they arrive, each scene renders an animated gradient
  placeholder so the page is fully previewable
- ⏳ Brand assets (colors, fonts, logo) — placeholders in
  `src/styles.css` `:root` block
- ⏳ Copy is a first draft — edit in `src/content.js`

## Adding a video

Drop the file in `videos/` (git-ignored), then:

```bash
npm install
npm run frames -- videos/hero.mp4 scene-1
```

This writes `public/frames/scene-1/{desktop,mobile}/frame-XXXX.webp` plus a
`manifest.json`. The scene ids (`scene-1` … `scene-4`) map to entries in
`src/content.js`. Repeat per video, commit the frames, done — the page picks
them up automatically.

**Video guidelines:** 8–15 s per clip, slow continuous motion (glides, morphs,
reveals — not fast cuts), 1920×1080+, key subject center-framed (mobile crops
to 9:16 portrait).

## Develop / build

```bash
npm install
npm run dev       # local dev server
npm run build     # production build to dist/
```

## Deploy

Import the repo at vercel.com — Vite is auto-detected, no config needed.
`vercel.json` adds immutable caching for the frame images.

## Where things live

| What | Where |
|---|---|
| Scene + copy definitions | `src/content.js` |
| Brand colors & fonts | `src/styles.css` (`:root`) |
| Scroll/text choreography | `src/main.js` |
| Canvas frame scrubber + gradient fallback | `src/sequence.js` |
| Frame extraction | `scripts/extract-frames.mjs` |
