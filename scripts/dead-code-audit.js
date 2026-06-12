#!/usr/bin/env node
// dead-code-audit.js — auditoría reproducible de código/assets muertos del repo Elyxie.
// SOLO LECTURA: no modifica nada. Uso: node scripts/dead-code-audit.js
//
// Es la fuente canónica de las listas de PLAN-LIMPIEZA-CODIGO-MUERTO.md (anexos A/B).
// Antes de ejecutar cualquier fase de limpieza en otra rama: correr este script y
// comparar la línea VALIDACIÓN con la del documento — si difiere, STOP y reauditar.
//
// Metodología (resumen; detalle en el documento):
//   1. Grafo vivo: templates JSON → secciones → snippets ({% render %}/{% include %},
//      cierre transitivo) + layouts + gift_card.liquid (convención Shopify).
//   2. Corpus vivo para assets: liquid vivos + fuentes raíz + config, con comentarios
//      (liquid/HTML/CSS y líneas // de JS) EXCLUIDOS para no contar menciones muertas.
//      Punto fijo: un asset css/js que resulta vivo entra al corpus y puede vivificar otros.
//   3. Referencias dinámicas (whitelist DYNAMIC_RULES): nombres construidos en runtime
//      que un grep literal no ve (vitrina, instagram, grid).
//   4. Section Rendering API (KEEP_SRA): secciones pedidas por string desde JS vivo,
//      sin {% section %} alguno. Hay además un detector de drift que avisa si aparece
//      una nueva mención de sección "muerta" en JS vivo.
//   5. Cascada: assets referenciados SOLO por archivos muertos, con el subset del
//      commit en que cae su último referenciador (2.1 main-*/snippets · 2.3 preset · AMBOS).

'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const T = path.join(ROOT, 'theme');
const read = (f) => fs.readFileSync(f, 'utf8');
const kb = (f) => fs.statSync(f).size / 1024;
const mb = (n) => (n / 1024).toFixed(1) + ' MB';

// ---------------------------------------------------------------- configuración
// Secciones vivas vía Section Rendering API: cart.js / cart-drawer.js (vivos) las piden
// por string (`section: 'cart-icon-bubble'`, getSectionsToRender). Borrarlas rompe el
// badge del carrito, el re-render del drawer y el live-region de accesibilidad.
const KEEP_SRA = ['cart-icon-bubble', 'cart-drawer', 'cart-live-region-text'];
// Conservadas por decisión (🔴): apps.liquid es el host de secciones de apps de Shopify.
const KEEP_RED = ['apps'];
// Menciones esperadas de nombres "muertos" en JS vivo que NO son uso real (documentadas):
//   main-cart-items / main-cart-footer: cart.js los usa como IDs del DOM; elyxie-cart-page
//   replica esos ids con data-id="{{ section.id }}" — la API usa el id vivo, no el archivo.
//   announcement-bar/slideshow/quick-order-list/bulk-quick-order-list/header-drawer/
//   quantity-input/cart-notification: custom elements condicionales en global.js/
//   theme-editor.js/product-form.js — no instancian si la sección no está en el DOM.
const SRA_FALSE_POSITIVES = ['main-cart-items', 'main-cart-footer', 'announcement-bar',
  'slideshow', 'quick-order-list', 'bulk-quick-order-list', 'header-drawer',
  'quantity-input', 'cart-notification', 'newsletter', 'video', 'page', 'header', 'footer',
  'contact-form', 'featured-collection', 'predictive-search', 'main-404', 'main-article',
  'main-cart-footer', 'main-list-collections', 'main-page', 'main-product', 'main-search',
  // clases CSS en secciones elyxie, no renders: elyxie-account.liquid:716 class="pagination",
  // elyxie-cart-page/product/vitrina usan "price" como clase.
  'pagination', 'price'];
// Secciones Dawn con `presets` en su schema → activables desde "Add section" del editor
// aunque nadie las referencie. Por decisión del 2026-06-12 se borran igual (commit 2.3).
const PRESET_SECTIONS = ['announcement-bar', 'collage', 'collapsible-content',
  'collection-list', 'contact-form', 'custom-liquid', 'email-signup-banner',
  'featured-blog', 'featured-collection', 'featured-product', 'image-banner',
  'image-with-text', 'multicolumn', 'multirow', 'newsletter', 'page',
  'quick-order-list', 'rich-text', 'slideshow', 'video'];
