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

Configurado para Vercel como sitio estático (sin build step). El archivo `vercel.json` deja que Vercel sirva los `.jsx` con `Content-Type: text/babel` que requiere el loader in-browser.
