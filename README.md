# elyxie

> un santuario que se lleva puesto

Sitio one-page para Elyxie con escena 3D scroll-driven (Three.js), construido con React + Babel servido como sitio estático.

## Stack

- HTML estático
- React 18 + Babel (in-browser, via UMD)
- Three.js 0.160 para la escena 3D del pendant
- CSS responsive (mobile / tablet / desktop)

## Estructura

```
index.html              entry point
app.jsx                 layout principal y nav + drawer móvil
pendant.jsx             escena Three.js scroll-driven
sections.jsx            secciones 2–7
tweaks-panel.jsx        panel de ajustes en vivo
styles.css              estilos completos (incluye breakpoints mobile/tablet)
assets/                 fuentes, SVGs, fotografía
```

## Desarrollo local

Cualquier servidor estático sirve. Ejemplos:

```bash
python3 -m http.server 8000
# o
npx serve .
```

Abre http://localhost:8000.

## Deploy

El sitio en vivo es un tema de Shopify (carpeta `theme/`). `node build.js` compila los `.jsx` a `dist/*.js` y los espeja en `theme/assets/`; el tema se publica con el editor de código de Shopify o `shopify theme push`.