// Referencias dinámicas: patrones de nombres construidos en runtime.
const DYNAMIC_RULES = [
  [/^(dije|cadena)-(oro|plata|rodio)-(el|ella)(-\d+)?\.(webp|jpg)$/,
    'sections.jsx:771,886,942 — `assets/ecommerce/${v.prefix}-${finish}-${chain}` + sizes (fallback vitrina)'],
  [/^insta-real-0[1-3](-(480|960))?\.(webp|jpg)$/,
    'sections.jsx:1527-1541 — `${ebase}` + sufijos -480/-960/.webp/.jpg'],
  [/^grid-0[1-4](-480)?\.(webp|jpg)$/,
    'app.jsx:944-945 — e.img.replace(/\\.jpg$/, ".webp" | "-480.webp")'],
  // ZONA CALIENTE (12-jun-2026): la pipeline de video de fondo está en rework en una
  // sesión paralela (bgVideoSrc construye `${base}-{1080|1440|2160}.mp4`; main-film usa
  // tiers 720/1080/1440; elyxie-story usa -2160/-1440/-m). TODOS los .mp4 quedan
  // whitelisted hasta que esa rama aterrice — re-evaluar variantes viejas (-720, base
  // sin sufijo) en una auditoría posterior al merge.
  [/^(origen-bg|templo-dia-bg|templo-noche-bg|tribu-bg|main-film)(-[\w]+)?\.mp4$/,
    'ZONA CALIENTE video: bgVideoSrc/app.jsx + tiers main-film/sections.jsx + elyxie-story — re-evaluar tras merge'],
];
const DYNAMIC_RULES_ROOT = [
  /^assets\/ecommerce\/(dije|cadena)-(oro|plata|rodio)-(el|ella)(-\d+)?\.(webp|jpg)$/,
  /^assets\/photography\/insta-real-0[1-3](-(480|960))?\.(webp|jpg)$/,
  /^assets\/photography\/grid-0[1-4](-480)?\.(webp|jpg)$/,
  /^assets\/video\//, // ZONA CALIENTE video (ver DYNAMIC_RULES)
];
const ROOT_SOURCES = ['index.html', 'styles.css', 'app.jsx', 'sections.jsx',
  'pendant.jsx', 'tweaks-panel.jsx', 'lightbox.js', 'build.js'];
// Locales intocables (copy bilingüe de la tienda).
const LOCALE_KEEP = /^(es|en\.default)\./;

