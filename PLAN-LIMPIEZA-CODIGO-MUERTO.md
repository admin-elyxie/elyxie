# PLAN DE LIMPIEZA DE CÓDIGO MUERTO — ELYXIE (v2, ejecutable)

> **Documento de auditoría + runbook de remediación. NO ejecutado.**
> v2 generada: 2026-06-12 (v1 misma fecha; v2 corrige conteos, incrusta listas, resuelve decisiones y añade runbook copy-paste).
> Fuente canónica de listas: `scripts/dead-code-audit.js` (committeable, solo lectura). Las listas de los Anexos A/B son su salida del 12-jun.
> **⚠️ ZONA CALIENTE:** una sesión paralela está rehaciendo la pipeline de video de fondo (12-jun, `bgVideoSrc` con tiers 1080/1440/2160, `main-film-{720,1080,1440}`). Todos los `.mp4` están **whitelisted** y fuera de este plan. Re-evaluar variantes viejas (`-720`, base sin sufijo) en una auditoría posterior al merge de esa rama.

## 0. Decisiones tomadas (12-jun-2026, confirmadas por Mark)

| Decisión | Respuesta |
|---|---|
| 20 secciones Dawn con preset (opciones del editor) | **Borrar** (commit 2.3) |
| 47 locales no publicados | **Borrar** (commit 2.4) |
| Originales fotográficos (~50 MB de material de marca) | **Archivar fuera del repo antes de `git rm`** |
| Alcance de la sesión de planificación | Solo doc v2 + script; **la limpieza la ejecuta otra sesión con este runbook** |

Pendientes residuales (§8): metadatos Dawn inertes + `.thumbnail` (recomendado borrar, falta OK), confirmación de `apps.liquid` en 🔴, dato informativo sobre Vercel legacy.

---

## 1. Resumen ejecutivo

| Métrica | Valor |
|---|---|
| Archivos trackeados analizados | 720 (569 en `theme/`, resto raíz + `dist/`) |
| 🟢 SEGURO (Fase 1) | **118 archivos + 4 símbolos JS** ≈ **142 MB** (83 assets theme ≈ 71 MB · 35 assets raíz ≈ 71 MB · ~80 líneas JSX) |
| 🟡→**APROBADO** (Fase 2) | **199 archivos** ≈ **3.6 MB / ~22 100 líneas Liquid** (64 liquid sin preset + 20 con preset + 106 assets cascada + 47 locales + meta Dawn pendiente de OK) |
| 🔴 NO TOCAR | 16 casos documentados (§5) |
| Total eliminable | **~146 MB y ~22 500 líneas** |

El grueso del peso muerto: **fotografías huérfanas duplicadas** (raíz + `theme/assets/`): originales `.jpg/.png` de 9–13 MB ya reemplazados por `.webp`, y series retiradas del diseño (`insta-0N`, `newsletter-bg`, `video-poster`, `brand-statement-bg`, `angel-in-box`, `box-engraved-top`, `edition-paper`, `pendant-large`, `instagram-feed`). El grueso del *código* muerto: el **esqueleto Dawn completo**, reemplazado al 100 % por secciones `elyxie-*`.

**Falsos positivos cazados por el doble check** (un grep ingenuo los habría borrado — y un grep ingenuo al revés habría conservado huérfanos):

1. `dije-*`/`cadena-*` (48 archivos): cero referencias literales, pero `sections.jsx:771,886,942` construye `assets/ecommerce/${v.prefix}-${finish}-${chain}` — **fallback local de la vitrina** sin media de Shopify.
2. `grid-0N.webp`/`-480.webp`: construidos en `app.jsx:944-945` vía `e.img.replace(/\.jpg$/, …)`.
3. `insta-real-0N-*`: sufijos construidos en `sections.jsx:1527-1541`.
4. `theme/assets/styles.css.liquid`: cero refs por nombre de archivo, pero compila al asset `styles.css` que cargan los 4 layouts. **Convención de nombre de Shopify.**
5. `sections/cart-icon-bubble.liquid`, `sections/cart-drawer.liquid`, `sections/cart-live-region-text.liquid`: sin `{% section %}` alguno, pero **`cart.js`/`cart-drawer.js` (vivos) las piden por string vía Section Rendering API**. Borrarlas rompe el badge del carrito, el re-render del drawer y el live-region.
6. Los videos de fondo (`origen/templo/tribu/main-film*.mp4`): entre v1 y v2 una sesión paralela los pasó a construcción dinámica — la auditoría re-ejecutada los detectó como "huérfanos nuevos". Prueba en vivo de por qué el Paso 0 (re-correr el script) es obligatorio.

---

## 2. Mapa de entry points (Fase A)

