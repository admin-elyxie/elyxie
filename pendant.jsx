// === Pendant.jsx ===
// Three.js scene: gold angel suspended around a hand-blown glass sphere
// with a phosphor-green core. Driven entirely by a `progressRef` (0..1)
// that the parent updates from scroll position.

const { useEffect, useRef, useImperativeHandle, forwardRef } = React;

// Cubic ease helper
const easeInOut = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------- Procedural studio environment ----------
// Generates a 6-face cube texture in code so we get nice PBR reflections
// without needing to ship an HDR file.
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

  // px, nx, py, ny, pz, nz
  faces.push(gradientCanvas(top, warm, floor, [{ x: size * 0.7, y: size * 0.35, r: size * 0.5, color: warm }])); // +X
  faces.push(gradientCanvas(top, cool, floor, [{ x: size * 0.3, y: size * 0.5, r: size * 0.5, color: cool }])); // -X
  faces.push(gradientCanvas(top, top, warm)); // +Y (above)
  faces.push(gradientCanvas(floor, floor, '#000')); // -Y (below)
  faces.push(gradientCanvas(top, accent, floor, [{ x: size * 0.5, y: size * 0.55, r: size * 0.45, color: accent }])); // +Z
  faces.push(gradientCanvas(top, warm, floor)); // -Z

  const cubeTex = new THREE.CubeTexture(faces);
  cubeTex.needsUpdate = true;
  cubeTex.colorSpace = THREE.SRGBColorSpace;

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileCubemapShader();
  const envMap = pmrem.fromCubemap(cubeTex).texture;
  pmrem.dispose();
  return envMap;
}

