// === App.jsx ===
// Main page: fixed nav, scroll-pinned 3D hero with 5 phases + theme transition,
// editions grid below, manifesto strip, footer mini, Tweaks panel.

// See note in pendant.jsx — `var` (not const) to avoid a redeclaration
// SyntaxError at global scope when both compiled scripts load.
var { useState, useEffect, useRef, useLayoutEffect } = React;

// ---------- Copy: 5 phases bilingual ES / EN ----------
const PHASES = [
  {
    num: '01',
    label: { es: 'BIENVENIDA',  en: 'WELCOME' },
    title: {
      es: <>Un santuario <span className="accent">se acerca</span>.</>,
      en: <>A sanctuary <span className="accent">approaches</span>.</>,
    },
    sub: {
      es: 'No para ser visto. Para ser sentido.',
      en: 'Not to be seen. To be felt.',
    },
    range: [0.00, 0.18],
    position: 'left',
    theme: 'dark',
  },
  {
    num: '02',
    label: { es: 'ORIGEN', en: 'ORIGIN' },
    title: {
      es: <>Agua sagrada de la <span className="accent">Laguna Negra</span>.</>,
      en: <>Sacred water from the <span className="accent">Black Lagoon</span>.</>,
    },
    sub: {
      es: 'Recogida a 3.957 m sobre el nivel del mar, en los Andes peruanos. Mamayacu — la Madre del Agua — descansa dentro de cada esfera.',
      en: 'Gathered 3,957 m above sea level, in the Peruvian Andes. Mamayacu — Mother of Water — rests inside each sphere.',
    },
    range: [0.18, 0.40],
    position: 'left',
    theme: 'dark',
  },
  {
    num: '03',
    label: { es: 'MATERIA', en: 'MATTER' },
    title: {
      es: <>Tres acabados. <span className="accent">Una sola alma.</span></>,
      en: <>Three finishes. <span className="accent">One soul.</span></>,
    },
    sub: {
      es: 'Plata 950 desnuda. Plata bañada en rodio. Plata micrada en oro 24 k. Eliges la piel; el agua viva dentro permanece intacta.',
      en: 'Bare 950 silver. Rhodium-plated silver. Silver micron-plated in 24k gold. You choose the skin; the living water within remains untouched.',
    },
    range: [0.40, 0.60],
    position: 'left',
    theme: 'mid',
  },
  {
    num: '04',
    label: { es: 'ALMA', en: 'SOUL' },
    title: {
      es: <>Brilla en la oscuridad. <span className="accent">Indefinidamente.</span></>,
      en: <>It glows in the dark. <span className="accent">Indefinitely.</span></>,
    },
    sub: {
      es: 'Aluminato de estroncio fusionado al agua madre. No ilumina para ser vista. Ilumina para recordar su propósito.',
      en: 'Strontium aluminate fused with the mother water. It does not light to be seen. It lights to remember its purpose.',
    },
    range: [0.60, 0.80],
    position: 'center',
    theme: 'mid',
  },
  {
    num: '05',
    label: { es: 'EDICIÓN', en: 'EDITION' },
    title: {
      es: <>Cien piezas. <span className="accent">N.º 01 / 100.</span></>,
      en: <>One hundred pieces. <span className="accent">No. 01 / 100.</span></>,
    },
    sub: {
      es: 'No es para todos. Es para quien sabe que esa riqueza también se protege.',
      en: 'Not for everyone. For those who know that such wealth must also be protected.',
    },
    range: [0.80, 1.00],
    position: 'center',
    theme: 'light',
  },
];

// ---------- Editions grid ----------
const EDITIONS = [
  {
    es: { title: 'Ángel de la Laguna Negra', sub: 'Primera edición · N.º 01/100', price: 'Reserva privada' },
    en: { title: 'Angel of the Black Lagoon', sub: 'First edition · No. 01/100', price: 'Private reservation' },
    img: 'assets/photography/grid-01.jpg',
    phosphor: { es: 'BRILLA', en: 'GLOWS' },
    serial: 'N.º 01 / 100',
  },
  {
    es: { title: 'Mamayacu',                 sub: 'Madre del Agua · Edición de invocación', price: 'Próximamente' },
    en: { title: 'Mamayacu',                 sub: 'Mother of Water · Invocation edition', price: 'Coming soon' },
    img: 'assets/photography/grid-02.jpg',
    phosphor: { es: 'BRILLA', en: 'GLOWS' },
    serial: 'N.º — / 33',
  },
  {
    es: { title: 'Huaringa',                 sub: 'Las Siete Lagunas · Constelación', price: 'Próximamente' },
    en: { title: 'Huaringa',                 sub: 'The Seven Lagoons · Constellation',  price: 'Coming soon' },
    img: 'assets/photography/grid-03.jpg',
    phosphor: { es: 'BRILLA', en: 'GLOWS' },
    serial: 'N.º — / 49',
  },
  {
    es: { title: 'Uku Pacha',                sub: 'Mundo Interior · Ritual estacional', price: 'En custodia' },
    en: { title: 'Uku Pacha',                sub: 'Inner World · Seasonal ritual',     price: 'Held in custody' },
    img: 'assets/photography/grid-04.jpg',
    phosphor: { es: 'BRILLA', en: 'GLOWS' },
    serial: 'N.º — / 21',
  },
];

