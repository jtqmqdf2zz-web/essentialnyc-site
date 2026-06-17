// good-gradient-panel.js
// Self-contained Page-Background authoring overlay — Essential build.
//
// Authoring chrome, NOT site content: it only ever mounts behind the shared
// ?gg-edit=1 gate (see gg-edit.js), and nothing here touches the page without
// the flag. It controls the page's gradient field — the .page-bg element — across
// three modes:
//
//   • Solid     — a single background color.
//   • Gradient  — a live <good-gradient> (mesh-gradient Web Component), tuned with
//                 stops + speed/scale/contrast/cycles/glow/background/seed/grain.
//   • Video     — a muted, looping, autoplaying full-bleed <video>.
//
// Essential addition (Order 250): an EST-THEME DROPDOWN in the gradient pane.
// Picking a theme loads its [bg, complement, text] stops (see est-gradient-themes
// .js for the role→stop mapping). This is the same data the visitor-facing
// gradient-theme.js uses, so what you author here matches what visitors see when
// they switch theme on the live site.
//
// Every control writes the live .page-bg in real time. The Background-HTML box at
// the bottom is two-way: "Copy" grabs the static <div class="page-bg">…</div>
// markup (paste it over a page's .page-bg to bake non-color settings), "Paste &
// apply" reads a block back into the controls. On Essential the gradient's COLORS
// are theme-driven at runtime — bake the non-color settings (speed/scale/etc.),
// not a fixed palette.

const PANEL_ID = 'gg-edit-panel';
const MAX_COLORS = 5;

// Essential's default stops — EST-08 (Cream / Black): bg / complement / ink.
// Mirrors the canonical role→stop mapping in est-gradient-themes.js.
const DEFAULT_STOPS = ['#dbd2c0', '#3c7066', '#262626'];

// The vendored EST → stops map (window-global, loaded by est-gradient-themes.js).
const EST = (typeof window !== 'undefined' && window.EST_GRADIENT_THEMES) || null;

// Starter gradient palettes (quick presets, separate from the EST dropdown).
const PRESETS = {
  essential: ['#dbd2c0', '#3c7066', '#262626'],          // EST-08 cream/teal/ink
  paper:     ['#e8ded0', '#c9b79c', '#8a9a7b'],          // paper/sage
  aurora: {
    colors: ['#5b2a86', '#3a5bdb', '#2bb1a8', '#d98a2b', '#cc3a8e'],
    glow: 0.45, background: '#0d0d12', scale: 0.32, contrast: 0.85, speed: 0.18,
  },
  khroma: {
    colors: ['#3a6bd6', '#7a3fc0', '#cc3a8e', '#d98a2b', '#37b6c4'],
    cycles: 3, glow: 0.83, background: '#08080c', scale: 0.175, contrast: 1.58, speed: 0.06, grain: true,
  },
};

const RANGE_DEFAULTS = { speed: 0.35, scale: 1.0, contrast: 1.0, cycles: 1, glow: 0, seed: 0, start: 0 };

// Remember the last gradient the user tuned, so opening the panel on a page that
// has no baked gradient pre-fills with it (carry a look from page to page) instead
// of resetting to the default palette.
const LS_KEY = 'gg-edit:last-gradient';
function loadLastGradient() {
  try { const s = localStorage.getItem(LS_KEY); return s ? JSON.parse(s) : null; }
  catch (e) { return null; }
}

// Remember where the user dragged the panel, so it reopens out of the wordmark's way.
const POS_KEY = 'gg-edit:panel-pos';
function loadPanelPos() {
  try { const s = localStorage.getItem(POS_KEY); return s ? JSON.parse(s) : null; }
  catch (e) { return null; }
}
function savePanelPos(left, top) {
  try { localStorage.setItem(POS_KEY, JSON.stringify({ left, top })); } catch (e) { /* non-fatal */ }
}

