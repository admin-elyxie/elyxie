---
name: ELYXIE
description: Joyería-talismán de lujo — el agua sagrada de la Laguna Negra, guardada por un ángel en la oscuridad.
colors:
  emerald-canvas: "#0A2620"
  emerald-void: "#051613"
  emerald-deep: "#0E3328"
  surface: "#0E2E26"
  surface-raised: "#143C32"
  champagne: "#E9D7B1"
  gold-metallic: "#C9A66B"
  gold-deep: "#8C7340"
  phosphor: "#7DFFB2"
  phosphor-core: "#34C97A"
  ivory: "#F6F2E8"
  white: "#FFFFFF"
  border: "#2A4B43"
  border-strong: "#3D6A5E"
  error: "#D97757"
typography:
  display:
    fontFamily: "Cormorant Garamond, EB Garamond, Georgia, serif"
    fontSize: "clamp(56px, 7vw, 96px)"
    fontWeight: 300
    lineHeight: 0.95
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Cormorant Garamond, EB Garamond, Georgia, serif"
    fontSize: "clamp(34px, 4.4vw, 72px)"
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Cormorant Garamond, EB Garamond, Georgia, serif"
    fontSize: "26px"
    fontWeight: 400
    lineHeight: 1.2
  body:
    fontFamily: "Satoshi, Inter, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: "Satoshi, Inter, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    letterSpacing: "0.32em"
rounded:
  none: "0"
  sm: "8px"
  md: "12px"
  lg: "18px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  "2xl": "32px"
  "3xl": "48px"
  "5xl": "96px"
  section: "120px"
components:
  button-primary:
    backgroundColor: "{colors.champagne}"
    textColor: "{colors.emerald-canvas}"
    rounded: "{rounded.none}"
    padding: "16px 28px"
    typography: "{typography.label}"
  button-primary-hover:
    backgroundColor: "{colors.champagne}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.white}"
    rounded: "{rounded.none}"
    padding: "16px 28px"
    typography: "{typography.label}"
  button-ghost-hover:
    textColor: "{colors.champagne}"
  input:
    backgroundColor: "#FFFFFF0A"
    textColor: "{colors.white}"
    rounded: "{rounded.none}"
    height: "56px"
    padding: "22px 18px 8px"
  input-focus:
    backgroundColor: "#FFFFFF0F"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.white}"
    rounded: "{rounded.lg}"
    padding: "32px"
  chip:
    backgroundColor: "#FFFFFF0F"
    textColor: "{colors.white}"
    rounded: "{rounded.pill}"
    padding: "8px 16px"
---

# Design System: ELYXIE

## 1. Overview

**Creative North Star: "El Altar Nocturno"**

ELYXIE se compone como la *mesa* de un curandero del norte vista de noche: una superficie verde casi negra sobre la que reposa un único objeto que guarda luz propia. La oscuridad no es un tema decorativo, es el lienzo, y todo lo demás —el oro, el verde fosforescente, el agua— aparece como una sola ofrenda iluminada en medio de la penumbra. El esmeralda profundo (`#0A2620`) sostiene la composición; el champán (`#E9D7B1`) marca lo precioso y lo escrito; el verde fósforo (`#7DFFB2`) es la luz guardada que el aluminato de estroncio devuelve en la oscuridad. La densidad es alta y el ritmo es lento: el sistema respira, nunca se apresura.

El sistema rechaza explícitamente el lujo blanco aireado tipo Apple/escandinavo, el e-commerce de joyería genérico (grids de producto, badges de descuento, "Añadir al carrito" como protagonista), el kitsch new-age de tienda de cristales (degradados arcoíris, chakras de clip-art) y la estética tech/SaaS de tarjetas planas idénticas. La contención es la fuerza: un solo punto de luz pesa más que diez acentos compitiendo.

El tono visual es **reverente, susurrado y cinematográfico**. Lo místico aquí es grave y ancestral, no woo-woo. La tradición del curanderismo del norte (Las Huaringas, la mesa, el seguro) se representa con precisión y dignidad, nunca como adorno exótico.

