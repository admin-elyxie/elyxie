// === Pendant.jsx ===
// Three.js scene that displays the Elyxie angel GLB, driven by a scroll
// `progress` (0..1). The original procedural pendant (glass sphere + glow +
// gold cage) was replaced by a real 3D model. The same imperative API is
// preserved so app.jsx doesn't need to change.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';

const { useEffect, useRef, useImperativeHandle, forwardRef } = React;

const easeInOut = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const MODEL_URL = 'assets/models/angel.glb';

// ---------- Procedural studio environment ----------
// Generates a 6-face cube texture in code so we get nice PBR reflections
// without needing to ship an HDR file.
function buildStudioEnvMap(renderer, palette) {
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
  faces.push(gradientCanvas(top, warm, floor, [{ x: size * 0.7, y: size * 0.35, r: size * 0.5, color: warm }])); // +X
  faces.push(gradientCanvas(top, cool, floor, [{ x: size * 0.3, y: size * 0.5,  r: size * 0.5, color: cool }])); // -X
  faces.push(gradientCanvas(top, top, warm));     // +Y
  faces.push(gradientCanvas(floor, floor, '#000')); // -Y
  faces.push(gradientCanvas(top, accent, floor, [{ x: size * 0.5, y: size * 0.55, r: size * 0.45, color: accent }])); // +Z
  faces.push(gradientCanvas(top, warm, floor));    // -Z

  const cubeTex = new THREE.CubeTexture(faces);
  cubeTex.needsUpdate = true;
  cubeTex.colorSpace = THREE.SRGBColorSpace;

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileCubemapShader();
  const envMap = pmrem.fromCubemap(cubeTex).texture;
  pmrem.dispose();
  return envMap;
}

// Single loader pair shared across mounts
let _loader = null;
function getLoader(renderer) {
  if (_loader) return _loader;
  const draco = new DRACOLoader();
  draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
  const ktx2 = new KTX2Loader()
    .setTranscoderPath('https://unpkg.com/three@0.160.0/examples/jsm/libs/basis/')
    .detectSupport(renderer);
  const gltf = new GLTFLoader()
    .setDRACOLoader(draco)
    .setKTX2Loader(ktx2)
    .setMeshoptDecoder(MeshoptDecoder);
  _loader = gltf;
  return _loader;
}

// Polished gold for the angel; overrides whatever materials ship in the GLB.
function buildGoldMaterial(tone = 'warm') {
  if (tone === 'bright') {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color('#e9d7b1'),
      metalness: 1.0,
      roughness: 0.14,
      envMapIntensity: 1.7,
    });
  }
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color('#d4ad6a'),
    metalness: 1.0,
    roughness: 0.22,
    envMapIntensity: 1.5,
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
        const col = new THREE.Color(c);
        refs.rim.color.copy(col);
      }
    },
  }), []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // ---- Scene + camera ----
    const scene = new THREE.Scene();
    scene.background = null;

    const camera = new THREE.PerspectiveCamera(32, container.clientWidth / container.clientHeight, 0.1, 50);
    camera.position.set(0, 0, 4.5);

    // ---- Renderer ----
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);
    renderer.domElement.classList.add('scene-canvas');

    // ---- Environment ----
    const envMap = buildStudioEnvMap(renderer, {
      warm: '#bb8b5a',
      cool: '#3a6d63',
      accent: '#8ee0b3',
      top: '#1a3a32',
      floor: '#0a1a16',
    });
    scene.environment = envMap;

    // ---- Lights ----
    const ambient = new THREE.AmbientLight(0xffffff, 0.22);
    scene.add(ambient);

    const key = new THREE.DirectionalLight(0xffcf90, 1.5);
    key.position.set(3, 4, 5);
    scene.add(key);

    const rim = new THREE.DirectionalLight(new THREE.Color(stateRef.current.glowColor), 0.85);
    rim.position.set(-3, 1, -4);
    scene.add(rim);

    const top = new THREE.DirectionalLight(0xffffff, 0.35);
    top.position.set(0, 6, 0);
    scene.add(top);

    // ---- Angel group placeholder (filled async after GLB loads) ----
    const angel = new THREE.Group();
    scene.add(angel);
    stateRef.current.materials = { rim };

    let cancelled = false;
    const loader = getLoader(renderer);
    loader.load(
      MODEL_URL,
      (gltf) => {
        if (cancelled) return;
        const model = gltf.scene;

        // CAD source is mm-scale; bbox max ~0.06. Scale to fit ~unit sphere.
        const box = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        box.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        const targetSize = 1.9;
        const scale = targetSize / maxDim;
        model.scale.setScalar(scale);

        // Recompute box after scaling so we can center it
        const box2 = new THREE.Box3().setFromObject(model);
        const center = new THREE.Vector3();
        box2.getCenter(center);
        model.position.sub(center);

        // Override materials → polished gold
        const goldWarm = buildGoldMaterial('warm');
        const goldBright = buildGoldMaterial('bright');
        let idx = 0;
        model.traverse((o) => {
          if (o.isMesh) {
            o.material = (idx++ % 5 === 0) ? goldBright : goldWarm;
            o.castShadow = false;
            o.receiveShadow = false;
          }
        });

        angel.add(model);
      },
      undefined,
      (err) => {
        console.error('Failed to load angel GLB:', err);
      },
    );

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

      // Continuous slow spin tied to scroll + ambient drift
      angel.rotation.y = tRaw * Math.PI * 2.2 + clock.elapsed * 0.06;
      angel.rotation.x = lerp(-0.10, 0.02, tEase) + Math.sin(clock.elapsed * 0.6) * 0.015;
      angel.rotation.z = lerp(0.04, -0.02, tEase);

      // Position: lives slightly right of center, drifts back at SOUL phase
      const phaseSoulProximity = Math.exp(-Math.pow((tRaw - 0.63) / 0.12, 2));
      const px = lerp(0.65, 0.45, tEase) * (1 - phaseSoulProximity * 0.85)
               + Math.sin(clock.elapsed * 0.35) * 0.02;
      const py = -0.05 + Math.sin(clock.elapsed * 0.4) * 0.03
                       + Math.sin(tRaw * Math.PI) * 0.06;
      angel.position.set(px, py, 0);

      // Camera trajectory matches the original choreography
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

      // Rim light breathing tied to glowIntensity (preserves Tweaks panel)
      const breathe = 0.5 + 0.5 * Math.sin(clock.elapsed * (Math.PI * 2) / 4.0);
      const phaseBoost = 1.0 + 1.0 * Math.exp(-Math.pow((tRaw - 0.6) / 0.18, 2));
      rim.intensity = (0.55 + breathe * 0.35) * stateRef.current.glowIntensity * phaseBoost;

      // Exposure: bright dark scene → dimmer light scene
      renderer.toneMappingExposure = lerp(1.1, 0.78, tEase);

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
      cancelled = true;
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