const PANEL_CSS = `
  #${PANEL_ID} {
    position: fixed; top: 16px; left: 16px; z-index: 99998;
    width: 300px; max-height: calc(100vh - 32px); overflow: auto;
    background: rgba(22,22,21,.92);
    -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px);
    border: 1px solid #444444; border-radius: 8px; padding: 16px;
    color: #e2e2e0;
    font: 13px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    -webkit-font-smoothing: antialiased;
  }
  #${PANEL_ID} * { box-sizing: border-box; }
  #${PANEL_ID} .gg-h { display: flex; align-items: baseline; gap: 8px; margin: 0 0 4px; cursor: move; touch-action: none; user-select: none; -webkit-user-select: none; }
  #${PANEL_ID}.is-dragging { user-select: none; }
  #${PANEL_ID} .gg-h h1 {
    flex: 1 1 auto; font-size: 13px; font-weight: 400; letter-spacing: .08em;
    text-transform: uppercase; margin: 0;
  }
  #${PANEL_ID} .gg-min {
    background: none; border: 1px solid #444444; color: inherit; cursor: pointer;
    border-radius: 4px; width: 22px; height: 22px; line-height: 1; flex: 0 0 auto;
  }
  #${PANEL_ID}.is-collapsed .gg-body { display: none; }
  #${PANEL_ID} .sub { opacity: .55; margin: 0 0 14px; font-size: 11px; }
  #${PANEL_ID} .row { margin-bottom: 14px; }
  #${PANEL_ID} .row > label {
    display: block; margin-bottom: 6px; opacity: .7;
    text-transform: uppercase; letter-spacing: .06em; font-size: 11px;
  }
  /* segmented mode switch */
  #${PANEL_ID} .modes { display: flex; gap: 0; border: 1px solid #444444; border-radius: 6px; overflow: hidden; }
  #${PANEL_ID} .modes button {
    flex: 1; background: none; border: 0; border-left: 1px solid #444444;
    color: #e2e2e0; padding: 7px 6px; cursor: pointer; opacity: .65;
    text-transform: uppercase; letter-spacing: .05em; font-size: 11px;
  }
  #${PANEL_ID} .modes button:first-child { border-left: 0; }
  #${PANEL_ID} .modes button:hover { opacity: 1; }
  #${PANEL_ID} .modes button.is-active { opacity: 1; background: rgba(70,132,178,.28); }
  #${PANEL_ID} .mode-pane { display: none; }
  #${PANEL_ID} .mode-pane.is-active { display: block; }
  #${PANEL_ID} select.est-select {
    width: 100%; background: #0f0f0e; color: #e2e2e0;
    border: 1px solid #444444; border-radius: 6px; padding: 7px 8px;
    font: 12px ui-monospace, Menlo, monospace; cursor: pointer;
  }
  #${PANEL_ID} select.est-select:focus { outline: 0; border-color: #4684b2; }
  #${PANEL_ID} .stops { display: flex; flex-direction: column; gap: 6px; }
  #${PANEL_ID} .stop { display: flex; align-items: center; gap: 8px; }
  #${PANEL_ID} .stop input[type=color] {
    width: 36px; height: 28px; padding: 0; border: 1px solid #444444;
    border-radius: 6px; background: none; cursor: pointer;
  }
  #${PANEL_ID} .stop input[type=text] {
    flex: 1; background: #0f0f0e; color: #e2e2e0;
    border: 1px solid #444444; border-radius: 6px;
    padding: 5px 8px; font: 12px ui-monospace, Menlo, monospace;
  }
  #${PANEL_ID} .stop button {
    background: none; border: 1px solid #444444; color: #e2e2e0;
    border-radius: 6px; width: 28px; height: 28px; cursor: pointer; opacity: .7;
  }
  #${PANEL_ID} .stop button:hover { opacity: 1; border-color: #cc444e; }
  #${PANEL_ID} .addstop {
    margin-top: 6px; background: none; border: 1px dashed #444444;
    color: #e2e2e0; border-radius: 6px; padding: 6px 10px;
    cursor: pointer; width: 100%; opacity: .75;
  }
  #${PANEL_ID} .addstop:hover { opacity: 1; }
  #${PANEL_ID} input[type=range] { width: 100%; accent-color: #d8c05d; }
  #${PANEL_ID} input[type=text].txt {
    width: 100%; background: #0f0f0e; color: #e2e2e0;
    border: 1px solid #444444; border-radius: 6px;
    padding: 6px 8px; font: 12px ui-monospace, Menlo, monospace;
  }
  #${PANEL_ID} .val { float: right; opacity: .6; }
  #${PANEL_ID} .toggles { display: flex; gap: 16px; flex-wrap: wrap; }
  #${PANEL_ID} .toggles label { display: flex; align-items: center; gap: 6px; opacity: .85; cursor: pointer; }
  #${PANEL_ID} .presets { display: flex; gap: 8px; flex-wrap: wrap; }
  #${PANEL_ID} .presets button {
    flex: 1; min-width: 80px; background: none; border: 1px solid #444444;
    color: #e2e2e0; border-radius: 6px; padding: 7px 6px; cursor: pointer;
    transition: border-color .2s cubic-bezier(.2,.7,.2,1);
  }
  #${PANEL_ID} .presets button:hover { border-color: #4684b2; }
  #${PANEL_ID} .code {
    display: block; width: 100%; margin-top: 4px; padding: 10px;
    border: 1px solid #444444; border-radius: 6px; background: #0f0f0e; color: #e2e2e0;
    font: 11px/1.5 ui-monospace, Menlo, monospace;
    white-space: pre-wrap; word-break: break-all; resize: vertical; min-height: 76px;
  }
  #${PANEL_ID} .code:focus { outline: 0; border-color: #4684b2; }
  #${PANEL_ID} .io-row { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
  #${PANEL_ID} .io-btn {
    background: none; border: 1px solid #444444; color: #e2e2e0; border-radius: 6px;
    padding: 6px 10px; cursor: pointer; font: inherit; font-size: 11px;
  }
  #${PANEL_ID} .io-btn:hover { border-color: #4684b2; }
  #${PANEL_ID} .io-status { font-size: 11px; opacity: .6; margin-left: auto; }
  #${PANEL_ID} .io-status.ok { color: #93ba1a; opacity: 1; }
  #${PANEL_ID} .io-status.err { color: #cc444e; opacity: 1; }
  #${PANEL_ID} hr { border: none; border-top: 1px solid #444444; margin: 14px 0; }
`;

