/* === story-scroll.js ===========================================================
   Motor de scrollytelling de la página Story de Elyxie. Vanilla ES2020, cero
   dependencias. Replica el espíritu del hero one-pager (app.jsx): progress
   normalizado por escena = -rect.top / (alto - vh), interpolación de tema en
   RGB (como C_DARK_BG/C_LIGHT_BG) escrita en custom properties, easing
   quintic para que nada se sienta "punchy", y snap-on-idle a los beats
   (scroll nativo + tween easeOutCubic de 3000 ms, el mismo modelo y duración
   del snap del hero). El DOM lo define la sección
   Liquid: #elyxie-story > .story-scene[data-*] con .story-beat, .story-counter,
   .story-scene__media(/-b), .story-video, .story-rail y [data-reveal].
================================================================================ */
(function () {
  'use strict';

  // ---------- Helpers (lerp/clamp como en pendant.jsx) ----------
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  // Smootherstep (Perlin quintic): 6x⁵ − 15x⁴ + 10x³. Zeros 1st AND 2nd
  // derivative at both endpoints, so velocity AND acceleration glide in/out.
  // Use this in preference to easeInOut whenever the change in camera scale
  // or position would otherwise feel "punchy" near the segment boundaries.
  const smootherstep = (t) => { const x = t < 0 ? 0 : t > 1 ? 1 : t; return x * x * x * (x * (x * 6 - 15) + 10); };

  function hexToRgb(hex) {
    let h = String(hex || '').trim().replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    const n = parseInt(h, 16);
    return isNaN(n) ? [0, 0, 0] : [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  // Separador de miles según data-sep ('.' es / ',' en). Solo corre cuando el
  // valor del counter cambia, así que la regex no pesa en el frame budget.
  function formatThousands(n, sep) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, sep);
  }
  const noop = function () {};

  let destroy = null; // teardown del init vigente (section:unload / re-init idempotente)

  function init() {
    if (destroy) { destroy(); destroy = null; }

    const story = document.getElementById('elyxie-story');
    if (!story) return;

    // El flag --armed puede vivir en el propio #elyxie-story o en un wrapper
    // .story; resolvemos sin asumir cuál eligió la sección.
    const armedEl = story.classList.contains('story') ? story : (story.querySelector('.story') || story);

    const sceneEls = story.querySelectorAll('.story-scene');
    const reveals = story.querySelectorAll('[data-reveal]');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // __STORY siempre existe: claves leídas del DOM real, nunca hardcodeadas.
    const progressMap = {};
    for (let i = 0; i < sceneEls.length; i++) {
      progressMap[sceneEls[i].getAttribute('data-scene')] = 0;
    }
    window.__STORY = { progress: progressMap, reduced: reduced };

    if (reduced) {
      // Layout apilado legible: la sección ya lo pinta sin --armed. Solo
      // desarmamos, revelamos todo y NO tocamos rAF ni videos (ni src).
      armedEl.classList.remove('story--armed');
      for (let i = 0; i < reveals.length; i++) reveals[i].classList.add('is-in');
      return;
    }

    // Un script inline de la sección ya armó pre-paint; ser idempotente.
    armedEl.classList.add('story--armed');

    // ---------- Estado cacheado (nada de esto se recalcula en el loop) ----------
    let vh = window.innerHeight;
    const mobileMQ = window.matchMedia('(max-width: 767px)');
    let isMobile = mobileMQ.matches;
    let storySpan = 1; // alto scrolleable del story completo (para el rail fill)

    const scenes = [];
    const sceneByEl = new Map();
    for (let i = 0; i < sceneEls.length; i++) {
      const el = sceneEls[i];
      const ramp = (el.getAttribute('data-ramp') || '0.75,1').split(',');
      const beatEls = el.querySelectorAll('.story-beat');
      const beats = [];
      for (let j = 0; j < beatEls.length; j++) {
        const bEl = beatEls[j];
        const win = (bEl.getAttribute('data-beat') || '0,1').split(',');
        const counterEls = bEl.querySelectorAll('.story-counter');
        const counters = [];
        for (let c = 0; c < counterEls.length; c++) {
          counters.push({ el: counterEls[c], lastVal: -1, // -1 fuerza la primera escritura
            target: parseFloat(counterEls[c].getAttribute('data-counter')) || 0,
            sep: counterEls[c].getAttribute('data-sep') || '.' });
        }
        beats.push({ el: bEl, tIn: parseFloat(win[0]) || 0, tOut: parseFloat(win[1]) || 1,
          lastE: -1, counters: counters });
      }
      const scene = {
        el: el,
        handle: el.getAttribute('data-scene'),
        theme0: hexToRgb(el.getAttribute('data-theme-from')),
        theme1: hexToRgb(el.getAttribute('data-theme-to')),
        fg0: hexToRgb(el.getAttribute('data-fg-from')),
        fg1: hexToRgb(el.getAttribute('data-fg-to')),
        rampA: parseFloat(ramp[0]),
        rampB: parseFloat(ramp[1]),
        beats: beats,
        media: el.querySelector('.story-scene__media'),
        mediaB: el.querySelector('.story-scene__media-b'),
        // visible=true hasta que el IO reporte: así el primer frame forzado
        // pinta todo en vez de esperar al callback asíncrono del observer.
        visible: true,
        top: 0, span: 1, p: 0,
        lastY: '',  // último '%' de parallax escrito
        lastKb: '', // último opacity escrito en media-b
      };
      if (isNaN(scene.rampA)) scene.rampA = 0.75;
      if (isNaN(scene.rampB)) scene.rampB = 1;
      scenes.push(scene);
      sceneByEl.set(el, scene);
    }

    // Re-medición completa (init + resize): cachear spans aquí evita leer
    // offsetHeight en el loop, y deja tops "último valor conocido" para las
    // escenas no visibles (su signo basta para elegir la escena activa).
    function measureAll() {
      for (let i = 0; i < scenes.length; i++) {
        const s = scenes[i];
        s.top = s.el.getBoundingClientRect().top;
        s.span = Math.max(1, s.el.offsetHeight - vh); // max(1): escena de 100vh exactos no divide por 0
      }
      storySpan = Math.max(1, story.offsetHeight - vh);
    }

    // ---------- Rail ----------
    const rail = story.querySelector('.story-rail');
    const railFill = rail ? rail.querySelector('.story-rail__fill') : null;
    const railItems = {};
    if (rail) {
      rail.classList.add('story-rail--on');
      for (let i = 0; i < scenes.length; i++) {
        railItems[scenes[i].handle] = rail.querySelector('[data-for="' + scenes[i].handle + '"]');
      }
    }
    let lastActiveHandle = '';
    let lastFill = '';

    // ---------- Caches de tema (ints, no strings: si el canal redondeado no
    // cambió, ni siquiera construimos la string rgb) ----------
    const root = document.documentElement;
    let lastBg0 = -1, lastBg1 = -1, lastBg2 = -1;
    let lastFg0 = -1, lastFg1 = -1, lastFg2 = -1;

    // ---------- rAF economy ----------
    // El listener de scroll (pasivo) solo sella un timestamp; el loop vive
    // mientras el último scroll tenga < 240 ms — suficiente para puentear los
    // huecos entre eventos del momentum del trackpad (que puede callar 100+ ms
    // sin haber terminado) sin quemar CPU cuando la página está quieta.
    const SLEEP_AFTER = 240;
    let rafId = 0;
    let lastScrollTs = 0;
    let force = true; // init/resize/IO piden al menos un frame aunque no haya scroll

    function frame(now) {
      rafId = 0;
      if (!force && now - lastScrollTs >= SLEEP_AFTER) return; // a dormir; onScroll re-arma
      force = false;
      update();
      rafId = requestAnimationFrame(frame);
    }
    function wake() { if (!rafId) rafId = requestAnimationFrame(frame); }
    function onScroll() { lastScrollTs = performance.now(); wake(); onSnapScroll(); }

    // ---------- Frame ----------
    function update() {
      // UNA getBoundingClientRect por escena visible y frame; nada más.
      let anyVisible = false;
      for (let i = 0; i < scenes.length; i++) {
        const s = scenes[i];
        if (!s.visible) continue;
        anyVisible = true;
        s.top = s.el.getBoundingClientRect().top;
        s.p = clamp(-s.top / s.span, 0, 1);
        progressMap[s.handle] = s.p;
      }
      // Cola de la página (glosario/créditos): ahí NINGUNA escena intersecta
      // la ventana del sceneIO, y tras un salto instantáneo (End, scrollTo
      // programático) las escenas que nunca intersectaron conservan el top
      // cacheado de measureAll() → la activa sería una escena anterior con su
      // p congelado (tema y __STORY.progress erróneos). Solo en ese estado
      // re-medimos todo: 5 getBoundingClientRect en un caso raro, nunca
      // durante el scrollytelling normal.
      if (!anyVisible) {
        for (let i = 0; i < scenes.length; i++) {
          const s = scenes[i];
          s.top = s.el.getBoundingClientRect().top;
          s.p = clamp(-s.top / s.span, 0, 1);
          progressMap[s.handle] = s.p;
        }
      }

      // Escena ACTIVA: la última cuyo top cruzó el viewport (<=1 y no 0 para
      // tolerar el subpixel del snap); si ninguna, la primera.
      let active = scenes[0];
      for (let i = 0; i < scenes.length; i++) {
        if (scenes[i].top <= 1) active = scenes[i];
      }

      // --- Tema: bg con el ramp completo; fg con el 40% central del ramp.
      // Si fg usara la misma ventana que bg, a mitad de transición el texto
      // gris intermedio caería sobre un fondo igual de intermedio → ilegible.
      // Comprimirlo al tramo [30%,70%] del ramp hace que el texto "decida"
      // su color antes de que el fondo llegue al punto medio.
      if (active) {
        const rSpan = active.rampB - active.rampA;
        const k = smootherstep(clamp((active.p - active.rampA) / rSpan, 0, 1));
        const fa = active.rampA + 0.3 * rSpan;
        const fb = active.rampA + 0.7 * rSpan;
        const kf = smootherstep(clamp((active.p - fa) / (fb - fa), 0, 1));
        const b0 = Math.round(lerp(active.theme0[0], active.theme1[0], k));
        const b1 = Math.round(lerp(active.theme0[1], active.theme1[1], k));
        const b2 = Math.round(lerp(active.theme0[2], active.theme1[2], k));
        if (b0 !== lastBg0 || b1 !== lastBg1 || b2 !== lastBg2) {
          lastBg0 = b0; lastBg1 = b1; lastBg2 = b2;
          root.style.setProperty('--story-bg', 'rgb(' + b0 + ', ' + b1 + ', ' + b2 + ')');
        }
        const f0 = Math.round(lerp(active.fg0[0], active.fg1[0], kf));
        const f1 = Math.round(lerp(active.fg0[1], active.fg1[1], kf));
        const f2 = Math.round(lerp(active.fg0[2], active.fg1[2], kf));
        if (f0 !== lastFg0 || f1 !== lastFg1 || f2 !== lastFg2) {
          lastFg0 = f0; lastFg1 = f1; lastFg2 = f2;
          root.style.setProperty('--story-fg', 'rgb(' + f0 + ', ' + f1 + ', ' + f2 + ')');
        }
      }

      // --- Escenas visibles: beats, counters, parallax, media-b
      for (let i = 0; i < scenes.length; i++) {
        const s = scenes[i];
        if (!s.visible) continue;

        for (let j = 0; j < s.beats.length; j++) {
          const b = s.beats[j];
          // Trapezoide con rampas de 0.07 de progress por flanco: en una
          // escena de ~300vh son ~20vh de viaje — lo bastante rápido para
          // responder al scroll, lo bastante lento para no "popear".
          const a = clamp(Math.min((s.p - b.tIn) / 0.07, (b.tOut - s.p) / 0.07), 0, 1);
          const e = smootherstep(a);
          // Umbral 0.002: por debajo el cambio es invisible (<0.06px de
          // translate) y nos ahorramos la invalidación de estilo.
          if (Math.abs(e - b.lastE) >= 0.002) {
            b.lastE = e;
            b.el.style.opacity = e.toFixed(3);
            b.el.style.transform = 'translate3d(0,' + ((1 - e) * 28).toFixed(1) + 'px,0)';
            // visibility junto a opacity: con solo opacity 0 los CTA del beat
            // (pointer-events: auto en la sección) seguirían clicables y
            // tabulables siendo invisibles (WCAG 2.4.7). visibility no se
            // anima — el fade lo sigue dando opacity — y elimina a la vez
            // hit-testing y orden de tabulación cuando el beat no se ve.
            b.el.style.visibility = e > 0 ? 'visible' : 'hidden';
          }

          for (let c = 0; c < b.counters.length; c++) {
            const cn = b.counters[c];
            let val = cn.lastVal;
            if (s.p < b.tIn) {
              val = 0; // reset: al volver a entrar el counter re-anima desde 0
            } else {
              // El counter completa en el primer 45% de la vida del beat:
              // el número se asienta mientras el texto aún es plenamente
              // legible, en vez de seguir corriendo durante el fade-out.
              const cp = clamp((s.p - b.tIn) / ((b.tOut - b.tIn) * 0.45), 0, 1);
              val = Math.round(cn.target * smootherstep(cp));
            }
            if (val !== cn.lastVal) {
              cn.lastVal = val;
              cn.el.textContent = formatThousands(val, cn.sep);
            }
          }
        }

        // Parallax sutil del media: ±3.5% con scale(1.08) de colchón para que
        // nunca asomen bordes; en móvil ±2% / 1.05 (menos altura de viewport
        // → el mismo % se sentiría el doble de agresivo).
        if (s.media) {
          const y = (isMobile ? lerp(-2, 2, s.p) : lerp(-3.5, 3.5, s.p)).toFixed(2);
          if (y !== s.lastY) {
            s.lastY = y;
            s.media.style.transform = 'translate3d(0,' + y + '%,0) scale(' + (isMobile ? '1.05' : '1.08') + ')';
          }
        }

        // Cross-fade del amanecer: media-b usa EXACTAMENTE el k del ramp de
        // tema de su escena, así la foto clara y el fondo claro llegan juntos.
        if (s.mediaB) {
          const kb = smootherstep(clamp((s.p - s.rampA) / (s.rampB - s.rampA), 0, 1)).toFixed(3);
          if (kb !== s.lastKb) {
            s.lastKb = kb;
            s.mediaB.style.opacity = kb;
          }
        }
      }

      // --- Rail
      if (rail) {
        if (active && active.handle !== lastActiveHandle) {
          const prev = railItems[lastActiveHandle];
          const next = railItems[active.handle];
          if (prev) prev.classList.remove('is-active');
          if (next) next.classList.add('is-active');
          lastActiveHandle = active.handle;
        }
        if (railFill) {
          const gp = clamp(-story.getBoundingClientRect().top / storySpan, 0, 1).toFixed(4);
          if (gp !== lastFill) {
            lastFill = gp;
            railFill.style.transform = 'scaleY(' + gp + ')';
          }
        }
      }
    }

    // ---------- Snap on idle ----------
    // Mismo modelo que el hero del home (app.jsx): el scroll de entrada es
    // 100% nativo (cero intercepción → el gesto se siente crudo) y, cuando el
    // usuario lleva SNAP_IDLE_MS sin mover la página, un tween easeOutCubic
    // lleva el scroll hasta el beat más próximo EN LA DIRECCIÓN del último
    // gesto. Así nunca se descansa en un estado intermedio: beat a media
    // opacidad, counter a medio contar, o la costura del handoff (1vh sin
    // pin) entre dos escenas.
    //
    // Anclas: una por beat, en Y absoluta de documento. La p objetivo es el
    // CENTRO de la ventana [tIn,tOut] clampeado a [0,1]: las rampas de
    // opacidad son de 0.07 por flanco y la ventana más corta mide 0.24, así
    // que el centro siempre cae en el plateau (opacidad 1); y como los
    // counters completan al 45% de la vida del beat, en el centro (50%) el
    // número ya está asentado. Los beats de borde (tIn -0.5 / tOut 1.5)
    // clampean a 0/1 → reposo exacto al inicio/fin del pin. Pasada la última
    // ancla no hay snap: glosario y créditos se leen con scroll libre.
    const SNAP_IDLE_MS = 160;
    // 3000 ms = SNAP_DURATION del home: una sola sensación de transición en
    // todo el sitio. easeOutCubic (no smootherstep): arranca rápido —cerca de
    // la velocidad a la que murió el momentum nativo— y decae a cero, así el
    // traspaso gesto→tween se lee como un solo movimiento.
    const SNAP_MS = 3000;
    const SNAP_EPS = 8; // px: tolerancia «ya estoy en un ancla» del find
    const easeOutCubic = (k) => 1 - Math.pow(1 - k, 3);

    let snapIdleTimer = 0;
    let snapRaf = 0;
    let snapping = false;
    let snapLastY = window.scrollY;
    let snapDir = 1;
    let snapVel = 0; // px/ms del tween en curso — alimenta el coast del wheel
    let coastRaf = 0;

    function cancelCoast() {
      if (coastRaf) cancelAnimationFrame(coastRaf);
      coastRaf = 0;
    }
    function cancelSnap() {
      if (snapRaf) cancelAnimationFrame(snapRaf);
      snapRaf = 0;
      snapping = false;
      cancelCoast();
    }

    function tweenTo(endY) {
      cancelSnap();
      snapping = true;
      const startY = window.scrollY;
      const t0 = performance.now();
      let prevT = t0, prevY = startY;
      function step(t) {
        const k = Math.min(1, (t - t0) / SNAP_MS);
        const next = startY + (endY - startY) * easeOutCubic(k);
        snapVel = (next - prevY) / Math.max(1, t - prevT);
        prevT = t; prevY = next;
        snapLastY = next;
        window.scrollTo(0, next);
        if (k < 1) snapRaf = requestAnimationFrame(step);
        else { snapRaf = 0; snapping = false; }
      }
      snapRaf = requestAnimationFrame(step);
    }

    function snapToNext() {
      if (snapping) return;
      // Anclas recalculadas AQUÍ, nunca cacheadas: la barra de iOS cambia
      // innerHeight (y con él los spans) entre gesto y gesto. A frecuencia de
      // idle —no de frame— 5 getBoundingClientRect no cuestan nada, y la Y
      // resultante invierte exactamente la p que el motor calculará al llegar.
      const y = window.scrollY;
      const vhNow = window.innerHeight;
      const anchors = [];
      for (let i = 0; i < scenes.length; i++) {
        const s = scenes[i];
        const r = s.el.getBoundingClientRect();
        const topAbs = r.top + y;
        const span = Math.max(1, r.height - vhNow);
        for (let j = 0; j < s.beats.length; j++) {
          const b = s.beats[j];
          anchors.push(topAbs + clamp((b.tIn + b.tOut) / 2, 0, 1) * span);
        }
      }
      if (!anchors.length) return;
      anchors.sort(function (a, b) { return a - b; });
      // Cola libre: pasada la última ancla (glosario/créditos) nada retiene
      // al usuario dentro del scrollytelling.
      if (y > anchors[anchors.length - 1] + SNAP_EPS) return;
      let target;
      if (snapDir > 0) {
        for (let k = 0; k < anchors.length; k++) {
          if (anchors[k] > y + SNAP_EPS) { target = anchors[k]; break; }
        }
      } else {
        for (let k = anchors.length - 1; k >= 0; k--) {
          if (anchors[k] < y - SNAP_EPS) { target = anchors[k]; break; }
        }
      }
      if (target === undefined) return; // en un borde: dejar salir al usuario
      tweenTo(target);
    }

    function onSnapScroll() {
      const y = window.scrollY;
      if (snapping) { snapLastY = y; return; } // el tween no se re-arma a sí mismo
      const dy = y - snapLastY;
      snapLastY = y;
      // Umbral 0.5px: iOS reporta scrollY fraccional y la cola del propio
      // tween (easeOutCubic muere asintóticamente) emite eventos subpíxel que
      // no son intención del usuario — armarían un segundo snap en cadena.
      if (dy <= 0.5 && dy >= -0.5) return;
      snapDir = dy > 0 ? 1 : -1;
      clearTimeout(snapIdleTimer);
      snapIdleTimer = setTimeout(snapToNext, SNAP_IDLE_MS);
    }

    function onWheel(e) {
      // Una rueda durante el snap devuelve el control al scroll nativo. Si el
      // push va en la MISMA dirección que viajaba el tween, su velocidad decae
      // en ~150 ms en vez de congelarse — el traspaso se lee como un solo
      // gesto. Un push opuesto es cancelación dura: el usuario está
      // revirtiendo y cualquier coast pelearía contra él.
      if (!snapping) return;
      // Los eventos de fin de momentum de macOS llegan con deltaY=0: no son
      // intención del usuario y cancelarían el tween a mitad de vuelo dejando
      // la página en reposo FUERA de un ancla.
      if (!e.deltaY) return;
      const v0 = snapVel;
      const sameDir = Math.sign(e.deltaY) === Math.sign(v0);
      cancelSnap();
      if (!sameDir || Math.abs(v0) < 0.05) return;
      const COAST_MS = 150;
      const t0 = performance.now();
      let prev = t0;
      function coastStep(t) {
        coastRaf = 0;
        const elapsed = t - t0;
        if (elapsed >= COAST_MS || snapping) return;
        window.scrollBy(0, v0 * (1 - elapsed / COAST_MS) * (t - prev));
        prev = t;
        coastRaf = requestAnimationFrame(coastStep);
      }
      coastRaf = requestAnimationFrame(coastStep);
    }
    function onTouchStart() {
      // El dedo es manipulación directa: corte limpio, sin coast.
      if (snapping) cancelSnap();
      cancelCoast();
    }

    // ---------- Observers ----------
    // rootMargin 50%: una escena cuenta como "visible" desde media pantalla
    // antes de entrar, para que beats/parallax ya estén posicionados al asomar.
    const sceneIO = new IntersectionObserver(function (entries) {
      for (let i = 0; i < entries.length; i++) {
        const s = sceneByEl.get(entries[i].target);
        if (s) s.visible = entries[i].isIntersecting;
      }
      force = true; wake(); // repintar una vez cuando cambia el set visible
    }, { rootMargin: '50% 0px' });
    for (let i = 0; i < scenes.length; i++) sceneIO.observe(scenes[i].el);

    const revealIO = new IntersectionObserver(function (entries) {
      for (let i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) {
          entries[i].target.classList.add('is-in');
          revealIO.unobserve(entries[i].target);
        }
      }
    }, { threshold: 0.2 });
    for (let i = 0; i < reveals.length; i++) revealIO.observe(reveals[i]);

    // ---------- Videos lazy ----------
    const videos = story.querySelectorAll('.story-video[data-src]');
    const videoState = new Map();
    // Carga a una pantalla de distancia (rootMargin 100%): el src se asigna
    // mucho antes del umbral de play, así el primer frame ya está decodificado.
    const loadIO = new IntersectionObserver(function (entries) {
      for (let i = 0; i < entries.length; i++) {
        if (!entries[i].isIntersecting) continue;
        const vid = entries[i].target;
        // data-src-m: variante MÓVIL (recorte vertical 1080×2336 del upscale
        // 4K) — ya no es "la de 720p", es la de mayor densidad por px visible.
        const srcM = vid.getAttribute('data-src-m');
        vid.src = (isMobile && srcM) ? srcM : vid.getAttribute('data-src');
        vid.load();
        loadIO.unobserve(vid);
      }
    }, { rootMargin: '100% 0px' });
    const playIO = new IntersectionObserver(function (entries) {
      for (let i = 0; i < entries.length; i++) {
        const vid = entries[i].target;
        videoState.get(vid).intersecting = entries[i].isIntersecting;
        if (entries[i].isIntersecting) {
          if (!document.hidden) vid.play().catch(noop);
        } else {
          vid.pause();
        }
      }
    }, { threshold: 0.25 });
    for (let i = 0; i < videos.length; i++) {
      videoState.set(videos[i], { intersecting: false });
      loadIO.observe(videos[i]);
      playIO.observe(videos[i]);
    }

    function onVisibility() {
      const hidden = document.hidden;
      videoState.forEach(function (st, vid) {
        if (hidden) vid.pause();
        else if (st.intersecting) vid.play().catch(noop);
      });
    }

    // ---------- Resize ----------
    // Debounce 150ms: Safari iOS dispara ráfagas de resize durante el rebote
    // de la barra de URL; solo nos interesa el estado final.
    let resizeTimer = 0;
    function onResize() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        vh = window.innerHeight;
        isMobile = mobileMQ.matches;
        measureAll();
        force = true;
        wake();
      }, 150);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    // iOS dispara visualViewport resize al colapsar/expandir la barra del
    // navegador con más fiabilidad que window resize (que puede llegar
    // tarde o no llegar); el debounce de 150ms de onResize absorbe la
    // ráfaga que emite durante la animación de la barra. innerHeight ya
    // refleja el viewport dinámico en iOS, así que el mismo onResize vale.
    if (window.visualViewport) window.visualViewport.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVisibility);

    measureAll();
    force = true;
    wake();

    destroy = function () {
      sceneIO.disconnect(); revealIO.disconnect(); loadIO.disconnect(); playIO.disconnect();
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
      clearTimeout(resizeTimer);
      clearTimeout(snapIdleTimer);
      cancelSnap();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      if (window.visualViewport) window.visualViewport.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }

  // ---------- Bootstrap + editor de temas (patrón de animations.js) ----------
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
  // Gateamos por contenido: en el editor cualquier sección dispara estos
  // eventos, y desmontar el motor porque se recargó el footer sería absurdo.
  document.addEventListener('shopify:section:load', function (event) {
    if (event.target && event.target.querySelector('#elyxie-story')) init();
  });
  document.addEventListener('shopify:section:unload', function (event) {
    if (event.target && event.target.querySelector('#elyxie-story') && destroy) {
      destroy();
      destroy = null;
    }
  });
})();
