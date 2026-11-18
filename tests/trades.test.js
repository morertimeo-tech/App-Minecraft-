const assert = require('assert');
const fs = require('fs');
global.window = {};
require('../js/trades-data.js');
const T = window.MC_TRADES;

assert.strictEqual(T.length, 14, '14 professions attendues (13 villageois + colporteur)');
let total = 0, withIcon = 0;
for (const p of T) {
  assert.ok(p.id && p.name && p.levels.length > 0, `profession incomplète : ${p.id}`);
  if (!p.wandering) {
    assert.deepStrictEqual(p.levels.map((l) => l.name), ['Novice', 'Apprenti', 'Compagnon', 'Expert', 'Maître'], `${p.name} : niveaux`);
  }
  for (const l of p.levels) {
    assert.ok(l.trades.length > 0, `${p.name} / ${l.name} : aucun échange`);
    for (const t of l.trades) {
      total++;
      assert.ok(t.wants.length > 0 && t.gives.length > 0, `${p.name} / ${l.name} : échange incomplet`);
      assert.ok(/%/.test(t.p) || t.p === 'selon le biome', `probabilité invalide : ${t.p}`);
      for (const x of [...t.wants, ...t.gives]) {
        assert.ok(x.name && x.n, 'objet sans nom ou quantité');
        if (x.icon) {
          withIcon++;
          assert.ok(fs.existsSync(`${__dirname}/../assets/item-icons/${x.icon}.png`), `icône manquante : ${x.icon}`);
        }
      }
    }
  }
}
assert.strictEqual(total, 283);
// Quelques échanges connus (vérifiés dans le jeu / le wiki)
const armorer = T.find((p) => p.id === 'armorer');
assert.strictEqual(armorer.levels[0].trades[0].wants[0].name, 'Charbon');
assert.strictEqual(armorer.levels[0].trades[0].wants[0].n, '15');
assert.strictEqual(armorer.levels[0].trades[0].gives[0].name, 'Émeraude');
const lib = T.find((p) => p.id === 'librarian');
assert.ok(lib.levels[0].trades.some((t) => t.gives[0].name === 'Livre enchanté'));
console.log(`OK : ${T.length} professions, ${total} échanges, ${withIcon} icônes vérifiées`);
