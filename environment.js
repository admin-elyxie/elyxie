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
    // Reference photo: the sun-break sits in the UPPER-RIGHT quadrant and
    // light cascades down-left. Bias sun toward +X (right) and slightly
    // toward camera so the warm rim catches the angel from the right.
    sunDir: [0.62, 0.50, -0.45],
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
    // accentX/accentY default to centred so existing callers don't change.
    // We pass biased coordinates for the +y (zenith) and +x (right) faces
    // so the water reflects the golden break in the upper-right quadrant.
    function face(top, mid, bot, accent, accentX, accentY) {
      const c = document.createElement('canvas');
      c.width = size; c.height = size;
      const ctx = c.getContext('2d');
      const g = ctx.createLinearGradient(0, 0, 0, size);
      g.addColorStop(0, top); g.addColorStop(0.55, mid); g.addColorStop(1, bot);
      ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
      if (accent) {
        const ax = accentX != null ? accentX : size * 0.5;
        const ay = accentY != null ? accentY : size * 0.32;
        const rg = ctx.createRadialGradient(ax, ay, 0, ax, ay, size * 0.45);
        rg.addColorStop(0, accent); rg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = rg; ctx.fillRect(0, 0, size, size);
      }
      return c;
    }
    // Cool petrol palette
    const storm   = '#060a10';   // deep navy storm
    const horizon = '#1c2c3a';   // misty teal at the horizon
    const floor   = '#02050a';   // black water floor
    const warm    = 'rgba(255,214,138,0.95)'; // tight golden break (brighter)
    const faces = [
      face(storm, horizon, floor, warm, size * 0.30, size * 0.30), // +x (right side gets the strongest break)
      face(storm, horizon, floor),                                   // -x (left, no break)
      face(storm, storm,   storm, warm, size * 0.72, size * 0.32),   // +y: break biased right-of-center
      face(floor, floor,   floor),                                   // -y (water floor stays black)
      face(storm, horizon, floor, warm, size * 0.70, size * 0.35),   // +z (camera-side, break biased right)
      face(storm, horizon, floor),                                   // -z
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
    const key = new THREE.DirectionalLight(0xffd28a, 3.2); // warm golden rim — dramatic
    key.position.copy(sunWorld);
    scene.add(key);
    const sky = new THREE.HemisphereLight(0x2a3f4d, 0x040608, 0.40); // cool sky / black floor
    scene.add(sky);
    const fill = new THREE.DirectionalLight(0x4d6a82, 0.20); // soft cold fill
    fill.position.set(-2, 1, 6);
    scene.add(fill);

    const waterMeshes = [];
    const allMeshes = [];
    const skyDomeMeshes = [];
    // Keep a private fog handle so we can attach/detach it from the scene as
    // the environment fades in / out. Deep petrol tone so mountains read
    // silhouetted instead of washed out. Tighter near/far than v1 so the
    // distant peaks dissolve into haze the way the reference photo does.
    const envFog = new THREE.Fog(new THREE.Color('#172026'), 3.5, 13.5);
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
              uTop:    { value: new THREE.Color('#02040a') }, // deeper storm zenith
              uMid:    { value: new THREE.Color('#0b1620') },
              uHoriz:  { value: new THREE.Color('#1c2c39') },
              uWarm:   { value: new THREE.Color('#ffce82') }, // brighter golden break
              uBreakY: { value: 0.54 },                       // lower in sky → reads as ceiling break
              uBreakW: { value: 0.22 },                       // wider streak
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
                // base petrol gradient (darker storm)
                vec3 col = mix(uHoriz, uMid, smoothstep(0.45, 0.7, h));
                col = mix(col, uTop, smoothstep(0.78, 1.0, h));
                // Tight golden break biased to the UPPER-RIGHT quadrant of
                // the dome (matches the reference photo where the sun rays
                // emerge from the right side of frame). +d.x → right, and
                // we still bias slightly toward the camera (-z) so the
                // break stays in shot from the standard sec02 camera.
                float right = clamp(0.30 + d.x * 0.95, 0.0, 1.0);
                float front = clamp(0.45 + d.z * -0.55, 0.0, 1.0);
                float breakMask = exp(-pow((h - uBreakY) / uBreakW, 2.0));
                breakMask *= right * front;
                col += uWarm * breakMask * 2.7; // brighter, more dramatic break
                // subtle vignette toward floor
                col *= mix(0.55, 1.0, smoothstep(0.15, 0.5, h));
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
          // Highly reflective lagoon: very low roughness + sky env so the
          // golden cloud break mirrors down the lake centre and the angel
          // silhouette + orb show a clean reflection. Vertex colors carry
          // the baked under-light streak.
          const mat = new THREE.MeshStandardMaterial({
            color: new THREE.Color('#02050a'),
            metalness: 0.08, roughness: 0.035,         // tighter mirror
            envMap: skyEnv, envMapIntensity: 2.2,      // sky reflection brighter
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
    // Reference photo: a dozen distinct light shafts cascade FROM the
    // upper-right cloud break DOWN-LEFT across the lagoon. We cluster the
    // origin points high & right and let them spread diagonally into the
    // mid-scene so the silhouette of the angel sits in the path of the rays.
    let rays = null;
    if (o.godrays) {
      rays = new THREE.Group();
      const tex = rayTexture(THREE);
      const n = 12;
      for (let i = 0; i < n; i++) {
        // Wider and taller than v1: reference shafts are soft and large,
        // not pencil-thin. Each plane covers more vertical real-estate so a
        // handful of them reads as a continuous cascade rather than tally
        // marks.
        const w = 1.0 + Math.random() * 1.4;
        const h = 16 + Math.random() * 7;
        const mat = new THREE.MeshBasicMaterial({
          map: tex, transparent: true, opacity: 0.0,
          blending: THREE.AdditiveBlending, depthWrite: false,
          depthTest: true, side: THREE.DoubleSide, toneMapped: false,
          color: new THREE.Color('#ffd28a'),
        });
        const q = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
        // Parametric trajectory from upper-right break (t=0) toward the
        // angel/water in mid-left (t=1). Subtle jitter so the rays don't
        // line up too perfectly.
        const t = i / (n - 1);
        const sx = 2.9 - t * 2.6;                  // 2.9 → 0.3 (right→center)
        const sy = 3.7 - t * 1.4;                  // 3.7 → 2.3 (high → mid)
        const jx = (Math.random() - 0.5) * 0.45;
        const jz = (Math.random() - 0.5) * 0.55;
        q.position.set(sx + jx, sy, -3.4 - Math.random() * 2.6 + jz);
        // Slight counter-clockwise tilt so the cascade reads as diagonal
        // top-right → bottom-left in screen space. Stored in userData
        // because lookAt() in update() overwrites rotation each frame —
        // tilt is re-applied via rotateZ AFTER lookAt.
        const tilt = -0.18 - (i / n) * 0.06;
        q.userData = { phase: Math.random() * 6.28, base: 0.42 + Math.random() * 0.28, tilt };
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
        key.intensity  = 3.2  * v;
        sky.intensity  = 0.40 * v;
        fill.intensity = 0.20 * v;
        // Fog: only attach when the env is on. Slightly tighter near plane
        // at low v so the fade reads as fog dissolving instead of popping.
        if (on) {
          if (scene.fog !== envFog) scene.fog = envFog;
          envFog.near = 2.5 + (3.5 - 2.5) * v;
          envFog.far  = 9.0  + (13.5 - 9.0) * v;
          envFog.color.setRGB(0.090, 0.125, 0.150); // deep cool petrol
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
        // shimmer the god-rays and always face the camera, then re-apply
        // the per-ray tilt so the cascade stays diagonal in screen space.
        if (rays) {
          rays.children.forEach((q) => {
            const u = q.userData;
            q.material.opacity = u.base * (0.6 + 0.4 * Math.sin(elapsed * 0.7 + u.phase));
            if (camera) {
              q.lookAt(camera.position.x, q.position.y, camera.position.z);
              if (u.tilt) q.rotateZ(u.tilt);
            }
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
