// === sections.jsx ===
// Sections 2–7 (post-hero). Structure mirrors the lightweight.info homepage
// (video → instagram grid → full-bleed statement → newsletter → outro
// wordmark → 6-col footer), but every byte of copy, imagery and chrome is
// Elyxie's.

const { useState: useS, useEffect: useE, useRef: useR } = React;

// ── Container ────────────────────────────────────────────────────────────
function Container({ children, className = '' }) {
  return <div className={`Container ${className}`}>{children}</div>;
}

// ===========================================================
//  Section 2 — Films: tabbed player (responsive + fullscreen)
// ===========================================================
// Tab 1 "Viaje a la Laguna" = el filme actual (assets/video/main-film*).
// Tabs 2-4 = videos alojados en Shopify (window.__ELYXIE.films[id] = {src, src720, poster, w, h}).
const FILMS = [
  { id: 'viaje',    label: { es: 'Viaje a la Laguna', en: 'Journey to the Lagoon' },
    caption: { es: 'El filme. Tres minutos en la cordillera, antes de bajar el agua.', en: 'The film. Three minutes in the cordillera, before the water comes down.' } },
  { id: 'missperu', label: { es: 'El seguro de Miss Perú', en: "Miss Perú's Seguro" },
    caption: { es: 'La protección no se exhibe. Se lleva encima.', en: 'Protection is not displayed. It is carried.' } },
  { id: 'contodo',  label: { es: 'Siempre encima', en: 'Always Worn' },
    caption: { es: 'El pacto no se guarda. Se lleva.', en: 'The pact is not kept. It is carried.' } },
  { id: 'historia', label: { es: 'Antes de la joya', en: 'Before the Jewel' },
    caption: { es: 'Milenios de curanderos. Un agua que cierra heridas invisibles.', en: 'Millennia of curanderos. A water that closes invisible wounds.' } },
];

function SectionVideoHero({ lang }) {
  const videoRef = useR(null);
  const figRef = useR(null);
  const [soundOn, setSoundOn] = useS(false);
  const [active, setActive] = useS('viaje');

  const [isNarrow, setIsNarrow] = useS(
    typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
  );
  useE(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const onChange = (e) => setIsNarrow(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const films = (typeof window !== 'undefined' && window.__ELYXIE && window.__ELYXIE.films) || {};
  const srcFor = (id) => {
    if (id === 'viaje') return ELYXIE_ASSET(isNarrow ? 'assets/video/main-film-720.mp4' : 'assets/video/main-film.mp4');
    const f = films[id];
    if (!f) return null;
    return (isNarrow && f.src720) ? f.src720 : f.src;
  };
  const posterFor = (id) => {
    if (id === 'viaje') return ELYXIE_ASSET('assets/photography/main-film-poster-1440.jpg');
    const f = films[id];
    return (f && f.poster) || undefined;
  };
  // Aspect-ratio hint (so the frame is right-sized before metadata loads → no jump)
  const arFor = (id) => {
    if (id === 'viaje') return 16 / 9;
    const f = films[id];
    return (f && f.w && f.h) ? f.w / f.h : 16 / 9;
  };

  const activeFilm = FILMS.find((f) => f.id === active) || FILMS[0];
  const src = srcFor(active);

  // Size the frame to the video's real aspect ratio, capped at ~80vh. Works for
  // landscape (16:9) and portrait (9:16) alike — no crop, no letterbox.
  const fit = () => {
    const v = videoRef.current, fig = figRef.current;
    if (!fig) return;
    const ar = (v && v.videoWidth && v.videoHeight) ? v.videoWidth / v.videoHeight : arFor(active);
    const avail = (fig.parentElement && fig.parentElement.clientWidth) || fig.clientWidth || 0;
    if (!avail) return;
    const maxH = Math.min((window.innerHeight || 800) * (isNarrow ? 0.74 : 0.82), 820);
    let w = avail, h = w / ar;
    if (h > maxH) { h = maxH; w = h * ar; }
    fig.style.width = Math.round(w) + 'px';
    fig.style.height = Math.round(h) + 'px';
  };
  useE(() => { fit(); /* eslint-disable-next-line */ }, [active, isNarrow]);
  useE(() => {
    const onR = () => fit();
    window.addEventListener('resize', onR);
    return () => window.removeEventListener('resize', onR);
  }, [active, isNarrow]);

  // Autoplay only while in view (muted, so the browser allows it). Pause
  // off-screen. prefers-reduced-motion suprime el autoplay por completo:
  // el poster queda quieto y el usuario decide si reproduce.
  useE(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !soundOn;
    const prm = window.matchMedia('(prefers-reduced-motion: reduce)');
    const io = new IntersectionObserver(
      ([entry]) => {
        if (prm.matches) { v.pause(); return; }
        if (entry.isIntersecting && entry.intersectionRatio >= 0.35) v.play().catch(() => {});
        else v.pause();
      },
      { threshold: [0, 0.35, 0.6] }
    );
    io.observe(v);
    return () => io.disconnect();
  }, [src]);

  const toggleSound = () => {
    const v = videoRef.current;
    if (!v) return;
    const next = !soundOn;
    v.muted = !next;
    if (next && v.paused) v.play().catch(() => {});
    setSoundOn(next);
  };
  const goFull = () => {
    const el = figRef.current, v = videoRef.current;
    try {
      if (el && el.requestFullscreen) el.requestFullscreen();
      else if (el && el.webkitRequestFullscreen) el.webkitRequestFullscreen();
      else if (v && v.webkitEnterFullscreen) v.webkitEnterFullscreen(); // iOS Safari
    } catch (e) {}
  };
  // El estado de sonido PERSISTE entre videos: no se resetea al cambiar de pestaña.
  const selectFilm = (id) => { if (id === active) return; setActive(id); };

  const t = lang === 'es'
    ? { eyebrow: 'CINEMATOGRAFÍA · ELYXIE', sound: soundOn ? 'SILENCIAR' : 'ACTIVAR SONIDO', full: 'PANTALLA COMPLETA' }
    : { eyebrow: 'CINEMATOGRAPHY · ELYXIE', sound: soundOn ? 'MUTE' : 'SOUND ON', full: 'FULLSCREEN' };
  const caption = (activeFilm.caption && activeFilm.caption[lang]) || '';

  return (
    // id="relato": destino del item RELATO/STORY de los link lists del Admin
    // (apuntan a /#relato) — el filme ES el relato de la marca.
    <section id="relato" className="Section theme-light" data-theme="light" data-section="hero-video" data-screen-label="02 Video">
      <Container>
        <div className="VideoSection__eyebrow">
          <span className="VideoSection__line"></span>
          {t.eyebrow}
        </div>

        <div className="FilmTabs" role="tablist" aria-label="Films">
          {FILMS.map((f) => (
            <button
              key={f.id}
              role="tab"
              type="button"
              aria-selected={active === f.id}
              data-on={active === f.id ? 'true' : 'false'}
              className="FilmTab"
              onClick={() => selectFilm(f.id)}
            >
              {f.label[lang]}
            </button>
          ))}
        </div>

        <figure className="MediaPlayer" ref={figRef} style={{ aspectRatio: String(arFor(active)) }}>
          <video
            key={src}
            ref={videoRef}
            className="MediaPlayer__video"
            playsInline muted loop
            preload="metadata"
            poster={posterFor(active)}
            onLoadedMetadata={fit}
          >
            {src && <source src={src} type="video/mp4"/>}
          </video>

          <div className="MediaPlayer__controls">
            <button className="PlayButton" onClick={toggleSound} aria-label={t.sound} aria-pressed={soundOn}>
              {soundOn ? (
                <svg width="16" height="14" viewBox="0 0 18 16" fill="none" aria-hidden>
                  <path d="M1 5.5H4L8 2V14L4 10.5H1V5.5Z" fill="currentColor"/>
                  <path d="M11 5C12.2 6.2 12.2 9.8 11 11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                  <path d="M13.5 3C15.8 5.2 15.8 10.8 13.5 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
              ) : (
                <svg width="16" height="14" viewBox="0 0 18 16" fill="none" aria-hidden>
                  <path d="M1 5.5H4L8 2V14L4 10.5H1V5.5Z" fill="currentColor"/>
                  <path d="M11.5 5.5L16 10.5M16 5.5L11.5 10.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
              )}
              <span className="PlayButton__label">{t.sound}</span>
            </button>
            <button className="PlayButton PlayButton--icon" onClick={goFull} aria-label={t.full} title={t.full}>
              <svg width="15" height="15" viewBox="0 0 18 18" fill="none" aria-hidden>
                <path d="M2 6.5V2.5H6M16 6.5V2.5H12M2 11.5V15.5H6M16 11.5V15.5H12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </figure>

        {caption && <figcaption className="MediaPlayer__caption">{caption}</figcaption>}
      </Container>
    </section>
  );
}

// ===========================================================
//  Section 3 — Provenance ("what the sphere holds")
// ===========================================================
function IconGeological() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" aria-hidden>
    <path d="M2.5 19h19L14 7l-3 4.6L8.7 8.2z"/>
  </svg>;
}
function IconAncestral() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M12 1.4c.55 4.9 1.7 6.05 6.6 6.6-4.9.55-6.05 1.7-6.6 6.6-.55-4.9-1.7-6.05-6.6-6.6 4.9-.55 6.05-1.7 6.6-6.6z"/>
    <path d="M18.5 15.2c.27 2.4.83 2.96 3.2 3.2-2.37.24-2.93.8-3.2 3.2-.27-2.4-.83-2.96-3.2-3.2 2.37-.24 2.93-.8 3.2-3.2z"/>
  </svg>;
}
function IconMetaphysical() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden>
    <path d="M12 2.4l7 2.6v5.4c0 4.7-3 7.9-7 9.6-4-1.7-7-4.9-7-9.6V5z"/>
  </svg>;
}

