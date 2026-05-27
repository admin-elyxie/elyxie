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
  const stateRef = useRef({ progress: 0, glowIntensity, glowColor });

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
      stateRef.current.materials = {
        rim, sphereLight, sphereMeshes, smokeShadowPlane,
        fairyDust, dustAxis, dustInitDir, dustAngSpd, dustOutSpd,
        dustLife, dustMaxLife, dustHistory, dustHistIdx, dustColors,
        glowCol, DUST_COUNT, TRAIL_PTS, TRAIL_SEGS, _resetParticle,
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
              mesh.material = (idx++ % 5 === 0) ? goldBright : goldWarm;
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

          angel.add(model);

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

            const modelLeft = model.clone(true);
            applyMaterialsToClone(modelLeft, { warm: silverWarm, bright: silverBright });
            const modelRight = model.clone(true);
            applyMaterialsToClone(modelRight, { warm: rhodiumWarm, bright: rhodiumBright });

            // Wrap each clone in a Group so we can scale 0→1 with
            // phase03Proximity without touching the model's own scale (which
            // encodes the fitting transform set above). Side offset of 2.8
            // world units leaves ~0.8 of breathing room between the wing tips
            // of adjacent angels (each angel fits a ~2.0-wide bbox).
            const groupLeft  = new THREE.Group();
            groupLeft.add(modelLeft);
            groupLeft.position.x = -2.8;
            groupLeft.scale.setScalar(0); // invisible outside phase 03

            const groupRight = new THREE.Group();
            groupRight.add(modelRight);
            groupRight.position.x = 2.8;
            groupRight.scale.setScalar(0); // invisible outside phase 03

            angel.add(groupLeft);
            angel.add(groupRight);
            stateRef.current.materials.materiaSideGroups = { left: groupLeft, right: groupRight };
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
        },
        undefined,
        (err) => { console.error('Failed to load angel GLB:', err); },
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
        // Phase 02 (ORIGEN, scroll range 0.18–0.40) proximity. Peaks at the
        // middle of the range and falls off symmetrically so all phase-02
        // overrides (rotation, framing, lighting) ramp in/out together while
        // phases 01 and 03 stay untouched.
        const phaseOriginProximity = Math.exp(-Math.pow((tRaw - 0.29) / 0.075, 2));
        // Phase 01 (BIENVENIDA) proximity gaussian — peaks at tRaw=0 and
        // decays to negligible (<1%) by tRaw≈0.18, well before phase 02's
        // peak at 0.29. Used to gate phase-01-only nudges: angel pushed
        // right so the headline owns the left half, and a teal vignette
        // backdrop. Outside phase 01 this is essentially 0 → no effect.
        const phase01Proximity = Math.exp(-Math.pow(tRaw / 0.08, 2));

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

        if (window.__debugFreezeY !== undefined) {
          angel.rotation.y = window.__debugFreezeY;
          angel.rotation.x = 0;
          angel.rotation.z = 0;
        } else {
          // Phase 01 (BIENVENIDA) self-rotation: angel turns 30° on its own
          // Y axis toward ITS RIGHT (= viewer's left → negative rotation.y in
          // Three.js convention). Hold-and-release curve above replaces the
          // old gaussian decay so the rotation lingers during the camera
          // close-up beat, then resolves during the pull-back to phase 02.
          angel.rotation.y = -(Math.PI / 6) * rotHold;
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
        const pyOriginShift = 0.30 * phaseOriginProximity;
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
        // three side-by-side angels (silver | gold | rhodium, ±2.8 world
        // units apart) all fit in frame with breathing room. At the peak
        // (tRaw=0.50, phase03Proximity=1.0) camZ resolves to 9.0 — wide
        // enough that wing tips don't overlap and each finish is readable.
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

        const px = pxOrigin * (1 - phaseSoulProximity * 0.85)
                 + Math.sin(clock.elapsed * 0.35) * 0.02;
        const py = -0.05 + pyOffset + pyOriginShift + py01Mobile
                 + Math.sin(clock.elapsed * 0.4) * 0.03
                 + Math.sin(tRaw * Math.PI) * 0.06;
        angel.position.set(px, py, pz01);

        // Phase 03 (MATERIA) side angels: scale from 0 (hidden) → 1 (full
        // visible at the peak tRaw=0.50). They're children of `angel`, so
        // they inherit the rotation/position above; only the LOCAL scale of
        // each Group depends on phase. Outside [0.40, 0.60] the proximity is
        // negligible (<0.5%) so neither clone contributes to draw calls.
        const matSides = stateRef.current.materials && stateRef.current.materials.materiaSideGroups;
        if (matSides) {
          matSides.left.scale.setScalar(phase03Proximity);
          matSides.right.scale.setScalar(phase03Proximity);
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
        // Orb during phase 01: keep the green emissive PROMINENT (slight
        // dim from base) and dial the inner PointLight WAY down so the orb
        // reads as a saturated green sphere instead of a white flashlight.
        // The new overhead `phase01Spot` adds a small white specular
        // highlight at the top of the orb — that's the cherry-on-top in
        // the reference; pumping emissive keeps green dominant beneath it.
        const phase01OrbEmissive  = lerp(1.0, 0.85, phase01Proximity);
        const phase01OrbLight     = lerp(1.0, 0.38, phase01Proximity);
        const phase01EnvMap       = lerp(1.0, 0.42, phase01Proximity);

        ambient.intensity         = 0.22 * lerp(1.0, 0.08, phaseOriginProximity) * phase01AmbientMult;
        fill.intensity            = 0.75 * lerp(1.0, 0.08, phaseOriginProximity) * phase01FillMult;
        top.intensity             = 0.35 * lerp(1.0, 0.10, phaseOriginProximity) * phase01TopMult;
        key.intensity             = 1.5  * phase01KeyMult;

        const breathe = 0.5 + 0.5 * Math.sin(clock.elapsed * (Math.PI * 2) / 4.0);
        const phaseBoost = 1.0 + 1.6 * Math.exp(-Math.pow((tRaw - 0.6) / 0.18, 2));
        // Phase 02 (ORIGEN) orb dim: the orb material is `toneMapped: false`,
        // so the global exposure dip does NOT darken it — making the orb read
        // blown-white against a dimmed body. Decouple two scalars:
        //   - phaseOrbEmissive: pull the white emissive WAY down so the orb
        //     reads as a soft teal sphere, not a flashlight.
        //   - phaseOrbLight:    keep the green PointLight more present so the
        //     local rim of green on the nearest feathers still reads.
        const phaseOrbEmissive = lerp(1.0, 0.16, phaseOriginProximity);
        const phaseOrbLight    = lerp(1.0, 0.55, phaseOriginProximity);
        // Phase 02 wing/body shadow: drop envMapIntensity on the gold metals
        // hard. With metalness=1.0 the wings reflect the env map directly, so
        // their bright-gold body is NOT a direct-light effect — it's IBL. To
        // match the reference's silhouetted backlit wings (dark feather
        // interiors, only the back-right phaseSun catching the outer edges
        // and tips), the env contribution must drop to a small fraction of
        // its base. Lerp gated by phaseOriginProximity so other phases keep
        // their full metallic shine.
        const phaseGoldEnv = lerp(1.0, 0.26, phaseOriginProximity) * phase01EnvMap;
        stateRef.current.materials.goldMaterials?.forEach(({ mat, baseEnv }) => {
          mat.envMapIntensity = baseEnv * phaseGoldEnv;
        });
        // Whisper-soft green rim — gold dominates. SOUL phase blooms the green.
        rim.intensity = (0.07 + breathe * 0.04) * stateRef.current.glowIntensity * phaseBoost;
        // Local-only orb glow: the PointLight is tight (1.5 range, 2.5 decay)
        // so this intensity only affects the orb and nearest feathers.
        sphereLight.intensity = (0.45 + breathe * 0.30) * stateRef.current.glowIntensity * Math.min(phaseBoost, 2.0) * phaseOrbLight * phase01OrbLight;
        stateRef.current.materials.sphereMeshes.forEach((m) => {
          if (m.material) {
            m.material.emissiveIntensity = (0.85 + breathe * 0.35) * stateRef.current.glowIntensity * Math.min(phaseBoost, 1.8) * phaseOrbEmissive * phase01OrbEmissive;
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
          const fadeIn  = easeInOut(Math.max(0, Math.min(1, (tRaw - 0.10) / 0.03)));
          const fadeOut = 1 - easeInOut(Math.max(0, Math.min(1, (tRaw - 0.42) / 0.10)));
          const dustOpacity = fadeIn * fadeOut * 0.7;
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

        // Toggle shadow rendering ONLY when phase01Spot is contributing.
        // shadowMap.autoUpdate stays false the rest of the time, so the
        // shadow pass is skipped entirely on every frame outside phase 01.
        if (phase01Proximity > 0.02) {
          renderer.shadowMap.autoUpdate = true;
        } else if (renderer.shadowMap.autoUpdate) {
          renderer.shadowMap.autoUpdate = false;
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
