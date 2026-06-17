// est-gradient-themes.js — vendored EST → gradient-stops mapping for Essential.
//
// Read by the gradient authoring tool:
//   • gg-edit/good-gradient-panel.js (authoring, ?gg-edit=1 only) — the EST-theme
//     dropdown loads a theme's stops into the panel as a starting point.
// (It previously also fed gradient-theme.js, the visitor-facing live recolor —
// that runtime override was removed when the EST theme picker was retired;
// gradient colors are now baked per page from the tool, not theme-driven.)
// Loaded as a classic script so both a classic script and a module can read it
// via window.EST_GRADIENT_THEMES (no fetch, no async, no FOUC race).
//
// ---------------------------------------------------------------------------
// ROLE → STOP MAPPING  (documented, canonical)
//
//   stops = [ bg , complement , text ]
//           [ field · secondary-hue event · ink ]
//
// Sourced from the four-channel EST composition model (BG / Ink / Complement /
// Contrast). For a *background field that page text sits on*, we deliberately
// use only the bg-family + complement and KEEP CONTRAST OUT — a near-black/near-
// white Contrast stop as a large gradient blob would wreck body-text legibility.
//   • bg        = the theme's field (Layer 1). Equals the page's live --bg.
//   • complement= the theme's secondary figural hue (Layer 3) — the "color as
//                 event" that turns a flat fill into a gradient.
//   • text      = the theme's ink (Layer 2) — coherent with the type color.
// This matches the studio's already-shipped good.design Essential preset
// ['#dbd2c0','#3c7066','#262626'] (EST-08 cream / teal / ink).
//
// LEGIBILITY is preserved at the surface level, not by altering stops: .page-bg
// carries a var(--bg) wash (--page-bg-wash, ~0.40) over the gradient. The
// gradient reads as a soft themed event; text stays on a bg-dominant field.
//
// ---------------------------------------------------------------------------
// SOURCE OF TRUTH & RE-SYNC
//   • complement — EST Theme Library DB, "Complement Hex" column
//       collection://e778fd99-40b4-4fe6-8aa4-1099e93ef031
//       (Notion: EST Theme Library, 9c1a1b54-c978-4a56-af58-2f47cdc7560b)
//   • bg / text  — MIRROR of app.js EST_THEMES (the shared EST registry,
//       anchored to EST-08). Used only for this file's panel preview now that
//       the runtime recolor is gone. Re-sync if app.js EST_THEMES changes.
//   To re-sync: pull the Complement Hex column for EST-01..EST-21 from the EST
//   Theme Library DB and update `complement` below; pull bg/text from app.js
//   EST_THEMES. Order mirrors app.js (EST-08 primary, then canonical 01..21).
// ---------------------------------------------------------------------------

window.EST_GRADIENT_THEMES = {
  // Display/dropdown order — EST-08 primary, then canonical order (matches app.js).
  order: [
    'EST-08', 'EST-01', 'EST-02', 'EST-03', 'EST-04', 'EST-05', 'EST-06',
    'EST-07', 'EST-09', 'EST-10', 'EST-11', 'EST-12', 'EST-13', 'EST-14',
    'EST-15', 'EST-16', 'EST-17', 'EST-18', 'EST-19', 'EST-20', 'EST-21',
  ],
  themes: {
    'EST-08': { name: 'Cream / Black',      bg: '#dbd2c0', complement: '#3c7066', text: '#262626' },
    'EST-01': { name: 'Black / Cream',      bg: '#262626', complement: '#526489', text: '#dbd2c0' },
    'EST-02': { name: 'Black / Gold',       bg: '#262626', complement: '#bcc3d6', text: '#96792d' },
    'EST-03': { name: 'Black / Red',        bg: '#231f20', complement: '#b4dedd', text: '#ea1f27' },
    'EST-04': { name: 'Black / Blue',       bg: '#0f0f0d', complement: '#dec5b4', text: '#006cb6' },
    'EST-05': { name: 'Brown / Cream',      bg: '#b6894e', complement: '#263a59', text: '#ddd9d3' },
    'EST-06': { name: 'White / Black',      bg: '#f9f8f7', complement: '#467575', text: '#1e1d1d' },
    'EST-07': { name: 'Cream / Red',        bg: '#ddd9d3', complement: '#2f4f4e', text: '#ea1f27' },
    'EST-09': { name: 'Cream / Orange',     bg: '#f4efe4', complement: '#263959', text: '#c17e0d' },
    'EST-10': { name: 'Light Blue / Blue',  bg: '#8cd7f8', complement: '#4f3c2f', text: '#006cb6' },
    'EST-11': { name: 'Gold / Black',       bg: '#96792d', complement: '#b4ded6', text: '#241f20' },
    'EST-12': { name: 'Orange / Maroon',    bg: '#e39d2b', complement: '#41606c', text: '#6c2b13' },
    'EST-13': { name: 'Deep Teal / Yellow', bg: '#0d3d36', complement: '#5d669c', text: '#fbd702' },
    'EST-14': { name: 'Green / Pink',       bg: '#044928', complement: '#b4ded2', text: '#de829d' },
    'EST-15': { name: 'Red / Black',        bg: '#e04f4f', complement: '#b4dede', text: '#1e1d1d' },
    'EST-16': { name: 'Purple / Lavender',  bg: '#302b4e', complement: '#ccdeb4', text: '#beb1cf' },
    'EST-17': { name: 'Red / Cream',        bg: '#db1f26', complement: '#263a59', text: '#ddd9d3' },
    'EST-18': { name: 'Aqua / Black',       bg: '#a8e0e2', complement: '#3b6262', text: '#1e1d1d' },
    'EST-19': { name: 'Pink / Red',         bg: '#f5cfd9', complement: '#2f4f4e', text: '#d72027' },
    'EST-20': { name: 'Brown / Yellow',     bg: '#96792d', complement: '#262a59', text: '#fde600' },
    'EST-21': { name: 'Teal / Yellow',      bg: '#2b937f', complement: '#262d59', text: '#fbd602' },
  },

  // [bg, complement, text] for a theme id — the canonical stop list.
  stopsFor: function (id) {
    var t = this.themes[id];
    return t ? [t.bg, t.complement, t.text] : null;
  },
};
