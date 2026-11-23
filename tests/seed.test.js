const assert = require('assert');
const S = require('../js/seed.js');

// ---- java.util.Random : vecteurs publics bien connus
let r = new S.JavaRandom(42n);
assert.strictEqual(r.next(32), -1170105035);
assert.strictEqual(r.next(32), 234785527);
r = new S.JavaRandom(0n);
assert.strictEqual(r.next(32), -1155484576);
assert.strictEqual(r.next(32), -723955400);
r = new S.JavaRandom(42n);
assert.deepStrictEqual([r.nextInt(10), r.nextInt(10)], [0, 3]);   // 1562431130 % 10 et 117392763 % 10
// borne puissance de 2 et graine négative
assert.strictEqual(new S.JavaRandom(-1n).nextInt(16) >= 0, true);

// ---- String.hashCode()
assert.strictEqual(S.javaStringHash(''), 0);
assert.strictEqual(S.javaStringHash('a'), 97);
assert.strictEqual(S.javaStringHash('test'), 3556498);
assert.strictEqual(S.javaStringHash('Hello'), 69609650);
assert.strictEqual(S.javaStringHash('polygenelubricants'), -2147483648);   // Integer.MIN_VALUE

// ---- graine saisie
const p = (t) => S.parseSeed(t);
assert.deepStrictEqual([p('').kind, p('   ').kind], ['empty', 'empty']);
assert.deepStrictEqual([p('12345').kind, p('12345').seed], ['number', 12345n]);
assert.strictEqual(p(' -8740141508899711402 ').seed, -8740141508899711402n);
assert.strictEqual(p('+5').seed, 5n);
assert.strictEqual(p('9223372036854775807').kind, 'number');
assert.strictEqual(p('-9223372036854775808').kind, 'number');
assert.deepStrictEqual([p('9223372036854775808').kind, p('9223372036854775808').seed], ['text', BigInt(S.javaStringHash('9223372036854775808'))]); // trop grand : String.hashCode, comme le jeu
assert.deepStrictEqual([p('Hello').kind, p('Hello').seed], ['text', 69609650n]);
assert.strictEqual(p('1e5').kind, 'text');
assert.strictEqual(p(null).kind, 'empty');

// ---- chunks à slimes : réimplémentation indépendante (arithmétique BigInt explicite, LCG recopié)
function ref(seed, cx, cz) {
  const i32 = (v) => BigInt.asIntN(32, v);
  const x = BigInt(cx), z = BigInt(cz);
  const t1 = i32(i32(x * x) * 0x4c1906n);
  const t2 = i32(x * 0x5ac0dbn);
  const t3 = i32(z * z) * 0x4307a7n;
  const t4 = i32(z * 0x5f24fn);
  let s = BigInt.asIntN(64, BigInt(seed) + t1 + t2 + t3 + t4) ^ 0x3ad8025fn;
  s = (BigInt.asUintN(64, s) ^ 0x5DEECE66Dn) & ((1n << 48n) - 1n);
  let bits, val;
  do {
    s = (s * 0x5DEECE66Dn + 0xBn) & ((1n << 48n) - 1n);
    bits = Number(s >> 17n);
    val = bits % 10;
  } while (bits - val + 9 > 2147483647);
  return val === 0;
}
const seeds = [0n, 1n, 12345n, -1n, 8740141508899711402n, -8740141508899711402n, 9223372036854775807n, -9223372036854775808n];
let agree = 0, total = 0;
for (const seed of seeds) {
  for (let cx = -40; cx <= 40; cx += 3) for (let cz = -40; cz <= 40; cz += 3) {
    total++; if (S.isSlimeChunk(seed, cx, cz) === ref(seed, cx, cz)) agree++;
  }
}
assert.strictEqual(agree, total, `isSlimeChunk ≠ référence sur ${total - agree}/${total}`);
// grandes coordonnées (débordements d'entiers 32 bits)
for (const [cx, cz] of [[1875000, -1875000], [-1875000, 1875000], [46341, 46341], [-46341, 99999]]) {
  assert.strictEqual(S.isSlimeChunk(12345n, cx, cz), ref(12345n, cx, cz), `débordement ${cx},${cz}`);
}
// environ 1 chunk sur 10 (wiki : « About 1/10 of all chunks »)
for (const seed of [12345n, -8740141508899711402n, 0n]) {
  let n = 0;
  for (let cx = -100; cx < 100; cx++) for (let cz = -100; cz < 100; cz++) if (S.isSlimeChunk(seed, cx, cz)) n++;
  const share = n / 40000;
  assert.ok(share > 0.09 && share < 0.11, `part de slimes ${share} hors de ~10 %`);
}
// seuls les 48 bits de poids faible de la graine comptent (wiki)
for (const [cx, cz] of [[0, 0], [5, -7], [-12, 30], [100, 100]]) {
  assert.strictEqual(S.isSlimeChunk(12345n, cx, cz), S.isSlimeChunk(12345n + (1n << 48n) * 3n, cx, cz));
}
// déterminisme
assert.strictEqual(S.isSlimeChunk(12345n, 12, -3), S.isSlimeChunk(12345n, 12, -3));

