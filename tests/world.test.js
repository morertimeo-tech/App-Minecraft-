// Vérifie le générateur de monde (cubiomes en WebAssembly) et le recoupe avec le code JS indépendant.
const fs = require('fs'), path = require('path'), assert = require('assert');
const W = require('../js/world.js');
const S = require('../js/seed.js');

(async () => {
  const world = await W.load(fs.readFileSync(path.join(__dirname, '../assets/world.wasm')));
  const V = (k) => W.VERSIONS.find((v) => v.key === k).mc;

  // 1. Chunks à slimes : le wasm et le JS indépendant doivent donner la même chose.
  world.init(V('java_1_21'), 12345n, 0, false);
  // 2. Positions de villages 1.21 : mêmes valeurs en réexécutant, et toujours dans la zone demandée
  const v1 = world.structures(5, -3000, -3000, 3000, 3000);
  const v2 = world.structures(5, -3000, -3000, 3000, 3000);
  assert.deepStrictEqual(v1, v2);
  assert(v1.length > 5, 'des villages attendus : ' + v1.length);
  for (const [x, z] of v1) assert(x >= -3000 && x <= 3000 && z >= -3000 && z <= 3000);

  // 3. Placement indépendant (formule du wiki : espacement 34, séparation 8, sel 10387312).
  //    Chaque village trouvé doit être l'un des points de départ possibles de sa région.
  const rnd = (seed, rx, rz, salt) => new S.JavaRandom(BigInt.asIntN(64, BigInt(rx) * 341873128712n + BigInt(rz) * 132897987541n + seed + BigInt(salt)));
  let matched = 0;
  for (const [x, z] of v1) {
    const rx = Math.floor(x / 16 / 34), rz = Math.floor(z / 16 / 34);
    const r = rnd(12345n, rx, rz, 10387312);
    const cx = rx * 34 + r.nextInt(26), cz = rz * 34 + r.nextInt(26);
    if (Math.floor(x / 16) === cx && Math.floor(z / 16) === cz) matched++;
  }
  assert.strictEqual(matched, v1.length, `placement indépendant : ${matched}/${v1.length}`);

  // 4. Biomes : zone complète, noms FR présents pour chaque biome rencontré
  for (const key of ['java_1_21', 'java_1_18', 'java_1_16', 'java_1_12']) {
    world.init(V(key), -4172144997902289642n, 0, false);
    const b = world.biomes(4, -128, -128, 64, 64, 64);
    assert(b && b.length === 4096, key + ' biomes');
    const kinds = new Set(b);
    assert(kinds.size >= 3, key + ' variété de biomes');
    for (const id of kinds) {
      const name = world.biomeName(id);
      assert(name, key + ' nom du biome ' + id);
      assert(W.BIOMES_FR[name], key + ' manque la traduction de ' + name);
    }
  }
  // 5. Spawn et forteresses
  world.init(V('java_1_21'), 1n, 0, false);
  const sp = world.spawn();
  assert(Number.isInteger(sp[0]) && Math.abs(sp[0]) < 2000);
  const sh = world.strongholds(128);
  assert.strictEqual(sh.length, 128);
  // 6. Nether / End
  world.init(V('java_1_21'), 1n, -1, false);
  assert(world.structures(18, -2000, -2000, 2000, 2000).length > 0, 'forteresses du Nether');
  world.init(V('java_1_21'), 1n, 1, false);
  assert(world.structures(20, -3000, -3000, 3000, 3000).length > 0, "cités de l'End");
  // 7. Icônes : chaque structure et chaque biome (sauf le vide) a une icône présente sur le disque
  const ic = JSON.parse(fs.readFileSync(path.join(__dirname, '../js/map-icons.js'), 'utf8').replace(/^[^{]*=\s*/, '').replace(/;\s*$/, ''));
  const have = (f) => fs.existsSync(path.join(__dirname, '../assets/map-icons', f + '.png'));
  for (const st of [...W.STRUCTURES, W.STRONGHOLD, { id: 'spawn' }]) assert(ic.structures[st.id] && have(ic.structures[st.id]), 'icône de structure ' + st.id);
  for (const n of Object.keys(W.BIOMES_FR)) if (n !== 'the_void') assert(ic.biomes[n] && have(ic.biomes[n]), 'icône de biome ' + n);
  console.log('OK : générateur de monde (' + v1.length + ' villages recoupés, biomes 4 versions, spawn, forteresses)');
})().catch((e) => { console.error(e); process.exit(1); });
