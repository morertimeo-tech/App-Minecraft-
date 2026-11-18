const assert = require('assert');
const { parseVideoUrl, parseStart } = require('../js/video.js');

const ID = 'dQw4w9WgXcQ';
// Formes courantes de liens YouTube
for (const url of [
  `https://www.youtube.com/watch?v=${ID}`, `https://youtube.com/watch?v=${ID}&feature=share`, `https://m.youtube.com/watch?v=${ID}`,
  `https://youtu.be/${ID}`, `https://youtu.be/${ID}?si=abcdef`, `youtu.be/${ID}`, `www.youtube.com/watch?v=${ID}`,
  `https://www.youtube.com/shorts/${ID}`, `https://www.youtube.com/embed/${ID}`, `https://www.youtube.com/live/${ID}`,
  `https://music.youtube.com/watch?v=${ID}`, `  https://youtu.be/${ID}  `,
]) {
  const r = parseVideoUrl(url);
  assert.ok(r && r.kind === 'youtube' && r.id === ID, `lien non reconnu : ${url}`);
  assert.ok(r.embed.startsWith(`https://www.youtube-nocookie.com/embed/${ID}`), `embed : ${r.embed}`);
}
// Horodatage
assert.strictEqual(parseVideoUrl(`https://youtu.be/${ID}?t=90`).start, 90);
assert.strictEqual(parseVideoUrl(`https://youtu.be/${ID}?t=1m30s`).start, 90);
assert.strictEqual(parseVideoUrl(`https://www.youtube.com/watch?v=${ID}&t=1h2m3s`).start, 3723);
assert.ok(parseVideoUrl(`https://youtu.be/${ID}?t=90`).embed.includes('start=90'));
assert.strictEqual(parseStart('abc'), 0);
assert.strictEqual(parseStart(''), 0);
// Liste de lecture seule
const pl = parseVideoUrl('https://www.youtube.com/playlist?list=PLabcdefghijk123');
assert.ok(pl.kind === 'youtube' && pl.id === null && pl.embed.includes('videoseries?list=PLabcdefghijk123'));
// Autre site : lien externe seul
const other = parseVideoUrl('https://www.twitch.tv/videos/12345');
assert.deepStrictEqual([other.kind, other.host], ['link', 'twitch.tv']);
// Identifiant invalide : pas de lecteur
assert.strictEqual(parseVideoUrl('https://www.youtube.com/watch?v=court').kind, 'link');
// Sécurité : protocoles dangereux et entrées invalides refusés
for (const bad of ['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'file:///etc/passwd', 'ftp://youtu.be/' + ID,
  '', '   ', 'pas une url', 'https://', 'http://localhost', 123, null, undefined, 'x'.repeat(700)]) {
  assert.strictEqual(parseVideoUrl(bad), null, `devrait être refusé : ${String(bad).slice(0, 40)}`);
}
// Un identifiant ne peut pas contenir de caractères qui sortiraient de l'URL d'embed
const evil = parseVideoUrl(`https://www.youtube.com/watch?v=${ID}&list=PL12345678901"onload="x`);
assert.ok(!evil.embed || !/["'<>\s]/.test(evil.embed), 'embed non sûr');
console.log('OK : liens vidéo (YouTube, playlists, horodatage, refus des protocoles dangereux)');
