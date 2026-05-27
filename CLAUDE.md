# Elyxie — project context

Behavioral principles (Karpathy Skills) live at `~/.claude/CLAUDE.md` and apply repo-wide. This file only carries Elyxie-specific context.

## Stack

- React **18.3.1** + Three.js **0.160.0** (loaded via unpkg/esm.sh in `index.html`)
- esbuild for JSX → `dist/*.js` (no bundler, no framework)
- Hosted as a static one-pager on Vercel (`vercel.json`)

## Build & serve

```
node build.js          # compile *.jsx → dist/*.js (minified)
node build.js --watch  # rebuild on save
python3 -m http.server 8080 --bind 0.0.0.0   # serve on LAN
```

After every JSX change: **bump `?v=N` in `index.html`** for the 4 `<script src="dist/*.js?v=N">` tags so the browser doesn't serve stale JS.

## Architecture

- `index.html` — entry + cache-busted script tags + Three.js preamble
- `app.jsx` — page shell, `PHASES[]` array (5 hero phases with `range:[a,b]` in 0..1), section composition, theme/scroll logic
- `pendant.jsx` — Three.js scene; one `angel` `THREE.Group` driven by `tRaw = clamp(stateRef.current.progress, 0, 1)` in a 60 Hz animate loop
- `sections.jsx` — post-hero sections (video, instagram grid, brand statement, newsletter, outro, footer)
- `styles.css` — single CSS file with responsive overrides at the bottom
- `assets/models/angel.glb` — main 3D model (2.97 MB after re-compression)
- `assets/photography/*.webp` — all with 480/640/960/1440 responsive variants

## Hero phase model

Each `PHASES[i]` has `{num, label, title, sub, range:[start,end], position, theme}`. Inside `pendant.jsx`, phase-specific overrides are gated by **gaussian proximity functions** (`phase01Proximity`, `phaseOriginProximity`, `phase03Proximity`, `phaseSoulProximity`) so each override ramps in/out smoothly around its phase center.

**Anchors are byte-perfect:** at `tRaw = phase.range[0]` and `tRaw = phase.range[1]`, all proximity gaussians for *other* phases must resolve to ≈0. When adding a new phase-gated override, verify the gaussian doesn't leak into adjacent phase anchors.

## Conventions

- **Easing:** prefer `smootherstep` (quintic: `6x⁵−15x⁴+10x³`) over `easeInOut` (cubic) when changes in camera or position would otherwise feel "punchy" — it zeros 1st AND 2nd derivative at endpoints
- **Snap on scroll-idle:** controlled by `SNAP_DURATION` (currently 3000 ms — same duration also used by left-rail button clicks for a unified transition feel) and `SNAP_POINTS = [0.00, 0.29, 0.50, 0.70, 0.90, 1.00]` in `app.jsx`
- **Bilingual copy:** every text node has `{ es: '…', en: '…' }`; user-facing strings live in the PHASES array or section components
- **Comments:** long explanatory comments are normal here (especially in `pendant.jsx`) — they document *why* a magic number / gaussian σ was chosen

## Operational notes

- **Folder lives in iCloud** → watch for `* 2.webp`, `* 2.js`, etc. (sync conflicts). They're never committed
- **Default branch:** `main`. Feature branches use kebab-case (`seccion-3`, `hero-section-2`)
- **GitHub remote:** `admin-elyxie/elyxie`; `gh` CLI is at `~/bin/gh`
- **User language:** Spanish replies preferred
