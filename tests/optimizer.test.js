const assert = require('assert');
const { optimize } = require('../js/optimizer.js');
const DATA = require('../js/data.js');

const mult = (id) => DATA.RARITY[DATA.ENCHANTS[id][2]].mult;
const chainCost = (list) => list.reduce((acc, e, i) => acc + mult(e.id) * e.level + (2 ** i - 1), 0);
const perms = (arr) => arr.length <= 1 ? [arr] : arr.flatMap((x, i) => perms([...arr.slice(0, i), ...arr.slice(i + 1)]).map((p) => [x, ...p]));

// 1. Un seul enchantement : coût = multiplicateur × niveau, pas de pénalité
let r = optimize([{ id: 'sharpness', level: 5 }]);
assert.ok(r.ok); assert.strictEqual(r.total, 5); assert.strictEqual(r.steps.length, 0 + r.steps.length);

// 2. Incompatibles : Tranchant + Châtiment
r = optimize([{ id: 'sharpness', level: 5 }, { id: 'smite', level: 5 }]);
assert.strictEqual(r.ok, false);

// 3. Niveau hors limite
r = optimize([{ id: 'mending', level: 2 }]);
assert.strictEqual(r.ok, false);

// 4. Somme des étapes = total, et total ≤ meilleur ordre de chaîne (propriété)
const pool = [
  { id: 'sharpness', level: 5 }, { id: 'unbreaking', level: 3 }, { id: 'mending', level: 1 },
  { id: 'looting', level: 3 }, { id: 'fire_aspect', level: 2 }, { id: 'knockback', level: 2 },
];
const sample = [
  pool.slice(0, 2), pool.slice(0, 3), pool.slice(0, 4), pool.slice(0, 5), pool,
];
for (const set of sample) {
  const res = optimize(set);
  assert.ok(res.ok, JSON.stringify(res));
  const sum = res.steps.reduce((a, s) => a + s.cost, 0);
  assert.strictEqual(sum, res.total, 'somme des étapes ≠ total');
  const bestChain = Math.min(...perms(set).map(chainCost));
  assert.strictEqual(res.naive, chainCost(set));
  assert.ok(res.total <= bestChain, `optimal ${res.total} > meilleur ordre de chaîne ${bestChain}`);
  console.log(`n=${set.length} optimal=${res.total} naïf(donné)=${res.naive} meilleur ordre chaîne=${bestChain}`);
}
console.log('OK : tous les tests passent');
