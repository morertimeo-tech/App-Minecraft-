const assert = require('assert');
const fs = require('fs');
global.window = {};
require('../js/farms-data.js');
require('../js/builds-data.js');
const { parseVideoUrl } = require('../js/video.js');
const F = window.MC_FARMS;

assert.ok(F.length >= 25, 'au moins 25 fermes');
const ids = new Set();
for (const f of F) {
  assert.ok(/^[a-z][a-z0-9_]*$/.test(f.id), `id invalide : ${f.id}`);
  assert.ok(!ids.has(f.id), `id en double : ${f.id}`); ids.add(f.id);
  assert.ok(f.name && f.cat && f.produces && f.desc, `${f.id} : champ manquant`);
  assert.ok(f.icon && fs.existsSync(`${__dirname}/../assets/item-icons/${f.icon}.png`), `${f.id} : icône manquante`);
  assert.ok(!/bedrock/i.test(JSON.stringify(f)), `${f.id} : mention de Bedrock`);
}
assert.ok(new Set(F.map((f) => f.cat)).size >= 5, 'catégories');

// Les liens du fichier js/builds-data.js doivent pointer vers des fermes existantes et être des liens valides
const B = window.MC_BUILDS;
assert.ok(B && typeof B === 'object');
for (const [farm, list] of Object.entries(B)) {
  assert.ok(ids.has(farm), `builds-data.js : ferme inconnue « ${farm} »`);
  assert.ok(Array.isArray(list), `builds-data.js : ${farm} doit être une liste`);
  for (const b of list) {
    assert.ok(b.title && typeof b.title === 'string', `${farm} : titre manquant`);
    assert.ok(parseVideoUrl(b.url), `${farm} : lien invalide « ${b.url} »`);
  }
}
// La liste de ids du README correspond aux données
const readme = fs.readFileSync(`${__dirname}/../README.md`, 'utf8');
for (const f of F) assert.ok(readme.includes('`' + f.id + '`'), `README : id ${f.id} absent du tableau des fermes`);
console.log(`OK : ${F.length} fermes, ${Object.keys(B).length} ferme(s) avec liens dans le fichier`);
