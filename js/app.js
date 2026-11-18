(function () {
  const DATA = window.MC_DATA;
  const OPT = window.MC_OPT;
  const TRIMS = window.MC_TRIMS;
  const STAND = window.MC_STAND;
  const TRADES = window.MC_TRADES;
  const STRUCTS = window.MC_STRUCTURES;
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
    showOthers: false, // section « Autres enchantements » dépliée
    trade: { prof: null, q: '' }, // onglet Échanges : profession ouverte, recherche
    struct: { id: null, q: '' },  // onglet Structures : structure ouverte, recherche
    trim: trimState,
  };

  const saveTrim = () => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state.trim)); } catch (e) { /* navigation privée : on ignore */ }
  };

  // ---------- Onglets ----------
  function setTab(tab) {
    state.tab = tab;
    APP.addEventListener('input', (e) => {
    if (e.target.id === 'struct-q') {
      state.struct.q = e.target.value;
      document.getElementById('struct-body').innerHTML = structureBody();
      return;
    }
    if (e.target.id !== 'trade-q') return;
    state.trade.q = e.target.value;
    document.getElementById('trade-body').innerHTML = tradeBody();
  });

  document.querySelectorAll('.tab').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
    state.cat = null; state.result = null;
    render();
    window.scrollTo({ top: 0 });
  }

  // ---------- Enchantements : accueil ----------
  function renderHome() {
    const groups = [...new Set(DATA.CATEGORIES.map((c) => c.group))];
    return `
      <p class="hint" style="margin:6px 2px 0">Choisis un équipement : le meilleur kit est déjà sélectionné et l'app te donne l'ordre le moins cher à l'enclume. Tu peux l'ajuster.</p>
      ${groups.map((g) => `
        <h2 class="section">${esc(g)}</h2>
        <div class="grid">
          ${DATA.CATEGORIES.filter((c) => c.group === g).map((c) => `
            <button class="tile" data-action="open-cat" data-id="${c.id}">
              <img class="px" src="${ASSETS}/items/${c.icon}.png" alt="" />
              <span>${esc(c.name)}</span>
              <small>${DATA.KITS[c.id].list.length} au kit</small>
            </button>`).join('')}
        </div>`).join('')}`;
  }

  // ---------- Enchantements : catégorie ----------
  function enchantRow(id) {
    const [name, max, itemMult, bookMult] = DATA.ENCHANTS[id];
    const on = id in state.sel;
    const lvl = on ? state.sel[id] : max;
    return `
      <div class="enchant-row">
        <label>
          <input type="checkbox" data-action="toggle" data-id="${id}" ${on ? 'checked' : ''} />
          <span class="enchant-name">${esc(name)}
            <span class="badges">
              <span class="badge" style="color:var(--aqua)" title="Multiplicateur de coût quand l'enchantement vient d'un livre">Livre ×${bookMult}</span>
              <span class="badge" style="color:var(--muted)" title="Multiplicateur quand il vient d'un objet enchanté">Objet ×${itemMult}</span>
              <span class="badge" style="color:var(--muted)">max ${roman[max]}</span>
            </span>
          </span>
        </label>
        <div class="stepper">
          <button data-action="level" data-id="${id}" data-delta="-1" ${!on || lvl <= 1 ? 'disabled' : ''} aria-label="Niveau moins">−</button>
          <output>${on ? roman[lvl] : '—'}</output>
          <button data-action="level" data-id="${id}" data-delta="1" ${!on || lvl >= max ? 'disabled' : ''} aria-label="Niveau plus">+</button>
        </div>
      </div>`;
  }

  const kitOf = (c) => DATA.KITS[c.id];
  const kitIds = (c) => kitOf(c).list.map(([id]) => id);
  const kitSelection = (c) => Object.fromEntries(kitOf(c).list);

  // Recalcule l'ordre dès que la sélection change (au moins deux enchantements).
  function recalc() {
    if (Object.keys(state.sel).length >= 2) calculate();
    else state.result = null;
  }

  function renderCategory(c) {
    const selCount = Object.keys(state.sel).length;
    const kit = kitOf(c);
    const inKit = kitIds(c);
    const others = c.enchants.filter((id) => !inKit.includes(id));
    const kitRows = inKit.map(enchantRow).join('');
    const otherRows = others.map(enchantRow).join('');

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
            ${res.overCap ? `<div class="notice warn">Aucun ordre ne garde chaque étape à 39 niveaux ou moins : en Survie l'enclume refuse (« Trop cher »). Ce plan n'est faisable qu'en Créatif, ou en retirant des enchantements.</div>` : ''}
            ${!res.overCap && res.naiveOverCap ? `<div class="notice warn">Ajouter les livres un par un dépasserait 39 niveaux (« Trop cher »). L'ordre proposé évite ça.</div>` : ''}
            <p class="disclaimer">Règles du wiki Minecraft (Java Edition). Sacrifié = livre ; livres combinables entre eux. Les coûts sont en niveaux d'expérience.</p>
          </div>`;
      }
    }

    return `
      <button class="back" data-action="back">← Équipements</button>
      <div class="cat-head">
        <img class="px" src="${ASSETS}/items/${c.icon}.png" alt="" />
        <div><h2>${esc(c.name)}</h2><p>${c.group} · le meilleur kit est présélectionné</p></div>
      </div>
      <section class="panel" style="margin-top:12px">
        <div class="kit-head">
          <div class="kit-title">★ Meilleur kit</div>
          <button class="btn ghost small" data-action="reset-kit">Remettre le kit</button>
        </div>
        ${kit.note ? `<div class="notice warn" style="margin:0 0 6px">${esc(kit.note)}</div>` : ''}
        ${kitRows}
      </section>
      ${others.length ? `
        <section class="panel" style="margin-top:12px">
          <button class="more-btn" data-action="toggle-others" aria-expanded="${state.showOthers}">
            Autres enchantements (${others.length}) <span>${state.showOthers ? '▴' : '▾'}</span>
          </button>
          ${state.showOthers ? otherRows : ''}
        </section>` : ''}
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
  function pieceLabel(id) {
    const ps = state.trim.settings[id];
    const mat = DATA.ARMOR_MATERIALS.find((m) => m.id === ps.material).name;
    const pat = DATA.TRIM_PATTERNS.find((x) => x.id === ps.pattern).name;
    return `${mat} · ${pat}`;
  }

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
      <section class="panel stand-panel">
        <div id="stand-slot"></div>
        <div class="stand-bar">
          <button class="btn ghost" data-action="stand-spin">${standViewer && standViewer.auto ? 'Arrêter la rotation' : 'Rotation auto'}</button>
          <span class="hint">Glisse pour tourner le porte-armure</span>
        </div>
      </section>

      <div class="piece-tabs" role="tablist" style="margin-top:14px">
        ${DATA.ARMOR_PIECES.map((p) => `
          <button class="piece-tab" role="tab" data-action="trim-piece" data-v="${p.id}" aria-selected="${p.id === piece}">
            <canvas data-draw="${p.id}" width="16" height="16"></canvas>${esc(p.name)}
            <small>${esc(pieceLabel(p.id))}</small>
          </button>`).join('')}
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

  // Le viewer 3D est créé une fois puis ré-attaché après chaque rendu de l'écran.
  let standViewer = null;
  let standFailed = false;
  function attachStand() {
    const slot = APP.querySelector('#stand-slot');
    if (!slot || standFailed) return;
    try {
      if (!standViewer) standViewer = STAND.createStand(window.THREE, TRIMS, { assetsDir: ASSETS, dyeHex });
    } catch (e) {
      standFailed = true;
      slot.innerHTML = '<p class="hint" style="padding:16px">La vue 3D nécessite WebGL, indisponible sur cet appareil.</p>';
      return;
    }
    slot.appendChild(standViewer.el);
    standViewer.resize();
    standViewer.update(state.trim.settings).catch((e) => console.error(e));
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
    });
    try { await Promise.all(jobs.filter(Boolean)); }
    catch (e) { console.error(e); }
  }

  // ---------- Échanges des villageois ----------
  const norm = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  function slot(it) {
    const img = it.icon
      ? `<img class="px" src="${ASSETS}/item-icons/${it.icon}.png" alt="" />`
      : '<span class="noicon">?</span>';
    return `<span class="slot${it.ench ? ' ench' : ''}" title="${esc(it.name)}">${img}${it.n !== '1' ? `<b class="cnt">${esc(it.n)}</b>` : ''}</span>`;
  }
  const itemsText = (list) => list.map((x) => `${x.n !== '1' ? x.n + ' × ' : ''}${x.name}`).join(' + ');

  function tradeRow(t) {
    return `
      <div class="trade">
        <div class="tline">${t.wants.map(slot).join('<i>+</i>')}<i class="arr">→</i>${t.gives.map(slot).join('<i>+</i>')}</div>
        <div class="tname">${esc(itemsText(t.wants))} <span>→</span> ${esc(itemsText(t.gives))}</div>
        <div class="tmeta"><span>Chance ${esc(t.p)}</span><span>Stock ${esc(t.stock)}</span>${t.xp ? `<span>${esc(t.xp)} XP</span>` : ''}</div>
        ${(t.notes || []).map((n) => `<p class="tnote">ℹ ${esc(n)}</p>`).join('')}
      </div>`;
  }

  function levelBlock(lv) {
    const xp = lv.xpNeeded != null ? `<small>${lv.xpNeeded} XP de villageois requis</small>` : '';
    return `<h3 class="lvl">${esc(lv.name)} ${xp}</h3>${lv.trades.map(tradeRow).join('')}`;
  }

  function tradeBody() {
    const { prof, q } = state.trade;
    if (q.trim()) {
      const nq = norm(q.trim());
      let count = 0; let html = '';
      for (const p of TRADES) for (const lv of p.levels) {
        const hits = lv.trades.filter((t) => [...t.wants, ...t.gives].some((x) => norm(x.name).includes(nq)));
        if (!hits.length) continue;
        count += hits.length;
        html += `<h3 class="lvl">${esc(p.name)} · ${esc(lv.name)}</h3>${hits.map(tradeRow).join('')}`;
      }
      return count
        ? `<p class="hint">${count} échange${count > 1 ? 's' : ''} avec « ${esc(q.trim())} »</p>${html}`
        : `<div class="notice warn">Aucun échange ne contient « ${esc(q.trim())} ».</div>`;
    }
    if (prof) {
      const p = TRADES.find((x) => x.id === prof);
      const n = p.levels.reduce((a, l) => a + l.trades.length, 0);
      return `
        <button class="back" data-action="trade-back">← Professions</button>
        <div class="cat-head">
          ${p.icon ? `<img class="px" src="${ASSETS}/item-icons/${p.icon}.png" alt="" />` : ''}
          <div><h2>${esc(p.name)}</h2><p>${n} échanges</p></div>
        </div>
        ${p.levels.map(levelBlock).join('')}`;
    }
    return `
      <div class="grid">
        ${TRADES.map((p) => `
          <button class="tile" data-action="trade-open" data-id="${p.id}">
            ${p.icon ? `<img class="px" src="${ASSETS}/item-icons/${p.icon}.png" alt="" />` : ''}
            <span>${esc(p.name)}</span>
            <small>${p.levels.reduce((a, l) => a + l.trades.length, 0)} échanges</small>
          </button>`).join('')}
      </div>
      <p class="disclaimer">Source : minecraft.wiki (« Trading »), Java Edition. « Chance » = probabilité que l'échange soit proposé. Les noms français sont à vérifier ; certains objets récents n'ont pas d'icône (?).</p>`;
  }

  function renderTrades() {
    return `
      <input id="trade-q" class="search" type="search" inputmode="search" placeholder="Chercher un objet (diamant, livre…)" value="${esc(state.trade.q)}" autocomplete="off" />
      <div id="trade-body">${tradeBody()}</div>`;
  }

  // ---------- Structures ----------
  const qtyText = (q) => q.replace(' / ', ' ou ');
  const chanceNum = (c) => parseFloat(c.replace(',', '.'));
  const sIcon = (icon) => (icon ? `<img class="px" src="${ASSETS}/item-icons/${icon}.png" alt="" />` : '<span class="noicon">?</span>');

  function lootRow(r) {
    const pct = Math.max(2, Math.min(100, chanceNum(r.chance)));
    return `
      <div class="loot">
        <span class="slot">${sIcon(r.icon)}</span>
        <div class="loot-main">
          <div class="loot-top"><strong>${esc(r.name)}</strong><span class="loot-qty">${esc(qtyText(r.qty))}</span></div>
          <div class="chance"><span style="width:${pct}%"></span><b>${esc(r.chance)}</b></div>
          ${(r.notes || []).map((n) => `<p class="tnote">ℹ ${esc(n)}</p>`).join('')}
        </div>
      </div>`;
  }

  function structureDetail(st) {
    const ids = st.locate;
    const locate = ids.length
      ? `<div class="cmd"><code>/locate structure minecraft:${esc(ids[0])}</code></div>
         ${ids.length > 1 ? `<p class="hint">Autres identifiants : ${ids.slice(1).map((i) => `<code>${esc(i)}</code>`).join(' ')}</p>` : ''}`
      : '<p class="hint">Pas de commande /locate pour cette structure.</p>';
    return `
      <button class="back" data-action="struct-back">← Structures</button>
      <div class="cat-head">
        <span class="bigicon">${sIcon(st.icon)}</span>
        <div><h2>${esc(st.name)}</h2><p>${esc(st.dim)}</p></div>
      </div>
      <p class="sdesc">${esc(st.desc)}</p>
      <section class="panel" style="margin-top:12px">
        <div class="control-title">Où la trouver</div>
        <div class="chips">${st.biomes.map((b) => `<span class="chip">${esc(b)}</span>`).join('')}</div>
        <div class="control-title">Commande</div>
        ${locate}
        ${st.tips.length ? `<div class="control-title">Astuce</div>${st.tips.map((t) => `<p class="tnote" style="font-size:13px">💡 ${esc(t)}</p>`).join('')}` : ''}
      </section>
      <h2 class="section">Butins possibles</h2>
      ${st.containers.length ? st.containers.map((c, i) => `
        <details class="cont" ${st.containers.length === 1 || i === 0 ? 'open' : ''}>
          <summary>${esc(c.name)} <small>${c.rows.length} objets</small></summary>
          ${c.rows.map(lootRow).join('')}
        </details>`).join('') : '<div class="notice warn">Cette structure n\'a pas de coffre de butin.</div>'}
      <p class="disclaimer">« % » = chance de trouver l'objet au moins une fois dans ce coffre. Source : minecraft.wiki, Java Edition (version actuelle).</p>`;
  }

  function structureBody() {
    const { id, q } = state.struct;
    const nq = norm(q.trim());
    if (nq) {
      const byName = STRUCTS.filter((s) => norm(s.name).includes(nq));
      const hits = [];
      for (const s of STRUCTS) for (const c of s.containers) for (const r of c.rows) {
        if (norm(r.name).includes(nq)) hits.push({ s, c, r });
      }
      hits.sort((a, b) => chanceNum(b.r.chance) - chanceNum(a.r.chance));
      return `
        ${byName.length ? `<h2 class="section">Structures</h2><div class="grid">${byName.map(structTile).join('')}</div>` : ''}
        ${hits.length ? `<h2 class="section">Où trouver « ${esc(q.trim())} »</h2>
          <p class="hint">${hits.length} résultat${hits.length > 1 ? 's' : ''}, du plus probable au moins probable</p>
          ${hits.slice(0, 80).map((h) => `
            <div class="trade">
              <div class="loot-top"><strong>${esc(h.r.name)}</strong><span class="loot-qty">${esc(qtyText(h.r.qty))}</span></div>
              <div class="chance"><span style="width:${Math.max(2, chanceNum(h.r.chance))}%"></span><b>${esc(h.r.chance)}</b></div>
              <div class="tname"><button class="link" data-action="struct-open" data-id="${h.s.id}">${esc(h.s.name)}</button> <span>·</span> ${esc(h.c.name)}</div>
            </div>`).join('')}
          ${hits.length > 80 ? `<p class="hint">… et ${hits.length - 80} autres : précise ta recherche.</p>` : ''}` : ''}
        ${!byName.length && !hits.length ? `<div class="notice warn">Rien ne correspond à « ${esc(q.trim())} ».</div>` : ''}`;
    }
    if (id) return structureDetail(STRUCTS.find((s) => s.id === id));
    const dims = ['Overworld', 'Overworld et Nether', 'Nether', "L'End"];
    return dims.map((d) => {
      const list = STRUCTS.filter((s) => s.dim === d);
      return list.length ? `<h2 class="section">${esc(d)}</h2><div class="grid">${list.map(structTile).join('')}</div>` : '';
    }).join('') + `<p class="disclaimer">Source : minecraft.wiki (Java Edition). Les noms français sont à vérifier ; certains objets récents n'ont pas d'icône (?).</p>`;
  }

  function structTile(s) {
    const n = s.containers.reduce((a, c) => a + c.rows.length, 0);
    return `
      <button class="tile" data-action="struct-open" data-id="${s.id}">
        ${sIcon(s.icon)}<span>${esc(s.name)}</span>
        <small>${s.containers.length ? s.containers.length + ' coffre' + (s.containers.length > 1 ? 's' : '') + ' · ' + n + ' objets' : 'sans coffre'}</small>
      </button>`;
  }

  function renderStructures() {
    return `
      <input id="struct-q" class="search" type="search" inputmode="search" placeholder="Structure ou objet (disque, trident…)" value="${esc(state.struct.q)}" autocomplete="off" />
      <div id="struct-body">${structureBody()}</div>`;
  }

  // ---------- Minerais ----------
  const fmtY = (n) => `y ${n < 0 ? '−' + (-n) : n}`;
  const AXES = { overworld: [-64, 320], nether: [0, 128] };

  function oreCard(o) {
    const [lo, hi] = AXES[o.dim];
    const pct = (y) => Math.max(0, Math.min(100, ((y - lo) / (hi - lo)) * 100));
    const best = o.best.length ? o.best.map(fmtY).join(' · ') : 'uniforme';
    return `
      <article class="ore-card">
        <img class="px" src="${ASSETS}/items/${o.icon}.png" alt="" />
        <div class="ore-main">
          <div class="ore-top"><strong>${esc(o.name)}</strong><span class="ore-y${o.best.length ? '' : ' flat'}">${best}</span></div>
          <div class="ore-range">Génération de ${fmtY(o.range[0])} à ${fmtY(o.range[1])}</div>
          <div class="ybar" role="img" aria-label="Plage ${fmtY(o.range[0])} à ${fmtY(o.range[1])}">
            <span class="band" style="left:${pct(o.range[0])}%;width:${Math.max(1.5, pct(o.range[1]) - pct(o.range[0]))}%"></span>
            ${o.best.map((y) => `<span class="mark" style="left:${pct(y)}%"></span>`).join('')}
          </div>
          <p class="ore-note">${esc(o.note)}</p>
        </div>
      </article>`;
  }

  function renderOres() {
    const section = (dim, title, axis) => `
      <h2 class="section">${title}</h2>
      <div class="axis"><span>${fmtY(axis[0])}</span><span>hauteur (Y)</span><span>${fmtY(axis[1])}</span></div>
      ${DATA.ORES.filter((o) => o.dim === dim).map(oreCard).join('')}`;
    return `
      <p class="hint" style="margin:6px 2px 0">Hauteur où chaque minerai est le plus fréquent (Java 1.18+). Appuie sur <b>F3</b> en jeu pour voir ta hauteur Y. Le point jaune marque le meilleur niveau, la barre la plage de génération.</p>
      ${section('overworld', 'Overworld', AXES.overworld)}
      ${section('nether', 'Nether', AXES.nether)}
      <p class="disclaimer">Source : minecraft.wiki (« Ore (feature) », « Amethyst Geode »). Le meilleur niveau est le pic de la distribution ; en pratique les grottes, la lave et le relief changent ce qui est visible.</p>`;
  }

  // ---------- Rendu global ----------
  function render() {
    if (state.tab === 'enchant') {
      const c = state.cat ? cat(state.cat) : null;
      APP.innerHTML = c ? renderCategory(c) : renderHome();
    } else if (state.tab === 'structures') {
      APP.innerHTML = renderStructures();
    } else if (state.tab === 'trades') {
      APP.innerHTML = renderTrades();
    } else if (state.tab === 'ores') {
      APP.innerHTML = renderOres();
    } else {
      APP.innerHTML = renderTrims();
      attachStand();
      drawTrimCanvases();
    }
  }

  // ---------- Événements ----------
  APP.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el || el.disabled) return;
    const a = el.dataset.action;
    if (a === 'toggle') return; // géré par 'change' : évite un re-rendu pendant le clic
    if (a === 'stand-spin') {
      if (standViewer) {
        standViewer.setAuto(!standViewer.auto);
        el.textContent = standViewer.auto ? 'Arrêter la rotation' : 'Rotation auto';
      }
      return;
    }

    if (a === 'open-cat') {
      state.cat = el.dataset.id; state.showOthers = false;
      state.sel = kitSelection(cat(state.cat)); recalc();
    }
    else if (a === 'back') { state.cat = null; state.sel = {}; state.result = null; }
    else if (a === 'struct-open') { state.struct.id = el.dataset.id; state.struct.q = ''; window.scrollTo({ top: 0 }); }
    else if (a === 'struct-back') { state.struct.id = null; window.scrollTo({ top: 0 }); }
    else if (a === 'trade-open') { state.trade.prof = el.dataset.id; window.scrollTo({ top: 0 }); }
    else if (a === 'trade-back') { state.trade.prof = null; window.scrollTo({ top: 0 }); }
    else if (a === 'reset-kit') { state.sel = kitSelection(cat(state.cat)); recalc(); }
    else if (a === 'toggle-others') { state.showOthers = !state.showOthers; }
    else if (a === 'level') {
      const id = el.dataset.id;
      const max = DATA.ENCHANTS[id][1];
      const next = Math.min(max, Math.max(1, (state.sel[id] || max) + Number(el.dataset.delta)));
      state.sel[id] = next; recalc();
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
      recalc();
      render();
    }
  });

  document.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));

  render();
})();
