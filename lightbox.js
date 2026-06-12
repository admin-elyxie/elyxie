// lightbox.js — Elyxie · visor fullscreen compartido (lightbox con zoom).
//
// PARIDAD ENTRE STACKS: el homepage (React, SectionVitrina en sections.jsx) y el
// PDP (Liquid + JS vanilla, theme/sections/elyxie-product.liquid) NO comparten
// componente — viven en stacks distintos. La única forma de tener UN solo
// lightbox para ambos es este módulo vanilla, framework-agnóstico, expuesto en
// window.ElyxieLightbox. Ambos visores lo invocan; aquí vive toda la lógica una
// sola vez (prohibido implementarlo dos veces).
//
//   window.ElyxieLightbox.open({
//     images:        [{ preview, full, srcset?, alt }],  // preview = la del visor (cacheada); full = alta resolución
//     index:         <int>,                              // imagen inicial
//     getOriginEl:   () => HTMLElement,                  // imagen del visor (origen FLIP + destino al cerrar). Siempre la actual.
//     onIndexChange: (i) => void,                        // sincroniza el visor de fondo al navegar
//   });
//
// Zoom 1×–3× SOLO con transform (cero reflow). Pointer Events unifican mouse +
// touch (no se filtra por user-agent: se decide por pointerType, así una tablet
// con trackpad responde a gestos de desktop). Animaciones: transform/opacity con
// expo-out (--ease-exp del repo), sin bounce.
(function () {
  'use strict';
  if (window.ElyxieLightbox) return; // singleton

  // ── Constantes ──────────────────────────────────────────────────────────
  var EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';   // = --ease-exp (expo-out del repo)
  var OPEN_MS = 380, CLOSE_MS = 300, ZOOM_MS = 280, NAV_MS = 220;
  var MIN = 1, MAX = 3, DOUBLE = 2.5;           // niveles de zoom
  var SWIPE_NAV = 64, SWIPE_CLOSE = 120;        // umbrales (px) para navegar / cerrar
  var TAP_SLOP = 8, DBLTAP_MS = 300, DBLTAP_DIST = 32;

  var rm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');

  // ── Estado ──────────────────────────────────────────────────────────────
  var built = false, openFlag = false;
  var images = [], idx = 0;
  var getOriginEl = null, onIndexChange = null, triggerEl = null;
  var scale = 1, tx = 0, ty = 0;                // transform en vivo de la imagen
  var baseW = 0, baseH = 0;                      // tamaño "contain" de la imagen a escala 1
  var raf = 0, dirty = false;

  // gesto
  var pointers = new Map();                      // pointerId -> {x,y}
  var gesture = null;                            // 'pan' | 'pinch' | 'swipe-x' | 'swipe-y' | 'idle'
  var gStartX = 0, gStartY = 0, gStartTx = 0, gStartTy = 0, gStartScale = 1;
  var gStartDist = 0, gStartMid = null, swipeAxis = null, moved = false;
  var lastTap = 0, lastTapX = 0, lastTapY = 0;

  // ── DOM (una sola vez) ──────────────────────────────────────────────────
  var root, backdrop, stage, imgEl, ui, btnClose, btnPrev, btnNext, counter, hiLoader;

  function build() {
    if (built) return; built = true;
    root = document.createElement('div');
    root.className = 'elx-lb';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-hidden', 'true');
    root.hidden = true;
    root.innerHTML =
      '<div class="elx-lb__backdrop"></div>' +
      '<div class="elx-lb__stage"><img class="elx-lb__img" alt="" draggable="false"/></div>' +
      '<div class="elx-lb__ui">' +
        '<button type="button" class="elx-lb__close" aria-label="Cerrar">' +
          '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round"/></svg>' +
        '</button>' +
        '<button type="button" class="elx-lb__nav elx-lb__nav--prev" aria-label="Anterior">' +
          '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" focusable="false"><path d="M15 5l-7 7 7 7" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
        '</button>' +
        '<button type="button" class="elx-lb__nav elx-lb__nav--next" aria-label="Siguiente">' +
          '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" focusable="false"><path d="M9 5l7 7-7 7" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
        '</button>' +
        '<div class="elx-lb__counter" aria-hidden="true"></div>' +
      '</div>';
    document.body.appendChild(root);

    backdrop = root.querySelector('.elx-lb__backdrop');
    stage    = root.querySelector('.elx-lb__stage');
    imgEl    = root.querySelector('.elx-lb__img');
    ui       = root.querySelector('.elx-lb__ui');
    btnClose = root.querySelector('.elx-lb__close');
    btnPrev  = root.querySelector('.elx-lb__nav--prev');
    btnNext  = root.querySelector('.elx-lb__nav--next');
    counter  = root.querySelector('.elx-lb__counter');

    backdrop.addEventListener('click', close);
    btnClose.addEventListener('click', close);
    btnPrev.addEventListener('click', function () { go(-1); });
    btnNext.addEventListener('click', function () { go(1); });

    // Pointer pipeline en el stage (un solo punto de entrada para mouse y touch).
    stage.addEventListener('pointerdown', onPointerDown);
    stage.addEventListener('pointermove', onPointerMove);
    stage.addEventListener('pointerup', onPointerUp);
    stage.addEventListener('pointercancel', onPointerUp);
    stage.addEventListener('wheel', onWheel, { passive: false });
    imgEl.addEventListener('load', onImgLoad);
    imgEl.addEventListener('dragstart', function (e) { e.preventDefault(); });
  }

  // ── Geometría ───────────────────────────────────────────────────────────
  function vw() { return stage.clientWidth; }
  function vh() { return stage.clientHeight; }
  function recomputeBase() { baseW = imgEl.offsetWidth; baseH = imgEl.offsetHeight; }

  // Pan limitado a los bordes: la imagen nunca deja hueco contra el stage.
  function clampPan() {
    var mx = Math.max(0, (baseW * scale - vw()) / 2);
    var my = Math.max(0, (baseH * scale - vh()) / 2);
    tx = Math.max(-mx, Math.min(mx, tx));
    ty = Math.max(-my, Math.min(my, ty));
  }

  function applyTransform() {
    imgEl.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + scale + ')';
  }
  function schedule() {
    dirty = true;
    if (raf) return;
    raf = requestAnimationFrame(function () { raf = 0; if (dirty) { dirty = false; applyTransform(); } });
  }

  // Zoom centrado en un punto (px,py = coords de pantalla). Mantiene fijo bajo el
  // puntero el punto de la imagen: t' = p - (s'/s)·(p - t), con p relativo al centro.
  function zoomTo(newScale, px, py, animate) {
    newScale = Math.max(MIN, Math.min(MAX, newScale));
    var r = stage.getBoundingClientRect();
    var p = { x: px - (r.left + vw() / 2), y: py - (r.top + vh() / 2) };
    var k = newScale / scale;
    var nx = p.x - k * (p.x - tx);
    var ny = p.y - k * (p.y - ty);
    scale = newScale; tx = nx; ty = ny;
    clampPan();
    if (animate) animateXform(ZOOM_MS); else { imgEl.style.transition = 'none'; applyTransform(); }
  }

  function animateXform(ms) {
    imgEl.style.transition = 'transform ' + ms + 'ms ' + EASE;
    applyTransform();
  }

  function setZoomState() {
    root.setAttribute('data-zoom', scale > 1.01 ? '1' : '0');
    stage.style.cursor = scale > 1.01 ? 'zoom-out' : 'zoom-in';
  }

  // ── Imágenes ────────────────────────────────────────────────────────────
  function setImage(i, fromNav) {
    idx = (i + images.length) % images.length;
    var it = images[idx];
    // reset zoom
    scale = 1; tx = 0; ty = 0;
    imgEl.style.transition = 'none';
    imgEl.removeAttribute('srcset');
    imgEl.alt = it.alt || '';
    imgEl.src = it.preview || it.full;           // preview cacheada → sin pantalla vacía
    applyTransform();
    counter.textContent = (idx + 1) + ' / ' + images.length;
    setZoomState();
    btnPrev.style.visibility = btnNext.style.visibility = images.length > 1 ? '' : 'hidden';
    // alta resolución en segundo plano
    if (it.full && it.full !== it.preview) {
      var hi = new Image();
      hiLoader = hi;
      hi.onload = function () { if (openFlag && hiLoader === hi && images[idx] === it) { imgEl.src = it.full; recomputeBase(); clampPan(); applyTransform(); } };
      hi.src = it.full;
    }
    // precarga vecinos
    if (images.length > 1) {
      [idx - 1, idx + 1].forEach(function (j) {
        var n = images[(j + images.length) % images.length];
        if (n && n.full) { var p = new Image(); p.src = n.full; }
      });
    }
    if (fromNav && onIndexChange) { try { onIndexChange(idx); } catch (e) {} }
  }

  function onImgLoad() { recomputeBase(); clampPan(); if (!gesture) { /* keep */ } }

  // Navegar con crossfade rápido (solo a escala 1; el swipe ya dio feedback).
  function go(dir) {
    if (images.length < 2) return;
    var prefersStill = rm && rm.matches;
    if (prefersStill) { setImage(idx + dir, true); return; }
    imgEl.style.transition = 'opacity ' + (NAV_MS / 2) + 'ms ' + EASE;
    imgEl.style.opacity = '0';
    var done = false;
    var swap = function () {
      if (done) return; done = true;
      setImage(idx + dir, true);
      requestAnimationFrame(function () {
        imgEl.style.transition = 'opacity ' + (NAV_MS / 2) + 'ms ' + EASE;
        imgEl.style.opacity = '1';
      });
    };
    setTimeout(swap, NAV_MS / 2 + 10);
  }

  // ── Apertura / cierre con FLIP ──────────────────────────────────────────
  function flipFrom(originRect) {
    // mide el destino (imagen contain ya en su sitio) y arranca desde el origen
    var t = imgEl.getBoundingClientRect();
    if (!originRect || !t.width || !t.height) return false;
    var s0 = originRect.width / t.width;
    var dx = (originRect.left + originRect.width / 2) - (t.left + t.width / 2);
    var dy = (originRect.top + originRect.height / 2) - (t.top + t.height / 2);
    imgEl.style.transition = 'none';
    imgEl.style.transformOrigin = 'center center';
    imgEl.style.transform = 'translate(' + dx + 'px,' + dy + 'px) scale(' + s0 + ')';
    imgEl.style.opacity = '0';
    return true;
  }

  function open(opts) {
    build();
    images = (opts.images || []).filter(function (x) { return x && (x.preview || x.full); });
    if (!images.length) return;
    getOriginEl = opts.getOriginEl || (opts.originEl ? function () { return opts.originEl; } : null);
    onIndexChange = opts.onIndexChange || null;
    triggerEl = (getOriginEl && getOriginEl()) || document.activeElement;
    openFlag = true;
    lockScroll();
    root.hidden = false;
    root.setAttribute('aria-hidden', 'false');
    document.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('resize', onResize);

    setImage(opts.index || 0, false);
    recomputeBase();

    var still = rm && rm.matches;
    var origin = getOriginEl && getOriginEl();
    var originRect = origin && origin.getBoundingClientRect();
    if (still || !flipFrom(originRect)) {
      imgEl.style.transition = 'none';
      imgEl.style.transform = 'translate(0,0) scale(1)';
      imgEl.style.opacity = '1';
      backdrop.style.opacity = ''; ui.style.opacity = '';
      root.classList.add('is-open');
      afterOpen();
    } else {
      backdrop.style.transition = 'none'; backdrop.style.opacity = '0';
      ui.style.opacity = '0';
      // siguiente frame: animar a estado final
      requestAnimationFrame(function () {
        backdrop.style.transition = 'opacity ' + OPEN_MS + 'ms ' + EASE;
        backdrop.style.opacity = '1';
        imgEl.style.transition = 'transform ' + OPEN_MS + 'ms ' + EASE + ', opacity ' + (OPEN_MS * 0.6) + 'ms ' + EASE;
        imgEl.style.transform = 'translate(0,0) scale(1)';
        imgEl.style.opacity = '1';
        ui.style.transition = 'opacity ' + (OPEN_MS * 0.7) + 'ms ' + EASE + ' ' + (OPEN_MS * 0.4) + 'ms';
        ui.style.opacity = '1';
        root.classList.add('is-open');
        setTimeout(afterOpen, OPEN_MS);
      });
    }
  }

  function afterOpen() {
    imgEl.style.transition = 'none';
    backdrop.style.transition = ''; backdrop.style.opacity = '';
    ui.style.transition = ''; ui.style.opacity = '';
    recomputeBase(); clampPan(); applyTransform();
    setZoomState();
    btnClose.focus();
  }

  function close() {
    if (!openFlag) return;
    openFlag = false;
    document.removeEventListener('keydown', onKeyDown, true);
    window.removeEventListener('resize', onResize);
    var still = rm && rm.matches;
    var origin = getOriginEl && getOriginEl();
    var originRect = origin && origin.getBoundingClientRect();
    // reset zoom para que el FLIP de cierre salga del estado contain
    scale = 1; tx = 0; ty = 0;
    var finish = function () {
      root.hidden = true;
      root.setAttribute('aria-hidden', 'true');
      root.classList.remove('is-open');
      imgEl.style.transition = 'none';
      imgEl.style.transform = ''; imgEl.style.opacity = '';
      backdrop.style.transition = ''; backdrop.style.opacity = '';
      ui.style.transition = ''; ui.style.opacity = '';
      unlockScroll();
      focusTrigger();
    };
    if (still) { finish(); return; }
    applyTransform();
    requestAnimationFrame(function () {
      var t = imgEl.getBoundingClientRect();
      var s0 = originRect && t.width ? originRect.width / t.width : 0.6;
      var dx = originRect ? (originRect.left + originRect.width / 2) - (t.left + t.width / 2) : 0;
      var dy = originRect ? (originRect.top + originRect.height / 2) - (t.top + t.height / 2) : 40;
      imgEl.style.transition = 'transform ' + CLOSE_MS + 'ms ' + EASE + ', opacity ' + CLOSE_MS + 'ms ' + EASE;
      imgEl.style.transform = 'translate(' + dx + 'px,' + dy + 'px) scale(' + (originRect ? s0 : 0.85) + ')';
      imgEl.style.opacity = '0';
      backdrop.style.transition = 'opacity ' + CLOSE_MS + 'ms ' + EASE;
      backdrop.style.opacity = '0';
      ui.style.transition = 'opacity ' + (CLOSE_MS * 0.6) + 'ms ' + EASE;
      ui.style.opacity = '0';
      setTimeout(finish, CLOSE_MS);
    });
  }

  // Cierre por arrastre vertical (swipe-down): la imagen sigue al dedo y, pasado
  // el umbral, cierra con fade; por debajo, vuelve a su sitio.
  function closeBySwipe() {
    imgEl.style.transition = 'transform ' + CLOSE_MS + 'ms ' + EASE + ', opacity ' + CLOSE_MS + 'ms ' + EASE;
    imgEl.style.transform = 'translate(' + tx + 'px,' + (ty + vh() * 0.4) + 'px) scale(0.9)';
    imgEl.style.opacity = '0';
    backdrop.style.transition = 'opacity ' + CLOSE_MS + 'ms ' + EASE;
    backdrop.style.opacity = '0';
    ui.style.opacity = '0';
    openFlag = false;
    document.removeEventListener('keydown', onKeyDown, true);
    window.removeEventListener('resize', onResize);
    setTimeout(function () {
      scale = 1; tx = 0; ty = 0;
      root.hidden = true; root.setAttribute('aria-hidden', 'true'); root.classList.remove('is-open');
      imgEl.style.transition = 'none'; imgEl.style.transform = ''; imgEl.style.opacity = '';
      backdrop.style.transition = ''; backdrop.style.opacity = ''; ui.style.opacity = '';
      unlockScroll();
      focusTrigger();
    }, CLOSE_MS);
  }
  function snapBack() {
    backdrop.style.transition = 'opacity ' + ZOOM_MS + 'ms ' + EASE; backdrop.style.opacity = '1';
    animateXform(ZOOM_MS);
  }

  // ── Gestos (Pointer Events) ─────────────────────────────────────────────
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function mid(a, b) { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }
  function relC(x, y) { var r = stage.getBoundingClientRect(); return { x: x - (r.left + vw() / 2), y: y - (r.top + vh() / 2) }; }

  function onPointerDown(e) {
    try { stage.setPointerCapture(e.pointerId); } catch (i) {}
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    imgEl.style.willChange = 'transform';
    imgEl.style.transition = 'none';
    if (pointers.size === 2) {
      var p = Array.from(pointers.values());
      gesture = 'pinch';
      gStartDist = dist(p[0], p[1]);
      gStartScale = scale;
      gStartMid = relC((p[0].x + p[1].x) / 2, (p[0].y + p[1].y) / 2);
      gStartTx = tx; gStartTy = ty;
      moved = true;
    } else if (pointers.size === 1) {
      gStartX = e.clientX; gStartY = e.clientY;
      gStartTx = tx; gStartTy = ty;
      swipeAxis = null; moved = false;
      gesture = scale > 1.01 ? 'pan' : 'idle';
    }
  }

  function onPointerMove(e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (gesture === 'pinch' && pointers.size >= 2) {
      var p = Array.from(pointers.values());
      var d = dist(p[0], p[1]);
      var m = relC((p[0].x + p[1].x) / 2, (p[0].y + p[1].y) / 2);
      var ns = Math.max(MIN, Math.min(MAX, gStartScale * (d / gStartDist)));
      var k = ns / gStartScale;
      scale = ns;
      tx = m.x - k * (gStartMid.x - gStartTx);
      ty = m.y - k * (gStartMid.y - gStartTy);
      clampPan(); schedule();
      return;
    }
    if (pointers.size !== 1) return;
    var dx = e.clientX - gStartX, dy = e.clientY - gStartY;
    if (gesture === 'pan') {
      tx = gStartTx + dx; ty = gStartTy + dy; moved = true; clampPan(); schedule(); return;
    }
    // escala 1: decidir eje (navegación horizontal vs cierre vertical)
    if (!swipeAxis) {
      if (Math.hypot(dx, dy) < TAP_SLOP) return;
      swipeAxis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      gesture = swipeAxis === 'x' ? 'swipe-x' : 'swipe-y';
      moved = true;
    }
    if (gesture === 'swipe-x') {
      tx = dx * 0.9; ty = 0; schedule();
    } else if (gesture === 'swipe-y') {
      var down = Math.max(0, dy);
      ty = down; tx = dx * 0.3;
      backdrop.style.transition = 'none';
      backdrop.style.opacity = String(Math.max(0.35, 1 - down / (vh() * 0.6)));
      schedule();
    }
  }

  function onPointerUp(e) {
    if (!pointers.has(e.pointerId)) return;
    var up = pointers.get(e.pointerId);
    pointers.delete(e.pointerId);
    try { stage.releasePointerCapture(e.pointerId); } catch (i) {}

    if (gesture === 'pinch') {
      if (pointers.size === 1) {
        // queda un dedo: continuar como pan/idle
        var r = Array.from(pointers.entries())[0];
        gStartX = r[1].x; gStartY = r[1].y; gStartTx = tx; gStartTy = ty;
        swipeAxis = null; gesture = scale > 1.01 ? 'pan' : 'idle';
      } else if (pointers.size === 0) {
        if (scale <= 1.01) { scale = 1; tx = 0; ty = 0; animateXform(ZOOM_MS); }
        else animateXform(ZOOM_MS);
        endGesture();
      }
      return;
    }
    if (pointers.size > 0) return; // aún quedan dedos

    var dx = e.clientX - gStartX, dy = e.clientY - gStartY;
    if (gesture === 'swipe-x') {
      if (Math.abs(dx) > SWIPE_NAV) { go(dx < 0 ? 1 : -1); }
      else { tx = 0; animateXform(NAV_MS); }
      endGesture(); return;
    }
    if (gesture === 'swipe-y') {
      if (dy > SWIPE_CLOSE) { closeBySwipe(); }
      else { tx = 0; ty = 0; snapBack(); }
      endGesture(); return;
    }
    if (gesture === 'pan') {
      // un pan sin desplazamiento real es en verdad un tap/click → permite
      // alternar el zoom (doble-tap touch / clic desktop) ESTANDO ya con zoom.
      if (!moved && Math.hypot(dx, dy) < TAP_SLOP) onTap(e.clientX, e.clientY, e.pointerType);
      endGesture(); return;
    }
    // sin movimiento real → tap/click
    if (!moved && Math.hypot(dx, dy) < TAP_SLOP) onTap(e.clientX, e.clientY, e.pointerType);
    endGesture();
  }

  function endGesture() { gesture = null; imgEl.style.willChange = ''; setZoomState(); }

  function onTap(x, y, ptype) {
    if (ptype === 'mouse') { toggleZoomAt(x, y); return; }
    var now = Date.now();
    if (now - lastTap < DBLTAP_MS && Math.hypot(x - lastTapX, y - lastTapY) < DBLTAP_DIST) {
      lastTap = 0; toggleZoomAt(x, y);
    } else { lastTap = now; lastTapX = x; lastTapY = y; }
  }
  function toggleZoomAt(x, y) {
    if (scale > 1.01) { scale = 1; tx = 0; ty = 0; animateXform(ZOOM_MS); setZoomState(); }
    else { zoomTo(DOUBLE, x, y, true); setTimeout(setZoomState, 10); }
  }

  function onWheel(e) {
    e.preventDefault();
    var factor = e.deltaY < 0 ? 1.14 : 1 / 1.14;
    zoomTo(scale * factor, e.clientX, e.clientY, false);
    setZoomState();
  }

  // ── Teclado + foco ──────────────────────────────────────────────────────
  function onKeyDown(e) {
    if (!openFlag) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key === 'ArrowRight') { e.preventDefault(); go(1); return; }
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); return; }
    if (e.key === 'Tab') trapFocus(e);
  }
  function trapFocus(e) {
    var f = [].slice.call(root.querySelectorAll('button')).filter(function (b) { return b.offsetParent !== null; });
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    else if (f.indexOf(document.activeElement) === -1) { e.preventDefault(); first.focus(); }
  }

  function onResize() { recomputeBase(); clampPan(); applyTransform(); }

  // Devuelve el foco a quien abrió el modal. getOriginEl() da la <img> (origen
  // FLIP, no enfocable); subimos al control interactivo contenedor (el panel
  // role="button" en el homepage) o, si no hay, hacemos enfocable el elemento
  // (la <img> del PDP) con tabindex=-1. preventScroll evita saltos.
  function focusTrigger() {
    var el = triggerEl;
    if (!el) return;
    var interactive = el.closest && el.closest('[role="button"],button,a,[tabindex]');
    el = interactive || el;
    if (el.tabIndex < 0 && !el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
    try { el.focus({ preventScroll: true }); } catch (e) {}
  }

  // ── Scroll lock (robusto en iOS; compensa la scrollbar en desktop) ───────
  var savedY = 0;
  function lockScroll() {
    savedY = window.scrollY || window.pageYOffset || 0;
    var sbw = window.innerWidth - document.documentElement.clientWidth;
    var b = document.body;
    b.style.position = 'fixed';
    b.style.top = -savedY + 'px';
    b.style.left = '0'; b.style.right = '0'; b.style.width = '100%';
    if (sbw > 0) b.style.paddingRight = sbw + 'px';
    b.classList.add('elx-lb-lock');
  }
  function unlockScroll() {
    var b = document.body;
    b.style.position = ''; b.style.top = ''; b.style.left = ''; b.style.right = '';
    b.style.width = ''; b.style.paddingRight = '';
    b.classList.remove('elx-lb-lock');
    window.scrollTo(0, savedY);
  }

  window.ElyxieLightbox = { open: open, close: close };
})();
