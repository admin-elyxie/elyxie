// === environment.js ===
// Drops the Elyxie hero environment (elyxie-environment.glb) INTO the same
// Three.js scene that pendant.jsx builds, so the angel stands in the lagoon
// with correct depth, shared camera and shared reflections.
//
// The env GLB is plain (un-compressed) glTF, so no Draco is required to read
// it. It is authored "large" (lagoon ~120 units across, Y-up, water at y=0,
// camera-side toward +Z). This module scales it down and drops the waterline
// to the angel's feet, then adds the things that don't bake well into a mesh:
// scene fog, a reflective water material, volumetric god-ray shafts and the
// back-lit key/fill lighting.
//
// ──────────────────────────────────────────────────────────────────────────
// HOW TO WIRE IT IN  (3 edits to pendant.jsx)
//
//   1) Load this file once, after three.js is ready. In index.html add, after
//      the script tag that loads pendant.jsx:
//          <script src="environment.js"></script>
//
//   2) In pendant.jsx, right after the scene/camera/renderer/lights are made
//      (just before `const angel = new THREE.Group();`), add:
//
//          const elyxieEnv = window.addElyxieEnvironment({
//            THREE, scene, renderer, camera,
//            modelUrl: 'assets/models/environment.glb',
//          });
//
//   3) Inside `animate(now)`, after computing `tRaw`/`clock.elapsed`, add:
//
//          if (elyxieEnv) elyxieEnv.update(clock.elapsed, tRaw);
//
//      and bump the camera far plane once at setup so the sky dome fits:
//          camera.far = 200; camera.updateProjectionMatrix();
//
// That's it. The dome becomes the hero background (the canvas is no longer
// transparent where the sky shows), so you can drop the HTML background image.
// ──────────────────────────────────────────────────────────────────────────