const NAV_LINKS = {
  es: ['INICIO', 'RELATO', 'CUSTODIA', 'EDICIONES', 'CONTACTO'],
  en: ['HOME',   'STORY',  'CUSTODY',  'EDITIONS',  'CONTACT' ],
};

// ---------- Theme color interpolation ----------
// 0 = dark canvas, 1 = ivory canvas. We interpolate body bg + fg in RGB.
const C_DARK_BG = [5,  22,  19];   // #051613
const C_LIGHT_BG = [246, 242, 232]; // #F6F2E8
const C_DARK_FG = [255, 255, 255];
const C_LIGHT_FG = [10,  38,  32]; // #0A2620

function rgbLerp(a, b, t) {
  return `rgb(${Math.round(a[0]+(b[0]-a[0])*t)}, ${Math.round(a[1]+(b[1]-a[1])*t)}, ${Math.round(a[2]+(b[2]-a[2])*t)})`;
}
function rgba(rgb, alpha) {
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}
function rgbLerpArr(a, b, t) {
  return [Math.round(a[0]+(b[0]-a[0])*t), Math.round(a[1]+(b[1]-a[1])*t), Math.round(a[2]+(b[2]-a[2])*t)];
}

// ===========================================================
//  Hero (scroll-pinned)
// ===========================================================
function Hero({ lang, tweaks, pendantRef }) {
  const wrapRef = useRef(null);
  const [progress, setProgress] = useState(0);
  const progressRef = useRef(0);
  const rafRef = useRef(0);
  // Exposed by the snap useEffect so the left-rail buttons can route their
  // scroll through the SAME tween (with `snapping=true` flag), bypassing
  // the idle-snap detector that would otherwise grab the in-flight smooth
  // scroll and tween it to the wrong SNAP_POINT.
  const tweenToRef = useRef(null);

  // pin viewports controlled by tweaks
  const pinVH = tweaks.pinViewports;

  useEffect(() => {
    function onScroll() {
      const wrap = wrapRef.current;
      if (!wrap) return;
      const rect = wrap.getBoundingClientRect();
      const total = wrap.offsetHeight - window.innerHeight;
      const scrolled = -rect.top;
      let p = scrolled / total;
      if (!isFinite(p)) p = 0;
      p = Math.max(0, Math.min(1, p));
      progressRef.current = p;
      // throttle React re-render via rAF
      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = 0;
          setProgress(progressRef.current);
          if (pendantRef.current) {
            pendantRef.current.setProgress(progressRef.current);
          }
        });
      }
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [pendantRef]);

  // Phase snap on idle — native scroll for input, smooth tween for snap.
  // Letting the browser handle the wheel/touch directly keeps input feeling
  // crisp (no interception lag, no velocity gap). When the user pauses for
  // IDLE_MS the snap tween (easeOutCubic, 3000 ms) carries scroll to the next
  // phase midpoint in the direction of motion. Native momentum + tween share
  // similar velocity magnitudes, so the handoff is continuous instead of a
  // sudden kick. Honors prefers-reduced-motion (jumps instantly).
  // The same 3000 ms duration is used for rail-button clicks (via tweenToRef)
  // so the page has ONE consistent transition feel regardless of trigger.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    // Midpoints of each phase range — active copy sits at peak legibility and
    // phase-tied visuals (Laguna Negra backdrop peaks at 0.29) hit their
    // designed maximum. 0 and 1 anchor the entry / exit boundaries.
    const SNAP_POINTS = [0.00, 0.29, 0.50, 0.70, 0.90, 1.00];
    const IDLE_MS = 160;
    const SNAP_DURATION = 3000;
    const PRM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let lastDirection = 1;
    let idleTimer = 0;
    let snapRaf = 0;
    let snapping = false;
    let lastY = window.scrollY;
    // After a rail-button click finishes its tween, the final 'scroll'
    // event arms idleTimer for snapToNext, which would yank the user
    // off the SNAP_POINT they explicitly chose. Suppress snapToNext
    // until this timestamp (performance.now() + 600 ms) when the tween
    // was started by a click. Internal snap-to-next tweens leave it 0.
    let snapCooldownUntil = 0;

    const easeOutCubic = (k) => 1 - Math.pow(1 - k, 3);
    const pinTop = () => wrap.offsetTop;
    const pinTotal = () => Math.max(1, wrap.offsetHeight - window.innerHeight);
    const progressY = (p) => pinTop() + p * pinTotal();
    const currentProgress = () => Math.max(0, Math.min(1, (window.scrollY - pinTop()) / pinTotal()));
    const isInside = () => {
      const rect = wrap.getBoundingClientRect();
      return rect.top <= 0.5 && rect.bottom >= window.innerHeight - 0.5;
    };

    function cancelSnap() {
      if (snapRaf) cancelAnimationFrame(snapRaf);
      snapRaf = 0;
      snapping = false;
    }
    // `duration` is optional. Both idle-snap AND rail-button clicks use
    // SNAP_DURATION (3000 ms) — the page has a single, consistent
    // transition feel regardless of how the section change was initiated.
    // `isUserClick` flags rail-button-initiated tweens: on completion we
    // arm a 600 ms snap cooldown so the idle detector can't immediately
    // pull the user off the SNAP_POINT they explicitly chose.
    function tweenTo(targetProgress, duration, isUserClick) {
      cancelSnap();
      const endY = progressY(targetProgress);
      if (PRM) {
        window.scrollTo({ top: endY });
        lastY = endY;
        if (isUserClick) snapCooldownUntil = performance.now() + 600;
        return;
      }
      snapping = true;
      const startY = window.scrollY;
      const dur = (typeof duration === 'number' && duration > 0) ? duration : SNAP_DURATION;
      const t0 = performance.now();
      function step(t) {
        const k = Math.min(1, (t - t0) / dur);
        const next = startY + (endY - startY) * easeOutCubic(k);
        lastY = next;
        window.scrollTo({ top: next });
        if (k < 1) snapRaf = requestAnimationFrame(step);
        else {
          snapRaf = 0;
          snapping = false;
          if (isUserClick) snapCooldownUntil = performance.now() + 600;
        }
      }
      snapRaf = requestAnimationFrame(step);
    }
    // Expose to the rail-button click handler. Pass isUserClick=true so
    // the cooldown is armed. Cleared in the cleanup below.
    tweenToRef.current = (p, d) => tweenTo(p, d, true);

    function snapToNext() {
      if (snapping || !isInside()) return;
      if (performance.now() < snapCooldownUntil) return;
      const p = currentProgress();
      let target;
      if (lastDirection > 0) target = SNAP_POINTS.find((s) => s > p + 0.005);
      else for (let i = SNAP_POINTS.length - 1; i >= 0; i--) {
        if (SNAP_POINTS[i] < p - 0.005) { target = SNAP_POINTS[i]; break; }
      }
      if (target === undefined) return; // already at an edge; let user exit
      tweenTo(target);
    }

    function onScroll() {
      const y = window.scrollY;
      if (snapping) { lastY = y; return; }
      const dy = y - lastY;
      lastY = y;
      if (dy !== 0) lastDirection = dy > 0 ? 1 : -1;
      if (!isInside()) return;
      clearTimeout(idleTimer);
      idleTimer = setTimeout(snapToNext, IDLE_MS);
    }
    function onWheel(e) {
      // Any user-initiated wheel during a snap cancels it; native scroll then
      // takes over without competing with our tween.
      if (snapping) cancelSnap();
    }
    function onTouchStart() {
      if (snapping) cancelSnap();
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchstart', onTouchStart);
      clearTimeout(idleTimer);
      cancelSnap();
      tweenToRef.current = null;
    };
  }, []);

  // Apply theme to body via data attr + CSS vars (lerped).
  // Throttled: the theme curve only changes meaningfully across the
  // 0.45 → 0.85 progress band, and the RGB outputs are rounded to integers.
  // We bucket to 0.005 (0.5%) — anything finer is invisible against the
  // 1-pixel-of-color difference the lerp can produce — and skip the 5 CSS
  // var writes when the bucket hasn't moved. Cuts ~50× redundant style
  // invalidations per scroll second.
  const themeBucketRef = useRef(-1);
  useEffect(() => {
    const t = progress < 0.45 ? 0 : progress > 0.85 ? 1 : (progress - 0.45) / 0.40;
    const bucket = Math.round(t * 200); // 200 distinct buckets across the band
    if (bucket === themeBucketRef.current) return;
    themeBucketRef.current = bucket;
    const tQ = bucket / 200;
    const bg = rgbLerpArr(C_DARK_BG, C_LIGHT_BG, tQ);
    const fg = rgbLerpArr(C_DARK_FG, C_LIGHT_FG, tQ);
    document.body.style.setProperty('--theme-bg', `rgb(${bg.join(',')})`);
    document.body.style.setProperty('--theme-fg', `rgb(${fg.join(',')})`);
    document.body.style.setProperty('--theme-fg-muted', rgba(fg, 0.55));
    document.body.style.setProperty('--theme-fg-faint', rgba(fg, 0.20));
    document.body.style.setProperty('--theme-fg-hairline', rgba(fg, 0.15));
    const themeName = tQ > 0.5 ? 'light' : 'dark';
    if (document.body.dataset.theme !== themeName) document.body.dataset.theme = themeName;
  }, [progress]);

  // Update tweaks → pendant
  useEffect(() => {
    if (!pendantRef.current) return;
    pendantRef.current.setGlowIntensity(tweaks.glowIntensity);
    pendantRef.current.setGlowColor(tweaks.glowColor);
  }, [tweaks.glowIntensity, tweaks.glowColor, pendantRef]);

  // Push language to the pendant so its imperatively-created MATERIA labels
  // ("plata / oro / rodio" ↔ "silver / gold / rhodium") swap with the rest
  // of the page. setLang no-ops gracefully if labels haven't been created
  // yet (first paint before GLB resolves).
  useEffect(() => {
    if (!pendantRef.current || !pendantRef.current.setLang) return;
    pendantRef.current.setLang(lang);
  }, [lang, pendantRef]);

  // Find active phase from progress
  const activeIdx = PHASES.findIndex(p => progress >= p.range[0] && progress < p.range[1]);
  const activeIndex = activeIdx === -1 ? (progress >= 1 ? PHASES.length - 1 : 0) : activeIdx;

  // Per-phase scroll targets (progress 0..1) for the left-rail stepper
  // buttons. Mirror the SNAP_POINTS used by the idle-snap logic so a
  // clicked phase lands exactly where the idle snap would put it:
  //   01 BIENVENIDA → 0.00 (entry)
  //   02 ORIGEN     → 0.29 (midpoint, peak of Laguna Negra backdrop)
  //   03 MATERIA    → 0.50 (midpoint, trio peak)
  //   04 ALMA       → 0.70 (midpoint)
  //   05 EDICIÓN    → 0.90 (midpoint)
  // All five phases are clickable; the click area matches each row's
  // full label box (num + label inside the .stepper__item div).
  const PHASE_SCROLL_TARGETS = [0.00, 0.29, 0.50, 0.70, 0.90];
  const scrollToProgress = (p) => {
    // Route through the snap useEffect's internal tween: it sets
    // `snapping=true` for its duration so the snap's onScroll listener
    // early-returns, and the idle-snap detector can't grab the in-flight
    // scroll and pull it to a neighbouring SNAP_POINT.
    // No duration override → uses SNAP_DURATION (2100 ms), so a rail-
    // button click feels identical to the idle-snap transition (the
    // "~3 seconds" feel the rest of the page already has).
    if (tweenToRef.current) {
      tweenToRef.current(p);
      return;
    }
    // Fallback (shouldn't happen — the snap effect mounts alongside the
    // rail). Native smooth-scroll if the ref isn't ready yet.
    const wrap = wrapRef.current;
    if (!wrap) return;
    const total = Math.max(1, wrap.offsetHeight - window.innerHeight);
    const top = wrap.offsetTop + p * total;
    window.scrollTo({ top, behavior: 'smooth' });
  };

  return (
    <section ref={wrapRef}
             className="pin-wrap"
             data-theme="dark"
             style={{ height: `${pinVH * 100}vh` }}
             data-screen-label="01 Hero (scroll-pin)">
      <div className="pin-stage">
        {/* Phase 01 (BIENVENIDA) vignette — deep dark with a subtle teal cast
            and an off-center radial fade that focuses attention on the angel.
            Sits behind the transparent 3D canvas (z-index 0, same layer as
            .laguna-bg). Opacity gaussian peaks at progress=0 and decays to
            ~0 by progress≈0.18 so it doesn't bleed into phase 02. */}
        {(() => {
          const o01 = Math.exp(-Math.pow(progress / 0.08, 2));
          return (
            <React.Fragment>
              <div className="hero-vignette-01" aria-hidden style={{ opacity: o01 }} />
              {/* Drifting smoke layer — animated SVG noise translating down.
                  Visible only during phase 01. The Three.js shadow-catcher
                  plane behind the angel paints the silhouette OVER this
                  smoke layer (canvas pixels go dark inside the shadow),
                  giving the "angel's shadow on smoke" effect. */}
              <div className="hero-smoke" aria-hidden style={{ opacity: o01 * 0.7 }} />
              {/* Front-pass smoke. z-index 2 → paints OVER the 3D canvas so
                  wisps cross in front of the angel; much fainter so legibility
                  holds. Paired with .hero-smoke (behind) the figure feels
                  enveloped in mist instead of just backed by it. */}
              <div className="hero-smoke-front" aria-hidden style={{ opacity: o01 * 0.95 }} />
            </React.Fragment>
          );
        })()}

        {/* Phase 03 (MATERIA) atmosphere — warm cone of light from the
            top-right corner, soft volumetric haze around the trio, and
            tiny cream-tinted star particles. Recreates the reference
            handoff visual; pairs with the phase03Spot DirectionalLight in
            pendant.jsx so the CSS atmosphere and the angels' rim
            highlights share one apparent source. Mounted only while the
            gaussian is non-trivial to keep phases 01/02/04/05 untouched. */}
        {(() => {
          const o03 = Math.exp(-Math.pow((progress - 0.50) / 0.085, 2));
          return o03 > 0.005 ? (
            <div className="hero-vignette-03" aria-hidden style={{ opacity: o03 }} />
          ) : null;
        })()}

        {/* Phase 02 (ORIGEN) backdrop — Laguna Negra photograph. Sits behind the
            transparent 3D canvas; opacity is driven by a gaussian centered on
            the middle of phase 02's scroll range so the photo only appears
            when the angel is in the "ORIGEN" beat. */}
        {(() => {
          // Phase 02 (ORIGEN) backdrop: opacity gaussian peaks at progress 0.29.
          // The same gaussian also drives a slight brightness/contrast filter so
          // the photograph compresses into the dark, slightly-underexposed mood
          // of the reference composite when it's fully visible.
          const o = Math.exp(-Math.pow((progress - 0.29) / 0.085, 2));
          return (
            <div
              className="laguna-bg"
              aria-hidden
              style={{
                opacity: o,
                filter: `brightness(${1 - 0.18 * o}) contrast(${1 + 0.10 * o}) saturate(${1 + 0.08 * o})`,
              }}
            />
          );
        })()}

        {/* The 3D canvas */}
        <Pendant ref={pendantRef} glowColor={tweaks.glowColor} glowIntensity={tweaks.glowIntensity} />

        {/* Editorial frame: horizontal line under nav + vertical rail on the left,
            with tiny crosses ONLY at the line terminations. */}
        <div className="frame" aria-hidden>
          <div className="frame__h"></div>
          <div className="frame__v"></div>
          <div className="frame__cross frame__cross--tl"></div>
          <div className="frame__cross frame__cross--tr"></div>
          <div className="frame__cross frame__cross--bl"></div>
          <div className="frame__cross frame__cross--br"></div>
        </div>

        {/* Stepper sits along the left rail; ticks cross the rail line.
            Phases 01/02/03/05 act as click targets that scroll to their
            snap-point (PHASE_SCROLL_TARGETS above); 04 ALMA stays inert by
            design — its target is null. The stepper container drops
            `aria-hidden` because some items are now real interactive
            controls (kept hidden on items without a target). Visual layout
            is untouched; only an interaction layer was added. */}
        <div className="stepper">
          {PHASES.map((p, i) => {
            const target = PHASE_SCROLL_TARGETS[i];
            const isClickable = target !== null;
            const handleActivate = isClickable
              ? () => scrollToProgress(target)
              : undefined;
            return (
              <div
                key={p.num}
                className="stepper__item"
                data-active={i === activeIndex}
                role={isClickable ? 'button' : undefined}
                tabIndex={isClickable ? 0 : undefined}
                aria-hidden={isClickable ? undefined : true}
                aria-label={isClickable ? `${p.num} ${p.label[lang]}` : undefined}
                onClick={handleActivate}
                onKeyDown={isClickable ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleActivate();
                  }
                } : undefined}
              >
                <div className="stepper__col">
                  <span className="stepper__num">{p.num}</span>
                  <span className="stepper__label">{p.label[lang]}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Progress rail (right) */}
        <div className="rail" aria-hidden>
          <div className="rail__label">{lang === 'es' ? 'PROGRESO' : 'PROGRESS'}</div>
          <div className="rail__fill" style={{ height: `${progress * 100}%` }}></div>
          <div className="rail__pct">{String(Math.round(progress * 100)).padStart(2, '0')}%</div>
        </div>

        {/* Edition badge */}
        <div className="edition-badge" aria-hidden>
          <span>{lang === 'es' ? 'EDICIÓN LIMITADA' : 'LIMITED EDITION'}</span>
          <span className="edition-badge__serial">N.º 01 / 100</span>
        </div>

        {/* Phase content stacked, only one active */}
        {(() => {
          // Mirror the close-up gaussian from pendant.jsx (peak tRaw=0.13,
          // σ=0.065) so we can dim the active phase's headline copy at the
          // exact moment the camera dives in. Without this, the centered
          // close-up framing collides with the left-aligned text on tablet
          // and narrow desktop. The fade is applied to an inner wrapper so
          // the outer .phase-content keeps its 700ms active/inactive
          // opacity transition uninterrupted.
          const closeupFade = Math.exp(-Math.pow((progress - 0.13) / 0.065, 2));
          return (
            <div className="phase-layer">
              {PHASES.map((p, i) => {
                const isActive = i === activeIndex;
                const innerStyle = isActive ? { opacity: 1 - closeupFade } : undefined;
                return (
                  <div key={p.num}
                       className="phase-content"
                       data-active={isActive}
                       data-position={p.position}>
                    <div className="phase-content__inner" style={innerStyle}>
                      <h2 className="phase-title">{p.title[lang]}</h2>
                      <p className="phase-sub">{p.sub[lang]}</p>
                      <span className="phase-bilingual">
                        {lang === 'es' ? p.label.en : p.label.es}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* Scroll hint, fades after a tiny bit of scroll */}
        <div className="scroll-hint" data-hidden={progress > 0.04}>
          <span>{lang === 'es' ? 'DESLIZA' : 'SCROLL'}</span>
          <span className="scroll-hint__line"></span>
        </div>
      </div>
    </section>
  );
}

// ===========================================================
//  Editions grid
// ===========================================================
function EditionsGrid({ lang }) {
  return (
    <section className="editions-section" data-screen-label="02 Editions grid">
      <div className="editions-header">
        <h2 className="editions-header__title">
          {lang === 'es' ? <>Piezas en <em style={{fontStyle:'italic'}}>custodia</em>.</> : <>Pieces under <em style={{fontStyle:'italic'}}>custody</em>.</>}
        </h2>
        <div className="editions-header__meta">
          {lang === 'es'
            ? '04 ediciones · Numeradas · Hechas a mano en Lima'
            : '04 editions · Numbered · Handcrafted in Lima'}
        </div>
      </div>
      <div className="editions-grid">
        {EDITIONS.map((e, i) => {
          const t = e[lang];
          // WebP path is derived from the .jpg path so EDITIONS can keep one
          // canonical URL per item. Browsers without WebP support fall back to
          // the original JPG via the <img src> below. All grid images are
          // below the fold, so lazy + async decoding keep the editions section
          // out of the critical path.
          const webp = e.img.replace(/\.jpg$/, '.webp');
          const webp480 = e.img.replace(/\.jpg$/, '-480.webp');
          return (
            <a key={i} className="edition-card" href="#" data-screen-label={`Edition ${i+1}`}>
              <div className="edition-card__media">
                <picture>
                  <source
                    type="image/webp"
                    srcSet={`${webp480} 480w, ${webp} 720w`}
                    sizes="(max-width: 767px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  />
                  <img src={e.img} alt={t.title} loading="lazy" decoding="async"/>
                </picture>
                <span className="edition-card__corner edition-card__corner--tl" aria-hidden></span>
                <span className="edition-card__corner edition-card__corner--tr" aria-hidden></span>
                <span className="edition-card__corner edition-card__corner--bl" aria-hidden></span>
                <span className="edition-card__corner edition-card__corner--br" aria-hidden></span>
                <span className="edition-card__serial">{e.serial}</span>
                <span className="edition-card__phosphor">{e.phosphor[lang]}</span>
              </div>
              <h3 className="edition-card__title">{t.title}</h3>
              <div className="edition-card__sub">{t.sub}</div>
              <div className="edition-card__price">
                <strong>{t.price}</strong>
                <span className="arrow">→</span>
              </div>
            </a>
          );
        })}
      </div>
    </section>
  );
}

// ===========================================================
//  Manifesto + footer
// ===========================================================
function Manifesto({ lang }) {
  return (
    <section className="manifesto" data-screen-label="03 Manifesto">
      <p className="manifesto__quote">
        {lang === 'es'
          ? <>No fabricamos joyas. <em>Custodiamos agua.</em></>
          : <>We do not make jewelry. <em>We keep water.</em></>}
      </p>
      <div className="manifesto__attribution">
        ELYXIE · LIMA · HUANCABAMBA · 3.957 M S.N.M.
      </div>
    </section>
  );
}

function FooterMini({ lang }) {
  return (
    <footer className="footer-mini" data-screen-label="04 Footer">
      <span className="footer-mini__brand">elyxie</span>
      <div className="footer-mini__links">
        <span>{lang === 'es' ? 'TIENDA' : 'SHOP'}</span>
        <span>{lang === 'es' ? 'RELATO' : 'STORY'}</span>
        <span>{lang === 'es' ? 'CUSTODIA' : 'CUSTODY'}</span>
        <span>INSTAGRAM</span>
      </div>
      <span>© 2026 · ELYXIE · {lang === 'es' ? 'TODAS LAS AGUAS RESERVADAS' : 'ALL WATERS RESERVED'}</span>
    </footer>
  );
}

// ===========================================================
//  Nav  (desktop + mobile drawer)
// ===========================================================
const MOBILE_MENU = {
  es: [
    { label: 'INICIO',    href: '#' },
    { label: 'RELATO',    href: '#' },
    { label: 'CUSTODIA',  href: '#' },
    { label: 'EDICIONES', href: '#', children: [
        'ÁNGEL DE LA LAGUNA NEGRA', 'MAMAYACU', 'HUARINGA', 'UKU PACHA',
    ]},
    { label: 'CONTACTO',  href: '#' },
  ],
  en: [
    { label: 'HOME',      href: '#' },
    { label: 'STORY',     href: '#' },
    { label: 'CUSTODY',   href: '#' },
    { label: 'EDITIONS',  href: '#', children: [
        'ANGEL OF THE BLACK LAGOON', 'MAMAYACU', 'HUARINGA', 'UKU PACHA',
    ]},
    { label: 'CONTACT',   href: '#' },
  ],
};

function MobileNavDrawer({ lang, setLang, open, onClose }) {
  const [openIdx, setOpenIdx] = useState(-1);

  // Lock body scroll + Esc-to-close while drawer is open
  useEffect(() => {
    if (!open) return;
    const prevHtml = document.documentElement.style.overflow;
    const prevBody = document.body.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.documentElement.style.overflow = prevHtml;
      document.body.style.overflow = prevBody;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  const t = lang === 'es'
    ? { contact: 'CONTÁCTANOS', copy: '© 2026 ELYXIE · Custodios de Mamayacu' }
    : { contact: 'CONTACT US',  copy: '© 2026 ELYXIE · Custodians of Mamayacu' };

  return (
    <div className="mobile-drawer" data-open={open} aria-hidden={!open}>
      <div className="mobile-drawer__inner">
        <ul className="mobile-drawer__list">
          {MOBILE_MENU[lang].map((item, i) => {
            const hasChildren = !!item.children;
            const isOpen = openIdx === i;
            return (
              <li key={item.label} className="mobile-drawer__item" data-open={isOpen}>
                {hasChildren ? (
                  <button
                    type="button"
                    className="mobile-drawer__row"
                    onClick={() => setOpenIdx(isOpen ? -1 : i)}
                    aria-expanded={isOpen}
                  >
                    <span>{item.label}</span>
                    <span className="mobile-drawer__chev" aria-hidden>{isOpen ? '−' : '+'}</span>
                  </button>
                ) : (
                  <a className="mobile-drawer__row" href={item.href} onClick={onClose}>
                    <span>{item.label}</span>
                    <span className="mobile-drawer__chev" aria-hidden>→</span>
                  </a>
                )}
                {hasChildren && (
                  <ul className="mobile-drawer__sub">
                    {item.children.map((c) => (
                      <li key={c}><a href="#" onClick={onClose}>{c}</a></li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>

        <div className="mobile-drawer__lang" role="group" aria-label="Language">
          <button data-active={lang === 'es'} onClick={() => setLang('es')}>ES</button>
          <span aria-hidden>·</span>
          <button data-active={lang === 'en'} onClick={() => setLang('en')}>EN</button>
        </div>

        <div className="mobile-drawer__phones">
          <a href="tel:+51138899012">+51 1 388 9912</a>
          <a href="tel:+5113889955">+51 1 388 9955</a>
        </div>

        <a className="mobile-drawer__cta Button Button--ghost" href="#contact" onClick={onClose}>
          {t.contact}
          <span className="Button__arrow">→</span>
        </a>

        <ul className="mobile-drawer__social" aria-label="Social">
          <li><a href="#" aria-label="Instagram"><InstaSvg/></a></li>
          <li><a href="#" aria-label="Facebook"><FbSvg/></a></li>
          <li><a href="#" aria-label="YouTube"><YtSvg/></a></li>
          <li><a href="#" aria-label="Pinterest"><PinSvg/></a></li>
        </ul>

        <p className="mobile-drawer__copy">{t.copy}</p>
      </div>
    </div>
  );
}

// Tiny inline icon set so the drawer is self-contained
function InstaSvg() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>; }
function FbSvg()    { return <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 21v-8h2.7l.4-3.1h-3.1V7.9c0-.9.3-1.5 1.5-1.5h1.7V3.6c-.3 0-1.3-.1-2.4-.1-2.4 0-4 1.4-4 4.1V9.9H7.6V13h2.6v8h3.3z"/></svg>; }
function YtSvg()    { return <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M22 8.2a3 3 0 0 0-2-2c-1.8-.5-9-.5-9-.5s-7.2 0-9 .5a3 3 0 0 0-2 2c-.4 1.8-.4 3.8-.4 3.8s0 2 .4 3.8a3 3 0 0 0 2 2c1.8.5 9 .5 9 .5s7.2 0 9-.5a3 3 0 0 0 2-2c.4-1.8.4-3.8.4-3.8s0-2-.4-3.8zM9.5 15.5v-7l6 3.5-6 3.5z"/></svg>; }
function PinSvg()   { return <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.5 2 2 6.5 2 12c0 4.2 2.6 7.8 6.2 9.3-.1-.8-.2-2 0-2.9.2-.8 1.2-5.1 1.2-5.1s-.3-.6-.3-1.5c0-1.4.8-2.5 1.9-2.5.9 0 1.3.7 1.3 1.5 0 .9-.6 2.3-.9 3.6-.3 1.1.5 2 1.6 2 1.9 0 3.4-2 3.4-5 0-2.6-1.9-4.4-4.6-4.4-3.1 0-5 2.3-5 4.8 0 1 .4 2 .8 2.6.1.1.1.2.1.3-.1.3-.2 1-.3 1.1 0 .2-.2.2-.4.1-1.2-.6-2-2.4-2-3.8 0-3.1 2.3-6 6.5-6 3.4 0 6.1 2.4 6.1 5.7 0 3.4-2.1 6.2-5.1 6.2-1 0-2-.5-2.3-1.1l-.6 2.4c-.2.9-.8 2-1.2 2.6.9.3 1.9.4 2.9.4 5.5 0 10-4.5 10-10S17.5 2 12 2z"/></svg>; }

function Nav({ lang, setLang }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Close drawer if viewport grows past mobile breakpoint
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const handler = (e) => { if (e.matches) setDrawerOpen(false); };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return (
    <>
      <nav className="nav" data-drawer-open={drawerOpen}>
        <a className="nav__brand" href="#" aria-label="elyxie">elyxie</a>

        {/* Desktop inline links + language switcher (hidden on mobile via CSS) */}
        <div className="nav__links">
          {NAV_LINKS[lang].map((l) => (
            <a key={l} className="nav__link" href="#">{l}</a>
          ))}
        </div>
        <div className="nav__lang" style={{ '--lang-pos': lang === 'en' ? 1 : 0 }} role="group" aria-label="Language">
          <button data-active={lang === 'es'} onClick={() => setLang('es')} aria-pressed={lang === 'es'}>ES</button>
          <button data-active={lang === 'en'} onClick={() => setLang('en')} aria-pressed={lang === 'en'}>EN</button>
        </div>

        {/* Mobile icon buttons (hidden on desktop via CSS) */}
        <div className="nav__mobile-actions" aria-hidden={false}>
          <button
            className="nav__icon-btn nav__icon-btn--menu"
            aria-label={drawerOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={drawerOpen}
            type="button"
            onClick={() => setDrawerOpen((v) => !v)}
          >
            {drawerOpen ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M5 5l14 14M19 5L5 19"/>
              </svg>
            ) : (
              <svg width="18" height="14" viewBox="0 0 24 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M3 3h18M3 9h18M3 15h18"/>
              </svg>
            )}
          </button>
        </div>
      </nav>

      <MobileNavDrawer lang={lang} setLang={setLang} open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}

// ===========================================================
//  Tweaks panel
// ===========================================================
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "pinViewports": 5,
  "glowIntensity": 1.0,
  "glowColor": "#7DFFB2",
  "grainAmount": 0.12
}/*EDITMODE-END*/;

function ElyxieTweaks({ tweaks, setTweak }) {
  return (
    <TweaksPanel title="Tweaks · Elyxie hero">
      <TweakSection label="Scroll mechanic">
        <TweakSlider
          label="Pin duration (viewports)"
          value={tweaks.pinViewports}
          min={3} max={9} step={1}
          onChange={(v) => setTweak('pinViewports', v)}
        />
      </TweakSection>
      <TweakSection label="Phosphor core">
        <TweakSlider
          label="Glow intensity"
          value={tweaks.glowIntensity}
          min={0.2} max={2.4} step={0.05}
          onChange={(v) => setTweak('glowIntensity', v)}
        />
        <TweakColor
          label="Glow color"
          value={tweaks.glowColor}
          options={['#7DFFB2', '#E9D7B1', '#C9A66B', '#B9FFD4']}
          onChange={(v) => setTweak('glowColor', v)}
        />
      </TweakSection>
      <TweakSection label="Film grain">
        <TweakSlider
          label="Grain amount"
          value={tweaks.grainAmount}
          min={0} max={0.32} step={0.01}
          onChange={(v) => setTweak('grainAmount', v)}
        />
      </TweakSection>
    </TweaksPanel>
  );
}

// ===========================================================
//  App
// ===========================================================
function App() {
  const [lang, setLang] = useState('es');
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const pendantRef = useRef(null);

  // Push grain amount to CSS var
  useEffect(() => {
    document.documentElement.style.setProperty('--grain-opacity', String(tweaks.grainAmount));
  }, [tweaks.grainAmount]);

  // Post-hero theme controller: an IntersectionObserver picks whichever
  // section is most visible AFTER the hero pin and sets body theme.
  // The hero's own scroll-progress listener already controls theme while it
  // is on screen — so we only override once the hero is out of view.
  useEffect(() => {
    const sections = Array.from(document.querySelectorAll('[data-theme]'));
    if (!sections.length) return;

    const io = new IntersectionObserver((entries) => {
      // Find the entry with greatest intersectionRatio among those currently
      // intersecting; that's the section the user is looking at.
      let best = null;
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        if (!best || e.intersectionRatio > best.intersectionRatio) best = e;
      });
      if (!best) return;
      const target = best.target;
      // Skip the pin-wrap — it has its own progress-driven theme curve
      if (target.classList.contains('pin-wrap')) return;
      const theme = target.dataset.theme;
      if (!theme) return;
      applyTheme(theme);
    }, { threshold: [0.25, 0.5, 0.75] });

    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, []);

  return (
    <>
      <Nav lang={lang} setLang={setLang} />
      <Hero lang={lang} tweaks={tweaks} pendantRef={pendantRef} />

      {/* Post-hero sections (structure parallels lightweight.info homepage) */}
      <SectionVideoHero lang={lang} />
      <SectionInstagramGrid lang={lang} />
      <SectionBrandStatement lang={lang} />
      <SectionNewsletter lang={lang} />
      <SectionOutroWordmark />
      <Footer lang={lang} />

      {/* Film grain — fixed overlay */}
      <div className="grain" aria-hidden></div>
      <div className="grain grain--coarse" aria-hidden></div>

      <ElyxieTweaks tweaks={tweaks} setTweak={setTweak} />
    </>
  );
}

// Apply a theme by name (light | dark) by writing the same CSS variables
// the hero scroll-progress logic writes. Single source of truth.
function applyTheme(theme) {
  if (theme === 'light') {
    document.body.style.setProperty('--theme-bg', '#F6F2E8');
    document.body.style.setProperty('--theme-fg', '#0A2620');
    document.body.style.setProperty('--theme-fg-muted', 'rgba(10,38,32,0.55)');
    document.body.style.setProperty('--theme-fg-faint', 'rgba(10,38,32,0.20)');
    document.body.style.setProperty('--theme-fg-hairline', 'rgba(10,38,32,0.15)');
    document.body.dataset.theme = 'light';
  } else {
    document.body.style.setProperty('--theme-bg', '#051613');
    document.body.style.setProperty('--theme-fg', '#FFFFFF');
    document.body.style.setProperty('--theme-fg-muted', 'rgba(255,255,255,0.55)');
    document.body.style.setProperty('--theme-fg-faint', 'rgba(255,255,255,0.18)');
    document.body.style.setProperty('--theme-fg-hairline', 'rgba(255,255,255,0.12)');
    document.body.dataset.theme = 'dark';
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
