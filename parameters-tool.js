// Parameters Tool — dev-only live editor for design tokens.
//
// Drops a small panel into the bottom-right of the page that mirrors a site's
// CSS-variable-driven tokens. Three kinds of token are supported:
//
//   • Colors        — a swatch + hex field per token. Editing either writes the
//                      new value to :root immediately (e.g. --bg, --text).
//   • Type / spacing — a numeric field per breakpoint (mobile / desktop), with
//                      a unit appended verbatim (px, em, rem…). Essential's
//                      fluid clamp(min, vw, max) values are tokenised as a
//                      min (mobile floor) + max (desktop ceiling) pair, so the
//                      two columns map onto the clamp bounds directly.
//   • Text          — a free-text field per token, written verbatim to :root.
//                      Used for font-family stacks so they can be swapped live.
//
// Edits write straight to document.documentElement via setProperty, so the page
// updates live. The source CSS is never touched — use "Copy CSS" to grab a
// :root { … } block of the current values and paste it back into styles.css.
//
// Usage:
//   ParametersTool.init({
//     title: 'Essential — Parameters',
//     parameters: [
//       { group: 'Color', name: 'Background', type: 'color', var: '--bg' },
//       { group: 'Type',  name: 'Display family', type: 'text', var: '--display' },
//       { group: 'Type',  name: 'Display', mobileVar: '--fs-display-min', desktopVar: '--fs-display-max', unit: 'px' },
//       { group: 'Type',  name: 'Body', sharedVar: '--fs-body', unit: 'px' },
//     ]
//   });
//
// Not visitor-facing — mounted only behind ?gg-edit=1 (see gg-edit/gg-edit.js).
'use strict';

