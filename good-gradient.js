// good-gradient.js
// <good-gradient> — a dependency-free animated mesh-gradient Web Component.
//
// Renders a slow, flowing gradient on a full-bleed WebGL2 canvas, with the
// palette supplied entirely by the host. Built as the lowest hero lane for the
// Good Design property-site template (Then. / Essential), beneath the
// paper-collage base layer. Self-hosted replacement for the Unicorn Studio
// embed — no third-party runtime, no build step, zero dependencies.
//
//   <good-gradient colors="#e8ded0,#c9b79c,#8a9a7b" speed="0.35"></good-gradient>
//
// Palette is ALWAYS host-supplied via the `colors` attribute. Nothing here
// hardcodes a property palette.

const DEFAULTS = {
  speed: 0.4,
  scale: 1.0,
  seed: 0,
  contrast: 1.0,
  cycles: 1.0,
  glow: 0,
};

const VERT = `#version 300 es
// Full-screen triangle from gl_VertexID — no vertex buffer needed.
void main() {
  float x = float((gl_VertexID & 1) << 2) - 1.0;
  float y = float((gl_VertexID & 2) << 1) - 1.0;
  gl_Position = vec4(x, y, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;

uniform float u_time;
uniform vec2  u_resolution;
uniform vec3  u_colors[5];
uniform int   u_colorCount;
uniform float u_speed;
uniform float u_scale;
uniform float u_seed;
uniform float u_grain;
uniform float u_contrast;
uniform float u_cycles;     // palette sweeps across the field N times (iridescence)
uniform vec3  u_background; // display-sRGB base color for glow mode
uniform float u_glow;       // 0 = full-bleed; >0 = bloom over background

out vec4 fragColor;

// --- OKLab <-> sRGB (Björn Ottosson). Palette stops arrive as OKLab so we can
// interpolate perceptually; convert back to display sRGB for output. ---------
vec3 oklabToLinearSrgb(vec3 c) {
  float l_ = c.x + 0.3963377774 * c.y + 0.2158037573 * c.z;
  float m_ = c.x - 0.1055613458 * c.y - 0.0638541728 * c.z;
  float s_ = c.x - 0.0894841775 * c.y - 1.2914855480 * c.z;
  float l = l_ * l_ * l_;
  float m = m_ * m_ * m_;
  float s = s_ * s_ * s_;
  return vec3(
     4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
  );
}
vec3 linearToSrgb(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  vec3 lo = c * 12.92;
  vec3 hi = 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055;
  return mix(lo, hi, step(0.0031308, c));
}

// --- Simplex noise 2D (Ashima Arts / Stefan Gustavson, MIT) -----------------
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                     -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v -   i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
                          + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy),
                          dot(x12.zw, x12.zw)), 0.0);
  m = m * m; m = m * m;
  vec3 x  = 2.0 * fract(p * C.www) - 1.0;
  vec3 h  = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x  = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}
// ---------------------------------------------------------------------------

// Sample the host palette at t in [0,1] with smooth interpolation between
// adjacent stops. Dynamic indexing of a uniform array is valid in GLSL ES 3.00.
vec3 palette(float t) {
  t = clamp(t, 0.0, 1.0);
  float scaled = t * float(u_colorCount - 1);
  int i = int(floor(scaled));
  i = clamp(i, 0, u_colorCount - 1);
  int j = min(i + 1, u_colorCount - 1);
  float f = smoothstep(0.0, 1.0, fract(scaled));
  return mix(u_colors[i], u_colors[j], f);
}

void main() {
  // Aspect-correct so blobs stay round regardless of canvas orientation.
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  vec2 p  = uv - 0.5;
  p.x *= u_resolution.x / u_resolution.y;

  float s = u_scale;
  float t = u_time * u_speed * 0.12;
  vec2  o = vec2(u_seed * 1.37, u_seed * 2.71);

  // Domain warp: two low-frequency passes drift the field slowly.
  vec2 q = vec2(
    snoise(p * s + o + vec2(0.0, t)),
    snoise(p * s + o + vec2(5.2, 1.3 - t))
  );
  vec2 r = vec2(
    snoise(p * s + q * 1.4 + o + vec2(1.7 - t, 9.2)),
    snoise(p * s + q * 1.4 + o + vec2(8.3, 2.8 + t))
  );
  float n = snoise(p * s + r * 1.2 + o);

  // Combine the final noise with the warp magnitude for richer regions.
  float v = 0.5 + 0.5 * n + 0.12 * (q.x + r.y);
  // Contrast: spread the value around the midpoint. <1 compresses toward the
  // middle of the palette (soft, washed, subtle blends); >1 pushes toward the
  // stops (distinct, punchy color fields).
  v = 0.5 + (v - 0.5) * u_contrast;
  // Iridescence: sweep the palette across the field u_cycles times. A ping-pong
  // (triangle) wave keeps it seamless for any palette; identity at cycles == 1.
  float band = 1.0 - abs(mod(v * u_cycles, 2.0) - 1.0);
  // palette() returns OKLab; convert the perceptual blend to display sRGB.
  vec3 col = linearToSrgb(oklabToLinearSrgb(palette(band)));

  // Glow-on-dark: concentrate color into soft luminous blooms over the
  // background, fading at the edges. u_glow == 0 keeps the original full-bleed.
  if (u_glow > 0.0) {
    float field = clamp(0.5 + 0.6 * n + 0.22 * (q.x + r.y), 0.0, 1.0);
    float k = mix(1.0, 5.5, u_glow);          // higher glow → tighter blooms
    float mask = pow(field, k);
    float vig = 1.0 - smoothstep(0.30, 0.95, length(p)) * u_glow; // edge falloff
    mask = clamp(mask * vig, 0.0, 1.0);
    col = mix(u_background, col, mask);
  }

  // Optional in-shader film grain to sit closer to paper-collage texture.
  if (u_grain > 0.5) {
    float g = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))
                        + u_time) * 43758.5453);
    col += (g - 0.5) * 0.045;
  }

  fragColor = vec4(col, 1.0);
}`;

