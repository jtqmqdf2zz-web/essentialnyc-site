// gg-edit.js — Essential's on-page authoring tools (dormant, flag-gated).
//
// Imported ONLY by the tiny inline guard at the bottom of each page, and ONLY
// when the URL carries ?gg-edit=1. It mounts two panels:
//
//   • Parameters Tool — bottom-right. Binds to Essential's :root design tokens
//     (styles.css): fonts, type scale, wordmark sizing, color/texture, and the
//     named vertical/horizontal spacing, gaps, and navigation metrics. Type a
//     value and the page updates live; "Copy CSS" exports a :root { … } block to
//     paste back into styles.css. Same token config on every page.
//   • Background — top-left. Sets the page's gradient field (.page-bg →
//     <good-gradient>), carries the EST-theme dropdown, and "Copy"s the markup.
//
// Not visitor-facing — with the flag absent nothing here runs, so there is zero
// visitor-facing change, no panel DOM, and no console/WebGL noise.

const FLAG = 'gg-edit';

// Essential's adjustable design tokens. Mirrors the :root block in styles.css.
// Fluid clamp(min, vw, max) values are exposed as Mobile(min) + Desktop(max)
// pairs; the vw interpolation between them stays inline in the CSS. Groups
// render in this order; rows render in this order.
const ESSENTIAL_PARAMS = [
  /* ---- Color / texture ---- */
  { group: 'Color', name: 'Background (theme)', type: 'color', var: '--bg' },
  { group: 'Color', name: 'Text (theme)',       type: 'color', var: '--text' },
  { group: 'Color', name: 'Paper grain',   sharedVar: '--grain-opacity', unit: '' },
  { group: 'Color', name: 'Gradient drift', sharedVar: '--drift-opacity', unit: '' },
  { group: 'Color', name: 'Field wash',    sharedVar: '--page-bg-wash',  unit: '' },

  /* ---- Type families (swap the stack live) ---- */
  { group: 'Fonts', name: 'Display family',    type: 'text', var: '--display' },
  { group: 'Fonts', name: 'Body / UI family',  type: 'text', var: '--sans' },
  { group: 'Fonts', name: 'Annotation family', type: 'text', var: '--annot' },

  /* ---- Type scale (Mobile floor / Desktop ceiling) ---- */
  { group: 'Type', name: 'Display',    mobileVar: '--fs-display-min',    desktopVar: '--fs-display-max',    unit: 'px' },
  { group: 'Type', name: 'Display LG', mobileVar: '--fs-display-lg-min', desktopVar: '--fs-display-lg-max', unit: 'px' },
  { group: 'Type', name: 'Display MD', mobileVar: '--fs-display-md-min', desktopVar: '--fs-display-md-max', unit: 'px' },
  { group: 'Type', name: 'Display SM', mobileVar: '--fs-display-sm-min', desktopVar: '--fs-display-sm-max', unit: 'px' },
  { group: 'Type', name: 'Display XS', mobileVar: '--fs-display-xs-min', desktopVar: '--fs-display-xs-max', unit: 'px' },
  { group: 'Type', name: 'Lede',       mobileVar: '--fs-lede-min',       desktopVar: '--fs-lede-max',       unit: 'px' },
  { group: 'Type', name: 'Pitch',      mobileVar: '--fs-pitch-min',      desktopVar: '--fs-pitch-max',      unit: 'px' },
  { group: 'Type', name: 'Body copy',  sharedVar: '--fs-body',  unit: 'px' },
  { group: 'Type', name: 'Label',      sharedVar: '--fs-label', unit: 'px' },
  { group: 'Type', name: 'Annotation', sharedVar: '--fs-annot', unit: 'px' },

  /* ---- Wordmark ---- */
  { group: 'Wordmark', name: 'Nav wordmark',    sharedVar: '--wordmark-nav-w',    unit: 'px' },
  { group: 'Wordmark', name: 'Footer wordmark', sharedVar: '--wordmark-footer-w', unit: 'px' },

  /* ---- Spacing — Horizontal ---- */
  { group: 'Spacing · Horizontal', name: 'Page gutter', mobileVar: '--pad-x-min', desktopVar: '--pad-x-max', unit: 'px' },

  /* ---- Spacing — Vertical ---- */
  { group: 'Spacing · Vertical', name: 'Section rhythm', mobileVar: '--row-min',             desktopVar: '--row-max',             unit: 'px' },
  { group: 'Spacing · Vertical', name: 'Hero top inset', mobileVar: '--hero-pad-top-min',    desktopVar: '--hero-pad-top-max',    unit: 'px' },
  { group: 'Spacing · Vertical', name: 'Below heads',    mobileVar: '--section-head-mb-min', desktopVar: '--section-head-mb-max', unit: 'px' },

  /* ---- Navigation ---- */
  { group: 'Navigation', name: 'Nav padding (vert)', sharedVar: '--nav-pad-y',        unit: 'px' },
  { group: 'Navigation', name: 'Link gap',           sharedVar: '--nav-links-gap',    unit: 'px' },
  { group: 'Navigation', name: 'Link size',          sharedVar: '--nav-link-size',    unit: 'px' },
  { group: 'Navigation', name: 'Link tracking',      sharedVar: '--nav-link-tracking', unit: 'em' },
  { group: 'Navigation', name: 'CTA pad (vert)',     sharedVar: '--nav-cta-pad-y',    unit: 'px' },
  { group: 'Navigation', name: 'CTA pad (horiz)',    sharedVar: '--nav-cta-pad-x',    unit: 'px' },

  /* ---- Gaps ---- */
  { group: 'Gaps', name: 'Hero meta',     sharedVar: '--hero-meta-gap', unit: 'px' },
  { group: 'Gaps', name: 'Editorial cols', mobileVar: '--manifesto-gap-min',   desktopVar: '--manifesto-gap-max',   unit: 'px' },
  { group: 'Gaps', name: 'Footer cols',    mobileVar: '--footer-grid-gap-min', desktopVar: '--footer-grid-gap-max', unit: 'px' },
];