**Key Characteristics:**
- Dark-first absoluto: el esmeralda casi negro es el suelo de toda composición.
- Un solo punto de luz: el verde fósforo aparece como brillo emergente, no como relleno.
- Oro como lo precioso y lo escrito: champán para texto-acento, metálico para el objeto.
- Serif italic display + sans neutra: Cormorant Garamond contra Satoshi.
- Bordes nítidos en lo interactivo (botones e inputs a 0px); curvatura solo en superficies.
- Modo día/noche: el mismo sistema en marfil cálido o en vacío esmeralda.

## 2. Colors

Una paleta tricolor sobre vacío: esmeralda como oscuridad, champán como lo precioso, fósforo como la luz guardada. Las escalas viven en `assets/colors_and_type.css` (50 claro → 950 oscuro); aquí se nombran solo los tonos que el sistema realmente usa.

### Primary
- **Esmeralda Lienzo** (`#0A2620`): el fondo primario de la marca, la "mesa" sobre la que todo reposa. Es el `--color-bg` por defecto en cualquier sección oscura.
- **Esmeralda Vacío** (`#051613`): el negro-verde más profundo, suelo del hero y del modo noche (`data-theme="dark"`). Reservado para el "void" de pantalla completa.
- **Esmeralda Profundo** (`#0E3328`) y las superficies **Surface** (`#0E2E26`) / **Surface Elevada** (`#143C32`): capas que suben un escalón desde el lienzo para tarjetas y bloques destacados.

### Secondary
- **Champán** (`#E9D7B1`): el acento de firma. Texto-acento, wordmark, número de serie, foco y el CTA de oro. Es el color que dice "esto es precioso y escrito a mano".
- **Oro Metálico** (`#C9A66B`): el oro del objeto físico (el ángel). En swatches, íconos y degradados de botón, no en texto largo.
- **Oro Profundo** (`#8C7340`): sombra del oro, para perfilar sobre fondos claros.

### Tertiary
- **Verde Fósforo** (`#7DFFB2`): "el brillo" — la luz que el aluminato de estroncio devuelve de noche. Es el color hero de los glows y de la respiración del orbe. Casi nunca como fondo sólido; casi siempre como luz (`box-shadow`, halo, borde tenue).
- **Fósforo Núcleo** (`#34C97A`): el corazón más saturado del glow, para acentos puntuales y estados de éxito.

### Neutral
- **Blanco** (`#FFFFFF`) y su rampa de opacidades (`white-90` → `white-02`): todo el texto sobre oscuro y los velos de vidrio se construyen con blanco translúcido, nunca con grises planos.
- **Marfil** (`#F6F2E8`): el fondo del modo día y de los certificados/insertos de empaque. Cálido, no blanco puro.
- **Borde** (`#2A4B43`) y **Borde Fuerte** (`#3D6A5E`): divisores capilares y bordes de tarjeta visibles sobre esmeralda.

### Signal
- **Bronce Señal** (`#D97757`): el único color de error, un bronce desaturado. **Nunca un rojo vibrante** — rompería la gravedad de la marca.

### Named Rules
**The One Light Rule.** El verde fósforo es una sola luz en la oscuridad. Aparece en ≤10% de cualquier pantalla y casi siempre como brillo emergente (glow, halo, respiración), no como superficie. Su rareza es el significado.

**The No Pure Black Rule.** El "negro" de la marca siempre es esmeralda (`#051613`/`#0A2620`), nunca `#000000`. El agua tiñe hasta la oscuridad.

## 3. Typography

**Display Font:** Cormorant Garamond (con EB Garamond, Georgia, serif)
**Body Font:** Satoshi (con Inter, system-ui, sans-serif)
**Mono Font:** sistema (`ui-monospace`, SF Mono, Menlo) — solo para porcentajes y números de serie tabulares.

**Character:** un serif de alto contraste, preferentemente en *italic*, contra una sans neutra y silenciosa. El Cormorant aporta la voz reverente y escrita a mano (titulares, wordmark); el Satoshi desaparece para que el cuerpo se lea sin ego. Pareja por eje de contraste (serif vs. sans), nunca dos sans parecidas.

