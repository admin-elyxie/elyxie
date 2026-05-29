// === Pendant.jsx ===
// Three.js scene that displays the Elyxie angel GLB, driven by a scroll
// `progress` (0..1). The procedural pendant has been replaced by a real
// 3D model. Three.js + the GLB loaders are pre-loaded by the inline module
// preamble in index.html and exposed on window; we wait for the
// `three-ready` event (or window.__threeReady) before building the scene.

// `var` (not const) so the destructured hooks can share global scope with
// app.jsx's matching destructure without a "already declared" SyntaxError
// when the two compiled scripts both execute at the top of the page.
var { useEffect, useRef, useImperativeHandle, forwardRef } = React;

const easeInOut = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
// Smootherstep (Perlin quintic): 6x⁵ − 15x⁴ + 10x³. Zeros 1st AND 2nd
// derivative at both endpoints, so velocity AND acceleration glide in/out.
// Use this in preference to easeInOut whenever the change in camera scale
// or position would otherwise feel "punchy" near the segment boundaries.
const smootherstep = (t) => { const x = t < 0 ? 0 : t > 1 ? 1 : t; return x * x * x * (x * (x * 6 - 15) + 10); };
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const MODEL_URL = 'assets/models/angel.glb';

// Procedural studio cube map → PMREM. Same palette as the original pendant
// so the gold reads the same against the page background.
function buildStudioEnvMap(THREE, renderer, palette) {
  const size = 256;
  const faces = [];
  const { warm, cool, accent, top, floor } = palette;
  function gradientCanvas(top, mid, bot, accents = []) {
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, size);
    g.addColorStop(0, top);
    g.addColorStop(0.55, mid);
    g.addColorStop(1, bot);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    accents.forEach(({ x, y, r, color }) => {
      const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, color);
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, size, size);
    });
    return c;
  }
  faces.push(gradientCanvas(top, warm, floor, [{ x: size * 0.7, y: size * 0.35, r: size * 0.5, color: warm }]));
  faces.push(gradientCanvas(top, cool, floor, [{ x: size * 0.3, y: size * 0.5,  r: size * 0.5, color: cool }]));
  faces.push(gradientCanvas(top, top, warm));
  faces.push(gradientCanvas(floor, floor, '#000'));
  faces.push(gradientCanvas(top, accent, floor, [{ x: size * 0.5, y: size * 0.55, r: size * 0.45, color: accent }]));
  faces.push(gradientCanvas(top, warm, floor));

  const cubeTex = new THREE.CubeTexture(faces);
  cubeTex.needsUpdate = true;
  cubeTex.colorSpace = THREE.SRGBColorSpace;

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileCubemapShader();
  const envMap = pmrem.fromCubemap(cubeTex).texture;
  pmrem.dispose();
  return envMap;
}

let _loader = null;
function getLoader(renderer) {
  if (_loader) return _loader;
  const { GLTFLoader, DRACOLoader, KTX2Loader, MeshoptDecoder } = window;
  const draco = new DRACOLoader();
  draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
  const ktx2 = new KTX2Loader()
    .setTranscoderPath('https://unpkg.com/three@0.160.0/examples/jsm/libs/basis/')
    .detectSupport(renderer);
  _loader = new GLTFLoader()
    .setDRACOLoader(draco)
    .setKTX2Loader(ktx2)
    .setMeshoptDecoder(MeshoptDecoder);
  return _loader;
}

// Soft mint-white orb. Reference photo shows a bright white center with the
// green glow emerging only around the rim — not a saturated phosphor color.
// We keep the white core and let the surrounding rim DirectionalLight +
// PointLight cast the green tint locally around the orb.
function buildOrbMaterial(THREE) {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color('#eefff5'),
    emissive: new THREE.Color('#9ef0c2'),
    emissiveIntensity: 0.9,
    metalness: 0.0,
    roughness: 0.35,
    toneMapped: false,
  });
}

// 22 k gold: ~91.6% Au — slightly less saturated than 24 k but still richly
// yellow. Two variants for subtle mesh-to-mesh tonal variation.
function buildGoldMaterial(THREE, tone) {
  if (tone === 'bright') {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color('#f4d27a'),
      metalness: 1.0,
      roughness: 0.18,
      envMapIntensity: 1.8,
      side: THREE.DoubleSide,
    });
  }
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color('#e0b558'),
    metalness: 1.0,
    roughness: 0.28,
    envMapIntensity: 1.6,
    side: THREE.DoubleSide,
  });
}

// Sterling silver 950 — slightly warm white with a soft luster. Same metalness
// as gold (=1.0) but a touch rougher than rhodium → a softer, more diffuse
// reflection that reads as "real silver" against the studio env. Two variants
// match the warm/bright split applied to the gold meshes for tonal cohesion.
function buildSilverMaterial(THREE, tone) {
  if (tone === 'bright') {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color('#f3f4f1'),
      metalness: 1.0,
      roughness: 0.18,
      envMapIntensity: 1.55,
      side: THREE.DoubleSide,
    });
  }
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color('#dadbd6'),
    metalness: 1.0,
    roughness: 0.30,
    envMapIntensity: 1.35,
    side: THREE.DoubleSide,
  });
}

// Rhodium plating — the brightest, coolest, most mirror-like of the three.
// Very low roughness → sharp specular highlights; cool-white tint pulls the
// reflected env map toward blue. Reads as "fresh" / "platinum-grade" against
// the warm gold and softer silver on either side. Two variants for the same
// warm/bright split.
function buildRhodiumMaterial(THREE, tone) {
  if (tone === 'bright') {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color('#fbfcff'),
      metalness: 1.0,
      roughness: 0.05,
      envMapIntensity: 1.85,
      side: THREE.DoubleSide,
    });
  }
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color('#e8eaef'),
    metalness: 1.0,
    roughness: 0.12,
    envMapIntensity: 1.6,
    side: THREE.DoubleSide,
  });
}

function whenThreeReady() {
  if (window.__threeReady) return Promise.resolve();
  return new Promise((resolve) => {
    window.addEventListener('three-ready', () => resolve(), { once: true });
  });
}