### 2.1 Build / tooling
| Entry point | Qué arrastra |
|---|---|
| `build.js` (`npm run build/watch`) | `SOURCES = [tweaks-panel.jsx, pendant.jsx, sections.jsx, app.jsx, lightbox.js]` → `dist/*.js` → espejo a `theme/assets/*.js` |
| `package.json` | única dep: `esbuild` (usada). **Sin dependencias muertas.** |
| `.gitattributes` | bundles `linguist-generated` (nota cosmética: falta `theme/assets/lightbox.js` en la lista) |
| `.theme-check.yml`, `theme/.prettierrc.json`, `theme/.vscode/` | tooling activo |
| `scripts/dead-code-audit.js` | esta auditoría, reproducible |

### 2.2 Standalone (dev local / posible legacy Vercel)
`index.html` → `dist/*.js?v=N` + `styles.css` + `assets/**` (rutas relativas). Entorno de dev documentado en CLAUDE.md → **entry point vivo** aunque Vercel ya no exista.

### 2.3 Shopify theme
| Entry point | Resolución |
|---|---|
| `layout/theme.liquid` | **default por convención** — políticas y todo template sin `"layout"`. Es shell elyxie |
| `layout/elyxie.liquid` | homepage → `{% sections 'elyxie-header-group' %}` / `'elyxie-footer-group'` |
| `layout/elyxie-page.liquid` / `elyxie-password.liquid` | 18 templates JSON / `password.json` |
| 21 templates `.json` + `gift_card.liquid` | todos vivos (rutas resueltas por convención de Shopify) |
| Secciones vivas | 20 `elyxie-*` + 3 por Section Rendering API + `apps` (🔴) |
| Snippets vivos (cierre transitivo) | `card-collection`, `cart-drawer`, `elyxie-date`, `elyxie-lang-geo`, `elyxie-nav`, `loading-spinner`, `unit-price` |
| JS con referencias por string | `cart.js`, `cart-drawer.js` (Section Rendering API), `global.js`, `product-form.js` (custom elements condicionales) |
| Editor de themes | secciones **con `presets`** activables desde "Add section" sin referencia alguna |
| `tweaks-panel.js` | vivo, gated por `request.design_mode` (`elyxie.liquid`) |
| Runtime Three.js / video | `angel.glb` (preload + `pendant.jsx`), `temple-day/night.jpg` (vía `styles.css`), `.mp4` vía `bgVideoSrc`/tiers (ZONA CALIENTE) |
| Checkout branding | `assets/checkout-branding/*` subido a la config de checkout — **uso externo sin referencia en repo** |

### 2.4 Lo que NO existe
Ni `vercel.json`, ni CI propio en `/.github` (el `theme/.github/` de Dawn es inerte: GitHub solo lee `.github` en la raíz), ni `import()` dinámicos, ni shaders por string fuera de `pendant.jsx`.

---

## 3. 🟢 SEGURO — Fase 1 (118 archivos + 4 símbolos, ~142 MB)

Doble check por grupo: **(1)** búsqueda exhaustiva (nombre exacto, stems, comentarios excluidos, en liquid/json/jsx/css/html/configs) **y (2)** verificación de contexto (no activable desde editor, no convención de nombre, no construible por reglas dinámicas, no flujo EN). Riesgo de error: una imagen 404 — detectable y reversible con `git revert`.

- **3.1 — 33 fotos huérfanas en `theme/assets/`** (70.9 MB): series retiradas. Lista exacta: Anexo A·F1.1.
- **3.2 — 7 JS/CSS Dawn** (33 KB) que ni los archivos Dawn muertos referencian (en Dawn los cargaba su `theme.liquid`; el nuestro fue reescrito): Anexo A·F1.2a. La única mención de `animations.js` es un comentario en `story-scroll.js`.
- **3.3 — 43 íconos decorativos Dawn** (56 KB) con cero referencias: Anexo A·F1.2b. *(NO confundir con los vivos: `icon-cart/account/caret/close/plus/minus/remove/error/info/discount/success/arrow/cart-empty.svg`.)*
- **3.4 — 35 assets raíz muertos** (70.9 MB): copia fuente de las mismas series + `assets/icons/instagram.svg`, `hexagon.svg`, `metatron-rope.svg`, `water-swirl.svg`, `laguna-negra-bg-640.webp`: Anexo A·F1.3. `assets/checkout-branding/` excluido (🔴).
- **3.5 — 4 símbolos muertos en `app.jsx`** (~80 líneas):

| Símbolo | Evidencia doble check |
|---|---|
| `rgbLerp` (helper) | agente independiente: solo definición (`rgbLerpArr` es otra función y SÍ se usa) + grep manual: 0 usos |
| `EDITIONS` (const) + `EditionsGrid` (componente) | `<EditionsGrid` 0 hits; `EDITIONS` solo lo lee `EditionsGrid`; reemplazado por la sección Liquid `elyxie-editions.liquid` (viva) |
| `Manifesto` (componente) | `<Manifesto` 0 hits; `App` renderiza `SectionVideoHero/Provenance/Vitrina/Certificate/InstagramGrid/Footer` |
| `FooterMini` (componente) | `<FooterMini` 0 hits; el footer real es `Footer` de `sections.jsx` |

> Los números de línea de v1 (~94/133/923/981/996) **ya no valen** — la sesión paralela movió `app.jsx`. Localizar por grep (runbook 1.4).

