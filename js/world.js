/*
 * Générateur de monde (biomes + structures) pour Java Edition.
 * Le calcul est fait par la bibliothèque open source « cubiomes » (MIT, Cubitect), compilée en
 * WebAssembly (assets/world.wasm, voir tools/wasm/). Aucune donnée n'est envoyée en ligne.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MC_WORLD = api;
})(typeof self !== 'undefined' ? self : this, function () {
  // [clé, libellé, identifiant de version du moteur, groupe]. Le moteur ne couvre pas Alpha / Infdev.
  const VERSIONS = [
    ['java_26_3', '26.3', 35, '26.x'], ['java_26_2', '26.2', 34, '26.x'], ['java_26_1', '26.1', 33, '26.x'],
    ['java_1_21', '1.21.11', 32, '1.21'], ['java_1_21_9', '1.21.9', 31, '1.21'], ['java_1_21_6', '1.21.6', 30, '1.21'], ['java_1_21_5', '1.21.5', 29, '1.21'],
    ['java_1_21_4', '1.21.4', 28, '1.21'], ['java_1_21_3', '1.21.3', 27, '1.21'], ['java_1_21_1', '1.21.1', 26, '1.21'],
    ['java_1_20', '1.20.6', 25, '1.13 à 1.20'], ['java_1_19', '1.19.4', 24, '1.13 à 1.20'], ['java_1_19_2', '1.19.2', 23, '1.13 à 1.20'],
    ['java_1_18', '1.18.2', 22, '1.13 à 1.20'], ['java_1_17', '1.17', 21, '1.13 à 1.20'], ['java_1_16', '1.16.5', 20, '1.13 à 1.20'],
    ['java_1_16_1', '1.16.1', 19, '1.13 à 1.20'], ['java_1_15', '1.15', 18, '1.13 à 1.20'], ['java_1_14', '1.14', 17, '1.13 à 1.20'], ['java_1_13', '1.13', 16, '1.13 à 1.20'],
    ['java_1_12', '1.12', 15, '1.0 à 1.12'], ['java_1_11', '1.11', 14, '1.0 à 1.12'], ['java_1_10', '1.10', 13, '1.0 à 1.12'], ['java_1_9', '1.9', 12, '1.0 à 1.12'],
    ['java_1_8', '1.8', 11, '1.0 à 1.12'], ['java_1_7', '1.7', 10, '1.0 à 1.12'], ['java_1_6', '1.6', 9, '1.0 à 1.12'], ['java_1_5', '1.5', 8, '1.0 à 1.12'],
    ['java_1_4', '1.4', 7, '1.0 à 1.12'], ['java_1_3', '1.3', 6, '1.0 à 1.12'], ['java_1_2', '1.2', 5, '1.0 à 1.12'], ['java_1_1', '1.1', 4, '1.0 à 1.12'], ['java_1_0', '1.0', 3, '1.0 à 1.12'],
    ['java_b1_8', 'Bêta 1.8', 2, 'Bêta'], ['java_b1_7', 'Bêta 1.7', 1, 'Bêta'],
  ].map(([key, label, mc, group]) => ({ key, label, mc, group }));

  // [identifiant cubiomes, nom FR, dimension (0 Overworld, -1 Nether, 1 End), icône, rendu]
  const STRUCTURES = [
    { id: 5,  fr: 'Village',               dim: 0,  icon: 'bell' },
    { id: 10, fr: 'Avant-poste de pillards', dim: 0, icon: 'crossbow' },
    { id: 9,  fr: 'Manoir',                dim: 0,  icon: 'totem_of_undying' },
    { id: 8,  fr: 'Monument océanique',    dim: 0,  icon: 'prismarine_shard' },
    { id: 13, fr: 'Cité antique',          dim: 0,  icon: 'echo_shard' },
    { id: 25, fr: 'Chambres d’épreuves', dim: 0, icon: 'trial_key' },
    { id: 1,  fr: 'Pyramide du désert',    dim: 0,  icon: 'sandstone' },
    { id: 2,  fr: 'Temple de la jungle',   dim: 0,  icon: 'vine' },
    { id: 3,  fr: 'Cabane de sorcière',    dim: 0,  icon: 'cauldron' },
    { id: 4,  fr: 'Igloo',                 dim: 0,  icon: 'snow_block' },
    { id: 6,  fr: 'Ruines océaniques',     dim: 0,  icon: 'clay_ball' },
    { id: 7,  fr: 'Épave',                 dim: 0,  icon: 'oak_boat' },
    { id: 14, fr: 'Trésor enfoui',         dim: 0,  icon: 'heart_of_the_sea' },
    { id: 15, fr: 'Mine abandonnée',       dim: 0,  icon: 'rail' },
    { id: 11, fr: 'Portail en ruine',      dim: 0,  icon: 'obsidian' },
    { id: 16, fr: 'Puits du désert',       dim: 0,  icon: 'water_bucket' },
    { id: 24, fr: 'Ruines de sentier',     dim: 0,  icon: 'brush' },
    { id: 26, fr: 'Camp abandonné (26.3)',  dim: 0,  icon: 'campfire' },
    { id: 18, fr: 'Forteresse du Nether',  dim: -1, icon: 'nether_brick' },
    { id: 19, fr: 'Bastion',               dim: -1, icon: 'gilded_blackstone' },
    { id: 12, fr: 'Portail en ruine',      dim: -1, icon: 'obsidian' },
    { id: 21, fr: 'Cité de l’End',    dim: 1,  icon: 'purpur_block' },
    { id: 20, fr: 'Fossile du Nether',     dim: -1, icon: 'bone_block' },
  ];
  const STRONGHOLD = { id: 'stronghold', fr: 'Forteresse (stronghold)', dim: 0, icon: 'ender_eye' };

  const BIOMES_FR = {
    ocean: 'Océan', plains: 'Plaines', desert: 'Désert', windswept_hills: 'Collines venteuses', forest: 'Forêt',
    taiga: 'Taïga', swamp: 'Marais', river: 'Rivière', nether_wastes: 'Désert du Nether', the_end: 'L’End',
    frozen_ocean: 'Océan gelé', frozen_river: 'Rivière gelée', snowy_plains: 'Plaines enneigées',
    snowy_mountains: 'Montagnes enneigées', mushroom_fields: 'Champignonnière', mushroom_field_shore: 'Rivage de champignonnière',
    beach: 'Plage', desert_hills: 'Collines du désert', wooded_hills: 'Collines boisées', taiga_hills: 'Collines de taïga',
    mountain_edge: 'Bord de montagne', jungle: 'Jungle', jungle_hills: 'Collines de jungle', sparse_jungle: 'Jungle clairsemée',
    deep_ocean: 'Océan profond', stony_shore: 'Rivage rocheux', snowy_beach: 'Plage enneigée', birch_forest: 'Forêt de bouleaux',
    birch_forest_hills: 'Collines de bouleaux', dark_forest: 'Forêt sombre', snowy_taiga: 'Taïga enneigée',
    snowy_taiga_hills: 'Collines de taïga enneigée', old_growth_pine_taiga: 'Taïga de pins anciens',
    giant_tree_taiga_hills: 'Collines de taïga géante', windswept_forest: 'Forêt venteuse', savanna: 'Savane',
    savanna_plateau: 'Plateau de savane', badlands: 'Badlands', wooded_badlands: 'Badlands boisées', badlands_plateau: 'Plateau de badlands',
    small_end_islands: 'Petites îles de l’End', end_midlands: 'Hautes terres intermédiaires', end_highlands: 'Hautes terres de l’End',
    end_barrens: 'Landes de l’End', warm_ocean: 'Océan chaud', lukewarm_ocean: 'Océan tiède', cold_ocean: 'Océan froid',
    deep_warm_ocean: 'Océan chaud profond', deep_lukewarm_ocean: 'Océan tiède profond', deep_cold_ocean: 'Océan froid profond',
    deep_frozen_ocean: 'Océan gelé profond', seasonal_forest: 'Forêt saisonnière', rainforest: 'Forêt tropicale', shrubland: 'Broussailles',
    the_void: 'Vide', sunflower_plains: 'Plaines de tournesols', desert_lakes: 'Lacs du désert', windswept_gravelly_hills: 'Collines venteuses de gravier',
    flower_forest: 'Forêt fleurie', taiga_mountains: 'Montagnes de taïga', swamp_hills: 'Collines de marais', ice_spikes: 'Pics de glace',
    modified_jungle: 'Jungle modifiée', modified_jungle_edge: 'Lisière de jungle modifiée', old_growth_birch_forest: 'Forêt de bouleaux anciens',
    tall_birch_hills: 'Hautes collines de bouleaux', dark_forest_hills: 'Collines de forêt sombre', snowy_taiga_mountains: 'Montagnes de taïga enneigée',
    old_growth_spruce_taiga: 'Taïga d’épicéas anciens', giant_spruce_taiga_hills: 'Collines de taïga d’épicéas',
    modified_gravelly_mountains: 'Montagnes de gravier modifiées', windswept_savanna: 'Savane venteuse',
    shattered_savanna_plateau: 'Plateau de savane érodé', eroded_badlands: 'Badlands érodées',
    modified_wooded_badlands_plateau: 'Plateau de badlands boisées modifié', modified_badlands_plateau: 'Plateau de badlands modifié',
    bamboo_jungle: 'Jungle de bambous', bamboo_jungle_hills: 'Collines de jungle de bambous', soul_sand_valley: 'Vallée des âmes',
    crimson_forest: 'Forêt carmin', warped_forest: 'Forêt biscornue', basalt_deltas: 'Deltas de basalte', dripstone_caves: 'Grottes de dripstone',
    lush_caves: 'Grottes luxuriantes', meadow: 'Prairie', grove: 'Bosquet', snowy_slopes: 'Pentes enneigées', jagged_peaks: 'Pics escarpés',
    frozen_peaks: 'Pics gelés', stony_peaks: 'Pics rocheux', deep_dark: 'Abysses', mangrove_swamp: 'Mangrove', cherry_grove: 'Cerisaie',
    pale_garden: 'Jardin pâle', dappled_forest: 'Forêt tachetée', sulfur_caves: 'Grottes de soufre',
    // noms utilisés avant la 1.18
    giant_spruce_taiga: 'Taïga d\u2019épicéas géants', giant_tree_taiga: 'Taïga d\u2019arbres géants', gravelly_mountains: 'Montagnes de gravier',
    jungle_edge: 'Lisière de jungle', mountains: 'Montagnes', shattered_savanna: 'Savane érodée', snowy_tundra: 'Toundra enneigée',
    stone_shore: 'Rivage rocheux', tall_birch_forest: 'Forêt de grands bouleaux', wooded_badlands_plateau: 'Plateau de badlands boisées',
    wooded_mountains: 'Montagnes boisées',
  };

  function cstr(mem, ptr) {
    const u8 = new Uint8Array(mem.buffer); let e = ptr;
    while (u8[e]) e++;
    return new TextDecoder().decode(u8.subarray(ptr, e));
  }

  /** @param {BufferSource|WebAssembly.Module} source */
  async function load(source) {
    const imports = { env: {
      sin: Math.sin, cos: Math.cos, pow: Math.pow, ldexp: (m, e) => m * Math.pow(2, e), round: (x) => (x < 0 ? -Math.round(-x) : Math.round(x)), nan: () => NaN,
    } };
    const { instance } = source instanceof WebAssembly.Module
      ? { instance: await WebAssembly.instantiate(source, imports) }
      : await WebAssembly.instantiate(source, imports);
    const x = instance.exports;
    const mem = () => x.memory;
    let colors = null;
    let current = null;

    return {
      /** Prépare un monde. seed : BigInt (64 bits signé). */
      init(mc, seed, dim, large) {
        const s = BigInt.asUintN(64, BigInt(seed));
        x.world_init(mc, Number(s & 0xffffffffn), Number(s >> 32n), dim | 0, large ? 1 : 0);
        current = { mc, seed: s, dim: dim | 0 };
      },
      /** Biomes d'une zone, renvoyés comme Int32Array de w*h (copie). échelle : 1, 4, 16, 64, 256 */
      biomes(scale, bx, bz, w, h, y) {
        const p = x.world_biomes(scale, bx, bz, w, h, y == null ? (scale === 1 ? 63 : 15) : y);
        if (!p) return null;
        return new Int32Array(mem().buffer.slice(p, p + w * h * 4));
      },
      /** Dézoom extrême : un échantillon tous les `stride` × 256 blocs. */
      biomesSparse(stride, bx, bz, w, h, y) {
        const p = x.world_biomes_sparse(stride, bx, bz, w, h, y == null ? 64 : y);
        return new Int32Array(mem().buffer.slice(p, p + w * h * 4));
      },
      biomeAt(bx, bz, y) { return x.world_biome_at(bx, bz, y == null ? 256 : y); },
      /** Positions [x, z] des structures dans [x0,x1]x[z0,z1] (blocs). */
      structures(type, x0, z0, x1, z1) {
        const out = x.world_out();
        const n = x.world_structs(type, x0, z0, x1, z1, out, 2000);
        const a = new Int32Array(mem().buffer, out, n * 2);
        const res = [];
        for (let i = 0; i < n; i++) res.push([a[2 * i], a[2 * i + 1]]);
        return res;
      },
      structureRegion(type) { return x.struct_region(type); },
      slime(cx, cz) { return !!x.world_slime(Number(current.seed & 0xffffffffn), Number(current.seed >> 32n), cx, cz); },
      structureSupported(type) { return !!x.struct_supported(type); },
      strongholds(count) {
        const out = x.world_out();
        const n = x.world_strongholds(count || 128, out);
        const a = new Int32Array(mem().buffer, out, n * 2);
        const res = [];
        for (let i = 0; i < n; i++) res.push([a[2 * i], a[2 * i + 1]]);
        return res;
      },
      spawn() {
        const out = x.world_out();
        x.world_spawn(out);
        const a = new Int32Array(mem().buffer, out, 2);
        return [a[0], a[1]];
      },
      biomeName(id) { const p = x.biome_name(id); return p ? cstr(mem(), p) : null; },
      biomeColor(id) {
        if (!colors) colors = new Uint8Array(mem().buffer.slice(x.biome_colors(), x.biome_colors() + 768));
        const i = (id & 255) * 3;
        return [colors[i], colors[i + 1], colors[i + 2]];
      },
    };
  }

  return { VERSIONS, STRUCTURES, STRONGHOLD, BIOMES_FR, load, cstr };
});
