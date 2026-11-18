/*
 * Rendu des armures avec trims, à partir des textures du jeu (assets/).
 *
 * Principe :
 *  1. Image de base de la matière (ex. diamond_chestplate.png).
 *  2. Pour le cuir : l'overlay est teinté par la couleur de teinture (multiply).
 *  3. Le masque de trim (trims/items/<pièce>_trim.png) est niveau de gris. Chaque
 *     pixel est associé au niveau le plus proche de trim_palette.png (8 niveaux),
 *     puis recoloré avec la palette de la matière de trim choisie.
 *
 * Limite : l'icône d'inventaire ne montre pas le motif (il n'existe que sur le
 * modèle 3D). Le motif est donc affiché à part, via son template.
 * Nécessite un serveur HTTP (getImageData est bloqué en file://).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MC_TRIMS = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const cache = new Map();

  function loadImage(src) {
    if (!cache.has(src)) {
      cache.set(src, new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Texture introuvable : ' + src));
        img.src = src;
      }));
    }
    return cache.get(src);
  }

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  // Lit les 8 pixels d'une palette 8×1 : [[r,g,b], ...]
  function readPalette(img) {
    const c = makeCanvas(img.width, img.height);
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, img.width, img.height).data;
    const out = [];
    for (let i = 0; i < img.width * img.height; i++) out.push([d[i * 4], d[i * 4 + 1], d[i * 4 + 2]]);
    return out;
  }

  // Le jeu utilise la palette « darker » si la matière du trim est celle de l'armure.
  const SAME_MATERIAL = { iron: 'iron', golden: 'gold', diamond: 'diamond', netherite: 'netherite', copper: 'copper' };
  function paletteName(s) {
    return SAME_MATERIAL[s.material] === s.trim ? `${s.trim}_darker` : s.trim;
  }

  // Recolore une image de trim en niveaux de gris avec une palette de 8 couleurs.
  async function recolorTrim(img, w, h, dir, paletteId) {
    const [trimPal, mat] = await Promise.all([
      loadImage(`${dir}/trims/palettes/trim_palette.png`),
      loadImage(`${dir}/trims/palettes/${paletteId}.png`),
    ]);
    const grey = readPalette(trimPal);
    const colours = readPalette(mat);
    const mc = makeCanvas(w, h);
    const mctx = mc.getContext('2d');
    mctx.drawImage(img, 0, 0, w, h);
    const data = mctx.getImageData(0, 0, w, h);
    const d = data.data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] === 0) continue;
      let best = 0, bestDist = Infinity;
      for (let j = 0; j < grey.length; j++) {
        const dist = Math.abs(grey[j][0] - d[i]);
        if (dist < bestDist) { bestDist = dist; best = j; }
      }
      d[i] = colours[best][0]; d[i + 1] = colours[best][1]; d[i + 2] = colours[best][2];
    }
    mctx.putImageData(data, 0, 0);
    return mc;
  }

  // Teinte une image (multiply par la couleur, en gardant sa transparence).
  function tint(img, w, h, hex) {
    const c = makeCanvas(w, h);
    const t = c.getContext('2d');
    t.imageSmoothingEnabled = false;
    t.drawImage(img, 0, 0, w, h);
    t.globalCompositeOperation = 'multiply';
    t.fillStyle = hex;
    t.fillRect(0, 0, w, h);
    t.globalCompositeOperation = 'destination-in';
    t.drawImage(img, 0, 0, w, h);
    return c;
  }

  /** Texture 64×32 de l'armure portée (couche 'layer1' ou 'layer2' pour les jambières). */
  async function wornCanvas(layer, s, opts) {
    const dir = (opts && opts.assetsDir) || 'assets';
    const file = s.material === 'golden' ? 'gold' : s.material;
    const base = await loadImage(`${dir}/worn/${layer}/${file}.png`);
    const c = makeCanvas(64, 32);
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    if (s.material === 'leather') {
      // Comme dans le jeu : la couche de base est teintée, l'overlay (boucles…) ne l'est pas.
      ctx.drawImage(tint(base, 64, 32, (opts && opts.dyeHex) || '#a06540'), 0, 0);
      const ov = await loadImage(`${dir}/worn/${layer}/leather_overlay.png`);
      ctx.drawImage(ov, 0, 0);
    } else {
      ctx.drawImage(base, 0, 0);
    }
    return c;
  }

  /** Texture 64×32 du trim porté, recolorée ; null si pas de trim. */
  async function trimCanvas(layer, s, opts) {
    if (!s.trim || !s.pattern) return null;
    const dir = (opts && opts.assetsDir) || 'assets';
    const img = await loadImage(`${dir}/trims/entity/${layer}/${s.pattern}.png`);
    return recolorTrim(img, 64, 32, dir, paletteName(s));
  }

  /**
   * Dessine une armure 16×16 dans un canvas.
   * @param {HTMLCanvasElement} canvas
   * @param {{piece:string, material:string, dye?:string, trim?:string, pattern?:string}} s
   * @param {{assetsDir?: string, dyeHex?: string}} opts
   */
  async function drawArmor(canvas, s, opts) {
    const dir = (opts && opts.assetsDir) || 'assets';
    const dyeHex = (opts && opts.dyeHex) || '#a06540';
    canvas.width = 16; canvas.height = 16;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 16, 16);
    ctx.imageSmoothingEnabled = false;

    const base = await loadImage(`${dir}/items/${s.material}_${s.piece}.png`);
    if (s.material === 'leather') {
      ctx.drawImage(tint(base, 16, 16, dyeHex), 0, 0);
      const ov = await loadImage(`${dir}/items/leather_${s.piece}_overlay.png`);
      ctx.drawImage(ov, 0, 0, 16, 16);
    } else {
      ctx.drawImage(base, 0, 0, 16, 16);
    }

    if (s.trim && s.pattern) {
      const [mask, trimPal, mat] = await Promise.all([
        loadImage(`${dir}/trims/${s.piece}_trim.png`),
        loadImage(`${dir}/trims/palettes/trim_palette.png`),
        loadImage(`${dir}/trims/palettes/${paletteName(s)}.png`),
      ]);
      const grey = readPalette(trimPal);   // niveaux de gris de référence
      const colours = readPalette(mat);    // couleurs de la matière de trim

      const mc = makeCanvas(16, 16);
      const mctx = mc.getContext('2d');
      mctx.drawImage(mask, 0, 0, 16, 16);
      const img = mctx.getImageData(0, 0, 16, 16);
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] === 0) continue;
        const g = d[i]; // masque gris : R = G = B
        let best = 0, bestDist = Infinity;
        for (let j = 0; j < grey.length; j++) {
          const dist = Math.abs(grey[j][0] - g);
          if (dist < bestDist) { bestDist = dist; best = j; }
        }
        const [r, gg, b] = colours[best];
        d[i] = r; d[i + 1] = gg; d[i + 2] = b;
      }
      mctx.putImageData(img, 0, 0);
      ctx.drawImage(mc, 0, 0);
    }
  }

  function drawTemplate(canvas, pattern, opts) {
    const dir = (opts && opts.assetsDir) || 'assets';
    return loadImage(`${dir}/trims/templates/${pattern}_armor_trim_smithing_template.png`).then((img) => {
      canvas.width = 16; canvas.height = 16;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, 16, 16);
      ctx.drawImage(img, 0, 0, 16, 16);
    });
  }

  return { drawArmor, drawTemplate, loadImage, readPalette, hexToRgb, wornCanvas, trimCanvas, paletteName };
});