### Hierarchy
- **Display** (Cormorant, 300, `clamp(56px, 7vw, 96px)`, lh 0.95, tracking -0.02em): titulares hero y de fase. A menudo en italic. Techo de 96px: la marca no grita.
- **Headline** (Cormorant, 400, `clamp(34px, 4.4vw, 72px)`, lh 1.1): títulos de sección (`h1`/`h2`), normalmente italic.
- **Title** (Cormorant, 400, 26px, lh 1.2): subtítulos serif (`h3`); el escalón donde el serif cede al sans.
- **Body** (Satoshi, 400, 16px, lh 1.65): texto corrido, ancho máximo ~64ch. Frases cortas y declarativas con pausas.
- **Label** (Satoshi, 500, 12px, tracking 0.32em, UPPERCASE): eyebrows, número de serie (Nº 01/100), etiquetas de botón y de la barra de progreso.

### Named Rules
**The Italic Serif Rule.** El wordmark y la mayoría de titulares display van en Cormorant *italic*, en minúsculas o sentence-case. Es la firma escrita de la marca.

**The Caps-Only-For-Labels Rule.** Las mayúsculas con tracking ancho (0.32em) se reservan a etiquetas ≤4 palabras, eyebrows y seriales. Nunca cuerpo en mayúsculas.

## 4. Elevation

El sistema casi no usa sombras de caja como elevación: la profundidad se construye con **capas tonales** (lienzo → superficie → superficie elevada) y, sobre todo, con **glows**. Las sombras reales son restringidas y oscuras (`0 20px 60px rgba(5,22,19,0.55)`) y solo aparecen bajo tarjetas y modales. El trabajo dramático lo hacen los resplandores fosforescentes y dorados, que codifican literalmente "la esfera tiene luz dentro".

### Shadow Vocabulary
- **Sombra de tarjeta** (`box-shadow: 0 20px 60px rgba(5,22,19,0.55)`): elevación funcional bajo cards y bloques destacados.
- **Glow fósforo** (`0 0 60px 4px rgba(125,255,178,0.55), 0 0 140px 12px rgba(125,255,178,0.18)`): el halo de firma alrededor del orbe y de elementos vivos. Tiene una variante que respira (`phosphor-breathe`, 4s).
- **Glow oro** (`0 0 30px rgba(233,215,177,0.25)` → en hover `0 0 60px / 0 0 120px`): aura cálida del CTA primario.
- **Highlight interior** (`inset 0 1px 0 rgba(255,255,255,0.08)`): brillo superior sutil sobre vidrio y tarjetas.

### Named Rules
**The Glow-Over-Shadow Rule.** Cuando algo deba "destacar", primero se considera un glow (la luz que sale del objeto), no una drop-shadow más fuerte. La sombra eleva; el glow significa.

## 5. Components

### Buttons
- **Shape:** rectángulo nítido, **sin radio** (`border-radius: 0`). Aunque existe un token `--radius-pill`, los botones reales son de esquina viva — es parte de la gravedad de la marca. Etiqueta en Label (Satoshi 500, 11px, tracking 0.32em, uppercase), padding `16px 28px`, con flecha `→` que se desplaza 5px en hover.
- **Primary** (`Button--primary`): degradado champán→oro (`linear-gradient(180deg, #E9D7B1, #C9A66B)`), texto esmeralda, glow oro de 30px en reposo que crece a 60/120px en hover. El CTA de máxima prioridad.
- **Ghost** (`Button--ghost`): transparente, borde `rgba(255,255,255,0.30)`, texto blanco; en hover el borde y el texto pasan a champán. En modo día el borde es tinta esmeralda y el hover invierte a fondo esmeralda con texto marfil.
- **Small** (`Button--small`): mismo lenguaje, padding `12px 22px`, label 10px.
- **Disabled:** fondo `rgba(255,255,255,0.08)`, texto al 40%, sin glow.