(function () {
  const DEFAULTS = {
    scale: 0.055,     // author units -> scene units
    waterY: -0.92,    // world Y the lagoon surface sits at (angel feet ~ -1)
    z: 0.0,           // push the whole valley along Z if needed
    fog: true,
    godrays: true,
    sunDir: [0.16, 0.54, -0.83], // matches the baked sky break
  };

  // Soft radial sprite texture for the god-ray shafts.
  function rayTexture(THREE) {
    const c = document.createElement('canvas');
    c.width = 64; c.height = 256;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0.0, 'rgba(255,247,222,0.0)');
    g.addColorStop(0.18, 'rgba(255,244,212,0.55)');
    g.addColorStop(0.5, 'rgba(255,240,200,0.30)');
    g.addColorStop(1.0, 'rgba(255,236,190,0.0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 256);
    // taper the sides
    const sg = ctx.createLinearGradient(0, 0, 64, 0);
    sg.addColorStop(0, 'rgba(0,0,0,1)');
    sg.addColorStop(0.5, 'rgba(0,0,0,0)');
    sg.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = sg;
    ctx.fillRect(0, 0, 64, 256);
    ctx.globalCompositeOperation = 'source-over';
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  // PMREM-able sky gradient so the water can reflect the warm light break.
  // Palette is Villeneuve / Deakins: deep petrol blue everywhere with a
  // tight golden break above. Most of the sky reads cool & moody; the warm
  // streak only appears where the clouds part, casting the rim light onto
  // the angel.
  function buildSkyEnv(THREE, renderer) {
    const size = 256;
    function face(top, mid, bot, accent) {
      const c = document.createElement('canvas');
      c.width = size; c.height = size;
      const ctx = c.getContext('2d');
      const g = ctx.createLinearGradient(0, 0, 0, size);
      g.addColorStop(0, top); g.addColorStop(0.55, mid); g.addColorStop(1, bot);
      ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
      if (accent) {
        const rg = ctx.createRadialGradient(size * 0.5, size * 0.32, 0, size * 0.5, size * 0.32, size * 0.45);
        rg.addColorStop(0, accent); rg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = rg; ctx.fillRect(0, 0, size, size);
      }
      return c;
    }
    // Cool petrol palette
    const storm   = '#070b12';   // deep navy storm
    const horizon = '#1b2a35';   // misty teal at the horizon
    const floor   = '#03060a';   // black water floor
    const warm    = 'rgba(255,210,130,0.85)'; // tight golden break
    const faces = [
      face(storm, horizon, floor),                  // +x
      face(storm, horizon, floor),                  // -x
      face(storm, storm,   storm, warm),            // +y light break
      face(floor, floor,   floor),                  // -y
      face(storm, horizon, floor, warm),            // +z (camera side)
      face(storm, horizon, floor),                  // -z
    ];
    const cube = new THREE.CubeTexture(faces);
    cube.needsUpdate = true; cube.colorSpace = THREE.SRGBColorSpace;
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileCubemapShader();
    const env = pmrem.fromCubemap(cube).texture;
    pmrem.dispose();
    return env;
  }

  window.addElyxieEnvironment = function addElyxieEnvironment(opts) {
    const o = Object.assign({}, DEFAULTS, opts);
    const { THREE, scene, renderer, camera } = o;
    const group = new THREE.Group();
    group.scale.setScalar(o.scale);
    group.position.set(0, o.waterY, o.z);
    scene.add(group);

    const sun = new THREE.Vector3().fromArray(o.sunDir).normalize();
    const skyEnv = buildSkyEnv(THREE, renderer);

    // Fog is held in `envFog`; we only attach it to the scene while the
    // environment is visible. That avoids haze leaking into other sections
    // where the angel sits on a neutral page background.

    // Cinematic 3-point: warm rim/key from the cloud break, cool teal fill
    // from the camera-front, almost no ambient so shadows on the angel
    // stay deep and the gold reads against a dark scene.
    const sunWorld = sun.clone().multiplyScalar(20);
    const key = new THREE.DirectionalLight(0xffd28a, 2.4); // warm golden rim
    key.position.copy(sunWorld);
    scene.add(key);
    const sky = new THREE.HemisphereLight(0x29404e, 0x040608, 0.45); // cool sky / black floor
    scene.add(sky);
    const fill = new THREE.DirectionalLight(0x4d6a82, 0.22); // soft cold fill
    fill.position.set(-2, 1, 6);
    scene.add(fill);

    const waterMeshes = [];
    const allMeshes = [];
    const skyDomeMeshes = [];
    // Keep a private fog handle so we can attach/detach it from the scene as
    // the environment fades in / out. Deep petrol tone so mountains read
    // silhouetted instead of washed out.
    const envFog = new THREE.Fog(new THREE.Color('#1a2733'), 5.0, 18.0);
    let loaded = false;

    // Reuse pendant's loader if present (handles Draco/KTX2/Meshopt); the env
    // is uncompressed so a bare GLTFLoader works too.
    const loader = (typeof window.__elyxieGetLoader === 'function')
      ? window.__elyxieGetLoader(renderer)
      : new window.GLTFLoader();

    loader.load(o.modelUrl, (gltf) => {
      const root = gltf.scene;
      root.traverse((m) => {
        if (!m.isMesh) return;
        const name = m.name || '';
        m.frustumCulled = false;
        allMeshes.push(m);
        if (name.startsWith('SkyDome')) {
          // Replace the baked sky with a procedural shader so we control
          // mood: deep petrol gradient + small golden cloud break high in
          // the dome, no fog application (the dome IS the background).
          const skyMat = new THREE.ShaderMaterial({
            uniforms: {
              uTop:    { value: new THREE.Color('#04070d') },
              uMid:    { value: new THREE.Color('#0d1722') },
              uHoriz:  { value: new THREE.Color('#1a2a37') },
              uWarm:   { value: new THREE.Color('#ffc275') },
              uBreakY: { value: 0.62 },
              uBreakW: { value: 0.16 },
            },
            vertexShader: `
              varying vec3 vWorldPos;
              void main() {
                vec4 wp = modelMatrix * vec4(position, 1.0);
                vWorldPos = wp.xyz;
                gl_Position = projectionMatrix * viewMatrix * wp;
              }`,
            fragmentShader: `
              varying vec3 vWorldPos;
              uniform vec3 uTop, uMid, uHoriz, uWarm;
              uniform float uBreakY, uBreakW;
              void main() {
                vec3 d = normalize(vWorldPos);
                float h = clamp(d.y * 0.5 + 0.5, 0.0, 1.0); // 0=floor 1=zenith
                // base petrol gradient
                vec3 col = mix(uHoriz, uMid, smoothstep(0.45, 0.7, h));
                col = mix(col, uTop, smoothstep(0.78, 1.0, h));
                // tight golden break, biased toward camera side (-z)
                float side = clamp(1.0 - abs(d.x) * 1.4, 0.0, 1.0);
                float front = clamp(0.5 + d.z * -0.6, 0.0, 1.0);
                float breakMask = exp(-pow((h - uBreakY) / uBreakW, 2.0));
                breakMask *= side * front;
                col += uWarm * breakMask * 1.8;
                // subtle vignette toward floor
                col *= mix(0.6, 1.0, smoothstep(0.15, 0.5, h));
                gl_FragColor = vec4(col, 1.0);
              }`,
            side: THREE.BackSide,
            depthWrite: false,
            toneMapped: true,
            transparent: true,
          });
          m.material = skyMat;
          m.material.fog = false;
          m.renderOrder = -10;
          skyDomeMeshes.push(m);
        } else if (name.startsWith('Water')) {
          // Reflective lagoon: very low roughness + sky env so the cloud
          // break mirrors down the lake centre. The vertex colors carry
          // the baked under-light streak.
          const mat = new THREE.MeshStandardMaterial({
            color: new THREE.Color('#03060a'),
            metalness: 0.05, roughness: 0.06,
            envMap: skyEnv, envMapIntensity: 1.8,
            vertexColors: true, transparent: true, opacity: 0.96,
          });
          m.material = mat;
          m.userData.baseY = m.geometry.attributes.position.array.slice();
          waterMeshes.push(m);
        } else {
          // Terrain + rocks: darken via tint and lift envMap a touch so the
          // golden break catches the wet-rock edges nearest the lake.
          if (m.material) {
            if (m.material.color) m.material.color.multiplyScalar(0.55);
            m.material.envMap = skyEnv;
            m.material.envMapIntensity = 0.55;
            m.material.roughness = 0.92;
            m.material.metalness = 0.0;
            m.material.needsUpdate = true;
          }
        }
      });
      group.add(root);
      loaded = true;
    }, undefined, (e) => console.error('Failed to load environment GLB:', e));

    // ---- god-ray shafts (additive, depth-write off) ----
    let rays = null;
    if (o.godrays) {
      rays = new THREE.Group();
      const tex = rayTexture(THREE);
      const n = 9;
      for (let i = 0; i < n; i++) {
        const w = 0.7 + Math.random() * 1.1;
        const h = 11 + Math.random() * 5;
        const mat = new THREE.MeshBasicMaterial({
          map: tex, transparent: true, opacity: 0.0,
          blending: THREE.AdditiveBlending, depthWrite: false,
          depthTest: true, side: THREE.DoubleSide, toneMapped: false,
          color: new THREE.Color('#ffcf80'),
        });
        const q = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
        // fan the shafts out from the light break toward the water,
        // angled so they read as parallel rays from a single high source.
        const spread = (i / (n - 1) - 0.5);
        q.position.set(spread * 3.6, 2.6, -3.5 - Math.random() * 2.5);
        q.rotation.z = spread * 0.35;
        q.userData = { phase: Math.random() * 6.28, base: 0.30 + Math.random() * 0.25 };
        rays.add(q);
      }
      scene.add(rays);
    }

    // Track each mesh's "target" opacity so setVisibility can multiply
    // against it (water = 0.92, terrain/sky = 1.0).
    function captureTargetOpacities() {
      for (const m of allMeshes) {
        if (m.userData.targetOpacity == null && m.material) {
          m.userData.targetOpacity = m.material.opacity ?? 1;
          // mark transparent so opacity reads correctly while fading
          m.material.transparent = true;
        }
      }
    }

    return {
      group,
      // Smoothly fade the environment in/out. v ∈ [0,1]. We attach/detach
      // fog, scale light intensities, and crossfade every mesh's opacity so
      // the lagoon, sky and mountains all appear only when called for.
      setVisibility(v) {
        captureTargetOpacities();
        const on = v > 0.001;
        group.visible = on;
        if (rays) {
          rays.visible = on;
        }
        // Lights: scale relative to authored intensities.
        key.intensity  = 2.4  * v;
        sky.intensity  = 0.45 * v;
        fill.intensity = 0.22 * v;
        // Fog: only attach when the env is on. Slightly tighter near plane
        // at low v so the fade reads as fog dissolving instead of popping.
        if (on) {
          if (scene.fog !== envFog) scene.fog = envFog;
          envFog.near = 3.0 + (5.0 - 3.0) * v;
          envFog.far  = 12.0 + (18.0 - 12.0) * v;
          envFog.color.setRGB(0.102, 0.153, 0.200); // deep petrol
        } else if (scene.fog === envFog) {
          scene.fog = null;
        }
        for (const m of allMeshes) {
          if (!m.material) continue;
          m.material.opacity = (m.userData.targetOpacity ?? 1) * v;
          // SkyDome was rendered at order -10 (behind everything); keep that
          // so terrain / water still draw on top during the fade.
        }
      },
      update(elapsed, progress) {
        // gentle lagoon ripple
        for (const m of waterMeshes) {
          const pos = m.geometry.attributes.position;
          const base = m.userData.baseY;
          for (let i = 0; i < pos.count; i++) {
            const x = base[i * 3], z = base[i * 3 + 2];
            const y = Math.sin(x * 0.6 + elapsed * 0.8) * 0.12
                    + Math.cos(z * 0.4 - elapsed * 0.6) * 0.10;
            pos.array[i * 3 + 1] = y;
          }
          pos.needsUpdate = true;
          m.geometry.computeVertexNormals();
        }
        // shimmer the god-rays and always face the camera
        if (rays) {
          rays.children.forEach((q) => {
            const u = q.userData;
            q.material.opacity = u.base * (0.6 + 0.4 * Math.sin(elapsed * 0.7 + u.phase));
            if (camera) q.lookAt(camera.position.x, q.position.y, camera.position.z);
          });
        }
      },
      dispose() {
        scene.remove(group);
        if (rays) scene.remove(rays);
        skyEnv.dispose();
      },
    };
  };
})();
