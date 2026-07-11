// Custom cursor (dot + lagging ring) and magnetic pull on CTA buttons.
// Only activates on precise pointers — touch devices keep native behavior.

import gsap from 'gsap';

const MAGNET_RADIUS = 110;
const MAGNET_PULL = 0.35;

export function initCursor() {
  if (!window.matchMedia('(pointer: fine)').matches) return;
  document.documentElement.classList.add('has-custom-cursor');

  const dot = document.createElement('div');
  dot.className = 'cursor-dot';
  const ring = document.createElement('div');
  ring.className = 'cursor-ring';
  document.body.append(dot, ring);

  let mx = innerWidth / 2;
  let my = innerHeight / 2;
  let rx = mx;
  let ry = my;
  let hovering = false;
  let scale = 1;

  const magnets = [...document.querySelectorAll('.header-cta, .cta')].map((el) => ({
    el,
    qx: gsap.quickTo(el, 'x', { duration: 0.35, ease: 'power3' }),
    qy: gsap.quickTo(el, 'y', { duration: 0.35, ease: 'power3' }),
  }));

  window.addEventListener(
    'pointermove',
    (e) => {
      mx = e.clientX;
      my = e.clientY;
      dot.style.transform = `translate(${mx}px, ${my}px) translate(-50%, -50%)`;

      for (const m of magnets) {
        const r = m.el.getBoundingClientRect();
        const cx = r.left + r.width / 2 - (gsap.getProperty(m.el, 'x') || 0);
        const cy = r.top + r.height / 2 - (gsap.getProperty(m.el, 'y') || 0);
        const dx = mx - cx;
        const dy = my - cy;
        const inRange = Math.hypot(dx, dy) < MAGNET_RADIUS;
        m.qx(inRange ? dx * MAGNET_PULL : 0);
        m.qy(inRange ? dy * MAGNET_PULL : 0);
      }
    },
    { passive: true }
  );

  document.addEventListener('pointerover', (e) => {
    hovering = !!e.target.closest('a, button, .hscroll-card');
  });
  document.addEventListener('pointerout', () => {
    hovering = false;
  });

  gsap.ticker.add(() => {
    rx += (mx - rx) * 0.15;
    ry += (my - ry) * 0.15;
    scale += ((hovering ? 1.8 : 1) - scale) * 0.15;
    ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%, -50%) scale(${scale})`;
  });
}