// ---------------------------------------------------------------- helpers
function strip(c, ext) {
  c = c.replace(/\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g, '');
  c = c.replace(/<!--[\s\S]*?-->/g, '');
  c = c.replace(/\/\*[\s\S]*?\*\//g, '');
  if (ext === '.js' || ext === '.jsx') c = c.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
  return c;
}
const Q = '["\']';
const renderRe = new RegExp('\\{%-?\\s*(?:render|include)\\s+' + Q + '([^"\']+)' + Q, 'g');

// ---------------------------------------------------------------- 1. grafo vivo
const tplFiles = [];
for (const dir of ['templates', 'templates/customers']) {
  for (const f of fs.readdirSync(path.join(T, dir))) {
    if (f.endsWith('.json')) tplFiles.push(dir + '/' + f);
  }
}
const liveSections = new Set([...KEEP_SRA, ...KEEP_RED]);
for (const f of tplFiles) {
  const j = JSON.parse(read(path.join(T, f)));
  Object.values(j.sections || {}).forEach((s) => liveSections.add(s.type));
}
const liveLayouts = ['theme', 'elyxie', 'elyxie-page', 'elyxie-password'];
const liveGroups = ['elyxie-header-group', 'elyxie-footer-group'];
for (const g of liveGroups) {
  const j = JSON.parse(read(path.join(T, 'sections', g + '.json')));
  Object.values(j.sections || {}).forEach((s) => liveSections.add(s.type));
}
const liveFiles = new Set(['templates/gift_card.liquid']);
liveLayouts.forEach((l) => liveFiles.add('layout/' + l + '.liquid'));
liveSections.forEach((s) => liveFiles.add('sections/' + s + '.liquid'));
// cierre transitivo de snippets
{
  const queue = [...liveFiles];
  while (queue.length) {
    const f = queue.pop();
    const p = path.join(T, f);
    if (!fs.existsSync(p)) continue;
    for (const m of strip(read(p), '.liquid').matchAll(renderRe)) {
      const sn = 'snippets/' + m[1] + '.liquid';
      if (!liveFiles.has(sn)) { liveFiles.add(sn); queue.push(sn); }
    }
  }
}

// ---------------------------------------------------------------- 2. liquid muerto
const allSections = fs.readdirSync(path.join(T, 'sections')).filter((f) => f.endsWith('.liquid')).map((f) => f.slice(0, -7));
const allSnippets = fs.readdirSync(path.join(T, 'snippets')).filter((f) => f.endsWith('.liquid')).map((f) => f.slice(0, -7));
const allLayouts = fs.readdirSync(path.join(T, 'layout')).filter((f) => f.endsWith('.liquid')).map((f) => f.slice(0, -7));
const deadSections = allSections.filter((s) => !liveSections.has(s));
const deadSnippets = allSnippets.filter((s) => !liveFiles.has('snippets/' + s + '.liquid'));
const deadLayouts = allLayouts.filter((l) => !liveLayouts.includes(l)); // → password
const deadGroups = fs.readdirSync(path.join(T, 'sections')).filter((f) => f.endsWith('.json') && !liveGroups.includes(f.slice(0, -5)));
const sec21 = deadSections.filter((s) => !PRESET_SECTIONS.includes(s)).sort();
const sec23 = deadSections.filter((s) => PRESET_SECTIONS.includes(s)).sort();

// archivo muerto → commit en que cae
const fileGroup = (rel) => {
  if (rel.startsWith('snippets/') || rel.startsWith('layout/')) return '2.1';
  const n = rel.replace(/^sections\//, '').replace(/\.(liquid|json)$/, '');
  return PRESET_SECTIONS.includes(n) ? '2.3' : '2.1';
};
const deadLiquidRel = [
  ...deadSections.map((s) => 'sections/' + s + '.liquid'),
  ...deadSnippets.map((s) => 'snippets/' + s + '.liquid'),
  ...deadLayouts.map((l) => 'layout/' + l + '.liquid'),
];

// ---------------------------------------------------------------- 3. assets: vivos por punto fijo
const themeAssets = fs.readdirSync(path.join(T, 'assets')).filter((f) => !f.startsWith('.'));
const liveCorpus = new Map();
for (const f of liveFiles) {
  const p = path.join(T, f);
  if (fs.existsSync(p)) liveCorpus.set('theme/' + f, strip(read(p), '.liquid'));
}
for (const f of ROOT_SOURCES) liveCorpus.set(f, strip(read(path.join(ROOT, f)), path.extname(f)));
liveCorpus.set('theme/config/settings_data.json', read(path.join(T, 'config/settings_data.json')));
liveCorpus.set('theme/config/settings_schema.json', read(path.join(T, 'config/settings_schema.json')));

const assetStatus = {}; // nombre -> { status: DYNAMIC|USED, via: [] }
const liveAssets = new Set();
// styles.css.liquid compila al asset `styles.css` que cargan los layouts → vivo por convención.
liveAssets.add('styles.css.liquid');
assetStatus['styles.css.liquid'] = { status: 'USED', via: ['convención: compila a styles.css ({{ \'styles.css\' | asset_url }})'] };
liveCorpus.set('theme/assets/styles.css.liquid', strip(read(path.join(T, 'assets/styles.css.liquid')), '.css'));
let changed = true;
while (changed) {
  changed = false;
  for (const a of themeAssets) {
    if (liveAssets.has(a)) continue;
    const dyn = DYNAMIC_RULES.find(([re]) => re.test(a));
    if (dyn) { liveAssets.add(a); assetStatus[a] = { status: 'DYNAMIC', via: [dyn[1]] }; changed = true; continue; }
    const hits = [];
    for (const [f, c] of liveCorpus) {
      if (f === 'theme/assets/' + a) continue;
      if (c.includes(a)) hits.push(f);
    }
    if (hits.length) {
      liveAssets.add(a);
      assetStatus[a] = { status: 'USED', via: hits.slice(0, 4) };
      if (/\.(css|js)$/.test(a)) liveCorpus.set('theme/assets/' + a, strip(read(path.join(T, 'assets/' + a)), path.extname(a)));
      changed = true;
    }
  }
}

// ---------------------------------------------------------------- 4. huérfanos y cascada
const deadAssets = themeAssets.filter((a) => !liveAssets.has(a));
const deadCorpus = new Map();
for (const f of deadLiquidRel) deadCorpus.set('theme/' + f, read(path.join(T, f)));
for (const a of deadAssets) if (/\.(css|js)$/.test(a)) deadCorpus.set('theme/assets/' + a, read(path.join(T, 'assets/' + a)));

const orphans = [];
const cascade = {}; // asset -> { refs: [], group: '2.1'|'2.3'|'AMBOS' }
{
  const refsOf = (a) => {
    const r = [];
    for (const [f, c] of deadCorpus) { if (f !== 'theme/assets/' + a && c.includes(a)) r.push(f); }
    return r;
  };
  const assetGroup = {};
  let pending = [];
  for (const a of deadAssets) {
    const refs = refsOf(a);
    if (!refs.length) orphans.push(a);
    else pending.push([a, refs]);
  }
  for (let pass = 0; pass < 6 && pending.length; pass++) {
    const next = [];
    for (const [a, refs] of pending) {
      const groups = new Set(refs.map((f) => {
        if (f.startsWith('theme/assets/')) return assetGroup[f.replace('theme/assets/', '')] || 'PEND';
        return fileGroup(f.replace('theme/', ''));
      }));
      if (groups.has('PEND')) { next.push([a, refs]); continue; }
      const g = groups.has('2.3') ? (groups.has('2.1') ? 'AMBOS' : '2.3') : '2.1';
      assetGroup[a] = g;
      cascade[a] = { refs: refs.map((r) => r.replace('theme/', '')), group: g };
    }
    pending = next;
  }
  for (const [a, refs] of pending) cascade[a] = { refs: refs.map((r) => r.replace('theme/', '')), group: 'CICLO-REVISAR' };
}
// subgrupos de Fase 1
const F1_JSCSS = orphans.filter((a) => /\.(css|js)$/.test(a)).sort();
const F1_ICONS = orphans.filter((a) => a.startsWith('icon-')).sort();
const F1_FOTOS = orphans.filter((a) => !/\.(css|js)$/.test(a) && !a.startsWith('icon-')).sort();

// ---------------------------------------------------------------- 5. assets raíz
const rootAssets = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p); else rootAssets.push(path.relative(ROOT, p));
  }
})(path.join(ROOT, 'assets'));
const rootCorpus = ROOT_SOURCES.map((f) => strip(read(path.join(ROOT, f)), path.extname(f)));
const rootDead = rootAssets.filter((a) => {
  if (a.startsWith('assets/checkout-branding/')) return false; // 🔴 uso externo (checkout de Shopify)
  if (DYNAMIC_RULES_ROOT.some((re) => re.test(a))) return false;
  const base = path.basename(a);
  return !rootCorpus.some((c) => c.includes(a) || c.includes(base));
}).sort();