---

## 4. APROBADO — Fase 2 (Dawn completo + locales)

### 4.1 Esqueleto Dawn — 84 liquid/json + 106 assets cascada (~1.4 MB, ~22 100 líneas)
Cero referencias estáticas desde el corpus vivo. Evidencia del doble check por subgrupo:

| Subgrupo | Archivos | Evidencia |
|---|---|---|
| Secciones sin preset (Anexo A·F2.1) | 28 | ningún template/grupo/`{% section %}` las nombra. `main-cart-items`/`main-cart-footer` en `cart.js` son **IDs del DOM** que `elyxie-cart-page.liquid` replica con `data-id="{{ section.id }}"` (documentado en sus comentarios, líneas 8–24) — la API usa el id de la sección viva, no el nombre del archivo. Hits de `main-404/product/page/article/search/list-collections` en secciones elyxie = comentarios "re-skin de Dawn X" |
| `layout/password.liquid` + groups Dawn | 3 | `password.json` declara `"layout": "elyxie-password"` → la convención no resuelve `password.liquid`; ningún layout invoca `{% sections 'header-group' %}`/`'footer-group'`. `settings_data.json` guarda config huérfana de `main-password-*` — inocua, **NO editar settings_data** |
| Snippets no alcanzados (Anexo A·F2.1) | 33 | cierre transitivo de `{% render %}`/`{% include %}` desde vivos no los alcanza; hits de `pagination`/`price` en secciones elyxie = clases CSS (p. ej. `class="pagination"` en elyxie-account); `product-form.js` busca `<cart-notification>` solo si existe en DOM — los layouts elyxie montan `cart-drawer` |
| Secciones con preset (Anexo A·F2.3) | 20 | cero refs; hits en `global.js`/`theme-editor.js` = custom elements condicionales. Eran activables desde el editor → **decisión tomada: borrar**; re-importables desde Dawn upstream |
| Assets cascada (Anexo B) | 106 | referenciados SOLO por archivos muertos. Subsets precomputados: **56** caen con 2.1 · **17** con las preset · **33 "AMBOS"** solo cuando los dos grupos hayan caído. Regla: un asset se borra en el commit que elimina a su último referenciador — nunca antes |

Por qué fue 🟡 y qué lo mitiga: (a) presets activables desde editor → decisión tomada; (b) posible divergencia live↔repo → pre-flight de paridad obligatorio (runbook 2.0); (c) `shopify theme push` **borra en remoto** lo ausente en local → push a dev primero, live solo con OK.

### 4.2 Locales no publicados — 47 archivos, 2.22 MB (Anexo A·F2.4)
La tienda publica ES (default) + EN (`/en/`). Shopify cae a `en.default` si falta un locale; restaurables desde Dawn upstream. **`es.json`, `es.schema.json`, `en.default.json`, `en.default.schema.json` NO se tocan jamás.**

### 4.3 Metadatos Dawn inertes — 13 archivos (pendiente de OK residual)
`theme/.github/` (9), `theme/translation.yml`, `theme/release-notes.md`, `theme/README.md`. GitHub no ejecuta `.github` en subdirectorios y `theme push` no los sube → riesgo funcional cero. `theme/LICENSE.md` se queda (🔴 legal). `.thumbnail` (raíz, WEBP 2.2 KB, origen desconocido) en el mismo OK.

---

## 5. 🔴 NO TOCAR — parecen muertos pero tienen razón de existir

| Archivo | Por qué se queda |
|---|---|
| `layout/theme.liquid` | layout default por convención (políticas y templates sin `"layout"`) |
| `templates/gift_card.liquid` + `template-giftcard.css` + `icon-success.svg` | convención Shopify al emitir gift cards |
| `theme/assets/styles.css.liquid` | compila al asset `styles.css` de los 4 layouts; se regenera desde `styles.css` raíz |
| `sections/cart-icon-bubble.liquid` | Section Rendering API desde `cart.js`/`cart-drawer.js` (badge del carrito) |
| `sections/cart-drawer.liquid` (1 línea) | `cart-drawer.js` pide `section: 'cart-drawer'` para re-renderizar el drawer |
| `sections/cart-live-region-text.liquid` | en `getSectionsToRender` de `cart.js` (accesibilidad) |
| `sections/apps.liquid` | host de secciones de apps de Shopify (confirmar en §8) |
| **Todos los `.mp4`** (`origen/templo/tribu/main-film*`, raíz y theme) | **ZONA CALIENTE**: pipeline en rework por sesión paralela (`bgVideoSrc`, tiers); re-auditar tras su merge |
| `assets/checkout-branding/**` | subido a la config de checkout — uso externo |
| `tweaks-panel.jsx`/`.js` | vivo, gated por `request.design_mode` + `index.html` |
| `dist/*.js` + espejos `theme/assets/{app,sections,pendant,tweaks-panel,lightbox}.js` | artefactos commiteados a propósito (`.gitattributes`) |
| `locales/es*.json`, `locales/en.default*.json` | copy bilingüe — invariante |
| `config/settings_data.json` (incl. bloque `main-password-*` huérfano) | config del theme; el bloque huérfano es inocuo; editarla a mano arriesga el estado del editor |
| `config/settings_schema.json`, `.theme-check.yml`, `theme/.prettierrc.json`, `theme/.vscode/`, `theme/.gitignore`, `theme/LICENSE.md` | configs/legal |
| `DESIGN.md`, `PRODUCT.md`, `README.md`, `CLAUDE.md`, `.impeccable/`, `scripts/` | docs y tooling |
| Pares `{es,en}` en JSX/Liquid | invariante — `/en/` está expuesto |
| Dawn vivo del carrito/cuenta: `theme/assets/{constants,pubsub,global,cart,cart-drawer,product-form,customer,quantity-popover,story-angel,story-scroll,theme-editor*}.js`, `component-cart-*.css`, `component-{totals,price,discounts,card}.css`, `quantity-popover.css`, `elyxie-cart.css`, `colors_and_type.css` | cargados por layouts/snippets vivos. *`theme-editor.js` solo lo citan muertos → cae en cascada AMBOS (Anexo B)* |
| `base.css` + `sparkle.gif` | en corpus vivo solo aparecen en comentarios; sus referenciadores reales (password.liquid, elyxie-globals.css) caen en 2.1 → se borran EN la cascada 2.2, no antes |

