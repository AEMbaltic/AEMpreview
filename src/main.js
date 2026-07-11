import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { scenes } from './content.js';
import { FrameSequence } from './sequence.js';
import { initFluid } from './fluid.js';
import { initCursor } from './cursor.js';
import { initContactForm } from './form.js';

gsap.registerPlugin(ScrollTrigger);

// Warm ember tones pulled from the logo's brick red, one pair per scene.
const ACCENTS = [
  ['rgba(217,104,68,0.45)', 'rgba(138,51,36,0.5)'],
  ['rgba(179,69,40,0.5)', 'rgba(230,140,80,0.3)'],
  ['rgba(150,40,28,0.5)', 'rgba(217,104,68,0.35)'],
  ['rgba(230,120,70,0.4)', 'rgba(120,32,22,0.55)'],
];

const app = document.getElementById('app');
const loader = document.getElementById('loader');
const loaderFill = document.getElementById('loader-fill');
const scrollHint = document.getElementById('scroll-hint');

function splitWords(el) {
  const words = el.textContent.trim().split(/\s+/);
  el.textContent = '';
  for (const w of words) {
    const wrap = document.createElement('span');
    wrap.className = 'word';
    const inner = document.createElement('span');
    inner.textContent = w;
    wrap.appendChild(inner);
    el.appendChild(wrap);
    el.appendChild(document.createTextNode(' '));
  }
  return el.querySelectorAll('.word > span');
}

function buildScene(scene, index) {
  const section = document.createElement('section');
  section.className = 'scene';
  section.id = scene.isContact ? 'contact' : `s${index}`;
  section.innerHTML = `<div class="scene-viewport"></div>`;
  const viewport = section.querySelector('.scene-viewport');

  const textEls = scene.texts.map((t) => {
    const div = document.createElement('div');
    div.className = 'scene-text';
    div.innerHTML = `<div class="scene-text-inner">
      ${t.eyebrow ? `<div class="eyebrow">${t.eyebrow}</div>` : ''}
      ${t.heading ? `<h2>${t.heading}</h2>` : ''}
      ${t.body ? `<p class="body">${t.body}</p>` : ''}
      ${t.cta ? `<a class="cta" href="${t.cta.href}">${t.cta.label}</a>` : ''}
      ${t.note ? `<div class="cta-note">${t.note}</div>` : ''}
    </div>`;
    viewport.appendChild(div);
    return div;
  });

  let track = null;
  if (scene.hscroll) {
    track = document.createElement('div');
    track.className = 'hscroll-track';
    track.innerHTML = scene.hscroll.items
      .map(
        (c) => `<div class="hscroll-card">
          <div class="hscroll-card-inner">
            <div class="card-face card-front">
              <div class="num">${c.num}</div>
              <h4>${c.title}</h4>
              <div class="flip-hint">+</div>
            </div>
            <div class="card-face card-back">
              <div class="num">${c.num}</div>
              <p>${c.body}</p>
            </div>
          </div>
        </div>`
      )
      .join('');
    viewport.appendChild(track);
    // touch devices have no hover — tap toggles the flip
    track.querySelectorAll('.hscroll-card').forEach((card) =>
      card.addEventListener('click', () => card.classList.toggle('flipped'))
    );
  }

  app.appendChild(section);
  return { section, textEls, track };
}

const stage = document.getElementById('stage');

function animateScene(scene, { section, textEls, track }, index) {
  const seq = new FrameSequence(stage, scene.id, ACCENTS[index % ACCENTS.length]);
  seq.active = index === 0;
  seq.init();

  // One shared timeline per scene, padded to duration 1 so tween positions
  // map 1:1 to scene scroll progress. Each block rises in at `at` and
  // drifts out at `out` (or holds to the end if `out` is omitted).
  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: section,
      start: 'top top',
      end: 'bottom bottom',
      scrub: 0.4,
      invalidateOnRefresh: true,
    },
  });
  tl.set({}, {}, 1); // pad: timeline duration = 1 = full scene scroll

  if (track) {
    gsap.set(track, { yPercent: -50 });
    tl.fromTo(
      track,
      { x: () => window.innerWidth },
      { x: () => -track.scrollWidth, ease: 'none', duration: scene.hscroll.to - scene.hscroll.from },
      scene.hscroll.from
    );
  }

  scene.texts.forEach((t, i) => {
    const el = textEls[i];
    const heading = el.querySelector('h2');
    const wordSpans = heading ? splitWords(heading) : null;

    tl.set(el, { autoAlpha: 0 }, 0)
      .to(el, { autoAlpha: 1, duration: 0.001 }, t.at);

    if (wordSpans) {
      tl.fromTo(
        wordSpans,
        { yPercent: 110 },
        { yPercent: 0, stagger: 0.012, duration: 0.1, ease: 'power3.out' },
        t.at
      );
    }
    const rest = el.querySelectorAll('.eyebrow, .body, .cta');
    if (rest.length) {
      tl.fromTo(
        rest,
        { y: 40, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, stagger: 0.03, duration: 0.1, ease: 'power2.out' },
        t.at + 0.02
      );
    }

    if (t.out != null) {
      tl.to(el, { autoAlpha: 0, y: -60, duration: 0.06, ease: 'power2.in' }, t.out);
    }
  });

  return seq;
}

