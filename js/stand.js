/*
 * Porte-armure 3D (three.js) : modèle en bois du jeu + armure portée avec trims.
 *
 * Tout est construit en coordonnées « modèle Minecraft » (pixels, y vers le bas,
 * face avant vers -z) dans un groupe mis à l'échelle (1/16, -1/16, -1/16), ce qui
 * passe dans le repère de three.js sans inverser l'orientation des faces.
 * Les UV suivent la disposition standard des cubes Minecraft.
 */
(function (root, factory) {
  root.MC_STAND = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const PX = 1 / 16;
  const rad = (d) => (d * Math.PI) / 180;

  // Cube Minecraft → BufferGeometry (positions en pixels, UV de la texture tw×th).
  function boxGeometry(THREE, c) {
    const i = c.inflate || 0;
    const tw = c.tw || 64, th = c.th || 32;
    const { w, h, d, u, v } = c;
    const x0 = c.x - i, x1 = c.x + w + i;
    const y0 = c.y - i, y1 = c.y + h + i;
    const z0 = c.z - i, z1 = c.z + d + i;

    const rect = {
      right: [u, v + d, u + d, v + d + h],
      front: [u + d, v + d, u + d + w, v + d + h],
      left: [u + d + w, v + d, u + 2 * d + w, v + d + h],
      back: [u + 2 * d + w, v + d, u + 2 * d + 2 * w, v + d + h],
      top: [u + d, v, u + d + w, v + d],
      bottom: [u + d + w, v, u + d + 2 * w, v + d],
    };
    if (c.mirror) [rect.right, rect.left] = [rect.left, rect.right];

    // 4 coins par face (u croît vers la droite de la face vue de l'extérieur), normale sortante
    const faces = [
      ['front', [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]], [0, 0, -1]],
      ['back', [[x1, y0, z1], [x0, y0, z1], [x0, y1, z1], [x1, y1, z1]], [0, 0, 1]],
      ['right', [[x0, y0, z1], [x0, y0, z0], [x0, y1, z0], [x0, y1, z1]], [-1, 0, 0]],
      ['left', [[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]], [1, 0, 0]],
      ['top', [[x0, y0, z1], [x1, y0, z1], [x1, y0, z0], [x0, y0, z0]], [0, -1, 0]],
      ['bottom', [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], [0, 1, 0]],
    ];

    const pos = [], uv = [], norm = [], idx = [];
    faces.forEach(([name, corners, n]) => {
      let [ua, va, ub, vb] = rect[name];
      if (c.mirror) [ua, ub] = [ub, ua];
      const cuv = [[ua, va], [ub, va], [ub, vb], [ua, vb]];
      const base = pos.length / 3;
      corners.forEach((p, k) => {
        pos.push(p[0], p[1], p[2]);
        norm.push(n[0], n[1], n[2]);
        uv.push(cuv[k][0] / tw, 1 - cuv[k][1] / th);
      });
      // Orientation : (p1-p0)×(p2-p0) doit aller dans le sens de la normale sortante
      const a = corners[0], b = corners[1], e = corners[2];
      const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const ae = [e[0] - a[0], e[1] - a[1], e[2] - a[2]];
      const cr = [ab[1] * ae[2] - ab[2] * ae[1], ab[2] * ae[0] - ab[0] * ae[2], ab[0] * ae[1] - ab[1] * ae[0]];
      const dot = cr[0] * n[0] + cr[1] * n[1] + cr[2] * n[2];
      if (dot >= 0) idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      else idx.push(base, base + 2, base + 1, base, base + 3, base + 2);
    });

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    return g;
  }

  /**
   * @param {object} THREE  three.js
   * @param {object} TRIMS  js/trims.js (textures)
   * @param {{assetsDir?: string, dyeHex: (id:string)=>string}} opts
   */
  function createStand(THREE, TRIMS, opts) {
    const assets = (opts && opts.assetsDir) || 'assets';
    const el = document.createElement('div');
    el.className = 'stand-view';

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.add(new THREE.AmbientLight(0xffffff, 0.78));
    const sun = new THREE.DirectionalLight(0xffffff, 0.6);
    sun.position.set(2, 4, 3.5);
    scene.add(sun);

    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
    camera.position.set(0, 1.15, 5.4);
    camera.lookAt(0, 1.0, 0);

    const spin = new THREE.Group();
    spin.rotation.y = rad(-25);
    scene.add(spin);
    const mc = new THREE.Group(); // repère modèle Minecraft
    mc.scale.set(PX, -PX, -PX);
    mc.position.y = 24 * PX; // sol = y modèle 24
    spin.add(mc);

    const state = { auto: true, token: 0, dragging: false, lastX: 0, built: null };

    function texture(canvasOrImg) {
      const t = new THREE.CanvasTexture(canvasOrImg);
      t.magFilter = THREE.NearestFilter;
      t.minFilter = THREE.NearestFilter;
      t.generateMipmaps = false;
      t.encoding = THREE.sRGBEncoding;
      return t;
    }
    const mat = (tex, extra) => new THREE.MeshLambertMaterial(Object.assign(
      { map: tex, transparent: true, alphaTest: 0.5 }, extra || {}));

    function part(parent, pivot, rot) {
      const g = new THREE.Group();
      g.position.set(pivot[0], pivot[1], pivot[2]);
      g.rotation.order = 'ZYX';
      if (rot) { g.rotation.x = rad(rot[0]); g.rotation.z = rad(rot[2]); }
      parent.add(g);
      return g;
    }
    const cube = (group, cfg, material) => {
      const m = new THREE.Mesh(boxGeometry(THREE, cfg), material);
      group.add(m);
      return m;
    };

    let content = null;
    function disposeContent() {
      if (!content) return;
      mc.remove(content);
      content.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); }
      });
      content = null;
    }

    async function loadWood() {
      if (state.wood) return state.wood;
      const img = await TRIMS.loadImage(`${assets}/armorstand.png`);
      state.wood = texture(img);
      return state.wood;
    }

    /** settings : { helmet|chestplate|leggings|boots : {material, dye, pattern, trim} } */
    async function update(settings) {
      const token = ++state.token;
      const woodTex = await loadWood();
      const pieces = ['helmet', 'chestplate', 'leggings', 'boots'];
      const layerOf = (p) => (p === 'leggings' ? 'layer2' : 'layer1');

      const tex = {};
      await Promise.all(pieces.map(async (p) => {
        const s = settings[p];
        const o = { assetsDir: assets, dyeHex: opts.dyeHex(s.dye) };
        const [worn, trim] = await Promise.all([
          TRIMS.wornCanvas(layerOf(p), s, o), TRIMS.trimCanvas(layerOf(p), s, o)]);
        tex[p] = { worn: texture(worn), trim: trim ? texture(trim) : null };
      }));
      if (token !== state.token) return; // une mise à jour plus récente est arrivée

      disposeContent();
      content = new THREE.Group();
      mc.add(content);

      const wood = mat(woodTex);
      const W = (g, c) => cube(g, Object.assign({ tw: 64, th: 64 }, c), wood);

      // --- Support en bois (modèle du jeu) ---
      W(part(content, [0, 1, 0]), { x: -1, y: -7, z: -1, w: 2, h: 7, d: 2, u: 0, v: 0 });
      const torso = part(content, [0, 0, 0]);
      W(torso, { x: -3, y: 3, z: -1, w: 2, h: 7, d: 2, u: 16, v: 0 });
      W(torso, { x: 1, y: 3, z: -1, w: 2, h: 7, d: 2, u: 48, v: 16 });
      W(torso, { x: -4, y: 10, z: -1, w: 8, h: 2, d: 2, u: 0, v: 48 });
      W(part(content, [0, 12, 0]), { x: -6, y: 11, z: -6, w: 12, h: 1, d: 12, u: 0, v: 32 });

      const rArm = part(content, [-5, 2, 0], [-10, 0, 10]);
      const lArm = part(content, [5, 2, 0], [-10, 0, -10]);
      W(rArm, { x: -2, y: -2, z: -1, w: 2, h: 12, d: 2, u: 24, v: 0 });
      W(lArm, { x: 0, y: -2, z: -1, w: 2, h: 12, d: 2, u: 32, v: 16, mirror: true });
      const rLeg = part(content, [-1.9, 12, 0], [1, 0, 1]);
      const lLeg = part(content, [1.9, 12, 0], [-1, 0, -1]);
      W(rLeg, { x: -1, y: 0, z: -1, w: 2, h: 11, d: 2, u: 8, v: 0 });
      W(lLeg, { x: -1, y: 0, z: -1, w: 2, h: 11, d: 2, u: 40, v: 16, mirror: true });

      // --- Armure : une couche de base + une couche de trim par pièce ---
      const head = part(content, [0, 0, 0]);
      const armor = (group, piece, c, inflate) => {
        cube(group, Object.assign({ inflate }, c), mat(tex[piece].worn));
        if (tex[piece].trim) {
          cube(group, Object.assign({}, c, { inflate: inflate + 0.04 }),
            mat(tex[piece].trim, { alphaTest: 0.1 }));
        }
      };
      const HEAD = { x: -4, y: -8, z: -4, w: 8, h: 8, d: 8, u: 0, v: 0 };
      const BODY = { x: -4, y: 0, z: -2, w: 8, h: 12, d: 4, u: 16, v: 16 };
      const RARM = { x: -3, y: -2, z: -2, w: 4, h: 12, d: 4, u: 40, v: 16 };
      const LARM = { x: -1, y: -2, z: -2, w: 4, h: 12, d: 4, u: 40, v: 16, mirror: true };
      const LEG = { x: -2, y: 0, z: -2, w: 4, h: 12, d: 4, u: 0, v: 16 };
      const LLEG = Object.assign({}, LEG, { mirror: true });

      armor(head, 'helmet', HEAD, 1.0);
      armor(torso, 'chestplate', BODY, 1.0);
      armor(rArm, 'chestplate', RARM, 1.0);
      armor(lArm, 'chestplate', LARM, 1.0);
      armor(torso, 'leggings', BODY, 0.5);
      armor(rLeg, 'leggings', LEG, 0.5);
      armor(lLeg, 'leggings', LLEG, 0.5);
      armor(rLeg, 'boots', LEG, 1.0);
      armor(lLeg, 'boots', LLEG, 1.0);
    }

    // --- Taille, rotation, boucle de rendu ---
    function resize() {
      const w = el.clientWidth || 300, h = el.clientHeight || 380;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    if (window.ResizeObserver) new ResizeObserver(resize).observe(el);

    const cv = renderer.domElement;
    cv.style.touchAction = 'pan-y';
    cv.addEventListener('pointerdown', (e) => {
      state.dragging = true; state.lastX = e.clientX; state.auto = false;
      cv.setPointerCapture(e.pointerId);
    });
    cv.addEventListener('pointermove', (e) => {
      if (!state.dragging) return;
      spin.rotation.y += (e.clientX - state.lastX) * 0.012;
      state.lastX = e.clientX;
    });
    const stop = () => { state.dragging = false; };
    cv.addEventListener('pointerup', stop);
    cv.addEventListener('pointercancel', stop);

    let last = performance.now();
    function frame(t) {
      requestAnimationFrame(frame);
      if (!el.isConnected || el.clientWidth === 0) return; // caché : on ne dessine pas
      const dt = (t - last) / 1000; last = t;
      if (state.auto && !state.dragging) spin.rotation.y += dt * 0.6;
      renderer.render(scene, camera);
    }
    requestAnimationFrame(frame);

    return {
      el, update, resize,
      setAuto(v) { state.auto = v; },
      get auto() { return state.auto; },
      setYaw(deg) { spin.rotation.y = rad(deg); },
      renderNow() { resize(); renderer.render(scene, camera); },
    };
  }

  return { createStand, boxGeometry };
});
