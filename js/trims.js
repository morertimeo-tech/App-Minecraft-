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
    ctx.drawImage(base, 0, 0, 16, 16);

    if (s.material === 'leather') {
      const ov = await loadImage(`${dir}/items/leather_${s.piece}_overlay.png`);
      const tmp = makeCanvas(16, 16);
      const tctx = tmp.getContext('2d');
      tctx.drawImage(ov, 0, 0, 16, 16);
      tctx.globalCompositeOperation = 'multiply';
      tctx.fillStyle = dyeHex;
      tctx.fillRect(0, 0, 16, 16);
      tctx.globalCompositeOperation = 'destination-in';
      tctx.drawImage(ov, 0, 0, 16, 16);
      ctx.drawImage(tmp, 0, 0);
    }

    if (s.trim && s.pattern) {
      const [mask, trimPal, mat] = await Promise.all([
        loadImage(`${dir}/trims/${s.piece}_trim.png`),
        loadImage(`${dir}/trims/palettes/trim_palette.png`),
        loadImage(`${dir}/trims/palettes/${s.trim}.png`),
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

  return { drawArmor, drawTemplate, loadImage, readPalette, hexToRgb };
});
