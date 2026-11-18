const assert = require('assert');
const fs = require('fs');
global.window = {};
require('../js/structures-data.js');
const S = window.MC_STRUCTURES;

assert.ok(S.length >= 20, 'au moins 20 structures');
const ids = new Set();
let rows = 0;
for (const s of S) {
  assert.ok(!ids.has(s.id), `id en double : ${s.id}`); ids.add(s.id);
  assert.ok(s.name && s.dim && s.desc && s.biomes.length > 0, `structure incomplète : ${s.id}`);
  if (s.icon) assert.ok(fs.existsSync(`${__dirname}/../assets/item-icons/${s.icon}.png`), `icône manquante ${s.icon}`);
  for (const c of s.containers) {
    assert.ok(c.name && c.rows.length > 0, `${s.id} : conteneur vide`);
    let prev = Infinity;
    for (const r of c.rows) {
      rows++;
      assert.ok(/^\d+(\.\d+)?%$/.test(r.chance), `chance invalide : ${r.chance}`);
      const v = parseFloat(r.chance);
      assert.ok(v <= prev + 1e-9, `${s.id}/${c.name} : lignes mal triées`); prev = v;
      assert.ok(v > 0 && v <= 100, `chance hors bornes : ${r.chance}`);
      assert.ok(r.name && r.qty, 'ligne sans nom ou quantité');
      if (r.icon) assert.ok(fs.existsSync(`${__dirname}/../assets/item-icons/${r.icon}.png`), `icône manquante ${r.icon}`);
      assert.ok(!/\bPottery Sherd\b|\bArmor Trim\b|\bPotion of\b|\bMusic Disc\b/.test(r.name), `nom non traduit : ${r.name}`);
    }
  }
}
// faits vérifiés dans le wiki : le trésor enterré contient toujours un cœur de l'océan
const bt = S.find((s) => s.id === 'buried_treasure');
const heart = bt.containers[0].rows.find((r) => r.name === "Cœur de l'océan");
assert.ok(heart && heart.chance === '100.0%' || heart.chance === '100%', `cœur de l'océan : ${heart && heart.chance}`);
// pas de coffre pour le monument et la cabane de sorcière
assert.strictEqual(S.find((s) => s.id === 'ocean_monument').containers.length, 0);
assert.strictEqual(S.find((s) => s.id === 'swamp_hut').containers.length, 0);
console.log(`OK : ${S.length} structures, ${rows} lignes de butin`);