const MAX_DPR = 1.75;
const MAX_COLORS = 5;

function clampNum(value, fallback) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
}

// Parse "#rgb" or "#rrggbb" → [r, g, b] in 0..1. Returns null on failure.
function hexToRgb(hex) {
  if (typeof hex !== 'string') return null;
  let h = hex.trim().replace(/^#/, '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  if (h.length !== 6 || /[^0-9a-fA-F]/.test(h)) return null;
  const int = parseInt(h, 16);
  return [
    ((int >> 16) & 255) / 255,
    ((int >> 8) & 255) / 255,
    (int & 255) / 255,
  ];
}

// sRGB (display, 0..1) → OKLab. Lets the shader interpolate stops perceptually
// so far-apart hues (e.g. purple→green) stay vivid instead of muddying.
function srgbToLinear(c) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
function rgbToOklab(rgb) {
  const lr = srgbToLinear(rgb[0]);
  const lg = srgbToLinear(rgb[1]);
  const lb = srgbToLinear(rgb[2]);
  const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;
  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);
  return [
    0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  ];
}

// Parse the comma-separated `colors` attribute into 2–5 [r,g,b] stops.
function parseColors(attr) {
  if (!attr) return [];
  const stops = attr
    .split(',')
    .map((c) => hexToRgb(c))
    .filter(Boolean);
  return stops.slice(0, MAX_COLORS);
}

class GoodGradient extends HTMLElement {
  static get observedAttributes() {
    return ['colors', 'speed', 'scale', 'seed', 'grain', 'static', 'contrast', 'cycles', 'background', 'glow', 'start'];
  }

  constructor() {
    super();
    this._shadow = this.attachShadow({ mode: 'open' });
    this._canvas = document.createElement('canvas');
    this._canvas.setAttribute('aria-hidden', 'true');

    const style = document.createElement('style');
    style.textContent = `
      :host { position: relative; display: block; }
      canvas {
        position: absolute; inset: 0;
        width: 100%; height: 100%;
        display: block;
      }
    `;
    this._shadow.append(style, this._canvas);

    // GL state
    this._gl = null;
    this._program = null;
    this._uniforms = null;
    this._usingWebGL = false;

    // animation state
    this._raf = 0;
    this._elapsed = 0;       // accumulated animated seconds (pauses cleanly)
    this._lastTs = 0;        // last rAF timestamp (ms)
    this._animating = false; // whether the rAF loop is currently scheduled
    this._connected = false; // gates attributeChangedCallback until connect
    this._visible = true;    // IntersectionObserver state
    this._pixelW = 0;
    this._pixelH = 0;

    // observers
    this._resizeObserver = null;
    this._intersectionObserver = null;
    this._motionQuery = null;

    // bound handlers
    this._onVisibilityChange = this._onVisibilityChange.bind(this);
    this._onFrame = this._onFrame.bind(this);
    this._onMotionChange = this._onMotionChange.bind(this);
  }

  // --- reduced motion -------------------------------------------------------
  get _reducedMotion() {
    return !!(this._motionQuery && this._motionQuery.matches);
  }

  // A static render = explicit `static` attribute OR reduced-motion preference.
  get _isStatic() {
    return this._reducedMotion || this.hasAttribute('static');
  }

