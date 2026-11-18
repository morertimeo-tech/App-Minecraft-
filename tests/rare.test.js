const assert = require('assert');
const fs = require('fs');
global.window = {};
require('../js/structures-data.js');
require('../js/rare-data.js');
const R = window.MC_RARE, S = window.MC_STRUCTURES;

assert.deepStrictEqual(R.map((c) => c.id), ['items', 'mobs', 'blocks', 'ores', 'structures']);
for (const c of R) {
  assert.ok(c.metric, `${c.id} : critère manquant`);
  const ranks = c.entries.map((e) => e.rank);
  assert.ok(ranks.includes(1) && ranks.includes(2) && ranks.includes(3), `${c.id} : podium incomplet`);
  assert.ok(Math.max(...ranks) === 3, `${c.id} : rang > 3`);
  assert.deepStrictEqual([...ranks].sort(), ranks, `${c.id} : entrées non triées par rang`);
  for (const e of c.entries) {
    assert.ok(e.name && e.rate && e.rateNote && e.where, `${c.id}/${e.name} : champ manquant`);
    if (e.icon) assert.ok(fs.existsSync(`${__dirname}/../assets/item-icons/${e.icon}.png`), `icône manquante : ${e.icon}`);
    // Le pourcentage annoncé doit être le plus faible de ces coffres dans l'onglet Structures
    if (e.check) {
      const found = S.flatMap((s) => s.containers.flatMap((k) => k.rows.filter((r) => r.name === e.check.name).map((r) => r.chance)));
      assert.ok(found.length > 0, `${e.name} : absent des butins`);
      const min = Math.min(...found.map((x) => parseFloat(x)));
      assert.strictEqual(`${min}%`, e.check.chance.replace(/\.0%$/, '%'), `${e.name} : ${min}% ≠ ${e.check.chance}`);
    }
  }
}
// Les mobs : 1/1200 < 1/1024 < 0,164 %
const mobs = R.find((c) => c.id === 'mobs').entries.map((e) => e.name);
assert.deepStrictEqual(mobs, ['Axolotl bleu', 'Mooshroom brun', 'Mouton rose']);
assert.ok(1 / 1200 < 1 / 1024 && 1 / 1024 < 0.00164, 'ordre des mobs');
// Structures : 80² > 32²/0,2 ; fortin (128 au total) en tête
assert.ok(80 * 80 > (32 * 32) / 0.2);
console.log(`OK : ${R.reduce((a, c) => a + c.entries.length, 0)} entrées sur ${R.length} sous-catégories`);
