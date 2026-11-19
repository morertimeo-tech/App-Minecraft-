#!/usr/bin/env node
/*
 * Fabrique les images « bloc de métier » et « villageois en tenue » de l'onglet Échanges.
 *
 * Usage : node tools/render_art.js PACK_26_1_DIR REPO_DIR
 *   - blocs      : rendu isométrique du vrai modèle 3D (blocks_models.json + textures de blocs)
 *   - villageois : modèle du villageois (texture de base + biome « plaines » + tenue du métier)
 * Écrit REPO_DIR/assets/jobsites/<métier>.png et REPO_DIR/assets/villagers/<métier>.png.
 * Dépend de Playwright (Chromium) et de vendor/three.min.js. Le pack n'est que lu (PNG/JSON).
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const PACK = path.resolve(process.argv[2] || '');
const REPO = path.resolve(process.argv[3] || '.');
if (!fs.existsSync(path.join(PACK, 'blocks_models.json'))) { console.error('PACK invalide'); process.exit(1); }

// métier -> bloc de poste (page « Villager » du wiki)
const PROFESSIONS = [
  ['armorer', 'blast_furnace'], ['butcher', 'smoker'], ['cartographer', 'cartography_table'], ['cleric', 'brewing_stand'],
  ['farmer', 'composter'], ['fisherman', 'barrel'], ['fletcher', 'fletching_table'], ['leatherworker', 'cauldron'],
  ['librarian', 'lectern'], ['mason', 'stonecutter'], ['shepherd', 'loom'], ['toolsmith', 'smithing_table'],
  ['weaponsmith', 'grindstone'], ['wandering_trader', null],
];

const PAGE = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:transparent">
<script src="/three.js"></script><script src="/stand.js"></script>
<script>
const PACK = '/pack/';
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.setClearColor(0x000000, 0);
document.body.appendChild(renderer.domElement);
let models = null;

const loadImg = (url) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('texture ' + url)); i.src = url; });
const nearest = (cv) => { const t = new THREE.CanvasTexture(cv); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.encoding = THREE.sRGBEncoding; return t; };
async function firstFrame(url) {            // les textures animées sont des bandes verticales : on garde la 1re image
  const img = await loadImg(url);
  const s = img.width; const cv = document.createElement('canvas'); cv.width = s; cv.height = s;
  cv.getContext('2d').drawImage(img, 0, 0, s, s, 0, 0, s, s);
  return cv;
}

// ---------- blocs ----------
const key = (p) => p.replace('minecraft:', '').replace(/^block\\//, '');
function resolveModel(name) {
  const chain = []; let cur = models[key(name)];
  while (cur) { chain.push(cur); cur = cur.parent ? models[key(cur.parent)] : null; }
  const textures = {}; let elements = null;
  for (const m of chain.slice().reverse()) Object.assign(textures, m.textures || {});
  for (const m of chain) if (m.elements) { elements = m.elements; break; }
  return { textures, elements: elements || [] };
}
function texPath(textures, ref) {
  let r = ref, n = 0;
  while (typeof r === 'string' && r[0] === '#' && n++ < 10) r = textures[r.slice(1)];
  return typeof r === 'string' ? r : null;
}
const SHADE = { up: 1.0, down: 0.5, north: 0.8, south: 0.8, east: 0.6, west: 0.6 };
function faceCorners(dir, f, t) {            // coins HG, HD, BD, BG dans l'ordre de l'UV
  const [x1, y1, z1] = f, [x2, y2, z2] = t;
  return {
    up: [[x1, y2, z1], [x2, y2, z1], [x2, y2, z2], [x1, y2, z2]],
    down: [[x1, y1, z2], [x2, y1, z2], [x2, y1, z1], [x1, y1, z1]],
    north: [[x2, y2, z1], [x1, y2, z1], [x1, y1, z1], [x2, y1, z1]],
    south: [[x1, y2, z2], [x2, y2, z2], [x2, y1, z2], [x1, y1, z2]],
    west: [[x1, y2, z1], [x1, y2, z2], [x1, y1, z2], [x1, y1, z1]],
    east: [[x2, y2, z2], [x2, y2, z1], [x2, y1, z1], [x2, y1, z2]],
  }[dir];
}
function defaultUv(dir, f, t) {
  const [x1, y1, z1] = f, [x2, y2, z2] = t;
  return {
    up: [x1, z1, x2, z2], down: [x1, 16 - z2, x2, 16 - z1], north: [16 - x2, 16 - y2, 16 - x1, 16 - y1],
    south: [x1, 16 - y2, x2, 16 - y1], west: [z1, 16 - y2, z2, 16 - y1], east: [16 - z2, 16 - y2, 16 - z1, 16 - y1],
  }[dir];
}
async function renderBlock(name, size) {
  const { textures, elements } = resolveModel(name);
  const scene = new THREE.Scene();
  const cache = {};
  for (const el of elements) {
    for (const [dir, face] of Object.entries(el.faces || {})) {
      const ref = texPath(textures, face.texture); if (!ref) continue;
      const file = PACK + 'blocks/' + key(ref) + '.png';
      cache[file] = cache[file] || nearest(await firstFrame(file));
      const uv = face.uv || defaultUv(dir, el.from, el.to);
      const rot = ((face.rotation || 0) / 90 + 4) % 4;
      const base = [[uv[0], uv[1]], [uv[2], uv[1]], [uv[2], uv[3]], [uv[0], uv[3]]];
      const uvs = [0, 1, 2, 3].map((i) => base[(i - rot + 4) % 4]);
      let corners = faceCorners(dir, el.from, el.to).map((c) => new THREE.Vector3(c[0], c[1], c[2]));
      if (el.rotation) {                       // rotation de l'élément autour d'un axe passant par origin
        const o = new THREE.Vector3(...el.rotation.origin);
        const ax = new THREE.Vector3(el.rotation.axis === 'x' ? 1 : 0, el.rotation.axis === 'y' ? 1 : 0, el.rotation.axis === 'z' ? 1 : 0);
        corners = corners.map((c) => c.sub(o).applyAxisAngle(ax, THREE.MathUtils.degToRad(el.rotation.angle)).add(o));
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(corners.flatMap((c) => [c.x, c.y, c.z]), 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs.flatMap((p) => [p[0] / 16, 1 - p[1] / 16]), 2));
      g.setIndex([0, 1, 2, 0, 2, 3]);
      const m = new THREE.MeshBasicMaterial({ map: cache[file], transparent: true, alphaTest: 0.1, side: THREE.DoubleSide });
      m.color.setScalar(SHADE[dir]);
      scene.add(new THREE.Mesh(g, m));
    }
  }
  const half = 14.5;
  const cam = new THREE.OrthographicCamera(-half, half, half, -half, 0.1, 400);
  cam.position.set(8 - 100, 8 + 100, 8 - 100);   // vue isométrique : face « nord » à gauche, « ouest » à droite, dessus
  cam.lookAt(8, 8, 8);
  renderer.setSize(size, size, false);
  renderer.render(scene, cam);
  return renderer.domElement.toDataURL('image/png');
}

// ---------- villageois ----------
async function composeVillager(id, meta) {
  const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64;
  const ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false;
  if (id === 'wandering_trader') { ctx.drawImage(await loadImg(PACK + 'entity/wandering_trader/wandering_trader.png'), 0, 0); return cv; }
  ctx.drawImage(await loadImg(PACK + 'entity/villager/villager.png'), 0, 0);
  ctx.drawImage(await loadImg(PACK + 'entity/villager/type/plains.png'), 0, 0);
  ctx.drawImage(await loadImg(PACK + 'entity/villager/profession/' + id + '.png'), 0, 0);
  return cv;
}
async function renderVillager(id, hat, w, h) {
  const tex = nearest(await composeVillager(id));
  const scene = new THREE.Scene();
  const mc = new THREE.Group(); mc.scale.set(1 / 16, -1 / 16, -1 / 16); mc.position.y = 24 / 16;   // repère modèle : y vers le bas, face vers -z
  const spin = new THREE.Group(); spin.rotation.y = THREE.MathUtils.degToRad(-28); spin.add(mc); scene.add(spin);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.5 });
  const lit = (c) => { const m = mat.clone(); m.color.setScalar(c); return m; };
  const box = (parent, cfg) => { const mesh = new THREE.Mesh(MC_STAND.boxGeometry(THREE, Object.assign({ tw: 64, th: 64 }, cfg)), mat); parent.add(mesh); return mesh; };
  const part = (pivot, rot) => { const g = new THREE.Group(); g.position.set(pivot[0], pivot[1], pivot[2]); if (rot) g.rotation.x = rot; mc.add(g); return g; };

  const head = part([0, 0, 0]);
  box(head, { x: -4, y: -10, z: -4, w: 8, h: 10, d: 8, u: 0, v: 0 });
  if (hat !== 'none') box(head, { x: -4, y: -10, z: -4, w: 8, h: 10, d: 8, u: 32, v: 0, inflate: 0.51 });
  if (hat === 'full') { const rim = part([0, 0, 0], -Math.PI / 2); head.add(rim); box(rim, { x: -8, y: -8, z: -6, w: 16, h: 16, d: 1, u: 30, v: 47 }); }
  box(part([0, -2, 0]), { x: -1, y: -1, z: -6, w: 2, h: 4, d: 2, u: 24, v: 0 });
  const body = part([0, 0, 0]);
  box(body, { x: -4, y: 0, z: -3, w: 8, h: 12, d: 6, u: 16, v: 20 });
  box(body, { x: -4, y: 0, z: -3, w: 8, h: 20, d: 6, u: 0, v: 38, inflate: 0.5 });
  const arms = part([0, 3, -1], -0.75);
  box(arms, { x: -8, y: -2, z: -2, w: 4, h: 8, d: 4, u: 44, v: 22 });
  box(arms, { x: 4, y: -2, z: -2, w: 4, h: 8, d: 4, u: 44, v: 22, mirror: true });
  box(arms, { x: -4, y: 2, z: -2, w: 8, h: 4, d: 4, u: 40, v: 38 });
  box(part([-2, 12, 0]), { x: -2, y: 0, z: -2, w: 4, h: 12, d: 4, u: 0, v: 22 });
  box(part([2, 12, 0]), { x: -2, y: 0, z: -2, w: 4, h: 12, d: 4, u: 0, v: 22, mirror: true });

  const cam = new THREE.PerspectiveCamera(24, w / h, 0.1, 50);     // cadrage : tête (chapeau compris) aux pieds
  cam.position.set(0, 1.1, 6.2); cam.lookAt(0, 1.06, 0);
  renderer.setSize(w, h, false);
  renderer.render(scene, cam);
  return renderer.domElement.toDataURL('image/png');
}
window.__ready = (async () => { models = await (await fetch(PACK + 'blocks_models.json')).json(); return true; })();
window.renderBlock = renderBlock; window.renderVillager = renderVillager;
</script>`;

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  const send = (file, type) => { fs.readFile(file, (e, d) => { if (e) { res.writeHead(404); res.end(); } else { res.writeHead(200, { 'content-type': type }); res.end(d); } }); };
  if (url === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(PAGE); }
  if (url === '/three.js') return send(path.join(REPO, 'vendor/three.min.js'), 'application/javascript');
  if (url === '/stand.js') return send(path.join(REPO, 'js/stand.js'), 'application/javascript');
  if (url.startsWith('/pack/')) {
    const f = path.normalize(path.join(PACK, url.slice(6)));
    if (!f.startsWith(PACK + path.sep)) { res.writeHead(403); return res.end(); }            // pas de sortie du dossier du pack
    return send(f, f.endsWith('.json') ? 'application/json' : 'image/png');
  }
  res.writeHead(404); res.end();
});

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('PAGEERROR', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.error('console:', m.text()); });
  await page.goto(`http://127.0.0.1:${port}/`);
  await page.evaluate(() => window.__ready);

  const hats = {};
  for (const [id] of PROFESSIONS) {
    const f = path.join(PACK, 'entity/villager/profession', id + '.png.mcmeta');
    hats[id] = fs.existsSync(f) ? (JSON.parse(fs.readFileSync(f, 'utf8')).villager || {}).hat || 'none' : 'none';
  }
  hats.wandering_trader = 'partial';
  const write = (rel, dataUrl) => {
    const p = path.join(REPO, rel); fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, Buffer.from(dataUrl.split(',')[1], 'base64'));
  };
  for (const [id, block] of PROFESSIONS) {
    if (block) write(`assets/jobsites/${id}.png`, await page.evaluate((b) => window.renderBlock(b, 192), block));
    write(`assets/villagers/${id}.png`, await page.evaluate(([i, h]) => window.renderVillager(i, h, 192, 240), [id, hats[id]]));
    console.log(id.padEnd(17), block || '(aucun)', '| chapeau :', hats[id]);
  }
  await browser.close(); server.close();
})().catch((e) => { console.error(e); process.exit(1); });
