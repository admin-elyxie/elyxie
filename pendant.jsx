// === Pendant.jsx ===
// Three.js scene that displays the Elyxie angel GLB, driven by a scroll
// `progress` (0..1). The procedural pendant has been replaced by a real
// 3D model. Three.js + the GLB loaders are pre-loaded by the inline module
// preamble in index.html and exposed on window; we wait for the
// `three-ready` event (or window.__threeReady) before building the scene.

const { useEffect, useRef, useImperativeHandle, forwardRef } = React;

const easeInOut = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
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

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(container.clientWidth, container.clientHeight);
      renderer.setClearColor(0x000000, 0);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
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

      const sphereMeshes = [];
      stateRef.current.materials = { rim, sphereLight, sphereMeshes };

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
            mesh.castShadow = false;
            mesh.receiveShadow = false;
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
          }

          angel.add(model);
          modelLoaded = true;
        },
        undefined,
        (err) => { console.error('Failed to load angel GLB:', err); },
      );

      let raf = 0;
      let lastT = performance.now();
      const clock = { elapsed: 0 };

      function animate(now) {
        const dt = (now - lastT) / 1000;
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

        if (window.__debugFreezeY !== undefined) {
          angel.rotation.y = window.__debugFreezeY;
          angel.rotation.x = 0;
          angel.rotation.z = 0;
        } else {
          // Auto-rotation removed per design v1.4: model stays in its default
          // forward-facing pose. EXCEPTION: during phase 02 (ORIGEN), turn
          // the angel −30° around Y so its face quarter-profiles toward the
          // viewer's left and the right shoulder catches the upper-right
          // sun-break — matches the reference Laguna Negra composite.
          angel.rotation.y = (-Math.PI / 6) * phaseOriginProximity;
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
          pxBase = lerp(0.30, 0.18, tEase);
          pyOffset = -0.15;
          camZBase = null;            // keep original scroll-driven zoom
        } else {
          pxBase = lerp(0.65, 0.45, tEase);
          pyOffset = 0;
          camZBase = null;
        }

        // During phase 02 (ORIGEN), pull the angel toward horizontal center so
        // it sits over the Laguna Negra backdrop the way the reference shows
        // (orb on the central axis, wings spreading symmetrically).
        const pxOrigin = lerp(pxBase, 0, phaseOriginProximity);
        // And lift the model so the orb lands at ~47–49% of viewport Y and the
        // feet meet the photo's water line at ~65–70 % Y.
        const pyOriginShift = 0.30 * phaseOriginProximity;

        const px = pxOrigin * (1 - phaseSoulProximity * 0.85)
                 + Math.sin(clock.elapsed * 0.35) * 0.02;
        const py = -0.05 + pyOffset + pyOriginShift
                 + Math.sin(clock.elapsed * 0.4) * 0.03
                 + Math.sin(tRaw * Math.PI) * 0.06;
        angel.position.set(px, py, 0);

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
        camera.position.z = camZ;
        camera.position.x = Math.sin(clock.elapsed * 0.25) * 0.05;
        camera.position.y = Math.cos(clock.elapsed * 0.3) * 0.04;
        camera.lookAt(0, 0, 0);

        // ===== Phase 02 (ORIGEN) light shaping =====
        // Same gaussian as the backdrop + framing, so light/camera/photo all
        // ramp in synchronously. At peak: strong warm sun from upper-right,
        // soft cool bounce from below-left, and the base ambient dimmed so
        // shadows on the angel's left side actually read dark.
        phaseSun.intensity        = 3.4 * phaseOriginProximity;
        phaseSunBounce.intensity  = 0.45 * phaseOriginProximity;
        ambient.intensity         = 0.22 * lerp(1.0, 0.45, phaseOriginProximity);
        fill.intensity            = 0.75 * lerp(1.0, 0.55, phaseOriginProximity);
        top.intensity             = 0.35 * lerp(1.0, 0.60, phaseOriginProximity);

        const breathe = 0.5 + 0.5 * Math.sin(clock.elapsed * (Math.PI * 2) / 4.0);
        const phaseBoost = 1.0 + 1.6 * Math.exp(-Math.pow((tRaw - 0.6) / 0.18, 2));
        // Whisper-soft green rim — gold dominates. SOUL phase blooms the green.
        rim.intensity = (0.07 + breathe * 0.04) * stateRef.current.glowIntensity * phaseBoost;
        // Local-only orb glow: the PointLight is tight (1.5 range, 2.5 decay)
        // so this intensity only affects the orb and nearest feathers.
        sphereLight.intensity = (0.45 + breathe * 0.30) * stateRef.current.glowIntensity * Math.min(phaseBoost, 2.0);
        stateRef.current.materials.sphereMeshes.forEach((m) => {
          if (m.material) {
            m.material.emissiveIntensity = (0.85 + breathe * 0.35) * stateRef.current.glowIntensity * Math.min(phaseBoost, 1.8);
          }
        });

        renderer.toneMappingExposure = lerp(1.1, 0.78, tEase);

        renderer.render(scene, camera);
        raf = requestAnimationFrame(animate);
      }
      raf = requestAnimationFrame(animate);

      const onResize = () => {
        const w = container.clientWidth, h = container.clientHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      };
      window.addEventListener('resize', onResize);

      dispose = () => {
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
    });

    return () => {
      disposed = true;
      dispose();
    };
  }, []);

  return <div ref={containerRef} className="scene-host" style={{ position: 'absolute', inset: 0 }} />;
});

window.Pendant = Pendant;