---

## 6. RUNBOOK de ejecución (para el agente ejecutor)

### Reglas globales
1. Rama nueva `limpieza-codigo-muerto` desde `main` **actualizado y con la rama de video ya mergeada**. Si la rama de video sigue abierta: STOP, coordinar con Mark.
2. `git status --short` debe estar **limpio** antes de empezar (memoria "push con sesiones paralelas": verificar status/mtimes; otra sesión puede estar editando).
3. Commits pequeños y temáticos; usar **`git rm`** (nunca `rm` a secas); cada commit deja `node build.js` verde. Abortar en cualquier punto = `git revert <sha>` y re-push a dev.
4. Pre-flight iCloud: `find . -name '* 2.*' -not -path './node_modules/*' -not -path './.git/*'` → debe salir vacío; si no, no commitear esos duplicados.
5. Las listas se extraen SIEMPRE del script (no de este doc) para absorber drift:
   ```bash
   node scripts/dead-code-audit.js > /tmp/audit.txt
   # la línea VALIDACIÓN debe decir (módulo zona-caliente ya mergeada):
   # huérfanos-theme=83 (fotos=33 jscss=7 iconos=43) · raíz=35 · 2.1-liquid=64 · preset=20 · cascada=56/17/33 · locales=47 · drift=0
   # Si drift>0 o los conteos difieren: STOP, investigar la diferencia ANTES de borrar nada.
   lista() { sed -n "/^== $1 /,/^== /p" /tmp/audit.txt | awk '/^  /{print $1}'; }
   ```
6. Baseline de theme-check ANTES del primer commit: `shopify theme check theme/ 2>&1 | tail -3 > /tmp/themecheck-baseline.txt` (comparar al final de cada fase: sin errores nuevos).

### Verificación estándar **V** (tras cada commit)
```bash
node build.js          # debe terminar "built in …ms" sin errores
```
Smoke del standalone con preview MCP (el ejecutor es un agente Claude Code):
`preview_start` (`python3 -m http.server 8080`) → recarga → `preview_network` **sin 404** → `preview_console_logs` **sin errores** → `preview_screenshot` como prueba. Para 1.4 además: scroll por las 5 fases del hero (`preview_eval` sobre `window.scrollTo`), vitrina con cambio de acabado, y footer.

### Verificación de theme **VT** (al cierre de cada fase que toque `theme/`)
```bash
shopify theme push -t 161440792815 theme/   # theme DEV — nunca live directo
```
Smoke en el preview del dev theme: `/` (hero + vitrina + badge), `/cart`, `/products/<handle>` (galería + lightbox + añadir al carrito → **drawer y badge se actualizan**: ejercita `cart-icon-bubble`/`cart-drawer` vía Section Rendering API), `/search?q=angel`, `/pages/historia`, `/pages/contacto`, `/collections`, `/blogs/<blog>`, `/en/`, login de cuenta y una URL 404.

### FASE 1 — 🟢 (sin dependencias pendientes)

**Commit 1.1 — `Limpieza: fotos huérfanas del theme (33 archivos, 71 MB)`**
```bash
ARCH=~/Documents/elyxie-archivo-fotos/theme && mkdir -p "$ARCH"
lista F1.1 | while read f; do cp "$f" "$ARCH/"; done
[ "$(lista F1.1 | wc -l)" -eq "$(ls "$ARCH" | wc -l)" ] || echo "STOP: copia incompleta"
lista F1.1 | xargs git rm
git commit -m "Limpieza: retira 33 fotos huérfanas del theme (series reemplazadas)"
# verificación extra: cada nombre borrado con 0 hits en CÓDIGO (este doc y el script
# de auditoría los mencionan a propósito; un hit dentro de un comentario tampoco cuenta)
lista F1.1 | sed 's|.*/||' | while read n; do
  grep -rIl "$n" --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=scripts \
       --exclude=PLAN-LIMPIEZA-CODIGO-MUERTO.md . && echo "REVISAR: $n aún mencionado (¿comentario?)"
done
```
→ **V**