(function () {
  const NS = 'param-tool';
  let config = null;
  let panel = null;

  function init(opts) {
    if (!opts || !Array.isArray(opts.parameters)) {
      console.warn('[parameters-tool] init() needs { parameters: [...] }');
      return;
    }
    config = opts;
    injectPanel();
    wire();
  }

  function isColor(p) {
    return p.type === 'color';
  }
  function isText(p) {
    return p.type === 'text';
  }

  function injectPanel() {
    // Group params by their `group` (section). Sections keep the order in which
    // their first param appears in the config (not alphabetised), so the author
    // controls the panel's reading order. Rows keep config order too.
    const groups = {};
    const order = [];
    config.parameters.forEach((p) => {
      const g = p.group || 'Other';
      if (!groups[g]) { groups[g] = []; order.push(g); }
      groups[g].push(p);
    });

    const sections = order
      .map((g) => {
        const params = groups[g];
        const colors = params.filter(isColor);
        const texts = params.filter(isText);
        const numerics = params.filter((p) => !isColor(p) && !isText(p));
        let inner = '';
        if (colors.length) {
          inner += `<table><tbody>${colors.map(renderColorRow).join('')}</tbody></table>`;
        }
        if (texts.length) {
          inner += `<table><tbody>${texts.map(renderTextRow).join('')}</tbody></table>`;
        }
        if (numerics.length) {
          inner += `<table>
              <thead>
                <tr>
                  <th class="${NS}-col-name">Element</th>
                  <th class="${NS}-col-val">Mobile</th>
                  <th class="${NS}-col-val">Desktop</th>
                </tr>
              </thead>
              <tbody>${numerics.map(renderNumericRow).join('')}</tbody>
            </table>`;
        }
        return `<div class="${NS}-section"><p class="${NS}-section-title">${escapeHtml(g)}</p>${inner}</div>`;
      })
      .join('');

    panel = document.createElement('aside');
    panel.id = NS;
    panel.setAttribute('aria-label', 'Design parameters editor');
    panel.innerHTML = `
      <header class="${NS}-header">
        <span class="${NS}-title">${escapeHtml(config.title || 'Parameters Tool')}</span>
        <button class="${NS}-copy" type="button" title="Copy current values as CSS">Copy CSS</button>
        <button class="${NS}-toggle" type="button" aria-label="Toggle panel">−</button>
      </header>
      <div class="${NS}-body">
        ${sections}
      </div>
    `;
    document.body.appendChild(panel);
  }

  /* ---------- Color rows ---------- */

  function renderColorRow(p) {
    const cssVar = p.var;
    const val = normalizeHex(getCssVar(cssVar)) || '#000000';
    return `
      <tr>
        <td class="${NS}-name" title="${escapeHtml(cssVar)}">${escapeHtml(p.name)}</td>
        <td class="${NS}-color-cell" colspan="2">
          <span class="${NS}-color-wrap">
            <input type="color" class="${NS}-swatch" data-color-var="${escapeHtml(cssVar)}" value="${val}">
            <input type="text" class="${NS}-hex" data-color-hex="${escapeHtml(cssVar)}"
                   value="${val}" spellcheck="false" maxlength="7" aria-label="${escapeHtml(p.name)} hex">
          </span>
        </td>
      </tr>
    `;
  }

  /* ---------- Text rows (font-family stacks etc.) ---------- */

  function renderTextRow(p) {
    const cssVar = p.var;
    const val = getCssVar(cssVar);
    return `
      <tr>
        <td class="${NS}-name" title="${escapeHtml(cssVar)}">${escapeHtml(p.name)}</td>
        <td class="${NS}-text-cell" colspan="2">
          <input type="text" class="${NS}-text" data-text-var="${escapeHtml(cssVar)}"
                 value="${escapeHtml(val)}" spellcheck="false" aria-label="${escapeHtml(p.name)} value">
        </td>
      </tr>
    `;
  }

  /* ---------- Numeric (type / spacing) rows ---------- */

  function renderNumericRow(p) {
    const mvar = p.mobileVar || p.sharedVar;
    const dvar = p.desktopVar || p.sharedVar;
    const shared = mvar === dvar;
    const unit = p.unit || 'px';
    const mval = parseValue(getCssVar(mvar));
    const dval = parseValue(getCssVar(dvar));
    const dCell = shared
      ? `<td class="${NS}-shared">↑ shared</td>`
      : `<td>${numInput(dvar, dval, unit, dvar + '-d')}</td>`;
    return `
      <tr>
        <td class="${NS}-name" title="${escapeHtml(mvar)}${shared ? '' : ' / ' + escapeHtml(dvar)}">${escapeHtml(p.name)}</td>
        <td>${numInput(mvar, mval, unit, mvar + '-m')}</td>
        ${dCell}
      </tr>
    `;
  }

  function numInput(cssVar, val, unit, id) {
    return `
      <span class="${NS}-input-wrap">
        <input type="number" step="any" data-var="${escapeHtml(cssVar)}" data-unit="${escapeHtml(unit)}" id="${NS}-${id}" value="${val}">
        <span class="${NS}-unit">${escapeHtml(unit)}</span>
      </span>
    `;
  }

  /* ---------- Wiring ---------- */

  function wire() {
    // Numeric inputs
    panel.querySelectorAll('input[data-var]').forEach((input) => {
      input.addEventListener('input', () => applyNumeric(input));
      input.addEventListener('change', () => applyNumeric(input));
    });

    // Text inputs — live as you type.
    panel.querySelectorAll('input[data-text-var]').forEach((input) => {
      input.addEventListener('input', () => {
        document.documentElement.style.setProperty(input.dataset.textVar, input.value);
      });
    });

    // Color swatches
    panel.querySelectorAll('input[data-color-var]').forEach((swatch) => {
      swatch.addEventListener('input', () => {
        const cssVar = swatch.dataset.colorVar;
        applyColor(cssVar, swatch.value);
        syncHex(cssVar, swatch.value);
      });
    });

    // Hex text fields — commit on Enter or blur only. We deliberately do NOT
    // reformat the field while typing (doing so fought the user's input, e.g.
    // expanding "#fff" to "#ffffff" mid-keystroke).
    panel.querySelectorAll('input[data-color-hex]').forEach((field) => {
      const commit = () => {
        const cssVar = field.dataset.colorHex;
        const hex = normalizeHex(field.value);
        if (!hex) return;            // ignore partial/invalid input
        field.value = hex;
        applyColor(cssVar, hex);
        syncSwatch(cssVar, hex);
      };
      field.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); commit(); field.blur(); }
      });
      field.addEventListener('change', commit);   // fires on blur
    });

    panel.querySelector(`.${NS}-toggle`).addEventListener('click', () => {
      panel.classList.toggle('is-collapsed');
      panel.querySelector(`.${NS}-toggle`).textContent =
        panel.classList.contains('is-collapsed') ? '+' : '−';
    });
    panel.querySelector(`.${NS}-copy`).addEventListener('click', copyAsCss);
  }

  function applyNumeric(input) {
    const cssVar = input.dataset.var;
    const unit = input.dataset.unit;
    const val = input.value;
    if (val === '') return;
    document.documentElement.style.setProperty(cssVar, val + unit);
  }

  function applyColor(cssVar, hex) {
    document.documentElement.style.setProperty(cssVar, hex);
  }

  function syncHex(cssVar, hex) {
    const field = panel.querySelector(`input[data-color-hex="${cssVarSel(cssVar)}"]`);
    if (field) field.value = hex;
  }

  function syncSwatch(cssVar, hex) {
    const swatch = panel.querySelector(`input[data-color-var="${cssVarSel(cssVar)}"]`);
    if (swatch) swatch.value = hex;
  }

  /* ---------- Copy CSS ---------- */

  function copyAsCss() {
    // Build a :root { … } block of every parameter's current value (after
    // edits). Pasting this over styles.css's :root makes the values permanent.
    const seen = new Set();
    const lines = [];
    config.parameters.forEach((p) => {
      const vars = isColor(p) || isText(p)
        ? [p.var]
        : [p.mobileVar, p.desktopVar, p.sharedVar];
      vars.forEach((v) => {
        if (!v || seen.has(v)) return;
        seen.add(v);
        const cur = (document.documentElement.style.getPropertyValue(v) || getCssVar(v)).trim();
        lines.push(`  ${v}: ${cur};`);
      });
    });
    const css = `:root {\n${lines.join('\n')}\n}`;
    navigator.clipboard.writeText(css).then(
      () => flashCopy('Copied!'),
      () => flashCopy('Copy failed'),
    );
  }

  function flashCopy(text) {
    const btn = panel.querySelector(`.${NS}-copy`);
    const old = btn.textContent;
    btn.textContent = text;
    setTimeout(() => { btn.textContent = old; }, 1200);
  }

  /* ---------- Helpers ---------- */

  function getCssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function parseValue(str) {
    const n = parseFloat(str);
    return isNaN(n) ? '' : n;
  }

  // Accepts #rgb / #rrggbb (with or without leading #) and returns #rrggbb, or
  // null if the string isn't a complete hex color.
  function normalizeHex(str) {
    if (!str) return null;
    let s = String(str).trim().replace(/^#/, '');
    if (/^[0-9a-fA-F]{3}$/.test(s)) {
      s = s.split('').map((c) => c + c).join('');
    }
    return /^[0-9a-fA-F]{6}$/.test(s) ? '#' + s.toLowerCase() : null;
  }

  // CSS.escape fallback for attribute-selector values (CSS var names contain --).
  function cssVarSel(v) {
    return (window.CSS && CSS.escape) ? CSS.escape(v) : v.replace(/[^a-zA-Z0-9_-]/g, '\\$&');
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  window.ParametersTool = { init };
})();
