const assert = require('assert');
const { optimize, penalty } = require('../js/optimizer.js');
const DATA = require('../js/data.js');

const bookMult = (id) => DATA.ENCHANTS[id][3];
const value = (list) => list.reduce((a, e) => a + e.level * bookMult(e.id), 0);
const E = (id, level) => ({ id, level });

// ---- 1. Exemples chiffrés du wiki (minecraft.wiki « Anvil mechanics »), bottes à 7 enchantements
const SS = E('soul_speed', 3), TH = E('thorns', 3), FF = E('feather_falling', 4), DS = E('depth_strider', 3);
const PR = E('protection', 4), UB = E('unbreaking', 3), MD = E('mending', 1);
// valeurs de livre données par le wiki : 12, 12, 4, 6, 4, 3, 2
assert.deepStrictEqual([SS, TH, FF, DS, PR, UB, MD].map((e) => value([e])), [12, 12, 4, 6, 4, 3, 2]);

const op = (sacrifice, ka, kb) => value(sacrifice) + penalty(ka) + penalty(kb);
// Plan 1 (wiki : 22 + 25 + 21 = 68)
const p1r1 = op([SS], 0, 0) + op([FF], 0, 0) + op([PR], 0, 0) + op([MD], 0, 0);
const p1r2 = op([TH, FF], 1, 1) + op([UB, MD], 1, 1);
const p1r3 = op([DS, PR, UB, MD], 2, 2);
assert.deepStrictEqual([p1r1, p1r2, p1r3], [22, 25, 21]);
assert.strictEqual(p1r1 + p1r2 + p1r3, 68);
// Plan 2 (wiki : 21 + 16 + 14 + 15 = 66)
const p2 = op([SS], 0, 0) + op([MD], 0, 0) + op([FF], 0, 0) + op([UB], 0, 0)
  + op([TH, MD], 1, 1) + op([DS, FF], 2, 1) + op([PR, UB], 3, 1);
assert.strictEqual(p2, 66);

// L'optimiseur doit faire au moins aussi bien que le plan 2 du wiki (66)
const boots = optimize([SS, TH, FF, DS, PR, UB, MD]);
assert.ok(boots.ok);
console.log(`Bottes 7 enchantements : optimal=${boots.total} (wiki cite 66, ordre naïf=${boots.naive})`);
assert.ok(boots.total <= 66, `optimal ${boots.total} > 66`);
assert.ok(boots.steps.every((s) => s.cost <= 39), 'une étape dépasse 39 niveaux');
assert.strictEqual(boots.steps.reduce((a, s) => a + s.cost, 0), boots.total);

// ---- 2. Livre Âme (1er) puis Raccommodage vs ordre inverse : 2 vs 12 (wiki)
assert.strictEqual(op([MD], 0, 0), 2);
assert.strictEqual(op([SS], 0, 0), 12);

// ---- 3. Cas simples et erreurs
let r = optimize([E('sharpness', 5)]);
assert.ok(r.ok); assert.strictEqual(r.total, 5); assert.strictEqual(r.steps.length, 1);
assert.strictEqual(optimize([E('sharpness', 5), E('smite', 5)]).ok, false);
assert.strictEqual(optimize([E('sharpness', 5), E('breach', 4)]).ok, false); // Brèche ↔ Tranchant
assert.strictEqual(optimize([E('mending', 2)]).ok, false);
assert.strictEqual(optimize([E('mending', 1), E('infinity', 1)]).ok, false);

// ---- 4. Recherche exhaustive indépendante (n ≤ 5) : DP == brute force
function brute(input, cap) {
  const n = input.length;
  const conflicts = (a, b) => DATA.CONFLICT_GROUPS.some((g) => g.includes(input[a].id) && g.includes(input[b].id));
  const ok = (mask) => {
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      if (mask & (1 << i) && mask & (1 << j) && conflicts(i, j)) return false;
    }
    return true;
  };
  const sub = (mask) => input.filter((_, i) => mask & (1 << i)).reduce((a, e) => a + e.level * bookMult(e.id), 0);
  let best = Infinity;
  const rec = (objs, cost) => {
    if (cost >= best) return;
    if (objs.length === 1) { if (objs[0].item && objs[0].mask === (1 << n) - 1) best = cost; return; }
    for (let t = 0; t < objs.length; t++) for (let s = 0; s < objs.length; s++) {
      if (t === s) continue;
      const T = objs[t], S = objs[s];
      if (S.item) continue;           // le sacrifié est toujours un livre
      if (T.mask & S.mask) continue;
      const mask = T.mask | S.mask;
      if (!ok(mask)) continue;
      const c = sub(S.mask) + penalty(T.k) + penalty(S.k);
      if (c > cap) continue;
      const rest = objs.filter((_, i) => i !== t && i !== s);
      rec([...rest, { mask, k: Math.max(T.k, S.k) + 1, item: T.item }], cost + c);
    }
  };
  rec([{ mask: 0, k: 0, item: true }, ...input.map((_, i) => ({ mask: 1 << i, k: 0, item: false }))], 0);
  return best;
}
const pool = [E('sharpness', 5), E('unbreaking', 3), E('mending', 1), E('looting', 3), E('fire_aspect', 2), E('knockback', 2)];
for (let n = 1; n <= 5; n++) {
  const set = pool.slice(0, n);
  const res = optimize(set);
  const bf = brute(set, 39);
  assert.strictEqual(res.total, bf, `n=${n} DP ${res.total} ≠ brute ${bf}`);
  console.log(`n=${n} DP=${res.total} brute=${bf} naïf=${res.naive}`);
}
const bootSet = [SS, TH, FF, PR, UB]; // protection + 4 autres
assert.strictEqual(optimize(bootSet).total, brute(bootSet, 39));

// ---- 5. Plafond : tout dépasse 39 en Survie → flag overCap ; créatif sans plafond
const heavy = [E('thorns', 3), E('soul_speed', 3), E('curse_binding', 1), E('swift_sneak', 3), E('silk_touch', 1)];
r = optimize(heavy, { creative: true });
assert.ok(r.ok && !r.overCap);
// ---- 6. Les « meilleurs kits » respectent les règles du jeu
for (const c of DATA.CATEGORIES) {
  const kit = DATA.KITS[c.id];
  assert.ok(kit, `pas de kit pour ${c.id}`);
  const input = kit.list.map(([id, level]) => ({ id, level }));
  for (const e of input) {
    assert.ok(c.enchants.includes(e.id), `${c.id} : ${e.id} non applicable`);
    assert.ok(e.level <= DATA.ENCHANTS[e.id][1], `${c.id} : ${e.id} niveau trop haut`);
  }
  const res = optimize(input);
  assert.ok(res.ok, `${c.id} : kit invalide (${res.error})`);
  console.log(`kit ${c.id}: ${input.length} enchantements, ${res.total} niveaux (naïf ${res.naive})`);
}
// Les combinaisons impossibles de l'image sont bien refusées
assert.strictEqual(optimize([E('infinity', 1), E('mending', 1)]).ok, false);
assert.strictEqual(optimize([E('multishot', 1), E('piercing', 4)]).ok, false);
assert.strictEqual(optimize([E('density', 5), E('breach', 4)]).ok, false);
assert.strictEqual(optimize([E('riptide', 3), E('loyalty', 3)]).ok, false);
assert.strictEqual(optimize([E('knockback', 3)]).ok, false);
console.log('OK : tous les tests passent');