**Commit 1.2 — `Limpieza: JS/CSS e íconos Dawn sin referencias (50 archivos)`**
```bash
lista F1.2a | xargs git rm
lista F1.2b | xargs git rm
git commit -m "Limpieza: retira 7 js/css y 43 íconos Dawn sin ninguna referencia"
```
→ **V**

**Commit 1.3 — `Limpieza: assets raíz huérfanos del standalone (35 archivos, 71 MB)`**
```bash
ARCH=~/Documents/elyxie-archivo-fotos/raiz && mkdir -p "$ARCH"
lista F1.3 | while read f; do mkdir -p "$ARCH/$(dirname "$f")"; cp "$f" "$ARCH/$f"; done
lista F1.3 | xargs git rm
git commit -m "Limpieza: retira 35 assets raíz huérfanos (espejo del standalone)"
```
→ **V** con atención a `preview_network` (consola de red sin 404).

**Commit 1.4 — `app.jsx: retira EditionsGrid/Manifesto/FooterMini/rgbLerp muertos`**
1. Re-verificar que siguen muertos (la sesión paralela movió el archivo):
   ```bash
   grep -n '<EditionsGrid\|<Manifesto\|<FooterMini\|rgbLerp(' *.jsx *.js index.html   # esperado: 0 líneas
   grep -n 'const rgbLerp \|function rgbLerp\|EDITIONS\b\|EditionsGrid\|Manifesto\|FooterMini' app.jsx  # solo definiciones/uso interno entre ellos
   ```
   Si aparece un uso nuevo → ese símbolo se cae del commit, no se fuerza.
2. Borrar las definiciones (localizar por grep, no por línea): `rgbLerp`, `EDITIONS` + `EditionsGrid`, `Manifesto`, `FooterMini`.
3. `node build.js` (regenera `dist/` y espeja a `theme/assets/`).
4. Bump cache-bust en `index.html`: subir TODOS los tags `dist/*.js?v=` a **max actual + 1** (hoy hay mezcla 177/199/214 — no homogeneizar a la baja).
5. Commitear JUNTOS: `app.jsx`, `index.html`, `dist/*.js`, `theme/assets/*.js` modificados.
→ **V** completo (hero 5 fases + vitrina + footer) y **VT** como cierre de Fase 1.

### FASE 2 — Dawn + locales (decisiones ya tomadas; §8 solo para 2.5)

**Paso 2.0 — pre-flight de paridad live↔repo (OBLIGATORIO)**
```bash
shopify theme pull -t 161441415407 --path /tmp/elyxie-live-pull    # live, solo lectura
diff -rq /tmp/elyxie-live-pull/templates theme/templates
diff -q  /tmp/elyxie-live-pull/config/settings_data.json theme/config/settings_data.json
```
Si el live tiene templates/secciones/ajustes que el repo no conoce → **STOP y reportar a Mark** (el push borraría/aplastaría ese trabajo).

**Commit 2.1 — `Dawn: retira secciones sin preset, password cluster, groups y snippets (64 archivos)`**
```bash
lista F2.1 | xargs git rm
git commit -m "Dawn: retira 28 secciones sin preset, password.liquid, 2 groups y 33 snippets sin referencias"
```
→ **V** + **VT** (flujos sensibles: carrito completo y cuenta/login).

**Commit 2.2 — `Dawn: retira los 56 assets en cascada de 2.1`**
```bash
node scripts/dead-code-audit.js > /tmp/audit.txt   # re-correr: la cascada se recalcula sola
lista "F2.2 CASCADA" | xargs git rm
git commit -m "Dawn: retira 56 assets css/js/svg que solo referenciaban los archivos de 2.1"
```
→ **V** + **VT**. *(Incluye `base.css`+`sparkle.gif`+`elyxie-globals.css`: sus únicos referenciadores reales cayeron en 2.1.)*

**Commit 2.3 — `Dawn: retira las 20 secciones con preset + su cascada (17 + 33 AMBOS)`**
```bash
lista F2.3 | xargs git rm
node scripts/dead-code-audit.js > /tmp/audit.txt
lista "F2.3-CASCADA" | xargs git rm
lista "CASCADA-AMBOS" | xargs git rm
git commit -m "Dawn: retira 20 secciones con preset y 50 assets en cascada — el editor queda 100% elyxie"
```
→ **V** + **VT** + abrir el **editor de themes** del dev theme y confirmar que "Add section" lista solo `elyxie-*` (+ apps) sin entradas rotas.

