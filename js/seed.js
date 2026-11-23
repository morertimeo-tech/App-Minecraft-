/*
 * Outils de graine de monde (Java Edition) :
 *  - conversion d'une graine saisie en nombre, comme le fait le jeu (nombre ou texte -> String.hashCode)
 *  - chunks à slimes, calculés exactement comme dans le jeu (algorithme donné par le wiki)
 *  - conversions de coordonnées (blocs, chunks, régions, Nether)
 *  - construction d'un lien vers la carte de graine de Chunkbase
 *
 * Ce qui n'est PAS recodé ici : les biomes et la position des structures, qui demandent de simuler
 * tout le générateur de terrain. Pour ça, l'app renvoie vers Chunkbase.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MC_SEED = api;
})(typeof self !== 'undefined' ? self : this, function () {
  // ---------- java.util.Random ----------
  const MASK = (1n << 48n) - 1n;
  const MULT = 0x5DEECE66Dn;
  const ADD = 0xBn;

  class JavaRandom {
    constructor(seed) { this.s = (BigInt.asUintN(64, BigInt(seed)) ^ MULT) & MASK; }
    next(bits) {
      this.s = (this.s * MULT + ADD) & MASK;
      return Number(BigInt.asIntN(32, this.s >> BigInt(48 - bits)));
    }
    nextInt(bound) {
      if (!(bound > 0)) throw new RangeError('bound doit être positif');
      if ((bound & -bound) === bound) return Number((BigInt(bound) * BigInt(this.next(31))) >> 31n);
      let bits, val;
      do { bits = this.next(31); val = bits % bound; } while (((bits - val + (bound - 1)) | 0) < 0);
      return val;
    }
  }

  // ---------- graine saisie ----------
  const LONG_MIN = -(1n << 63n);
  const LONG_MAX = (1n << 63n) - 1n;

  // String.hashCode() de Java (unités UTF-16, entier 32 bits signé)
  function javaStringHash(text) {
    let h = 0;
    for (let i = 0; i < text.length; i++) h = (Math.imul(31, h) + text.charCodeAt(i)) | 0;
    return h;
  }

  /**
   * Comme le jeu : un nombre entier qui tient dans 64 bits est pris tel quel, tout autre texte
   * (y compris un nombre trop grand) est converti par String.hashCode().
   * @returns {{kind: 'empty'|'number'|'text', seed: bigint|null, text: string}}
   */
  function parseSeed(input) {
    const text = String(input == null ? '' : input).trim();
    if (!text) return { kind: 'empty', seed: null, text };
    if (/^[+-]?\d+$/.test(text)) {
      const n = BigInt(text);
      if (n >= LONG_MIN && n <= LONG_MAX) return { kind: 'number', seed: n, text };
    }
    return { kind: 'text', seed: BigInt(javaStringHash(text)), text };
  }

  // ---------- chunks à slimes (Java) ----------
  // Algorithme du wiki (page « Slime ») : seule la graine sur 48 bits compte.
  function isSlimeChunk(seed, chunkX, chunkZ) {
    const x = chunkX | 0;
    const z = chunkZ | 0;
    const a = Math.imul(Math.imul(x, x), 0x4c1906);
    const b = Math.imul(x, 0x5ac0db);
    const c = BigInt(Math.imul(z, z)) * 0x4307a7n;
    const d = Math.imul(z, 0x5f24f);
    const sum = BigInt.asIntN(64, BigInt(seed) + BigInt(a) + BigInt(b) + c + BigInt(d));
    return new JavaRandom(sum ^ 0x3ad8025fn).nextInt(10) === 0;
  }

  // ---------- coordonnées ----------
  const floorDiv = (a, b) => Math.floor(a / b);
  const blockToChunk = (v) => floorDiv(v, 16);
  const chunkToRegion = (c) => floorDiv(c, 32);

  function describeCoords(dimension, x, z) {
    const cx = blockToChunk(x), cz = blockToChunk(z);
    const out = {
      chunk: [cx, cz],
      chunkBlocks: { x: [cx * 16, cx * 16 + 15], z: [cz * 16, cz * 16 + 15] },
      region: [chunkToRegion(cx), chunkToRegion(cz)],
      inChunk: [x - cx * 16, z - cz * 16],
    };
    if (dimension === 'nether') {
      out.nether = [x, z];
      out.overworld = [x * 8, z * 8];
    } else if (dimension === 'overworld') {
      out.overworld = [x, z];
      out.nether = [floorDiv(x, 8), floorDiv(z, 8)];
    } else {
      out.end = [x, z];
    }
    return out;
  }

  // ---------- lien Chunkbase ----------
  // Format observé dans un lien partagé : …/apps/seed-map#seed=…&platform=java_1_21&dimension=overworld&x=0&z=0&zoom=0.5
  // (non documenté par le site : à vérifier si Chunkbase le change).
  const PLATFORMS = ['java_1_21', 'java_1_20', 'java_1_19', 'java_1_18', 'java_1_17', 'java_1_16', 'java_1_15', 'java_1_14', 'java_1_13', 'java_1_12'];
  const DIMENSIONS = ['overworld', 'nether', 'end'];
  const COORD_LIMIT = 30000000;
  const CHUNKBASE = 'https://www.chunkbase.com/apps/';

  function chunkbaseUrl(opts) {
    const o = opts || {};
    const tool = /^[a-z0-9-]+$/.test(o.tool || '') ? o.tool : 'seed-map';
    const base = CHUNKBASE + tool;
    if (tool !== 'seed-map') return base;            // formats des autres outils non vérifiés : lien simple
    const parts = [];
    const seed = o.seed;
    if (seed != null && seed !== '') parts.push('seed=' + encodeURIComponent(String(BigInt(seed))));
    if (PLATFORMS.includes(o.platform)) parts.push('platform=' + o.platform);
    if (DIMENSIONS.includes(o.dimension)) parts.push('dimension=' + o.dimension);
    const x = Number(o.x), z = Number(o.z);
    if (Number.isInteger(x) && Math.abs(x) <= COORD_LIMIT) parts.push('x=' + x);
    if (Number.isInteger(z) && Math.abs(z) <= COORD_LIMIT) parts.push('z=' + z);
    const zoom = Number(o.zoom);
    if (o.zoom != null && o.zoom !== '' && Number.isFinite(zoom) && zoom > 0 && zoom <= 8) parts.push('zoom=' + zoom);
    return parts.length ? base + '#' + parts.join('&') : base;
  }

  return { JavaRandom, javaStringHash, parseSeed, isSlimeChunk, blockToChunk, chunkToRegion, describeCoords, chunkbaseUrl, PLATFORMS, DIMENSIONS, COORD_LIMIT, CHUNKBASE };
});
