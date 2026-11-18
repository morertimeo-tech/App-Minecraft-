const assert = require('assert');
const fs = require('fs');
global.window = {};
require('../js/structures-data.js');
require('../js/rare-data.js');
const R = window.MC_RARE, S = window.MC_STRUCTURES;
const rows = S.flatMap((s) => s.containers.flatMap((c) => c.rows.map((r) => r.name)));

assert.ok(R.length >= 20);
const names = new Set();
for (const e of R) {
  assert.ok(!names.has(e.name), `doublon : ${e.name}`); names.add(e.name);
  assert.ok(['Objet', 'Bloc'].includes(e.kind), `type invalide : ${e.name}`);
  assert.ok([null, 'Épique', 'Rare', 'Peu commun'].includes(e.tier), `rareté invalide : ${e.name}`);
  for (const l of e.loot) assert.ok(rows.includes(l), `${e.name} : « ${l} » absent des butins de structures`);
  assert.ok(e.sources.length + e.loot.length > 0, `${e.name} : aucune source`);
  if (e.icon) assert.ok(fs.existsSync(`${__dirname}/../assets/item-icons/${e.icon}.png`), `icône manquante : ${e.icon}`);
}
// Faits relevés sur les pages du wiki
const heavy = R.find((e) => e.name === 'Cœur lourd');
assert.ok(S.some((s) => s.containers.some((c) => c.rows.some((r) => r.name === 'Cœur lourd' && r.chance === '7.5%'))), 'cœur lourd 7,5 % (wiki)');
assert.strictEqual(R.find((e) => e.name === 'Œuf de dragon').renew, 'Non');
assert.strictEqual(R.find((e) => e.name === 'Étoile du Nether').renew, 'Oui');
console.log(`OK : ${R.length} raretés`);
