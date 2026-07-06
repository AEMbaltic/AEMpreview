// Scene definitions: one entry per background video.
// `id` must match the folder name under public/frames/<id>/ produced by
// `npm run frames -- videos/<file> <id>`. Until frames exist, each scene
// renders an animated gradient fallback so the page is always previewable.
//
// Draft copy for AEM Baltic — edit freely. Brand colors/fonts are in
// src/styles.css under the :root block.

// Each text block: `at` = scene scroll progress (0–1) where it flows in,
// `out` = where it flows away. Omit `out` to keep it until the scene ends.
export const scenes = [
  {
    id: 'scene-1',
    texts: [
      {
        at: 0.08,
        out: 0.55,
        eyebrow: 'Digital Marketing Agency — Baltics & beyond',
        heading: 'We make brands impossible to ignore.',
        body: 'AEM Baltic turns attention into growth — strategy, creative and media that move numbers, not just impressions.',
      },
      {
        at: 0.68,
        out: 0.94,
        heading: 'Keep scrolling. This is what we do.',
      },
    ],
  },
  {
    id: 'scene-2',
    texts: [
      {
        at: 0.1,
        out: 0.5,
        eyebrow: 'What we do',
        heading: 'Full-funnel. Full throttle.',
      },
      {
        at: 0.6,
        out: 0.94,
        heading: 'Strategy · Media · Creative',
        body: 'Performance marketing, social & content, SEO & data, brand campaigns. From first scroll to final sale, we run the whole journey.',
      },
    ],
  },
  {
    id: 'scene-3',
    texts: [
      {
        at: 0.1,
        out: 0.55,
        eyebrow: 'Creative & production',
        heading: 'Creative that stops thumbs.',
      },
      {
        at: 0.65,
        out: 0.94,
        body: 'Work like this page — built to be felt, not skimmed. If it made you scroll, imagine what it does for your customers.',
      },
    ],
  },
  {
    id: 'scene-4',
    isContact: true,
    texts: [
      {
        at: 0.25,
        eyebrow: 'Ready when you are',
        heading: 'Your brand could live here.',
        body: 'Let’s build something people can’t scroll past.',
        cta: { label: 'Start a project', href: 'mailto:hello@aembaltic.com' },
      },
    ],
  },
];