const PROVENANCE = [
  {
    Icon: IconGeological,
    es: { label: 'GEOLÓGICO', title: 'Nace a 3.957 metros', body: 'En lo más alto de los Andes, donde el aire escasea y el mundo se queda en silencio, la Laguna Negra guarda un agua que la montaña tardó siglos en reunir. No es un lago. Es un reservorio de tiempo.' },
    en: { label: 'GEOLOGICAL', title: 'Born at 3,957 meters', body: 'High in the Andes, where the air thins and the world falls silent, the Black Lagoon holds water the mountain took centuries to gather. It is not a lake. It is a reservoir of time.' },
  },
  {
    Icon: IconAncestral,
    es: { label: 'ANCESTRAL', title: '3.000 años de linaje', body: 'La evidencia arqueológica une este paisaje a las culturas Cupisnique y Chavín. Una red de caminos sagrados existió con un solo propósito: transportar esta agua.' },
    en: { label: 'ANCESTRAL', title: '3,000 years of lineage', body: 'Archaeological evidence ties this landscape to the Cupisnique and Chavín cultures. A network of sacred paths existed for a single purpose: to carry this water.' },
  },
  {
    Icon: IconMetaphysical,
    es: { label: 'METAFÍSICO', title: 'Mamayacu, la madre del agua', body: 'En la cosmovisión andina, la laguna no es un recurso: es un ser vivo. Mamayacu, el Agua Madre, capaz de absorber lo que pesa sobre una persona y devolverla limpia.' },
    en: { label: 'METAPHYSICAL', title: 'Mamayacu, mother of the water', body: 'In the Andean worldview, the lagoon is not a resource: it is a living being. Mamayacu, the Mother Water, able to absorb what weighs on a person and return them cleansed.' },
  },
];

// ── Procedencia · «Descenso por estratos» — motor de animación ─────────────
// La sección se rediseñó motion-first: las tres cards son estratos de
// profundidad de la Laguna Negra (geológico → ancestral → metafísico) y el
// scroll es la inmersión. El elemento firma es la LÍNEA DE SONDA: 1px dorado
// que se dibuja con el progreso de scroll por el margen izquierdo, como una
// plomada midiendo profundidad. Cada estrato emerge de la oscuridad cuando la
// punta de la línea alcanza su nodo; una única luz cálida (One Light Rule)
// desciende con esa punta y se asienta en el tercer estrato.
//
// EJE SEGÚN VIEWPORT: en tablet/móvil la sonda es VERTICAL por el margen
// izquierdo de la columna de cards apiladas; en desktop (≥1025px) las tres
// cards pasan a una FILA a la misma altura y la sonda se vuelve HORIZONTAL por
// encima de ellas (misma coreografía, eje X). measure()/tick() son agnósticos
// al eje: leen el breakpoint (igual que el CSS) y operan sobre un escalar.
//
// Todo el motor vive en funciones puras (sin React): initStrataMotion(section)
// opera sobre data-attributes y devuelve un cleanup. React solo monta el
// markup y llama al init en un useEffect — pensado para portar el sistema al
// theme de Shopify sin tocar la lógica.
//
// Reparto de responsabilidades:
//   · Acoplado a scroll (reversible, smootherstep): línea (scaleY), luz
//     (translate3d), nodos encendidos y estrato activo. Cero estado React por
//     frame: el driver escribe transform/opacity directamente sobre el DOM.
//   · One-shot (no se repite al subir): revelado del titular, secuencia de
//     cada estrato (anillo → etiqueta → título+cifra → párrafo) y los
//     conteos. Los dispara la PROPIA punta de la línea (un solo origen de
//     verdad, sin IntersectionObserver): scroll rápido al footer → p≈1 →
//     todo queda completado; volver a subir nunca des-revela.
//   · prefers-reduced-motion: los estados pre-revelado solo se arman bajo
//     @media (prefers-reduced-motion: no-preference) en CSS, así que con
//     reduce la sección pinta completa y estática (línea llena, cifras
//     finales, sin luz). Chequeado en vivo en cada tick, no congelado.

// Quintic — cero 1ª y 2ª derivada en los extremos (convención del repo para
// todo lo acoplado a scroll). El arranque lento hace que la línea apenas se
// mueva mientras el titular se asienta (p 0.08–0.18) y el final lento la
// posa suavemente en el reposo (p≈0.90).
function strataSmootherstep(x) {
  const u = Math.max(0, Math.min(1, x));
  return u * u * u * (u * (u * 6 - 15) + 10);
}

// «3957» → «3.957» (ES) / «3,957» (EN). El separador viene del propio copy.
function strataFormatInt(n, sep) {
  let s = String(n), out = '';
  while (s.length > 3) { out = sep + s.slice(-3) + out; s = s.slice(0, -3); }
  return s + out;
}