const Pendant = forwardRef(function Pendant({ glowColor = '#7DFFB2', glowIntensity = 1.0 }, ref) {
  const containerRef = useRef(null);
  const stateRef = useRef({
    progress: 0,
    glowIntensity,
    glowColor,
    // Phase 04 (ALMA) day/night beat. Target is set by setAlmaNight; the
    // animate loop lerps `Actual` toward it each frame for a smooth swap
    // that lines up with the CSS cross-fade on the temple backdrop.
    almaNightTarget: 0,
    almaNightActual: 0,
  });

  useImperativeHandle(ref, () => ({
    setProgress: (p) => { stateRef.current.progress = p; },
    setGlowIntensity: (v) => { stateRef.current.glowIntensity = v; },
    setGlowColor: (c) => {
      stateRef.current.glowColor = c;
      const refs = stateRef.current.materials;
      if (refs) {
        const col = new window.THREE.Color(c);
        refs.rim.color.copy(col);
        if (refs.sphereLight) refs.sphereLight.color.copy(col);
        if (refs.sphereMeshes) {
          refs.sphereMeshes.forEach((m) => {
            if (m.material) m.material.emissive.copy(col);
          });
        }
      }
    },
    // Push language changes into the MATERIA labels. The labels are created
    // imperatively (DOM siblings of the WebGL canvas) so React's re-render
    // path doesn't reach them — app.jsx calls this whenever `lang` toggles.
    setLang: (l) => {
      stateRef.current.lang = l;
      const labels = stateRef.current.materiaLabels;
      const texts  = stateRef.current.materiaLabelTexts;
      if (labels && texts && texts[l]) {
        labels.forEach((el, i) => { el.textContent = texts[l][i]; });
      }
    },
    // Phase 04 (ALMA) day/night beat. app.jsx flips this boolean every 5 s
    // while the user is parked inside ALMA's gaussian window. We don't
    // snap the orb scalar here — we only set the target. The animate loop
    // lerps `almaNightActual` toward this target each frame so the orb
    // intensity transition matches the ~1.1 s CSS cross-fade on the
    // temple backdrop.
    setAlmaNight: (isNight) => {
      stateRef.current.almaNightTarget = isNight ? 1 : 0;
    },
  }), []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;
    let dispose = () => {};

    whenThreeReady().then(() => {
      if (disposed || !container) return;
      const THREE = window.THREE;

      const scene = new THREE.Scene();
      scene.background = null;

      const camera = new THREE.PerspectiveCamera(32, container.clientWidth / container.clientHeight, 0.1, 50);
      camera.position.set(0, 0, 4.5);

      // Anti-aliasing ON always. The previous "DPR=2 gives free SSAA" comment
      // was a fiction because the pixel-ratio cap was 1.5 — i.e. the browser
      // always upscaled the canvas to native DPR (2× or 3× on phones),
      // producing visible jaggies on wing silhouettes. MSAA cleans those up
      // before the browser upscale; the ~30 % GPU cost is worth it.
      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
        stencil: false,
        depth: true,
      });
      // Pixel-ratio cap 2.0 — covers retina laptops (DPR 2) at native and
      // narrows the upscale on DPR-3 iPhones from 2× to 1.5×. 4× the
      // fragment work of DPR=1, but iPhone GPUs handle this scene fine and
      // the quality jump on phones is the whole point. Capping (vs. raw
      // DPR) still protects retina laptops from 9× shader cost.
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2.0));
      renderer.setSize(container.clientWidth, container.clientHeight);
      renderer.setClearColor(0x000000, 0);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      // Shadow map (used by phase01Spot to cast the angel's silhouette onto
      // the orb itself + onto the smoke-catcher plane behind the model). All
      // other phase lights have castShadow=false, so this is a phase-01-only
      // visual cost — phases 02/03/04/05 simply skip shadow rendering for
      // their lights and the shadow plane stays at opacity 0.
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      // autoUpdate=false freezes the shadow pass; we'll re-enable it only
      // when phase01Spot.intensity > 0 (gated below in the animate loop).
      // This eliminates the per-frame shadow render cost outside phase 01.
      renderer.shadowMap.autoUpdate = false;
      renderer.shadowMap.needsUpdate = true;
      container.appendChild(renderer.domElement);
      renderer.domElement.classList.add('scene-canvas');

      // ===== MATERIA labels (HTML overlay) =====
      // Three brand labels — one per angel in the trio. Created here as DOM
      // siblings of the canvas (NOT React children — Pendant's useEffect runs
      // once and React doesn't re-render the canvas host). The animate loop
      // projects each angel's bbox-bottom world position to screen and writes
      // the label's CSS transform + opacity. Opacity is gated by
      // phase03Proximity so the labels are invisible outside MATERIA.
      const labelTexts = {
        es: ['plata', 'oro', 'rodio'],
        en: ['silver', 'gold', 'rhodium'],
      };
      const initialLang = stateRef.current.lang || 'es';
      stateRef.current.lang = initialLang;
      stateRef.current.materiaLabelTexts = labelTexts;
      stateRef.current.materiaLabels = [0, 1, 2].map((i) => {
        const el = document.createElement('div');
        el.className = 'materia-label';
        el.textContent = labelTexts[initialLang][i];
        el.style.opacity = '0';
        container.appendChild(el);
        return el;
      });

      // Warm studio palette: reflections on the gold should read as gold,
      // not green. The orb's own emissive + a tight PointLight cast the
      // green tint locally; the environment stays warm amber.
      const envMap = buildStudioEnvMap(THREE, renderer, {
        warm: '#c89a66',
        cool: '#3a2e1c',
        accent: '#e0b070',
        top: '#1c1612',
        floor: '#080604',
      });
      scene.environment = envMap;

      const ambient = new THREE.AmbientLight(0xffffff, 0.22);
      scene.add(ambient);

      const key = new THREE.DirectionalLight(0xffcf90, 1.5);
      key.position.set(3, 4, 5);
      scene.add(key);

      const rim = new THREE.DirectionalLight(new THREE.Color(stateRef.current.glowColor), 0.12);
      rim.position.set(-3, 1, -4);
      scene.add(rim);

      // Warm fill on the camera-facing side so the gold reads warm, not green.
      const fill = new THREE.DirectionalLight(0xffe2a8, 0.75);
      fill.position.set(1.5, 0.5, 5);
      scene.add(fill);

      const top = new THREE.DirectionalLight(0xffffff, 0.35);
      top.position.set(0, 6, 0);
      scene.add(top);

      // ---- Phase 01 (BIENVENIDA) lighting rig ----
      // Single overhead "spotlight" that mimics the visible volumetric light
      // shaft in the reference. Positioned high and slightly to the front-
      // right of the angel so the top of the head, upper-wing arc, and the
      // orb catch strong warm-white highlights; the cloth and legs fall into
      // shadow because the front-warm key/fill are damped during phase 01.
      // Intensity ramps via `phase01Proximity` in the animate loop — zero
      // outside phase 01, so the original lighting rig is intact elsewhere.
      const phase01Spot = new THREE.DirectionalLight(0xfff2dc, 0);
      phase01Spot.position.set(2.4, 8.5, 1.8);
      // Cast a soft shadow from this light so the angel's hand throws a
      // visible shadow on the orb (the reference shows this contrast at
      // the top of the orb) AND so the angel silhouette projects onto
      // the smoke-catcher plane sitting behind the model. The shadow
      // contribution is gated by phase01Spot.intensity → 0 outside phase
      // 01, so no shadow energy bleeds into other phases.
      phase01Spot.castShadow = true;
      phase01Spot.shadow.mapSize.set(1024, 1024);
      phase01Spot.shadow.camera.near = 0.5;
      phase01Spot.shadow.camera.far = 14;
      phase01Spot.shadow.camera.left   = -2.5;
      phase01Spot.shadow.camera.right  =  2.5;
      phase01Spot.shadow.camera.top    =  2.5;
      phase01Spot.shadow.camera.bottom = -2.5;
      phase01Spot.shadow.bias       = -0.0008;
      phase01Spot.shadow.normalBias =  0.02;
      phase01Spot.shadow.radius     =  8;
      scene.add(phase01Spot);

      // Phase 03 (MATERIA) warm rim light — matches the apparent source of
      // the .hero-vignette-03 CSS atmosphere (cone from the top-right corner
      // of the frame). World position (5.5, 6.0, 2.8) sits up-and-to-the-
      // right-front so the directional vector hits the upper-right quadrant
      // of every wing tip across the trio, producing the warm crest highlight
      // visible in the reference handoff image. Color 0xffd29a (warm amber)
      // matches the cone's tint stops in the CSS so the actual angel rim and
      // the painted atmospheric glow read as one light. NO shadows (would
      // double-cost the autoUpdate=false optimisation and the trio doesn't
      // need cast shadows during MATERIA). Intensity is driven by the
      // animate loop from phase03Proximity → zero outside the [0.40, 0.60]
      // band so the original studio rig is intact in every other phase.
      const phase03Spot = new THREE.DirectionalLight(0xffd29a, 0);
      phase03Spot.position.set(5.5, 6.0, 2.8);
      scene.add(phase03Spot);

      // Phase 01 (BIENVENIDA) smoke-shadow catcher plane. Sits behind the
      // angel; receives the phase01Spot shadow so the angel's silhouette
      // appears as a dark streak THROUGH the CSS smoke layer beneath the
      // canvas (the canvas paints dark where the shadow falls, occluding
      // the smoke in that region — "shadow on smoke" effect from the
      // reference). ShadowMaterial is transparent everywhere except where
      // shadow lands. Opacity ramps via phase01Proximity → 0 outside.
      const smokeShadowPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(10, 10),
        new THREE.ShadowMaterial({ color: 0x000000, opacity: 0, transparent: true, depthWrite: false }),
      );
      smokeShadowPlane.position.set(0, 0, -2.0);
      smokeShadowPlane.receiveShadow = true;
      scene.add(smokeShadowPlane);


      // ---- Phase 02 (ORIGEN) lighting rig ----
      // Both lights start at intensity 0 and are modulated in the animate loop
      // by `phaseOriginProximity`, so they ONLY affect the angel while the
      // Laguna Negra backdrop is visible. Phases 01 / 03+ stay untouched.
      //
      // phaseSun: hard warm key from upper-right matching the sun-break in
      // the reference photograph (visible god-rays at ~70% X, ~30% Y).
      const phaseSun = new THREE.DirectionalLight(0xffc275, 0);
      phaseSun.position.set(4.2, 5.0, 2.2);
      scene.add(phaseSun);
      // phaseSunBounce: cool, low-elevation bounce from the lake water side
      // to lift the shadow side a touch without flattening the chiaroscuro.
      const phaseSunBounce = new THREE.DirectionalLight(0x6f93b3, 0);
      phaseSunBounce.position.set(-2.2, -1.2, 2.8);
      scene.add(phaseSunBounce);

      // ---- Phase 04 (ALMA) DAY lighting rig ----
      // The temple-day backdrop has a single dramatic god-ray descending from
      // a skylight ABOVE and slightly BEHIND the angel (the bright cone runs
      // from top of frame down through the centre, with the back wall lit
      // and the columns flanking the angel in soft shadow). The default
      // studio rig (key at +Z front, fill at +Z front) lights the angel
      // from camera-side — that contradicts the backdrop and makes the
      // model float over it instead of belonging to it.
      //
      // phase04DaySun: hard warm key from HIGH + BEHIND (positive Y, slightly
      // negative Z) so the rim of the head, the top of each wing, and the
      // shoulder blades catch the highlight while the camera-facing chest
      // and dress fall into soft shadow — matching the backdrop's god-ray
      // direction. Same warm tint as the temple stone (0xffe4b8).
      const phase04DaySun = new THREE.DirectionalLight(0xffe4b8, 0);
      phase04DaySun.position.set(0.6, 7.0, -2.5);
      scene.add(phase04DaySun);
      // phase04DayBounce: subtle warm bounce from the FLOOR of the temple
      // (low Y, in front) so the camera-facing side isn't pitch black — the
      // marble floor in the backdrop is bright and would bounce diffuse
      // light up onto the angel's chin, chest, and the underside of the
      // wings. Very low intensity, the chiaroscuro from the rear sun
      // should still dominate.
      const phase04DayBounce = new THREE.DirectionalLight(0xfff0d0, 0);
      phase04DayBounce.position.set(0, -2.0, 3.0);
      scene.add(phase04DayBounce);

      const angel = new THREE.Group();
      scene.add(angel);

      // Soft green point light that "lives" inside the sphere the angel
      // holds. Short range (1.5) + fast decay (2.5) so the green tint stays
      // local to the orb and the adjacent feathers — the rest of the angel
      // reads as warm gold, matching the product photo.
      const sphereLight = new THREE.PointLight(new THREE.Color(stateRef.current.glowColor), 0, 1.5, 2.5);
      angel.add(sphereLight);

      // Fairy-dust COMET TRAILS. A small number of particles (≈22), each
      // following its own gentle spiral trajectory around a random axis.
      // Instead of rendering each particle as a point, we draw the recent
      // history of its position as a line segment trail — a thin streak
      // of light like a shooting star. Trail colors fade from transparent
      // (tail) to bright (head) using vertex colors. Each particle's life
      // cycle: spawn at orb → spiral outward → head fades first while the
      // tail lingers → respawn. Trails are sampled every few frames
      // (DUST_SAMPLE_INTERVAL) so they span real motion time, not a
      // single frame.
      const DUST_COUNT = 22;
      const TRAIL_PTS  = 14;
      const TRAIL_SEGS = TRAIL_PTS - 1;
      const VERTS_PER_PARTICLE = TRAIL_SEGS * 2;
      const TOTAL_VERTS = DUST_COUNT * VERTS_PER_PARTICLE;

      const dustGeom = new THREE.BufferGeometry();
      const dustPositions = new Float32Array(TOTAL_VERTS * 3);
      const dustColors    = new Float32Array(TOTAL_VERTS * 3);
      dustGeom.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
      dustGeom.setAttribute('color',    new THREE.BufferAttribute(dustColors,    3));

      // Per-particle state arrays:
      //  dustAxis    — unit vector the particle spirals around
      //  dustInitDir — unit vector in the plane perpendicular to the axis
      //                (initial radial direction)
      //  dustAngSpd  — angular speed around the axis (rad/sec)
      //  dustOutSpd  — outward radial speed (world units / sec)
      //  dustLife    — current life (seconds)
      //  dustMaxLife — particle dies when life ≥ maxLife
      //  dustHistory — circular buffer of TRAIL_PTS past positions per particle
      //  dustHistIdx — next write index into the history buffer
      const dustAxis    = new Float32Array(DUST_COUNT * 3);
      const dustInitDir = new Float32Array(DUST_COUNT * 3);
      const dustAngSpd  = new Float32Array(DUST_COUNT);
      const dustOutSpd  = new Float32Array(DUST_COUNT);
      const dustLife    = new Float32Array(DUST_COUNT);
      const dustMaxLife = new Float32Array(DUST_COUNT);
      const dustHistory = new Float32Array(DUST_COUNT * TRAIL_PTS * 3);
      const dustHistIdx = new Int32Array(DUST_COUNT);

      const glowCol = new THREE.Color(stateRef.current.glowColor);

      // Pick a uniformly random unit vector and write into target[off..off+2].
      const _randUnit = (target, off) => {
        const theta = Math.random() * Math.PI * 2;
        const cosPhi = 2 * Math.random() - 1;
        const sinPhi = Math.sqrt(1 - cosPhi * cosPhi);
        target[off]     = sinPhi * Math.cos(theta);
        target[off + 1] = sinPhi * Math.sin(theta);
        target[off + 2] = cosPhi;
      };

      // Reset a particle's parameters and trail history (called on init + respawn).
      const _resetParticle = (i) => {
        _randUnit(dustAxis, i * 3);
        // initDir = random unit, projected to be perpendicular to axis so the
        // particle spirals in a stable plane.
        _randUnit(dustInitDir, i * 3);
        const ax = dustAxis[i*3], ay = dustAxis[i*3 + 1], az = dustAxis[i*3 + 2];
        const dot = dustInitDir[i*3] * ax + dustInitDir[i*3 + 1] * ay + dustInitDir[i*3 + 2] * az;
        dustInitDir[i*3]     -= dot * ax;
        dustInitDir[i*3 + 1] -= dot * ay;
        dustInitDir[i*3 + 2] -= dot * az;
        const len = Math.hypot(dustInitDir[i*3], dustInitDir[i*3 + 1], dustInitDir[i*3 + 2]);
        if (len > 0.001) {
          dustInitDir[i*3]     /= len;
          dustInitDir[i*3 + 1] /= len;
          dustInitDir[i*3 + 2] /= len;
        } else {
          dustInitDir[i*3] = 1; dustInitDir[i*3 + 1] = 0; dustInitDir[i*3 + 2] = 0;
        }
        // Per-particle motion variety: some slow lingering wisps, some
        // slightly quicker embers. Speeds dialed DOWN from the previous
        // pass so trails don't sprawl across the frame — keeps the effect
        // subtle and elegant, like delicate fairy dust orbiting the orb.
        dustAngSpd[i]  = (Math.random() < 0.5 ? -1 : 1) * (0.35 + Math.random() * 0.85);
        dustOutSpd[i]  = 0.05 + Math.random() * 0.10;
        dustMaxLife[i] = 2.5 + Math.random() * 2.5;
        // Reset history to orb (all zeros) so the freshly-spawned trail starts
        // at the orb instead of from the previous death position.
        const hBase = i * TRAIL_PTS * 3;
        for (let j = 0; j < TRAIL_PTS * 3; j++) dustHistory[hBase + j] = 0;
        dustHistIdx[i] = 0;
      };

      for (let i = 0; i < DUST_COUNT; i++) {
        _resetParticle(i);
        // Stagger initial lives so the swarm isn't in lockstep.
        dustLife[i] = Math.random() * dustMaxLife[i];
      }

      // LineBasicMaterial: thin streaks. vertexColors lets us fade each
      // segment from head (bright) to tail (transparent) and modulate by
      // life. Additive blending makes overlapping trails glow brighter.
      const dustMat = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const fairyDust = new THREE.LineSegments(dustGeom, dustMat);
      angel.add(fairyDust);

      const sphereMeshes = [];
      // Phase 04 (ALMA) orb day colour. Night uses the brand glowCol
      // (turquoise phosphor of strontium aluminate); day swaps to a NEAR-
      // WHITE cream tint (#FFF6E4) so the orb reads as a brilliant sun-
      // sphere against the warm temple light — matching the reference
      // image where the orb is essentially blown out at the centre with
      // only a faint warm halo at the perimeter. Brighter, whiter colour
      // + higher day-intensity scalar below ( phase04OrbScalar ) together
      // reproduce that "solar core" look. `orbColorWork` is the scratch
      // target the animate loop writes into and then copies onto the orb
      // emissive + sphereLight each frame.
      const dayOrbCol = new THREE.Color(0xfff6e4);
      const orbColorWork = new THREE.Color();

      stateRef.current.materials = {
        rim, sphereLight, sphereMeshes, smokeShadowPlane,
        fairyDust, dustAxis, dustInitDir, dustAngSpd, dustOutSpd,
        dustLife, dustMaxLife, dustHistory, dustHistIdx, dustColors,
        glowCol, dayOrbCol, orbColorWork,
        DUST_COUNT, TRAIL_PTS, TRAIL_SEGS, _resetParticle,
      };

      let modelLoaded = false;
      getLoader(renderer).load(
        MODEL_URL,
        (gltf) => {
          if (disposed) return;
          const model = gltf.scene;

          // CAD source is Z-up; Three.js is Y-up. Rotate the model so the
          // angel stands vertical with the head pointing along +Y.
          model.rotation.x = -Math.PI / 2;
          model.updateMatrixWorld(true);

          // First pass: weld coincident vertices with a tight tolerance, then
          // compute smooth vertex normals. Welding tight (1e-4 in CAD units)
          // shares vertices across triangles within the same feather surface
          // so shading is smooth there, but does not collapse vertices across
          // adjacent feather shells (they are several units apart).
          const meshInfos = [];
          const weldFn = window.mergeVerticesFn;
          model.traverse((o) => {
            if (o.isMesh && o.geometry) {
              if (weldFn) {
                try {
                  o.geometry = weldFn(o.geometry, 1e-4);
                } catch (e) {
                  // ignore; fall back to whatever was loaded
                }
              }
              o.geometry.computeVertexNormals();
              o.geometry.normalizeNormals();
              o.geometry.computeBoundingBox();
              const bb = o.geometry.boundingBox.clone();
              // Convert to world bbox for the un-scaled model
              bb.applyMatrix4(o.matrixWorld);
              const sz = new THREE.Vector3();
              bb.getSize(sz);
              const ctr = new THREE.Vector3();
              bb.getCenter(ctr);
              meshInfos.push({ mesh: o, sizeV: sz, center: ctr, maxDim: Math.max(sz.x, sz.y, sz.z), minDim: Math.max(1e-9, Math.min(sz.x, sz.y, sz.z)) });
            }
          });

          // Overall extent → reference for "small" meshes
          const globalSize = Math.max(
            ...meshInfos.flatMap(m => [m.sizeV.x, m.sizeV.y, m.sizeV.z]),
          );
          const goldWarm = buildGoldMaterial(THREE, 'warm');
          const goldBright = buildGoldMaterial(THREE, 'bright');
          const orbMat = buildOrbMaterial(THREE);
          // Track gold materials so the phase 02 (ORIGEN) animate loop can
          // walk down their envMapIntensity. The gold is `metalness: 1.0`, so
          // its visible color comes almost entirely from the env map — dimming
          // the direct lights alone does NOT darken the wing/body surface.
          // Without this hook the wings stay bright-gold even with phaseSun
          // backlighting, instead of reading as the dark silhouette the
          // Laguna Negra reference photo shows.
          stateRef.current.materials.goldMaterials = [
            { mat: goldWarm,   baseEnv: 1.6 },
            { mat: goldBright, baseEnv: 1.8 },
          ];

          // Detect the "plato" sphere by perfect cubic bbox (aspect very close
          // to 1) and a size that's a small-but-visible fraction of the model.
          // Anything with aspect > 1.2 is probably the head/wing/body, not the
          // ball. Triangle-count threshold rejects tiny anchor placeholders.
          //
          // Group43989 is a small square element the CAD designer placed at
          // the base of the wings on the back of the angel — it IS part of
          // the design (visible as the small frame between the lower wing
          // tips in the reference render). It must remain visible exactly
          // as authored. Do NOT replace its geometry or hide it.
          let idx = 0;
          let sphereCenter = null;
          const centerBodyMeshes = [];
          meshInfos.forEach(({ mesh, maxDim, minDim, center }) => {
            const aspect = maxDim / minDim;
            const sizeFrac = maxDim / globalSize;
            const triCount = mesh.geometry.index
              ? mesh.geometry.index.count / 3
              : mesh.geometry.attributes.position.count / 3;

            // Tiny anchor placeholders (almost no triangles, and NOT the
            // back-bracket square that's part of the design) get hidden.
            if (triCount < 50 && mesh.name !== 'Group43989') {
              mesh.visible = false;
              return;
            }

            const isSphere = aspect < 1.2 && sizeFrac > 0.10 && sizeFrac < 0.25 && triCount > 200;
            if (isSphere) {
              mesh.material = orbMat;
              sphereMeshes.push(mesh);
              sphereCenter = center;
            } else {
              const tone = (idx++ % 5 === 0) ? 'bright' : 'warm';
              mesh.material = (tone === 'bright') ? goldBright : goldWarm;
              // Track the center angel's BODY meshes (+ their warm/bright tone)
              // so the EDICIÓN finale can re-skin them gold→rhodium→silver on
              // each completed revolution.
              centerBodyMeshes.push({ mesh, tone });
            }
            // Cast & receive shadows so phase01Spot can throw the hand's
            // shadow onto the orb (and the body onto the smoke catcher
            // plane behind). Other lights have castShadow=false, so no
            // shadow contribution in other phases — this is essentially
            // free for them.
            mesh.castShadow = true;
            mesh.receiveShadow = true;
          });

          // Scale to fit the on-screen frame, then center at origin.
          const box = new THREE.Box3().setFromObject(model);
          const size = new THREE.Vector3();
          box.getSize(size);
          const maxDim = Math.max(size.x, size.y, size.z) || 1;
          const targetSize = 2.0;
          const scaleFactor = targetSize / maxDim;
          model.scale.setScalar(scaleFactor);

          const box2 = new THREE.Box3().setFromObject(model);
          const center = new THREE.Vector3();
          box2.getCenter(center);
          model.position.sub(center);

          // Position the inner light at the (now scaled + centered) sphere.
          if (sphereCenter) {
            // sphereCenter is in pre-scale/pre-translate world coords. After
            // the scale/translate above the sphere ends up at:
            //   (sphereCenter * scaleFactor) - center
            const p = sphereCenter.clone().multiplyScalar(scaleFactor).sub(center);
            sphereLight.position.copy(p);
            // Save the orb's angel-local Y for mobile phase-01 centering —
            // the orb is the angel's focal point (bright, eye-catching), so
            // placing it at the camera's lookAt (world Y=0) gives the
            // perceptually-centered composition the user wants.
            stateRef.current.orbLocalY = p.y;
            // Anchor the fairy dust at the orb's local position so the
            // particles drift around the sphere instead of around angel root.
            if (stateRef.current.materials.fairyDust) {
              stateRef.current.materials.fairyDust.position.copy(p);
            }
          }

          // Wrap the central model in a dedicated spinner Group so we can
          // apply a continuous Y-axis spin during phase 03 WITHOUT carrying
          // the side angels along (they're siblings of centerSpinner under
          // `angel`, so they keep their own independent rotation). Outside
          // phase 03 centerSpinner.rotation.y stays at 0 → identical to the
          // previous `angel.add(model)` setup.
          const centerSpinner = new THREE.Group();
          centerSpinner.add(model);
          angel.add(centerSpinner);
          // Re-parent the orb's inner PointLight (and its fairy-dust trails)
          // from `angel` onto `centerSpinner` so they ROTATE + SCALE with the
          // orb. The light was added to `angel` before the spinner existed; in
          // spinning phases (03 MATERIA and 05 EDICIÓN) the orb mesh orbits the
          // Y axis inside the spinner while the light stayed put on `angel` →
          // the glow centre visibly lagged the sphere ("off-centre"). Its local
          // position `p` was set relative to the centred model, which is exactly
          // centerSpinner-local space, and the spinner is identity at rest, so
          // re-parenting introduces no jump — it only makes the glow track the
          // orb through rotation and the MATERIA/ALMA scale.
          if (stateRef.current.materials && stateRef.current.materials.sphereLight) {
            centerSpinner.add(stateRef.current.materials.sphereLight);
          }
          if (stateRef.current.materials && stateRef.current.materials.fairyDust) {
            centerSpinner.add(stateRef.current.materials.fairyDust);
          }
          stateRef.current.materials.centerSpinner = centerSpinner;
          // EDICIÓN finale material cycling: the center body meshes + the metal
          // material sets, so the animate loop can re-skin the angel
          // gold→rhodium→silver on each completed revolution. Silver/rhodium are
          // added to `metalSets` further down (built inside the side-angels IIFE
          // with their cool env map).
          stateRef.current.materials.centerBodyMeshes = centerBodyMeshes;
          stateRef.current.materials.metalSets = {
            gold: { warm: goldWarm, bright: goldBright },
          };

          // ===== Phase 03 (MATERIA) side angels =====
          // The center "gold" angel above is the one the user already sees in
          // phases 01-02. For phase 03 (MATERIA, range [0.40, 0.60]) we add
          // two MIRROR clones — left in silver, right in rhodium — so the
          // user can read all three finish variants at the same time. Outside
          // phase 03 they're scaled to 0 (literally not rendered).
          //
          // Implementation: .clone(true) shares geometry between original and
          // clones (saves GPU memory), but materials are JUST REFERENCES at
          // first. We re-traverse each clone and REASSIGN per-mesh materials
          // (silver/rhodium for body, orb for the inner sphere). Each clone
          // is wrapped in its own Group so the animate loop can multiply its
          // scale by phase03Proximity without touching the geometry transform.
          (function spawnMateriaSideAngels() {
            const applyMaterialsToClone = (clonedModel, matSet) => {
              // Re-run the same orb-detection criteria the original used so
              // the clones identify the same sphere meshes (identical geom →
              // identical aspect/sizeFrac → identical classification).
              const cMeshInfos = [];
              clonedModel.traverse((o) => {
                if (!o.isMesh || !o.geometry) return;
                if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
                const cbb = o.geometry.boundingBox.clone();
                cbb.applyMatrix4(o.matrixWorld);
                const csz = new THREE.Vector3();
                cbb.getSize(csz);
                cMeshInfos.push({
                  mesh: o,
                  maxDim: Math.max(csz.x, csz.y, csz.z),
                  minDim: Math.max(1e-9, Math.min(csz.x, csz.y, csz.z)),
                  sizeV: csz,
                });
              });
              const cGlobalSize = Math.max(
                ...cMeshInfos.flatMap(m => [m.sizeV.x, m.sizeV.y, m.sizeV.z]),
              );
              let cidx = 0;
              cMeshInfos.forEach(({ mesh, maxDim, minDim }) => {
                const aspect = maxDim / minDim;
                const sizeFrac = maxDim / cGlobalSize;
                const triCount = mesh.geometry.index
                  ? mesh.geometry.index.count / 3
                  : mesh.geometry.attributes.position.count / 3;
                if (triCount < 50 && mesh.name !== 'Group43989') {
                  mesh.visible = false;
                  return;
                }
                const isSphere = aspect < 1.2 && sizeFrac > 0.10 && sizeFrac < 0.25 && triCount > 200;
                if (isSphere) {
                  // Each clone gets its OWN orb material instance so the
                  // glow color setter only mutates the center angel's orb.
                  mesh.material = buildOrbMaterial(THREE);
                } else {
                  mesh.material = (cidx++ % 5 === 0) ? matSet.bright : matSet.warm;
                }
                mesh.castShadow = true;
                mesh.receiveShadow = true;
              });
            };

            const silverWarm   = buildSilverMaterial(THREE, 'warm');
            const silverBright = buildSilverMaterial(THREE, 'bright');
            const rhodiumWarm   = buildRhodiumMaterial(THREE, 'warm');
            const rhodiumBright = buildRhodiumMaterial(THREE, 'bright');

            // The scene's `environment` is an amber/warm studio map tuned for
            // the central GOLD angel. Silver and rhodium at metalness=1.0
            // reflect nearly 100% of the env, so a warm env makes both read as
            // bronze. Build a dedicated COOL/neutral env (cool greys, no
            // amber, a bright cool accent) and assign it via `material.envMap`
            // — Three.js samples material.envMap in preference to
            // scene.environment when both are present, so this override is
            // per-material without leaking onto the gold center. PMREM-
            // prefiltered like the scene env. ONE env map shared between
            // silver + rhodium → 1 cube generation + 1 PMREM pass amortised
            // across both metals. Rhodium uses the SAME cool env but its own
            // material params are tuned cooler/brighter (color #fbfcff vs
            // silver's #f3f4f1, roughness 0.05 vs 0.18, envMapIntensity 1.85
            // vs 1.55) so it reads as "platinum white / ice white" while
            // silver reads as slightly warmer grey — matches the real-world
            // hierarchy where rhodium plating (70-80% reflectivity) is the
            // whitest, most mirror-like of the three finishes and silver
            // (~40% in its natural matte state) sits a half-step warmer.
            const coolMetalEnv = buildStudioEnvMap(THREE, renderer, {
              warm:   '#c0c8d2', // cool light grey-blue replacing the amber side
              cool:   '#2a313c', // deeper cool grey for shadow side
              accent: '#e6ecf2', // bright cool white highlight
              top:    '#1e2230', // cool dark sky
              floor:  '#080a0e', // very dark cool floor
            });
            silverWarm.envMap    = coolMetalEnv;
            silverBright.envMap  = coolMetalEnv;
            rhodiumWarm.envMap   = coolMetalEnv;
            rhodiumBright.envMap = coolMetalEnv;
            silverWarm.needsUpdate    = true;
            silverBright.needsUpdate  = true;
            rhodiumWarm.needsUpdate   = true;
            rhodiumBright.needsUpdate = true;
            // EDICIÓN finale material cycle needs its OWN silver/rhodium
            // instances. The side-angel materials above are driven TRANSPARENT
            // (their .opacity is set to sideOpacity every frame → 0 outside
            // MATERIA), so reusing them rendered the finale angel as a ghost.
            // Build dedicated, fully-opaque copies that share the exact same
            // look + cool env map as the section-03 finishes.
            const edSilverWarm    = buildSilverMaterial(THREE, 'warm');
            const edSilverBright  = buildSilverMaterial(THREE, 'bright');
            const edRhodiumWarm   = buildRhodiumMaterial(THREE, 'warm');
            const edRhodiumBright = buildRhodiumMaterial(THREE, 'bright');
            [edSilverWarm, edSilverBright, edRhodiumWarm, edRhodiumBright].forEach((m) => {
              m.envMap = coolMetalEnv;
              m.needsUpdate = true;
            });
            if (stateRef.current.materials.metalSets) {
              stateRef.current.materials.metalSets.silver  = { warm: edSilverWarm,  bright: edSilverBright };
              stateRef.current.materials.metalSets.rhodium = { warm: edRhodiumWarm, bright: edRhodiumBright };
            }
            // ── EDICIÓN finale: GRADUAL finish cross-fade ────────────────────
            // Instead of hard-swapping the body material once per revolution
            // (which "popped" instantly), the finale now blends gold → rhodium
            // → silver continuously. Two dedicated "live" materials (warm +
            // bright tone) are assigned to the center body only while in phase
            // 05; every frame their color / roughness / metalness /
            // envMapIntensity are lerped between the current and next finish.
            // Env map can't be blended, so it swaps at the transition midpoint
            // (blend≈0.5, where color is halfway and the reflection change is
            // least noticeable): gold → scene.environment (warm), silver +
            // rhodium → coolMetalEnv. Snapshots are taken at setup so ORIGEN's
            // runtime envMapIntensity walk on the originals never leaks in.
            const snapFinish = (m, cool) => ({
              color: m.color.clone(),
              roughness: m.roughness,
              metalness: m.metalness,
              env: m.envMapIntensity,
              cool,
            });
            stateRef.current.materials.coolMetalEnv = coolMetalEnv;
            stateRef.current.materials.editionLive = {
              warm:   goldWarm.clone(),
              bright: goldBright.clone(),
            };
            stateRef.current.materials.editionFinishes = {
              warm: {
                gold:    snapFinish(goldWarm, false),
                rhodium: snapFinish(edRhodiumWarm, true),
                silver:  snapFinish(edSilverWarm, true),
              },
              bright: {
                gold:    snapFinish(goldBright, false),
                rhodium: snapFinish(edRhodiumBright, true),
                silver:  snapFinish(edSilverBright, true),
              },
            };

            const modelLeft = model.clone(true);
            applyMaterialsToClone(modelLeft, { warm: silverWarm, bright: silverBright });
            const modelRight = model.clone(true);
            applyMaterialsToClone(modelRight, { warm: rhodiumWarm, bright: rhodiumBright });

            // Collect the unique materials owned by each side clone (warm + bright
            // body + per-mesh orb instances) so the animate loop can drive their
            // .opacity from phase03Proximity. The user explicitly asked for a
            // fade-in instead of the previous scale-from-zero "pop" — we keep the
            // side groups at constant TRIO_SCALE and only animate alpha. Each
            // material gets `transparent: true` so opacity actually takes effect;
            // without that flag Three.js ignores opacity on MeshStandardMaterial.
            const collectMaterials = (root) => {
              const seen = new Set();
              root.traverse((o) => {
                if (!o.isMesh || !o.material) return;
                if (seen.has(o.material)) return;
                seen.add(o.material);
                o.material.transparent = true;
              });
              return Array.from(seen);
            };
            const leftMaterials  = collectMaterials(modelLeft);
            const rightMaterials = collectMaterials(modelRight);

            // Wrap each clone in a Group so we can scale 0→1 with
            // phase03Proximity without touching the model's own scale (which
            // encodes the fitting transform set above).
            //
            // X offset (±0.7): tight inward spacing so the lateral wings
            // OVERLAP the central angel's wings — reads as "two figures
            // standing right next to" the gold center, not "a row of three".
            // Z offset (0): the THREE angels are COPLANAR. Earlier this was
            // +1.0 (pushing the laterals forward to "flank" the viewer), but
            // the trio is also shifted RIGHT in world space by px03Shift to
            // fill the empty space next to the text column — while the camera
            // keeps looking at world (0,0,0). With the laterals at z=+1.0
            // that off-axis perspective made the right-side gap project ~61%
            // wider than the left-side gap (uneven distances from the central
            // angel). Coplanar (z=0) guarantees that left and right project
            // at the same screen-space distance from the central angel at
            // any spin angle. Each lateral also scales down by 30% during
            // phase 03 (applied in the animate loop).
            //
            // The Y offset that lifts each lateral so its head sits BETWEEN
            // the central angel's head and orb is applied AFTER the
            // visible-bbox cache below (needs modelBboxY + orbLocalY,
            // computed there).
            // Side groups start INVISIBLE (Object3D.visible=false skips the entire
            // subtree from rendering). The animate loop flips visible=true and
            // drives material.opacity from phase03Proximity. Scale stays at the
            // final TRIO_SCALE (0.7) — no zoom-in animation, only alpha. This is
            // the change the user asked for: "que ahí aparezca el fade in sin la
            // necesidad de mover la posición XYZ."
            const groupLeft  = new THREE.Group();
            groupLeft.add(modelLeft);
            groupLeft.position.set(-0.7, 0, 0);
            groupLeft.visible = false;

            const groupRight = new THREE.Group();
            groupRight.add(modelRight);
            groupRight.position.set(0.7, 0, 0);
            groupRight.visible = false;

            angel.add(groupLeft);
            angel.add(groupRight);
            stateRef.current.materials.materiaSideGroups = { left: groupLeft, right: groupRight };
            stateRef.current.materials.materiaSideMaterials = { left: leftMaterials, right: rightMaterials };
          })();

          modelLoaded = true;
          // Cache the model's VISIBLE vertical bbox midpoint in angel-local
          // frame, used by the mobile-phase-01 framing block to center the
          // angel at the camera's lookAt point. Box3.setFromObject includes
          // hidden meshes (the small anchor placeholders flagged
          // visible=false earlier), inflating the bbox symmetrically to
          // ±1.0 while the actual visible angel is asymmetric (wings reach
          // ~+0.81, feet ~-1.00). Traverse + filter to use only the meshes
          // the user can see.
          {
            const _savedY = angel.position.y;
            angel.position.y = 0;
            angel.updateMatrixWorld(true);
            const _bbox = new THREE.Box3();
            model.traverse((o) => {
              if (!o.isMesh || !o.visible || !o.geometry) return;
              if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
              const _b = o.geometry.boundingBox.clone();
              _b.applyMatrix4(o.matrixWorld);
              _bbox.union(_b);
            });
            stateRef.current.modelCenterY = (_bbox.min.y + _bbox.max.y) / 2;
            stateRef.current.modelBboxY = { min: _bbox.min.y, max: _bbox.max.y };
            // Cache ALL visible mesh vertices in angel-local frame. The
            // render loop applies the current angel rotation, projects with
            // the live camera, and finds the perspective-corrected screen-
            // space Y extremes. Bbox corners alone aren't enough because
            // the corner (xMax, yMax, zMin) is often a void area outside
            // the actual geometry — the real wing tip lives at some other
            // point inside the bbox. Iterating real vertices guarantees we
            // find true extremes. Total ~30 k floats = 360 KB; per-frame
            // iteration of ~30 k verts is well under 1 ms on modern CPUs.
            const _verts = [];
            const _v = new THREE.Vector3();
            model.traverse((o) => {
              if (!o.isMesh || !o.visible || !o.geometry) return;
              const pos = o.geometry.attributes.position;
              if (!pos) return;
              for (let i = 0; i < pos.count; i++) {
                _v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
                _verts.push(_v.x, _v.y, _v.z);
              }
            });
            stateRef.current.modelVerts = new Float32Array(_verts);
            angel.position.y = _savedY;
            // Debug
            window.__elyxie_debug = window.__elyxie_debug || {};
            window.__elyxie_debug.modelCenterY = stateRef.current.modelCenterY;
            window.__elyxie_debug.modelBboxY = stateRef.current.modelBboxY;
            window.__elyxie_debug.vertCount = _verts.length / 3;
          }

          // ===== Phase 03 (MATERIA) trio Y offset =====
          // Compose the three angels as a triangle: central angel up, the
          // two laterals dropped enough to read as "below" the central but
          // not so far that they sink out of the frame. The reference drop
          // (DROP_FACTOR=1.0) would land each lateral's head at the height
          // of the central angel's ORB. We use 0.5 instead, lifting the
          // laterals 50% — their heads land BETWEEN the central head and
          // the central orb, which keeps the triangle tight without
          // sinking the laterals visually.
          //
          //   DROP_FACTOR = 0   → laterals at the same height as central
          //                       (no triangle, all heads aligned)
          //   DROP_FACTOR = 0.5 → heads land between central head and orb
          //                       (current — tight triangle, laterals high)
          //   DROP_FACTOR = 1.0 → heads land at the central orb's height
          //                       (deep drop)
          // HEAD_BELOW_TOP is how far below the wing tips the head crown
          // sits (modelBboxY.max is the wing tip). Lower → head higher.
          {
            const matSidesInit = stateRef.current.materials && stateRef.current.materials.materiaSideGroups;
            const orbY  = stateRef.current.orbLocalY;
            const bboxY = stateRef.current.modelBboxY;
            if (matSidesInit && orbY !== undefined && bboxY) {
              const HEAD_BELOW_TOP = 0.18;
              const DROP_FACTOR    = 0.5;
              const headLocalY  = bboxY.max - HEAD_BELOW_TOP;
              const sideYOffset = (orbY - headLocalY) * DROP_FACTOR;
              matSidesInit.left.position.y  = sideYOffset;
              matSidesInit.right.position.y = sideYOffset;
              window.__elyxie_debug = window.__elyxie_debug || {};
              window.__elyxie_debug.materiaSideYOffset = sideYOffset;
            }
          }

          // The angel is now built, materialed, scaled, centered and added to
          // the live scene. Wait for TWO animation frames so the render loop
          // has actually PAINTED at least one frame containing the model, then
          // announce readiness. The splash overlay (index.html) listens for
          // this and only fades out once the angel is genuinely on screen —
          // never before — so the page is never revealed empty mid-load.
          requestAnimationFrame(() => requestAnimationFrame(() => {
            window.__angelReady = true;
            window.dispatchEvent(new CustomEvent('angel-progress', { detail: 1 }));
            window.dispatchEvent(new Event('angel-ready'));
          }));
        },
        // onProgress: GLTFLoader forwards the underlying fetch ProgressEvent.
        // When the server sends Content-Length the event is lengthComputable
        // and we can report a true 0..1 fraction; otherwise we report -1 so
        // the splash falls back to its own time-based creep.
        (evt) => {
          const frac = (evt && evt.lengthComputable && evt.total > 0)
            ? evt.loaded / evt.total
            : -1;
          window.dispatchEvent(new CustomEvent('angel-progress', { detail: frac }));
        },
        (err) => {
          console.error('Failed to load angel GLB:', err);
          // Release the splash even on failure so the page is never stuck
          // permanently behind the loader.
          window.__angelReady = true;
          window.dispatchEvent(new Event('angel-ready'));
        },
      );

      let raf = 0;
      let lastT = performance.now();
      const clock = { elapsed: 0 };
      const _projVec = new THREE.Vector3();
      // Trail sampling accumulator — write a new history slot every
      // DUST_SAMPLE_INTERVAL seconds so trails span more time/distance
      // than a single 60fps frame would allow.
      let dustSampleAccum = 0;
      const DUST_SAMPLE_INTERVAL = 0.05;

      // ---- Perf gates ----
      // Pause the render loop when the hero is off-screen (IntersectionObserver)
      // OR when the tab is hidden (Page Visibility). On a long page this
      // returns 30-50% of a CPU core to the browser once the user has scrolled
      // past the hero. Resumed cleanly when conditions reverse.
      let visible = true;
      let tabVisible = !document.hidden;
      // FPS cap: 60 Hz is the perceptual ceiling for the orbital motion + scroll
      // sync. On 120/144 Hz displays the loop would otherwise run at 2-2.4× the
      // necessary rate. Frame interval = 1/60 sec, with a small slack to absorb
      // jitter without dropping otherwise-on-time frames.
      const FRAME_INTERVAL = 1000 / 60;
      let lastFrameTime = 0;
      // --angel-x throttle: only publish the CSS var when the value moved
      // > 0.4% from the last write. The CSS layers consuming it (.hero-smoke
      // mask) only fade in during phase 01 anyway, so sub-pixel updates do
      // nothing visually but force a mask rasterisation each frame.
      let lastAngelXWrite = -999;
      // --alma-day-mix throttle: 0..1 cross-fade for the ALMA day-mode UI
      // recoloring. Driven by phase04DayF = phase04Proximity * (1 - almaNightF)
      // so it follows BOTH scroll position and the day/night toggle in one
      // value, perfectly synced with the temple background cross-fade.
      let lastAlmaDayMixWrite = -1;

      function animate(now) {
        raf = requestAnimationFrame(animate);
        // 60 Hz cap. Skip the frame entirely if we are early.
        if (now - lastFrameTime < FRAME_INTERVAL - 1) return;
        lastFrameTime = now;

        const dt = Math.min((now - lastT) / 1000, 0.1); // clamp to 100ms to absorb tab-switch gaps
        lastT = now;
        clock.elapsed += dt;

        const tRaw = clamp(stateRef.current.progress, 0, 1);
        const tEase = easeInOut(tRaw);

        const phaseSoulProximity = Math.exp(-Math.pow((tRaw - 0.63) / 0.12, 2));
        // Phase 04 (ALMA, scroll range 0.60-0.80) proximity. Peaks at the
        // middle of the range (tRaw=0.70). Same σ shape as ORIGEN/MATERIA
        // so phase boundaries don't leak: at tRaw=0.50 (MATERIA anchor)
        // this resolves to ≈exp(-7.1)≈0.0008 — well below the visibility
        // threshold. Used to gate the orb day/night brightness multiplier
        // and the second fairy-dust visibility window introduced for ALMA.
        const phase04Proximity = Math.exp(-Math.pow((tRaw - 0.70) / 0.075, 2));
        // Phase 05 (EDICIÓN) finale ramp — MONOTONIC, not a gaussian. The
        // journey's last two snap points are 0.90 AND 1.00 (SNAP_POINTS in
        // app.jsx), so the angel must be FULLY receded at BOTH rest positions,
        // not just at 1.00. A gaussian centered on 1.00 would only reach ≈0.21
        // at the 0.90 snap, leaving the angel large and centered there (text
        // would collide with it). Instead ramp 0→1 across [0.82, 0.90] via
        // smootherstep (quintic — zero 1st/2nd derivative at the ends) and HOLD
        // at 1 through 1.00. smootherstep clamps its input, so tRaw≥0.90 → 1
        // and tRaw≤0.82 → 0. ALMA (phase 04, center 0.70) stays byte-perfect:
        // its own phase04Proximity is already ≈0.018 by tRaw=0.85, and this
        // ramp is exactly 0 for tRaw≤0.82 — so the recede never disturbs ALMA's
        // rest composition.
        const phase05Proximity = smootherstep((tRaw - 0.82) / 0.08);
        // Smooth-lerp the actual night factor toward the target set by
        // app.jsx (boolean flipped every 5 s). τ ≈ 0.55 s feels in sync
        // with the 1.1 s CSS cross-fade on the temple backdrop.
        {
          const target = stateRef.current.almaNightTarget || 0;
          const tau = 0.55;
          const k = 1 - Math.exp(-dt / tau);
          stateRef.current.almaNightActual += (target - stateRef.current.almaNightActual) * k;
        }
        const almaNightF = stateRef.current.almaNightActual;
        // ORIGEN is now the OPENER (slot 01). Its proximity peaks at tRaw=0 so
        // all ORIGEN overrides (Laguna Negra backdrop, sun rig, -30° rotation,
        // far framing camZ→6.9, centred angel) bloom at the very start, and
        // decay to ≈0 by tRaw≈0.18 — well before BIENVENIDA's peak at 0.29 and
        // MATERIA at 0.50, so neither leaks.
        const phaseOriginProximity = Math.exp(-Math.pow(tRaw / 0.075, 2));
        // BIENVENIDA moved to slot 02, peaking at tRaw=0.29. Gates its
        // phase-specific nudges (angel pushed right so the headline owns the
        // left half, teal vignette + smoke, overhead spot). ≈0 at the ORIGEN
        // opener (tRaw=0 → exp(-13)≈2e-6) and at MATERIA (0.50), so it stays
        // contained to its new mid-position.
        const phase01Proximity = Math.exp(-Math.pow((tRaw - 0.29) / 0.08, 2));

        // Phase 03 (MATERIA, scroll range 0.40–0.60) proximity. Peaks at the
        // middle of the range (tRaw=0.50) with the same σ as phase 02 so the
        // ramp shape feels consistent. Gates: (a) the visibility of the
        // silver/rhodium SIDE ANGELS (scale 0→1) and (b) a camera pull-back
        // so all three finishes fit comfortably in frame. At tRaw=0.29 this
        // resolves to ≈0.001 — ORIGEN anchor stays effectively byte-perfect.
        // At tRaw=0.70 same story for the SOUL anchor.
        const phase03Proximity = Math.exp(-Math.pow((tRaw - 0.50) / 0.075, 2));

        // Face close-up PLATEAU PULSE — peaks BETWEEN phase 01 and phase 02 so
        // the camera dives in for a face detail beat before pulling back to
        // the Laguna Negra wide shot. Previously a pure gaussian (σ=0.065)
        // which touched its peak for a single instant; the user reported the
        // closing "didn't pause" at maximum. Replaced with a smootherstep-
        // edged trapezoidal pulse that RAMPS UP, HOLDS at 1, then RAMPS DOWN:
        //   • [0.000 → 0.115]  rise via smootherstep (quintic)
        //   • [0.115 → 0.155]  HOLD at 1.0   ← the "stop at max closing" beat
        //   • [0.155 → 0.290]  fall via smootherstep (quintic)
        // Drives camZ dip, lookAt target tracking, and the rotation release.
        // Anchors stay byte-perfect: faceCloseup === 0 exactly at tRaw=0 and
        // tRaw=0.29 (no gaussian tail leaking into ORIGEN or BIENVENIDA).
        // Smootherstep zeros 1st AND 2nd derivative at the edges → no
        // perceptible "kink" as the hold begins or ends.
        const CU_HOLD_START = 0.115;
        const CU_HOLD_END   = 0.155;
        const closeupRise = smootherstep(tRaw / CU_HOLD_START);
        const closeupFall = 1 - smootherstep((tRaw - CU_HOLD_END) / (0.29 - CU_HOLD_END));
        const faceCloseup = Math.min(closeupRise, closeupFall);

        // Rotation EASE-IN RELEASE: quartic curve (1 - x⁴) holds the angel
        // near -30° during the early scroll and accelerates sharply near
        // the close-up peak. Target reference points:
        //   tRaw=0.04 (x=0.31): rotation ≈ -29.7° (basically still -30°)
        //   tRaw=0.08 (x=0.62): rotation ≈ -25.6° (small 3/4 view tilt)
        //   tRaw=0.13 (x=1.00): rotation = 0° (fully forward at peak)
        // Anchors byte-perfect: rotHold=1 at tRaw=0, rotHold=0 at tRaw>=0.13.
        const rotX = Math.min(tRaw / 0.13, 1.0);
        const rotHold = 1.0 - rotX * rotX * rotX * rotX;

        // ===== ORIGEN opener self-spin =====
        // ORIGEN is now slot 01 (the opener at tRaw=0). The user asked for the
        // angel to rotate continuously on its OWN Y axis toward the viewer's
        // RIGHT — i.e. the chest/front sweeps rightward — STARTING from its
        // current initial pose (-30°). Positive rotation.y turns a +Z (front)
        // point toward +X (screen right), the same "to the right" convention
        // the EDICIÓN finale spin already uses, so the motion reads rightward.
        //
        // Mechanics mirror the MATERIA trio spin: accumulate an angle while
        // ORIGEN is in frame, gate it by phaseOriginProximity, and HARD-RESET
        // it the instant ORIGEN leaves frame so re-entry always restarts from
        // the -30° pose. The accumulated angle is wrapped to its shortest
        // equivalent in [-π, π] BEFORE the proximity multiply, so scrolling
        // away un-winds along the short path back to forward instead of
        // counter-spinning through every revolution the user watched.
        //   • first paint (tRaw=0, spin=0, prox=1): rotation.y = -30° exactly
        //     → the "posición inicial" the user wants to start from;
        //   • ORIGEN dwell: spin accumulates at ~0.25 rad/s (~one turn / 25 s,
        //     a slow meditative rotation) → the angel turns to its right;
        //   • toward BIENVENIDA (slot 02): both rotHold and phaseOriginProximity
        //     collapse to 0 well before its 0.29 peak, so the angel resolves to
        //     forward and BIENVENIDA / MATERIA / ALMA / EDICIÓN stay byte-perfect.
        const ORIGIN_SPIN_OFF = 0.001;
        if (phaseOriginProximity < ORIGIN_SPIN_OFF) {
          stateRef.current.originSpinAngle = 0;
        } else {
          stateRef.current.originSpinAngle =
            (stateRef.current.originSpinAngle || 0) + dt * 0.25 * phaseOriginProximity;
        }
        let originSpin = 0;
        {
          const TWO_PI = Math.PI * 2;
          let wrapped = (stateRef.current.originSpinAngle || 0) % TWO_PI;
          if (wrapped > Math.PI) wrapped -= TWO_PI;
          else if (wrapped < -Math.PI) wrapped += TWO_PI;
          originSpin = wrapped * phaseOriginProximity;
        }

        if (window.__debugFreezeY !== undefined) {
          angel.rotation.y = window.__debugFreezeY;
          angel.rotation.x = 0;
          angel.rotation.z = 0;
        } else {
          // BIENVENIDA (slot 02) keeps the original -30°→0° hold-and-release via
          // rotHold (anchored at tRaw=0, resolved by 0.13). ORIGEN (slot 01)
          // ADDS the continuous self-spin on top of the same -30° base. Both
          // terms are ≈1 at tRaw=0 and ≈0 by BIENVENIDA's peak, so they don't
          // fight: at the opener the spin dominates; by BIENVENIDA both collapse
          // to 0 (forward).
          angel.rotation.y = -(Math.PI / 6) * rotHold + originSpin;
          angel.rotation.x = 0;
          angel.rotation.z = 0;
        }
        // Keep debug freeze hook so we can verify back/side views via JS

        // ===== Responsive framing =====
        // Desktop: text sits on the LEFT half, so push the angel toward the
        // right (px ~0.45–0.65 world units). On tablet the text column is
        // narrower so we ease the angel back toward center. On mobile the
        // text is centered above the angel, so we center the model
        // horizontally and drop it lower in the frame.
        const vw = container.clientWidth || window.innerWidth;
        const aspect = (container.clientWidth || 1) / (container.clientHeight || 1);
        const isMobile = vw <= 767;
        const isTablet = vw > 767 && vw <= 1024;

        let pxBase, pyOffset, camZBase;
        if (isMobile) {
          pxBase = 0;                 // center horizontally
          pyOffset = -0.55;           // sit below the centered hero copy
          camZBase = 4.6;             // pull camera back a touch for portrait
        } else if (isTablet) {
          // Push the angel further right (closer to desktop ratio) so the
          // wings stop colliding with the headline column on the left half.
          // Camera pulled back to 4.2 so the model scales down for the
          // narrower viewport and reads ~50% of the frame width.
          pxBase = lerp(0.65, 0.48, tEase);
          pyOffset = -0.05;
          camZBase = 4.2;
        } else {
          pxBase = lerp(0.65, 0.45, tEase);
          pyOffset = 0;
          camZBase = null;
        }

        // Phase 01 (BIENVENIDA) push the angel further to the right so the
        // headline copy can occupy the left half cleanly — matches the
        // reference. Decays to 0 by phase 02 via phase01Proximity.
        if (!isMobile) {
          // Negative shift = move toward the viewer's LEFT (= toward the
          // angel's own right hand). Aligns the body center with the CSS
          // light beam at ~74% viewport X, which was previously off-axis
          // because the natural pxBase places the angel further right at
          // narrow desktop aspects.
          pxBase += -0.10 * phase01Proximity;
        } else {
          // Mobile phase-01 horizontal trim: the -30° Y rotation projects
          // the angel's anatomical RIGHT wing (viewer's LEFT) slightly
          // larger than the LEFT wing, so the visible wing-tip midpoint
          // sits a hair LEFT of world X=0. Small negative shift balances
          // it. Gated by phase01Proximity → 0 outside phase 01 so phases
          // 02-5 stay byte-perfect.
          pxBase += -0.13 * phase01Proximity;
        }
        // Monotonic centering through the phase 01 → phase 02 transition.
        // smoothstep ramps from 0 at tRaw=0 to 1.0 at tRaw=0.20, so the
        // angel's world X slides smoothly toward 0 across the close-up
        // window instead of decaying with the gaussian. Prevents the
        // rightward "snap back" the user saw between the close-up peak
        // (where lookFaceX tracking briefly centered the figure) and the
        // phase 02 anchor (where phaseOriginProximity finally pulls to
        // center) — the angel now slides MONOTONICALLY from phase 01's
        // right-side pose to phase 02's centered pose.
        const transitionCenterT = Math.max(0, Math.min(1, tRaw / 0.20));
        const transitionCenter = easeInOut(transitionCenterT);
        const pxCentered = lerp(pxBase, 0, transitionCenter);
        // During phase 02 (ORIGEN), pull the angel toward horizontal center so
        // it sits over the Laguna Negra backdrop the way the reference shows
        // (orb on the central axis, wings spreading symmetrically). At
        // tRaw≥0.20 pxCentered is already 0, so this lerp is a no-op there;
        // at tRaw=0 it preserves phase 01 byte-perfect (centerProgress=0).
        const pxOrigin = lerp(pxCentered, 0, phaseOriginProximity);
        // And lift the model so the orb lands at ~47–49% of viewport Y and the
        // feet meet the photo's water line at ~65–70 % Y.
        // ORIGEN vertical framing, per-device:
        //   • Mobile  (+0.30): floats the angel up over the Laguna under the
        //     top-stacked copy.
        //   • Tablet  (-0.05): copy is stacked on top, so a small drop keeps the
        //     wing tips clear of the headline/eyebrow.
        //   • Desktop (-0.10): the headline sits in the LEFT column and the angel
        //     to its right; the user asked for the figure ~10% of the viewport
        //     LOWER than the previous +0.30 lift, so it sits more grounded over
        //     the lake (≈0.40 world units ≈ 10% of the ORIGEN frame height).
        // Gated by phaseOriginProximity → byte-perfect at every other phase.
        const pyOriginShift = (isMobile ? 0.30 : isTablet ? -0.05 : -0.10) * phaseOriginProximity;
        // Phase 01 (BIENVENIDA) depth push: sit the angel slightly further
        // from camera so the smoke that drifts in front feels more wrapping.
        // Decays to 0 outside phase 01. Computed early so the mobile-phase-01
        // centering math (below) can use it together with camZ.
        const pz01 = -0.6 * phase01Proximity;

        // === camera Z (computed BEFORE py so screen-space centering can use it) ===
        let camZ;
        if (tRaw < 0.55) {
          camZ = lerp(3.6, 4.8, easeInOut(tRaw / 0.55));
        } else if (tRaw < 0.72) {
          camZ = lerp(4.8, 3.0, easeInOut((tRaw - 0.55) / 0.17));
        } else {
          camZ = lerp(3.0, 5.8, easeInOut((tRaw - 0.72) / 0.28));
        }
        // Phase 02 (ORIGEN) framing: pull camera back so the angel reads at
        // ~60% of viewport height (wings visible at top, feet meeting the
        // photo's water line), per the reference composite.
        camZ = lerp(camZ, 6.9, phaseOriginProximity);
        // Phase 03 (MATERIA) framing: pull the camera back further so the
        // three-angel triangle (silver | gold | rhodium, laterals at
        // x=±0.7/z=0 and dropped 50% of the way to the central orb)
        // reads at full size. All three shrink to 70% during this phase
        // (see TRIO_SCALE below), so the cluster sits tighter and a bit
        // smaller than the solo central angel of phases 01-02. At the
        // peak (tRaw=0.50, phase03Proximity=1.0) camZ resolves to 9.0.
        camZ = lerp(camZ, 9.0, phase03Proximity);
        // Narrow portrait viewports: vertical FOV is the bottleneck so the
        // model can look oversized. Push the camera back proportionally so
        // the angel sits comfortably inside the frame on phones.
        if (aspect < 0.75) {
          camZ *= (0.75 / Math.max(aspect, 0.45)); // up to ~1.67× pullback on very tall portrait
        } else if (aspect < 1.0) {
          camZ *= 1.12;
        }
        if (camZBase != null && tRaw < 0.55) {
          // On mobile, override the closeup-at-top with a steady framing so
          // the angel doesn't jump forward into the hero copy on first paint.
          camZ = Math.max(camZ, camZBase);
        }
        // Face close-up DIP — applied AFTER the mobile clamp so portrait
        // viewports also dive in. Bell curve peaks at tRaw=0.13 (between
        // phases) and returns to 0 at the phase anchors → byte-perfect at
        // tRaw=0 and tRaw=0.29. Magnitude tuned so the peak landed at
        // ~z=2.4 (face + upper torso in frame, wings spreading off the
        // sides) instead of crushing the angel into the wings.
        camZ -= 1.25 * faceCloseup;
        // Phase 01 mobile extra pullback so the angel fits inside the WELCOME
        // → DESLIZA window without wing tops overlapping the headline. Gated
        // by phase01Proximity → 0 at tRaw≈0.18, leaving phases 02-5 untouched.
        if (isMobile) {
          camZ += 0.9 * phase01Proximity;
        }
        camZ = Math.max(camZ, 2.0);

        // Mobile phase 01 framing — center the ORB (the angel's bright
        // focal point) at the camera's lookAt point. Camera looks at
        // world (0,0,0), so setting angel.position.y = -orbLocalY puts the
        // orb at world Y=0 → exactly at screen center vertically. Rotation
        // around Y doesn't change the orb's Y, so this works regardless of
        // the angel's phase-01 rotation. Gated by phase01Proximity so
        // phases 02-5 remain byte-perfect. Much simpler than vertex-
        // extremes centering (which mis-fired because back-facing wing
        // vertices contribute to the bbox but are occluded visually).
        const py01Mobile = (() => {
          if (!isMobile) return 0;
          const orbY = stateRef.current.orbLocalY;
          if (orbY === undefined) return 0;
          const baselinePy = -0.05 + pyOffset;
          // Drop the orb slightly BELOW world-Y=0 so the angel sits at the
          // visual center of the WELCOME-to-DESLIZA window (which lives below
          // viewport center on portrait mobile because of the top headline).
          const targetPy = -orbY - 0.31;
          const shift = (targetPy - baselinePy) * phase01Proximity;
          if (typeof window !== 'undefined') {
            window.__elyxie_render_debug = { orbY, targetPy, baselinePy, shift, phase01Proximity };
          }
          return shift;
        })();

        // Phase 03 (MATERIA) horizontal shift: at world X=0 the trio lands
        // under the "Tres acabados. Una sola alma." copy because the text
        // column sits on the LEFT half. To center the trio in the empty
        // space between the text and the right-edge progress rail, we
        // shift it right by a fixed FRACTION of the visible world width
        // at z=0 — so the shift scales correctly across viewports (less
        // on mobile portrait, more on wide desktop). Gated by
        // phase03Proximity so phases 01, 02, 04, 05 keep their existing
        // X positioning. Skipped on narrow phones where the CSS layout
        // stacks text ON TOP of the angel (no whitespace to fill).
        const fovRadHalf = (camera.fov * Math.PI) / 180 / 2;
        const worldWidthAtZ0 = 2 * camZ * Math.tan(fovRadHalf) * aspect;
        // Tablet now stacks the hero like mobile (top-centred copy, see the
        // tablet @media .phase-content block in styles.css), so the MATERIA
        // trio must stay CENTRED under that copy instead of shifting right
        // into a (now non-existent) right-hand whitespace column. Desktop
        // keeps the rightward shift to fill the space beside the left copy.
        const px03Shift = (isMobile || isTablet) ? 0 : 0.20 * worldWidthAtZ0;
        // Phase 05 (EDICIÓN) now uses a section-2/3-style layout: copy on the
        // LEFT, angel shifted RIGHT into the empty column (with the rotating
        // sacred-geometry behind it). Same fractional-of-world-width shift as
        // MATERIA so it scales across viewports; gated by phase05Proximity so
        // every other phase is byte-perfect. Skipped on narrow phones where
        // the layout stacks.
        // Only DESKTOP runs the estrella-fija right-column shift. Tablet and
        // mobile stack into a single centred column (angel over the inscription),
        // so they keep the angel on the optical centre line — otherwise it
        // drifts right and breaks alignment with the centred Metatron + copy.
        const px05Shift = (isMobile || isTablet) ? 0 : 0.22 * worldWidthAtZ0;
        // Desktop ORIGEN horizontal framing: the headline owns the LEFT column,
        // so the angel must NOT sit at raw screen-centre — the user wants it
        // centred in the OPEN region between the headline's right edge and the
        // right rail line. That region is NOT a fixed pixel offset: the headline
        // column is `max-width: min(760px, 55%)` with a `5.2vw` font, so on a
        // narrow desktop (~1072px) the text ends ~494px while on a wide one
        // (~1440px) it ends ~664px — a fixed offset over-shoots the angel into
        // the rail on narrow desktops. So MEASURE both edges from the DOM every
        // frame and centre between them; this self-corrects at any width. The
        // headline columns for ORIGEN/BIENVENIDA share the same geometry, so the
        // active title's right edge is the correct left bound. Convert the
        // screen midpoint to a world-X via the visible world width at z=0.
        // Tablet/mobile stack the copy on top (centred angel below) → shift 0.
        // Gated by phaseOriginProximity → byte-perfect at every other phase.
        let pxOriginRightCenter = 0;
        if (!isMobile && !isTablet && phaseOriginProximity > 0.001) {
          const titleEl = document.querySelector('.phase-content[data-active="true"] .phase-title')
                       || document.querySelector('.phase-content .phase-title');
          const railEl = document.querySelector('.rail');
          if (titleEl && railEl) {
            const tr = titleEl.getBoundingClientRect();
            const rr = railEl.getBoundingClientRect();
            if (tr.width > 0 && rr.width > 0 && rr.left > tr.right) {
              const midX = (tr.right + rr.left) / 2;
              const worldShift = (midX - vw / 2) * worldWidthAtZ0 / vw;
              pxOriginRightCenter = worldShift * phaseOriginProximity;
            }
          }
        }
        const px = pxOrigin * (1 - phaseSoulProximity * 0.85)
                 + Math.sin(clock.elapsed * 0.35) * 0.02 * (1 - phase05Proximity * 0.7)
                 + px03Shift * phase03Proximity
                 + px05Shift * phase05Proximity
                 + pxOriginRightCenter;
        // Phase 04 (ALMA) vertical lift. The copy block now sits at the
        // very TOP of the viewport (just under the navbar). Mobile and tablet
        // get a stronger lift so the angel rides up closer to the SOUL eyebrow
        // (the user felt the gap between the copy and the top of the wings was
        // too large on those narrow viewports). Desktop now DROPS the angel
        // slightly (negative shift): on the wide/tall desktop frame the copy
        // block up top was overlapping the bright upper wings, and there was
        // unused space between the feet and the page base. Lowering the angel
        // moves the wings clear of the subtitle and fills that bottom band.
        const pyAlmaShift = (isMobile ? 0.34 : isTablet ? 0.18 : -0.06) * phase04Proximity;
        // EDICIÓN finale lift: raise the (now smaller) angel into the upper
        // third so the inscription below it never collides with the body or the
        // orb. Pairs with editionTargetScale in the centerSpinner block. Gated
        // by phase05Proximity (0 at ALMA → phase 04 untouched).
        // Mobile needs a markedly larger lift: the portrait aspect pulls the
        // camera far back (camZ ×≈1.05 + the phase-01 clamp), so each world
        // unit maps to fewer screen pixels and a 0.78 lift barely clears the
        // viewport centre. 1.05 raises the hem clear of the seal on the short
        // portrait frame.
        //
        // "El registro" finale: the inscription plate grew taller (top rule +
        // 100-mark register), so the lift is eased DOWN a touch (0.73→0.62
        // desktop) to close the dead void between the angel and the plate —
        // the angel and the inscription now read as one composition instead
        // of two elements stranded apart.
        //
        // "Estrella fija" finale (text-left / angel-right): the angel no longer
        // sits ABOVE a centred plate — it sits BESIDE the left copy, so the big
        // upward lift is dropped to near-centre. Desktop keeps a small lift so
        // the orb aligns with the headline's optical centre.
        //
        // Tablet & mobile DON'T have room for the side-by-side split, so they
        // stack into an "altarpiece": the angel rides UP into the top half
        // (framed by the Metatron) and the inscription is bottom-anchored below
        // it (see the edition @media blocks in styles.css). The bigger upward
        // lift here is what opens the clean gap between the figure and the copy.
        // Mobile lift raised 1.15→1.52: on tall portrait phones (aspect ~0.46)
        // the camera pulls way back, so the relic was floating small and low
        // with a big void above it. Lifting it into the upper third — paired with
        // the bigger editionTargetScale + the inscription raised via the mobile
        // @media bottom-padding — turns the two halves into one balanced,
        // centred altarpiece instead of a small figure stranded over text.
        // Tablet/desktop branches unchanged.
        //
        // editionAspectComp sizes + lifts the relic per phone aspect ratio. The
        // relic's on-screen footprint scales with `aspect` (the global camZ
        // pull-back grows as portrait gets taller: camZ *= 0.75/aspect). A fixed
        // lift/scale undersizes it on a tall 430×932 (aspect 0.46 → big void) and
        // oversizes it on a short 375×667 (0.56 → collides with the fixed-height
        // inscription). We don't just neutralise that (÷aspect): tall phones have
        // spare room ABOVE the inscription so the relic SHOULD grow there, while
        // short phones need it to yield. The 1.6 exponent gives that "big on tall,
        // smaller on short" curve, referenced to 0.473 (the user's phone, where it
        // was tuned). Clamp matches the camZ block's Math.max(aspect, 0.45).
        const editionAspectComp = (isMobile && aspect < 0.75)
          ? Math.pow(0.473 / Math.max(aspect, 0.45), 1.6)
          : 1;
        // Lift stays HIGH on every phone (not comp'd): keeping the relic's centre
        // in the upper third means that on short phones the (heavily shrunk, via
        // editionAspectComp) relic's feet ride well ABOVE the tall fixed-height
        // inscription, leaving a clean gap instead of colliding with the eyebrow.
        // Only the SCALE is comp'd below.
        const pyEditionShift = (isMobile ? 1.52 : isTablet ? 0.6 : 0.10) * phase05Proximity;
        const py = -0.05 + pyOffset + pyOriginShift + py01Mobile
                 + pyAlmaShift
                 + pyEditionShift
                 + Math.sin(clock.elapsed * 0.4) * 0.03 * (1 - phase05Proximity * 0.7)
                 + Math.sin(tRaw * Math.PI) * 0.06;
        angel.position.set(px, py, pz01);

        // Phase 03 (MATERIA) side angels: appear via pure ALPHA fade-in at
        // their final position. Previously they scaled from 0 → 0.7 along
        // with phase03Proximity, which felt like a "pop" because nothing was
        // visible until the proximity got past ~10% and then the angels
        // grew quickly into frame. The user asked for "que ahí aparezca el
        // fade in sin la necesidad de mover la posición XYZ" — so we now
        // keep scale CONSTANT at TRIO_SCALE and drive material.opacity from
        // phase03Proximity instead. group.visible gates the entire subtree
        // out of rendering when proximity is essentially 0 (outside the
        // [0.40, 0.60] band) so neither clone costs draw calls there.
        //
        // Continuous slow Y-axis spin for the trio during phase 03. Each of
        // the three wrappers gets the same rotation delta (dt × angVel ×
        // phase03Proximity) so they all turn together at the same rate but
        // each pivots around its OWN local Y axis (centerSpinner at the
        // central angel's origin, groupLeft at x=-0.7/z=0, groupRight at
        // x=+0.7/z=0). The proximity gating ramps the spin in/out at the
        // phase boundaries so neighbouring phases don't see residual motion.
        // 0.18 rad/s → a full revolution takes ~35 seconds, slow enough to
        // feel meditative but visible during the phase 03 dwell.
        // TRIO_SCALE = 0.805: each of the three angels shrinks to ~80.5%
        // during phase 03 (was 0.7; +15% per user request — the cluster was
        // reading too small). Still smaller than phases 01-02 (where the
        // central is solo at full size) so the "further away from camera"
        // editorial framing is preserved. The CENTRAL angel still animates
        // 1.0 → 0.805 (the settle-into-position) and the laterals stay at
        // fixed 0.805 and only fade alpha. ALMA phase 04 is untouched —
        // its almaTargetScale (0.55 mobile / 0.65 desktop) overrides this
        // via the phase04Proximity lerp a few hundred lines below.
        const TRIO_SCALE = 0.805;
        // Side angels fade in EARLIER and over a LONGER window so the pair
        // doesn't "snap" into frame right as the gold angel settles. Earlier
        // this was a tight [0.95, 1.0] tail (last 5% of the settle), which
        // read as abrupt — the laterals appeared almost simultaneously with
        // the central angel reaching its pose. The user asked for them to
        // start a touch earlier and ease in more gradually, so we now remap
        // the much wider [0.78, 1.0] tail of phase03Proximity into a [0, 1]
        // alpha via smootherstep (quintic — zero 1st and 2nd derivative at the
        // endpoints so the fade has no perceptible "click"). The ~4× wider
        // span turns the entrance into a slow, soft dissolve. Below 0.78
        // they're invisible (group.visible = false), so neither clone costs
        // draw calls during the long approach.
        const SIDE_FADE_START = 0.78;
        const sideOpacity = smootherstep((phase03Proximity - SIDE_FADE_START) / (1.0 - SIDE_FADE_START));
        const matSides = stateRef.current.materials && stateRef.current.materials.materiaSideGroups;
        const matSideMats = stateRef.current.materials && stateRef.current.materials.materiaSideMaterials;
        if (matSides) {
          // Toggle the whole subtree out of rendering when the side fade is
          // essentially 0. Cheaper than rendering a fully-transparent angel
          // (which would still pay the depth/fragment cost per pixel of wing).
          const visible = sideOpacity > 0.001;
          if (matSides.left.visible !== visible) matSides.left.visible = visible;
          if (matSides.right.visible !== visible) matSides.right.visible = visible;
          if (visible) {
            // Constant scale — no zoom animation. The "appearing" comes from
            // the opacity drive a few lines below.
            matSides.left.scale.setScalar(TRIO_SCALE);
            matSides.right.scale.setScalar(TRIO_SCALE);
            // Both side angels share the same opacity so the pair reads as
            // one composition rather than two independent fades.
            if (matSideMats) {
              const l = matSideMats.left;
              const r = matSideMats.right;
              for (let i = 0; i < l.length; i++) l[i].opacity = sideOpacity;
              for (let i = 0; i < r.length; i++) r[i].opacity = sideOpacity;
            }
          }
          // HARD-RESET when phase 03 is fully OUT of frame. Outside this
          // band, force the spin angle back to exactly 0 — no float
          // residue, no "0.048° leftover", no possibility that the user
          // perceives an off-axis pose in BIENVENIDA / ORIGEN / ALMA /
          // EDICIÓN after a long MATERIA dwell. 0.001 is well below the
          // visual threshold (~0.06°) but still well clear of the ramp
          // edges of the phase-03 gaussian (which is >0.01 at tRaw≈0.40).
          const PHASE03_OFF_THRESHOLD = 0.001;
          if (phase03Proximity < PHASE03_OFF_THRESHOLD) {
            stateRef.current.materiaSpinAngle = 0;
          } else {
            // Inside (or near) phase 03: accumulate at the proximity-gated rate.
            stateRef.current.materiaSpinAngle =
              (stateRef.current.materiaSpinAngle || 0) + dt * 0.18 * phase03Proximity;
          }
          // Wrap the accumulated angle to its SHORTEST equivalent in
          // [-π, π] before applying proximity. Three.js treats Euler.y=π
          // and Euler.y=-π as the same orientation, so the wrap is
          // visually invisible during continuous spin. But on EXIT from
          // phase 03, multiplying the wrapped value (≤π) by proximity
          // un-winds along the shortest path back to 0 — instead of
          // counter-rotating through every full revolution the user
          // sat watching.
          const TWO_PI = Math.PI * 2;
          let wrappedSpin = stateRef.current.materiaSpinAngle % TWO_PI;
          if (wrappedSpin >  Math.PI) wrappedSpin -= TWO_PI;
          else if (wrappedSpin < -Math.PI) wrappedSpin += TWO_PI;
          const visibleSpin = wrappedSpin * phase03Proximity;
          matSides.left.rotation.y  = visibleSpin;
          matSides.right.rotation.y = visibleSpin;
          const cs = stateRef.current.materials.centerSpinner;
          if (cs) {
            // EDICIÓN finale: the angel spins slowly to the RIGHT (clockwise,
            // positive Y) — a calm, meditative rotation (~0.28 rad/s ≈ one turn
            // every ~22 s). Each COMPLETED revolution re-skins the body, cycling
            // gold → rhodium → silver → gold → …, using the SAME silver/rhodium
            // materials (cool env map) as the MATERIA section-03 side angels.
            // Gated by phase05Proximity, reset on exit so re-entry starts gold.
            const sp = stateRef.current;
            if (phase05Proximity > 0.01) {
              // 30% slower than before: 0.28 → 0.196 rad/s (~one turn / 32 s).
              sp.edition05Spin = (sp.edition05Spin || 0) + dt * 0.196 * phase05Proximity;
              const live = sp.materials.editionLive;
              const finishes = sp.materials.editionFinishes;
              const meshes = sp.materials.centerBodyMeshes;
              // On entry, hand the center body to the live materials so the
              // per-frame blend below drives them (ORIGEN keeps the originals).
              if (!sp.edition05Active && live && meshes) {
                sp.edition05Active = true;
                for (let i = 0; i < meshes.length; i++) {
                  meshes[i].mesh.material = (meshes[i].tone === 'bright') ? live.bright : live.warm;
                }
              }
              if (live && finishes) {
                const order = ['gold', 'rhodium', 'silver'];
                const cycleT = Math.abs(sp.edition05Spin) / (Math.PI * 2);
                const base = Math.floor(cycleT);
                const frac = cycleT - base;
                const fromName = order[base % 3];
                const toName = order[(base + 1) % 3];
                // ── True fade-out → fade-in between finishes ─────────────────
                // These are metals (metalness 1), so their look is dominated by
                // the ENV-MAP reflection (warm for gold, cool for silver/rhodium)
                // — not the base color. Lerping color alone read as INSTANT
                // because the env map hot-swapped in one frame ("gold…gold…POP
                // silver"). Fix: the finish holds steady for most of the turn,
                // then over the last `FADE` slice the reflection DIMS to a dark
                // trough at the midpoint, the env map + color swap AT that trough
                // (where it's too dark to see), and the reflection lifts back
                // into the new finish — a genuine fade-out/fade-in well over the
                // ½ s minimum (~3.8 s here). Anchors stay byte-exact: at tf=0 and
                // tf=1 dimMul=1 and blend snaps to a pure finish, so each metal
                // is shown cleanly (identical to MATERIA) between transitions.
                const FADE = 0.12;                  // last ~12% of a ~32 s turn ≈ 3.8 s
                const tf = frac <= (1 - FADE) ? 0 : (frac - (1 - FADE)) / FADE; // 0→1
                const blend = smootherstep(tf);     // color / roughness morph
                const dip = Math.sin(Math.PI * tf); // 0 at ends, 1 at midpoint
                const DIP_AMT = 0.78;               // trough darkness of the fade
                const dimMul = 1 - DIP_AMT * dip;   // 1 → 0.22 → 1
                const coolEnv = sp.materials.coolMetalEnv || null;
                ['warm', 'bright'].forEach((tone) => {
                  const f = finishes[tone][fromName];
                  const t = finishes[tone][toName];
                  const m = live[tone];
                  m.color.copy(f.color).lerp(t.color, blend);
                  m.roughness       = f.roughness + (t.roughness - f.roughness) * blend;
                  m.metalness       = f.metalness + (t.metalness - f.metalness) * blend;
                  m.envMapIntensity = (f.env + (t.env - f.env) * blend) * dimMul;
                  // Swap env at the trough (tf<0.5 → from, else → to), where the
                  // reflection is darkest, so the discrete change is unseen.
                  const wantEnv = ((tf < 0.5 ? f.cool : t.cool) ? coolEnv : null);
                  if (m.envMap !== wantEnv) { m.envMap = wantEnv; m.needsUpdate = true; }
                });
              }
            } else if (sp.edition05Active) {
              // Leaving EDICIÓN: hand the body back to the canonical gold
              // materials (the ones ORIGEN animates) and reset the cycle.
              sp.edition05Active = false;
              sp.edition05Spin = 0;
              const sets = sp.materials.metalSets;
              const meshes = sp.materials.centerBodyMeshes;
              if (sets && meshes) {
                for (let i = 0; i < meshes.length; i++) {
                  meshes[i].mesh.material = (meshes[i].tone === 'bright') ? sets.gold.bright : sets.gold.warm;
                }
              }
            }
            cs.rotation.y = visibleSpin + (sp.edition05Spin || 0);
            // Center-angel scale composes MATERIA shrink (1.0 → 0.7) with
            // an ALMA shrink. The two proximities don't overlap (MATERIA
            // peaks 0.50, ALMA peaks 0.70 with σ≈0.075) so the lerps don't
            // fight — at MATERIA peak the second lerp is a no-op
            // (phase04Proximity≈0) and vice versa. ALMA shrinks the angel
            // so the orb sits in the upper third of the viewport with the
            // title/sub stack below. Mobile gets an extra shrink (0.50)
            // because the portrait camera otherwise keeps the body too
            // large in screen-space and the title overlaps the legs.
            let centerScale = lerp(1.0, TRIO_SCALE, phase03Proximity);
            const almaTargetScale = isMobile ? 0.55 : 0.65;
            centerScale = lerp(centerScale, almaTargetScale, phase04Proximity);
            // EDICIÓN finale recede: shrink the angel further so it reads as a
            // single distant light in the upper frame, clearing the lower half
            // for the inscription (seal · title · message · CTA). Composed last;
            // phase05Proximity is 0 at every ALMA/MATERIA anchor so this lerp is
            // a no-op there (those phases keep their scale untouched).
            // Mobile bumped 0.44→0.76: the relic was far too small on tall phones
            // (the portrait camera pullback shrinks it), leaving a large empty halo
            // above and below. A bigger figure commands its upper band so the
            // composition reads as a deliberate altarpiece, not a figure lost in void.
            // editionAspectComp (defined above) divides out the aspect-driven size
            // variance so the relic is the same on a 375×667 and a 430×932 phone.
            const editionTargetScale = isMobile ? 0.76 * editionAspectComp : isTablet ? 0.58 : 0.72;
            centerScale = lerp(centerScale, editionTargetScale, phase05Proximity);
            cs.scale.setScalar(centerScale);
          }
          // DEBUG: expose runtime values for verification
          window.__elyxie_debug = window.__elyxie_debug || {};
          window.__elyxie_debug.materiaSpinAngle = stateRef.current.materiaSpinAngle;
          window.__elyxie_debug.wrappedSpin = wrappedSpin;
          window.__elyxie_debug.visibleSpin = visibleSpin;
          window.__elyxie_debug.phase03Proximity = phase03Proximity;
          window.__elyxie_debug.csRotY = cs ? cs.rotation.y : null;
          window.__elyxie_debug.angelRotY = angel.rotation.y;
          window.__elyxie_debug.csScaleX = cs ? cs.scale.x : null;
          window.__elyxie_debug.angelPosX = angel.position.x;
          window.__elyxie_debug.angelPosY = angel.position.y;
          window.__elyxie_debug.angelPosZ = angel.position.z;
          window.__elyxie_debug.tRaw = tRaw;
          // Also expose the INNER model rotation (set once at load to
          // -π/2 on X; we want to confirm Y/Z are still 0).
          const modelInner = cs && cs.children[0];
          if (modelInner) {
            window.__elyxie_debug.modelRotX = modelInner.rotation.x;
            window.__elyxie_debug.modelRotY = modelInner.rotation.y;
            window.__elyxie_debug.modelRotZ = modelInner.rotation.z;
            window.__elyxie_debug.modelPosX = modelInner.position.x;
            window.__elyxie_debug.modelPosY = modelInner.position.y;
            window.__elyxie_debug.modelPosZ = modelInner.position.z;
          }
        }

        camera.position.z = camZ;
        camera.position.x = Math.sin(clock.elapsed * 0.25) * 0.05;
        camera.position.y = Math.cos(clock.elapsed * 0.3) * 0.04;
        // Track the angel during the close-up so the body slides into the
        // center of the frame as the camera dives in. X tracking pulls the
        // figure away from phase 01's right-side pose toward horizontal
        // center; Y tracking lifts the angel out of the low phase-01 mobile
        // framing so the face/torso sit roughly at viewport vertical center
        // during the close-up beat instead of slumping toward the bottom.
        // Both decay to 0 at the phase anchors via faceCloseup → byte-perfect
        // at tRaw=0 and tRaw=0.29.
        const lookFaceX = angel.position.x * faceCloseup;
        const lookFaceY = angel.position.y * faceCloseup;
        camera.lookAt(lookFaceX, lookFaceY, 0);

        // ===== Phase 02 (ORIGEN) light shaping =====
        // Same gaussian as the backdrop + framing, so light/camera/photo all
        // ramp in synchronously. At peak: warm sun from upper-right, cool
        // bounce from below-left, and the base lights pushed WAY down so the
        // shadow side reads almost black — matches the noir-cinematic feel of
        // the reference Laguna Negra composite (deep chiaroscuro, not
        // golden-glow).
        //
        // Sun DIRECTION lerp (gated by phaseOriginProximity, so other phases
        // are untouched): cross phaseSun from its neutral upper-front spot
        // (+Z) over to BACK-right (-Z) as the user scrolls into phase 02.
        // The reference photo's sun-break is BEHIND the angel — rim light
        // catches the right shoulder / outer wing feathers, face stays dim.
        // X stays positive (right of angel), Y slightly lower to match the
        // shallower elevation of the visible god-rays, Z crosses zero so the
        // light source ends up behind the figure.
        phaseSun.position.set(
          lerp(4.2,  5.6, phaseOriginProximity),
          lerp(5.0,  4.2, phaseOriginProximity),
          lerp(2.2, -3.0, phaseOriginProximity),
        );
        phaseSun.intensity        = 2.6 * phaseOriginProximity;
        phaseSunBounce.intensity  = 0.18 * phaseOriginProximity;

        // ===== Phase 01 (BIENVENIDA) light shaping =====
        // Top-down dominant: ramp the overhead `phase01Spot` while pulling
        // the front-warm key/fill way down so the lower half of the angel
        // sinks into shadow. Each multiplier is 1.0 outside phase 01 (the
        // lerp's a-term), so phases 02/03/04/05 keep their original rig.
        // The phase 02 dimmer composes multiplicatively below — both
        // gaussians can be active at the curve tails without conflict.
        phase01Spot.intensity     = 3.0 * phase01Proximity;
        // Phase 03 warm rim: ramps up with the same MATERIA gaussian as the
        // CSS atmosphere and the trio reveal. Peak 3.5 picks up the wing
        // crests cleanly without blowing out the silver/rhodium env
        // reflections (first draft at 2.4 was too subtle to read against
        // the atmospheric warm cone painted in CSS behind the canvas).
        phase03Spot.intensity     = 3.5 * phase03Proximity;
        // Smoke-shadow catcher: opacity follows phase01 proximity. Visible
        // only when phase01Spot is also active, so the projected silhouette
        // appears in sync with the spotlight. ShadowMaterial draws nothing
        // when opacity is 0 → other phases see no extra rendered geometry.
        if (stateRef.current.materials.smokeShadowPlane) {
          stateRef.current.materials.smokeShadowPlane.material.opacity = 0.55 * phase01Proximity;
        }
        const phase01KeyMult      = lerp(1.0, 0.10, phase01Proximity);
        const phase01FillMult     = lerp(1.0, 0.15, phase01Proximity);
        const phase01TopMult      = lerp(1.0, 4.20, phase01Proximity);
        const phase01AmbientMult  = lerp(1.0, 0.32, phase01Proximity);
        // Orb during BIENVENIDA (slot 02): the user moved the glow + fairy-dust
        // beat OUT of this section and into ORIGEN, so here the orb must NOT
        // shine. Pull both the emissive AND the inner PointLight well down so it
        // reads as a quiet, dormant sphere — still present as the "soul", just
        // not the luminous beacon it is in ORIGEN. The overhead phase01Spot
        // still grazes a soft highlight across the top.
        const phase01OrbEmissive  = lerp(1.0, 0.26, phase01Proximity);
        const phase01OrbLight     = lerp(1.0, 0.30, phase01Proximity);
        const phase01EnvMap       = lerp(1.0, 0.42, phase01Proximity);

        // Phase 04 (ALMA) NIGHT angel dim. User asked to "copy the same
        // lighting format as section 2" for the night beat — drop the
        // angel's body lights so the orb stands alone as the only light
        // source in the dark sanctum (the "glow in the dark indefinitely"
        // brand idea). Target levels mirror ORIGEN's ambient/fill/top
        // attenuation (8-10%); the multiplier is gated by phase04Proximity
        // AND almaNightF so DAY (almaNightF=0) keeps the angel fully lit,
        // and any other phase (phase04Proximity≈0) is untouched.
        const phase04AngelDim = 1 - (phase04Proximity * almaNightF) * 0.92;
        // Phase 04 (ALMA) DAY light direction match. The temple-day backdrop
        // has its god-ray descending from above and behind the angel — the
        // default studio rig lights from camera-front (+Z), which fights
        // the backdrop and makes the model float over it. During ALMA DAY
        // we dim the front-facing key/fill so the new phase04DaySun (high
        // + behind) becomes the dominant directional source. Night and
        // every other phase keep the default rig intact via phase04DayF→0.
        const phase04DayF = phase04Proximity * (1 - almaNightF);
        const phase04DayKeyMult  = lerp(1.0, 0.30, phase04DayF);
        const phase04DayFillMult = lerp(1.0, 0.22, phase04DayF);
        ambient.intensity         = 0.22 * lerp(1.0, 0.08, phaseOriginProximity) * phase01AmbientMult * phase04AngelDim;
        fill.intensity            = 0.75 * lerp(1.0, 0.08, phaseOriginProximity) * phase01FillMult    * phase04AngelDim * phase04DayFillMult;
        top.intensity             = 0.35 * lerp(1.0, 0.10, phaseOriginProximity) * phase01TopMult     * phase04AngelDim;
        key.intensity             = 1.5  * phase01KeyMult                                             * phase04AngelDim * phase04DayKeyMult;
        // ALMA DAY god-ray rig: hard warm key from high + behind matches the
        // backdrop's descending shaft; subtle floor bounce keeps the chest
        // from going pitch-black. Both gated by phase04DayF so they ONLY
        // fire during ALMA DAY (and ramp to 0 in night and other phases).
        phase04DaySun.intensity    = 3.2 * phase04DayF;
        phase04DayBounce.intensity = 0.6 * phase04DayF;

        const breathe = 0.5 + 0.5 * Math.sin(clock.elapsed * (Math.PI * 2) / 4.0);
        const phaseBoost = 1.0 + 1.6 * Math.exp(-Math.pow((tRaw - 0.6) / 0.18, 2));
        // ORIGEN (slot 01, the opener) orb GLOW. The user moved the glowing-orb
        // + fairy-dust beat HERE (it used to be dimmed to a soft teal sphere for
        // the old Laguna "noir" look). Now ORIGEN is the opener and the orb is
        // the luminous focal point with the fairy dust orbiting it. The orb
        // material is `toneMapped: false`, so these scalars drive the glow
        // directly:
        //   - phaseOrbEmissive: BOOST the green emissive so the sphere blooms.
        //   - phaseOrbLight:    BOOST the inner green PointLight so the phosphor
        //     glow visibly reflects onto the angel's gold feathers/body — the
        //     "los reflejos … reflejados en el ángel" the user asked for.
        const phaseOrbEmissive = lerp(1.0, 1.15, phaseOriginProximity);
        const phaseOrbLight    = lerp(1.0, 1.60, phaseOriginProximity);
        // Phase 04 (ALMA) orb beat — phosphor logic. Strontium aluminate
        // CHARGES under sunlight and EMITS in darkness; reproduce that
        // physically: DAY → emissive 0 (the sphere is "off", just catching
        // temple light passively, the way the brand copy describes "no
        // ilumina para ser vista"), NIGHT → 2.0× (the orb is the only
        // light source, "ilumina para recordar su propósito"). The
        // multiplier is gated by phase04Proximity so this scalar resolves
        // to 1.0 (no-op) anywhere outside ALMA, leaving ORIGEN/MATERIA
        // orb logic untouched.
        const phase04OrbScalar = lerp(0.00, 2.00, almaNightF);
        const phase04OrbMult   = lerp(1.0, phase04OrbScalar, phase04Proximity);
        // Phase 02 wing/body shadow: drop envMapIntensity on the gold metals
        // hard. With metalness=1.0 the wings reflect the env map directly, so
        // their bright-gold body is NOT a direct-light effect — it's IBL. To
        // match the reference's silhouetted backlit wings (dark feather
        // interiors, only the back-right phaseSun catching the outer edges
        // and tips), the env contribution must drop to a small fraction of
        // its base. Lerp gated by phaseOriginProximity so other phases keep
        // their full metallic shine.
        // Phase 04 (ALMA) gold env dim at night. With the angel-rig lights
        // attenuated above, the metal would still read bright via IBL
        // (metalness=1.0 reflects the env map directly). Drop the env
        // contribution so the wings settle into shadow too. Day = full env.
        const phase04GoldEnv = lerp(1.0, 0.18, phase04Proximity * almaNightF);
        const phaseGoldEnv   = lerp(1.0, 0.26, phaseOriginProximity) * phase01EnvMap * phase04GoldEnv;
        stateRef.current.materials.goldMaterials?.forEach(({ mat, baseEnv }) => {
          mat.envMapIntensity = baseEnv * phaseGoldEnv;
        });
        // Whisper-soft green rim — gold dominates. SOUL phase blooms the green.
        rim.intensity = (0.07 + breathe * 0.04) * stateRef.current.glowIntensity * phaseBoost;

        // Phase 04 (ALMA) orb COLOUR lerp: day → warm cream-gold (matches
        // temple's noon light), night → brand turquoise phosphor (the
        // strontium-aluminate "glow in the dark" idea). Mix factor goes
        // from 0 outside ALMA to up to 1 at ALMA-peak-day. Outside ALMA
        // the work color resolves to the brand glowCol (no behaviour
        // change for phases 01/02/03/05).
        const brandOrbCol = stateRef.current.materials.glowCol;
        const dayOrbCol2  = stateRef.current.materials.dayOrbCol;
        const orbWork     = stateRef.current.materials.orbColorWork;
        const dayMix      = phase04Proximity * (1 - almaNightF);
        orbWork.copy(brandOrbCol).lerp(dayOrbCol2, dayMix);
        // EDICIÓN finale: orb brightness multiplier. History: it once LIFTED
        // the orb (×1.40), then the client asked for half that (×0.70), and now
        // +50% again → ×1.05 at phase-05 peak (0.70 × 1.5). One factor drives
        // both the emissive AND the cast PointLight, so the sphere's own light
        // and the light it emits rise together; ≈1 elsewhere so nothing else
        // changes.
        // "La última luz": in the void finale the orb IS the only light, so it
        // blooms hard — ×1.45 at the phase-05 peak (was ×1.05 for the old cream
        // finale where a bright bg meant the orb didn't need to carry the frame).
        // Drives both the emissive sphere and its cast PointLight together; ≈1
        // elsewhere so no other phase changes.
        const phase05OrbBoost = lerp(1.0, 1.45, phase05Proximity);
        // Local-only orb glow: the PointLight is tight (1.5 range, 2.5 decay)
        // so this intensity only affects the orb and nearest feathers.
        sphereLight.color.copy(orbWork);
        sphereLight.intensity = (0.45 + breathe * 0.30) * stateRef.current.glowIntensity * Math.min(phaseBoost, 2.0) * phaseOrbLight * phase01OrbLight * phase04OrbMult * phase05OrbBoost;
        stateRef.current.materials.sphereMeshes.forEach((m) => {
          if (m.material) {
            m.material.emissive.copy(orbWork);
            m.material.emissiveIntensity = (0.85 + breathe * 0.35) * stateRef.current.glowIntensity * Math.min(phaseBoost, 1.8) * phaseOrbEmissive * phase01OrbEmissive * phase04OrbMult * phase05OrbBoost;
          }
        });

        // Phase 02 (ORIGEN) global exposure dip: pull tone mapping down during
        // the gaussian peak so highlights compress and shadows deepen — the
        // moody, slightly-underexposed look of the reference composite.
        // Fairy-dust COMET TRAIL update. Each particle follows its own
        // spiral path around a random axis (Rodrigues' rotation formula
        // applied to its initDir vector). A circular buffer of recent
        // positions (TRAIL_PTS slots, sampled every DUST_SAMPLE_INTERVAL)
        // is rendered as line segments with vertex colors fading from
        // transparent (oldest = tail) to bright (newest = head) — a
        // shooting-star streak instead of a single dot.
        //
        // Visibility envelope: fade in 0.10→0.13 (close-up peak), full
        // 0.13→0.42 (through phase 02), fade out 0.42→0.52 (as phase 03
        // takes over). Skip the per-particle loop when the gate is closed.
        if (stateRef.current.materials.fairyDust) {
          // ORIGEN (slot 01, opener) fairy-dust window. This was a fixed tRaw
          // window [0.10, 0.52] that, after the 01↔02 swap, ended up blooming
          // over BIENVENIDA (slot 02) instead of ORIGEN. Re-gate it to
          // phaseOriginProximity so the comet trails orbit the orb during the
          // ORIGEN opener — and rotate WITH it, since the dust is parented to
          // the spinning angel's centerSpinner. ≈0 by tRaw≈0.15, so BIENVENIDA
          // and every later phase are byte-perfect (clear of the trails).
          const dustOpacity02 = phaseOriginProximity * 0.7;
          // Phase 04 (ALMA) second visibility window. The user asked for the
          // orb to "glow exactly like in section 2 — with the glow plus
          // those particles around it" inside ALMA, but ONLY at night —
          // during the lit-temple day beat there should be no swarm. The
          // multiplication by almaNightF hard-gates the dust to nighttime
          // and lerps it cleanly through the cross-fade window so particles
          // don't pop in/out instantly when the temple flips. Envelope:
          // rise 0.60→0.65, hold, fall 0.75→0.80.
          const fadeIn04  = easeInOut(Math.max(0, Math.min(1, (tRaw - 0.60) / 0.05)));
          const fadeOut04 = 1 - easeInOut(Math.max(0, Math.min(1, (tRaw - 0.75) / 0.05)));
          const dustOpacity04 = fadeIn04 * fadeOut04 * 0.7 * almaNightF * 1.1;
          const dustOpacity = Math.max(dustOpacity02, dustOpacity04);
          const dust = stateRef.current.materials.fairyDust;
          dust.material.opacity = dustOpacity;

          if (dustOpacity > 0.005) {
            const m       = stateRef.current.materials;
            const axisA   = m.dustAxis;
            const initDir = m.dustInitDir;
            const angSpd  = m.dustAngSpd;
            const outSpd  = m.dustOutSpd;
            const life    = m.dustLife;
            const maxLife = m.dustMaxLife;
            const history = m.dustHistory;
            const histIdx = m.dustHistIdx;
            const reset   = m._resetParticle;
            const glow    = m.glowCol;
            const N       = m.DUST_COUNT;
            const TP      = m.TRAIL_PTS;
            const TS      = m.TRAIL_SEGS;
            const posArr  = dust.geometry.attributes.position.array;
            const colArr  = dust.geometry.attributes.color.array;

            // Sample timer: advance the history buffer at fixed intervals
            // so the trail spans ~TP × INTERVAL seconds of motion.
            dustSampleAccum += dt;
            const sample = dustSampleAccum >= DUST_SAMPLE_INTERVAL;
            if (sample) dustSampleAccum -= DUST_SAMPLE_INTERVAL;

            for (let i = 0; i < N; i++) {
              life[i] += dt;
              if (life[i] >= maxLife[i]) {
                life[i] = 0;
                reset(i);
              }

              // Rodrigues rotation: v0 = initDir * radius (perpendicular to
              // axis by construction). Rotated by `angle` around the axis:
              //   v_rot = v0·cos(angle) + (axis × v0)·sin(angle)
              // (the k·v term drops because initDir ⊥ axis).
              const radius = outSpd[i] * life[i];
              const angle  = angSpd[i] * life[i];
              const vx = initDir[i*3]     * radius;
              const vy = initDir[i*3 + 1] * radius;
              const vz = initDir[i*3 + 2] * radius;
              const ax = axisA[i*3];
              const ay = axisA[i*3 + 1];
              const az = axisA[i*3 + 2];
              const cs = Math.cos(angle);
              const sn = Math.sin(angle);
              const cx = ay * vz - az * vy;
              const cy = az * vx - ax * vz;
              const cz = ax * vy - ay * vx;
              const px = vx * cs + cx * sn;
              const py = vy * cs + cy * sn;
              const pz = vz * cs + cz * sn;

              // Write to history at the sampling tick. Between ticks we
              // leave the buffer alone so the trail spans real motion
              // instead of just one frame.
              const hBase = i * TP * 3;
              if (sample) {
                const wIdx = histIdx[i];
                history[hBase + wIdx * 3]     = px;
                history[hBase + wIdx * 3 + 1] = py;
                history[hBase + wIdx * 3 + 2] = pz;
                histIdx[i] = (wIdx + 1) % TP;
              }

              // Life envelope + HEAD-FIRST death sequence. While alive
              // (lifeT < 0.65) the whole trail renders at full strength.
              // Past that the head fades FIRST and the tail catches up
              // later, so the comet "burns out" from the front instead of
              // the entire streak vanishing as a block. Death window is
              // long (35% of life) so the dissipation reads as gentle
              // rather than abrupt.
              const lifeT = life[i] / maxLife[i];
              const dying = lifeT > 0.65;
              const deathT = dying ? (lifeT - 0.65) / 0.35 : 0;

              // Build line segments from history. histIdx is the slot we
              // would write to NEXT — which means it holds the OLDEST
              // sample (about to be overwritten). Segments march from
              // there toward the newest (the head).
              const oldest = histIdx[i];
              for (let sIdx = 0; sIdx < TS; sIdx++) {
                const a1Idx = (oldest + sIdx)     % TP;
                const a2Idx = (oldest + sIdx + 1) % TP;
                const h1Off = hBase + a1Idx * 3;
                const h2Off = hBase + a2Idx * 3;
                const segOff = (i * TS + sIdx) * 6;

                posArr[segOff]     = history[h1Off];
                posArr[segOff + 1] = history[h1Off + 1];
                posArr[segOff + 2] = history[h1Off + 2];
                posArr[segOff + 3] = history[h2Off];
                posArr[segOff + 4] = history[h2Off + 1];
                posArr[segOff + 5] = history[h2Off + 2];

                // Base alpha gradient: 0 at tail end, 1 at head end.
                const sNorm1 =  sIdx       / TS;
                const sNorm2 = (sIdx + 1) / TS;

                // Per-vertex death fade. Head vertices (sNorm → 1) lose
                // alpha faster than tail vertices (sNorm → 0). At the
                // start of death (deathT=0) both are unchanged. At the
                // end (deathT=1) the head is at 0 and the tail is at
                // ~0.3 — the trail collapses from the front first.
                const dFade1 = dying ? Math.max(0, 1 - deathT * (0.3 + 0.7 * sNorm1)) : 1.0;
                const dFade2 = dying ? Math.max(0, 1 - deathT * (0.3 + 0.7 * sNorm2)) : 1.0;

                const a1 = sNorm1 * dFade1;
                const a2 = sNorm2 * dFade2;

                colArr[segOff]     = glow.r * a1;
                colArr[segOff + 1] = glow.g * a1;
                colArr[segOff + 2] = glow.b * a1;
                colArr[segOff + 3] = glow.r * a2;
                colArr[segOff + 4] = glow.g * a2;
                colArr[segOff + 5] = glow.b * a2;
              }
            }
            dust.geometry.attributes.position.needsUpdate = true;
            dust.geometry.attributes.color.needsUpdate    = true;
          }
        }

        renderer.toneMappingExposure = lerp(1.1, 0.78, tEase) * lerp(1.0, 0.42, phaseOriginProximity);

        // Publish the angel's screen-space X (in viewport %) as a CSS variable
        // so the phase 01 light beam / haze / halo can track it across every
        // viewport — desktop, tablet, mobile. Anchored on the orb height
        // (angel.position.y + ~0.5 world units up) so the percent reads from
        // roughly the body-center axis, not the feet. THROTTLED: only write
        // when the value moved enough to be visible, AND only during phase 01
        // (the CSS consumers fade to 0 outside) — otherwise this writes 60×/s
        // to documentElement and forces re-rasterisation of two full-viewport
        // mask layers (the worst-case paint cost in the page).
        if (phase01Proximity > 0.01) {
          camera.updateMatrixWorld();
          _projVec.set(angel.position.x, angel.position.y + 0.5, angel.position.z).project(camera);
          const angelScreenXPct = ((_projVec.x + 1) * 50);
          if (Math.abs(angelScreenXPct - lastAngelXWrite) > 0.4) {
            document.documentElement.style.setProperty('--angel-x', `${angelScreenXPct.toFixed(2)}%`);
            lastAngelXWrite = angelScreenXPct;
          }
        }

        // Publish --alma-day-mix for the section-4 day-mode UI recoloring in
        // CSS (color-mix consumers in styles.css). Throttled to 0.005 deltas
        // (0.5%) — finer than the eye can pick up but coarse enough to avoid
        // a per-frame setProperty when the value is parked at 0 (outside
        // ALMA) or 1 (mid-day peak). phase04DayF is already computed above.
        if (Math.abs(phase04DayF - lastAlmaDayMixWrite) > 0.005) {
          document.documentElement.style.setProperty('--alma-day-mix', phase04DayF.toFixed(3));
          lastAlmaDayMixWrite = phase04DayF;
        }

        // Toggle shadow rendering ONLY when phase01Spot is contributing.
        // shadowMap.autoUpdate stays false the rest of the time, so the
        // shadow pass is skipped entirely on every frame outside phase 01.
        if (phase01Proximity > 0.02) {
          renderer.shadowMap.autoUpdate = true;
        } else if (renderer.shadowMap.autoUpdate) {
          renderer.shadowMap.autoUpdate = false;
        }

        // ===== Update MATERIA labels =====
        // Project each angel's bbox-bottom (in object-local space) into screen
        // coordinates and write the label CSS transform. Only runs when MATERIA
        // is in proximity to keep the cost off the budget during phases 1/2/4/5.
        // The label X tracks the angel horizontally; Y is dropped a fixed pixel
        // padding (PAD_PX) below the projected feet so the type sits cleanly
        // under each silhouette regardless of viewport. matSides may not exist
        // yet on the first frames before the GLB resolves — gate on that too.
        {
          const labels   = stateRef.current.materiaLabels;
          const matSidesL = stateRef.current.materials && stateRef.current.materials.materiaSideGroups;
          const bboxY    = stateRef.current.modelBboxY;
          if (labels && matSidesL && bboxY && phase03Proximity > 0.005) {
            camera.updateMatrixWorld();
            const PAD_PX = 22;
            const cw = container.clientWidth;
            const ch = container.clientHeight;
            // Each label follows its own angel's visibility: the lateral
            // labels ride sideOpacity (last-5% reveal) so they don't float
            // under empty air while plata/rodio are still hidden; "oro" stays
            // tied to phase03Proximity so it appears with the center angel.
            const targets = [
              { obj: matSidesL.left,                              opacity: sideOpacity },
              { obj: stateRef.current.materials.centerSpinner,    opacity: phase03Proximity },
              { obj: matSidesL.right,                             opacity: sideOpacity },
            ];
            for (let i = 0; i < 3; i++) {
              const { obj, opacity } = targets[i];
              const el = labels[i];
              if (!obj || !el) continue;
              _projVec.set(0, bboxY.min, 0);
              obj.localToWorld(_projVec);
              _projVec.project(camera);
              // Skip if the point is behind the camera — projection would
              // mirror it to the wrong side of the screen.
              if (_projVec.z > 1) { el.style.opacity = '0'; continue; }
              const x = (_projVec.x * 0.5 + 0.5) * cw;
              const y = (-_projVec.y * 0.5 + 0.5) * ch;
              el.style.transform =
                `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, ${PAD_PX}px)`;
              el.style.opacity = opacity.toFixed(3);
            }
          } else if (labels) {
            // Outside MATERIA → zero opacity. Skip the transform write so we
            // don't burn cycles on positions nobody will see.
            for (let i = 0; i < labels.length; i++) {
              if (labels[i].style.opacity !== '0') labels[i].style.opacity = '0';
            }
          }
        }

        renderer.render(scene, camera);
      }

      function startLoop() {
        if (raf) return;
        lastT = performance.now();
        lastFrameTime = 0;
        raf = requestAnimationFrame(animate);
      }
      function stopLoop() {
        if (raf) { cancelAnimationFrame(raf); raf = 0; }
      }
      function evaluateLoop() {
        if (visible && tabVisible && !disposed) startLoop();
        else stopLoop();
      }

      // IntersectionObserver: pause the loop once the hero is fully off-screen.
      // rootMargin gives a generous buffer so the scene resumes well before the
      // user can scroll back into view (avoids a one-frame black flash).
      const io = new IntersectionObserver((entries) => {
        const e = entries[0];
        visible = e ? e.isIntersecting : true;
        evaluateLoop();
      }, { rootMargin: '200px 0px', threshold: 0 });
      io.observe(container);

      // Page Visibility: pause completely on hidden tabs (battery + CPU on
      // background tabs goes to 0 instead of ~30 fps throttled rAF).
      const onVisibility = () => {
        tabVisible = !document.hidden;
        evaluateLoop();
      };
      document.addEventListener('visibilitychange', onVisibility);

      startLoop();

      const onResize = () => {
        const w = container.clientWidth, h = container.clientHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      };
      window.addEventListener('resize', onResize);

      dispose = () => {
        stopLoop();
        io.disconnect();
        document.removeEventListener('visibilitychange', onVisibility);
        window.removeEventListener('resize', onResize);
        if (stateRef.current.materiaLabels) {
          stateRef.current.materiaLabels.forEach((el) => {
            if (el && el.parentNode) el.parentNode.removeChild(el);
          });
          stateRef.current.materiaLabels = null;
        }
        renderer.dispose();
        envMap.dispose();
        scene.traverse((o) => {
          if (o.geometry) o.geometry.dispose();
          if (o.material) {
            if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
            else o.material.dispose();
          }
        });
        if (renderer.domElement.parentNode === container) {
          container.removeChild(renderer.domElement);
        }
      };
    });

    return () => {
      disposed = true;
      dispose();
    };
  }, []);

  return <div ref={containerRef} className="scene-host" style={{ position: 'absolute', inset: 0 }} />;
});

window.Pendant = Pendant;