  // --- lifecycle ------------------------------------------------------------
  connectedCallback() {
    this._connected = true;
    this._motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    // addEventListener form with Safari addListener fallback.
    if (this._motionQuery.addEventListener) {
      this._motionQuery.addEventListener('change', this._onMotionChange);
    } else if (this._motionQuery.addListener) {
      this._motionQuery.addListener(this._onMotionChange);
    }

    const ok = this._initGL();
    if (!ok) {
      this._applyFallback();
      // Still observe resize so the fallback stays full-bleed; no rAF.
      this._observeResize();
      return;
    }

    this._observeResize();
    this._observeIntersection();
    document.addEventListener('visibilitychange', this._onVisibilityChange);

    this._syncUniformsFromAttributes();
    // `start` seeds the animation clock so the page loads partway into the motion
    // (composition already in view) and continues drifting from there.
    this._elapsed = Math.max(0, clampNum(this.getAttribute('start'), 0));
    this._evaluatePlayState();
  }

  disconnectedCallback() {
    this._stopLoop();
    if (this._resizeObserver) this._resizeObserver.disconnect();
    if (this._intersectionObserver) this._intersectionObserver.disconnect();
    document.removeEventListener('visibilitychange', this._onVisibilityChange);
    if (this._motionQuery) {
      if (this._motionQuery.removeEventListener) {
        this._motionQuery.removeEventListener('change', this._onMotionChange);
      } else if (this._motionQuery.removeListener) {
        this._motionQuery.removeListener(this._onMotionChange);
      }
    }
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;
    // Ignore attribute reactions that fire before the element is connected and
    // the render mode is decided. For a deferred-module/upgrade, the initial
    // `colors` attribute triggers this callback BEFORE connectedCallback — at
    // which point WebGL hasn't initialized, so the fallback branch would
    // wrongly hide the canvas and paint a static CSS gradient. connectedCallback
    // reads the current attributes fresh, so dropping these early calls is safe.
    if (!this._connected) return;
    if (!this._usingWebGL) {
      // Fallback mode: only the palette matters.
      if (name === 'colors') this._applyFallback();
      return;
    }
    // `start` re-seeds the animation clock (load/preview a specific frame). It is
    // not a uniform, so handle it directly rather than via uniform sync.
    if (name === 'start') {
      this._elapsed = Math.max(0, clampNum(newValue, 0));
      if (!this._animating) this._renderFrame();
      return;
    }
    this._syncUniformsFromAttributes();
    if (name === 'static') {
      this._evaluatePlayState();
    } else if (!this._animating) {
      // Live edit while paused/static → repaint one frame to reflect it.
      this._renderFrame();
    }
  }

  // --- WebGL init -----------------------------------------------------------
  _initGL() {
    let gl;
    try {
      gl = this._canvas.getContext('webgl2', {
        antialias: false,
        alpha: false,
        depth: false,
        stencil: false,
        powerPreference: 'low-power',
      });
    } catch (e) {
      gl = null;
    }
    if (!gl) return false;

    const program = this._buildProgram(gl, VERT, FRAG);
    if (!program) return false;

    gl.useProgram(program);
    this._gl = gl;
    this._program = program;
    this._usingWebGL = true;
    this._uniforms = {
      time: gl.getUniformLocation(program, 'u_time'),
      resolution: gl.getUniformLocation(program, 'u_resolution'),
      colors: gl.getUniformLocation(program, 'u_colors'),
      colorCount: gl.getUniformLocation(program, 'u_colorCount'),
      speed: gl.getUniformLocation(program, 'u_speed'),
      scale: gl.getUniformLocation(program, 'u_scale'),
      seed: gl.getUniformLocation(program, 'u_seed'),
      grain: gl.getUniformLocation(program, 'u_grain'),
      contrast: gl.getUniformLocation(program, 'u_contrast'),
      cycles: gl.getUniformLocation(program, 'u_cycles'),
      background: gl.getUniformLocation(program, 'u_background'),
      glow: gl.getUniformLocation(program, 'u_glow'),
    };
    return true;
  }