function initStrataMotion(section) {
  const rail   = section.querySelector('[data-rail]');
  const fill   = section.querySelector('[data-rail-fill]');
  const lamp   = section.querySelector('[data-lamp]');
  const head   = section.querySelector('[data-head]');
  const strata = Array.prototype.slice.call(section.querySelectorAll('[data-stratum]'));
  if (!rail || !fill || !lamp || !head || !strata.length) return undefined;

  const prm = window.matchMedia('(prefers-reduced-motion: reduce)');
  // Eje de la sonda: horizontal en desktop (fila de cards), vertical si no.
  // Mismo breakpoint que el CSS. Se lee en vivo dentro de measure(), que se
  // recalcula en cada resize (onResize anula geom) → cruzar 1025px reorienta.
  const horizMq = window.matchMedia('(min-width: 1025px)');
  const timers = [];   // setTimeout ids (delay de arranque de los conteos)
  const rafs = [];     // rAF ids de conteos en vuelo (ids viejos: cancel inocuo)
  let raf = 0;         // rAF del driver de scroll
  let geom = null;     // medidas cacheadas (offsets de estratos, alto del rail)
  let lastBucket = -1; // cuantización del progreso de línea (evita writes redundantes)
  let lastActive = -2; // índice del estrato bajo la luz
  let isLive = false;  // sección cerca del viewport → will-change armado
  let staticDone = false;

  // El conteo escribe el live imperativamente, así que tras un re-init por
  // cambio de idioma (React conserva los <li> y sus data-attrs pero re-monta
  // el texto) hay que re-sincronizar el live con el ghost del idioma nuevo.
  function syncCount(li) {
    const live = li.querySelector('.Stratum__numLive');
    const ghost = li.querySelector('.Stratum__numGhost');
    if (live && ghost) live.textContent = ghost.textContent;
  }
  strata.forEach((li) => { if (li.dataset.revealed === 'true') syncCount(li); });

  // Cifra viva: cuenta de 0 al valor con easeOutExpo (decel fuerte: pasa de
  // 4 cifras en el primer ~10% y aterriza muy despacio, como una sonda
  // tocando fondo). El ancho ya está reservado por el ghost → CLS 0. El live
  // nace con el valor final en el markup, así que solo se pone a 0 en el
  // instante en que el conteo arranca de verdad.
  function animateCount(li) {
    const numEl = li.querySelector('[data-count]');
    if (!numEl) return;
    if (prm.matches) { syncCount(li); return; }
    const live = numEl.querySelector('.Stratum__numLive');
    const target = parseInt(numEl.dataset.count, 10);
    const sep = numEl.dataset.sep || '.';
    if (!live || !isFinite(target)) return;
    // 320ms ≈ el delay del título en el stagger CSS: la cifra empieza a
    // contar justo cuando el serif emerge de su máscara. prm se re-chequea
    // dentro del timer Y del loop: si el usuario activa «reduce» a mitad de
    // conteo, la cifra salta a su valor final en el siguiente frame.
    timers.push(setTimeout(() => {
      if (prm.matches) { syncCount(li); return; }
      const t0 = performance.now();
      live.textContent = '0';
      const frame = (now) => {
        if (prm.matches) { syncCount(li); return; }
        const k = Math.min(1, (now - t0) / 1500);
        const e = k >= 1 ? 1 : 1 - Math.pow(2, -10 * k);
        live.textContent = strataFormatInt(Math.round(target * e), sep);
        if (k < 1) rafs.push(requestAnimationFrame(frame));
      };
      rafs.push(requestAnimationFrame(frame));
    }, 320));
  }

  function revealStratum(li) {
    if (li.dataset.revealed === 'true') return;
    li.dataset.revealed = 'true'; // el stagger del estrato vive en CSS
    animateCount(li);
  }
  function revealHead() {
    if (head.dataset.revealed !== 'true') head.dataset.revealed = 'true';
  }

  // Geometría en el espacio del rail (.Strata es el offsetParent de los <li>
  // y el rail lo cubre con inset 0 → mismas coordenadas). Medida solo en
  // init/resize, nunca por frame.
  function measure() {
    // Geometría 1-D a lo largo de la sonda: start/end y posición del nodo van
    // sobre el eje activo (offsetLeft/Width en horizontal, offsetTop/Height en
    // vertical), todo en el espacio del rail (.Strata es el offsetParent).
    const horiz = horizMq.matches;
    const bands = strata.map((li) => {
      const node = li.querySelector('[data-node]');
      const start = horiz ? li.offsetLeft : li.offsetTop;
      const size  = horiz ? li.offsetWidth : li.offsetHeight;
      const nodeMid = node
        ? (horiz ? node.offsetLeft + node.offsetWidth / 2
                 : node.offsetTop + node.offsetHeight / 2)
        : 0;
      return { el: li, node, start, end: start + size, nodePos: start + nodeMid };
    });
    const last = bands[bands.length - 1];
    geom = {
      horiz,
      railLen: Math.max(1, horiz ? rail.offsetWidth : rail.offsetHeight),
      bands,
      // «La luz se asienta aquí»: la plomada llega al fondo, pero la luz se
      // queda en el corazón del tercer estrato.
      lampMax: last.start + (last.end - last.start) * 0.5,
    };
    // Geometría nueva → tip/lampPos cambian aunque lineP no: invalida la
    // cuantización para forzar la siguiente escritura completa.
    lastBucket = -1;
  }

  // Progreso de sección p ∈ [0,1]: 0 cuando el top de la sección cruza el
  // 88% del viewport (entrando), 1 cuando el fondo de la sección alcanza el
  // 50% (terminada de leer). Independiente de pin/sticky: scroll nativo puro.
  function sectionProgress() {
    const r = section.getBoundingClientRect();
    const vh = window.innerHeight || 1;
    const p = Math.max(0, Math.min(1, (vh * 0.88 - r.top) / Math.max(1, r.height + vh * 0.38)));
    return { r, vh, p };
  }

  // Estado estático digno para reduced-motion: revela todo al instante (las
  // transiciones están desactivadas por el media query), cancela los conteos
  // en vuelo (un rAF cancelado deja el live a medias → re-sync), limpia los
  // inline styles para que ganen los valores CSS de reduce (línea llena, sin
  // luz) y desarma el will-change — los ticks siguientes salen por la rama
  // prm sin pasar por el bookkeeping de cercanía.
  function applyStatic() {
    revealHead();
    strata.forEach(revealStratum);
    timers.forEach(clearTimeout); timers.length = 0;
    rafs.forEach(cancelAnimationFrame); rafs.length = 0;
    strata.forEach(syncCount);
    fill.style.transform = '';
    lamp.style.transform = '';
    lamp.style.opacity = '';
    lastBucket = -1;
    isLive = false;
    section.removeAttribute('data-strata-live');
  }

  function tick() {
    raf = 0;
    if (prm.matches) {
      if (!staticDone) { staticDone = true; applyStatic(); }
      return;
    }
    staticDone = false;
    if (!geom) measure();
    const { r, vh, p } = sectionProgress();

    // Completado one-shot ANTES de cualquier descarte por distancia: un salto
    // directo al footer deja la sección lejos del viewport, pero los disparos
    // tienen que quedar consumados igual (criterio «scroll rápido → nada
    // roto»). Idempotente y barato.
    if (p > 0.92) {
      revealHead();
      for (let i = 0; i < strata.length; i++) revealStratum(strata[i]);
    }

    // will-change quirúrgico: armado solo mientras la sección ronda el
    // viewport; fuera de él no se paga compositing ni trabajo por tick.
    const near = r.bottom > -200 && r.top < vh + 200;
    if (near !== isLive) {
      isLive = near;
      section.toggleAttribute('data-strata-live', near);
    }
    if (!near) return;

    // Coreografía: p 0.00–0.10 header; la línea nace bajo el titular en 0.08
    // y se completa en 0.90 (reposo 0.90–1.00).
    if (p >= 0.05) revealHead();
    const lineP = strataSmootherstep((p - 0.08) / 0.82);
    const tip = lineP * geom.railLen;

    // Revelados one-shot disparados por la punta de la línea («alcanzar su
    // profundidad»): el estrato emerge cuando la plomada toca su nodo.
    for (let i = 0; i < geom.bands.length; i++) {
      if (tip >= geom.bands[i].nodePos) revealStratum(geom.bands[i].el);
    }

    // Valores continuos, cuantizados a 1/2000 del recorrido para no escribir
    // estilos redundantes en cada evento de scroll.
    const bucket = Math.round(lineP * 2000);
    if (bucket === lastBucket) return;
    lastBucket = bucket;
    // scaleX (sonda horizontal, desktop) o scaleY (vertical). El driver escribe
    // el eje; transform-origin lo fija el CSS (left/top center según media).
    fill.style.transform = (geom.horiz ? 'scaleX(' : 'scaleY(') + lineP.toFixed(4) + ')';
    const lampPos = Math.min(tip, geom.lampMax);
    lamp.style.transform = geom.horiz
      ? 'translate3d(' + lampPos.toFixed(1) + 'px,0,0)'
      : 'translate3d(0,' + lampPos.toFixed(1) + 'px,0)';
    // La luz se enciende con los primeros centímetros de línea (reversible).
    lamp.style.opacity = Math.min(1, lineP * 10).toFixed(3);

    let act = -1;
    for (let i = 0; i < geom.bands.length; i++) {
      const b = geom.bands[i];
      const lit = tip >= b.nodePos;
      if (b.node && (b.node.dataset.lit === 'true') !== lit) {
        b.node.dataset.lit = lit ? 'true' : 'false';
      }
      // Activo desde su nodo de profundidad (no desde el borde superior de la
      // card): la luz «alcanza» el estrato en el mismo beat que su revelado —
      // nunca ilumina el borde de una card aún vacía.
      if (lampPos >= b.nodePos && lampPos < b.end) act = i;
    }
    if (act !== lastActive) {
      lastActive = act;
      for (let i = 0; i < geom.bands.length; i++) {
        geom.bands[i].el.dataset.active = i === act ? 'true' : 'false';
      }
    }
  }

  const onScroll = () => { if (!raf) raf = requestAnimationFrame(tick); };
  const onResize = () => { geom = null; onScroll(); };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize);
  // Toggle de reduced-motion EN VIVO: sin esto, activar «reduce» con la
  // página quieta no aplicaría el estado estático hasta el siguiente scroll.
  const onPrm = () => onScroll();
  if (prm.addEventListener) prm.addEventListener('change', onPrm);
  // Cubre lo que resize no ve: swap de webfonts, cambios de contenido por
  // idioma — cualquier cosa que mueva los offsets de los estratos.
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onResize) : null;
  if (ro) ro.observe(rail.parentElement);

  // Arma los estados pre-revelado SOLO una vez que el motor existe: sin JS
  // la sección pinta completa y estática (nunca contenido oculto huérfano).
  section.setAttribute('data-strata-ready', '');
  onScroll();

  return function cleanup() {
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onResize);
    if (prm.removeEventListener) prm.removeEventListener('change', onPrm);
    if (ro) ro.disconnect();
    if (raf) cancelAnimationFrame(raf);
    timers.forEach(clearTimeout);
    rafs.forEach(cancelAnimationFrame);
    section.removeAttribute('data-strata-live');
  };
}

