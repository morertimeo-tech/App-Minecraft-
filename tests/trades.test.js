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

// ---- Photos : bloc de métier + villageois en tenue (générées par tools/render_art.js)
const fs2 = require('fs');
const isPng = (f) => { const b = fs2.readFileSync(f); return b.length > 1000 && b.slice(0, 8).toString('hex') === '89504e470d0a1a0a'; };
for (const p of T) {
  const v = `${__dirname}/../assets/villagers/${p.id}.png`;
  assert.ok(fs2.existsSync(v) && isPng(v), `${p.id} : villageois manquant`);
  if (p.block) {
    assert.ok(typeof p.block === 'string' && p.block.length > 2, `${p.id} : nom du bloc manquant`);
    const j = `${__dirname}/../assets/jobsites/${p.id}.png`;
    assert.ok(fs2.existsSync(j) && isPng(j), `${p.id} : bloc de métier manquant`);
  } else {
    assert.ok(p.wandering, `${p.id} : seul le colporteur n'a pas de bloc`);
  }
}
assert.strictEqual(T.filter((p) => p.block).length, 13, '13 métiers avec bloc');
console.log('OK : photos des 13 métiers + colporteur');
