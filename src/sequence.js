// Scroll-scrubbed frame-sequence renderer.
//
// Each scene owns a <canvas>. Frames are pre-extracted images
// (public/frames/<id>/{desktop,mobile}/frame-XXXX.webp) described by
// public/frames/<id>/manifest.json. If no manifest exists yet, the scene
// falls back to an animated gradient so the page works before videos arrive.

const MOBILE_QUERY = '(max-width: 768px)';

export class FrameSequence {
  constructor(canvas, sceneId, accentColors) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.sceneId = sceneId;
    this.accentColors = accentColors;
    this.frames = [];
    this.frameCount = 0;
    this.loaded = 0;
    this.ready = false;
    this.fallback = true;
    this.progress = 0;
    this.onLoadProgress = null;
    // Sequences share one canvas; only the scene owning the current
    // scroll range may draw (managed by main.js via ScrollTrigger).
    this.active = false;

    this.resize = this.resize.bind(this);
    window.addEventListener('resize', this.resize);
    this.resize();
  }

  async init() {
    const variant = window.matchMedia(MOBILE_QUERY).matches ? 'mobile' : 'desktop';
    const base = `/frames/${this.sceneId}/${variant}`;
    try {
      const res = await fetch(`/frames/${this.sceneId}/manifest.json`);
      if (!res.ok) throw new Error('no manifest');
      const manifest = await res.json();
      this.frameCount = manifest.frameCount;
      this.ext = manifest.ext || 'webp';
      this.base = base;
      this.fallback = false;
      await this.loadFrame(0);
      this.ready = true;
      this.render(this.progress);
      this.preloadAll();
    } catch {
      // No frames yet — gradient fallback keeps the page previewable.
      this.ready = true;
      this.render(this.progress);
    }
  }

  frameUrl(i) {
    return `${this.base}/frame-${String(i + 1).padStart(4, '0')}.${this.ext}`;
  }

  loadFrame(i) {
    if (this.frames[i]) return Promise.resolve(this.frames[i]);
    return new Promise((resolve) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        this.frames[i] = img;
        this.loaded++;
        if (this.onLoadProgress) this.onLoadProgress(this.loaded / this.frameCount);
        resolve(img);
      };
      img.onerror = () => resolve(null);
      img.src = this.frameUrl(i);
    });
  }

  // Load frames in a few passes (every 8th, every 4th, ...) so scrubbing is
  // usable early and sharpens as more frames land.
  async preloadAll() {
    for (const step of [8, 4, 2, 1]) {
      const batch = [];
      for (let i = 0; i < this.frameCount; i += step) batch.push(this.loadFrame(i));
      await Promise.all(batch);
      this.render(this.progress);
    }
  }

  nearestLoadedFrame(target) {
    if (this.frames[target]) return this.frames[target];
    for (let d = 1; d < this.frameCount; d++) {
      if (this.frames[target - d]) return this.frames[target - d];
      if (this.frames[target + d]) return this.frames[target + d];
    }
    return null;
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = this.canvas.clientWidth * dpr;
    this.canvas.height = this.canvas.clientHeight * dpr;
    if (this.ready) this.render(this.progress);
  }

  render(progress) {
    this.progress = progress;
    if (!this.active) return;
    const { ctx, canvas } = this;
    if (this.fallback) {
      this.renderFallback(progress);
      return;
    }
    const target = Math.min(this.frameCount - 1, Math.round(progress * (this.frameCount - 1)));
    const img = this.nearestLoadedFrame(target);
    if (!img) return;
    // cover-fit
    const cw = canvas.width;
    const ch = canvas.height;
    const scale = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
    const w = img.naturalWidth * scale;
    const h = img.naturalHeight * scale;
    ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
  }

  // Placeholder visual until real frames exist: slow-moving radial gradients
  // driven by scroll progress, tinted with the scene accent colors.
  renderFallback(progress) {
    const { ctx, canvas } = this;
    const w = canvas.width;
    const h = canvas.height;
    const [c1, c2] = this.accentColors;
    ctx.fillStyle = '#0c0807';
    ctx.fillRect(0, 0, w, h);

    const t = progress * Math.PI * 2;
    const blobs = [
      { x: 0.5 + 0.35 * Math.cos(t), y: 0.4 + 0.3 * Math.sin(t * 0.8), r: 0.65, color: c1 },
      { x: 0.5 + 0.4 * Math.sin(t * 1.2), y: 0.6 + 0.3 * Math.cos(t), r: 0.55, color: c2 },
    ];
    for (const b of blobs) {
      const g = ctx.createRadialGradient(b.x * w, b.y * h, 0, b.x * w, b.y * h, b.r * Math.max(w, h));
      g.addColorStop(0, b.color);
      g.addColorStop(1, 'rgba(7,8,12,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }

    // faint grain so the fallback doesn't band
    ctx.globalAlpha = 0.04;
    for (let i = 0; i < 60; i++) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5);
    }
    ctx.globalAlpha = 1;
  }
}
