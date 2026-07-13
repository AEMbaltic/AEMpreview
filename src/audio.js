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
    ctx.addEventListener('statechange', markLiveIfRunning);
    if (ctx.state === 'suspended') {
      return ctx.resume().then(markLiveIfRunning).catch(() => {});
    }
    markLiveIfRunning();
    return Promise.resolve();
  }

  // Audio can only unlock on a real user gesture (click/tap/key — wheel
  // scrolling does NOT count, per browser policy). Listen to everything
  // that qualifies, and pulse the toggle until the engine is live so
  // desktop visitors know one click starts the sound.
  function markLiveIfRunning() {
    if (ctx && ctx.state === 'running') toggleBtn.classList.remove('attention');
  }

  for (const ev of ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'mousedown', 'click', 'keydown', 'wheel']) {
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
    click(0.06);
  }

  // --- ambient scroll music -------------------------------------------
  // A warm detuned chord pad (Am9) through a slowly-breathing lowpass.
  // Silent at rest; fades in while the page is scrolling, fades out when
  // scrolling stops. Fully synthesized — no audio files.
  const MUSIC_LEVEL = 0.35;
  let music = null;
  let musicTimer = null;

  function startMusic() {
    if (music || !ctx) return;
    const out = ctx.createGain();
    out.gain.value = 0;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 750;
    lp.Q.value = 0.4;
    lp.connect(out);
    out.connect(master);
    // A2, E3, C4, B3 — Am9 voicing, each doubled with gentle detune
    for (const f of [110, 164.81, 261.63, 246.94]) {
      for (const det of [-5, 4]) {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = f;
        osc.detune.value = det;
        const g = ctx.createGain();
        g.gain.value = 0.02;
        osc.connect(g);
        g.connect(lp);
        osc.start();
      }
    }
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.06;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 260;
    lfo.connect(lfoGain);
    lfoGain.connect(lp.frequency);
    lfo.start();
    music = { out };
  }

  function fadeMusic(target, timeConstant) {
    if (!music || !ctx) return;
    const t = ctx.currentTime;
    music.out.gain.cancelScheduledValues(t);
    music.out.gain.setTargetAtTime(target, t, timeConstant);
  }

  // called on every scroll frame: swell in, then decay after scrolling stops
  function scrolling() {
    if (!enabled || !ctx || ctx.state !== 'running') return;
    startMusic();
    fadeMusic(MUSIC_LEVEL, 0.3);
    clearTimeout(musicTimer);
    musicTimer = setTimeout(() => fadeMusic(0.0001, 0.6), 280);
  }

  function renderBtn() {
    toggleBtn.classList.toggle('muted', !enabled);
    toggleBtn.setAttribute('aria-pressed', String(enabled));
  }
  toggleBtn.addEventListener('click', () => {
    enabled = !enabled;
    localStorage.setItem('aem-sound', enabled ? 'on' : 'off');
    // confirmation click so the visitor immediately hears that sound works
    if (enabled) Promise.resolve(ensureCtx()).then(() => click(0.1));
    else {
      fadeMusic(0.0001, 0.15); // muting also silences the pad promptly
      toggleBtn.classList.remove('attention');
    }
    renderBtn();
  });
  renderBtn();
  if (enabled) toggleBtn.classList.add('attention');

  return { tick, scrolling };
}
