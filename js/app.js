(function () {
  const DATA = window.MC_DATA;
  const OPT = window.MC_OPT;
  const TRIMS = window.MC_TRIMS;
  const APP = document.getElementById('app');
  const ASSETS = 'assets';
  const STORE_KEY = 'enchantlab.trims.v1';

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const roman = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
  const cat = (id) => DATA.CATEGORIES.find((c) => c.id === id);
  const dyeHex = (id) => (DATA.DYES.find((d) => d.id === id) || DATA.DYES[0]).hex;

  // ---------- État ----------
  const defaultTrim = () => {
    const s = {};
    DATA.ARMOR_PIECES.forEach((p) => {
      s[p.id] = { material: 'iron', dye: 'default', pattern: 'sentry', trim: 'quartz' };
    });
    return s;
  };
  let trimState;
  try {
    trimState = JSON.parse(localStorage.getItem(STORE_KEY)) || null;
  } catch (e) { trimState = null; }
  if (!trimState || !trimState.settings) trimState = { piece: 'helmet', settings: defaultTrim() };

  const state = {
    tab: 'enchant',
    cat: null,       // id de catégorie ouverte
    sel: {},         // { enchantId: level }
    result: null,    // résultat de l'optimiseur
    trim: trimState,
  };

  const saveTrim = () => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state.trim)); } catch (e) { /* navigation privée : on ignore */ }
  };

  // ---------- Onglets ----------
  function setTab(tab) {
    state.tab = tab;
    document.querySelectorAll('.tab').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
    state.cat = null; state.result = null;
    render();
    window.scrollTo({ top: 0 });
  }

  // ---------- Enchantements : accueil ----------
  function renderHome() {
    const groups = [...new Set(DATA.CATEGORIES.map((c) => c.group))];
    return `
      <p class="hint" style="margin:6px 2px 0">Choisis un équipement, coche les enchantements voulus, et l'app te donne l'ordre le moins cher à l'enclume.</p>
      ${groups.map((g) => `
        <h2 class="section">${esc(g)}</h2>
        <div class="grid">
          ${DATA.CATEGORIES.filter((c) => c.group === g).map((c) => `
            <button class="tile" data-action="open-cat" data-id="${c.id}">
              <img class="px" src="${ASSETS}/items/${c.icon}.png" alt="" />
              <span>${esc(c.name)}</span>
              <small>${c.enchants.length} enchantements${c.verify ? ' · à vérifier' : ''}</small>
            </button>`).join('')}
        </div>`).join('')}`;
  }

  // ---------- Enchantements : catégorie ----------
  function renderCategory(c) {
    const selCount = Object.keys(state.sel).length;
    const rows = c.enchants.map((id) => {
      const [name, max, rarity] = DATA.ENCHANTS[id];
      const r = DATA.RARITY[rarity];
      const on = id in state.sel;
      const lvl = on ? state.sel[id] : max;
      return `
        <div class="enchant-row">
          <label>
            <input type="checkbox" data-action="toggle" data-id="${id}" ${on ? 'checked' : ''} />
            <span class="enchant-name">${esc(name)}
              <span class="badge" style="color:${r.color}">${esc(r.label)} · ×${r.mult}</span>
              <span class="badge" style="color:var(--muted)">max ${roman[max]}</span>
            </span>
          </label>
          <div class="stepper">
            <button data-action="level" data-id="${id}" data-delta="-1" ${!on || lvl <= 1 ? 'disabled' : ''} aria-label="Niveau moins">−</button>
            <output>${on ? roman[lvl] : '—'}</output>
            <button data-action="level" data-id="${id}" data-delta="1" ${!on || lvl >= max ? 'disabled' : ''} aria-label="Niveau plus">+</button>
          </div>
        </div>`;
    }).join('');

    let resultHtml = '';
    if (state.result) {
      const res = state.result;
      if (!res.ok) {
        resultHtml = `<div class="notice error">${esc(res.error)}</div>`;
      } else if (res.steps.length === 0) {
        resultHtml = `<div class="notice warn">Coche au moins deux enchantements pour calculer un ordre.</div>`;
      } else {
        const gain = res.naive > 0 ? Math.round((1 - res.total / res.naive) * 100) : 0;
        resultHtml = `
          <div class="result panel">
            <div class="summary">
              <div class="stat good"><b>${res.total}</b><span>niveaux (optimal)</span></div>
              <div class="stat"><b>${res.naive}</b><span>ordre naïf</span></div>
              <div class="stat"><b>${gain > 0 ? '−' + gain + '%' : '='}</b><span>économie</span></div>
            </div>
            <ol class="steps">
              ${res.steps.map((s) => `
                <li>
                  <span class="cost">${s.cost} niv.</span>
                  <strong>${esc(s.target)}</strong> + <strong>${esc(s.sacrifice)}</strong>
                  <span class="meta">→ ${esc(s.result)} · pénalité après : ${s.penaltyAfter}</span>
                </li>`).join('')}
            </ol>
            ${res.overCap ? `<div class="notice warn">Une étape coûte 40 niveaux ou plus : en Survie elle est refusée (« Trop cher »). Il faut la scinder ou passer en Créatif.</div>` : ''}
            <p class="disclaimer">Calcul selon un modèle à vérifier en jeu (voir README). En cas d'écart, le jeu fait foi.</p>
          </div>`;
      }
    }

    const verifyNote = c.verify
      ? `<div class="notice warn">Liste d'enchantements de cet équipement à vérifier dans le jeu.</div>` : '';

    return `
      <button class="back" data-action="back">← Équipements</button>
      <div class="cat-head">
        <img class="px" src="${ASSETS}/items/${c.icon}.png" alt="" />
        <div><h2>${esc(c.name)}</h2><p>${c.enchants.length} enchantements · ${c.group}</p></div>
      </div>
      ${verifyNote}
      <section class="panel" style="margin-top:12px">${rows}</section>
      <div class="cta">
        <span class="count">${selCount} sélectionné${selCount > 1 ? 's' : ''}</span>
        <button class="btn" data-action="calc" ${selCount < 2 ? 'disabled' : ''}>Ordre optimal</button>
      </div>
      ${resultHtml}`;
  }

  function calculate() {
    const c = cat(state.cat);
    const input = c.enchants.filter((id) => id in state.sel).map((id) => ({ id, level: state.sel[id] }));
    state.result = OPT.optimize(input);
  }

  // ---------- Trims ----------
  function renderTrims() {
    const piece = state.trim.piece;
    const s = state.trim.settings[piece];
    const choice = (attrs, inner, active, extra = '') =>
      `<button class="choice ${extra}" ${attrs} aria-pressed="${active}">${inner}</button>`;

    const mats = DATA.ARMOR_MATERIALS.map((m) => choice(
      `data-action="trim-set" data-k="material" data-v="${m.id}"`,
      `<img class="px" src="${ASSETS}/items/${m.id}_${piece}.png" alt="" /><span>${esc(m.name)}</span>`,
      s.material === m.id)).join('');

    const dyes = DATA.DYES.map((d) => choice(
      `data-action="trim-set" data-k="dye" data-v="${d.id}" title="${esc(d.name)}"`,
      `<span class="dye" style="background:${d.hex}"></span><span>${esc(d.name.replace(' (défaut)', ''))}</span>`,
      s.dye === d.id)).join('');

    const patterns = DATA.TRIM_PATTERNS.map((p) => choice(
      `data-action="trim-set" data-k="pattern" data-v="${p.id}"`,
      `<img class="px" src="${ASSETS}/trims/templates/${p.id}_armor_trim_smithing_template.png" alt="" /><span>${esc(p.name)}</span>`,
      s.pattern === p.id)).join('');

    const trims = DATA.TRIM_MATERIALS.map((t) => choice(
      `data-action="trim-set" data-k="trim" data-v="${t.id}"`,
      `<img class="px bar" src="${ASSETS}/trims/palettes/${t.id}.png" alt="" /><span>${esc(t.name)}</span>`,
      s.trim === t.id)).join('');

    return `
      <div class="piece-tabs" role="tablist">
        ${DATA.ARMOR_PIECES.map((p) => `
          <button class="piece-tab" role="tab" data-action="trim-piece" data-v="${p.id}" aria-selected="${p.id === piece}">
            <canvas data-draw="${p.id}" width="16" height="16"></canvas>${esc(p.name)}
          </button>`).join('')}
      </div>

      <div class="preview">
        ${DATA.ARMOR_PIECES.map((p) => {
          const ps = state.trim.settings[p.id];
          const mat = DATA.ARMOR_MATERIALS.find((m) => m.id === ps.material).name;
          const pat = DATA.TRIM_PATTERNS.find((x) => x.id === ps.pattern).name;
          return `
            <div class="preview-card">
              <canvas data-preview="${p.id}" width="16" height="16"></canvas>
              <small>${esc(p.name)}</small>
              <small>${esc(mat)} · ${esc(pat)}</small>
            </div>`;
        }).join('')}
      </div>

      <section class="panel" style="margin-top:12px">
        <div class="control-title">Matière</div>
        <div class="choices">${mats}</div>

        ${s.material === 'leather' ? `
          <div class="control-title">Couleur du cuir</div>
          <div class="choices">${dyes}</div>` : ''}

        <div class="control-title">Motif (pattern)</div>
        <div class="choices">${patterns}</div>

        <div class="control-title">Matière du trim (couleur)</div>
        <div class="choices trim-mats">${trims}</div>

        <div class="toolbar">
          <button class="btn" data-action="trim-all">Appliquer à toutes les pièces</button>
          <button class="btn ghost" data-action="trim-reset">Réinitialiser</button>
        </div>
        <p class="hint">Rendu à partir des textures du jeu. L'icône d'inventaire n'affiche pas le motif : il est visible sur le modèle 3D.</p>
      </section>`;
  }

  async function drawTrimCanvases() {
    const ts = state.trim.settings;
    const draw = (sel, p) => {
      const cv = APP.querySelector(sel);
      if (!cv) return null;
      const s = ts[p];
      return TRIMS.drawArmor(cv, { piece: p, material: s.material, dye: s.dye, pattern: s.pattern, trim: s.trim },
        { assetsDir: ASSETS, dyeHex: dyeHex(s.dye) });
    };
    const jobs = [];
    DATA.ARMOR_PIECES.forEach((p) => {
      jobs.push(draw(`[data-draw="${p.id}"]`, p.id));
      jobs.push(draw(`[data-preview="${p.id}"]`, p.id));
    });
    try { await Promise.all(jobs.filter(Boolean)); }
    catch (e) { console.error(e); }
  }

  // ---------- Rendu global ----------
  function render() {
    if (state.tab === 'enchant') {
      const c = state.cat ? cat(state.cat) : null;
      APP.innerHTML = c ? renderCategory(c) : renderHome();
    } else {
      APP.innerHTML = renderTrims();
      drawTrimCanvases();
    }
  }

  // ---------- Événements ----------
  APP.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el || el.disabled) return;
    const a = el.dataset.action;
    if (a === 'toggle') return; // géré par 'change' : évite un re-rendu pendant le clic

    if (a === 'open-cat') { state.cat = el.dataset.id; state.sel = {}; state.result = null; }
    else if (a === 'back') { state.cat = null; state.sel = {}; state.result = null; }
    else if (a === 'level') {
      const id = el.dataset.id;
      const max = DATA.ENCHANTS[id][1];
      const next = Math.min(max, Math.max(1, (state.sel[id] || max) + Number(el.dataset.delta)));
      state.sel[id] = next; state.result = null;
    }
    else if (a === 'calc') { calculate(); }
    else if (a === 'trim-piece') { state.trim.piece = el.dataset.v; saveTrim(); }
    else if (a === 'trim-set') {
      const s = state.trim.settings[state.trim.piece];
      s[el.dataset.k] = el.dataset.v;
      saveTrim();
    }
    else if (a === 'trim-all') {
      const src = state.trim.settings[state.trim.piece];
      DATA.ARMOR_PIECES.forEach((p) => { state.trim.settings[p.id] = { ...src }; });
      saveTrim();
    }
    else if (a === 'trim-reset') {
      state.trim.settings = defaultTrim();
      saveTrim();
    }
    render();
  });

  APP.addEventListener('change', (e) => {
    const el = e.target;
    if (el.matches('input[type="checkbox"][data-action="toggle"]')) {
      const id = el.dataset.id;
      if (el.checked) state.sel[id] = DATA.ENCHANTS[id][1];
      else delete state.sel[id];
      state.result = null;
      render();
    }
  });

  document.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));

  render();
})();
