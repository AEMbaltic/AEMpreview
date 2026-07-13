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

  // Mechanical click: a band-passed noise snap plus a tiny low thump —
  // sounds like a real ratchet detent rather than an electronic beep.
  let noiseBuf = null;
  function click(vol) {
    if (!enabled || !ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime;
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.05), ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 3400;
    bp.Q.value = 1.1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.028);
    src.connect(bp);
    bp.connect(g);
    g.connect(master);
    src.start(t);
    src.stop(t + 0.04);

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(185, t);
    osc.frequency.exponentialRampToValueAtTime(115, t + 0.03);
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(vol * 0.45, t);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
    osc.connect(g2);
    g2.connect(master);
    osc.start(t);
    osc.stop(t + 0.06);
  }

  // per-notch tick, rate-limited so fast flicks don't machine-gun
  function tick() {
    const now = performance.now();
    if (now - lastTickAt < 40) return;
    lastTickAt = now;
    click(0.2);
  }

  function renderBtn() {
    toggleBtn.classList.toggle('muted', !enabled);
    toggleBtn.setAttribute('aria-pressed', String(enabled));
  }
  toggleBtn.addEventListener('click', () => {
    enabled = !enabled;
    localStorage.setItem('aem-sound', enabled ? 'on' : 'off');
    // confirmation click so the visitor immediately hears that sound works
    if (enabled) Promise.resolve(ensureCtx()).then(() => click(0.25));
    renderBtn();
  });
  renderBtn();

  return { tick };
}