function flagPresent() {
  try { return new URLSearchParams(location.search).get(FLAG) === '1'; }
  catch (e) { return false; }
}

// Inject a stylesheet <link> once and resolve when it has loaded.
function loadCss(href) {
  return new Promise((resolve) => {
    if (document.querySelector(`link[data-gg-edit-css="${href}"]`)) return resolve();
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.dataset.ggEditCss = href;
    link.onload = link.onerror = () => resolve();
    document.head.appendChild(link);
  });
}

// Inject a classic <script> once and resolve when it has loaded.
function loadScript(src) {
  return new Promise((resolve) => {
    if (document.querySelector(`script[data-gg-edit-src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.dataset.ggEditSrc = src;
    s.onload = s.onerror = () => resolve();
    document.body.appendChild(s);
  });
}

async function mountParametersTool() {
  await Promise.all([
    loadCss('/parameters-tool/parameters-tool.css'),
    loadScript('/parameters-tool/parameters-tool.js'),
  ]);
  if (!window.ParametersTool) {
    console.warn('[gg-edit] ParametersTool failed to load');
    return;
  }
  window.ParametersTool.init({
    title: 'Essential — Parameters',
    parameters: ESSENTIAL_PARAMS,
  });
}

async function mountBackground() {
  try {
    // Always-fresh: the panel is internal authoring chrome (loads only behind the
    // flag), so bust the module cache every load — tool tweaks reach you on a
    // normal reload with no version juggling.
    const mod = await import('./good-gradient-panel.js?t=' + Date.now());
    await mod.mountBackgroundPanel();
  } catch (e) {
    console.warn('[gg-edit] background panel failed to mount', e);
  }
}

async function boot() {
  if (!flagPresent()) return;            // defensive: never mount without the flag
  if (window.__ggEditMounted) return;    // idempotent
  window.__ggEditMounted = true;
  await Promise.all([
    mountParametersTool(),
    mountBackground(),
  ]);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