function isHex(v) { return /^#?[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(String(v).trim()); }
function norm(v) { v = String(v).trim(); return v.startsWith('#') ? v : '#' + v; }
function esc(v) { return String(v).replace(/"/g, '&quot;'); }

// Ensure the <good-gradient> custom element is defined, importing the vendored
// component module if the host page didn't already load it.
async function ensureComponent() {
  if (customElements.get('good-gradient')) return;
  await import('/good-gradient/good-gradient.js?v=1');
  if (customElements.whenDefined) {
    try { await customElements.whenDefined('good-gradient'); } catch (e) { /* noop */ }
  }
}

// The page's one surface: .page-bg. Create it if missing.
function resolveBgHost() {
  let bg = document.querySelector('.page-content > .page-bg') || document.querySelector('.page-bg');
  if (bg) return bg;
  const content = document.querySelector('.page-content') || document.body;
  bg = document.createElement('div');
  bg.className = 'page-bg';
  content.insertBefore(bg, content.firstChild);
  return bg;
}

function detectMode(bg) {
  if (bg.querySelector('good-gradient')) return 'gradient';
  if (bg.querySelector('video')) return 'video';
  return 'solid';
}

export async function mountBackgroundPanel() {
  if (document.getElementById(PANEL_ID)) return; // idempotent
  await ensureComponent();

  const bg = resolveBgHost();
  const startMode = detectMode(bg);

  // --- gradient state (persists across mode switches so toggling back restores it) ---
  // Priority: the page's own baked <good-gradient> wins; otherwise pre-fill from the
  // last gradient tuned on any page (localStorage); otherwise the Essential default.
  const existingGG = bg.querySelector('good-gradient');
  const last = existingGG ? null : loadLastGradient();
  const gAttr = (n, d) => (existingGG && existingGG.getAttribute(n) != null ? existingGG.getAttribute(n) : d);
  let stops;
  let gState;
  if (existingGG) {
    stops = (gAttr('colors', '') || '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, MAX_COLORS);
    if (stops.length < 2) stops = [...DEFAULT_STOPS];
    gState = {
      speed: +gAttr('speed', RANGE_DEFAULTS.speed),
      scale: +gAttr('scale', RANGE_DEFAULTS.scale),
      contrast: +gAttr('contrast', RANGE_DEFAULTS.contrast),
      cycles: +gAttr('cycles', RANGE_DEFAULTS.cycles),
      glow: +gAttr('glow', RANGE_DEFAULTS.glow),
      seed: +gAttr('seed', RANGE_DEFAULTS.seed),
      start: +gAttr('start', 0),
      background: gAttr('background', '#0d0d12'),
      grain: gAttr('grain', null) === '1',
      static: existingGG.hasAttribute('static'),
    };
  } else if (last && last.g) {
    stops = (Array.isArray(last.stops) && last.stops.length >= 2) ? [...last.stops] : [...DEFAULT_STOPS];
    gState = {
      speed: +(last.g.speed ?? RANGE_DEFAULTS.speed),
      scale: +(last.g.scale ?? RANGE_DEFAULTS.scale),
      contrast: +(last.g.contrast ?? RANGE_DEFAULTS.contrast),
      cycles: +(last.g.cycles ?? RANGE_DEFAULTS.cycles),
      glow: +(last.g.glow ?? RANGE_DEFAULTS.glow),
      seed: +(last.g.seed ?? RANGE_DEFAULTS.seed),
      start: +(last.g.start ?? 0),
      background: last.g.background || '#0d0d12',
      grain: !!last.g.grain,
      static: !!last.g.static,
    };
  } else {
    stops = [...DEFAULT_STOPS];
    gState = { ...RANGE_DEFAULTS, background: '#0d0d12', grain: false, static: false };
  }
  // solid + video initial values
  const solidInit = (() => {
    const inline = bg.style.background || bg.style.backgroundColor;
    if (inline && isHex(inline.trim())) return norm(inline.trim());
    return '#dbd2c0';
  })();
  const videoInit = (bg.querySelector('video') && (bg.querySelector('video').getAttribute('src') || '')) || '';

  // Inject scoped styles once.
  if (!document.getElementById(PANEL_ID + '-css')) {
    const style = document.createElement('style');
    style.id = PANEL_ID + '-css';
    style.textContent = PANEL_CSS;
    document.head.appendChild(style);
  }

  // EST dropdown <option>s from the vendored theme map (EST-08 first).
  const estOptions = EST && Array.isArray(EST.order)
    ? EST.order.map((id) => {
        const t = EST.themes[id];
        return `<option value="${id}">${id} — ${t ? esc(t.name) : id}</option>`;
      }).join('')
    : '';

  const panel = document.createElement('aside');
  panel.id = PANEL_ID;
  panel.setAttribute('aria-label', 'Page background editor');
  panel.innerHTML = `
    <div class="gg-h">
      <h1>Background</h1>
      <button class="gg-min" type="button" aria-label="Toggle panel" title="Toggle">−</button>
    </div>
    <div class="gg-body">
      <p class="sub">Sets the page's gradient field. Colors follow the live EST theme; bake the non-color settings into the page.</p>

      <div class="row">
        <div class="modes" role="tablist">
          <button data-mode="solid">Solid</button>
          <button data-mode="gradient">Gradient</button>
          <button data-mode="video">Video</button>
        </div>
      </div>

      <!-- SOLID -->
      <div class="mode-pane" data-pane="solid">
        <div class="row">
          <label>Color</label>
          <div class="stop">
            <input type="color" id="${PANEL_ID}-solid-color" />
            <input type="text" id="${PANEL_ID}-solid-text" />
          </div>
        </div>
      </div>

      <!-- GRADIENT -->
      <div class="mode-pane" data-pane="gradient">
        ${estOptions ? `
        <div class="row">
          <label>EST theme <span style="opacity:.5">(loads stops · live on site)</span></label>
          <select class="est-select" id="${PANEL_ID}-est">
            <option value="">— pick a theme —</option>
            ${estOptions}
          </select>
        </div>` : ''}
        <div class="row">
          <label>Presets</label>
          <div class="presets">
            <button data-preset="essential">Essential (EST-08)</button>
            <button data-preset="paper">Paper-collage</button>
            <button data-preset="aurora">Aurora glow</button>
            <button data-preset="khroma">Khroma flow</button>
          </div>
        </div>
        <hr />
        <div class="row">
          <label>Color stops <span style="opacity:.5">(2–5)</span></label>
          <div class="stops" id="${PANEL_ID}-stops"></div>
          <button class="addstop" id="${PANEL_ID}-addstop">+ add stop</button>
        </div>
        <div class="row"><label>Speed <span class="val" data-out="speed"></span></label><input type="range" data-range="speed" min="0" max="0.08" step="0.001" /></div>
        <div class="row"><label>Scale <span class="val" data-out="scale"></span></label><input type="range" data-range="scale" min="0.01" max="0.15" step="0.002" /></div>
        <div class="row"><label>Contrast <span style="opacity:.5">(low = wash)</span> <span class="val" data-out="contrast"></span></label><input type="range" data-range="contrast" min="0.1" max="2.5" step="0.01" /></div>
        <div class="row"><label>Cycles <span style="opacity:.5">(iridescence)</span> <span class="val" data-out="cycles"></span></label><input type="range" data-range="cycles" min="1" max="8" step="0.1" /></div>
        <div class="row"><label>Glow <span style="opacity:.5">(0 = full-bleed)</span> <span class="val" data-out="glow"></span></label><input type="range" data-range="glow" min="0" max="1" step="0.01" /></div>
        <div class="row">
          <label>Background <span style="opacity:.5">(glow base)</span></label>
          <div class="stop">
            <input type="color" id="${PANEL_ID}-bgcolor" />
            <input type="text" id="${PANEL_ID}-bgtext" />
          </div>
        </div>
        <div class="row"><label>Seed <span class="val" data-out="seed"></span></label><input type="range" data-range="seed" min="0" max="20" step="0.1" /></div>
        <div class="row"><label>Start <span style="opacity:.5">(load frame · let it run, then Copy to bake the frame on screen)</span> <span class="val" data-out="start"></span></label><input type="range" data-range="start" min="0" max="600" step="1" /></div>
        <div class="row toggles">
          <label><input type="checkbox" data-toggle="grain" /> grain</label>
          <label><input type="checkbox" data-toggle="static" /> static</label>
        </div>
      </div>

      <!-- VIDEO -->
      <div class="mode-pane" data-pane="video">
        <div class="row">
          <label>Video URL <span style="opacity:.5">(mp4 / webm)</span></label>
          <input type="text" class="txt" id="${PANEL_ID}-video-url" placeholder="videos/bg.mp4" />
        </div>
        <p class="sub" style="margin-top:-6px">Plays muted + looped + autoplay, object-fit: cover.</p>
      </div>

      <hr />
      <div class="row" style="margin-bottom:6px"><label>Background HTML <span style="opacity:.5">(copy out · paste in)</span></label></div>
      <textarea class="code" id="${PANEL_ID}-code" spellcheck="false" rows="4"
        aria-label="Background HTML — copy to bake into a page, or paste a block to load its settings"></textarea>
      <div class="io-row">
        <button class="io-btn" id="${PANEL_ID}-copy" type="button">Copy</button>
        <button class="io-btn" id="${PANEL_ID}-apply" type="button">Paste &amp; apply</button>
        <span class="io-status" id="${PANEL_ID}-status"></span>
      </div>
    </div>
  `;
  document.body.appendChild(panel);

  const $ = (sel) => panel.querySelector(sel);
  const codeEl = $(`#${PANEL_ID}-code`);
  let mode = startMode;
  let ggEl = existingGG || null;     // the live <good-gradient>, when in gradient mode

  /* ============================ apply helpers ============================ */
  function clearBg() {
    bg.querySelectorAll('good-gradient, video').forEach((n) => n.remove());
    bg.style.background = '';
    ggEl = null;
  }

  function applySolid() {
    clearBg();
    bg.style.background = solid();
  }

  function ensureGradientEl() {
    if (ggEl && ggEl.isConnected) return ggEl;
    bg.querySelectorAll('video').forEach((n) => n.remove());
    ggEl = bg.querySelector('good-gradient') || document.createElement('good-gradient');
    if (!ggEl.isConnected) bg.appendChild(ggEl);
    return ggEl;
  }

  function applyGradient() {
    bg.style.background = '';
    const el = ensureGradientEl();
    el.setAttribute('colors', stops.filter(isHex).map(norm).join(','));
    el.setAttribute('speed', gState.speed);
    el.setAttribute('scale', gState.scale);
    el.setAttribute('contrast', gState.contrast);
    el.setAttribute('cycles', gState.cycles);
    el.setAttribute('glow', gState.glow);
    el.setAttribute('seed', gState.seed);
    if (gState.start > 0) el.setAttribute('start', gState.start); else el.removeAttribute('start');
    el.setAttribute('background', gState.background);
    if (gState.grain) el.setAttribute('grain', '1'); else el.removeAttribute('grain');
    if (gState.static) el.setAttribute('static', ''); else el.removeAttribute('static');
    saveLast();   // remember this gradient for other pages
  }

  function applyVideo() {
    clearBg();
    bg.style.background = solid(); // poster fallback behind the video
    const url = video();
    if (!url) return;
    const v = document.createElement('video');
    v.className = 'page-bg-media';
    v.muted = true; v.loop = true; v.autoplay = true; v.playsInline = true;
    v.setAttribute('muted', ''); v.setAttribute('loop', '');
    v.setAttribute('autoplay', ''); v.setAttribute('playsinline', '');
    v.src = url;
    bg.appendChild(v);
    v.play && v.play().catch(() => {});
  }

  function solid() { return $(`#${PANEL_ID}-solid-text`).value.trim() || '#dbd2c0'; }
  function video() { return $(`#${PANEL_ID}-video-url`).value.trim(); }

  function applyCurrent() {
    if (mode === 'solid') applySolid();
    else if (mode === 'gradient') applyGradient();
    else if (mode === 'video') applyVideo();
    updateCode();
  }

  /* ============================ markup I/O ============================ */
  // The frame to bake. While the gradient is animating, the live clock (_elapsed)
  // has drifted past the seed `start`, so capture where it actually is right now —
  // that's the composition on screen. Frozen/static → _elapsed equals the seed.
  function liveStart() {
    if (mode === 'gradient' && ggEl && typeof ggEl._elapsed === 'number') {
      return Math.round(ggEl._elapsed);
    }
    return Math.round(gState.start || 0);
  }

  function currentMarkup() {
    if (mode === 'solid') return `<div class="page-bg" style="background:${solid()}"></div>`;
    if (mode === 'video') {
      const url = video() || 'videos/bg.mp4';
      return `<div class="page-bg">\n  <video class="page-bg-media" src="${esc(url)}" autoplay muted loop playsinline></video>\n</div>`;
    }
    const a = [`colors="${stops.filter(isHex).map(norm).join(',')}"`,
               `speed="${gState.speed}"`, `scale="${gState.scale}"`];
    if (gState.contrast !== 1) a.push(`contrast="${gState.contrast}"`);
    if (gState.cycles !== 1) a.push(`cycles="${gState.cycles}"`);
    if (gState.glow > 0) { a.push(`glow="${gState.glow}"`); a.push(`background="${gState.background}"`); }
    if (gState.seed !== 0) a.push(`seed="${gState.seed}"`);
    const st = liveStart();
    if (st > 0) a.push(`start="${st}"`);
    if (gState.grain) a.push('grain="1"');
    if (gState.static) a.push('static');
    return `<div class="page-bg">\n  <good-gradient ${a.join(' ')}></good-gradient>\n</div>`;
  }

  // Only overwrite the box from state when the user isn't editing it (so a paste
  // isn't clobbered by an unrelated control firing).
  function updateCode() {
    if (document.activeElement !== codeEl) codeEl.value = currentMarkup();
  }

  // Persist the current gradient so other pages can pre-fill from it.
  function saveLast() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({
        stops: stops.filter(isHex).map(norm),
        g: { ...gState },
      }));
    } catch (e) { /* storage may be unavailable; non-fatal */ }
  }

  const statusEl = $(`#${PANEL_ID}-status`);
  let statusTimer = 0;
  function status(msg, kind) {
    statusEl.textContent = msg;
    statusEl.className = 'io-status' + (kind ? ' ' + kind : '');
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => { statusEl.textContent = ''; statusEl.className = 'io-status'; }, 1600);
  }

  // Parse a pasted background block (full <div class="page-bg">…</div>, a bare
  // <good-gradient …>/<video>, or just a hex color) into a normalized config.
  function parseMarkup(str) {
    const tmp = document.createElement('div');
    tmp.innerHTML = String(str || '').trim();
    const gg = tmp.querySelector('good-gradient');
    if (gg) {
      const cols = (gg.getAttribute('colors') || '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, MAX_COLORS);
      const num = (n, d) => { const v = gg.getAttribute(n); return v == null ? d : (+v); };
      return {
        mode: 'gradient',
        stops: cols.length >= 2 ? cols : null,
        g: {
          speed: num('speed', RANGE_DEFAULTS.speed),
          scale: num('scale', RANGE_DEFAULTS.scale),
          contrast: num('contrast', RANGE_DEFAULTS.contrast),
          cycles: num('cycles', RANGE_DEFAULTS.cycles),
          glow: num('glow', RANGE_DEFAULTS.glow),
          seed: num('seed', RANGE_DEFAULTS.seed),
          start: num('start', 0),
          background: gg.getAttribute('background') || '#0d0d12',
          grain: gg.getAttribute('grain') === '1',
          static: gg.hasAttribute('static'),
        },
      };
    }
    const vid = tmp.querySelector('video');
    if (vid) return { mode: 'video', video: vid.getAttribute('src') || '' };
    const pbg = tmp.querySelector('.page-bg') || tmp.firstElementChild;
    let col = pbg && pbg.style ? (pbg.style.background || pbg.style.backgroundColor) : '';
    if (!col || !isHex(col.trim())) { const m = String(str || '').match(/#[0-9a-fA-F]{3,6}\b/); col = m ? m[0] : ''; }
    if (col && isHex(col.trim())) return { mode: 'solid', solid: norm(col.trim()) };
    return null;
  }

  // Load a parsed config into every control + the live background.
  function hydrate(p) {
    if (!p) { status('Could not read that', 'err'); return; }
    if (p.mode === 'gradient') {
      if (p.stops) { stops = [...p.stops]; renderStops(); }
      gState.grain = p.g.grain; gState.static = p.g.static;
      grainEl.checked = p.g.grain; staticEl.checked = p.g.static;
      setBackground(p.g.background);
      setRange('speed', p.g.speed); setRange('scale', p.g.scale);
      setRange('contrast', p.g.contrast); setRange('cycles', p.g.cycles);
      setRange('glow', p.g.glow); setRange('seed', p.g.seed);
      setRange('start', p.g.start || 0);
      setMode('gradient');
    } else if (p.mode === 'video') {
      $(`#${PANEL_ID}-video-url`).value = p.video || '';
      setMode('video');
    } else if (p.mode === 'solid') {
      solidColor.value = p.solid; solidText.value = p.solid;
      setMode('solid');
    }
    status('Applied ✓', 'ok');
  }

  $(`#${PANEL_ID}-copy`).addEventListener('click', () => {
    codeEl.value = currentMarkup();   // snapshot the exact frame on screen right now
    navigator.clipboard.writeText(codeEl.value).then(
      () => status('Copied this frame ✓', 'ok'),
      () => status('Copy failed', 'err'),
    );
  });
  $(`#${PANEL_ID}-apply`).addEventListener('click', () => hydrate(parseMarkup(codeEl.value)));

  // Keep the export box's `start` ticking with the live animation frame, so what
  // you copy is always the composition currently on screen. setInterval (not rAF)
  // so it survives headless/background tabs; cheap text update at 4 Hz.
  setInterval(() => {
    if (mode === 'gradient' && ggEl && ggEl._animating && document.activeElement !== codeEl) {
      codeEl.value = currentMarkup();
    }
  }, 250);

  /* ============================ mode switch ============================ */
  function setMode(m) {
    mode = m;
    panel.querySelectorAll('.modes button').forEach((b) => b.classList.toggle('is-active', b.dataset.mode === m));
    panel.querySelectorAll('.mode-pane').forEach((p) => p.classList.toggle('is-active', p.dataset.pane === m));
    applyCurrent();
  }
  panel.querySelectorAll('.modes button').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));

  /* ============================ SOLID controls ============================ */
  const solidColor = $(`#${PANEL_ID}-solid-color`);
  const solidText = $(`#${PANEL_ID}-solid-text`);
  solidColor.value = solidInit; solidText.value = solidInit;
  solidColor.addEventListener('input', () => { solidText.value = solidColor.value; if (mode === 'solid') applySolid(); updateCode(); });
  solidText.addEventListener('input', () => { if (isHex(solidText.value)) { solidColor.value = norm(solidText.value); if (mode === 'solid') applySolid(); updateCode(); } });

  /* ============================ VIDEO controls ============================ */
  $(`#${PANEL_ID}-video-url`).value = videoInit;
  $(`#${PANEL_ID}-video-url`).addEventListener('input', () => { if (mode === 'video') applyVideo(); updateCode(); });

  /* ============================ GRADIENT controls ============================ */
  const stopsEl = $(`#${PANEL_ID}-stops`);
  function renderStops() {
    stopsEl.innerHTML = '';
    stops.forEach((hex, i) => {
      const row = document.createElement('div');
      row.className = 'stop';
      row.innerHTML = `
        <input type="color" value="${norm(hex)}" data-i="${i}" data-kind="color" />
        <input type="text" value="${hex}" data-i="${i}" data-kind="text" />
        <button data-i="${i}" data-kind="remove" title="remove" ${stops.length <= 2 ? 'disabled' : ''}>×</button>
      `;
      stopsEl.appendChild(row);
    });
    $(`#${PANEL_ID}-addstop`).disabled = stops.length >= MAX_COLORS;
  }
  function applyStops() {
    if (mode === 'gradient' && ggEl) ggEl.setAttribute('colors', stops.filter(isHex).map(norm).join(','));
    updateCode();
  }
  stopsEl.addEventListener('input', (e) => {
    const i = +e.target.dataset.i, kind = e.target.dataset.kind;
    if (kind === 'color') {
      stops[i] = e.target.value;
      stopsEl.querySelector(`input[data-kind=text][data-i="${i}"]`).value = e.target.value;
      applyStops();
    } else if (kind === 'text' && isHex(e.target.value)) {
      stops[i] = norm(e.target.value);
      stopsEl.querySelector(`input[data-kind=color][data-i="${i}"]`).value = norm(e.target.value);
      applyStops();
    }
  });
  stopsEl.addEventListener('click', (e) => {
    if (e.target.dataset.kind === 'remove' && stops.length > 2) {
      stops.splice(+e.target.dataset.i, 1); renderStops(); applyStops();
    }
  });
  $(`#${PANEL_ID}-addstop`).addEventListener('click', () => {
    if (stops.length < MAX_COLORS) { stops.push('#888888'); renderStops(); applyStops(); }
  });

  /* ============================ EST theme dropdown ============================ */
  // Picking a theme loads its [bg, complement, text] stops — the same mapping the
  // visitor-facing gradient-theme.js applies when a visitor switches theme.
  const estSel = $(`#${PANEL_ID}-est`);
  if (estSel && EST) {
    estSel.addEventListener('change', () => {
      const id = estSel.value;
      const next = id && EST.stopsFor ? EST.stopsFor(id) : null;
      if (!next) return;
      stops = next.map(norm);
      renderStops();
      applyStops();
    });
  }

  function bindRange(name) {
    const el = panel.querySelector(`input[data-range="${name}"]`);
    const out = panel.querySelector(`[data-out="${name}"]`);
    el.value = gState[name];
    const sync = () => {
      gState[name] = +el.value;
      out.textContent = (+el.value).toFixed(2);
      if (mode === 'gradient' && ggEl) ggEl.setAttribute(name, el.value);
      updateCode();
    };
    el.addEventListener('input', sync);
    out.textContent = (+el.value).toFixed(2);
  }
  ['speed', 'scale', 'contrast', 'cycles', 'glow', 'seed', 'start'].forEach(bindRange);
  function setRange(name, v) {
    const el = panel.querySelector(`input[data-range="${name}"]`);
    el.value = v; el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  const bgColor = $(`#${PANEL_ID}-bgcolor`);
  const bgText = $(`#${PANEL_ID}-bgtext`);
  bgColor.value = isHex(gState.background) ? norm(gState.background) : '#0d0d12';
  bgText.value = gState.background;
  function applyBg(hex) { gState.background = hex; if (mode === 'gradient' && ggEl) ggEl.setAttribute('background', hex); updateCode(); }
  bgColor.addEventListener('input', () => { bgText.value = bgColor.value; applyBg(bgColor.value); });
  bgText.addEventListener('input', () => { if (isHex(bgText.value)) { bgColor.value = norm(bgText.value); applyBg(norm(bgText.value)); } });
  function setBackground(hex) { bgColor.value = hex; bgText.value = hex; applyBg(hex); }

  const grainEl = panel.querySelector('input[data-toggle="grain"]');
  const staticEl = panel.querySelector('input[data-toggle="static"]');
  grainEl.checked = gState.grain; staticEl.checked = gState.static;
  grainEl.addEventListener('change', () => { gState.grain = grainEl.checked; if (mode === 'gradient' && ggEl) { if (grainEl.checked) ggEl.setAttribute('grain', '1'); else ggEl.removeAttribute('grain'); } updateCode(); });
  staticEl.addEventListener('change', () => { gState.static = staticEl.checked; if (mode === 'gradient' && ggEl) { if (staticEl.checked) ggEl.setAttribute('static', ''); else ggEl.removeAttribute('static'); } updateCode(); });

  panel.querySelectorAll('.presets button').forEach((b) => {
    b.addEventListener('click', () => {
      const p = PRESETS[b.dataset.preset];
      const cfg = Array.isArray(p) ? { colors: p } : p;
      stops = [...cfg.colors];
      renderStops();
      setRange('scale', cfg.scale ?? 1.0);
      setRange('contrast', cfg.contrast ?? 1.0);
      setRange('cycles', cfg.cycles ?? 1);
      setRange('speed', cfg.speed ?? 0.35);
      setRange('glow', cfg.glow ?? 0);
      setRange('start', cfg.start ?? 0);
      if (cfg.background !== undefined) setBackground(cfg.background);
      if (grainEl.checked !== !!cfg.grain) { grainEl.checked = !!cfg.grain; grainEl.dispatchEvent(new Event('change', { bubbles: true })); }
      applyStops();
    });
  });

  /* ============================ minimise ============================ */
  panel.querySelector('.gg-min').addEventListener('click', () => {
    panel.classList.toggle('is-collapsed');
    panel.querySelector('.gg-min').textContent = panel.classList.contains('is-collapsed') ? '+' : '−';
  });

  /* ============================ drag ============================ */
  // Drag by the header so the panel can move off the wordmark. Position is kept in
  // px left/top (clamped to the viewport) and remembered across pages/reloads.
  (function makeDraggable() {
    const handle = panel.querySelector('.gg-h');
    const minBtn = panel.querySelector('.gg-min');

    function setPos(left, top) {
      const maxL = Math.max(0, window.innerWidth - panel.offsetWidth);
      const maxT = Math.max(0, window.innerHeight - panel.offsetHeight);
      left = Math.min(Math.max(0, left), maxL);
      top = Math.min(Math.max(0, top), maxT);
      panel.style.left = left + 'px';
      panel.style.top = top + 'px';
      panel.style.right = 'auto';
      return { left, top };
    }

    // Restore a saved position (default top-left stays if none).
    const saved = loadPanelPos();
    if (saved && typeof saved.left === 'number' && typeof saved.top === 'number') {
      setPos(saved.left, saved.top);
    }

    let startX = 0, startY = 0, baseL = 0, baseT = 0, pid = null;
    function onMove(e) {
      const { left, top } = setPos(baseL + (e.clientX - startX), baseT + (e.clientY - startY));
      panel._lastPos = { left, top };
    }
    function onUp() {
      panel.classList.remove('is-dragging');
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      if (pid != null) { try { handle.releasePointerCapture(pid); } catch (e) {} pid = null; }
      if (panel._lastPos) savePanelPos(panel._lastPos.left, panel._lastPos.top);
    }
    handle.addEventListener('pointerdown', (e) => {
      if (e.target === minBtn || e.button !== 0) return; // let the minimise button click through
      const r = panel.getBoundingClientRect();
      startX = e.clientX; startY = e.clientY; baseL = r.left; baseT = r.top;
      panel.classList.add('is-dragging');
      pid = e.pointerId; try { handle.setPointerCapture(pid); } catch (e2) {}
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      e.preventDefault();
    });
  })();

  renderStops();
  setMode(startMode);   // reflect the page's current background, no surprise changes
}

// Back-compat alias (gg-edit.js historically imported mountGradientPanel).
export const mountGradientPanel = mountBackgroundPanel;
export default mountBackgroundPanel;