  _buildProgram(gl, vertSrc, fragSrc) {
    const vs = this._compile(gl, gl.VERTEX_SHADER, vertSrc);
    const fs = this._compile(gl, gl.FRAGMENT_SHADER, fragSrc);
    if (!vs || !fs) return null;
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      return null;
    }
    return program;
  }

  _compile(gl, type, src) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  // --- uniforms -------------------------------------------------------------
  _syncUniformsFromAttributes() {
    if (!this._usingWebGL) return;
    const gl = this._gl;
    gl.useProgram(this._program);

    let stops = parseColors(this.getAttribute('colors'));
    if (stops.length < 2) {
      // Required attribute missing/invalid: render a flat neutral rather than
      // erroring. Host is expected to supply 2–5 stops.
      const base = stops[0] || [0.5, 0.5, 0.5];
      stops = [base, base];
    }
    const count = stops.length;
    // Pad to MAX_COLORS by repeating the last stop; convert each to OKLab so the
    // shader interpolates perceptually.
    const flat = new Float32Array(MAX_COLORS * 3);
    for (let i = 0; i < MAX_COLORS; i++) {
      const c = rgbToOklab(stops[Math.min(i, count - 1)]);
      flat[i * 3] = c[0];
      flat[i * 3 + 1] = c[1];
      flat[i * 3 + 2] = c[2];
    }
    gl.uniform3fv(this._uniforms.colors, flat);
    gl.uniform1i(this._uniforms.colorCount, count);
    gl.uniform1f(this._uniforms.speed, clampNum(this.getAttribute('speed'), DEFAULTS.speed));
    gl.uniform1f(this._uniforms.scale, clampNum(this.getAttribute('scale'), DEFAULTS.scale));
    gl.uniform1f(this._uniforms.seed, clampNum(this.getAttribute('seed'), DEFAULTS.seed));
    gl.uniform1f(this._uniforms.contrast, clampNum(this.getAttribute('contrast'), DEFAULTS.contrast));
    gl.uniform1f(this._uniforms.cycles, Math.max(0.1, clampNum(this.getAttribute('cycles'), DEFAULTS.cycles)));
    gl.uniform1f(this._uniforms.grain, this.getAttribute('grain') === '1' ? 1.0 : 0.0);

    // Glow-on-dark: background color (display sRGB) + glow amount.
    const bg = hexToRgb(this.getAttribute('background')) || [0, 0, 0];
    gl.uniform3f(this._uniforms.background, bg[0], bg[1], bg[2]);
    gl.uniform1f(this._uniforms.glow, clampNum(this.getAttribute('glow'), DEFAULTS.glow));
  }

  // --- sizing ---------------------------------------------------------------
  _observeResize() {
    this._resizeObserver = new ResizeObserver(() => this._resize());
    this._resizeObserver.observe(this);
    this._resize();
  }

  _resize() {
    const rect = this.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));
    if (w === this._pixelW && h === this._pixelH) return;
    this._pixelW = w;
    this._pixelH = h;
    this._canvas.width = w;
    this._canvas.height = h;

    if (this._usingWebGL) {
      const gl = this._gl;
      gl.viewport(0, 0, w, h);
      gl.useProgram(this._program);
      gl.uniform2f(this._uniforms.resolution, w, h);
      // Repaint immediately so a resize while paused/static isn't stale.
      if (!this._animating) this._renderFrame();
    }
  }

  // --- visibility / intersection -------------------------------------------
  _observeIntersection() {
    if (typeof IntersectionObserver === 'undefined') return;
    this._intersectionObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) this._visible = entry.isIntersecting;
      this._evaluatePlayState();
    });
    this._intersectionObserver.observe(this);
  }

  _onVisibilityChange() {
    this._evaluatePlayState();
  }

  _onMotionChange() {
    // Reduced-motion may flip live; re-evaluate (and freeze on a static frame).
    this._evaluatePlayState();
  }

  // Decide whether the rAF loop should run, given static/reduced-motion,
  // offscreen, and tab-hidden state.
  _evaluatePlayState() {
    if (!this._usingWebGL) return;
    if (this._isStatic) {
      this._stopLoop();
      this._renderFrame();
      return;
    }
    const shouldRun = this._visible && document.visibilityState !== 'hidden';
    if (shouldRun) this._startLoop();
    else this._stopLoop();
  }

  _startLoop() {
    if (this._animating) return;
    this._animating = true;
    this._lastTs = 0;
    this._raf = requestAnimationFrame(this._onFrame);
  }

  _stopLoop() {
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = 0;
    this._animating = false;
  }

  _onFrame(ts) {
    if (!this._animating) return;
    if (this._lastTs === 0) this._lastTs = ts;
    this._elapsed += (ts - this._lastTs) / 1000;
    this._lastTs = ts;
    this._renderFrame();
    this._raf = requestAnimationFrame(this._onFrame);
  }

  _renderFrame() {
    if (!this._usingWebGL) return;
    const gl = this._gl;
    gl.useProgram(this._program);
    gl.uniform1f(this._uniforms.time, this._elapsed);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  // --- fallback -------------------------------------------------------------
  _applyFallback() {
    const stops = parseColors(this.getAttribute('colors'));
    if (stops.length < 2) {
      this.style.background = stops.length
        ? `rgb(${stops[0].map((v) => Math.round(v * 255)).join(',')})`
        : '';
    } else {
      const css = stops
        .map((c) => `rgb(${c.map((v) => Math.round(v * 255)).join(',')})`)
        .join(', ');
      this.style.background = `linear-gradient(135deg, ${css})`;
    }
    // Hide the (unused) canvas so it can't paint a black rectangle.
    this._canvas.style.display = 'none';
  }
}

if (!customElements.get('good-gradient')) {
  customElements.define('good-gradient', GoodGradient);
}

export { GoodGradient };
export default GoodGradient;
