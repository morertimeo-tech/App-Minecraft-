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
// Mobs : on recalcule les probabilités à partir des valeurs relevées sur le wiki
const mobsSub = R.find((c) => c.id === 'mobs');
const armor = 0.15, fullSetHard = 0.729, diamond = 0.0004, jockey = 0.05 * 0.0475; // 0,2375 %
const fullDiamond = armor * fullSetHard * diamond;
const babyJockeyDiamond = fullDiamond * jockey;
assert.ok(Math.abs(jockey - 0.002375) < 1e-12, 'jockey 0,2375 %');
assert.strictEqual(Math.round(1 / fullDiamond / 1000), 23, '1 sur ~23 000');
assert.strictEqual((1 / babyJockeyDiamond / 1e6).toFixed(1), '9.6', '1 sur ~9,6 millions');
const [m1, m2, m3] = mobsSub.entries;
assert.ok(Math.abs(m1.p - babyJockeyDiamond) < 1e-15 && Math.abs(m2.p - fullDiamond) < 1e-15, 'p du podium');
assert.deepStrictEqual(mobsSub.entries.map((e) => e.name.split(',')[0]).slice(2), ['Axolotl bleu']);
// podium puis « autres » : probabilités strictement croissantes
const all = [...mobsSub.entries, ...mobsSub.others];
for (let i = 1; i < all.length; i++) assert.ok(all[i].p >= all[i - 1].p, `mobs mal triés : ${all[i - 1].name} / ${all[i].name}`);
assert.deepStrictEqual(all.map((e) => e.rank), all.map((_, i) => i + 1), 'rangs consécutifs');
assert.ok(1 / 1200 < 1 / 1024 && 1 / 1024 < 0.00164);
// Structures : part des chunks = probabilité / espacement² (tableau « Structure set » du wiki)
const structSub = R.find((c) => c.id === 'structures');
const spacing = { 'Manoir': [80, 1], 'Avant-poste de pillards': [32, 0.2], 'Forteresse du Nether': [27, 0.4], 'Portail en ruine': [40, 1],
  'Camp abandonné': [37, 1], 'Bastion': [27, 0.6], "Chambres d'épreuves": [34, 1], 'Monument océanique': [32, 1], 'Cité antique': [24, 1] };
const sAll = [...structSub.entries, ...structSub.others];
assert.deepStrictEqual(structSub.entries.map((e) => e.name), ['Manoir', 'Avant-poste de pillards', 'Forteresse du Nether']);
assert.ok(!sAll.some((e) => /Forteresse \(stronghold\)/.test(e.name)), 'le stronghold a été retiré');
for (const e of sAll) {
  const [sp, prob] = spacing[e.name];
  assert.ok(Math.abs(e.p - prob / (sp * sp)) < 1e-12, `${e.name} : p`);
  // le pourcentage affiché correspond à p × 100 (à l'arrondi près)
  const shown = parseFloat(e.rate.replace(/[^\d,]/g, '').replace(',', '.'));
  assert.ok(Math.abs(shown - e.p * 100) / (e.p * 100) < 0.03, `${e.name} : ${e.rate} ≠ ${(e.p * 100).toFixed(4)} %`);
}
for (let i = 1; i < sAll.length; i++) assert.ok(sAll[i].p >= sAll[i - 1].p, 'structures triées');
// Blocs : l'œuf de dragon (100 % à l'obtention) n'est plus listé
const blocks = R.find((c) => c.id === 'blocks');
assert.ok(![...blocks.entries, ...(blocks.others || [])].some((e) => /dragon/i.test(e.name)), 'œuf de dragon retiré');
assert.deepStrictEqual(blocks.entries.map((e) => e.name), ['Bloc de diamant', "Bloc d'émeraude", "Bloc d'or", 'Cloche']);
// Pourcentages partout où c'est possible : mobs, structures, blocs et objets
for (const id of ['items', 'mobs', 'blocks', 'structures']) {
  for (const e of R.find((c) => c.id === id).entries) assert.ok(/%/.test(e.rate), `${id}/${e.name} : pas de pourcentage`);
}
// Minerais : étiquettes d'abondance du wiki (pas de pourcentage publié) + section des abîmes
const ores = R.find((c) => c.id === 'ores');
assert.ok(ores.othersTitle && ores.others.some((e) => e.name === 'Charbon') && ores.others.some((e) => e.name === 'Émeraude'));
// Java uniquement : aucune mention de Bedrock dans les données ni dans l'interface
for (const f of ['app.js', 'rare-data.js', 'structures-data.js', 'trades-data.js']) {
  assert.ok(!/bedrock/i.test(fs.readFileSync(`${__dirname}/../js/${f}`, 'utf8')), `${f} mentionne Bedrock`);
}
assert.ok(!/bedrock/i.test(fs.readFileSync(`${__dirname}/../index.html`, 'utf8')));
console.log(`OK : ${R.reduce((a, c) => a + c.entries.length, 0)} entrées sur ${R.length} sous-catégories`);