**Commit 2.4 — `Locales: retira 47 idiomas no publicados`**
```bash
lista F2.4 | xargs git rm
git commit -m "Locales: retira 47 idiomas Dawn no publicados (la tienda publica es + en)"
```
→ **VT**: verificar `/` y `/en/` renderizan los strings del carrito/cuenta correctamente en ambos idiomas.

**Commit 2.5 — `Theme: retira metadatos Dawn inertes` (SOLO con el OK residual de §8)**
`git rm -r theme/.github theme/translation.yml theme/release-notes.md theme/README.md .thumbnail` → **V** (no afecta runtime).

**Cierre — push a live (SOLO con OK explícito de Mark)**
Protocolo de la memoria del proyecto: verificar `git status`/mtimes (sesiones paralelas) → `shopify theme push -t 161441415407 theme/` → validar después con `shopify theme pull` a /tmp + diff (paridad) y smoke VT sobre `www.elyxie.com`. Recordatorio: **push borra en remoto** lo ausente en local — ese es justamente el mecanismo de esta limpieza.

### Rollback
Cada commit es independiente: `git revert <sha>` (los `git rm` se revierten limpios) + re-push a dev. Abortarse a mitad de fase deja el build verde porque ningún commit borra un archivo cuyo referenciador siga vivo (orden: referenciadores → cascada).

---

## 7. Criterios de aceptación — estado

- [x] Cero candidatos sin doble check documentado (§3/§4 + Anexos con el "quién referencia a quién")
- [x] Categoría asignada al 100 % (🟢 118+4 símbolos · aprobados 199 · 🔴 16)
- [x] Fases independientes y reversibles (runbook §6, orden referenciador→cascada, V/VT por commit)
- [x] Decisiones explícitas en lugar de suposiciones (§0); residuales en §8
- [x] Listas reproducibles sin depender de /tmp (`scripts/dead-code-audit.js`)

## 8. Pendientes residuales (no bloquean Fase 1 ni 2.1–2.4)

1. **Metadatos Dawn + `.thumbnail`** (commit 2.5): recomendado borrar — falta tu OK.
2. **`sections/apps.liquid`**: queda 🔴 (host de secciones de apps). Confirma que así se queda.
3. **Informativo**: ¿sigue desplegado el one-pager fuera de Shopify (Vercel)? No cambia el plan (lo huérfano lo es también allí).
4. **Post-merge video**: cuando aterrice la rama de la pipeline de video, correr `node scripts/dead-code-audit.js` SIN la whitelist de zona caliente (editar `DYNAMIC_RULES`/`DYNAMIC_RULES_ROOT` quitando las reglas marcadas ZONA CALIENTE) para detectar variantes `.mp4` viejas que hayan quedado huérfanas (`-720`, base sin sufijo, `main-film.mp4`).

---

## Anexo A — listas exactas (salida de `scripts/dead-code-audit.js`, 12-jun-2026)

> El runbook extrae las listas del script en vivo; estas copias son para revisión humana.

### F1.1 — Fotos huérfanas theme (33, 70.9 MB)
```
theme/assets/angel-in-box-detail.jpg        12.4 MB
theme/assets/angel-in-box-hero.jpg          10.2 MB
theme/assets/angel-pendant-velvet.png        2.4 MB
theme/assets/box-engraved-top.jpg           11.4 MB
theme/assets/brand-statement-bg-1440.webp
theme/assets/brand-statement-bg-960.webp
theme/assets/brand-statement-bg.jpg          4.4 MB
theme/assets/brand-statement-bg.webp
theme/assets/edition-paper.png               9.0 MB
theme/assets/hexagon.svg
theme/assets/insta-01-480.webp
theme/assets/insta-01.jpg                    1.6 MB
theme/assets/insta-01.webp
theme/assets/insta-02-480.webp
theme/assets/insta-02-720.webp
theme/assets/insta-02.jpg                    1.6 MB
theme/assets/insta-02.webp
theme/assets/insta-03-480.webp
theme/assets/insta-03.jpg                    1.4 MB
theme/assets/insta-03.webp
theme/assets/instagram-feed.png              3.4 MB
theme/assets/laguna-negra-bg.jpg             1.6 MB   (las variantes .webp SÍ viven)
theme/assets/metatron-rope.svg
theme/assets/newsletter-bg-1440.webp
theme/assets/newsletter-bg-960.webp
theme/assets/newsletter-bg.jpg               2.8 MB
theme/assets/newsletter-bg.webp
theme/assets/pendant-large.jpg               2.4 MB
theme/assets/video-poster-1440.webp
theme/assets/video-poster-960.webp
theme/assets/video-poster.jpg                4.2 MB
theme/assets/video-poster.webp
theme/assets/water-swirl.svg
```

### F1.2a — JS/CSS huérfanos theme (7, 33 KB)
```
theme/assets/animations.js
theme/assets/component-localization-form.css
theme/assets/component-progress-bar.css
theme/assets/details-disclosure.js
theme/assets/localization-form.js
theme/assets/predictive-search.js
theme/assets/search-form.js
```

