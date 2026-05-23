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

      // ── Lagoon environment ────────────────────────────────────────────
      // Loaded once, faded in only while the user is reading section 02
      // (ORIGEN). Sky dome needs a far camera plane.
      camera.far = 200;
      camera.updateProjectionMatrix();
      window.__elyxieGetLoader = () => getLoader(renderer);
      const elyxieEnv = window.addElyxieEnvironment
        ? window.addElyxieEnvironment({
            THREE, scene, renderer, camera,
            modelUrl: 'assets/models/environment.glb',
          })
        : null;
      // start hidden — fade is driven from the animate loop
      if (elyxieEnv) elyxieEnv.setVisibility(0);

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

        // ── Section 02 (ORIGEN) window ─────────────────────────────────
        // Range from app.jsx PHASES is [0.18, 0.40]. We fade the lagoon
        // environment in slightly before the phase starts and out slightly
        // after it ends so the cinematic reveal feels intentional.
        let sec02W;
        if (tRaw < 0.13 || tRaw > 0.45) sec02W = 0;
        else if (tRaw < 0.20) sec02W = easeInOut((tRaw - 0.13) / 0.07);
        else if (tRaw > 0.38) sec02W = easeInOut(Math.max(0, (0.45 - tRaw) / 0.07));
        else sec02W = 1;

        if (elyxieEnv) elyxieEnv.setVisibility(sec02W);

        if (window.__debugFreezeY !== undefined) {
          angel.rotation.y = window.__debugFreezeY;
          angel.rotation.x = 0;
          angel.rotation.z = 0;
        } else {
          // Default pose: forward-facing. ONLY during section 02 (ORIGEN)
          // we rotate ~30° to the right so the angel reads as standing
          // dynamically in the lagoon, matching the reference comp. The
          // rotation crossfades back to 0 outside section 02.
          angel.rotation.y = Math.PI / 6 * sec02W; // +30° at full sec02W
          angel.rotation.x = 0;
          angel.rotation.z = 0;
        }
        // Keep debug freeze hook so we can verify back/side views via JS

        const phaseSoulProximity = Math.exp(-Math.pow((tRaw - 0.63) / 0.12, 2));

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

        const px = pxBase * (1 - phaseSoulProximity * 0.85)
                 + Math.sin(clock.elapsed * 0.35) * 0.02;
        const py = -0.05 + pyOffset
                 + Math.sin(clock.elapsed * 0.4) * 0.03
                 + Math.sin(tRaw * Math.PI) * 0.06;

        // Section 02 (ORIGEN) override: center the angel horizontally and
        // sink it ankle-deep into the water so the lagoon visibly surrounds
        // the figure. Crossfades with sec02W so other sections keep their
        // existing framing exactly as before.
        const cinPx = 0.0;
        const cinPy = -0.18;                             // ankles in water
        const pxFinal = lerp(px, cinPx, sec02W);
        const pyFinal = lerp(py, cinPy, sec02W);
        angel.position.set(pxFinal, pyFinal, 0);

        let camZ;
        if (tRaw < 0.55) {
          camZ = lerp(3.6, 4.8, easeInOut(tRaw / 0.55));
        } else if (tRaw < 0.72) {
          camZ = lerp(4.8, 3.0, easeInOut((tRaw - 0.55) / 0.17));
        } else {
          camZ = lerp(3.0, 5.8, easeInOut((tRaw - 0.72) / 0.28));
        }
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
        // Section 02: pull the camera back and DOWN for a low cinematic
        // angle ("from the shore looking up"), then crossfade back to the
        // scroll-driven zoom. Other sections are untouched.
        const cinCamZ = isMobile ? 6.2 : (isTablet ? 5.6 : 5.2);
        camZ = lerp(camZ, cinCamZ, sec02W);
        // Renderer exposure: dim everything during sec02 so the petrol
        // palette + golden rim read like a Roger Deakins night-dawn,
        // instead of the bright studio look used in other sections.
        const baseExposure = lerp(1.1, 0.78, tEase);
        renderer.toneMappingExposure = lerp(baseExposure, 0.62, sec02W);
        camera.position.z = camZ;
        camera.position.x = Math.sin(clock.elapsed * 0.25) * 0.05;
        // Slightly drop the camera during section 02 so the angle reads
        // as "from the shoreline looking up" — feet on water, sky above.
        const baseCamY = Math.cos(clock.elapsed * 0.3) * 0.04;
        camera.position.y = lerp(baseCamY, baseCamY - 0.45, sec02W);
        // Aim point also lifts a touch so the wings sit higher in frame
        const lookY = lerp(0, 0.25, sec02W);
        camera.lookAt(0, lookY, 0);

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

        // Section 02: dial DOWN the studio envMap on the gold so the angel
        // is dominated by the lagoon's directional key (warm rim) + petrol
        // ambient, instead of looking like a gold studio render.
        if (sec02W > 0 && angel.children.length) {
          angel.traverse((o) => {
            if (!o.isMesh || !o.material) return;
            if (o.material._baseEnvIntensity == null) {
              o.material._baseEnvIntensity = o.material.envMapIntensity ?? 1;
            }
            o.material.envMapIntensity = o.material._baseEnvIntensity * (1 - 0.55 * sec02W);
          });
        }

        // Drive the lagoon's water ripple + god-ray shimmer on every frame
        // (cheap even when invisible, and keeps the animation phase coherent
        // when the env fades back in for the next visit to section 02).
        if (elyxieEnv) elyxieEnv.update(clock.elapsed, tRaw);

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
