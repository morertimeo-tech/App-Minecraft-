/*
 * Optimiseur d'ordre d'enchantement à l'enclume (Java Edition).
 *
 * Modèle utilisé (à valider en jeu) :
 *   - Coût d'une fusion = somme(multiplicateur de rareté × niveau) des enchantements
 *     transférés depuis l'objet sacrifié + pénalité de travail de la cible
 *     + pénalité de travail du sacrifié.
 *   - Pénalité de travail : 0, puis après une fusion = 2 × max(pénalités entrantes) + 1
 *     (suite 0, 1, 3, 7, 15, ...).
 *   - Une fusion ne peut pas créer une incompatibilité.
 *
 * Algorithme : programmation dynamique sur sous-ensembles d'enchantements.
 *   I[M][k] = coût minimal pour obtenir un objet portant l'ensemble M avec
 *   pénalité d'index k. Un livre seul est un sacrifié de pénalité 0.
 *   Le point de départ est l'objet vierge (ensemble vide, coût 0).
 *
 * Le résultat est au moins aussi bon que l'ordre naïf (ajout de livres un par un),
 * car cet ordre est une des solutions explorées.
 */
(function (root, factory) {
  const api = factory(typeof require === 'function' ? require('./data.js') : root.MC_DATA);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MC_OPT = api;
})(typeof self !== 'undefined' ? self : this, function (DATA) {
  const ANVIL_OVER_CAP = 40; // « Trop cher » en Survie (à vérifier)

  const roman = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

  function penalty(k) {
    return k === 0 ? 0 : 2 ** k - 1;
  }

  function enchMult(id) {
    const [, , rarity] = DATA.ENCHANTS[id];
    return DATA.RARITY[rarity].mult;
  }

  function label(id, level) {
    return `${DATA.ENCHANTS[id][0]} ${roman[level] || level}`;
  }

  /**
   * @param {Array<{id: string, level: number}>} input  enchantements voulus
   * @returns {{ok: boolean, error?: string, total?: number, naive?: number,
   *            steps?: Array, overCap?: boolean}}
   */
  function optimize(input) {
    // Validation
    const seen = new Set();
    for (const e of input) {
      if (!DATA.ENCHANTS[e.id]) return { ok: false, error: `Enchantement inconnu : ${e.id}` };
      const max = DATA.ENCHANTS[e.id][1];
      if (!(e.level >= 1 && e.level <= max)) {
        return { ok: false, error: `${DATA.ENCHANTS[e.id][0]} : niveau ${e.level} hors limite (1 à ${max})` };
      }
      if (seen.has(e.id)) return { ok: false, error: `${DATA.ENCHANTS[e.id][0]} présent deux fois` };
      seen.add(e.id);
    }
    const n = input.length;
    if (n === 0) return { ok: true, total: 0, naive: 0, steps: [], overCap: false };
    if (n > 12) return { ok: false, error: 'Maximum 12 enchantements (le calcul explose au-delà)' };

    const ids = input.map((e) => e.id);
    const costOf = input.map((e) => enchMult(e.id) * e.level);

    // Incompatibilités en masques de bits
    const conflict = new Array(n).fill(0);
    for (const group of DATA.CONFLICT_GROUPS) {
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        if (i !== j && group.includes(ids[i]) && group.includes(ids[j])) conflict[i] |= 1 << j;
      }
    }
    const valid = new Array(1 << n).fill(true);
    for (let m = 1; m < 1 << n; m++) {
      for (let i = 0; i < n && valid[m]; i++) {
        if (m & (1 << i) && (conflict[i] & m)) valid[m] = false;
      }
    }

    const enchCost = new Array(1 << n).fill(0);
    for (let m = 1; m < 1 << n; m++) {
      const low = m & -m;
      const i = 31 - Math.clz32(low);
      enchCost[m] = enchCost[m ^ low] + costOf[i];
    }

    const K = n + 1; // index max de pénalité atteignable
    const INF = Infinity;
    const best = Array.from({ length: 1 << n }, () => new Array(K + 1).fill(INF));
    const choice = Array.from({ length: 1 << n }, () => new Array(K + 1).fill(null));
    best[0][0] = 0;

    for (let M = 1; M < 1 << n; M++) {
      if (!valid[M]) continue;
      // A = cible (sous-ensemble strict de M, éventuellement vide = objet vierge)
      for (let A = (M - 1) & M; ; A = (A - 1) & M) {
        const B = M ^ A; // sacrifié, non vide
        if (A !== M && B !== 0) {
          const bitsB = B & (B - 1) ? 2 : 1; // 1 = un seul enchantement (livre possible)
          // Options du sacrifié : livre (seulement si un seul enchantement), ou objet déjà construit
          const sacOptions = [];
          if (bitsB === 1) sacOptions.push({ k: 0, cost: 0, kind: 'book' });
          // B === M (cible vide) : l'ensemble n'est pas encore calculé, on l'exclut
          if (B !== M) {
            for (let kb = 0; kb <= K; kb++) {
              if (best[B][kb] < INF) sacOptions.push({ k: kb, cost: best[B][kb], kind: 'item' });
            }
          }
          for (let ka = 0; ka <= K; ka++) {
            if (best[A][ka] === INF) continue;
            for (const s of sacOptions) {
              const total = best[A][ka] + s.cost + enchCost[B] + penalty(ka) + penalty(s.k);
              const nk = Math.max(ka, s.k) + 1;
              if (nk <= K && total < best[M][nk]) {
                best[M][nk] = total;
                choice[M][nk] = { A, ka, B, kb: s.k, kind: s.kind };
              }
            }
          }
        }
        if (A === 0) break;
      }
    }

    const full = (1 << n) - 1;
    let bestK = -1;
    let total = INF;
    for (let k = 0; k <= K; k++) {
      if (best[full][k] < total) { total = best[full][k]; bestK = k; }
    }
    if (total === INF) return { ok: false, error: 'Aucun ordre possible : des enchantements sont incompatibles' };

    // Reconstruction de la séquence d'opérations
    const names = (m) => {
      const out = [];
      for (let i = 0; i < n; i++) if (m & (1 << i)) out.push(label(ids[i], input[i].level));
      return out;
    };
    const steps = [];
    const build = (M, k) => {
      if (M === 0) return;
      const c = choice[M][k];
      build(c.A, c.ka);
      if (c.kind === 'item') build(c.B, c.kb);
      const sacLabel = c.kind === 'book'
        ? `Livre [${names(c.B)[0]}]`
        : `Objet [${names(c.B).join(' + ')}]`;
      const tgtLabel = c.A === 0 ? 'Objet vierge' : `Objet [${names(c.A).join(' + ')}]`;
      const enchCostStep = enchCost[c.B];
      steps.push({
        target: tgtLabel,
        sacrifice: sacLabel,
        cost: enchCostStep + penalty(c.ka) + penalty(c.kb),
        penaltyAfter: penalty(k),
        result: `Objet [${names(M).join(' + ')}]`,
      });
    };
    build(full, bestK);

    // Référence : ajout des livres un par un dans l'ordre donné
    let naive = 0;
    for (let i = 0; i < n; i++) naive += costOf[i] + penalty(i);

    const overCap = steps.some((s) => s.cost >= ANVIL_OVER_CAP);
    return { ok: true, total, naive, steps, overCap };
  }

  return { optimize, penalty };
});
