// === story-angel.js ===
// Lazy 3D enhancement for the Story page's "seguro" scene: the Elyxie angel
// GLB rendered live inside .story-angel-mount. The static <picture> fallback
// is ALREADY in the DOM underneath — this script only ever ADDS the canvas
// and the `is-3d` class (the section's CSS does the cross-fade). If any gate
// fails, the network stalls, or the GL context dies, we simply do nothing /
// back out, and the photograph remains. Recipes (env map, loaders, materials,
// model prep, DPR cap) are copied from pendant.jsx so the gold reads
// identically here and on the home hero.
(function () {
  'use strict';

  // ---- Theme editor lifecycle ----
  // Each section re-render in the customizer re-injects (and re-executes)
  // this script. Tear down the previous instance FIRST — otherwise every
  // re-render leaks a WebGL context + observers, and after enough tweaks the
  // browser kills the oldest context ("Too many active WebGL contexts"),
  // which may be the live one. Storefront never re-renders sections, so this
  // is editor-only insurance. The teardown ref is swapped in two stages:
  // trigger-only before boot, full (renderer/observers/canvas) after build().
  if (window.__storyAngelTeardown) {
    try { window.__storyAngelTeardown(); } catch (e) { /* instancia ya muerta */ }
    window.__storyAngelTeardown = null;
  }
  if (!window.__storyAngelUnloadHook) {
    window.__storyAngelUnloadHook = true;
    document.addEventListener('shopify:section:unload', function (event) {
      if (event.target && event.target.querySelector('#elyxie-story') && window.__storyAngelTeardown) {
        try { window.__storyAngelTeardown(); } catch (e) { /* idem */ }
        window.__storyAngelTeardown = null;
      }
    });
  }

  // ---- Bootstrap: the section guarantees this DOM contract ----
  var story = document.getElementById('elyxie-story');
  var mount = story ? story.querySelector('.story-angel-mount') : null;
  var sceneEl = story ? story.querySelector('.story-scene[data-scene="seguro"]') : null;
  var glbUrl = story ? story.dataset.glb : null;
  if (!story || !mount || !sceneEl || !glbUrl) return;

  // ---- Gates: decide BEFORE downloading three.js or the 3 MB GLB ----
  // Reduced motion: the whole point of the 3D layer is idle rotation +
  // scroll-driven presentation; with motion off it's just a worse photo.
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  // deviceMemory <= 2 GB: low-end Androids where parsing a 3 MB Draco GLB +
  // PMREM generation causes multi-second jank. Default 8 when the API is
  // missing (Safari/Firefox don't expose it — and those tend to be capable).
  if ((navigator.deviceMemory || 8) <= 2) return;
  // hardwareConcurrency <= 3: Draco/Basis transcoding runs in workers; with
  // 2-3 logical cores the decode fights the main thread for the whole scroll.
  if ((navigator.hardwareConcurrency || 8) <= 3) return;
  // WebGL probe: some contexts (forced software rendering, blocklisted GPUs)
  // throw or return null. Probe cheaply on a detached canvas.
  try {
    var probe = document.createElement('canvas');
    var gl = probe.getContext('webgl2') || probe.getContext('webgl');
    if (!gl) return;
  } catch (e) {
    return;
  }

  // Smootherstep (Perlin quintic): 6x⁵ − 15x⁴ + 10x³. Zeros 1st AND 2nd
  // derivative at both endpoints, so velocity AND acceleration glide in/out.
  // Use this in preference to easeInOut whenever the change in camera scale
  // or position would otherwise feel "punchy" near the segment boundaries.
  function smootherstep(t) {
    var x = t < 0 ? 0 : t > 1 ? 1 : t;
    return x * x * x * (x * (x * 6 - 15) + 10);
  }

  // Procedural studio cube map → PMREM. Same palette as the home pendant so
  // the gold reads the same against the page background. Without an env map
  // the metalness-1.0 gold renders pitch black (metals take ~all their color
  // from reflections, not direct lights).
  function buildStudioEnvMap(THREE, renderer, palette) {
    var size = 256;
    var faces = [];
    var warm = palette.warm, cool = palette.cool, accent = palette.accent,
        top = palette.top, floor = palette.floor;
    function gradientCanvas(topC, mid, bot, accents) {
      var c = document.createElement('canvas');
      c.width = size; c.height = size;
      var ctx = c.getContext('2d');
      var g = ctx.createLinearGradient(0, 0, 0, size);
      g.addColorStop(0, topC);
      g.addColorStop(0.55, mid);
      g.addColorStop(1, bot);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
      (accents || []).forEach(function (a) {
        var rg = ctx.createRadialGradient(a.x, a.y, 0, a.x, a.y, a.r);
        rg.addColorStop(0, a.color);
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

    var cubeTex = new THREE.CubeTexture(faces);
    cubeTex.needsUpdate = true;
    cubeTex.colorSpace = THREE.SRGBColorSpace;

    var pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileCubemapShader();
    var envMap = pmrem.fromCubemap(cubeTex).texture;
    pmrem.dispose();
    return envMap;
  }

  var _loader = null;
  function getLoader(renderer) {
    if (_loader) return _loader;
    var draco = new window.DRACOLoader();
    draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
    var ktx2 = new window.KTX2Loader()
      .setTranscoderPath('https://unpkg.com/three@0.160.0/examples/jsm/libs/basis/')
      .detectSupport(renderer);
    _loader = new window.GLTFLoader()
      .setDRACOLoader(draco)
      .setKTX2Loader(ktx2)
      .setMeshoptDecoder(window.MeshoptDecoder);
    return _loader;
  }

  // Soft mint-white orb. Reference photo shows a bright white center with the
  // green glow emerging only around the rim — not a saturated phosphor color.
  // We keep the white core and let the rim DirectionalLight + PointLight cast
  // the green tint locally around the orb.
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

  // ---- Lazy trigger: only start loading near the scene ----
  // rootMargin 150%: begin the three.js + GLB download ~1.5 viewports before
  // the scene scrolls in, so on a normal read pace the canvas is ready before
  // the cross-fade would be visible. `once` semantics via unobserve.
  var booted = false;
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting || booted) return;
      booted = true;
      io.disconnect();
      boot();
    });
  }, { rootMargin: '150% 0px' });
  io.observe(sceneEl);
  // Teardown pre-boot: solo el trigger. build() lo reemplaza por el completo.
  window.__storyAngelTeardown = function () { io.disconnect(); };

  function boot() {
    if (window.__threeReady) { build(); return; }
    // The section's HTML carries the same inert importmap as elyxie.liquid;
    // importmaps download nothing until the first actual `import`. Injecting
    // this module IS that first import — it pulls three + addons and fires
    // 'three-ready', exactly like the layout preamble on the home page.
    var timedOut = false;
    // 20 s budget: enough for three.module.js (~600 kB) + 4 addons on slow
    // 3G; beyond that the user has long since read the static image and the
    // upgrade would be a jarring late swap. Abort silently, keep the photo.
    var timer = setTimeout(function () { timedOut = true; }, 20000);
    window.addEventListener('three-ready', function () {
      clearTimeout(timer);
      if (!timedOut) build();
    }, { once: true });
    var s = document.createElement('script');
    s.type = 'module';
    s.textContent = "\n      import * as THREE from 'three';\n      import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';\n      import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';\n      import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';\n      import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';\n      import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';\n      window.THREE = THREE;\n      window.GLTFLoader = GLTFLoader;\n      window.DRACOLoader = DRACOLoader;\n      window.KTX2Loader = KTX2Loader;\n      window.MeshoptDecoder = MeshoptDecoder;\n      window.mergeVerticesFn = mergeVertices;\n      window.__threeReady = true;\n      window.dispatchEvent(new Event('three-ready'));\n    ";
    document.head.appendChild(s);
  }

  function build() {
    var THREE = window.THREE;

    var scene = new THREE.Scene();
    // alpha renderer + no scene.background: the section paints --story-bg
    // behind the canvas, so the angel composites straight onto the page.
    var camera = new THREE.PerspectiveCamera(
      32,
      (mount.clientWidth || 1) / (mount.clientHeight || 1),
      0.1, 50
    );
    camera.position.set(0, 0, 4.5);

    var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    // Pixel-ratio cap by PHYSICAL display density (same rationale as the home
    // hero): dense phone screens (DPR ≥ 3) keep cap 2.0 — the quality jump is
    // the point and those GPUs handle it. Retina laptops (DPR 2) cap at 1.5:
    // native 2.0 costs 4× the fragments of DPR 1, which dominates idle GPU
    // load, while MSAA (antialias:true) still cleans the wing silhouettes.
    var _dpr = window.devicePixelRatio || 1;
    renderer.setPixelRatio(Math.min(_dpr, _dpr >= 2.5 ? 2.0 : 1.5));
    renderer.setSize(mount.clientWidth || 1, mount.clientHeight || 1);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    var canvas = renderer.domElement;
    // Absolute fill: the mount is the positioning box; the fallback <picture>
    // sits underneath, the canvas covers it and the CSS cross-fade (is-3d)
    // decides which one the user sees.
    canvas.style.position = 'absolute';
    canvas.style.inset = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    mount.appendChild(canvas);

    // Warm studio palette: reflections on the gold should read as gold, not
    // green. The orb's own emissive + a tight PointLight cast the green tint
    // locally; the environment stays warm amber. (Same palette as pendant.jsx.)
    scene.environment = buildStudioEnvMap(THREE, renderer, {
      warm: '#c89a66',
      cool: '#3a2e1c',
      accent: '#e0b070',
      top: '#1c1612',
      floor: '#080604',
    });

    // Minimal rig, NO shadow maps — this is a single static-camera vignette,
    // not the phase-driven hero. Key warm from front-right, brand-green rim
    // from behind-left so the wing edges pick up a whisper of phosphor.
    scene.add(new THREE.AmbientLight(0xffffff, 0.25));
    var key = new THREE.DirectionalLight(0xffcf90, 1.4);
    key.position.set(3, 4, 5);
    scene.add(key);
    var rim = new THREE.DirectionalLight(0x7DFFB2, 0.15);
    rim.position.set(-3, 1, -4);
    scene.add(rim);

    // Animation wrapper: the model carries the fit/center transform, the
    // group carries rotation + breathing so the two never fight.
    var group = new THREE.Group();
    scene.add(group);

    // Green point light that "lives" inside the orb. Short range (1.5) +
    // fast decay (2.0) keep the green tint local to the orb and the adjacent
    // feathers — the rest of the angel reads as warm gold (pendant.jsx
    // sphereLight spirit). Positioned after orb detection below.
    var orbLight = new THREE.PointLight(0x7DFFB2, 1.2, 1.5, 2.0);
    group.add(orbLight);

    var orbMat = null;

    getLoader(renderer).load(
      glbUrl,
      function (gltf) {
        var model = gltf.scene;

        // CAD source is Z-up; Three.js is Y-up. Rotate the model so the
        // angel stands vertical with the head pointing along +Y.
        model.rotation.x = -Math.PI / 2;
        model.updateMatrixWorld(true);

        // Weld coincident vertices with a tight tolerance, then compute
        // smooth vertex normals. Welding tight (1e-4 in CAD units) shares
        // vertices across triangles within the same feather surface so
        // shading is smooth there, but does not collapse vertices across
        // adjacent feather shells (they are several units apart).
        var meshInfos = [];
        var weldFn = window.mergeVerticesFn;
        model.traverse(function (o) {
          if (o.isMesh && o.geometry) {
            if (weldFn) {
              try { o.geometry = weldFn(o.geometry, 1e-4); } catch (e) { /* keep as loaded */ }
            }
            o.geometry.computeVertexNormals();
            o.geometry.normalizeNormals();
            o.geometry.computeBoundingBox();
            var bb = o.geometry.boundingBox.clone();
            bb.applyMatrix4(o.matrixWorld);
            var sz = new THREE.Vector3();
            bb.getSize(sz);
            var ctr = new THREE.Vector3();
            bb.getCenter(ctr);
            meshInfos.push({
              mesh: o, sizeV: sz, center: ctr,
              maxDim: Math.max(sz.x, sz.y, sz.z),
              minDim: Math.max(1e-9, Math.min(sz.x, sz.y, sz.z)),
            });
          }
        });

        var globalSize = 0;
        meshInfos.forEach(function (m) {
          globalSize = Math.max(globalSize, m.sizeV.x, m.sizeV.y, m.sizeV.z);
        });

        var goldWarm = buildGoldMaterial(THREE, 'warm');
        var goldBright = buildGoldMaterial(THREE, 'bright');
        orbMat = buildOrbMaterial(THREE);

        // Detect the "plato" sphere by perfect cubic bbox (aspect very close
        // to 1) and a size that's a small-but-visible fraction of the model.
        // Anything with aspect > 1.2 is probably the head/wing/body, not the
        // ball. Triangle-count threshold rejects tiny anchor placeholders.
        //
        // Group43989 is a small square element the CAD designer placed at the
        // base of the wings on the back of the angel — it IS part of the
        // design (visible between the lower wing tips in the reference
        // render). It must remain visible exactly as authored.
        var idx = 0;
        var sphereCenter = null;
        meshInfos.forEach(function (info) {
          var mesh = info.mesh;
          var aspect = info.maxDim / info.minDim;
          var sizeFrac = info.maxDim / globalSize;
          var triCount = mesh.geometry.index
            ? mesh.geometry.index.count / 3
            : mesh.geometry.attributes.position.count / 3;

          // Tiny anchor placeholders (almost no triangles, and NOT the
          // back-bracket square that's part of the design) get hidden.
          if (triCount < 50 && mesh.name !== 'Group43989') {
            mesh.visible = false;
            return;
          }

          var isSphere = aspect < 1.2 && sizeFrac > 0.10 && sizeFrac < 0.25 && triCount > 200;
          if (isSphere) {
            mesh.material = orbMat;
            sphereCenter = info.center;
          } else {
            // Alternate gold tones by index — every 5th mesh goes 'bright'
            // for subtle mesh-to-mesh variation across the feathers.
            mesh.material = (idx++ % 5 === 0) ? goldBright : goldWarm;
          }
        });

        // Scale to fit the on-screen frame, then center at origin. Same
        // targetSize as the home hero so the framing recipe transfers.
        var box = new THREE.Box3().setFromObject(model);
        var size = new THREE.Vector3();
        box.getSize(size);
        var maxDim = Math.max(size.x, size.y, size.z) || 1;
        var targetSize = 2.0;
        var scaleFactor = targetSize / maxDim;
        model.scale.setScalar(scaleFactor);

        var box2 = new THREE.Box3().setFromObject(model);
        var center = new THREE.Vector3();
        box2.getCenter(center);
        model.position.sub(center);

        // Park the inner green light at the (now scaled + centered) orb.
        // sphereCenter is in pre-scale/pre-translate coords; after the fit
        // transform the sphere sits at (sphereCenter * scaleFactor) - center.
        if (sphereCenter) {
          orbLight.position.copy(
            sphereCenter.clone().multiplyScalar(scaleFactor).sub(center)
          );
        }

        group.add(model);
        startLoop();
      },
      undefined,
      function (err) {
        // Load failed (network, decode, CDN). The photo is still on screen;
        // just never add is-3d.
        console.warn('[story-angel] GLB load failed', err);
      }
    );

    // ---- Render loop, gated by scene visibility + tab visibility ----
    var clock = new THREE.Clock();
    var firstFrame = false;
    var dead = false;          // context lost → never restart
    var modelReady = false;
    var sceneVisible = false;
    var running = false;

    function tick() {
      var t = clock.getElapsedTime();
      // Scroll progress for THIS scene, written by the section's own scroll
      // handler. Missing (no section JS yet / first frames) → 0 (resting pose).
      var p = (window.__STORY && window.__STORY.progress && window.__STORY.progress.seguro) || 0;
      var e = smootherstep(p);

      // Idle slow turn + scroll "presents" the piece: a bit over a half-turn
      // (0.55π) across the scene so the back bracket comes into view.
      group.rotation.y = t * 0.12 + e * Math.PI * 0.55;
      // Breathing: ±0.03 world units at 0.8 rad/s — alive, not bobbing.
      group.position.y = Math.sin(t * 0.8) * 0.03;
      // The "seguro" lights up as the user scrolls into the scene: emissive
      // climbs 0.6 → 1.5 with progress, plus a gentle 2.1 rad/s shimmer.
      if (orbMat) orbMat.emissiveIntensity = 0.6 + e * 0.9 + Math.sin(t * 2.1) * 0.06;
      orbLight.intensity = 0.8 + e * 1.2;

      renderer.render(scene, camera);

      if (!firstFrame) {
        firstFrame = true;
        // First real frame is on screen → let CSS cross-fade photo → canvas.
        mount.classList.add('is-3d');
      }
    }

    function updateLoopState() {
      var shouldRun = modelReady && !dead && sceneVisible && !document.hidden;
      if (shouldRun === running) return;
      running = shouldRun;
      renderer.setAnimationLoop(shouldRun ? tick : null);
    }

    function startLoop() {
      modelReady = true;
      updateLoopState();
    }

    // threshold 0: any visible pixel of the scene keeps the loop alive;
    // fully off-screen → setAnimationLoop(null) so the GPU idles while the
    // user reads the rest of the Story page.
    var visIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) { sceneVisible = entry.isIntersecting; });
      updateLoopState();
    }, { threshold: 0 });
    visIO.observe(sceneEl);

    document.addEventListener('visibilitychange', updateLoopState);

    // Context lost (GPU reset, too many contexts): do NOT preventDefault —
    // we deliberately let the context die instead of fighting to restore it.
    // Dropping is-3d cross-fades the static photo back in; that's the
    // designed degradation path, not an error state.
    canvas.addEventListener('webglcontextlost', function () {
      dead = true;
      mount.classList.remove('is-3d');
      renderer.setAnimationLoop(null);
      running = false;
    });

    // Resize: keep the framebuffer + projection in sync with the mount.
    // Light debounce (120 ms) — ResizeObserver fires per animation frame
    // during a drag-resize and reallocating the framebuffer that often janks.
    var resizeTimer = null;
    var ro = new ResizeObserver(function () {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        if (dead) return;
        var w = mount.clientWidth || 1;
        var h = mount.clientHeight || 1;
        renderer.setSize(w, h);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      }, 120);
    });
    ro.observe(mount);

    // Teardown completo (editor de temas — ver cabecera). El mount viejo ya
    // está fuera del DOM cuando esto corre tras un re-render; quitarle la
    // clase/canvas es inofensivo y necesario en el caso de unload puro.
    window.__storyAngelTeardown = function () {
      dead = true;
      renderer.setAnimationLoop(null);
      running = false;
      visIO.disconnect();
      ro.disconnect();
      if (resizeTimer) clearTimeout(resizeTimer);
      document.removeEventListener('visibilitychange', updateLoopState);
      canvas.remove();
      mount.classList.remove('is-3d');
      renderer.dispose();
    };
  }
})();
