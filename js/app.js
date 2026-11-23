(function () {
  const DATA = window.MC_DATA;
  const OPT = window.MC_OPT;
  const TRIMS = window.MC_TRIMS;
  const STAND = window.MC_STAND;
  const TRADES = window.MC_TRADES;
  const FARMS = window.MC_FARMS;
  const SEED = window.MC_SEED;
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
    seed: { text: '', platform: 'java_1_21', dimension: 'overworld', x: '0', z: '0', embed: false, name: '', saved: [], pan: [0, 0], picked: null, msg: '', importOpen: false, exportText: '' }, // onglet Graine
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
      { tab: 'seed', icon: 'item-icons/slimeball', title: 'Graine', desc: 'Ouvre ta graine sur Chunkbase, chunks à slimes et coordonnées', stat: 'Version · dimension · X Z' },
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
      platform: SEED.PLATFORMS.includes(b.platform) ? b.platform : 'java_1_21',
      dimension: SEED.DIMENSIONS.includes(b.dimension) ? b.dimension : 'overworld',
      x: Number.isInteger(x) && Math.abs(x) <= SEED.COORD_LIMIT ? x : 0,
      z: Number.isInteger(z) && Math.abs(z) <= SEED.COORD_LIMIT ? z : 0,
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
  function seedUrl(tool) {
    const ps = SEED.parseSeed(state.seed.text);
    const [x, z] = seedXZ();
    return SEED.chunkbaseUrl({ tool, seed: ps.seed, platform: state.seed.platform, dimension: state.seed.dimension, x, z });
  }

  function seedOutputs() {
    const sd = state.seed;
    const ps = SEED.parseSeed(sd.text);
    const [x, z] = seedXZ();
    const url = seedUrl('seed-map');
    const has = ps.kind !== 'empty';
    let resolved;
    if (ps.kind === 'empty') resolved = '<p class="hint" style="margin:0 0 10px">Entre une graine (un nombre, ou un texte comme dans le jeu) pour générer le lien.</p>';
    else if (ps.kind === 'number') resolved = `<p class="seedline">Graine : <b>${esc(ps.seed.toString())}</b></p>`;
    else resolved = `<p class="seedline">Texte « ${esc(ps.text)} » → graine <b>${esc(ps.seed.toString())}</b> <small>(conversion du jeu)</small></p>`;

    const coordsOk = x !== null && z !== null;
    const det = coordsOk ? SEED.describeCoords(sd.dimension, x, z) : null;
    const fmt = (a) => `${a[0]} ; ${a[1]}`;
    const conv = det ? `
      <div class="control-title">Coordonnées</div>
      <div class="kv">
        ${det.overworld ? `<span>Overworld</span><b>X ${det.overworld[0]} · Z ${det.overworld[1]}</b>` : ''}
        ${det.nether ? `<span>Nether</span><b>X ${det.nether[0]} · Z ${det.nether[1]}</b>` : ''}
        ${det.end ? `<span>L'End</span><b>X ${det.end[0]} · Z ${det.end[1]}</b>` : ''}
        <span>Chunk</span><b>${fmt(det.chunk)} <small>(blocs X ${det.chunkBlocks.x[0]} à ${det.chunkBlocks.x[1]}, Z ${det.chunkBlocks.z[0]} à ${det.chunkBlocks.z[1]})</small></b>
        <span>Région</span><b>${fmt(det.region)}</b>
        <span>Position dans le chunk</span><b>${fmt(det.inChunk)}</b>
      </div>
      ${det.nether && sd.dimension === 'overworld' ? '<p class="hint" style="margin:6px 0 0">Nether = Overworld ÷ 8 (arrondi vers le bas), sur X et Z seulement.</p>' : ''}` : '<p class="hint">Entre des coordonnées entières valides (X et Z) pour les convertir.</p>';

    const slime = !has ? '<p class="hint">Entre une graine pour calculer les chunks à slimes.</p>'
      : sd.dimension !== 'overworld' ? '<p class="hint">Les chunks à slimes n\'existent que dans l\'Overworld : choisis cette dimension.</p>'
      : !coordsOk ? '<p class="hint">Entre des coordonnées valides pour centrer la carte.</p>' : `
        <canvas id="slime-cv" class="slimecv" width="341" height="341" aria-label="Carte des chunks à slimes"></canvas>
        <div class="toolbar" style="margin-top:8px">
          <button class="btn ghost small" data-action="slime-pan" data-dx="-8" data-dz="0" aria-label="Gauche">◀</button>
          <button class="btn ghost small" data-action="slime-pan" data-dx="0" data-dz="-8" aria-label="Haut">▲</button>
          <button class="btn ghost small" data-action="slime-pan" data-dx="0" data-dz="8" aria-label="Bas">▼</button>
          <button class="btn ghost small" data-action="slime-pan" data-dx="8" data-dz="0" aria-label="Droite">▶</button>
          <button class="btn ghost small" data-action="slime-pan" data-dx="0" data-dz="0" data-reset="1">Recentrer</button>
        </div>
        <div id="slime-info" class="hint" style="margin-top:6px">${slimeInfoText()}</div>`;

    return `
      ${resolved}
      <div class="toolbar" style="margin-top:0">
        <a class="btn" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Ouvrir sur Chunkbase ↗</a>
        <button class="btn ghost small" data-action="seed-embed">${sd.embed ? 'Masquer ici' : 'Afficher ici (essai)'}</button>
      </div>
      <div class="toolbar" style="margin-top:6px">
        <button class="btn ghost small" data-action="seed-copy-link">Copier le lien</button>
        <button class="btn ghost small" data-action="seed-copy-seed" ${has ? '' : 'disabled'}>Copier la graine</button>
      </div>
      ${sd.msg ? `<div class="notice warn" style="margin-top:8px">${esc(sd.msg)}</div>` : ''}
      <div class="cmd" style="margin-top:8px"><code>${esc(url)}</code></div>
      ${sd.embed ? `<div class="embed"><iframe src="${esc(url)}" title="Chunkbase" loading="lazy" referrerpolicy="no-referrer"
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-popups-to-escape-sandbox"></iframe></div>
        <p class="hint">Si l'écran reste vide ou affiche une erreur, c'est que Chunkbase refuse d'être affiché dans une autre application : utilise « Ouvrir sur Chunkbase ».</p>` : ''}
      <h2 class="section">Chunks à slimes (calculés ici)</h2>
      ${slime}
      <h2 class="section">Convertisseur</h2>
      <section class="panel">${conv}</section>`;
  }

  function slimeInfoText() {
    const p = state.seed.picked;
    if (!p) return "Touche un chunk pour voir ses coordonnées. Vert = chunk à slimes, cadre doré = chunk de ta position.";
    return `Chunk <b>${p.cx} ; ${p.cz}</b> — blocs X ${p.cx * 16} à ${p.cx * 16 + 15}, Z ${p.cz * 16} à ${p.cz * 16 + 15} : ${p.slime ? '<b style="color:var(--green)">chunk à slimes</b>' : 'pas de slimes'}.`;
  }

  // Dessine la carte : 31 × 31 chunks autour du chunk de la position (décalée par les flèches)
  const SLIME_N = 31, SLIME_CELL = 11;
  function slimeOrigin() {
    const [x, z] = seedXZ();
    return [SEED.blockToChunk(x) + state.seed.pan[0], SEED.blockToChunk(z) + state.seed.pan[1]];
  }
  function drawSlime() {
    const cv = document.getElementById('slime-cv');
    if (!cv) return;
    const ps = SEED.parseSeed(state.seed.text);
    if (ps.kind === 'empty') return;
    const [ocx, ocz] = slimeOrigin();
    const [x, z] = seedXZ();
    const homeC = [SEED.blockToChunk(x), SEED.blockToChunk(z)];
    const half = (SLIME_N - 1) / 2;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, cv.width, cv.height);
    for (let i = 0; i < SLIME_N; i++) for (let j = 0; j < SLIME_N; j++) {
      const cx = ocx - half + i, cz = ocz - half + j;
      const slime = SEED.isSlimeChunk(ps.seed, cx, cz);
      ctx.fillStyle = slime ? '#55ff55' : '#1d1830';
      ctx.fillRect(i * SLIME_CELL, j * SLIME_CELL, SLIME_CELL, SLIME_CELL);
      ctx.strokeStyle = 'rgba(255,255,255,.08)';
      ctx.strokeRect(i * SLIME_CELL + .5, j * SLIME_CELL + .5, SLIME_CELL - 1, SLIME_CELL - 1);
      if (cx === 0 || cz === 0) { ctx.fillStyle = 'rgba(85,170,255,.28)'; ctx.fillRect(i * SLIME_CELL, j * SLIME_CELL, SLIME_CELL, SLIME_CELL); }   // axes X=0 / Z=0
    }
    const mark = (cx, cz, color, w) => {
      const i = cx - (ocx - half), j = cz - (ocz - half);
      if (i < 0 || j < 0 || i >= SLIME_N || j >= SLIME_N) return;
      ctx.strokeStyle = color; ctx.lineWidth = w; ctx.strokeRect(i * SLIME_CELL + w / 2, j * SLIME_CELL + w / 2, SLIME_CELL - w, SLIME_CELL - w); ctx.lineWidth = 1;
    };
    mark(homeC[0], homeC[1], '#ffb83d', 2);
    if (state.seed.picked) mark(state.seed.picked.cx, state.seed.picked.cz, '#ffffff', 2);
  }

  function seedSavedList() {
    const list = state.seed.saved;
    return list.length ? list.map((e) => `
      <div class="trade">
        <div class="loot-top"><strong>${esc(e.name)}</strong><span class="loot-qty">${esc(PLATFORM_LABEL(e.platform))} · ${esc(DIM_LABEL[e.dimension])}</span></div>
        <div class="tname" style="font-family:ui-monospace,Menlo,monospace;font-size:12.5px;overflow-wrap:anywhere">${esc(e.text || '(sans graine)')} · X ${e.x} · Z ${e.z}</div>
        <div class="toolbar" style="margin-top:8px">
          <button class="btn small" data-action="seed-load" data-id="${esc(e.id)}">Charger</button>
          <a class="btn ghost small" href="${esc(SEED.chunkbaseUrl({ tool: 'seed-map', seed: SEED.parseSeed(e.text).seed, platform: e.platform, dimension: e.dimension, x: e.x, z: e.z }))}" target="_blank" rel="noopener noreferrer">Chunkbase ↗</a>
          <button class="btn ghost small danger" data-action="seed-del" data-id="${esc(e.id)}">Supprimer</button>
        </div>
      </div>`).join('') : '<p class="hint">Aucune graine enregistrée.</p>';
  }

  function renderSeed() {
    const sd = state.seed;
    return `
      <p class="hint" style="margin:6px 2px 10px">Prépare ta graine, puis ouvre la carte sur <b>Chunkbase</b> (site externe) déjà réglée sur ta version, ta dimension et tes coordonnées. Les <b>chunks à slimes</b> et les conversions de coordonnées sont calculés directement dans l'app, hors-ligne. Les biomes et les structures, eux, demandent Chunkbase.</p>
      <section class="panel">
        <label class="field">Graine (nombre ou texte)
          <input id="sd-text" type="text" inputmode="text" placeholder="Ex. 123456789 ou mon monde" value="${esc(sd.text)}" autocomplete="off" autocapitalize="off" spellcheck="false" /></label>
        <label class="field">Version
          <select id="sd-platform">${SEED.PLATFORMS.map((p) => `<option value="${p}" ${p === sd.platform ? 'selected' : ''}>${esc(PLATFORM_LABEL(p))}</option>`).join('')}</select></label>
        <label class="field">Dimension
          <select id="sd-dim">${SEED.DIMENSIONS.map((d) => `<option value="${d}" ${d === sd.dimension ? 'selected' : ''}>${esc(DIM_LABEL[d])}</option>`).join('')}</select></label>
        <div class="two">
          <label class="field">X<input id="sd-x" type="number" inputmode="numeric" step="1" value="${esc(sd.x)}" /></label>
          <label class="field">Z<input id="sd-z" type="number" inputmode="numeric" step="1" value="${esc(sd.z)}" /></label>
        </div>
        <p class="hint" style="margin:10px 0 0">Version : les versions plus récentes que 1.21 (26.x) ne sont pas dans la liste ; choisis 1.21 puis règle la version exacte sur le site si besoin.</p>
      </section>
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
      <p class="disclaimer">Chunkbase est un site indépendant : Grimoire n'est ni affilié à lui ni connecté par un accès officiel, il prépare seulement un lien. Le format du lien vient d'un exemple partagé et peut changer ; si la carte ne s'ouvre pas réglée, saisis la graine sur le site (bouton « Copier la graine »). Calculs de slimes : Java Edition, algorithme du wiki.</p>`;
  }

  function refreshSeedOutputs() {
    const out = document.getElementById('seed-out');
    if (out) { out.innerHTML = seedOutputs(); drawSlime(); }
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
      drawSlime();
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
    else if (a === 'seed-embed') { state.seed.embed = !state.seed.embed; }
    else if (a === 'seed-copy-link') { copyText(seedUrl('seed-map'), 'Lien copié.'); return; }
    else if (a === 'seed-copy-seed') { const ps = SEED.parseSeed(state.seed.text); if (ps.seed !== null) copyText(ps.seed.toString(), 'Graine copiée.'); return; }
    else if (a === 'slime-pan') {
      if (el.dataset.reset) state.seed.pan = [0, 0];
      else state.seed.pan = [state.seed.pan[0] + Number(el.dataset.dx), state.seed.pan[1] + Number(el.dataset.dz)];
      refreshSeedOutputs(); return;
    }
    else if (a === 'seed-save') {
      const e = sanitizeSeedEntry({ name: state.seed.name, text: state.seed.text, platform: state.seed.platform, dimension: state.seed.dimension, x: seedNum(state.seed.x) ?? 0, z: seedNum(state.seed.z) ?? 0 });
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
      else if (e.target.id === 'sd-platform') sd.platform = SEED.PLATFORMS.includes(e.target.value) ? e.target.value : sd.platform;
      else if (e.target.id === 'sd-dim') sd.dimension = SEED.DIMENSIONS.includes(e.target.value) ? e.target.value : sd.dimension;
      else if (e.target.id === 'sd-x') sd.x = e.target.value;
      else sd.z = e.target.value;
      sd.pan = [0, 0]; sd.picked = null; sd.msg = '';
      saveSeedState();
      refreshSeedOutputs();
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
  APP.addEventListener('click', (e) => {
    if (!e.target || e.target.id !== 'slime-cv') return;
    const ps = SEED.parseSeed(state.seed.text);
    if (ps.kind === 'empty') return;
    const r = e.target.getBoundingClientRect();
    const i = Math.min(SLIME_N - 1, Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * SLIME_N)));
    const j = Math.min(SLIME_N - 1, Math.max(0, Math.floor(((e.clientY - r.top) / r.height) * SLIME_N)));
    const [ocx, ocz] = slimeOrigin();
    const cx = ocx - (SLIME_N - 1) / 2 + i, cz = ocz - (SLIME_N - 1) / 2 + j;
    state.seed.picked = { cx, cz, slime: SEED.isSlimeChunk(ps.seed, cx, cz) };
    drawSlime();
    const info = document.getElementById('slime-info');
    if (info) info.innerHTML = slimeInfoText();
  });
  const homeLink = document.getElementById('homeLink');
  if (homeLink) homeLink.addEventListener('click', (e) => { e.preventDefault(); setTab('home'); });

  render();
})();
