/*
 * Optimiseur d'ordre d'enchantement à l'enclume (Java Edition).
 *
 * Règles (minecraft.wiki, « Anvil mechanics ») :
 *   - Coût d'une opération = somme(niveau × multiplicateur) des enchantements du
 *     sacrifié + pénalité de travail de la cible + pénalité de travail du sacrifié.
 *     Multiplicateur « livre » si le sacrifié est un livre, « objet » sinon.
 *   - Pénalité de travail : 0 au départ ; après une opération, 2 × max(pénalités) + 1
 *     (suite 0, 1, 3, 7, 15…).
 *   - En Survie, une opération de plus de 39 niveaux est refusée (« Trop cher »).
 *   - Deux enchantements incompatibles ne peuvent pas être sur le même objet.
 *
 * Modèle : l'objet à enchanter (cible) reçoit des livres. Les livres peuvent d'abord
 * être combinés entre eux (livre + livre), ce qui réduit les pénalités mais fait
 * payer plusieurs fois certains enchantements. On cherche le plan le moins cher.
 *
 * Algorithme : programmation dynamique sur les sous-ensembles d'enchantements.
 *   book[M][k] : coût minimal d'un livre portant M avec pénalité d'index k.
 *   item[M][k] : coût minimal de l'objet portant M avec pénalité d'index k.
 */