// ---- coordonnées
let d = S.describeCoords('overworld', -1, -1);
assert.deepStrictEqual([d.chunk, d.inChunk, d.region], [[-1, -1], [15, 15], [-1, -1]]);
d = S.describeCoords('overworld', 100, -50);
assert.deepStrictEqual([d.chunk, d.nether, d.chunkBlocks.x], [[6, -4], [12, -7], [96, 111]]);
d = S.describeCoords('nether', 10, 10);
assert.deepStrictEqual(d.overworld, [80, 80]);
assert.deepStrictEqual(S.describeCoords('overworld', 511, 512).region, [0, 1]);
assert.deepStrictEqual(S.describeCoords('overworld', -513, 0).region, [-2, 0]);
assert.deepStrictEqual(S.describeCoords('end', 5, 6).end, [5, 6]);

// ---- lien Chunkbase
assert.strictEqual(
  S.chunkbaseUrl({ tool: 'seed-map', seed: -8740141508899711402n, platform: 'java_1_21', dimension: 'overworld', x: 0, z: 0, zoom: 0.5 }),
  'https://www.chunkbase.com/apps/seed-map#seed=-8740141508899711402&platform=java_1_21&dimension=overworld&x=0&z=0&zoom=0.5'); // même forme que le lien partagé observé
assert.strictEqual(S.chunkbaseUrl({ seed: 5n, platform: 'java_1_20', dimension: 'nether', x: -80, z: 12 }), 'https://www.chunkbase.com/apps/seed-map#seed=5&platform=java_1_20&dimension=nether&x=-80&z=12');
// valeurs invalides ou dangereuses ignorées
const bad = S.chunkbaseUrl({ seed: 5n, platform: 'x&evil=1', dimension: 'overworld"onload=', x: 1.5, z: 'abc', zoom: 99 });
assert.strictEqual(bad, 'https://www.chunkbase.com/apps/seed-map#seed=5');
assert.strictEqual(S.chunkbaseUrl({ tool: 'seed-map/../evil', seed: 1n }).startsWith('https://www.chunkbase.com/apps/seed-map'), true);
assert.strictEqual(S.chunkbaseUrl({ tool: 'slime-finder', seed: 1n }), 'https://www.chunkbase.com/apps/slime-finder');
assert.strictEqual(S.chunkbaseUrl({ tool: 'https://evil.example/', seed: 1n }).startsWith('https://www.chunkbase.com/apps/'), true);
assert.strictEqual(S.chunkbaseUrl({ seed: 1n, x: 40000000 }), 'https://www.chunkbase.com/apps/seed-map#seed=1');
assert.strictEqual(S.chunkbaseUrl({}), 'https://www.chunkbase.com/apps/seed-map');
console.log(`OK : graine, Random Java, hashCode, ${total} chunks croisés avec une référence, coordonnées, liens Chunkbase`);
