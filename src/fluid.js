// GPU fluid simulation for the cursor "smoke" trail (landonorris.com-style).
// Compact WebGL2 implementation of the classic stable-fluids technique
// (GPU Gems ch. 38 / Pavel Dobryakov's MIT-licensed sim): velocity and dye
// fields advected on the GPU, with vorticity confinement for the swirl.
// Dye renders into a transparent overlay canvas blended with
// `mix-blend-mode: screen`, so black = invisible. Returns null (no effect)
// when WebGL2/float render targets are unavailable.

const SIM_RES = 128;
const DYE_RES = 512;
const PRESSURE_ITERATIONS = 20;
const CURL = 28;
const PRESSURE = 0.8;
const VELOCITY_DISSIPATION = 0.35;
const DYE_DISSIPATION = 1.4;
const SPLAT_FORCE = 5500;
const SPLAT_RADIUS = 0.0032;

const VS = `#version 300 es
precision highp float;
in vec2 aPosition;
out vec2 vUv; out vec2 vL; out vec2 vR; out vec2 vT; out vec2 vB;
uniform vec2 texelSize;
void main () {
  vUv = aPosition * 0.5 + 0.5;
  vL = vUv - vec2(texelSize.x, 0.0);
  vR = vUv + vec2(texelSize.x, 0.0);
  vT = vUv + vec2(0.0, texelSize.y);
  vB = vUv - vec2(0.0, texelSize.y);
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const FRAG = {
  splat: `
    uniform sampler2D uTarget; uniform float aspectRatio;
    uniform vec3 color; uniform vec2 point; uniform float radius;
    void main () {
      vec2 p = vUv - point;
      p.x *= aspectRatio;
      vec3 splat = exp(-dot(p, p) / radius) * color;
      fragColor = vec4(texture(uTarget, vUv).xyz + splat, 1.0);
    }`,
  advection: `
    uniform sampler2D uVelocity; uniform sampler2D uSource;
    uniform vec2 texelSize; uniform float dt; uniform float dissipation;
    void main () {
      vec2 coord = vUv - dt * texture(uVelocity, vUv).xy * texelSize;
      float decay = 1.0 + dissipation * dt;
      fragColor = texture(uSource, coord) / decay;
    }`,
  divergence: `
    uniform sampler2D uVelocity;
    void main () {
      float L = texture(uVelocity, vL).x;
      float R = texture(uVelocity, vR).x;
      float T = texture(uVelocity, vT).y;
      float B = texture(uVelocity, vB).y;
      fragColor = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
    }`,
  curl: `
    uniform sampler2D uVelocity;
    void main () {
      float L = texture(uVelocity, vL).y;
      float R = texture(uVelocity, vR).y;
      float T = texture(uVelocity, vT).x;
      float B = texture(uVelocity, vB).x;
      fragColor = vec4(0.5 * (R - L - T + B), 0.0, 0.0, 1.0);
    }`,
  vorticity: `
    uniform sampler2D uVelocity; uniform sampler2D uCurl;
    uniform float curl; uniform float dt;
    void main () {
      float L = texture(uCurl, vL).x;
      float R = texture(uCurl, vR).x;
      float T = texture(uCurl, vT).x;
      float B = texture(uCurl, vB).x;
      float C = texture(uCurl, vUv).x;
      vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
      force /= length(force) + 0.0001;
      force *= curl * C;
      force.y *= -1.0;
      vec2 velocity = texture(uVelocity, vUv).xy + force * dt;
      fragColor = vec4(clamp(velocity, -1000.0, 1000.0), 0.0, 1.0);
    }`,
  pressure: `
    uniform sampler2D uPressure; uniform sampler2D uDivergence;
    void main () {
      float L = texture(uPressure, vL).x;
      float R = texture(uPressure, vR).x;
      float T = texture(uPressure, vT).x;
      float B = texture(uPressure, vB).x;
      float divergence = texture(uDivergence, vUv).x;
      fragColor = vec4((L + R + B + T - divergence) * 0.25, 0.0, 0.0, 1.0);
    }`,
  gradientSubtract: `
    uniform sampler2D uPressure; uniform sampler2D uVelocity;
    void main () {
      float L = texture(uPressure, vL).x;
      float R = texture(uPressure, vR).x;
      float T = texture(uPressure, vT).x;
      float B = texture(uPressure, vB).x;
      vec2 velocity = texture(uVelocity, vUv).xy - vec2(R - L, T - B);
      fragColor = vec4(velocity, 0.0, 1.0);
    }`,
  clear: `
    uniform sampler2D uTexture; uniform float value;
    void main () { fragColor = value * texture(uTexture, vUv); }`,
  display: `
    uniform sampler2D uTexture;
    void main () { fragColor = vec4(texture(uTexture, vUv).rgb, 1.0); }`,
};

export function initFluid(canvas) {
  const gl = canvas.getContext('webgl2', { alpha: true, depth: false, stencil: false, antialias: false });
  if (!gl) return null;
  if (!gl.getExtension('EXT_color_buffer_float')) return null;

  const wrapFS = (body) => `#version 300 es
    precision highp float; precision highp sampler2D;
    in vec2 vUv; in vec2 vL; in vec2 vR; in vec2 vT; in vec2 vB;
    out vec4 fragColor;
    ${body}`;

  function compile(type, source) {
    const s = gl.createShader(type);
    gl.shaderSource(s, source);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.warn('fluid shader:', gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }

  const vs = compile(gl.VERTEX_SHADER, VS);
  if (!vs) return null;

  function program(fragBody) {
    const fs = compile(gl.FRAGMENT_SHADER, wrapFS(fragBody));
    const p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.bindAttribLocation(p, 0, 'aPosition');
    gl.linkProgram(p);
    const uniforms = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const name = gl.getActiveUniform(p, i).name;
      uniforms[name] = gl.getUniformLocation(p, name);
    }
    return { p, uniforms, bind: () => gl.useProgram(p) };
  }

  const programs = Object.fromEntries(Object.entries(FRAG).map(([k, v]) => [k, program(v)]));

  // fullscreen quad
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(0);

  function blit(target) {
    if (target) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
      gl.viewport(0, 0, target.w, target.h);
    } else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    }
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
  }

  function createFBO(w, h) {
    const tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    return {
      tex, fbo, w, h,
      texelSizeX: 1 / w,
      texelSizeY: 1 / h,
      attach(id) {
        gl.activeTexture(gl.TEXTURE0 + id);
        gl.bindTexture(gl.TEXTURE_2D, this.tex);
        return id;
      },
    };
  }

  function createDoubleFBO(w, h) {
    let read = createFBO(w, h);
    let write = createFBO(w, h);
    return {
      w, h,
      texelSizeX: 1 / w,
      texelSizeY: 1 / h,
      get read() { return read; },
      get write() { return write; },
      swap() { [read, write] = [write, read]; },
    };
  }

  function simSize(base) {
    const aspect = gl.drawingBufferWidth / gl.drawingBufferHeight;
    return aspect >= 1
      ? { w: Math.round(base * aspect), h: base }
      : { w: base, h: Math.round(base / aspect) };
  }

  function resizeCanvas() {
    const w = Math.floor(canvas.clientWidth);
    const h = Math.floor(canvas.clientHeight);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      return true;
    }
    return false;
  }

  resizeCanvas();
  let sim = simSize(SIM_RES);
  let dyeSize = simSize(DYE_RES);
  let velocity = createDoubleFBO(sim.w, sim.h);
  let dye = createDoubleFBO(dyeSize.w, dyeSize.h);
  let divergence = createFBO(sim.w, sim.h);
  let curl = createFBO(sim.w, sim.h);
  let pressure = createDoubleFBO(sim.w, sim.h);

  window.addEventListener('resize', () => {
    if (!resizeCanvas()) return;
    sim = simSize(SIM_RES);
    dyeSize = simSize(DYE_RES);
    velocity = createDoubleFBO(sim.w, sim.h);
    dye = createDoubleFBO(dyeSize.w, dyeSize.h);
    divergence = createFBO(sim.w, sim.h);
    curl = createFBO(sim.w, sim.h);
    pressure = createDoubleFBO(sim.w, sim.h);
  });

  // Brand-tinted dye: hue drifts through the brand's ember red→orange range.
  function dyeColor(t) {
    const hue = 0.045 + 0.035 * Math.sin(t * 0.0004);
    const i = Math.floor(hue * 6);
    const f = hue * 6 - i;
    const v = 1, s = 0.85;
    const p = v * (1 - s), q = v * (1 - f * s), u = v * (1 - (1 - f) * s);
    const rgb = [[v, u, p], [q, v, p], [p, v, u], [p, q, v], [u, p, v], [v, p, q]][i % 6];
    return rgb.map((c) => c * 0.22); // intensity
  }

  // Track deltas ourselves — e.movementX is unreliable (undefined in some
  // environments, which would splat NaN into the sim and kill the field).
  const splats = [];
  let lastX = null;
  let lastY = null;
  window.addEventListener(
    'pointermove',
    (e) => {
      const dx = lastX == null ? 0 : e.clientX - lastX;
      const dy = lastY == null ? 0 : e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      splats.push({
        x: e.clientX / canvas.clientWidth,
        y: 1 - e.clientY / canvas.clientHeight,
        dx: (dx / canvas.clientWidth) * SPLAT_FORCE,
        dy: (-dy / canvas.clientHeight) * SPLAT_FORCE,
      });
      if (splats.length > 24) splats.shift();
    },
    { passive: true }
  );

  function splat(x, y, dx, dy, color) {
    const aspect = canvas.width / canvas.height;
    const sp = programs.splat;
    sp.bind();
    gl.uniform1f(sp.uniforms.aspectRatio, aspect);
    gl.uniform2f(sp.uniforms.point, x, y);
    gl.uniform1f(sp.uniforms.radius, SPLAT_RADIUS);

    gl.uniform1i(sp.uniforms.uTarget, velocity.read.attach(0));
    gl.uniform3f(sp.uniforms.color, dx, dy, 0);
    blit(velocity.write);
    velocity.swap();

    gl.uniform1i(sp.uniforms.uTarget, dye.read.attach(0));
    gl.uniform3f(sp.uniforms.color, color[0], color[1], color[2]);
    blit(dye.write);
    dye.swap();
  }

  let last = performance.now();
  let raf;

  function frame(now) {
    const dt = Math.min((now - last) / 1000, 1 / 30);
    last = now;

    while (splats.length) {
      const s = splats.pop();
      splat(s.x, s.y, s.dx, s.dy, dyeColor(now));
    }
    splats.length = 0;

    // vorticity confinement
    programs.curl.bind();
    gl.uniform2f(programs.curl.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl.uniform1i(programs.curl.uniforms.uVelocity, velocity.read.attach(0));
    blit(curl);

    programs.vorticity.bind();
    gl.uniform2f(programs.vorticity.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl.uniform1i(programs.vorticity.uniforms.uVelocity, velocity.read.attach(0));
    gl.uniform1i(programs.vorticity.uniforms.uCurl, curl.attach(1));
    gl.uniform1f(programs.vorticity.uniforms.curl, CURL);
    gl.uniform1f(programs.vorticity.uniforms.dt, dt);
    blit(velocity.write);
    velocity.swap();

    // pressure projection
    programs.divergence.bind();
    gl.uniform2f(programs.divergence.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl.uniform1i(programs.divergence.uniforms.uVelocity, velocity.read.attach(0));
    blit(divergence);

    programs.clear.bind();
    gl.uniform1i(programs.clear.uniforms.uTexture, pressure.read.attach(0));
    gl.uniform1f(programs.clear.uniforms.value, PRESSURE);
    blit(pressure.write);
    pressure.swap();

    programs.pressure.bind();
    gl.uniform2f(programs.pressure.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl.uniform1i(programs.pressure.uniforms.uDivergence, divergence.attach(0));
    for (let i = 0; i < PRESSURE_ITERATIONS; i++) {
      gl.uniform1i(programs.pressure.uniforms.uPressure, pressure.read.attach(1));
      blit(pressure.write);
      pressure.swap();
    }

    programs.gradientSubtract.bind();
    gl.uniform2f(programs.gradientSubtract.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl.uniform1i(programs.gradientSubtract.uniforms.uPressure, pressure.read.attach(0));
    gl.uniform1i(programs.gradientSubtract.uniforms.uVelocity, velocity.read.attach(1));
    blit(velocity.write);
    velocity.swap();

    // advect
    programs.advection.bind();
    gl.uniform2f(programs.advection.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl.uniform1i(programs.advection.uniforms.uVelocity, velocity.read.attach(0));
    gl.uniform1i(programs.advection.uniforms.uSource, velocity.read.attach(0));
    gl.uniform1f(programs.advection.uniforms.dt, dt);
    gl.uniform1f(programs.advection.uniforms.dissipation, VELOCITY_DISSIPATION);
    blit(velocity.write);
    velocity.swap();

    gl.uniform1i(programs.advection.uniforms.uVelocity, velocity.read.attach(0));
    gl.uniform1i(programs.advection.uniforms.uSource, dye.read.attach(1));
    gl.uniform1f(programs.advection.uniforms.dissipation, DYE_DISSIPATION);
    blit(dye.write);
    dye.swap();

    // draw dye to screen
    programs.display.bind();
    gl.uniform1i(programs.display.uniforms.uTexture, dye.read.attach(0));
    blit(null);

    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  return { destroy: () => cancelAnimationFrame(raf) };
}
