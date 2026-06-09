# Essential — essential.nyc

Static site for **Essential**: a design practice for the seven activities that
make a life (eat, move, restore, sleep, create, grow, connect). Essential is
Then. at personal scale — same model, same brand system, personal register.

Built in Order 34 by forking the Then. editorial chassis and reskinning to
Essential's brand (Aurea Ultra Italic display, Runda body, the EST theme
library anchored to EST-08 — cream / black).

## Pages

- `index.html` — home (hero, the idea, the seven activities, latest video, the doors, the note)
- `practice.html` — the model: the reframe, Do Loops, seven activities, three meanings, three programs
- `videos.html` — video archive (Type I / II / III), grouped by activity / thread
- `about.html` — about Essential + Matt, the three apertures, transparency note
- `contact.html` — ways to reach + the note

## System

- `styles.css` — one-surface, borders-only editorial system. Theme-driven via
  `--bg` / `--text`; everything else is `currentColor` + `color-mix`.
- `app.js` — wordmark injection (themeable inline SVG), EST theme picker (22
  themes, persisted to `localStorage`, default EST-08), mobile nav, newsletter,
  staggered intro.
- `hero-bg.js` — algorithmic pixel-grid hero background (glyphs spell "LIVE·").
  Algo-only by default; drop loop footage into `window.__resources.heroVideos`
  to dissolve into video later.
- `brand/` — wordmark + favicon source SVGs.
- `icons/` — favicon PNGs (16/32/192/512), apple-touch-icon, webmanifest.

## Type (Typekit)

- Display — Aurea Ultra Italic, ALL CAPS — kit `lbu6ooe` (`aurea-ultra`)
- Body / UI — Runda 400/500 — kit `zxr3mbw` (`runda`)
- Gestural — Caveat (Google Fonts), asides only

## Brand & content sources (Notion)

- DESIGN.md — Essential: `34a2e66ff4658193bc05e1759cd64f95`
- essential_project_details: `33e2e66ff465811bb635c7aaefad9e16`
- EST Theme Library: `3342e66ff46581749d57f0236dbf7e52`

Compliance: no medical / therapeutic claims; doTERRA appears only as a
transparent, one-line disclosure (no income or health claims).

## Deploy

Cloudflare Pages, repo `jtqmqdf2zz-web/essentialnyc-site`, custom domain
**https://essential.nyc**. Deploy = `git push` to `main`; the Pages project
auto-builds on push. Tracked in the Web Hosting DB (row "Essential.nyc").

This is a duplicate of the Essential site (essn.tl) for the Essential NYC
property, with the domain swapped to essential.nyc. The wordmark is held at
"Essential" — same brand system, no "NYC" in the visual identity for now.
