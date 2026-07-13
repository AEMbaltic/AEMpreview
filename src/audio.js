// Scroll tick audio — synthesized mechanical detents (Web Audio, no files).
// A soft high tick fires per scroll notch; a deeper "tock" when a headline
// locks in. Browsers only allow audio after a user gesture, so the context
// is created/resumed on the first pointer/key/touch interaction. The header
// toggle persists the choice in localStorage.

export function initAudio(toggleBtn) {
  let ctx = null;
  let master = null;
  let enabled = localStorage.getItem('aem-sound') !== 'off';
  let lastTickAt = 0;

  function ensureCtx() {
    if (!enabled) return;
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') return ctx.resume().catch(() => {});
    return Promise.resolve();
  }

  for (const ev of ['pointerdown', 'touchend', 'click', 'keydown', 'wheel']) {
    window.addEventListener(ev, ensureCtx, { passive: true });
  }

  function blip(freq, dur, vol, type) {
    if (!enabled || !ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  // per-notch tick, rate-limited so fast flicks don't machine-gun
  function tick() {
    const now = performance.now();
    if (now - lastTickAt < 40) return;
    lastTickAt = now;
    blip(2100, 0.03, 0.12, 'square');
  }

  // headline lock-in: a rounder, two-layer detent
  function tock() {
    blip(760, 0.07, 0.3, 'triangle');
    blip(2500, 0.035, 0.12, 'square');
  }

  function renderBtn() {
    toggleBtn.classList.toggle('muted', !enabled);
    toggleBtn.setAttribute('aria-pressed', String(enabled));
  }
  toggleBtn.addEventListener('click', () => {
    enabled = !enabled;
    localStorage.setItem('aem-sound', enabled ? 'on' : 'off');
    // confirmation detent so the visitor immediately hears that sound works
    if (enabled) Promise.resolve(ensureCtx()).then(() => tock());
    renderBtn();
  });
  renderBtn();

  return { tick, tock };
}