### Cards
- **Corner Style:** redondeo de superficie (`18px`, `--radius-lg`), a diferencia de los botones nítidos.
- **Background:** `--color-surface` (`#0E2E26`) o vidrio (`rgba(255,255,255,0.04)`).
- **Shadow Strategy:** ver Elevation — sombra de tarjeta + highlight interior; nunca side-stripe.
- **Border:** hairline `rgba(255,255,255,0.06)`; versión visible con `#3D6A5E`.
- **Internal Padding:** `32px` (`--card-pad`).

### Inputs / Fields
- **Style:** fondo `rgba(255,255,255,0.04)`, borde `rgba(255,255,255,0.18)`, **esquina viva** (0px), altura 56px. Usa *floating label* puro CSS: la etiqueta vive sobre el campo y sube al enfocar o con valor.
- **Focus:** el borde pasa a champán (`#E9D7B1`), el fondo sube a `rgba(255,255,255,0.06)`, y la etiqueta flotante se vuelve micro-label en mayúsculas champán.
- **Success:** bloque fósforo (`rgba(125,255,178,0.10)` con borde `rgba(125,255,178,0.35)`, texto fósforo).
- **Checkbox:** caja de 16px de esquina viva; al marcar se rellena champán con check esmeralda.

### Navigation
- **Style:** navbar fijo transparente (76px), wordmark serif italic 28px a la izquierda; enlaces en Label sans uppercase. Color heredado del tema (`--theme-fg`), con transición de 80ms entre día/noche.
- **States:** enlace activo en champán (`--nav-link-fg-active`); hover de enlaces hacia champán.
- **Mobile:** los enlaces colapsan en un drawer con botón-ícono `.nav__icon-btn--menu`.

### Progress Rail (signature)
Riel vertical a la derecha (1px, 280px de alto) sobre `--theme-fg-hairline`, con relleno champán (`.rail__fill`) que crece con el scroll. Lleva una etiqueta de fase en Label uppercase arriba y un porcentaje en mono abajo. Es la firma de navegación de la experiencia scroll-driven; se oculta en móvil.

### Edition Badge (signature)
Número de serie `Nº 01/100` en Label champán con tracking 0.32em y `tabular-nums`, anclado al hero. Comunica la edición limitada sin gritar.

## 6. Do's and Don'ts

### Do:
- **Do** mantener el esmeralda casi negro como suelo de toda composición; la oscuridad es el lienzo, no un modo.
- **Do** usar el verde fósforo como una sola luz emergente (glow, halo, respiración), en ≤10% de la pantalla.
- **Do** escribir titulares en Cormorant *italic*; reservar las mayúsculas tracked solo para etiquetas, eyebrows y seriales.
- **Do** dar esquina viva (0px) a botones e inputs, y redondeo solo a superficies (12–18px).
- **Do** verificar contraste ≥4.5:1 para todo cuerpo de texto sobre oscuro o sobre imágenes vivas; los textos sobre el ángel/alas brillantes necesitan halo o reubicación.
- **Do** ofrecer alternativa de `prefers-reduced-motion` (crossfade/estado estático) sin dejar contenido invisible.
- **Do** tratar cada texto como bilingüe `{ es, en }`; ningún significado atado a un solo idioma.

### Don't:
- **Don't** parecer e-commerce de joyería genérico: grids de producto, badges de descuento, "Añadir al carrito" como protagonista, reviews.
- **Don't** caer en lujo blanco/minimalista aireado tipo Apple/escandinavo; ELYXIE es nocturno y denso.
- **Don't** usar kitsch new-age de tienda de cristales: degradados arcoíris, chakras de clip-art, "energías sanadoras".
- **Don't** usar negro puro (`#000000`); el negro de la marca siempre es esmeralda (`#051613`).
- **Don't** usar rojo vibrante para errores; el único error es el bronce desaturado `#D97757`.
- **Don't** rellenar la pantalla con verde fósforo ni con múltiples acentos compitiendo; la contención es la fuerza.
- **Don't** usar side-stripe borders (`border-left` >1px de color), gradient text, ni glassmorphism decorativo por defecto.
- **Don't** poner el cuerpo de texto en mayúsculas ni usar grises planos sobre fondos de color (lava el texto).