function buildFooter() {
  const footer = document.createElement('footer');
  footer.className = 'site-footer';
  footer.innerHTML = `
    <div>© ${new Date().getFullYear()} AEM Baltic</div>
    <div><a href="mailto:aksels@aembaltic.com">aksels@aembaltic.com</a></div>`;
  app.appendChild(footer);
}

const built = scenes.map((scene, i) => animateScene(scene, buildScene(scene, i), i));
buildFooter();

// --- stage renderer -------------------------------------------------------
// The shared canvas is driven by one deterministic resolver instead of
// per-scene trigger events: any scroll position maps to exactly one scene
// and a frame progress, so instant jumps (anchor links, scrollbar drags,
// fast flicks) can never leave a stale scene on screen. Scenes scrub over
// their full height — the next scene takes over precisely where the
// previous ends, and the clips' matching end/start frames make the handoff
// seamless. The last scene finishes within its pinned range so the finale
// is reachable before the page runs out of scroll.
const sections = [...document.querySelectorAll('.scene')];

function renderStage() {
  const y = window.scrollY;
  let idx = 0;
  for (let i = 0; i < sections.length; i++) {
    if (y >= sections[i].offsetTop) idx = i;
  }
  const s = sections[idx];
  const isLast = idx === sections.length - 1;
  const runway = isLast ? s.offsetHeight - window.innerHeight : s.offsetHeight;
  const progress = Math.min(1, Math.max(0, (y - s.offsetTop) / runway));
  built.forEach((seq, i) => (seq.active = i === idx));
  built[idx].render(progress);
}

window.addEventListener('scroll', renderStage, { passive: true });
window.addEventListener('resize', renderStage);
renderStage();

// --- cursor-reactive layer (fluid trail, custom cursor, text parallax) ---
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (!reducedMotion) {
  const fluidCanvas = document.createElement('canvas');
  fluidCanvas.id = 'fluid-canvas';
  document.body.appendChild(fluidCanvas);
  if (!initFluid(fluidCanvas)) fluidCanvas.remove(); // no WebGL2 → no effect

  initCursor();

  // Text blocks drift subtly toward the pointer (desktop only).
  if (window.matchMedia('(pointer: fine)').matches) {
    const target = { x: 0, y: 0 };
    let px = 0;
    let py = 0;
    window.addEventListener(
      'pointermove',
      (e) => {
        target.x = (e.clientX / innerWidth) * 2 - 1;
        target.y = (e.clientY / innerHeight) * 2 - 1;
      },
      { passive: true }
    );
    const inners = document.querySelectorAll('.scene-text-inner');
    gsap.ticker.add(() => {
      px += (target.x - px) * 0.05;
      py += (target.y - py) * 0.05;
      const t = `translate(${px * 22}px, ${py * 14}px)`;
      inners.forEach((el) => (el.style.transform = t));
    });
  }
}

// Loader: waits for first frame of scene 1 (or instantly on fallback).
let fakeProgress = 0;
const loaderTick = setInterval(() => {
  fakeProgress = Math.min(fakeProgress + 0.2, 1);
  loaderFill.style.width = `${fakeProgress * 100}%`;
  if (fakeProgress >= 1 && built[0].ready) {
    clearInterval(loaderTick);
    loader.classList.add('done');
  }
}, 120);

// Hide scroll hint once the user starts scrolling.
window.addEventListener(
  'scroll',
  () => {
    scrollHint.style.opacity = window.scrollY > 80 ? '0' : '1';
  },
  { passive: true }
);

// Both "Start a project" buttons open the contact form modal.
initContactForm();

// Keep ScrollTrigger measurements fresh after orientation changes.
window.addEventListener('orientationchange', () => setTimeout(() => ScrollTrigger.refresh(), 300));