// ---------- Build the pendant group ----------
// Returns a THREE.Group containing all parts + refs to materials so the
// animation loop can tweak them per frame.
function buildPendant(THREE, glowColor) {
  const group = new THREE.Group();

  // --- Glass sphere ---
  const glassGeom = new THREE.SphereGeometry(1.0, 96, 96);
  const glassMat = new THREE.MeshPhysicalMaterial({
    transmission: 1.0,
    thickness: 0.6,
    roughness: 0.05,
    ior: 1.52,
    metalness: 0.0,
    attenuationDistance: 1.6,
    attenuationColor: new THREE.Color('#bff4d3'),
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    color: new THREE.Color('#e9fff2'),
    transparent: true,
    opacity: 1.0,
    side: THREE.DoubleSide,
    envMapIntensity: 1.2,
  });
  const glass = new THREE.Mesh(glassGeom, glassMat);
  group.add(glass);

  // --- Inner phosphor core ---
  // Two nested orbs: a bright solid core + a soft halo shell
  const coreGeom = new THREE.SphereGeometry(0.46, 64, 64);
  const coreMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(glowColor),
    emissive: new THREE.Color(glowColor),
    emissiveIntensity: 2.4,
    roughness: 1.0,
    metalness: 0.0,
    toneMapped: false,
  });
  const core = new THREE.Mesh(coreGeom, coreMat);
  group.add(core);

  const haloGeom = new THREE.SphereGeometry(0.78, 64, 64);
  const haloMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(glowColor),
    transparent: true,
    opacity: 0.16,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const halo = new THREE.Mesh(haloGeom, haloMat);
  group.add(halo);

  // --- Gold material (shared) ---
  const goldMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#d4ad6a'),
    metalness: 1.0,
    roughness: 0.18,
    envMapIntensity: 1.6,
  });
  const goldBrightMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#e9d7b1'),
    metalness: 1.0,
    roughness: 0.12,
    envMapIntensity: 1.8,
  });

  // --- Gold cage: 3 perpendicular thin rings around the sphere ---
  const ringGeom = new THREE.TorusGeometry(1.015, 0.018, 32, 220);
  const ringA = new THREE.Mesh(ringGeom, goldMat);
  ringA.rotation.x = Math.PI / 2;
  group.add(ringA);

  const ringB = new THREE.Mesh(ringGeom, goldMat);
  ringB.rotation.y = Math.PI / 2;
  group.add(ringB);

  // Equatorial belt (thicker)
  const beltGeom = new THREE.TorusGeometry(1.025, 0.035, 32, 220);
  const belt = new THREE.Mesh(beltGeom, goldBrightMat);
  group.add(belt);

  // --- Angel ---
  // Two large gold wings ARCHING from the top of the sphere and curling back
  // around it on either side — that's the iconic Ángel-de-la-Laguna silhouette.
  // A small head + halo sit above where the wings meet.
  const angel = new THREE.Group();
  angel.position.y = 0.0;
  group.add(angel);

  // Big wings — built from a CatmullRom curve that starts at top center,
  // arcs OUT then DOWN and forward to embrace the sphere.
  function makeBigWing(side) {
    const s = side === 'L' ? -1 : 1;
    const pts = [
      new THREE.Vector3(s * 0.05,  0.95, 0.0),  // root, just above sphere top
      new THREE.Vector3(s * 0.55,  1.05, -0.02),
      new THREE.Vector3(s * 1.05,  0.85, -0.10),
      new THREE.Vector3(s * 1.30,  0.40, -0.16),
      new THREE.Vector3(s * 1.32,  0.00, -0.20),
      new THREE.Vector3(s * 1.18, -0.45, -0.18),
      new THREE.Vector3(s * 0.85, -0.78, -0.12),
      new THREE.Vector3(s * 0.42, -0.95, -0.04),
    ];
    const curve = new THREE.CatmullRomCurve3(pts);
    const geom = new THREE.TubeGeometry(curve, 96, 0.025, 16, false);
    return new THREE.Mesh(geom, goldBrightMat);
  }
  angel.add(makeBigWing('L'));
  angel.add(makeBigWing('R'));

  // Inner feather lines — ONE per wing, slimmer, for depth
  function makeFeather(side, offset, scale) {
    const s = side === 'L' ? -1 : 1;
    const pts = [
      new THREE.Vector3(s * 0.06, 0.92 + offset, 0.0),
      new THREE.Vector3(s * (0.5 * scale),  1.00 + offset, -0.02),
      new THREE.Vector3(s * (0.95 * scale), 0.75 + offset * 0.6, -0.08),
      new THREE.Vector3(s * (1.10 * scale), 0.30 + offset * 0.4, -0.12),
      new THREE.Vector3(s * (1.08 * scale), -0.10 + offset * 0.2, -0.14),
      new THREE.Vector3(s * (0.85 * scale), -0.50 + offset * 0.2, -0.10),
    ];
    const curve = new THREE.CatmullRomCurve3(pts);
    const geom = new THREE.TubeGeometry(curve, 72, 0.010, 12, false);
    return new THREE.Mesh(geom, goldMat);
  }
  angel.add(makeFeather('L', -0.02, 0.85));
  angel.add(makeFeather('R', -0.02, 0.85));

  // A tiny robed angel-body silhouette in front of the sphere, where the
  // wings meet — head + small drape. Stays small so the sphere dominates.
  const headGeom = new THREE.SphereGeometry(0.07, 32, 32);
  const head = new THREE.Mesh(headGeom, goldBrightMat);
  head.position.set(0, 0.20, 0.95);
  angel.add(head);

  const haloRingGeom = new THREE.TorusGeometry(0.09, 0.010, 16, 64);
  const haloRing = new THREE.Mesh(haloRingGeom, goldBrightMat);
  haloRing.position.set(0, 0.28, 0.95);
  haloRing.rotation.x = Math.PI / 2.2;
  angel.add(haloRing);

  // Slim robed body (cone), front of sphere
  const robeGeom = new THREE.ConeGeometry(0.12, 0.42, 24, 1, true);
  const robe = new THREE.Mesh(robeGeom, goldBrightMat);
  robe.position.set(0, -0.06, 0.95);
  angel.add(robe);

  // --- Bail (the loop at the very top where the chain passes through) ---
  const bailGeom = new THREE.TorusGeometry(0.07, 0.015, 16, 48);
  const bail = new THREE.Mesh(bailGeom, goldBrightMat);
  bail.position.y = 1.16;
  bail.rotation.x = Math.PI / 2;
  group.add(bail);

  // --- Chain — just two subtle links above the bail, hinting at the chain ---
  const chainGroup = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const linkGeom = new THREE.TorusGeometry(0.022, 0.006, 10, 22);
    const link = new THREE.Mesh(linkGeom, goldMat);
    link.position.y = 1.22 + i * 0.038;
    link.rotation.x = i % 2 === 0 ? Math.PI / 2 : 0;
    chainGroup.add(link);
  }
  group.add(chainGroup);

  // --- Sparkle particles around the sphere ---
  const sparkleCount = 60;
  const sparkleGeom = new THREE.BufferGeometry();
  const positions = new Float32Array(sparkleCount * 3);
  for (let i = 0; i < sparkleCount; i++) {
    const r = 1.4 + Math.random() * 1.6;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i*3+0] = r * Math.sin(phi) * Math.cos(theta);
    positions[i*3+1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i*3+2] = r * Math.cos(phi);
  }
  sparkleGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const sparkleMat = new THREE.PointsMaterial({
    color: new THREE.Color(glowColor),
    size: 0.025,
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const sparkles = new THREE.Points(sparkleGeom, sparkleMat);
  group.add(sparkles);

  return {
    group,
    refs: { glass, core, halo, coreMat, haloMat, glassMat, goldMat, goldBrightMat, sparkleMat, angel, chainGroup, sparkles, belt, ringA, ringB, bail },
  };
}

const Pendant = forwardRef(function Pendant({ glowColor = '#7DFFB2', glowIntensity = 1.0, sceneVariant = 'pendant' }, ref) {
  const containerRef = useRef(null);
  const stateRef = useRef({
    progress: 0,
    glowIntensity,
    glowColor,
  });

  // Expose imperative setters to parent
  useImperativeHandle(ref, () => ({
    setProgress: (p) => { stateRef.current.progress = p; },
    setGlowIntensity: (v) => { stateRef.current.glowIntensity = v; },
    setGlowColor: (c) => {
      stateRef.current.glowColor = c;
      // hot-swap on the materials
      if (stateRef.current.materials) {
        const col = new window.THREE.Color(c);
        stateRef.current.materials.coreMat.color.copy(col);
        stateRef.current.materials.coreMat.emissive.copy(col);
        stateRef.current.materials.haloMat.color.copy(col);
        stateRef.current.materials.sparkleMat.color.copy(col);
      }
    },
  }), []);

  useEffect(() => {
    const THREE = window.THREE;
    if (!THREE) {
      console.error('THREE not loaded');
      return;
    }
    const container = containerRef.current;
    if (!container) return;

    // ---- Scene + camera ----
    const scene = new THREE.Scene();
    scene.background = null;

    const camera = new THREE.PerspectiveCamera(32, container.clientWidth / container.clientHeight, 0.1, 50);
    camera.position.set(0, 0, 4.5);

    // ---- Renderer ----
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);
    renderer.domElement.classList.add('scene-canvas');

    // ---- Environment ----
    const envMap = buildStudioEnvMap(THREE, renderer, {
      warm: '#bb8b5a',
      cool: '#3a6d63',
      accent: '#8ee0b3',
      top: '#1a3a32',
      floor: '#0a1a16',
    });
    scene.environment = envMap;

    // ---- Lights ----
    // Subtle ambient for shadow areas
    const ambient = new THREE.AmbientLight(0xffffff, 0.18);
    scene.add(ambient);

    // Key light: warm gold from upper-right
    const key = new THREE.DirectionalLight(0xffcf90, 1.4);
    key.position.set(3, 4, 5);
    scene.add(key);

    // Rim: cool phosphor from behind-left
    const rim = new THREE.DirectionalLight(0x7dffb2, 0.6);
    rim.position.set(-3, 1, -4);
    scene.add(rim);

    // Top soft fill
    const top = new THREE.DirectionalLight(0xffffff, 0.3);
    top.position.set(0, 6, 0);
    scene.add(top);

    // ---- Pendant ----
    const { group: pendant, refs } = buildPendant(THREE, stateRef.current.glowColor);
    scene.add(pendant);
    stateRef.current.materials = refs;

    // ---- Animation ----
    let raf = 0;
    let lastT = performance.now();
    const clock = { elapsed: 0 };

    function animate(now) {
      const dt = (now - lastT) / 1000;
      lastT = now;
      clock.elapsed += dt;

      const tRaw = clamp(stateRef.current.progress, 0, 1);
      const tEase = easeInOut(tRaw);

      // ===== Pendant rotation =====
      // Continuous slow spin tied to progress, with a small drift over time
      // Slow continuous spin tied to scroll + ambient drift
      pendant.rotation.y = tRaw * Math.PI * 2.2 + clock.elapsed * 0.06;
      // Gentle tilt: bow forward at start, level at end
      pendant.rotation.x = lerp(-0.10, 0.02, tEase) + Math.sin(clock.elapsed * 0.6) * 0.015;
      pendant.rotation.z = lerp(0.04, -0.02, tEase);

      // Pendant lives slightly RIGHT of center (text takes the left).
      // Closeup at SOUL phase brings it back toward center briefly.
      const phaseSoulProximity = Math.exp(-Math.pow((tRaw - 0.63) / 0.12, 2));
      const px = lerp(0.65, 0.45, tEase) * (1 - phaseSoulProximity * 0.85)
               + Math.sin(clock.elapsed * 0.35) * 0.02;
      // py: subtle vertical breath, never far from center
      const py = -0.05 + Math.sin(clock.elapsed * 0.4) * 0.03
                       + Math.sin(tRaw * Math.PI) * 0.06;
      pendant.position.set(px, py, 0);

      // ===== Camera zoom =====
      // Closeup at start (zooming on top arc), pull back as we scroll
      // Camera trajectory: closeup of the sphere at start, pulls back for full
      // pendant in middle, light push at the SOUL phase (closeup of phosphor),
      // then pull back further for EDITION reveal.
      // Piece-wise: 0..0.55 zoom out from 2.6 -> 4.6, 0.55..0.72 zoom in for soul (-> 3.4), 0.72..1 pull back to 5.4
      let camZ;
      if (tRaw < 0.55) {
        camZ = lerp(3.6, 4.8, easeInOut(tRaw / 0.55));
      } else if (tRaw < 0.72) {
        camZ = lerp(4.8, 3.0, easeInOut((tRaw - 0.55) / 0.17));
      } else {
        camZ = lerp(3.0, 5.8, easeInOut((tRaw - 0.72) / 0.28));
      }
      camera.position.z = camZ;
      // Tiny breathing camera offset for life
      camera.position.x = Math.sin(clock.elapsed * 0.25) * 0.05;
      camera.position.y = Math.cos(clock.elapsed * 0.3) * 0.04;
      camera.lookAt(0, 0, 0);

      // ===== Phosphor breathing + scroll-tied intensity =====
      const breathe = 0.5 + 0.5 * Math.sin(clock.elapsed * (Math.PI * 2) / 4.0);
      const baseGlow = stateRef.current.glowIntensity;
      // Glow peaks in the middle phases (when "ALMA" is shown)
      const phaseBoost = 1.0 + 1.4 * Math.exp(-Math.pow((tRaw - 0.6) / 0.18, 2));
      refs.coreMat.emissiveIntensity = (2.2 + breathe * 1.4) * baseGlow * phaseBoost;
      refs.haloMat.opacity = (0.12 + breathe * 0.08) * baseGlow * Math.min(phaseBoost, 1.8);
      refs.sparkleMat.opacity = (0.4 + breathe * 0.4) * baseGlow;

      // ===== Sparkles slow orbit =====
      refs.sparkles.rotation.y = clock.elapsed * 0.05;
      refs.sparkles.rotation.x = clock.elapsed * 0.03;

      // ===== Chain sway =====
      refs.chainGroup.rotation.z = Math.sin(clock.elapsed * 0.4) * 0.05;

      // ===== Theme-aware exposure =====
      // When the page background turns light, drop exposure slightly so the
      // glass doesn't get blown out
      const exposure = lerp(1.1, 0.78, tEase);
      renderer.toneMappingExposure = exposure;

      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    }
    raf = requestAnimationFrame(animate);

    // ---- Resize ----
    const onResize = () => {
      const w = container.clientWidth, h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(raf);
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
  }, []);

  return <div ref={containerRef} className="scene-host" style={{ position: 'absolute', inset: 0 }} />;
});

window.Pendant = Pendant;
