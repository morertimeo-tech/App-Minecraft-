/*
 * Données du jeu : enchantements, catégories d'équipement, incompatibilités,
 * matières / motifs / couleurs de trims.
 *
 * Source : minecraft.wiki (pages « Anvil mechanics » et « Enchanting »,
 * consultées le 18/11/2026, Java Edition). Multiplicateurs, niveaux max,
 * incompatibilités et objets applicables sont ceux du wiki.
 */
(function (root, factory) {
  const data = factory();
  if (typeof module === 'object' && module.exports) module.exports = data;
  else root.MC_DATA = data;
})(typeof self !== 'undefined' ? self : this, function () {
  // id: [nom affiché, niveau max, multiplicateur objet, multiplicateur livre]
  // Le coût d'une fusion = niveau × multiplicateur, avec le multiplicateur « livre »
  // quand le sacrifié est un livre (y compris un livre combiné), « objet » sinon.
  const ENCHANTS = {
    protection: ['Protection', 4, 1, 1],
    fire_protection: ['Protection contre le feu', 4, 2, 1],
    blast_protection: ['Protection contre les explosions', 4, 4, 2],
    projectile_protection: ['Protection contre les projectiles', 4, 2, 1],
    feather_falling: ['Chute amortie', 4, 2, 1],
    thorns: ['Épines', 3, 8, 4],
    respiration: ['Apnée', 3, 4, 2],
    aqua_affinity: ['Affinité aquatique', 1, 4, 2],
    depth_strider: ['Agilité aquatique', 3, 4, 2],
    frost_walker: ['Semelles givrantes', 2, 4, 2],
    soul_speed: ['Agilité des âmes', 3, 8, 4],
    swift_sneak: ['Furtivité rapide', 3, 8, 4],
    sharpness: ['Tranchant', 5, 1, 1],
    smite: ['Châtiment', 5, 2, 1],
    bane_of_arthropods: ['Fléau des arthropodes', 5, 2, 1],
    knockback: ['Recul', 2, 2, 1],
    fire_aspect: ['Aura de feu', 2, 4, 2],
    looting: ['Butin', 3, 4, 2],
    sweeping_edge: ['Affilage', 3, 4, 2],
    lunge: ['Charge (Lunge)', 3, 2, 1],
    density: ['Densité', 5, 2, 1],
    breach: ['Brèche', 4, 4, 2],
    wind_burst: ['Rafale', 3, 4, 2],
    efficiency: ['Efficacité', 5, 1, 1],
    silk_touch: ['Toucher de soie', 1, 8, 4],
    fortune: ['Fortune', 3, 4, 2],
    unbreaking: ['Solidité', 3, 2, 1],
    mending: ['Raccommodage', 1, 4, 2],
    curse_binding: ['Malédiction du lien éternel', 1, 8, 4],
    curse_vanishing: ['Malédiction de disparition', 1, 8, 4],
    power: ['Puissance', 5, 1, 1],
    punch: ['Frappe', 2, 4, 2],
    flame: ['Flamme', 1, 4, 2],
    infinity: ['Infinité', 1, 8, 4],
    multishot: ['Tir multiple', 1, 4, 2],
    quick_charge: ['Charge rapide', 3, 2, 1],
    piercing: ['Perforation', 4, 1, 1],
    loyalty: ['Loyauté', 3, 1, 1],
    impaling: ['Empalement', 5, 4, 2],
    riptide: ['Impulsion', 3, 4, 2],
    channeling: ['Canalisation', 1, 8, 4],
    luck_of_the_sea: ['Chance de la mer', 3, 4, 2],
    lure: ['Appât', 3, 4, 2],
  };

  const ARMOR_COMMON = ['protection', 'fire_protection', 'blast_protection', 'projectile_protection', 'thorns'];
  const GENERIC = ['unbreaking', 'mending', 'curse_vanishing'];
  const DIGGER = ['efficiency', 'silk_touch', 'fortune', ...GENERIC];
  const MELEE_DAMAGE = ['sharpness', 'smite', 'bane_of_arthropods'];

  // Catégories d'équipement (Java). `icon` = fichier dans assets/items/.
  const CATEGORIES = [
    { id: 'helmet', name: 'Casque', icon: 'netherite_helmet', group: 'Armure',
      enchants: [...ARMOR_COMMON, 'respiration', 'aqua_affinity', 'curse_binding', ...GENERIC] },
    { id: 'chestplate', name: 'Plastron', icon: 'netherite_chestplate', group: 'Armure',
      enchants: [...ARMOR_COMMON, 'curse_binding', ...GENERIC] },
    { id: 'leggings', name: 'Jambières', icon: 'netherite_leggings', group: 'Armure',
      enchants: [...ARMOR_COMMON, 'swift_sneak', 'curse_binding', ...GENERIC] },
    { id: 'boots', name: 'Bottes', icon: 'netherite_boots', group: 'Armure',
      enchants: [...ARMOR_COMMON, 'feather_falling', 'depth_strider', 'frost_walker', 'soul_speed', 'curse_binding', ...GENERIC] },
    { id: 'sword', name: 'Épée', icon: 'netherite_sword', group: 'Armes',
      enchants: [...MELEE_DAMAGE, 'knockback', 'fire_aspect', 'looting', 'sweeping_edge', ...GENERIC] },
    { id: 'spear', name: 'Lance', icon: 'netherite_spear', group: 'Armes',
      enchants: [...MELEE_DAMAGE, 'knockback', 'fire_aspect', 'looting', 'lunge', ...GENERIC] },
    { id: 'mace', name: 'Masse', icon: 'mace', group: 'Armes',
      enchants: ['smite', 'bane_of_arthropods', 'density', 'breach', 'fire_aspect', 'wind_burst', ...GENERIC] },
    { id: 'axe', name: 'Hache', icon: 'netherite_axe', group: 'Outils',
      enchants: [...MELEE_DAMAGE, ...DIGGER] },
    { id: 'pickaxe', name: 'Pioche', icon: 'netherite_pickaxe', group: 'Outils', enchants: DIGGER },
    { id: 'shovel', name: 'Pelle', icon: 'netherite_shovel', group: 'Outils', enchants: DIGGER },
    { id: 'hoe', name: 'Houe', icon: 'netherite_hoe', group: 'Outils', enchants: DIGGER },
    { id: 'bow', name: 'Arc', icon: 'bow', group: 'Distance',
      enchants: ['power', 'punch', 'flame', 'infinity', ...GENERIC] },
    { id: 'crossbow', name: 'Arbalète', icon: 'crossbow_standby', group: 'Distance',
      enchants: ['multishot', 'quick_charge', 'piercing', ...GENERIC] },
    { id: 'trident', name: 'Trident', icon: 'trident', group: 'Distance',
      enchants: ['loyalty', 'impaling', 'riptide', 'channeling', ...GENERIC] },
    { id: 'fishing_rod', name: 'Canne à pêche', icon: 'fishing_rod', group: 'Divers',
      enchants: ['luck_of_the_sea', 'lure', ...GENERIC] },
    { id: 'elytra', name: 'Élytres', icon: 'elytra', group: 'Divers',
      enchants: ['unbreaking', 'mending', 'curse_binding', 'curse_vanishing'] },
    { id: 'shears', name: 'Cisailles', icon: 'shears', group: 'Divers',
      enchants: ['efficiency', ...GENERIC] },
  ];

  // Groupes d'enchantements incompatibles entre eux (Java).
  const CONFLICT_GROUPS = [
    ['protection', 'fire_protection', 'blast_protection', 'projectile_protection'],
    ['sharpness', 'smite', 'bane_of_arthropods', 'breach', 'density'],
    ['silk_touch', 'fortune'],
    ['infinity', 'mending'],
    ['multishot', 'piercing'],
    ['riptide', 'loyalty'],
    ['riptide', 'channeling'],
    ['frost_walker', 'depth_strider'],
  ];

  // Matières d'armure (fichiers items/<matière>_<pièce>.png).
  const ARMOR_MATERIALS = [
    { id: 'leather', name: 'Cuir', dyeable: true },
    { id: 'chainmail', name: 'Maille' },
    { id: 'copper', name: 'Cuivre' },
    { id: 'iron', name: 'Fer' },
    { id: 'golden', name: 'Or' },
    { id: 'diamond', name: 'Diamant' },
    { id: 'netherite', name: 'Netherite' },
  ];

  const ARMOR_PIECES = [
    { id: 'helmet', name: 'Casque' },
    { id: 'chestplate', name: 'Plastron' },
    { id: 'leggings', name: 'Jambières' },
    { id: 'boots', name: 'Bottes' },
  ];

  // Couleurs de teinture du cuir.
  const DYES = [
    { id: 'default', name: 'Cuir (défaut)', hex: '#a06540' },
    { id: 'white', name: 'Blanc', hex: '#f9fffe' },
    { id: 'light_gray', name: 'Gris clair', hex: '#9d9d97' },
    { id: 'gray', name: 'Gris', hex: '#474f52' },
    { id: 'black', name: 'Noir', hex: '#1d1d21' },
    { id: 'brown', name: 'Marron', hex: '#835432' },
    { id: 'red', name: 'Rouge', hex: '#b02e26' },
    { id: 'orange', name: 'Orange', hex: '#f9801d' },
    { id: 'yellow', name: 'Jaune', hex: '#fed83d' },
    { id: 'lime', name: 'Vert clair', hex: '#80c71f' },
    { id: 'green', name: 'Vert', hex: '#5e7c16' },
    { id: 'cyan', name: 'Cyan', hex: '#169c9c' },
    { id: 'light_blue', name: 'Bleu clair', hex: '#3ab3da' },
    { id: 'blue', name: 'Bleu', hex: '#3c44aa' },
    { id: 'purple', name: 'Violet', hex: '#8932b8' },
    { id: 'magenta', name: 'Magenta', hex: '#c74ebd' },
    { id: 'pink', name: 'Rose', hex: '#f38baa' },
  ];

  // Matières de trim (assets/trims/palettes/<id>.png : 8 couleurs, du plus clair au plus sombre).
  const TRIM_MATERIALS = [
    { id: 'quartz', name: 'Quartz' },
    { id: 'iron', name: 'Fer' },
    { id: 'gold', name: 'Or' },
    { id: 'diamond', name: 'Diamant' },
    { id: 'netherite', name: 'Netherite' },
    { id: 'redstone', name: 'Redstone' },
    { id: 'copper', name: 'Cuivre' },
    { id: 'emerald', name: 'Émeraude' },
    { id: 'lapis', name: 'Lapis' },
    { id: 'amethyst', name: 'Améthyste' },
    { id: 'resin', name: 'Résine' },
  ];

  // Motifs de trim (icône = assets/trims/templates/<id>_armor_trim_smithing_template.png).
  const TRIM_PATTERNS = [
    'sentry', 'dune', 'coast', 'wild', 'ward', 'eye', 'vex', 'tide', 'snout',
    'rib', 'spire', 'wayfinder', 'shaper', 'silence', 'raiser', 'host', 'flow', 'bolt',
  ].map((id) => ({ id, name: id.charAt(0).toUpperCase() + id.slice(1) }));

  return {
    ENCHANTS, CATEGORIES, CONFLICT_GROUPS,
    ARMOR_MATERIALS, ARMOR_PIECES, DYES, TRIM_MATERIALS, TRIM_PATTERNS,
  };
});
