(function () {
  const DATA = window.MC_DATA;
  const OPT = window.MC_OPT;
  const TRIMS = window.MC_TRIMS;
  const STAND = window.MC_STAND;
  const TRADES = window.MC_TRADES;
  const FARMS = window.MC_FARMS;
  const SEED = window.MC_SEED;
  const WORLD = window.MC_WORLD;
  const VIDEO = window.MC_VIDEO;
  const FILE_BUILDS = window.MC_BUILDS || {};
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
  // Sauvegarde ancienne ou corrompue : toute valeur inconnue retombe sur la valeur par défaut.
  (function sanitizeTrim() {
    const ok = (list, v) => list.some((x) => x.id === v);
    const def = defaultTrim();
    const saved = trimState.settings || {};
    DATA.ARMOR_PIECES.forEach((p) => {
      const cur = saved[p.id] || {};
      saved[p.id] = {
        material: ok(DATA.ARMOR_MATERIALS, cur.material) ? cur.material : def[p.id].material,
        dye: ok(DATA.DYES, cur.dye) ? cur.dye : def[p.id].dye,
        pattern: ok(DATA.TRIM_PATTERNS, cur.pattern) ? cur.pattern : def[p.id].pattern,
        trim: ok(DATA.TRIM_MATERIALS, cur.trim) ? cur.trim : def[p.id].trim,
      };
    });
    trimState.settings = saved;
    if (!ok(DATA.ARMOR_PIECES, trimState.piece)) trimState.piece = 'helmet';
  })();

  const state = {
    tab: 'home',
    cat: null,       // id de catégorie ouverte
    sel: {},         // { enchantId: level }
    result: null,    // résultat de l'optimiseur
    showOthers: false, // section « Autres enchantements » dépliée
    trade: { prof: null, q: '' }, // onglet Échanges : profession ouverte, recherche
    struct: { id: null, q: '' },  // onglet Structures : structure ouverte, recherche
    homeQ: '',                    // accueil : recherche globale
    seed: { text: '', platform: 'java_1_21', dimension: 'overworld', x: '', z: '', embed: false, name: '', saved: [], pan: [0, 0], picked: null, msg: '', importOpen: false, exportText: '', zoom: 16, layers: { biomes: true, slime: false, structs: { 5: true, stronghold: true, 18: true, 19: true, 20: true } } }, // onglet Graine
    farm: { id: null, q: '', adding: false, playing: null, draft: { title: '', url: '', note: '' }, err: '', msg: '', importOpen: false, exportText: '' }, // onglet Fermes
    trim: trimState,
  };

  const saveTrim = () => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state.trim)); } catch (e) { /* navigation privée : on ignore */ }
  };

  // ---------- Onglets ----------
  function selectTab(tab) {
    state.tab = tab;
    document.querySelectorAll('.tab').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
    state.cat = null; state.result = null;
    const bar = document.querySelector('.tabbar');
    const sel = bar && bar.querySelector('.tab[aria-selected="true"]');
    if (bar && sel) bar.scrollLeft = sel.offsetLeft - (bar.clientWidth - sel.offsetWidth) / 2;
  }
  function setTab(tab) {
    selectTab(tab);
    render();
    window.scrollTo({ top: 0 });
  }

  // ---------- Enchantements : liste des équipements ----------
  function renderEquipmentList() {
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

  function openCat(id) {
    state.cat = id; state.showOthers = false;
    state.sel = kitSelection(cat(id)); recalc();
  }

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

  // Une seule fois en haut d'une liste : photo du bloc de métier + villageois en tenue + noms.
  // big = bannière de la fiche d'un métier ; sinon petit en-tête au-dessus d'un groupe de résultats.
  function tradePics(p, big) {
    return `
      <div class="thead${big ? ' big' : ''}">
        ${p.block ? `<img class="tpic block" src="${ASSETS}/jobsites/${esc(p.id)}.png" alt="${esc(p.block)}" title="${esc(p.block)}" loading="lazy" />` : ''}
        <img class="tpic villager" src="${ASSETS}/villagers/${esc(p.id)}.png" alt="${esc(p.name)}" title="${esc(p.name)}" loading="lazy" />
        <span class="tcap"><strong>${esc(p.name)}</strong>${p.block ? `<small>${esc(p.block)}</small>` : ''}</span>
      </div>`;
  }

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
      for (const p of TRADES) {
        let first = true;
        for (const lv of p.levels) {
          const hits = lv.trades.filter((t) => [...t.wants, ...t.gives].some((x) => norm(x.name).includes(nq)));
          if (!hits.length) continue;
          count += hits.length;
          if (first) { html += tradePics(p); first = false; }
          html += `<h3 class="lvl">${esc(p.name)} · ${esc(lv.name)}</h3>${hits.map(tradeRow).join('')}`;
        }
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
        ${tradePics(p, true)}
        <p class="hint" style="margin:8px 2px 0">${n} échanges${p.block ? ` · bloc de métier : ${esc(p.block)}` : ''}</p>
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

  // ---------- Accueil ----------
  const TIPS = [
    "À l'enclume, une opération de plus de 39 niveaux est refusée (« Trop cher »). Combiner d'abord les livres entre eux évite souvent d'y arriver.",
    "Un enchantement coûte moins cher quand il vient d'un livre : Raccommodage vaut ×2 en livre et ×4 sur un objet.",
    "Le diamant est le plus fréquent vers y −59, et il n'y en a plus à y 16 et au-dessus.",
    "La recherche de l'onglet Structures répond à « où trouver tel objet ? » : disques, pommes dorées enchantées, tridents…",
    "Les motifs de trim ne se voient qu'en 3D : fais tourner le porte-armure de l'onglet Trims.",
    "Les débris antiques sont les plus fréquents vers y 16 dans le Nether.",
  ];

  function accueilTiles() {
    const nLoot = STRUCTS.reduce((a, st) => a + st.containers.reduce((b, c) => b + c.rows.length, 0), 0);
    const nTrades = TRADES.reduce((a, p) => a + p.levels.reduce((b, l) => b + l.trades.length, 0), 0);
    const T = [
      { tab: 'enchant', icon: 'items/enchanted_book', title: 'Enchantements', desc: "Le meilleur kit par équipement et l'ordre d'enclume le moins cher", stat: `${DATA.CATEGORIES.length} équipements` },
      { tab: 'trims', icon: 'items/diamond_chestplate', title: "Trims d'armure", desc: 'Porte-armure en 3D : matière, motif et couleur', stat: `${DATA.TRIM_PATTERNS.length} motifs · ${DATA.TRIM_MATERIALS.length} couleurs` },
      { tab: 'structures', icon: 'item-icons/ender_eye', title: 'Structures', desc: 'Où les trouver et ce qu’elles contiennent', stat: `${STRUCTS.length} structures · ${nLoot} butins` },
      { tab: 'trades', icon: 'item-icons/emerald', title: 'Échanges', desc: 'Tous les échanges des villageois, niveau par niveau', stat: `${nTrades} échanges` },
      { tab: 'ores', icon: 'items/diamond', title: 'Minerais', desc: 'Le meilleur niveau Y de chaque minerai', stat: `${DATA.ORES.length} minerais` },
      { tab: 'seed', icon: 'item-icons/slimeball', title: 'Graine', desc: 'Carte de ta graine : biomes, villages, structures, spawn, slimes', stat: 'Version · dimension · X Z' },
      { tab: 'farms', icon: 'item-icons/wheat', title: 'Fermes', desc: 'Les fermes à construire, avec tes vidéos YouTube en direct', stat: `${FARMS.length} fermes · ${FARMS.reduce((a, f) => a + countBuilds(f.id), 0)} builds` },
    ];
    return `<div class="home-tiles">${T.map((t) => `
      <button class="home-tile" data-action="go-tab" data-tab="${t.tab}">
        <img class="px" src="${ASSETS}/${t.icon}.png" alt="" />
        <strong>${esc(t.title)}</strong>
        <span>${esc(t.desc)}</span>
        <small>${esc(t.stat)}</small>
      </button>`).join('')}</div>`;
  }

  function homeSearch(raw) {
    const q = raw.trim();
    const nq = norm(q);
    let html = '';

    // équipements
    const cats = DATA.CATEGORIES.filter((c) => norm(c.name).includes(nq));
    if (cats.length) {
      html += `<h2 class="section">Équipements</h2><div class="grid">${cats.map((c) => `
        <button class="tile" data-action="go-cat" data-id="${c.id}">
          <img class="px" src="${ASSETS}/items/${c.icon}.png" alt="" /><span>${esc(c.name)}</span>
          <small>${DATA.KITS[c.id].list.length} au kit</small>
        </button>`).join('')}</div>`;
    }

    // enchantements
    const ench = Object.entries(DATA.ENCHANTS).filter(([, d]) => norm(d[0]).includes(nq));
    if (ench.length) {
      html += `<h2 class="section">Enchantements</h2>${ench.slice(0, 6).map(([id, d]) => `
        <div class="trade">
          <div class="loot-top"><strong>${esc(d[0])}</strong><span class="loot-qty">max ${roman[d[1]]} · livre ×${d[3]} · objet ×${d[2]}</span></div>
          <div class="chips" style="margin-top:8px">${DATA.CATEGORIES.filter((c) => c.enchants.includes(id)).map((c) =>
            `<button class="chip chipbtn" data-action="go-cat" data-id="${c.id}">${esc(c.name)}</button>`).join('')}</div>
        </div>`).join('')}`;
    }

    // fermes
    const fHits = FARMS.filter((f) => norm(f.name + ' ' + f.produces).includes(nq));
    if (fHits.length) {
      html += `<h2 class="section">Fermes</h2><div class="grid">${fHits.slice(0, 6).map((f) => farmTile(f).replace('farm-open', 'go-farm')).join('')}</div>`;
    }

    // structures par nom
    const sNames = STRUCTS.filter((s) => norm(s.name).includes(nq));
    if (sNames.length) {
      html += `<h2 class="section">Structures</h2><div class="grid">${sNames.map((s) => structTile(s).replace('struct-open', 'go-struct')).join('')}</div>`;
    }

    // butins
    const hits = [];
    for (const s of STRUCTS) for (const c of s.containers) for (const r of c.rows) {
      if (norm(r.name).includes(nq)) hits.push({ s, c, r });
    }
    hits.sort((a, b) => chanceNum(b.r.chance) - chanceNum(a.r.chance));
    if (hits.length) {
      html += `<h2 class="section">Où le trouver</h2><p class="hint">${hits.length} source${hits.length > 1 ? 's' : ''} dans les structures, de la plus probable à la moins probable</p>
        ${hits.slice(0, 6).map((h) => `
          <div class="trade">
            <div class="loot-top"><strong>${esc(h.r.name)}</strong><span class="loot-qty">${esc(qtyText(h.r.qty))}</span></div>
            <div class="chance"><span style="width:${Math.max(2, chanceNum(h.r.chance))}%"></span><b>${esc(h.r.chance)}</b></div>
            <div class="tname"><button class="link" data-action="go-struct" data-id="${h.s.id}">${esc(h.s.name)}</button> <span>·</span> ${esc(h.c.name)}</div>
          </div>`).join('')}`;
    }

    // échanges
    const tr = [];
    for (const p of TRADES) for (const l of p.levels) for (const t of l.trades) {
      if ([...t.wants, ...t.gives].some((x) => norm(x.name).includes(nq))) tr.push({ p, l, t });
    }
    if (tr.length) {
      const groups = new Map();
      for (const x of tr.slice(0, 4)) { if (!groups.has(x.p.id)) groups.set(x.p.id, { p: x.p, items: [] }); groups.get(x.p.id).items.push(x); }
      html += `<h2 class="section">Échanges de villageois</h2>${[...groups.values()].map((g) => `${tradePics(g.p)}${g.items.map((x) => `
          <div class="trade"><div class="tname"><strong>${esc(x.l.name)}</strong><br>${esc(itemsText(x.t.wants))} <span>→</span> ${esc(itemsText(x.t.gives))}</div></div>`).join('')}`).join('')}
        <button class="btn ghost" style="width:100%" data-action="go-trades" data-q="${esc(q)}">Voir les ${tr.length} échange${tr.length > 1 ? 's' : ''}</button>`;
    }

    // minerais
    const ores = DATA.ORES.filter((o) => norm(o.name).includes(nq));
    if (ores.length) {
      html += `<h2 class="section">Minerais</h2>${ores.map((o) => `
        <div class="trade"><div class="loot-top"><strong>${esc(o.name)}</strong>
          <span class="loot-qty">${o.best.length ? 'meilleur : ' + o.best.map(fmtY).join(' · ') : 'uniforme'} · de ${fmtY(o.range[0])} à ${fmtY(o.range[1])}</span></div>
          <p class="tnote">${esc(o.note)}</p></div>`).join('')}
        <button class="btn ghost" style="width:100%" data-action="go-tab" data-tab="ores">Ouvrir les minerais</button>`;
    }

    return html || `<div class="notice warn">Rien ne correspond à « ${esc(q)} ». Essaie un nom d'objet, d'enchantement, de structure ou de minerai.</div>`;
  }

  function accueilBody() {
    if (state.homeQ.trim()) return homeSearch(state.homeQ);
    const tip = TIPS[Math.floor(Date.now() / 86400000) % TIPS.length];
    return `
      ${accueilTiles()}
      <section class="panel tip-card"><div class="control-title">Le saviez-vous ?</div><p>${esc(tip)}</p></section>
      <section class="panel about">
        <div class="control-title">À propos</div>
        <ul>
          <li>Minecraft <b>Java</b> uniquement.</li>
          <li>Données issues du wiki Minecraft ; textures du jeu.</li>
          <li>Fonctionne <b>hors-ligne</b> après la première ouverture.</li>
          <li>Pour l'installer : menu ⋮ du navigateur → « Installer l'application » (iPhone : Partager → « Sur l'écran d'accueil »).</li>
        </ul>
      </section>`;
  }

  function renderAccueil() {
    return `
      <section class="hero">
        <img class="hero-logo" src="${ASSETS}/icons/icon-192.png" alt="" />
        <h2 class="hero-title">Grimoire</h2>
        <p class="hero-sub">Le guide de poche de Minecraft Java</p>
      </section>
      <input id="home-q" class="search" type="search" inputmode="search" placeholder="Cherche un objet, un enchantement…" value="${esc(state.homeQ)}" autocomplete="off" />
      <div id="home-body">${accueilBody()}</div>`;
  }

  // ---------- Fermes et builds ----------
  const BUILDS_KEY = 'grimoire.builds.v1';
  const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const farm = (id) => FARMS.find((f) => f.id === id);

  // Liens saisis dans l'app (stockés sur l'appareil). Tout ce qui n'est pas un lien http(s) valide est ignoré.
  function sanitizeBuilds(raw) {
    const out = {};
    if (!raw || typeof raw !== 'object') return out;
    for (const f of FARMS) {
      const list = Array.isArray(raw[f.id]) ? raw[f.id] : [];
      const clean = list
        .filter((b) => b && typeof b.title === 'string' && b.title.trim() && typeof b.url === 'string' && VIDEO.parseVideoUrl(b.url))
        .map((b) => ({ id: typeof b.id === 'string' && b.id ? b.id.slice(0, 40) : newId(), title: b.title.trim().slice(0, 80), url: b.url.trim(), note: typeof b.note === 'string' ? b.note.trim().slice(0, 300) : '' }));
      if (clean.length) out[f.id] = clean;
    }
    return out;
  }
  let userBuilds = {};
  try { userBuilds = sanitizeBuilds(JSON.parse(localStorage.getItem(BUILDS_KEY))); } catch (e) { userBuilds = {}; }
  function saveBuilds() {
    try { localStorage.setItem(BUILDS_KEY, JSON.stringify(userBuilds)); }
    catch (e) { state.farm.msg = "Impossible d'enregistrer sur cet appareil (stockage indisponible)."; }
  }

  // Builds d'une ferme : ceux du fichier js/builds-data.js, puis les tiens.
  function farmBuilds(id) {
    const fromFile = (Array.isArray(FILE_BUILDS[id]) ? FILE_BUILDS[id] : [])
      .filter((b) => b && b.title && b.url && VIDEO.parseVideoUrl(b.url))
      .map((b, i) => ({ id: `file-${i}`, title: String(b.title), url: String(b.url), note: b.note ? String(b.note) : '', local: false }));
    return fromFile.concat((userBuilds[id] || []).map((b) => ({ ...b, local: true })));
  }
  const countBuilds = (id) => farmBuilds(id).length;
  const totalLocal = () => Object.values(userBuilds).reduce((a, l) => a + l.length, 0);

  function buildCard(b) {
    const v = VIDEO.parseVideoUrl(b.url);
    const open = v.kind === 'youtube' ? v.watch : v.href;
    const label = v.kind === 'youtube' ? 'YouTube' : v.host;
    let media = '';
    if (v.kind === 'youtube') {
      if (state.farm.playing === b.id) {
        media = `<div class="player"><iframe src="${esc(v.embed)}" title="${esc(b.title)}" loading="lazy"
          allow="accelerometer; autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen
          referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`;
      } else {
        const thumb = v.id ? `<img class="thumb" src="https://i.ytimg.com/vi/${esc(v.id)}/hqdefault.jpg" alt="" loading="lazy" />` : '';
        media = `<button class="player poster" data-action="build-play" data-uid="${esc(b.id)}" aria-label="Lire la vidéo ${esc(b.title)}">
          ${thumb}<span class="playbtn">▶</span><small>Lire dans l'app · connexion requise</small></button>`;
      }
    }
    return `
      <article class="build">
        <div class="build-head"><strong>${esc(b.title)}</strong><span class="chip">${esc(label)}</span></div>
        ${media}
        ${b.note ? `<p class="ore-note">${esc(b.note)}</p>` : ''}
        <div class="build-actions">
          <a class="btn ghost small" href="${esc(open)}" target="_blank" rel="noopener noreferrer">Ouvrir ↗</a>
          ${b.local ? `<button class="btn ghost small danger" data-action="build-del" data-uid="${esc(b.id)}">Supprimer</button>` : '<span class="hint">Fichier de l\'app</span>'}
        </div>
      </article>`;
  }

  function addForm() {
    const d = state.farm.draft;
    return `
      <section class="panel" style="margin-top:12px">
        <div class="control-title">Nouveau build</div>
        <label class="field">Titre<input id="b-title" type="text" maxlength="80" placeholder="Ex. Ferme à fer compacte" value="${esc(d.title)}" /></label>
        <label class="field">Lien de la vidéo<input id="b-url" type="url" inputmode="url" placeholder="https://youtu.be/…" value="${esc(d.url)}" autocomplete="off" autocapitalize="off" /></label>
        <label class="field">Note (facultatif)<input id="b-note" type="text" maxlength="300" placeholder="Rendement, version, remarque…" value="${esc(d.note)}" /></label>
        ${state.farm.err ? `<div class="notice error" style="margin:8px 0 0">${esc(state.farm.err)}</div>` : ''}
        <div class="toolbar"><button class="btn" data-action="build-save">Enregistrer</button><button class="btn ghost" data-action="build-cancel">Annuler</button></div>
      </section>`;
  }

  function farmDetail(f) {
    const builds = farmBuilds(f.id);
    return `
      <button class="back" data-action="farm-back">← Fermes</button>
      <div class="cat-head">
        <span class="bigicon">${sIcon(f.icon)}</span>
        <div><h2>${esc(f.name)}</h2><p>${esc(f.cat)}</p></div>
      </div>
      <p class="sdesc">${esc(f.desc)}</p>
      <div class="chips" style="margin-top:10px"><span class="chip">Produit : ${esc(f.produces)}</span></div>
      <h2 class="section">Builds (${builds.length})</h2>
      ${state.farm.msg ? `<div class="notice warn" style="margin-bottom:10px">${esc(state.farm.msg)}</div>` : ''}
      ${builds.length ? builds.map(buildCard).join('') : '<div class="notice warn">Aucun build pour cette ferme. Ajoute le lien d\'une vidéo YouTube.</div>'}
      ${state.farm.adding ? addForm() : '<button class="btn" style="width:100%;margin-top:6px" data-action="build-add">＋ Ajouter un build</button>'}`;
  }

  function farmTile(f) {
    const n = countBuilds(f.id);
    return `<button class="tile" data-action="farm-open" data-id="${f.id}">${sIcon(f.icon)}<span>${esc(f.name)}</span><small>${n ? n + ' build' + (n > 1 ? 's' : '') : 'aucun lien'}</small></button>`;
  }

  function farmBody() {
    const { id, q } = state.farm;
    const nq = norm(q.trim());
    if (nq) {
      const list = FARMS.filter((f) => norm(f.name + ' ' + f.produces).includes(nq));
      return list.length ? `<div class="grid">${list.map(farmTile).join('')}</div>` : `<div class="notice warn">Aucune ferme ne correspond à « ${esc(q.trim())} ».</div>`;
    }
    if (id) return farmDetail(farm(id));
    const cats = [...new Set(FARMS.map((f) => f.cat))];
    const mine = totalLocal();
    return cats.map((c) => `<h2 class="section">${esc(c)}</h2><div class="grid">${FARMS.filter((f) => f.cat === c).map(farmTile).join('')}</div>`).join('') + `
      <h2 class="section">Mes liens</h2>
      <section class="panel">
        <p class="hint" style="margin:0 0 8px">${mine} lien${mine > 1 ? 's' : ''} enregistré${mine > 1 ? 's' : ''} sur cet appareil. Garde une copie pour ne pas les perdre si tu réinstalles l'app.</p>
        ${state.farm.msg ? `<div class="notice warn" style="margin-bottom:8px">${esc(state.farm.msg)}</div>` : ''}
        <div class="toolbar" style="margin-top:0">
          <button class="btn ghost small" data-action="builds-export" ${mine ? '' : 'disabled'}>Copier mes liens</button>
          <button class="btn ghost small" data-action="builds-import-toggle">Importer</button>
        </div>
        ${state.farm.exportText ? `<textarea class="area" readonly rows="4" aria-label="Mes liens à copier">${esc(state.farm.exportText)}</textarea>` : ''}
        ${state.farm.importOpen ? `<textarea id="imp-text" class="area" rows="4" placeholder="Colle ici les liens copiés"></textarea><button class="btn small" data-action="builds-import">Valider l'import</button>` : ''}
      </section>
      <p class="disclaimer">Liste de fermes rédigée à la main. Les vidéos viennent de YouTube : le lecteur intégré demande une connexion internet.</p>`;
  }

  function renderFarms() {
    return `
      <input id="farm-q" class="search" type="search" inputmode="search" placeholder="Chercher une ferme (fer, xp, canne…)" value="${esc(state.farm.q)}" autocomplete="off" />
      <div id="farm-body">${farmBody()}</div>`;
  }

  // Ajout / suppression / import / export (actions appelées depuis le gestionnaire de clics)
  function saveDraftBuild() {
    const d = state.farm.draft;
    const title = d.title.trim();
    if (!title) { state.farm.err = 'Donne un titre au build.'; return; }
    const v = VIDEO.parseVideoUrl(d.url);
    if (!v) { state.farm.err = 'Ce lien n\'est pas valide. Colle l\'adresse complète de la vidéo (https://…).'; return; }
    const id = state.farm.id;
    (userBuilds[id] = userBuilds[id] || []).push({ id: newId(), title: title.slice(0, 80), url: d.url.trim(), note: d.note.trim().slice(0, 300) });
    saveBuilds();
    state.farm.adding = false; state.farm.err = ''; state.farm.draft = { title: '', url: '', note: '' };
    state.farm.msg = v.kind === 'youtube' ? '' : 'Lien enregistré : il n\'est pas de YouTube, il s\'ouvrira hors de l\'app.';
  }
  function importBuilds(text) {
    let raw;
    try { raw = JSON.parse(text); } catch (e) { state.farm.msg = 'Texte illisible : colle exactement ce qu\'a copié « Copier mes liens ».'; return; }
    const incoming = sanitizeBuilds(raw);
    let added = 0;
    for (const f of FARMS) {
      for (const b of incoming[f.id] || []) {
        const have = (userBuilds[f.id] || []).some((x) => x.url === b.url);
        if (!have) { (userBuilds[f.id] = userBuilds[f.id] || []).push(b); added++; }
      }
    }
    saveBuilds();
    state.farm.importOpen = false;
    state.farm.msg = added ? `${added} lien${added > 1 ? 's' : ''} importé${added > 1 ? 's' : ''}.` : 'Aucun nouveau lien à importer.';
  }

  // ---------- Graine ----------
  const SEEDS_KEY = 'grimoire.seeds.v1';
  const cbPlatform = (p) => (SEED.PLATFORMS.includes(p) ? p : 'java_1_21');
  const PLATFORM_LABEL = (id) => 'Java ' + id.replace('java_', '').replace(/_/g, '.');
  const DIM_LABEL = { overworld: 'Overworld', nether: 'Nether', end: "L'End" };
  const TOOLS = [
    ['seed-map', 'Carte de la graine', 'biomes et structures'],
    ['slime-finder', 'Chunks à slimes', 'version Chunkbase'],
    ['cave-finder', 'Grottes', 'cave finder'],
    ['igloo-finder', 'Igloos', 'igloo finder'],
    ['seed-finder', 'Chercher une graine', 'seed finder'],
  ];

  function sanitizeSeedEntry(b) {
    if (!b || typeof b !== 'object') return null;
    const text = typeof b.text === 'string' ? b.text.trim().slice(0, 100) : '';
    const x = Number(b.x), z = Number(b.z);
    return {
      id: typeof b.id === 'string' && b.id ? b.id.slice(0, 40) : newId(),
      name: (typeof b.name === 'string' && b.name.trim() ? b.name.trim() : 'Ma graine').slice(0, 60),
      text,
      platform: WORLD.VERSIONS.some((v) => v.key === b.platform) ? b.platform : 'java_1_21',
      dimension: SEED.DIMENSIONS.includes(b.dimension) ? b.dimension : 'overworld',
      // vide = carte centrée sur le point d'apparition (spawn)
      x: b.x !== '' && b.x != null && Number.isInteger(x) && Math.abs(x) <= SEED.COORD_LIMIT ? x : '',
      z: b.z !== '' && b.z != null && Number.isInteger(z) && Math.abs(z) <= SEED.COORD_LIMIT ? z : '',
    };
  }
  try {
    const raw = JSON.parse(localStorage.getItem(SEEDS_KEY));
    if (raw && typeof raw === 'object') {
      const f = sanitizeSeedEntry({ ...raw.form, name: 'form' });
      if (f) Object.assign(state.seed, { text: f.text, platform: f.platform, dimension: f.dimension, x: String(f.x), z: String(f.z) });
      if (Array.isArray(raw.saved)) state.seed.saved = raw.saved.map(sanitizeSeedEntry).filter((e) => e && e.text).slice(0, 50);
    }
  } catch (e) { /* sauvegarde absente ou corrompue : valeurs par défaut */ }
  function saveSeedState() {
    const sd = state.seed;
    try { localStorage.setItem(SEEDS_KEY, JSON.stringify({ form: { text: sd.text, platform: sd.platform, dimension: sd.dimension, x: sd.x, z: sd.z }, saved: sd.saved })); }
    catch (e) { sd.msg = "Impossible d'enregistrer sur cet appareil (stockage indisponible)."; }
  }

  const seedNum = (v) => { const n = Number(String(v).trim()); return String(v).trim() !== '' && Number.isInteger(n) && Math.abs(n) <= SEED.COORD_LIMIT ? n : null; };
  const seedXZ = () => [seedNum(state.seed.x), seedNum(state.seed.z)];
  // 'spawn' : aucune coordonnée saisie ; 'coords' : X et Z valides ; 'invalid' : saisie incomplète ou incorrecte
  const coordMode = () => {
    const sd = state.seed, empty = (v) => String(v).trim() === '';
    if (empty(sd.x) && empty(sd.z)) return 'spawn';
    const [x, z] = seedXZ();
    return x !== null && z !== null ? 'coords' : 'invalid';
  };
  function seedUrl(tool) {
    const ps = SEED.parseSeed(state.seed.text);
    const [x, z] = seedXZ();
    return SEED.chunkbaseUrl({ tool, seed: ps.seed, platform: cbPlatform(state.seed.platform), dimension: state.seed.dimension, x: x === null ? undefined : x, z: z === null ? undefined : z });
  }

  function seedOutputs() {
    const sd = state.seed;
    const ps = SEED.parseSeed(sd.text);
    const [x, z] = seedXZ();
    const url = seedUrl('seed-map');
    const has = ps.kind !== 'empty';
    let resolved;
    if (ps.kind === 'empty') resolved = '<p class="hint" style="margin:0 0 10px">Entre une graine (un nombre, ou un texte comme dans le jeu) pour générer la carte.</p>';
    else if (ps.kind === 'number') resolved = `<p class="seedline">Graine : <b>${esc(ps.seed.toString())}</b></p>`;
    else resolved = `<p class="seedline">Texte « ${esc(ps.text)} » → graine <b>${esc(ps.seed.toString())}</b> <small>(conversion du jeu)</small></p>`;

    const coordsOk = x !== null && z !== null;
    const det = coordsOk ? SEED.describeCoords(sd.dimension, x, z) : null;
    const fmt = (a) => `${a[0]} ; ${a[1]}`;
    const conv = det ? `
      <div class="kv">
        ${det.overworld ? `<span>Overworld</span><b>X ${det.overworld[0]} · Z ${det.overworld[1]}</b>` : ''}
        ${det.nether ? `<span>Nether</span><b>X ${det.nether[0]} · Z ${det.nether[1]}</b>` : ''}
        ${det.end ? `<span>L'End</span><b>X ${det.end[0]} · Z ${det.end[1]}</b>` : ''}
        <span>Chunk</span><b>${fmt(det.chunk)} <small>(blocs X ${det.chunkBlocks.x[0]} à ${det.chunkBlocks.x[1]}, Z ${det.chunkBlocks.z[0]} à ${det.chunkBlocks.z[1]})</small></b>
        <span>Région</span><b>${fmt(det.region)}</b>
        <span>Position dans le chunk</span><b>${fmt(det.inChunk)}</b>
      </div>
      ${det.nether && sd.dimension === 'overworld' ? '<p class="hint" style="margin:6px 0 0">Nether = Overworld ÷ 8 (arrondi vers le bas), sur X et Z seulement.</p>' : ''}` : '<p class="hint">Entre des coordonnées entières valides (X et Z) pour les convertir.</p>';

    return `
      ${resolved}
      ${sd.msg ? `<div class="notice warn" style="margin-top:8px">${esc(sd.msg)}</div>` : ''}
      <h2 class="section">Convertisseur de coordonnées</h2>
      <section class="panel">${conv}</section>
      <h2 class="section">Comparer avec Chunkbase</h2>
      <section class="panel">
        <div class="toolbar" style="margin-top:0">
          <a class="btn ghost small" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Ouvrir sur Chunkbase ↗</a>
          <button class="btn ghost small" data-action="seed-copy-link">Copier le lien</button>
          <button class="btn ghost small" data-action="seed-copy-seed" ${has ? '' : 'disabled'}>Copier la graine</button>
        </div>
      </section>`;
  }

  // ---------- Carte du monde (biomes + structures) ----------
  const DIM_ID = { overworld: 0, nether: -1, end: 1 };
  const ZOOMS = [[1, 'Bloc', '≈ 160 blocs'], [4, 'Détail', '≈ 640 blocs'], [16, 'Moyen', '≈ 2 500 blocs'], [64, 'Large', '≈ 10 000 blocs'], [256, 'Très large', '≈ 41 000 blocs']];
  const MAP_CELLS = 160, MAP_PX = 2, MAP_SIZE = MAP_CELLS * MAP_PX;
  const STRUCT_COLORS = { 5: '#ffd34d', 10: '#ff5555', 9: '#b07a3c', 8: '#55ffff', 13: '#4a8fe0', 24: '#ffaa00', 1: '#e6d28a', 2: '#3fbf3f', 3: '#b46be0', 4: '#ffffff', 6: '#6ab0de', 7: '#c58b4a', 14: '#ffdd55', 15: '#c0c0c0', 11: '#a020f0', 16: '#5599ff', 23: '#d9a066', 18: '#d63a2a', 19: '#f5c542', 12: '#a020f0', 20: '#ff55ff', stronghold: '#00e5a0' };
  const ICONS = window.MC_MAP_ICONS || { structures: {}, biomes: {} };
  const iconUrl = (kind, key) => { const f = (ICONS[kind] || {})[key]; return f ? 'assets/map-icons/' + f + '.png' : ''; };
  const imgCache = {};
  function loadIcon(url) {
    if (!url) return Promise.resolve(null);
    if (!imgCache[url]) imgCache[url] = new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = url; });
    return imgCache[url];
  }
  const markerColor = (id) => (id === 'spawn' ? '#ffffff' : STRUCT_COLORS[id] || '#ffffff');
  const mkHtml = (id) => { const u = iconUrl('structures', id); return `<span class="mk" style="background:${markerColor(id)}">${u ? `<img src="${u}" alt="" width="16" height="16" />` : ''}</span>`; };
  const biomeIconHtml = (en) => { const u = iconUrl('biomes', en); return u ? `<img class="bi" src="${u}" alt="" width="16" height="16" />` : ''; };
  const mapState = { token: 0, geom: null, markers: [], note: '' };
  let worldP = null;
  function worldEngine() {
    if (!worldP) {
      worldP = fetch('assets/world.wasm').then((r) => { if (!r.ok) throw new Error('moteur introuvable'); return r.arrayBuffer(); }).then((b) => WORLD.load(b));
      worldP.catch(() => { worldP = null; });
    }
    return worldP;
  }
  const mapStructList = () => {
    const d = DIM_ID[state.seed.dimension];
    const l = WORLD.STRUCTURES.filter((s) => s.dim === d);
    if (d === 0) l.push(WORLD.STRONGHOLD);
    return l;
  };
  const KMIN = 0.004, KMAX = 4;                       // pixels de carte par bloc : de ≈ 130 000 blocs à 1/4 de bloc par pixel
  const viewBlocks = () => MAP_SIZE / view.k;

  function mapSection() {
    const sd = state.seed;
    const ps = SEED.parseSeed(sd.text);
    if (ps.kind === 'empty') return '<p class="hint">Entre une graine pour afficher la carte.</p>';
    if (coordMode() === 'invalid') return '<p class="hint">Entre des coordonnées valides (X et Z) pour centrer la carte.</p>';
    const L = sd.layers;
    return `
      <div class="chips" role="group" aria-label="Zoom">${ZOOMS.map(([s, name, w]) => `<button class="chip chipbtn ${sd.zoom === s ? 'on' : ''}" data-action="map-zoom" data-z="${s}" aria-pressed="${sd.zoom === s}">${name} <small>${w}</small></button>`).join('')}</div>
      <div class="mapwrap"><canvas id="seed-cv" class="mapcv" width="${MAP_SIZE}" height="${MAP_SIZE}" aria-label="Carte du monde"></canvas><div class="mapzoom"><button data-action="map-zstep" data-d="-1" aria-label="Zoomer" ${sd.zoom === ZOOMS[0][0] ? 'disabled' : ''}>+</button><button data-action="map-zstep" data-d="1" aria-label="Dézoomer" ${sd.zoom === ZOOMS[ZOOMS.length - 1][0] ? 'disabled' : ''}>−</button></div><div id="map-status" class="mapstatus">Chargement du moteur de carte…</div></div>
      <div class="toolbar" style="margin-top:8px">
        <button class="btn ghost small" data-action="map-pan" data-dx="-1" data-dz="0" aria-label="Gauche">◀</button>
        <button class="btn ghost small" data-action="map-pan" data-dx="0" data-dz="-1" aria-label="Haut">▲</button>
        <button class="btn ghost small" data-action="map-pan" data-dx="0" data-dz="1" aria-label="Bas">▼</button>
        <button class="btn ghost small" data-action="map-pan" data-dx="1" data-dz="0" aria-label="Droite">▶</button>
        <button class="btn ghost small" data-action="map-pan" data-reset="1">Recentrer</button>
      </div>
      <div id="map-info" class="mapinfo hint">Touche la carte pour lire le biome et les coordonnées, un doigt pour te déplacer, deux doigts pour zoomer et déplacer en même temps (ou boutons + et −). La carte est centrée sur le point d'apparition (boussole) si tu ne saisis pas de coordonnées.</div>
      <div class="control-title">Couches</div>
      <div class="chips" role="group" aria-label="Couches">
        <button class="chip chipbtn ${L.biomes ? 'on' : ''}" data-action="map-layer" data-id="biomes" aria-pressed="${L.biomes}">Biomes</button>
        ${DIM_ID[sd.dimension] === 0 ? `<button class="chip chipbtn ${L.slime ? 'on' : ''}" data-action="map-layer" data-id="slime" aria-pressed="${L.slime}">Chunks à slimes</button>` : ''}
      </div>
      <div class="control-title">Structures</div>
      <div class="chips" role="group" aria-label="Structures">${mapStructList().map((s) => `<button class="chip chipbtn ${L.structs[s.id] ? 'on' : ''}" data-sid="${s.id}" data-action="map-layer" data-id="${s.id}" aria-pressed="${!!L.structs[s.id]}">${mkHtml(s.id)}${esc(s.fr)}</button>`).join('')}</div>
      <div id="map-notes" class="hint" style="margin-top:6px"></div>
      <div class="control-title">Biomes dans la zone</div>
      <div id="map-biomes" class="mapbiomes"></div>
      <div class="control-title">Structures dans la zone</div>
      <div id="map-found"></div>`;
  }

  // ---------- Génération par tuiles ----------
  // La carte est découpée en tuiles de 32 × 32 cellules, générées en arrière-plan bien au-delà de l'écran
  // (PREFETCH tuiles de marge), de la plus proche du centre vers la plus lointaine. Pendant qu'on fait glisser
  // la carte, l'image se déplace en direct et la génération continue dans la direction du mouvement.
  const TILE = 32, MAX_TILES = 900;
  const tiles = new Map();                       // 'échelle|tx|tz' -> tuile (biomes, structures, slimes)
  let tileGen = '';                              // identifiant du monde pour lequel le cache est valable
  let engineKey = '';
  let pumpTimer = null, paintReq = 0, settleTimer = null, mapReady = false;
  const view = { cx: 0, cz: 0, k: 0 };            // centre de la vue (blocs, décimal possible) et zoom continu (px par bloc)
  const levelCount = {};                         // nombre de tuiles en cache par échelle
  const biomeCols = {};
  const iconImgs = {};

  function levelFor(k) {
    let best = ZOOMS[0][0], bd = Infinity;
    for (const [S] of ZOOMS) { const d = Math.abs(Math.log((k * S) / 2 / 1.4)); if (d < bd) { bd = d; best = S; } }
    return best;
  }
  function syncZoomUI() {
    const S = state.seed.zoom;
    document.querySelectorAll('[data-action="map-zoom"]').forEach((b) => { const on = Number(b.dataset.z) === S; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    const zin = document.querySelector('[data-action="map-zstep"][data-d="-1"]'), zout = document.querySelector('[data-action="map-zstep"][data-d="1"]');
    if (zin) zin.disabled = view.k >= KMAX - 1e-9;
    if (zout) zout.disabled = view.k <= KMIN + 1e-9;
  }
  function setK(k) {
    view.k = Math.min(KMAX, Math.max(KMIN, k));
    const S = levelFor(view.k);
    if (S !== state.seed.zoom) { state.seed.zoom = S; state.seed.picked = null; }
    syncZoomUI();
  }
  const syncPan = () => { const b = mapState.base || [0, 0]; state.seed.pan = [view.cx - b[0], view.cz - b[1]]; };
  let tween = 0;
  function tweenK(target, ms) {                      // zoom animé autour du centre de la carte
    cancelAnimationFrame(tween);
    const k0 = view.k, t0 = performance.now(), dur = ms || 200;
    const step = (now) => {
      const f = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - f, 3);
      setK(k0 * Math.pow(Math.min(KMAX, Math.max(KMIN, target)) / k0, e));
      schedulePaint(); pump(); scheduleSettle();
      if (f < 1) tween = requestAnimationFrame(step);
    };
    tween = requestAnimationFrame(step);
  }

  function genParams() {
    const sd = state.seed, ps = SEED.parseSeed(sd.text);
    if (ps.kind === 'empty') return null;
    const ver = WORLD.VERSIONS.find((v) => v.key === sd.platform) || WORLD.VERSIONS[0];
    const dim = DIM_ID[sd.dimension];
    return { ver, dim, seed: ps.seed, key: `${ver.mc}|${ps.seed}|${dim}` };
  }
  function ensureEngine(w, p) {
    if (engineKey !== p.key) { w.init(p.ver.mc, p.seed, p.dim, false); engineKey = p.key; }
  }
  const mapIsLive = () => !!document.getElementById('seed-cv') && mapReady;
  const syncView = () => { const b = mapState.base || [0, 0]; view.cx = b[0] + state.seed.pan[0]; view.cz = b[1] + state.seed.pan[1]; };
  const biomeCol = (w, id) => biomeCols[id] || (biomeCols[id] = w.biomeColor(id));

  function layerPlan(w, p) {
    const sd = state.seed, viewB = MAP_SIZE / view.k, ids = [], notes = [];
    for (const s of mapStructList()) {
      if (s.id === 'stronghold' || !sd.layers.structs[s.id]) continue;
      if (!w.structureSupported(s.id)) { notes.push(`${s.fr} : n'existe pas dans cette version.`); continue; }
      const reg = w.structureRegion(s.id) || 16;
      if (Math.pow(viewB / reg, 2) > 5000) { notes.push(`${s.fr} : zoome pour les afficher (trop de positions à cette échelle).`); continue; }
      ids.push(s.id);
    }
    let slime = false;
    if (sd.layers.slime && p.dim === 0) { if (sd.zoom > 16) notes.push('Chunks à slimes : zoome (Bloc, Détail ou Moyen) pour les voir.'); else slime = true; }
    return { ids, notes, slime, stronghold: !!(sd.layers.structs.stronghold && p.dim === 0) };
  }

  function buildTile(w, p, plan, S, tx, tz) {
    const key = `${S}|${tx}|${tz}`;
    let t = tiles.get(key);
    const bx0 = tx * TILE, bz0 = tz * TILE, X0 = bx0 * S, Z0 = bz0 * S, X1 = X0 + TILE * S - 1, Z1 = Z0 + TILE * S - 1;
    if (!t) {
      const ids = w.biomes(S, bx0, bz0, TILE, TILE, p.dim === 0 ? (S === 1 ? 256 : 64) : (S === 1 ? 60 : 15)) || new Int32Array(TILE * TILE);
      const cv = document.createElement('canvas'); cv.width = cv.height = TILE;
      const cx = cv.getContext('2d'); const img = cx.createImageData(TILE, TILE);
      for (let i = 0; i < ids.length; i++) {
        const c = biomeCol(w, ids[i]);
        img.data[i * 4] = c[0]; img.data[i * 4 + 1] = c[1]; img.data[i * 4 + 2] = c[2]; img.data[i * 4 + 3] = 255;
      }
      cx.putImageData(img, 0, 0);
      t = { S, tx, tz, ids, canvas: cv, mk: {}, slime: undefined };
      tiles.set(key, t); levelCount[S] = (levelCount[S] || 0) + 1;
    }
    for (const id of plan.ids) if (!(id in t.mk)) t.mk[id] = w.structures(id, X0, Z0, X1, Z1);
    if (plan.slime && t.slime === undefined) {
      const n = (TILE * S) / 16, cv = document.createElement('canvas'); cv.width = cv.height = n;
      const cx = cv.getContext('2d'); const img = cx.createImageData(n, n);
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        if (!w.slime(X0 / 16 + i, Z0 / 16 + j)) continue;
        const k = (j * n + i) * 4; img.data[k] = 100; img.data[k + 1] = 255; img.data[k + 2] = 90; img.data[k + 3] = 160;
      }
      cx.putImageData(img, 0, 0); t.slime = cv;
    }
    return t;
  }

  // Prochaine tuile à générer : la plus proche du centre parmi celles de la zone visible + marge
  function nextWork(plan) {
    const S = state.seed.zoom, tb = TILE * S, half = MAP_SIZE / view.k / 2;
    const PRE = Math.max(2, Math.ceil(160 / (tb * view.k)));          // marge d'environ une demi-carte au-delà de chaque bord
    const tx0 = Math.floor((view.cx - half) / tb) - PRE, tx1 = Math.floor((view.cx + half) / tb) + PRE;
    const tz0 = Math.floor((view.cz - half) / tb) - PRE, tz1 = Math.floor((view.cz + half) / tb) + PRE;
    let best = null, bd = Infinity;
    for (let tz = tz0; tz <= tz1; tz++) for (let tx = tx0; tx <= tx1; tx++) {
      const t = tiles.get(`${S}|${tx}|${tz}`);
      const complete = t && plan.ids.every((id) => id in t.mk) && (!plan.slime || t.slime !== undefined);
      if (complete) continue;
      const d = Math.hypot((tx + 0.5) * tb - view.cx, (tz + 0.5) * tb - view.cz);
      if (d < bd) { bd = d; best = [tx, tz]; }
    }
    return best;
  }
  function strongholdNeed() {
    const half = MAP_SIZE / view.k / 2 + 160 / view.k;
    const far = Math.hypot(Math.abs(view.cx) + half, Math.abs(view.cz) + half);
    return far < 3200 ? 3 : far < 6200 ? 9 : far < 9200 ? 19 : far < 15000 ? 35 : 128;
  }

  function pump() { if (!pumpTimer) pumpTimer = setTimeout(pumpStep, 0); }
  async function pumpStep() {
    pumpTimer = null;
    if (!mapIsLive()) return;
    let w;
    try { w = await worldEngine(); } catch (e) { return; }
    const p = genParams();
    if (!p || !mapIsLive()) return;
    ensureEngine(w, p);
    const plan = layerPlan(w, p);
    mapState.plan = plan;
    const t0 = performance.now();
    let did = false, more = false;
    try {
      while (performance.now() - t0 < 12) {
        const n = nextWork(plan);
        if (!n) break;
        buildTile(w, p, plan, state.seed.zoom, n[0], n[1]);
        did = true;
      }
      more = !!nextWork(plan);
      if (!more && plan.stronghold) {                  // forteresses : calculées par anneaux, seulement ce qui peut être visible
        const need = strongholdNeed();
        if (!mapState.sh || mapState.sh.key !== p.key || mapState.sh.n < need) { mapState.sh = { key: p.key, n: need, list: w.strongholds(need) }; did = true; }
      }
      if (!more && p.dim === 0 && (!mapState.spawn || mapState.spawn.key !== p.key)) { mapState.spawn = { key: p.key, pos: w.spawn() }; did = true; }
    } catch (e) {
      const st = document.getElementById('map-status');
      if (st) { st.textContent = 'Erreur de calcul : ' + (e && e.message ? e.message : e); st.style.display = 'block'; }
      return;
    }
    if (tiles.size > MAX_TILES) {                       // on oublie les tuiles les plus lointaines
      const arr = [...tiles.entries()].map(([k, t]) => [k, Math.hypot((t.tx + 0.5) * TILE * t.S - view.cx, (t.tz + 0.5) * TILE * t.S - view.cz)]).sort((a, b) => b[1] - a[1]);
      for (let i = 0; i < arr.length - Math.floor(MAX_TILES * 0.7); i++) { const t = tiles.get(arr[i][0]); if (t) levelCount[t.S]--; tiles.delete(arr[i][0]); }
    }
    if (did) schedulePaint();
    if (more) pump(); else scheduleSettle();
  }

  function schedulePaint() { if (!paintReq) paintReq = requestAnimationFrame(() => { paintReq = 0; paint(); }); }
  function scheduleSettle() { clearTimeout(settleTimer); settleTimer = setTimeout(settleMap, 120); }

  function paint() {
    const cv = document.getElementById('seed-cv');
    if (!cv || !mapReady) return;
    const sd = state.seed, S = sd.zoom, p = genParams();
    if (!p) return;
    const ctx = cv.getContext('2d');
    const k = view.k, viewB = MAP_SIZE / k, X0 = view.cx - viewB / 2, Z0 = view.cz - viewB / 2;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#1d1830'; ctx.fillRect(0, 0, MAP_SIZE, MAP_SIZE);
    const plan = mapState.plan || { ids: [], slime: false };
    const markers = [];
    const levelsDrawn = ZOOMS.map((q) => q[0]).filter((L) => L !== S && levelCount[L] > 0 && Math.abs(Math.log(L / S) / Math.log(4)) <= 2)
      .sort((a, b) => Math.abs(Math.log(b / S)) - Math.abs(Math.log(a / S)));      // d'abord les plus éloignés, en fond
    const drawLevel = (L, collect) => {
      const tb = TILE * L, tw = tb * k;
      const tx0 = Math.floor(X0 / tb), tx1 = Math.floor((X0 + viewB) / tb), tz0 = Math.floor(Z0 / tb), tz1 = Math.floor((Z0 + viewB) / tb);
      let miss = 0;
      for (let tz = tz0; tz <= tz1; tz++) for (let tx = tx0; tx <= tx1; tx++) {
        const t = tiles.get(`${L}|${tx}|${tz}`);
        if (!t) { miss++; continue; }
        const dx = Math.floor((tx * tb - X0) * k), dz = Math.floor((tz * tb - Z0) * k);
        const dw = Math.ceil((tx * tb - X0) * k + tw) - dx, dh = Math.ceil((tz * tb - Z0) * k + tw) - dz;
        if (sd.layers.biomes) ctx.drawImage(t.canvas, dx, dz, dw, dh);
        if (collect) {
          if (plan.slime && t.slime) ctx.drawImage(t.slime, dx, dz, dw, dh);
          for (const id of plan.ids) { const l = t.mk[id]; if (l) for (const m of l) markers.push({ id, x: m[0], z: m[1] }); }
        }
      }
      return miss;
    };
    for (const L of levelsDrawn) drawLevel(L, false);
    const missing = drawLevel(S, true);
    if (plan.stronghold && mapState.sh && mapState.sh.key === p.key) for (const m of mapState.sh.list) markers.push({ id: 'stronghold', x: m[0], z: m[1] });
    if (p.dim === 0 && mapState.spawn && mapState.spawn.key === p.key) markers.push({ id: 'spawn', x: mapState.spawn.pos[0], z: mapState.spawn.pos[1] });
    const vis = [];
    for (const m of markers) {
      const px = (m.x - X0) * k, py = (m.z - Z0) * k;
      if (px < -12 || py < -12 || px > MAP_SIZE + 12 || py > MAP_SIZE + 12) continue;
      vis.push(m);
      ctx.beginPath(); ctx.arc(px, py, 9, 0, Math.PI * 2);
      ctx.fillStyle = markerColor(m.id); ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = '#000'; ctx.stroke();
      const img = iconImgs[m.id];
      if (img) ctx.drawImage(img, px - 7, py - 7, 14, 14);
      if (m.id === 'spawn') { ctx.beginPath(); ctx.arc(px, py, 11, 0, Math.PI * 2); ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke(); }
    }
    mapState.markers = vis;
    mapState.geom = { X0, Z0, S, cx: view.cx, cz: view.cz, size: viewB };
    // message « calcul » seulement si des tuiles manquent ET qu'aucun autre niveau ne les remplace
    const st = document.getElementById('map-status');
    if (st) { st.textContent = 'Calcul de la carte…'; st.style.display = missing && !levelsDrawn.length ? 'block' : 'none'; }
  }

  // Légende des biomes, liste des structures et notes : mises à jour quand la carte se calme
  function settleMap() {
    if (!mapIsLive() || !mapState.geom || !worldP) return;
    worldP.then((w) => {
      const p = genParams();
      if (!p || !mapIsLive()) return;
      ensureEngine(w, p);
      const g = mapState.geom, S = g.S, counts = {};
      let total = 0;
      for (const t of tiles.values()) {
        if (t.S !== S) continue;
        const bx = t.tx * TILE, bz = t.tz * TILE;
        if ((bx + TILE) * S < g.X0 || bx * S > g.X0 + g.size || (bz + TILE) * S < g.Z0 || bz * S > g.Z0 + g.size) continue;
        for (let j = 0; j < TILE; j++) {
          const zz = (bz + j) * S; if (zz < g.Z0 || zz >= g.Z0 + g.size) continue;
          for (let i = 0; i < TILE; i++) {
            const xx = (bx + i) * S; if (xx < g.X0 || xx >= g.X0 + g.size) continue;
            const id = t.ids[j * TILE + i]; counts[id] = (counts[id] || 0) + 1; total++;
          }
        }
      }
      const nb = document.getElementById('map-notes');
      if (nb) nb.innerHTML = ((mapState.plan && mapState.plan.notes) || []).map(esc).join('<br>');
      const bl = document.getElementById('map-biomes');
      if (bl && total) {
        const rows = Object.keys(counts).map((id) => [Number(id), counts[id]]).sort((a, b) => b[1] - a[1]).slice(0, 12);
        bl.innerHTML = rows.map(([id, n]) => {
          const en = w.biomeName(id); const c = biomeCol(w, id);
          return `<div class="biorow"><i class="sw" style="background:rgb(${c[0]},${c[1]},${c[2]})"></i>${biomeIconHtml(en)}<span>${esc(WORLD.BIOMES_FR[en] || en || 'Biome ' + id)}</span><b>${Math.round((n / total) * 100) || '<1'} %</b></div>`;
        }).join('');
      }
      mapState.foundList = mapState.markers.map((m) => ({ ...m, d: Math.round(Math.hypot(m.x - g.cx, m.z - g.cz)) })).sort((a, b) => a.d - b.d).slice(0, 300);
      renderFound();
    }).catch(() => {});
  }

  // Liste des structures de la zone : repliée sur les 3 plus proches, dépliable en entier
  function renderFound() {
    const fl = document.getElementById('map-found');
    if (!fl) return;
    const list = mapState.foundList || [], names = mapState.names, open = !!mapState.foundOpen;
    if (!list.length) { fl.innerHTML = '<p class="hint">Aucune structure cochée dans cette zone. Active une couche ci-dessus ou dézoome.</p>'; return; }
    const shown = open ? list : list.slice(0, 3);
    fl.innerHTML = shown.map((m) => `<button class="maprow" data-action="map-goto" data-x="${m.x}" data-z="${m.z}">${mkHtml(m.id)}<b>${esc(m.id === 'spawn' ? "Point d'apparition (approx.)" : names.get(m.id) || '?')}</b><span>X ${m.x} · Z ${m.z}</span><small>${m.d} blocs</small></button>`).join('')
      + (list.length > 3 ? `<button class="foundtoggle" data-action="found-toggle" aria-expanded="${open}"><span class="arrow">${open ? '▲' : '▼'}</span> ${open ? 'Réduire la liste' : `Tout afficher (${list.length})`}</button>` : '');
  }

  async function drawMap() {
    const cv = document.getElementById('seed-cv');
    if (!cv) return;
    const sd = state.seed, ps = SEED.parseSeed(sd.text), mode = coordMode();
    if (ps.kind === 'empty' || mode === 'invalid') return;
    const token = ++mapState.token;
    const status = document.getElementById('map-status');
    const say = (m) => { if (status) { status.textContent = m; status.style.display = m ? 'block' : 'none'; } };
    say('Chargement du moteur de carte…');
    let w;
    try { w = await worldEngine(); }
    catch (e) { say("Le moteur de carte n'a pas pu se charger : une connexion est nécessaire la première fois."); return; }
    if (token !== mapState.token || document.getElementById('seed-cv') !== cv) return;
    const p = genParams();
    if (tileGen !== p.key) { tiles.clear(); for (const k of Object.keys(levelCount)) levelCount[k] = 0; tileGen = p.key; mapState.sh = null; mapState.spawn = null; }
    ensureEngine(w, p);
    // centre : coordonnées saisies, sinon le spawn (Overworld) ; 0 ; 0 dans les autres dimensions
    if (p.dim === 0 && (!mapState.spawn || mapState.spawn.key !== p.key)) mapState.spawn = { key: p.key, pos: w.spawn() };
    mapState.base = mode === 'coords' ? seedXZ() : p.dim === 0 ? mapState.spawn.pos : [0, 0];
    mapState.names = new Map(WORLD.STRUCTURES.map((s) => [s.id, s.fr]));
    mapState.names.set('stronghold', WORLD.STRONGHOLD.fr);
    mapState.plan = layerPlan(w, p);
    syncView();
    if (!view.k) view.k = 2 / sd.zoom;
    setK(view.k);
    for (const id of Object.keys(ICONS.structures)) loadIcon(iconUrl('structures', id)).then((img) => { if (img && !iconImgs[id]) { iconImgs[id] = img; schedulePaint(); } });
    mapReady = true;
    paint();
    pump();
  }

  function pickAt(px, py, cssWidth) {
    const g = mapState.geom, w = worldP;
    if (!g || !w) return;
    const X = Math.floor(g.X0 + (px / cssWidth) * g.size), Z = Math.floor(g.Z0 + (py / cssWidth) * g.size);
    const radius = (14 / cssWidth) * g.size;
    let best = null, bd = radius;
    for (const m of mapState.markers) { const d = Math.hypot(m.x - X, m.z - Z); if (d <= bd) { bd = d; best = m; } }
    w.then((eng) => {
      const sd = state.seed, p = genParams();
      if (!p) return;
      ensureEngine(eng, p);
      const en = eng.biomeName(eng.biomeAt(X, Z, DIM_ID[sd.dimension] === 0 ? 256 : 60));
      const info = document.getElementById('map-info');
      if (!info) return;
      const at = best ? best : { x: X, z: Z };
      info.classList.remove('hint');
      info.innerHTML = `${best ? `${mkHtml(best.id)} <b>${esc(best.id === 'spawn' ? "Point d'apparition (approx.)" : mapState.names.get(best.id) || '?')}</b> — X ${best.x} · Z ${best.z}<br>` : ''}Biome : ${biomeIconHtml(en)} <b>${esc(WORLD.BIOMES_FR[en] || en || 'inconnu')}</b> · X ${X} · Z ${Z} · chunk ${SEED.blockToChunk(X)} ; ${SEED.blockToChunk(Z)}
        <div class="toolbar" style="margin-top:6px"><button class="btn ghost small" data-action="map-goto" data-x="${at.x}" data-z="${at.z}">Centrer ici</button>
        <button class="btn ghost small" data-action="map-copy" data-x="${at.x}" data-z="${at.z}">Copier X Z</button></div>`;
    }).catch(() => {});
  }

  function zoomStep(d) {                              // boutons + / − et molette : facteur 2 par pas, animé
    if (!view.k) return;
    tweenK(view.k * (d < 0 ? 2 : 0.5), 180);
  }

  function refreshSeedMap() {
    const box = document.getElementById('seed-mapbox');
    if (box) { box.innerHTML = mapSection(); drawMap(); }
  }
  let mapTimer = null;
  function scheduleMap() { clearTimeout(mapTimer); mapTimer = setTimeout(drawMap, 300); }

  function seedSavedList() {
    const list = state.seed.saved;
    return list.length ? list.map((e) => `
      <div class="trade">
        <div class="loot-top"><strong>${esc(e.name)}</strong><span class="loot-qty">${esc(PLATFORM_LABEL(e.platform))} · ${esc(DIM_LABEL[e.dimension])}</span></div>
        <div class="tname" style="font-family:ui-monospace,Menlo,monospace;font-size:12.5px;overflow-wrap:anywhere">${esc(e.text || '(sans graine)')} · ${e.x === '' || e.z === '' ? 'centrée sur le spawn' : `X ${e.x} · Z ${e.z}`}</div>
        <div class="toolbar" style="margin-top:8px">
          <button class="btn small" data-action="seed-load" data-id="${esc(e.id)}">Charger</button>
          <a class="btn ghost small" href="${esc(SEED.chunkbaseUrl({ tool: 'seed-map', seed: SEED.parseSeed(e.text).seed, platform: cbPlatform(e.platform), dimension: e.dimension, x: e.x === '' ? undefined : e.x, z: e.z === '' ? undefined : e.z }))}" target="_blank" rel="noopener noreferrer">Chunkbase ↗</a>
          <button class="btn ghost small danger" data-action="seed-del" data-id="${esc(e.id)}">Supprimer</button>
        </div>
      </div>`).join('') : '<p class="hint">Aucune graine enregistrée.</p>';
  }

  function renderSeed() {
    const sd = state.seed;
    return `
      <p class="hint" style="margin:6px 2px 10px">Entre ta graine, ta version et ta dimension : l'app génère la carte <b>dans ton téléphone</b> (biomes, villages et autres structures, forteresses, point d'apparition, chunks à slimes), sans connexion une fois chargée.</p>
      <section class="panel">
        <label class="field">Graine (nombre ou texte)
          <input id="sd-text" type="text" inputmode="text" placeholder="Ex. 123456789 ou mon monde" value="${esc(sd.text)}" autocomplete="off" autocapitalize="off" spellcheck="false" /></label>
        <label class="field">Version
          <select id="sd-platform">${WORLD.VERSIONS.map((v) => `<option value="${v.key}" ${v.key === sd.platform ? 'selected' : ''}>Java ${esc(v.label)}</option>`).join('')}</select></label>
        <label class="field">Dimension
          <select id="sd-dim">${SEED.DIMENSIONS.map((d) => `<option value="${d}" ${d === sd.dimension ? 'selected' : ''}>${esc(DIM_LABEL[d])}</option>`).join('')}</select></label>
        <div class="two">
          <label class="field">X<input id="sd-x" type="number" inputmode="numeric" step="1" placeholder="spawn" value="${esc(sd.x)}" /></label>
          <label class="field">Z<input id="sd-z" type="number" inputmode="numeric" step="1" placeholder="spawn" value="${esc(sd.z)}" /></label>
        </div>
        <p class="hint" style="margin:10px 0 0">Les versions plus récentes que 1.21.4 (26.x) ne sont pas dans la liste : le générateur n'est pas garanti pour elles.</p>
      </section>
      <h2 class="section">Carte du monde</h2>
      <section class="panel" id="seed-mapbox">${mapSection()}</section>
      <div id="seed-out" style="margin-top:14px">${seedOutputs()}</div>

      <h2 class="section">Mes graines</h2>
      <section class="panel">
        <label class="field">Nom<input id="sd-name" type="text" maxlength="60" placeholder="Ex. Monde survie" value="${esc(sd.name)}" /></label>
        <div class="toolbar"><button class="btn small" data-action="seed-save">Enregistrer cette graine</button></div>
        <div id="seed-saved" style="margin-top:12px">${seedSavedList()}</div>
        <div class="toolbar">
          <button class="btn ghost small" data-action="seeds-export" ${sd.saved.length ? '' : 'disabled'}>Copier mes graines</button>
          <button class="btn ghost small" data-action="seeds-import-toggle">Importer</button>
        </div>
        ${sd.exportText ? `<textarea class="area" readonly rows="4" aria-label="Mes graines à copier">${esc(sd.exportText)}</textarea>` : ''}
        ${sd.importOpen ? `<textarea id="seed-imp" class="area" rows="4" placeholder="Colle ici les graines copiées"></textarea><button class="btn small" data-action="seeds-import">Valider l'import</button>` : ''}
      </section>

      <h2 class="section">Autres outils Chunkbase</h2>
      <section class="panel">
        <div class="chips">${TOOLS.map(([t, label]) => `<a class="chip chipbtn" href="${esc(SEED.chunkbaseUrl({ tool: t }))}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a>`).join('')}</div>
        <p class="hint" style="margin:8px 0 0">Ces outils s'ouvrent sans réglages : copie ta graine ci-dessus, puis colle-la sur le site.</p>
      </section>
      <p class="disclaimer">Carte calculée par la bibliothèque open source cubiomes (licence MIT) compilée dans l'app, version Java uniquement. Les structures sont placées comme dans le jeu à partir de la graine ; un village ou un temple peut ne pas apparaître si le terrain exact l'en empêche (par exemple en pleine eau). Chunkbase est un site indépendant, non affilié à Grimoire.</p>`;
  }

  function refreshSeedOutputs() {
    const out = document.getElementById('seed-out');
    if (out) out.innerHTML = seedOutputs();
  }

  function copyText(text, okMsg) {
    const sd = state.seed;
    const done = (m) => { sd.msg = m; if (state.tab === 'seed') refreshSeedOutputs(); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => done(okMsg)).catch(() => done('Copie impossible : sélectionne le texte à la main.'));
    else done('Copie impossible : sélectionne le texte à la main.');
  }
  function importSeeds(text) {
    const sd = state.seed;
    let raw;
    try { raw = JSON.parse(text); } catch (e) { sd.msg = 'Texte illisible : colle exactement ce qu\'a copié « Copier mes graines ».'; return; }
    const list = (Array.isArray(raw) ? raw : []).map(sanitizeSeedEntry).filter((e) => e && e.text);
    let added = 0;
    for (const e of list) {
      if (sd.saved.length >= 50) break;
      if (!sd.saved.some((o) => o.text === e.text && o.platform === e.platform && o.dimension === e.dimension && o.x === e.x && o.z === e.z)) { sd.saved.push(e); added++; }
    }
    saveSeedState();
    sd.importOpen = false;
    sd.msg = added ? `${added} graine${added > 1 ? 's' : ''} importée${added > 1 ? 's' : ''}.` : 'Aucune nouvelle graine à importer.';
  }

  // ---------- Rendu global ----------
  function render() {
    if (state.tab === 'home') {
      APP.innerHTML = renderAccueil();
    } else if (state.tab === 'enchant') {
      const c = state.cat ? cat(state.cat) : null;
      APP.innerHTML = c ? renderCategory(c) : renderEquipmentList();
    } else if (state.tab === 'seed') {
      APP.innerHTML = renderSeed();
      drawMap();
    } else if (state.tab === 'farms') {
      APP.innerHTML = renderFarms();
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

    if (a === 'open-cat') { openCat(el.dataset.id); }
    else if (a === 'go-tab') { selectTab(el.dataset.tab); window.scrollTo({ top: 0 }); }
    else if (a === 'go-cat') { selectTab('enchant'); openCat(el.dataset.id); window.scrollTo({ top: 0 }); }
    else if (a === 'go-struct') { selectTab('structures'); state.struct.id = el.dataset.id; state.struct.q = ''; window.scrollTo({ top: 0 }); }
    else if (a === 'go-trades') { selectTab('trades'); state.trade.prof = null; state.trade.q = el.dataset.q; window.scrollTo({ top: 0 }); }
    else if (a === 'back') { state.cat = null; state.sel = {}; state.result = null; }
    else if (a === 'struct-open') { state.struct.id = el.dataset.id; state.struct.q = ''; window.scrollTo({ top: 0 }); }
    else if (a === 'struct-back') { state.struct.id = null; window.scrollTo({ top: 0 }); }
    else if (a === 'seed-copy-link') { copyText(seedUrl('seed-map'), 'Lien copié.'); return; }
    else if (a === 'seed-copy-seed') { const ps = SEED.parseSeed(state.seed.text); if (ps.seed !== null) copyText(ps.seed.toString(), 'Graine copiée.'); return; }
    else if (a === 'map-zoom') {
      const z = Number(el.dataset.z);
      if (ZOOMS.some((q) => q[0] === z)) tweenK(2 / z, 220);
      return;
    }
    else if (a === 'found-toggle') { mapState.foundOpen = !mapState.foundOpen; renderFound(); return; }
    else if (a === 'map-zstep') { zoomStep(Number(el.dataset.d)); return; }
    else if (a === 'map-layer') {
      const id = el.dataset.id, L = state.seed.layers;
      if (id === 'biomes' || id === 'slime') L[id] = !L[id];
      else if (mapStructList().some((q) => String(q.id) === id)) L.structs[id] = !L.structs[id];
      refreshSeedMap(); return;
    }
    else if (a === 'map-pan') {
      const sd = state.seed;
      if (el.dataset.reset) sd.pan = [0, 0];
      else sd.pan = [sd.pan[0] + Number(el.dataset.dx) * Math.round(viewBlocks() / 3), sd.pan[1] + Number(el.dataset.dz) * Math.round(viewBlocks() / 3)];
      syncView(); schedulePaint(); pump(); scheduleSettle(); return;
    }
    else if (a === 'map-goto') {
      const X = Number(el.dataset.x), Z = Number(el.dataset.z), [x0, z0] = mapState.base || [0, 0];
      if (Number.isInteger(X) && Number.isInteger(Z)) { state.seed.pan = [X - x0, Z - z0]; syncView(); schedulePaint(); pump(); scheduleSettle(); }
      return;
    }
    else if (a === 'map-copy') {
      const t = `${Number(el.dataset.x)} ${Number(el.dataset.z)}`;
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(() => { const i = document.getElementById('map-info'); if (i) i.insertAdjacentHTML('beforeend', '<div class="hint">Copié : ' + esc(t) + '</div>'); }).catch(() => {});
      return;
    }
    else if (a === 'seed-save') {
      const e = sanitizeSeedEntry({ name: state.seed.name, text: state.seed.text, platform: state.seed.platform, dimension: state.seed.dimension, x: seedNum(state.seed.x) ?? '', z: seedNum(state.seed.z) ?? '' });
      if (state.seed.saved.length >= 50) state.seed.msg = 'Limite de 50 graines atteinte : supprime-en une.';
      else if (!e.text) state.seed.msg = 'Entre d\'abord une graine à enregistrer.';
      else { state.seed.saved.unshift(e); state.seed.name = ''; state.seed.msg = ''; saveSeedState(); }
    }
    else if (a === 'seed-load') {
      const e = state.seed.saved.find((x) => x.id === el.dataset.id);
      if (e) { Object.assign(state.seed, { text: e.text, platform: e.platform, dimension: e.dimension, x: String(e.x), z: String(e.z), pan: [0, 0], picked: null, msg: '' }); saveSeedState(); window.scrollTo({ top: 0 }); }
    }
    else if (a === 'seed-del') { if (window.confirm('Supprimer cette graine ?')) { state.seed.saved = state.seed.saved.filter((x) => x.id !== el.dataset.id); saveSeedState(); } }
    else if (a === 'seeds-export') {
      state.seed.exportText = JSON.stringify(state.seed.saved.map(({ name, text, platform, dimension, x, z }) => ({ name, text, platform, dimension, x, z })));
      state.seed.importOpen = false; state.seed.msg = '';
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(state.seed.exportText).then(() => { state.seed.msg = 'Graines copiées. Colle-les dans une note pour les garder.'; render(); }).catch(() => {});
    }
    else if (a === 'seeds-import-toggle') { state.seed.importOpen = !state.seed.importOpen; state.seed.exportText = ''; state.seed.msg = ''; }
    else if (a === 'seeds-import') { const t = document.getElementById('seed-imp'); importSeeds(t ? t.value : ''); }
    else if (a === 'go-farm') { selectTab('farms'); state.farm.id = el.dataset.id; state.farm.q = ''; state.farm.playing = null; window.scrollTo({ top: 0 }); }
    else if (a === 'farm-open') { state.farm.id = el.dataset.id; state.farm.q = ''; state.farm.playing = null; state.farm.adding = false; state.farm.msg = ''; window.scrollTo({ top: 0 }); }
    else if (a === 'farm-back') { state.farm.id = null; state.farm.playing = null; state.farm.adding = false; state.farm.msg = ''; window.scrollTo({ top: 0 }); }
    else if (a === 'build-play') {
      if (navigator.onLine === false) state.farm.msg = "Pas de connexion internet : la vidéo ne peut pas être lue dans l'app. Utilise « Ouvrir » quand tu es en ligne.";
      else { state.farm.msg = ''; state.farm.playing = el.dataset.uid; }
    }
    else if (a === 'build-add') { state.farm.adding = true; state.farm.err = ''; state.farm.msg = ''; }
    else if (a === 'build-cancel') { state.farm.adding = false; state.farm.err = ''; state.farm.draft = { title: '', url: '', note: '' }; }
    else if (a === 'build-save') { saveDraftBuild(); }
    else if (a === 'build-del') {
      if (window.confirm('Supprimer ce build ?')) {
        const id = state.farm.id;
        userBuilds[id] = (userBuilds[id] || []).filter((b) => b.id !== el.dataset.uid);
        if (!userBuilds[id].length) delete userBuilds[id];
        if (state.farm.playing === el.dataset.uid) state.farm.playing = null;
        saveBuilds();
      }
    }
    else if (a === 'builds-export') {
      state.farm.exportText = JSON.stringify(userBuilds);
      state.farm.importOpen = false;
      state.farm.msg = '';
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(state.farm.exportText).then(() => { state.farm.msg = 'Liens copiés. Colle-les dans une note pour les garder.'; render(); }).catch(() => {});
      }
    }
    else if (a === 'builds-import-toggle') { state.farm.importOpen = !state.farm.importOpen; state.farm.exportText = ''; state.farm.msg = ''; }
    else if (a === 'builds-import') { const t = document.getElementById('imp-text'); importBuilds(t ? t.value : ''); }
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

  APP.addEventListener('input', (e) => {
    if (e.target.id === 'home-q') {
      state.homeQ = e.target.value;
      document.getElementById('home-body').innerHTML = accueilBody();
    } else if (e.target.id === 'sd-text' || e.target.id === 'sd-platform' || e.target.id === 'sd-dim' || e.target.id === 'sd-x' || e.target.id === 'sd-z') {
      const sd = state.seed;
      if (e.target.id === 'sd-text') sd.text = e.target.value;
      else if (e.target.id === 'sd-platform') sd.platform = WORLD.VERSIONS.some((v) => v.key === e.target.value) ? e.target.value : sd.platform;
      else if (e.target.id === 'sd-dim') sd.dimension = SEED.DIMENSIONS.includes(e.target.value) ? e.target.value : sd.dimension;
      else if (e.target.id === 'sd-x') sd.x = e.target.value;
      else sd.z = e.target.value;
      sd.pan = [0, 0]; sd.picked = null; sd.msg = '';
      saveSeedState();
      refreshSeedOutputs();
      if (e.target.id === 'sd-platform' || e.target.id === 'sd-dim') refreshSeedMap();
      else { const box = document.getElementById('seed-mapbox'); const had = !!document.getElementById('seed-cv'); const has = SEED.parseSeed(sd.text).kind !== 'empty' && coordMode() !== 'invalid'; if (had !== has) refreshSeedMap(); else if (box) scheduleMap(); }
    } else if (e.target.id === 'sd-name') { state.seed.name = e.target.value;
    } else if (e.target.id === 'farm-q') {
      state.farm.q = e.target.value;
      document.getElementById('farm-body').innerHTML = farmBody();
    } else if (e.target.id === 'b-title') { state.farm.draft.title = e.target.value; }
    else if (e.target.id === 'b-url') { state.farm.draft.url = e.target.value; }
    else if (e.target.id === 'b-note') { state.farm.draft.note = e.target.value; }
    else if (e.target.id === 'struct-q') {
      state.struct.q = e.target.value;
      document.getElementById('struct-body').innerHTML = structureBody();
    } else if (e.target.id === 'trade-q') {
      state.trade.q = e.target.value;
      document.getElementById('trade-body').innerHTML = tradeBody();
    }
  });

  document.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));
  APP.addEventListener('error', (e) => { if (e.target && e.target.classList && e.target.classList.contains('thumb')) e.target.style.display = 'none'; }, true);
  // Carte, à la manière de Google Maps : un doigt déplace, deux doigts zooment (et déplacent en même temps), toucher = lire un point.
  // Le point de la carte sous les doigts reste sous les doigts : la vue est recalculée à chaque mouvement.
  const ptrs = new Map();
  let gest = null;
  function gestureBase(cv) {
    const r = cv.getBoundingClientRect(), pts = [...ptrs.values()];
    const mx = pts.reduce((a, q) => a + q[0], 0) / pts.length, my = pts.reduce((a, q) => a + q[1], 0) / pts.length;
    const c = MAP_SIZE / r.width;
    gest.c = c; gest.rect = r;
    gest.ax = view.cx + ((mx - r.left - r.width / 2) * c) / view.k;       // point du monde sous le milieu des doigts
    gest.az = view.cz + ((my - r.top - r.height / 2) * c) / view.k;
    gest.d0 = pts.length > 1 ? Math.hypot(pts[0][0] - pts[1][0], pts[0][1] - pts[1][1]) || 1 : 0;
    gest.k0 = view.k;
  }
  APP.addEventListener('pointerdown', (e) => {
    if (!e.target || e.target.id !== 'seed-cv') return;
    cancelAnimationFrame(tween);
    ptrs.set(e.pointerId, [e.clientX, e.clientY]);
    try { e.target.setPointerCapture(e.pointerId); } catch (err) { /* sans importance */ }
    if (!gest) gest = { start: [e.clientX, e.clientY], moved: false, multi: false };
    if (ptrs.size >= 2) { gest.multi = true; gest.moved = true; }
    gestureBase(e.target);
  });
  APP.addEventListener('pointermove', (e) => {
    if (!gest || !ptrs.has(e.pointerId)) return;
    ptrs.set(e.pointerId, [e.clientX, e.clientY]);
    const pts = [...ptrs.values()];
    if (!gest.moved) { if (Math.hypot(e.clientX - gest.start[0], e.clientY - gest.start[1]) < 5) return; gest.moved = true; }
    const r = gest.rect, c = gest.c;
    const mx = pts.reduce((a, q) => a + q[0], 0) / pts.length, my = pts.reduce((a, q) => a + q[1], 0) / pts.length;
    if (pts.length > 1 && gest.d0) setK(gest.k0 * (Math.hypot(pts[0][0] - pts[1][0], pts[0][1] - pts[1][1]) / gest.d0));
    view.cx = gest.ax - ((mx - r.left - r.width / 2) * c) / view.k;
    view.cz = gest.az - ((my - r.top - r.height / 2) * c) / view.k;
    syncPan(); schedulePaint(); pump(); scheduleSettle();
  });
  const endPtr = (e, cancelled) => {
    if (!gest || !ptrs.has(e.pointerId)) return;
    ptrs.delete(e.pointerId);
    const cv = document.getElementById('seed-cv');
    if (ptrs.size > 0) { if (cv) gestureBase(cv); return; }          // il reste un doigt : on continue à partir de lui, sans saut
    const gg = gest; gest = null;
    if (!cv) return;
    if (!gg.moved && !gg.multi && !cancelled) { const r = cv.getBoundingClientRect(); pickAt(e.clientX - r.left, e.clientY - r.top, r.width); }
    else scheduleSettle();
  };
  APP.addEventListener('pointerup', (e) => endPtr(e, false));
  APP.addEventListener('pointercancel', (e) => endPtr(e, true));
  let wheelAt = 0;
  APP.addEventListener('wheel', (e) => {
    if (!e.target || e.target.id !== 'seed-cv' || !view.k) return;
    e.preventDefault();
    const r = e.target.getBoundingClientRect(), c = MAP_SIZE / r.width;
    const ux = (e.clientX - r.left - r.width / 2) * c, uz = (e.clientY - r.top - r.height / 2) * c;
    const ax = view.cx + ux / view.k, az = view.cz + uz / view.k;      // le point sous le curseur reste sous le curseur
    setK(view.k * Math.exp(-Math.max(-300, Math.min(300, e.deltaY)) * 0.0018));
    view.cx = ax - ux / view.k; view.cz = az - uz / view.k;
    syncPan(); schedulePaint(); pump(); scheduleSettle();
  }, { passive: false });
  const homeLink = document.getElementById('homeLink');
  if (homeLink) homeLink.addEventListener('click', (e) => { e.preventDefault(); setTab('home'); });

  render();
})();
