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

      const envMap = buildStudioEnvMap(THREE, renderer, {
        warm: '#bb8b5a',
        cool: '#3a6d63',
        accent: '#8ee0b3',
        top: '#1a3a32',
        floor: '#0a1a16',
      });
      scene.environment = envMap;

      const ambient = new THREE.AmbientLight(0xffffff, 0.22);
      scene.add(ambient);

      const key = new THREE.DirectionalLight(0xffcf90, 1.5);
      key.position.set(3, 4, 5);
      scene.add(key);

      const rim = new THREE.DirectionalLight(new THREE.Color(stateRef.current.glowColor), 0.3);
      rim.position.set(-3, 1, -4);
      scene.add(rim);

      // Warm fill on the camera-facing side so the gold reads warm, not green.
      const fill = new THREE.DirectionalLight(0xffe6b0, 0.55);
      fill.position.set(1.5, 0.5, 5);
      scene.add(fill);

      const top = new THREE.DirectionalLight(0xffffff, 0.35);
      top.position.set(0, 6, 0);
      scene.add(top);

      const angel = new THREE.Group();
      scene.add(angel);
      stateRef.current.materials = { rim };

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

          // Recompute normals: vertex clustering during offline decimation
          // can produce meshes without (or with broken) normals, which makes
          // MeshStandardMaterial render as solid black.
          const goldWarm = buildGoldMaterial(THREE, 'warm');
          const goldBright = buildGoldMaterial(THREE, 'bright');
          let idx = 0;
          model.traverse((o) => {
            if (o.isMesh) {
              if (o.geometry) {
                o.geometry.computeVertexNormals();
                o.geometry.normalizeNormals();
              }
              o.material = (idx++ % 5 === 0) ? goldBright : goldWarm;
              o.castShadow = false;
              o.receiveShadow = false;
            }
          });

          // Scale to fit the on-screen frame, then center at origin.
          // setFromObject takes the just-applied rotation into account.
          const box = new THREE.Box3().setFromObject(model);
          const size = new THREE.Vector3();
          box.getSize(size);
          const maxDim = Math.max(size.x, size.y, size.z) || 1;
          // Leaves a margin so the halo/wing tips stay in frame at the closest
          // camera position (z=3 during the SOUL phase).
          const targetSize = 2.0;
          model.scale.setScalar(targetSize / maxDim);

          const box2 = new THREE.Box3().setFromObject(model);
          const center = new THREE.Vector3();
          box2.getCenter(center);
          model.position.sub(center);

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

        angel.rotation.y = tRaw * Math.PI * 2.2 + clock.elapsed * 0.06;
        angel.rotation.x = lerp(-0.10, 0.02, tEase) + Math.sin(clock.elapsed * 0.6) * 0.015;
        angel.rotation.z = lerp(0.04, -0.02, tEase);

        const phaseSoulProximity = Math.exp(-Math.pow((tRaw - 0.63) / 0.12, 2));
        const px = lerp(0.65, 0.45, tEase) * (1 - phaseSoulProximity * 0.85)
                 + Math.sin(clock.elapsed * 0.35) * 0.02;
        const py = -0.05 + Math.sin(clock.elapsed * 0.4) * 0.03
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
        camera.position.z = camZ;
        camera.position.x = Math.sin(clock.elapsed * 0.25) * 0.05;
        camera.position.y = Math.cos(clock.elapsed * 0.3) * 0.04;
        camera.lookAt(0, 0, 0);

        const breathe = 0.5 + 0.5 * Math.sin(clock.elapsed * (Math.PI * 2) / 4.0);
        const phaseBoost = 1.0 + 1.6 * Math.exp(-Math.pow((tRaw - 0.6) / 0.18, 2));
        // Keep the green rim subtle by default so the 22 k gold reads as gold,
        // not as a green-tinted surface. The phaseBoost peak around SOUL phase
        // still blooms the green to recall the original "phosphor" identity.
        rim.intensity = (0.18 + breathe * 0.10) * stateRef.current.glowIntensity * phaseBoost;

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