### F1.2b — Íconos huérfanos theme (43, 56 KB)
```
icon-apple icon-banana icon-bottle icon-box icon-carrot icon-chat-bubble
icon-check-mark icon-clipboard icon-dairy-free icon-dairy icon-dryer icon-eye
icon-fire icon-gluten-free icon-heart icon-iron icon-leaf icon-leather
icon-lightning-bolt icon-lipstick icon-lock icon-map-pin icon-nut-free
icon-pants icon-paw-print icon-pepper icon-perfume icon-plane icon-plant
icon-price-tag icon-question-mark icon-recycle icon-return icon-ruler
icon-serving-dish icon-shirt icon-shoe icon-silhouette icon-snowflake
icon-star icon-stopwatch icon-truck icon-washing            (todos .svg en theme/assets/)
```

### F1.3 — Assets raíz muertos (35, 70.9 MB)
```
assets/edition-paper.png                     9.0 MB
assets/hexagon.svg
assets/icons/instagram.svg
assets/metatron-rope.svg
assets/water-swirl.svg
assets/photography/angel-in-box-detail.jpg  12.4 MB
assets/photography/angel-in-box-hero.jpg    10.2 MB
assets/photography/angel-pendant-velvet.png  2.4 MB
assets/photography/box-engraved-top.jpg     11.4 MB
assets/photography/brand-statement-bg{,-960,-1440}.webp + .jpg   (4 archivos, 4.9 MB)
assets/photography/insta-01{-480}.webp + .webp + .jpg            (3)
assets/photography/insta-02{-480,-720}.webp + .webp + .jpg       (4)
assets/photography/insta-03{-480}.webp + .webp + .jpg            (3)
assets/photography/instagram-feed.png        3.4 MB
assets/photography/laguna-negra-bg-640.webp
assets/photography/laguna-negra-bg.jpg       1.6 MB
assets/photography/newsletter-bg{,-960,-1440}.webp + .jpg        (4, 3.1 MB)
assets/photography/pendant-large.jpg         2.4 MB
assets/photography/video-poster{,-960,-1440}.webp + .jpg         (4, 4.6 MB)
```

### F2.1 — Liquid sin preset: 28 secciones + 1 layout + 2 groups + 33 snippets (64)
```
SECCIONES: bulk-quick-order-list cart-notification-button cart-notification-product
footer header main-404 main-account main-activate-account main-addresses main-article
main-blog main-cart-footer main-cart-items main-collection-banner
main-collection-product-grid main-list-collections main-login main-order main-page
main-password-footer main-password-header main-product main-register
main-reset-password main-search pickup-availability predictive-search related-products
LAYOUT:    password.liquid
GROUPS:    header-group.json footer-group.json
SNIPPETS:  article-card buy-buttons card-product cart-notification country-localization
facets gift-card-recipient-form header-drawer header-dropdown-menu header-mega-menu
header-search icon-accordion icon-with-text language-localization meta-tags pagination
price price-facet product-media product-media-gallery product-media-modal
product-thumbnail product-variant-options product-variant-picker progress-bar
quantity-input quick-order-list quick-order-list-row quick-order-product-row
share-button social-icons swatch swatch-input
```

### F2.3 — Secciones con preset (20)
```
announcement-bar collage collapsible-content collection-list contact-form
custom-liquid email-signup-banner featured-blog featured-collection featured-product
image-banner image-with-text multicolumn multirow newsletter page quick-order-list
rich-text slideshow video
```

### F2.4 — Locales no publicados (47, 2.22 MB)
```
bg cs cs.schema da da.schema de de.schema el fi fi.schema fr fr.schema hr hu id
it it.schema ja ja.schema ko ko.schema lt nb nb.schema nl nl.schema pl pl.schema
pt-BR pt-BR.schema pt-PT pt-PT.schema ro ru sk sl sv sv.schema th th.schema
tr tr.schema vi zh-CN zh-CN.schema zh-TW zh-TW.schema          (todos .json en theme/locales/)
```

## Anexo B — cascada asset → referenciadores (106)