(function (root, factory) {
  const api = factory(typeof require === 'function' ? require('./data.js') : root.MC_DATA);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MC_OPT = api;
})(typeof self !== 'undefined' ? self : this, function (DATA) {
  const SURVIVAL_CAP = 39;
  const roman = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

  const penalty = (k) => (k === 0 ? 0 : 2 ** k - 1);
  const label = (id, level) => `${DATA.ENCHANTS[id][0]} ${roman[level] || level}`;

  /** Valide l'entrée ; renvoie un message d'erreur ou null. */
  function validate(input) {
    const seen = new Set();
    for (const e of input) {
      const def = DATA.ENCHANTS[e.id];
      if (!def) return `Enchantement inconnu : ${e.id}`;
      if (!(e.level >= 1 && e.level <= def[1])) return `${def[0]} : niveau ${e.level} hors limite (1 à ${def[1]})`;
      if (seen.has(e.id)) return `${def[0]} présent deux fois`;
      seen.add(e.id);
    }
    if (input.length > 12) return 'Maximum 12 enchantements (le calcul explose au-delà)';
    return null;
  }

  /** Cherche le plan le moins cher, avec un plafond par opération. */
  function search(input, cap) {
    const n = input.length;
    const ids = input.map((e) => e.id);
    const costBook = input.map((e) => e.level * DATA.ENCHANTS[e.id][3]);

    const conflict = new Array(n).fill(0);
    for (const group of DATA.CONFLICT_GROUPS) {
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        if (i !== j && group.includes(ids[i]) && group.includes(ids[j])) conflict[i] |= 1 << j;
      }
    }
    const size = 1 << n;
    const valid = new Array(size).fill(true);
    for (let m = 1; m < size; m++) {
      for (let i = 0; i < n && valid[m]; i++) if (m & (1 << i) && (conflict[i] & m)) valid[m] = false;
    }
    const enchCost = new Array(size).fill(0);
    for (let m = 1; m < size; m++) {
      const low = m & -m;
      enchCost[m] = enchCost[m ^ low] + costBook[31 - Math.clz32(low)];
    }

    const K = n + 1;
    const INF = Infinity;
    const mk = () => Array.from({ length: size }, () => new Array(K + 1).fill(INF));
    const book = mk(); const item = mk();
    const bookChoice = mk().map((r) => r.map(() => null));
    const itemChoice = mk().map((r) => r.map(() => null));

    for (let i = 0; i < n; i++) book[1 << i][0] = 0; // livres simples
    item[0][0] = 0; // objet vierge

    for (let M = 1; M < size; M++) {
      if (!valid[M]) continue;
      for (let A = (M - 1) & M; ; A = (A - 1) & M) {
        const B = M ^ A;
        const opBase = enchCost[B];
        // Livre = livre (A) + livre (B), A et B non vides
        if (A !== 0) {
          for (let ka = 0; ka <= K; ka++) {
            if (book[A][ka] === INF) continue;
            for (let kb = 0; kb <= K; kb++) {
              if (book[B][kb] === INF) continue;
              const op = opBase + penalty(ka) + penalty(kb);
              if (op > cap) continue;
              const nk = Math.max(ka, kb) + 1;
              const total = book[A][ka] + book[B][kb] + op;
              if (nk <= K && total < book[M][nk]) { book[M][nk] = total; bookChoice[M][nk] = { A, ka, B, kb }; }
            }
          }
        }
        // Objet = objet (A, éventuellement vierge) + livre (B)
        for (let ka = 0; ka <= K; ka++) {
          if (item[A][ka] === INF) continue;
          for (let kb = 0; kb <= K; kb++) {
            if (book[B][kb] === INF) continue;
            const op = opBase + penalty(ka) + penalty(kb);
            if (op > cap) continue;
            const nk = Math.max(ka, kb) + 1;
            const total = item[A][ka] + book[B][kb] + op;
            if (nk <= K && total < item[M][nk]) { item[M][nk] = total; itemChoice[M][nk] = { A, ka, B, kb }; }
          }
        }
        if (A === 0) break;
      }
    }

    const full = size - 1;
    let bestK = -1; let total = INF;
    for (let k = 0; k <= K; k++) if (item[full][k] < total) { total = item[full][k]; bestK = k; }
    if (total === INF) return null;

    const names = (m) => ids.filter((_, i) => m & (1 << i)).map((id) => label(id, input[ids.indexOf(id)].level));
    const steps = [];
    const bookLabel = (m) => `Livre [${names(m).join(' + ')}]`;
    const buildBook = (M, k) => {
      if ((M & (M - 1)) === 0 && k === 0) return; // livre simple : rien à faire
      const c = bookChoice[M][k];
      buildBook(c.A, c.ka); buildBook(c.B, c.kb);
      steps.push({
        target: bookLabel(c.A), sacrifice: bookLabel(c.B),
        cost: enchCost[c.B] + penalty(c.ka) + penalty(c.kb),
        penaltyAfter: penalty(k), result: bookLabel(M),
      });
    };
    const buildItem = (M, k) => {
      if (M === 0) return;
      const c = itemChoice[M][k];
      buildItem(c.A, c.ka); buildBook(c.B, c.kb);
      steps.push({
        target: c.A === 0 ? 'Objet vierge' : `Objet [${names(c.A).join(' + ')}]`,
        sacrifice: bookLabel(c.B),
        cost: enchCost[c.B] + penalty(c.ka) + penalty(c.kb),
        penaltyAfter: penalty(k), result: `Objet [${names(M).join(' + ')}]`,
      });
    };
    buildItem(full, bestK);
    return { total, steps };
  }

  /**
   * @param {Array<{id: string, level: number}>} input
   * @param {{creative?: boolean}} [opts]  creative : pas de plafond de 39 niveaux
   */
  function optimize(input, opts) {
    const err = validate(input);
    if (err) return { ok: false, error: err };
    if (input.length === 0) return { ok: true, total: 0, naive: 0, steps: [], overCap: false };

    // Référence : un livre à la fois sur l'objet, dans l'ordre donné
    let naive = 0; let naiveMax = 0;
    input.forEach((e, i) => {
      const op = e.level * DATA.ENCHANTS[e.id][3] + penalty(i);
      naive += op; naiveMax = Math.max(naiveMax, op);
    });

    const creative = !!(opts && opts.creative);
    let r = creative ? null : search(input, SURVIVAL_CAP);
    let overCap = false;
    if (!r) {
      r = search(input, Infinity);
      if (!r) return { ok: false, error: 'Aucun ordre possible : des enchantements sont incompatibles' };
      overCap = !creative;
    }
    return { ok: true, total: r.total, naive, naiveOverCap: naiveMax > SURVIVAL_CAP, steps: r.steps, overCap };
  }

  return { optimize, penalty, SURVIVAL_CAP };
});