// Divide el título en [antes, cifra, después] cuando contiene una cifra de
// miles («3.957» / «3,957»). El ghost (visibility:hidden) reserva el ancho
// EXACTO del valor final — el serif nunca se reacomoda durante el conteo
// (CLS 0) — y el live (absoluto encima, alineado a la derecha para que la
// cifra crezca pegada a su unidad) es el que cuenta. El live nace con el
// valor final: sin JS, pre-init o con reduced-motion ya se lee correcto.
function StratumTitle({ title }) {
  const m = title.match(/\d{1,3}[.,]\d{3}/);
  if (!m) return title;
  const num = m[0];
  return <>
    {title.slice(0, m.index)}
    <span className="Stratum__num"
          data-count={num.replace(/[.,]/g, '')}
          data-sep={num.indexOf('.') !== -1 ? '.' : ','}>
      <span className="Stratum__numGhost">{num}</span>
      <span className="Stratum__numLive">{num}</span>
    </span>
    {title.slice(m.index + num.length)}
  </>;
}

function SectionProvenance({ lang }) {
  const t = lang === 'es'
    ? { eyebrow: 'PROCEDENCIA · LO QUE GUARDA LA ESFERA', lines: [<>No es un detalle estético.</>, <em>Es un núcleo energético.</em>] }
    : { eyebrow: 'PROVENANCE · WHAT THE SPHERE HOLDS', lines: [<>Not an aesthetic detail.</>, <em>An energetic core.</em>] };

  // El efecto re-corre al cambiar de idioma (el markup se re-monta con el
  // texto nuevo); initStrataMotion respeta los data-revealed que ya estaban
  // puestos, así que las secuencias one-shot no se repiten.
  const rootRef = useR(null);
  useE(() => {
    const el = rootRef.current;
    if (!el) return;
    return initStrataMotion(el);
  }, [lang]);

  return (
    <section ref={rootRef} className="Section theme-dark Provenance" data-theme="dark" data-section="provenance" data-screen-label="03 Provenance">
      <Container>
        <div className="Provenance__col">
          <p className="eyebrow-label Provenance__eyebrow">{t.eyebrow}</p>
          {/* Titular con revelado por máscara línea a línea: cada línea es un
              clip estático y su inner sube desde abajo (solo transform). */}
          <h2 className="Provenance__head" data-head>
            {t.lines.map((line, i) => (
              <span key={i} className="Provenance__headLine" style={{ '--line-i': i }}>
                <span className="Provenance__headLineInner">{line}</span>
              </span>
            ))}
          </h2>

          <div className="Strata">
            {/* La línea de sonda: track tenue (el camino), fill dorado que se
                dibuja con el scroll (scaleY) y la única luz de la sección
                cabalgando su punta (translate3d). */}
            <div className="Strata__rail" data-rail aria-hidden>
              <span className="Strata__railTrack"></span>
              <span className="Strata__railFill" data-rail-fill></span>
              <span className="Strata__lamp" data-lamp></span>
            </div>
            {/* role="list" explícito: list-style:none dispara la heurística
                de WebKit que borra el rol implícito (VoiceOver dejaría de
                anunciar «lista, 3 elementos»). */}
            <ol className="Strata__list" role="list">
              {PROVENANCE.map((c, i) => {
                const Icon = c.Icon;
                return (
                  <li key={i} className="Stratum" data-stratum>
                    {/* Nodo de profundidad: rombo sobre la línea, a la altura
                        del icono; se enciende cuando la plomada lo cruza. */}
                    <span className="Stratum__node" data-node aria-hidden></span>
                    {/* Borde iluminado del estrato activo: anillo-gradiente
                        orientado hacia la línea (es reflejo de ESA luz, no
                        una fuente nueva) que respira muy lento vía ::after. */}
                    <span className="Stratum__glow" aria-hidden></span>
                    <span className="Stratum__icon" aria-hidden>
                      <svg className="Stratum__ring" viewBox="0 0 48 48" fill="none" aria-hidden>
                        <circle cx="24" cy="24" r="23.5" pathLength="1"/>
                      </svg>
                      <span className="Stratum__iconGlyph"><Icon/></span>
                    </span>
                    {/* Etiqueta «tracking-in»: cada carácter parte desplazado
                        hacia el inicio (tracking comprimido) y desliza a su
                        sitio natural — solo transform/opacity, el layout
                        final está reservado desde el primer frame (CLS 0). */}
                    <span className="Stratum__label">
                      <span className="sr-only">{c[lang].label}</span>
                      <span className="Stratum__chars" aria-hidden="true">
                        {c[lang].label.split('').map((ch, k) => (
                          <span key={k} className="Stratum__ch" style={{ '--ch-i': k }}>{ch === ' ' ? ' ' : ch}</span>
                        ))}
                      </span>
                    </span>
                    <h3 className="Stratum__title" aria-label={c[lang].title}>
                      <span className="Stratum__titleInner" aria-hidden="true"><StratumTitle title={c[lang].title}/></span>
                    </h3>
                    <p className="Stratum__body">{c[lang].body}</p>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </Container>
    </section>
  );
}

// ===========================================================
//  Section 3.5 — Vitrina (piece configurator / "configurador-vitrina")
//  Sits between Provenance and Certificate. ONE product (the angel) in
//  three finishes, each with a chain variant. NOT an e-commerce carousel:
//  a dark "altar" where the cream catalog photo lives inside a spotlit
//  display panel (cf. the boxed angel under a downlight), cross-fading on
//  select. The hero's MATERIA phase ("Tres acabados. Una sola alma. …
//  Eliges la piel") is paid off here, so the copy deliberately echoes it.
// ===========================================================

// The three metals of the single piece. `swatch` is a CSS gradient that
// stands in for the metal on the selector discs (a "noble material", not a
// shop swatch). `material` is the struck uppercase label; `line` the one
// poetic line. `price` reads as the big serif number; the chain never alters it.
const VITRINA_FINISHES = [
  {
    id: 'plata',
    price: 'USD 290',
    swatch: 'linear-gradient(145deg, #F4F5F7 0%, #C9CDD2 46%, #94999F 100%)',
    es: { name: 'Plata', material: 'PLATA FINA 950', line: 'El recipiente original. Brillante, lunar, honesto.' },
    en: { name: 'Silver', material: '950 FINE SILVER', line: 'The original vessel. Bright, lunar, honest.' },
  },
  {
    id: 'rodio',
    price: 'USD 490',
    swatch: 'linear-gradient(145deg, #FFFFFF 0%, #E4E8EC 46%, #B2BAC2 100%)',
    es: { name: 'Rodio', material: 'PLATA 950 SELLADA EN RODIO', line: 'Plata 950 sellada en rodio, más blanca, brillante y duradera.' },
    en: { name: 'Rhodium', material: 'RHODIUM-SEALED 950 SILVER', line: '950 silver sealed in rhodium, whiter, brighter and more durable.' },
  },
  {
    id: 'oro',
    price: 'USD 990',
    swatch: 'linear-gradient(145deg, #F6E4B8 0%, #D9B36B 46%, #A37C3A 100%)',
    es: { name: 'Oro', material: 'ORO 18K SOBRE PLATA 950', line: 'Plata 950, con 5 micras de oro 18k, duradero para 5 años de uso diario.' },
    en: { name: 'Gold', material: '18K GOLD OVER 950 SILVER', line: '950 silver, with 5 microns of 18k gold, durable for 5 years of daily wear.' },
  },
];

// The chain variant. Independent of finish; does not change the price.
// `icon` picks the Panzer glyph: 'fine' (smaller, denser links) for her, 'curb'
// (fewer, larger links) for him. `spec` is the length + link.
const VITRINA_CHAINS = [
  { id: 'ella', icon: 'fine', name: { es: 'Para ella', en: 'For her' }, spec: { es: '50 cm · Panzer 050 · Ley 925', en: '50 cm · Panzer 050 · 925 Sterling' } },
  { id: 'el',   icon: 'curb', name: { es: 'Para él',   en: 'For him' }, spec: { es: '65 cm · Panzer 080 · Ley 925', en: '65 cm · Panzer 080 · 925 Sterling' } },
];

// The two shots we hold for every finish×chain: the piece worn on the bust
// (`dije-*`, the hero) and the chain laid out in detail (`cadena-*`). They feed
// both the big viewer and the thumbnail strip below it. `objPos` frames each in
// a square (lift the pendant on the bust shot; centre the chain). `sizes` lists
// the responsive widths that actually exist on disk for that prefix.
const VITRINA_VIEWS = [
  { id: 'dije',   prefix: 'dije',   sizes: [480, 800, 1200], objPos: 'center 32%', label: { es: 'La pieza',  en: 'The piece' } },
  { id: 'cadena', prefix: 'cadena', sizes: [360, 640],       objPos: 'center 50%', label: { es: 'La cadena', en: 'The chain' } },
];

// Tiny chain glyph for the two chain tiles: both are flat Panzer links. 'fine'
// (for her) reads as smaller, denser links with one extra; 'curb' (for him) as
// fewer, larger links. Stroke inherits currentColor (gold when active).
function ChainGlyph({ kind }) {
  return kind === 'fine' ? (
    <svg width="46" height="14" viewBox="0 0 46 14" fill="none" aria-hidden focusable="false">
      <rect x="4"  y="4" width="12" height="6" rx="3" stroke="currentColor" strokeWidth="1.3" />
      <rect x="13" y="4" width="12" height="6" rx="3" stroke="currentColor" strokeWidth="1.3" />
      <rect x="22" y="4" width="12" height="6" rx="3" stroke="currentColor" strokeWidth="1.3" />
      <rect x="31" y="4" width="12" height="6" rx="3" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  ) : (
    <svg width="46" height="14" viewBox="0 0 46 14" fill="none" aria-hidden focusable="false">
      <rect x="2"  y="3" width="15" height="8" rx="4" stroke="currentColor" strokeWidth="1.4" />
      <rect x="15" y="3" width="15" height="8" rx="4" stroke="currentColor" strokeWidth="1.4" />
      <rect x="28" y="3" width="15" height="8" rx="4" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function SectionVitrina({ lang }) {
  // Three independent selections drive the section. `finish` swaps the metal
  // (discs + spotlight + price); `chain` swaps ella/él; `view` swaps the shot
  // (piece on the bust vs chain detail) via the thumbnail strip. All three feed
  // the SAME stack of photos in the viewer, so any change cross-fades the piece.
  // The spotlight + price are keyed on `finish`, so the copy settles with a
  // short rise when you change metal (reduced-motion safe).
  const [finish, setFinish] = useS('plata');
  const [chain, setChain]   = useS('ella');
  const [view, setView]     = useS('dije');
  const active = VITRINA_FINISHES.find((f) => f.id === finish);
  const [buying, setBuying] = useS(false);

  // ── Galería de medios desde Shopify ─────────────────────────────────
  // En el theme, el liquid (elyxie-vitrina.liquid) inyecta
  // window.__ELYXIE.vitrinaMedia = { plata:[…], rodio:[…], oro:[…] } con TODAS
  // las fotos de cada producto EN EL ORDEN del admin (cada item:
  // {src, srcset, thumb, alt}). Cuando existe, el viewer refleja esa galería:
  // el acabado cambia de producto → de galería, y la tira de miniaturas muestra
  // cada foto. Fuera del theme (standalone) cae al sistema legacy
  // view×acabado×cadena sobre assets/ecommerce/* para no romper el dev local.
  const vitrinaMedia = (typeof window !== 'undefined') && window.__ELYXIE && window.__ELYXIE.vitrinaMedia;
  const gallery = (vitrinaMedia && Array.isArray(vitrinaMedia[finish])) ? vitrinaMedia[finish] : null;
  const galleryMode = !!(gallery && gallery.length);
  const [shotIdx, setShotIdx] = useS(0);
  // Al cambiar de acabado la galería es otra: vuelve a la primera foto.
  useE(() => { setShotIdx(0); }, [finish]);

  // Navegación por teclado de la tira de miniaturas (patrón radiogroup, solo
  // galería): flechas mueven selección + foco, Home/End a los extremos. Las
  // miniaturas usan roving tabindex (solo la activa entra en el orden de tab).
  const onThumbKey = (e) => {
    if (!galleryMode) return;
    const n = gallery.length;
    let next = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (shotIdx + 1) % n;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (shotIdx - 1 + n) % n;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = n - 1;
    if (next === null) return;
    e.preventDefault();
    setShotIdx(next);
    const btns = e.currentTarget.querySelectorAll('.Vitrina__thumb');
    if (btns[next]) btns[next].focus();
  };

  // Lightbox fullscreen (módulo vanilla compartido con el PDP — lightbox.js).
  // Abre el set activo (galería del acabado, o el stack legacy en standalone) en
  // la foto pulsada; al navegar dentro del modal sincroniza el visor de fondo.
  // (`t` se define más abajo; este closure sólo corre al hacer clic, ya inicializado.)
  const openLightbox = (startIdx) => {
    const LB = (typeof window !== 'undefined') && window.ElyxieLightbox;
    if (!LB) return;
    const imgs = galleryMode
      ? gallery.map((g) => ({ preview: g.src, full: g.full || g.src, alt: g.alt || t.pieceAlt(active[lang].name, chain) }))
      : VITRINA_VIEWS.map((v) => {
          const base = ELYXIE_ASSET(`assets/ecommerce/${v.prefix}-${finish}-${chain}`);
          return {
            preview: `${base}-${v.sizes[v.sizes.length - 1]}.webp`,
            full: `${base}.jpg`,
            alt: v.id === 'cadena' ? t.chainAlt(active[lang].name, chain) : t.pieceAlt(active[lang].name, chain),
          };
        });
    LB.open({
      images: imgs,
      index: startIdx || 0,
      getOriginEl: () => document.querySelector('.Vitrina__panel .Vitrina__shot[data-on="true"] img') || document.querySelector('.Vitrina__panel img'),
      onIndexChange: (i) => { if (galleryMode) setShotIdx(i); else if (VITRINA_VIEWS[i]) setView(VITRINA_VIEWS[i].id); },
    });
  };
  const panelStartIdx = () => (galleryMode ? shotIdx : Math.max(0, VITRINA_VIEWS.findIndex((v) => v.id === view)));

  // Buy-now: inside the Shopify theme, add the selected acabado×cadena variant
  // to the cart (Ajax API — same-origin, no token, locale-aware root) and go to
  // checkout. On the standalone page window.Shopify/__ELYXIE are absent,
  // so the anchor keeps its #FootForm fallback (we don't preventDefault):
  // it lands on the newsletter form, the only real contact point on-page.
  const handleBuy = (e) => {
    const root  = (typeof window !== 'undefined') && window.Shopify && window.Shopify.routes && window.Shopify.routes.root;
    const map   = (typeof window !== 'undefined') && window.__ELYXIE && window.__ELYXIE.variants;
    const entry = map && map[finish + '|' + chain];
    if (entry && entry.available === false) { // sold out → concierge "avísame"
      e.preventDefault();
      window.location.href = 'mailto:mkt@elyxie.com?subject=' + encodeURIComponent('Avísame · El Ángel ' + finish);
      return;
    }
    if (!root || !entry) return; // not in the theme → let <a href="#FootForm"> behave
    e.preventDefault();
    if (buying) return;
    setBuying(true);
    fetch(root + 'cart/add.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [{ id: entry.id, quantity: 1 }] }),
    })
      .then((r) => { if (!r.ok) throw new Error('add'); window.location.href = root + 'checkout'; })
      .catch(() => { setBuying(false); window.location.href = root + 'cart'; });
  };

  // Live price from Shopify when in the theme; static label fallback when standalone.
  const vinfo = (typeof window !== 'undefined') && window.__ELYXIE && window.__ELYXIE.variants && window.__ELYXIE.variants[finish + '|' + chain];
  const priceLabel = (vinfo && vinfo.price) || active.price;
  const soldOut = !!(vinfo && vinfo.available === false);

  const t = lang === 'es' ? {
    eyebrow: 'LA PIEZA · METAL Y CADENA',
    head: <>Un solo guardián. <em>Tres metales.</em></>,
    intro: 'El agua es la misma en los tres: recogida de la Laguna Negra, sellada para siempre. Lo que cambia es la casa que la guarda.',
    metalLabel: 'El metal',
    chainLabel: 'CADENA · PARA QUIÉN ES',
    chainNote: 'La cadena no altera el precio.',
    meta: 'EDICIÓN LIMITADA · N.º 01 / 100 · HECHA A MANO POR ENCARGO',
    cta: 'Recibir en custodia',
    chip: 'EDICIÓN LIMITADA · N.º 01 / 100',
    viewsLabel: 'Vistas de la pieza',
    pieceAlt: (name, ch) => `Ángel de la Laguna Negra en ${name.toLowerCase()}, cadena ${ch === 'ella' ? 'para ella' : 'para él'}`,
    chainAlt: (name, ch) => `Detalle de la cadena ${ch === 'ella' ? 'para ella' : 'para él'}, El Ángel en ${name.toLowerCase()}`,
  } : {
    eyebrow: 'THE PIECE · METAL & CHAIN',
    head: <>One guardian. <em>Three metals.</em></>,
    intro: 'The water is the same in all three: gathered from the Black Lagoon, sealed forever. What changes is the house that holds it.',
    metalLabel: 'The metal',
    chainLabel: "CHAIN · WHO IT'S FOR",
    chainNote: 'The chain does not change the price.',
    meta: 'LIMITED FIRST EDITION · N.º 01 / 100 · HAND-FINISHED TO ORDER',
    cta: 'Receive in custody',
    chip: 'LIMITED FIRST EDITION · N.º 01 / 100',
    viewsLabel: 'Piece views',
    pieceAlt: (name, ch) => `Angel of the Black Lagoon in ${name.toLowerCase()}, ${ch === 'ella' ? 'chain for her' : 'chain for him'}`,
    chainAlt: (name, ch) => `Chain detail, ${ch === 'ella' ? 'for her' : 'for him'}, the Angel in ${name.toLowerCase()}`,
  };

  return (
    <section id="ediciones" className="Section theme-dark Vitrina" data-theme="dark" data-section="vitrina" data-screen-label="Vitrina (configurador)">
      <Container className="Vitrina__inner">

        {/* ── Viewer: spotlit display panel ───────────────────────────── */}
        <div className="Vitrina__viewer">
          <div className="Vitrina__panel" data-gallery={galleryMode ? 'true' : undefined}
               role="button" tabIndex={0}
               aria-label={lang === 'es' ? 'Ampliar la pieza a pantalla completa' : 'Open the piece full screen'}
               onClick={() => openLightbox(panelStartIdx())}
               onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLightbox(panelStartIdx()); } }}>
            {galleryMode ? (
              /* Galería Shopify: TODAS las fotos del producto del acabado activo,
                 en el orden del admin. Solo la activa es opaca → el cambio de
                 foto o de acabado cruza por opacity (GPU), sin flash de carga
                 porque las capas ya están en el DOM. PARIDAD CON EL PDP
                 (theme/sections/elyxie-product.liquid · .eprod__panel): la imagen
                 LLENA el marco con object-fit:cover (CSS), anclada al focal point
                 nativo de Shopify (img.focal → object-position inline), nunca
                 letterbox; centro como fallback si el medio no trae focal. */
              gallery.map((img, i) => (
                <picture key={i} className="Vitrina__shot" data-on={i === shotIdx} aria-hidden={i !== shotIdx}>
                  <img
                    src={img.src}
                    srcSet={img.srcset || undefined}
                    sizes="(max-width: 767px) 90vw, (max-width: 1024px) 78vw, 600px"
                    alt={i === shotIdx ? (img.alt || t.pieceAlt(active[lang].name, chain)) : ''}
                    loading={i === 0 ? 'eager' : 'lazy'}
                    decoding="async"
                    draggable="false"
                    style={{ objectPosition: img.focal || '50% 50%' }}
                  />
                </picture>
              ))
            ) : (
              /* Legacy (standalone, sin __ELYXIE): view×acabado×cadena stack
                 sobre assets/ecommerce/* — preserva el dev local sin Shopify. */
              VITRINA_VIEWS.map((v) => VITRINA_FINISHES.map((f) => VITRINA_CHAINS.map((c) => {
                const on = v.id === view && f.id === finish && c.id === chain;
                const base = ELYXIE_ASSET(`assets/ecommerce/${v.prefix}-${f.id}-${c.id}`);
                const isDefault = v.id === 'dije' && f.id === 'plata' && c.id === 'ella';
                const alt = on
                  ? (v.id === 'cadena' ? t.chainAlt(active[lang].name, chain) : t.pieceAlt(active[lang].name, chain))
                  : '';
                return (
                  <picture key={v.id + f.id + c.id} className="Vitrina__shot" data-on={on} aria-hidden={!on}>
                    <source
                      type="image/webp"
                      srcSet={v.sizes.map((s) => `${base}-${s}.webp ${s}w`).join(', ')}
                      sizes="(max-width: 767px) 90vw, (max-width: 1024px) 78vw, 600px"
                    />
                    <img
                      src={`${base}.jpg`}
                      alt={alt}
                      loading={isDefault ? 'eager' : 'lazy'}
                      decoding="async"
                      draggable="false"
                      style={{ objectPosition: v.objPos }}
                    />
                  </picture>
                );
              })))
            )}
            {/* Edition chip (top-left) + emerald corner crosses struck on the
                bright panel. */}
            <span className="Vitrina__chip">{t.chip}</span>
            <span className="Vitrina__cc Vitrina__cc--tr" aria-hidden></span>
            <span className="Vitrina__cc Vitrina__cc--bl" aria-hidden></span>
            <span className="Vitrina__cc Vitrina__cc--br" aria-hidden></span>
          </div>

          {/* Thumbnail strip — picks the shot in the panel (radio semantics).
              In gallery mode it lists EVERY product photo in Shopify order; in
              legacy mode the two canonical shots (piece / chain). */}
          <div className="Vitrina__thumbs" role="radiogroup" aria-label={t.viewsLabel}
               data-gallery={galleryMode ? 'true' : undefined} onKeyDown={onThumbKey}>
            {galleryMode ? (
              gallery.map((img, i) => (
                <button
                  key={i}
                  type="button"
                  role="radio"
                  aria-checked={i === shotIdx}
                  tabIndex={i === shotIdx ? 0 : -1}
                  className="Vitrina__thumb"
                  data-on={i === shotIdx}
                  onClick={() => setShotIdx(i)}
                  aria-label={`${t.viewsLabel} · ${i + 1}`}
                >
                  <img src={img.thumb || img.src} alt="" loading="lazy" decoding="async" draggable="false" style={{ objectPosition: img.focal || '50% 50%' }}/>
                </button>
              ))
            ) : (
              VITRINA_VIEWS.map((v) => {
                const on = v.id === view;
                const tbase = ELYXIE_ASSET(`assets/ecommerce/${v.prefix}-${finish}-${chain}`);
                return (
                  <button
                    key={v.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    className="Vitrina__thumb"
                    data-on={on}
                    onClick={() => setView(v.id)}
                    aria-label={v.label[lang]}
                  >
                    <img
                      src={`${tbase}-${v.sizes[0]}.webp`}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      draggable="false"
                      style={{ objectPosition: v.objPos }}
                    />
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ── Inscription column ──────────────────────────────────────── */}
        <div className="Vitrina__info">
          <p className="eyebrow-label Vitrina__eyebrow">{t.eyebrow}</p>
          <h2 className="Vitrina__head">{t.head}</h2>
          <p className="Vitrina__intro">{t.intro}</p>

          {/* Metal selector — three noble discs, not shop swatches. */}
          <div className="Vitrina__metals" role="radiogroup" aria-label={t.metalLabel}>
            {VITRINA_FINISHES.map((f) => {
              const on = f.id === finish;
              return (
                <button
                  key={f.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  className="Vitrina__metal"
                  data-on={on}
                  onClick={() => setFinish(f.id)}
                  aria-label={`El Ángel · ${f[lang].name} · ${f.price}`}
                >
                  <span className="Vitrina__disc" style={{ backgroundImage: f.swatch }} aria-hidden></span>
                </button>
              );
            })}
          </div>

          {/* Active metal — material · name · one line. Keyed on finish so the
              copy rises gently each time the metal changes. */}
          <div className="Vitrina__spotlight" key={finish}>
            <p className="Vitrina__material">{active[lang].material}</p>
            <h3 className="Vitrina__name">El Ángel · <em>{active[lang].name}</em></h3>
            <p className="Vitrina__line">{active[lang].line}</p>
          </div>

          {/* Chain selector — two tiles, each with its length + link spec. */}
          <p className="Vitrina__chainLabel">{t.chainLabel}</p>
          <div className="Vitrina__chains" role="radiogroup" aria-label={t.chainLabel}>
            {VITRINA_CHAINS.map((c) => {
              const on = c.id === chain;
              return (
                <button
                  key={c.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  className="Vitrina__chainOpt"
                  data-on={on}
                  onClick={() => setChain(c.id)}
                >
                  <span className="Vitrina__chainGlyph" aria-hidden><ChainGlyph kind={c.icon} /></span>
                  <span className="Vitrina__chainText">
                    <span className="Vitrina__chainName">{c.name[lang]}</span>
                    <span className="Vitrina__chainSpec">{c.spec[lang]}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <p className="Vitrina__note">{t.chainNote}</p>

          {/* Price for the active metal + edition meta, then the custody CTA. */}
          <p className="Vitrina__price">
            <span className="Vitrina__priceNum" key={finish}>{priceLabel}</span>
            <span className="Vitrina__meta">{t.meta}</span>
          </p>
          <div className="Vitrina__foot">
            <a className="Button Button--primary Vitrina__cta" href="#FootForm"
               onClick={handleBuy}
               style={buying ? { pointerEvents: 'none', opacity: 0.7 } : undefined}>
              {buying ? (lang === 'es' ? 'Creando checkout…' : 'Creating checkout…') : (soldOut ? (lang === 'es' ? 'Avísame' : 'Notify me') : t.cta)}
              <span className="Button__arrow">→</span>
            </a>
          </div>
        </div>

      </Container>
    </section>
  );
}

// ===========================================================
//  Section 4 — Certificate ("first edition")
//  Byte-perfect port of the example's EditionCertificate.jsx
//  (same structure, copy, values, assets & design tokens).
//  Fixed (non-localized) strings match the source exactly:
//  the SACRED WATER tag, the dual product name, date & jeweler.
// ===========================================================
function SectionCertificate({ lang }) {
  // Revelado one-shot del acta: cuando la tarjeta entra ≥35% en viewport,
  // sus líneas aparecen en orden (delays escalonados en CSS) UNA sola vez —
  // como ver completarse el certificado ante notario. No se re-dispara al
  // volver a entrar; con prefers-reduced-motion el CSS lo muestra entero.
  const certRef = useR(null);
  const [revealed, setRevealed] = useS(false);
  useE(() => {
    const el = certRef.current;
    if (!el || revealed) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && e.intersectionRatio >= 0.35) { setRevealed(true); io.disconnect(); }
    }, { threshold: [0.35] });
    io.observe(el);
    return () => io.disconnect();
  }, [revealed]);

  const t = lang === 'es' ? {
    eyebrow: 'CERTIFICADO  ·  PRIMERA EDICIÓN',
    title: 'Numerado. Reservado. Atestiguado.',
    body: 'Cada pieza lleva un número de serie grabado a mano, firmado por el maestro joyero, acompañado de un certificado en papel sellado con el monograma de Elyxie.',
    issued: 'Emitido', by: 'Maestro joyero', seal: 'Sellado',
  } : {
    eyebrow: 'CERTIFICATE  ·  FIRST EDITION',
    title: 'Numbered. Reserved. Witnessed.',
    body: 'Each piece carries a hand-engraved serial, signed by the master jeweler, accompanied by a paper certificate sealed with the Elyxie monogram.',
    issued: 'Issued', by: 'Master jeweler', seal: 'Sealed',
  };

  return (
    <section id="custodia" className="Section theme-dark Certificate" data-theme="dark" data-section="certificate" data-screen-label="04 Certificate">
      <div className="Certificate__halo" aria-hidden></div>
      <div className="Container Certificate__inner">
        <div className="Certificate__eyebrow">{t.eyebrow}</div>
        <h2 className="Certificate__title">{t.title}</h2>
        <p className="Certificate__body">{t.body}</p>

        <div className="Cert" ref={certRef} data-revealed={revealed}>
          <div className="Cert__bg" aria-hidden></div>
          <div className="Cert__head">
            <div className="Cert__brand"><span className="elyxie-logo" role="img" aria-label="Elyxie"></span></div>
            <div className="Cert__tag">Sacred Waters<br/>Ancestral Jewelry</div>
          </div>
          <div className="Cert__name">Ángel de la Laguna Negra</div>
          <div className="Cert__nameEn">Angel of the Black Lagoon</div>
          <div className="Cert__serial">N.º 01 / 100</div>
          <div className="Cert__grid">
            <div>
              <div className="Cert__label">{t.issued}</div>
              <div className="Cert__value">Lima · Perú</div>
              <div className="Cert__value">20 · 05 · 2026</div>
            </div>
            <div>
              <div className="Cert__label">{t.by}</div>
              <div className="Cert__signature">J. Zamora</div>
            </div>
            <div className="Cert__sealCol">
              <div className="Cert__label">{t.seal}</div>
              <img className="Cert__sealImg" src={ELYXIE_ASSET('assets/elyxie-mark.svg')} alt="" aria-hidden/>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ===========================================================
//  Section 5 — #elyxie Instagram grid (3 cards, mixed ratios)
// ===========================================================
// Los 3 últimos posts reales de @elyxie.es (capturados de la cuenta).
// Para refrescarlos: re-leer el feed y actualizar base/url/fecha/caption.
const INSTA = [
  {
    base: 'assets/photography/insta-real-01',
    ratio: '0.78 / 1',           // 1080×1351 · 4:5
    url:  'https://www.instagram.com/p/DXZeeXljrPa/',
    dateEs: '21 ABRIL 2026', dateEn: 'APRIL 21, 2026',
    es: 'Algunas piezas están hechas para verse. Otras están hechas para trascender.',
    en: 'Some pieces are made to be seen. Others are made to transcend.',
  },
  {
    base: 'assets/photography/insta-real-02',
    ratio: '1 / 1',              // reel 9:16 → recortado a cuadrado
    url:  'https://www.instagram.com/p/DXQbIq2juC5/',
    dateEs: '17 ABRIL 2026', dateEn: 'APRIL 17, 2026',
    es: 'Toda historia tiene un origen. La nuestra comienza en el silencio, en las aguas sagradas de la Laguna Negra de Huancabamba, Perú.',
    en: 'Every story has an origin. Ours begins in silence, in the sacred waters of Laguna Negra in Huancabamba, Peru.',
  },
  {
    base: 'assets/photography/insta-real-03',
    ratio: '0.78 / 1',           // 1080×1395 · ~4:5
    url:  'https://www.instagram.com/p/DW9fnC8jmHL/',
    dateEs: '10 ABRIL 2026', dateEn: 'APRIL 10, 2026',
    es: 'En los momentos más oscuros, siempre hay algo que te guía. ELYXIE no es solo lo que llevas, es lo que ilumina tu camino.',
    en: 'In the darkest moments, there is always something that guides you. ELYXIE is not just what you wear, it is what illuminates your path.',
  },
];

// Mes/año en vivo para el eyebrow ("SOCIALES · JUNIO 2026"); se actualiza solo.
const FEED_MONTHS = {
  es: ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'],
  en: ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'],
};

function SectionInstagramGrid({ lang }) {
  const now = new Date();
  const eyebrow = (lang === 'es' ? 'SOCIALES · ' : 'SOCIAL · ') + FEED_MONTHS[lang][now.getMonth()] + ' ' + now.getFullYear();
  return (
    <section className="Section theme-light" data-theme="light" data-section="elyxie-feed" data-screen-label="05 Instagram">
      <Container>
        <div className="SectionHead">
          <h2 className="SectionHead__title">#elyxie</h2>
          <div className="SectionHead__meta">
            <span>{eyebrow}</span>
            <a className="SectionHead__link" href="https://www.instagram.com/elyxie.es/" target="_blank" rel="noopener">
              {lang === 'es' ? 'VER MÁS' : 'VIEW MORE'} →
            </a>
          </div>
        </div>

        <ul className="InstaGrid">
          {INSTA.map((p, i) => {
            const ebase = ELYXIE_ASSET(p.base);
            const webp = `${ebase}.webp`;
            const webp480 = `${ebase}-480.webp`;
            const date = lang === 'es' ? p.dateEs : p.dateEn;
            return (
            <li key={i} className="InstaCard">
              <a href={p.url} target="_blank" rel="noopener" aria-label={`Instagram · ${date}`}>
                <figure className="InstaCard__media" style={{ aspectRatio: p.ratio }}>
                  <picture>
                    <source
                      type="image/webp"
                      srcSet={`${webp480} 480w, ${webp} 720w, ${ebase}-960.webp 960w`}
                      sizes="(max-width: 767px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
                    <img src={`${ebase}.jpg`} alt={p[lang]} loading="lazy" decoding="async"/>
                  </picture>
                  <span className="InstaCard__badge" aria-hidden>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="18" height="18" rx="5"/>
                      <circle cx="12" cy="12" r="4"/>
                      <circle cx="17.5" cy="6.5" r="0.8" fill="currentColor"/>
                    </svg>
                  </span>
                </figure>
                <figcaption className="InstaCard__caption">
                  <span className="InstaCard__handle">{date}</span>
                  <span className="InstaCard__text">{p[lang]}</span>
                </figcaption>
              </a>
            </li>
            );
          })}
        </ul>
      </Container>
    </section>
  );
}

// ===========================================================
//  Section 7 — Footer (newsletter + footer)
//  Byte-perfect port of the example's Footer.jsx — the email
//  capture and the footer columns are a single component.
// ===========================================================
const FOOT_COPY = {
  en: {
    eyebrow: 'JOIN THE CIRCLE',
    title: 'The lagoon, in your inbox.',
    body: 'A quiet letter, monthly. New rituals, new pieces, the next opening of the edition.',
    placeholder: 'Your email',
    button: 'Join the circle',
    discreet: 'We do not share addresses. Ever.',
    success: 'Thank you. The lagoon will find you.',
    brandBody: 'A single piece, hand-crafted in Lima, with water gathered from the Black Lagoon of Huancabamba.',
    columns: [
      { title: 'ELYXIE', links: ['Story', 'The lagoon', 'Master jeweler', 'Press'] },
      { title: 'SHOP',   links: ['Ángel de la Laguna Negra', 'Coming soon', 'Care', 'Returns'] },
      { title: 'REACH',  links: ['WhatsApp', 'Email', 'Instagram', 'Lima · Perú'] },
    ],
    copy: '© 2026 Elyxie  ·  Sacred water from the Black Lagoon of Huancabamba',
  },
  es: {
    eyebrow: 'ÚNETE AL CÍRCULO',
    title: 'La laguna, en tu bandeja.',
    body: 'Una carta silenciosa, cada mes. Nuevos rituales, nuevas piezas, la próxima apertura de la edición.',
    placeholder: 'Tu correo',
    button: 'Unirme al círculo',
    discreet: 'No compartimos direcciones. Nunca.',
    success: 'Gracias. La laguna te encontrará.',
    brandBody: 'Una sola pieza, hecha a mano en Lima, con agua recolectada de la Laguna Negra de Huancabamba.',
    columns: [
      { title: 'ELYXIE', links: ['Relato', 'La laguna', 'Maestro joyero', 'Prensa'] },
      { title: 'TIENDA', links: ['Ángel de la Laguna Negra', 'Próximamente', 'Cuidado', 'Devoluciones'] },
      { title: 'CONTACTO', links: ['WhatsApp', 'Correo', 'Instagram', 'Lima · Perú'] },
    ],
    copy: '© 2026 Elyxie  ·  Agua sagrada de la Laguna Negra de Huancabamba',
  },
};

// feather-style line icons (stroke 1.5) — matches the source Icons.jsx
function FootIcon({ children }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">{children}</svg>;
}
const FootIgIcon   = () => <FootIcon><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></FootIcon>;
const FootWaIcon   = () => <FootIcon><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></FootIcon>;
const FootMailIcon = () => <FootIcon><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></FootIcon>;

function Footer({ lang }) {
  const t = FOOT_COPY[lang];
  // Captura nativa de Shopify: POST de página completa a /contact con
  // form_type=customer (el POST AJAX devuelve 400 cuando la verificación
  // anti-spam de Shopify exige challenge; el submit nativo pasa por /challenge
  // y vuelve con ?customer_posted=true). En la standalone no hay backend.
  const root = ((typeof window !== 'undefined') && window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';
  const posted = (typeof window !== 'undefined') && /[?&]customer_posted=true/.test(window.location.search);
  return (
    <footer className="SiteFooter" data-theme="dark" data-section="footer" data-screen-label="07 Footer">
      <div className="SiteFooter__halo" aria-hidden></div>
      <div className="Container SiteFooter__inner">
        <div className="FootNews">
          <div>
            <div className="FootNews__eyebrow">{t.eyebrow}</div>
            <h2 className="FootNews__title">{t.title}</h2>
            <p className="FootNews__body">{t.body}</p>
          </div>
          <form className="FootForm" method="post" action={root + 'contact#FootForm'} id="FootForm">
            <input type="hidden" name="form_type" value="customer"/>
            <input type="hidden" name="utf8" value="✓"/>
            <input type="hidden" name="contact[tags]" value="newsletter"/>
            <div className="FootForm__row">
              <label className="sr-only" htmlFor="FootEmail">{t.placeholder}</label>
              <input
                className="FootForm__input"
                id="FootEmail"
                type="email"
                name="contact[email]"
                autoComplete="email"
                required
                aria-describedby="FootFormStatus"
                placeholder={t.placeholder}
              />
              <button className="FootForm__submit" type="submit">{t.button}</button>
            </div>
            <div className="FootForm__discreet" id="FootFormStatus" role="status" aria-live="polite">
              {posted ? t.success : t.discreet}
            </div>
          </form>
        </div>

        <div className="FootLower">
          <div className="FootBrand">
            <div className="FootBrand__name"><span className="elyxie-logo" role="img" aria-label="Elyxie"></span></div>
            <div className="FootBrand__tag">SACRED WATERS</div>
            <div className="FootBrand__body">{t.brandBody}</div>
            <div className="FootSocials">
              <a className="FootSocial" href="https://www.instagram.com/elyxie.es/" target="_blank" rel="noopener" aria-label="Instagram"><FootIgIcon/></a>
              <a className="FootSocial" href="https://wa.me/51976616514" target="_blank" rel="noopener" aria-label="WhatsApp"><FootWaIcon/></a>
              <a className="FootSocial" href="mailto:mkt@elyxie.com" aria-label="Email"><FootMailIcon/></a>
            </div>
          </div>
          {(((typeof window !== 'undefined') && window.__ELYXIE && window.__ELYXIE.footerColumns && window.__ELYXIE.footerColumns[lang]) || t.columns.map((c) => ({ title: c.title, links: c.links.map((l) => ({ label: l, url: '' })) }))).map((col, ci) => (
            <div key={col.title + ci}>
              <div className="FootCol__title">{col.title}</div>
              <div className="FootCol__list">
                {col.links.map((l, li) => l.url
                  ? <a key={l.label + li} className="FootCol__link" href={l.url}>{l.label}</a>
                  : <span key={l.label + li} className="FootCol__link">{l.label}</span>)}
              </div>
            </div>
          ))}
        </div>

        <div className="FootCopy">
          <div className="FootCopy__text">{t.copy}</div>
          <div className="FootCopy__name"><span className="elyxie-logo" role="img" aria-label="Elyxie"></span></div>
        </div>
      </div>
    </footer>
  );
}

// ── Export to window so app.jsx can consume ────────────────────
Object.assign(window, {
  Container,
  SectionVideoHero, SectionProvenance, SectionVitrina, SectionCertificate,
  SectionInstagramGrid, Footer,
});