// ---------------------------------------------------------------- 6. locales
const deadLocales = fs.readdirSync(path.join(T, 'locales')).filter((f) => !LOCALE_KEEP.test(f)).sort();

// ---------------------------------------------------------------- 7. detector de drift SRA
// Si un nombre de sección/snippet muerto aparece entrecomillado en JS vivo y no está en la
// lista de falsos positivos documentados, algo cambió desde la auditoría → revisar a mano.
const driftWarnings = [];
{
  const liveJsContent = [];
  for (const [f, c] of liveCorpus) if (/\.(js|jsx|html)$/.test(f) || f.endsWith('.liquid')) liveJsContent.push([f, c]);
  for (const n of [...deadSections, ...deadSnippets]) {
    if (SRA_FALSE_POSITIVES.includes(n)) continue;
    const re = new RegExp('[\'"/]' + n.replace(/-/g, '[-]') + '[\'".?&]');
    for (const [f, c] of liveJsContent) {
      if (re.test(c)) { driftWarnings.push(n + '  <- ' + f); break; }
    }
  }
}

// ---------------------------------------------------------------- salida
const out = [];
const sumT = (l) => l.reduce((s, a) => s + kb(path.join(T, 'assets', a)), 0);
const sumR = (l) => l.reduce((s, a) => s + kb(path.join(ROOT, a)), 0);
const listT = (l) => l.map((a) => '  theme/assets/' + a + '  (' + kb(path.join(T, 'assets', a)).toFixed(1) + ' KB)').join('\n');