### Cae con 2.1 (56 assets, 401 KB)
```
base.css                              <- layout/password.liquid, assets/elyxie-globals.css
cart-notification.js                  <- sections/header.liquid
component-cart-notification.css       <- sections/header.liquid
component-collection-hero.css         <- sections/main-collection-banner.liquid
component-complementary-products.css  <- sections/main-product.liquid
component-facets.css                  <- main-collection-product-grid, main-search
component-list-menu.css               <- footer, header
component-list-payment.css            <- footer
component-mega-menu.css               <- header
component-menu-drawer.css             <- header
component-pagination.css              <- snippets/pagination
component-pickup-availability.css     <- snippets/buy-buttons
component-predictive-search.css       <- assets/elyxie-globals.css
component-search.css                  <- header, main-search
component-show-more.css               <- snippets/facets
customer.css                          <- main-account, main-activate-account, main-addresses…
details-modal.js                      <- layout/password.liquid
elyxie-globals.css                    <- layout/password.liquid
facets.js                             <- main-collection-product-grid, main-search
icon-3d-model.svg                     <- product-media-gallery, product-thumbnail
icon-checkmark.svg                    <- cart-notification, country-localization, facets
icon-close-small.svg                  <- facets
icon-copy.svg / icon-share.svg / share.js  <- share-button
icon-facebook/instagram/pinterest/snapchat/tiktok/tumblr/twitter/vimeo/youtube.svg
                                      <- main-password-footer, header-drawer, social-icons
icon-filter.svg                       <- facets
icon-hamburger.svg                    <- header-drawer
icon-inventory-status.svg             <- main-product
icon-padlock.svg                      <- main-password-header
icon-reset.svg / icon-search.svg      <- main-search, country-localization, header-search
icon-shopify.svg                      <- main-password-footer
icon-tick.svg                         <- pickup-availability
icon-unavailable.svg                  <- buy-buttons
icon-zoom.svg                         <- product-thumbnail
instagram.svg                         <- main-password-footer, header-drawer, social-icons
main-search.js                        <- main-search
password-modal.js                     <- layout/password.liquid
pickup-availability.js                <- buy-buttons
recipient-form.js                     <- gift-card-recipient-form
section-blog-post.css                 <- main-article
section-footer.css                    <- footer
section-main-blog.css                 <- main-blog
section-password.css                  <- layout/password.liquid
section-related-products.css          <- related-products
sparkle.gif                           <- assets/base.css
square.svg                            <- facets, gift-card-recipient-form
```

### Cae con las preset / 2.3 (17 assets, 56 KB)
```
collage.css component-modal-video.css                    <- collage
collapsible-content.css                                  <- collapsible-content
component-image-with-text.css                            <- image-with-text, multirow
component-slideshow.css icon-pause.svg                   <- announcement-bar, slideshow
email-signup-banner-background{,-mobile}.svg
section-email-signup-banner.css section-image-banner.css <- email-signup-banner (+image-banner, slideshow)
newsletter-section.css                                   <- email-signup-banner, newsletter
section-contact-form.css                                 <- contact-form
section-featured-blog.css                                <- featured-blog
section-featured-product.css                             <- featured-product
section-multicolumn.css                                  <- multicolumn
section-rich-text.css                                    <- rich-text
video-section.css                                        <- video
```

### Cascada AMBOS — cae solo tras 2.1 **y** 2.3 (33 assets, 159 KB)
```
component-accordion.css component-article-card.css component-deferred-media.css
component-list-social.css component-model-viewer-ui.css component-newsletter.css
component-product-model.css component-product-variant-picker.css component-rating.css
component-slider.css component-swatch-input.css component-swatch.css
component-volume-pricing.css icon-play.svg magnify.js mask-arch.svg mask-blobs.css
media-gallery.js price-per-item.js product-info.js product-modal.js product-model.js
quick-add-bulk.js quick-add.css quick-add.js quick-order-list.css quick-order-list.js
section-collection-list.css section-main-page.css section-main-product.css
show-more.js template-collection.css theme-editor.js
(referenciados a la vez por featured-product/main-product, collection-list/main-collection-…,
 announcement-bar/footer, etc. — el detalle exacto lo emite el script)
```

## Apéndice — metodología

- **Script canónico**: [`scripts/dead-code-audit.js`](scripts/dead-code-audit.js) — solo lectura, reproducible en cualquier rama. Implementa: grafo vivo (templates→sections→snippets, cierre transitivo), corpus con comentarios excluidos (liquid/HTML/CSS/`//` JS), punto fijo de assets, whitelist dinámica, subsets de cascada y **detector de drift** (nombres "muertos" citados en JS vivo fuera de los falsos positivos documentados → exige revisión manual).
- **Reglas dinámicas**: `(dije|cadena)-(oro|plata|rodio)-(el|ella)(-NNN)?.(webp|jpg)` (`sections.jsx:771,886,942`) · `insta-real-0[1-3](-480|-960)?.(webp|jpg)` (`sections.jsx:1527-1541`) · `grid-0[1-4](-480)?.(webp|jpg)` (`app.jsx:944-945`) · **ZONA CALIENTE** `.mp4` (pipeline en rework, quitar tras merge — §8.4).
- **Section Rendering API**: `cart-drawer`, `cart-icon-bubble` (`cart-drawer.js`), `cart-live-region-text` (`cart.js`) = vivas; `main-cart-items`/`main-cart-footer` en `cart.js` = IDs del DOM replicados por `elyxie-cart-page` (muertas como archivo).
- **Símbolos JS**: agente de exploración independiente + grep de verificación manual (dos métodos).
- **Fuera de alcance**: poda de reglas CSS muertas dentro de `styles.css` (~174 KB; selectores compuestos dinámicamente en JSX — requeriría coverage en navegador) y reescritura de historia git (los ~146 MB siguen en `.git` hasta un eventual filtro de historia).
- Nota cosmética pendiente: añadir `theme/assets/lightbox.js` a la lista `linguist-generated` de `.gitattributes`.