out.push('== F1.1 FOTOS HUÉRFANAS THEME (' + F1_FOTOS.length + ' archivos, ' + mb(sumT(F1_FOTOS)) + ') ==');
out.push(listT(F1_FOTOS));
out.push('\n== F1.2a JS/CSS HUÉRFANOS THEME (' + F1_JSCSS.length + ', ' + sumT(F1_JSCSS).toFixed(0) + ' KB) ==');
out.push(listT(F1_JSCSS));
out.push('\n== F1.2b ÍCONOS HUÉRFANOS THEME (' + F1_ICONS.length + ', ' + sumT(F1_ICONS).toFixed(0) + ' KB) ==');
out.push(listT(F1_ICONS));
out.push('\n== F1.3 ASSETS RAÍZ MUERTOS (' + rootDead.length + ', ' + mb(sumR(rootDead)) + ') ==');
out.push(rootDead.map((a) => '  ' + a + '  (' + kb(path.join(ROOT, a)).toFixed(1) + ' KB)').join('\n'));
out.push('\n== F2.1 LIQUID SIN PRESET — secciones (' + sec21.length + ') + layout (' + deadLayouts.length + ') + groups (' + deadGroups.length + ') + snippets (' + deadSnippets.length + ') ==');
out.push(sec21.map((s) => '  theme/sections/' + s + '.liquid').join('\n'));
out.push(deadLayouts.map((l) => '  theme/layout/' + l + '.liquid').join('\n'));
out.push(deadGroups.map((g) => '  theme/sections/' + g).join('\n'));
out.push(deadSnippets.sort().map((s) => '  theme/snippets/' + s + '.liquid').join('\n'));
out.push('\n== F2.3 SECCIONES CON PRESET (' + sec23.length + ') ==');
out.push(sec23.map((s) => '  theme/sections/' + s + '.liquid').join('\n'));
for (const g of ['2.1', '2.3', 'AMBOS', 'CICLO-REVISAR']) {
  const rows = Object.entries(cascade).filter(([, v]) => v.group === g);
  if (!rows.length) continue;
  const label = g === '2.1' ? 'F2.2 CASCADA (cae con 2.1)' : g === '2.3' ? 'F2.3-CASCADA (cae con las preset)' : g === 'AMBOS' ? 'CASCADA-AMBOS (cae solo tras 2.1 Y 2.3)' : 'CASCADA EN CICLO (revisar a mano)';
  out.push('\n== ' + label + ' — ' + rows.length + ' assets, ' + sumT(rows.map(([a]) => a)).toFixed(0) + ' KB ==');
  out.push(rows.sort().map(([a, v]) => '  theme/assets/' + a.padEnd(40) + ' <- ' + v.refs.slice(0, 3).join(', ')).join('\n'));
}
out.push('\n== F2.4 LOCALES NO PUBLICADOS (' + deadLocales.length + ', ' + (deadLocales.reduce((s, f) => s + kb(path.join(T, 'locales', f)), 0) / 1024).toFixed(2) + ' MB) ==');
out.push(deadLocales.map((f) => '  theme/locales/' + f).join('\n'));
out.push('\n== LIQUID VIVO (referencia, ' + liveFiles.size + ' archivos) ==');
out.push([...liveFiles].sort().map((f) => '  theme/' + f).join('\n'));
out.push('\n== ASSETS DYNAMIC (referencia) ==');
out.push(Object.entries(assetStatus).filter(([, v]) => v.status === 'DYNAMIC').map(([a, v]) => '  ' + a.padEnd(30) + ' ' + v.via[0]).sort().join('\n'));
if (driftWarnings.length) {
  out.push('\n!! DRIFT SRA — nombres muertos citados en corpus vivo fuera de los falsos positivos documentados. REVISAR ANTES DE BORRAR:');
  out.push(driftWarnings.map((w) => '  ' + w).join('\n'));
}
const casc = (g) => Object.values(cascade).filter((v) => v.group === g).length;
out.push('\nVALIDACIÓN: huérfanos-theme=' + orphans.length + ' (fotos=' + F1_FOTOS.length + ' jscss=' + F1_JSCSS.length + ' iconos=' + F1_ICONS.length + ') · raíz=' + rootDead.length +
  ' · 2.1-liquid=' + (sec21.length + deadLayouts.length + deadGroups.length + deadSnippets.length) +
  ' (secciones=' + sec21.length + ' layout=' + deadLayouts.length + ' groups=' + deadGroups.length + ' snippets=' + deadSnippets.length + ')' +
  ' · preset=' + sec23.length + ' · cascada=' + casc('2.1') + '/' + casc('2.3') + '/' + casc('AMBOS') +
  (casc('CICLO-REVISAR') ? '/CICLO=' + casc('CICLO-REVISAR') : '') + ' · locales=' + deadLocales.length +
  ' · drift=' + driftWarnings.length);
console.log(out.join('\n'));
