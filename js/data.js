/*
 * Données du jeu : enchantements, catégories d'équipement, incompatibilités,
 * matières / motifs / couleurs de trims.
 *
 * ATTENTION : ces données ont été écrites de mémoire (Minecraft Java 1.21+).
 * Le wiki officiel n'était pas joignable pendant la création. Les catégories
 * marquées `verify: true` sont celles dont la liste d'enchantements est
 * incertaine. À vérifier dans le jeu avant de se fier aux résultats.
 */
(function (root, factory) {
  const data = factory();
  if (typeof module === 'object' && module.exports) module.exports = data;
  else root.MC_DATA = data;
})(typeof self !== 'undefined' ? self : this, function () {
  // Multiplicateur de coût d'enchantement selon la rareté (coût d'enclume).
  const RARITY = {
    common: { label: 'Commun', mult: 1, color: '#55ff55' },
    uncommon: { label: 'Peu commun', mult: 2, color: '#55ffff' },
    rare: { label: 'Rare', mult: 4, color: '#5555ff' },
    very_rare: { label: 'Très rare', mult: 8, color: '#ff55ff' },
  };

  // id, nom affiché, niveau max, rareté
  const ENCHANTS = {
    protection: ['Protection', 4, 'common'],
    fire_protection: ['Protection contre le feu', 4, 'uncommon'],
    blast_protection: ['Protection contre les explosions', 4, 'rare'],
    projectile_protection: ['Protection contre les projectiles', 4, 'uncommon'],
    feather_falling: ['Chute amortie', 4, 'uncommon'],
    thorns: ['Épines', 3, 'very_rare'],
    respiration: ['Respiration', 3, 'rare'],
    aqua_affinity: ['Affinité aquatique', 1, 'rare'],
    depth_strider: ['Agilité aquatique', 3, 'rare'],
    frost_walker: ['Marche du gel', 2, 'rare'],
    soul_speed: ['Célérité des âmes', 3, 'very_rare'],
    swift_sneak: ['Furtivité rapide', 3, 'very_rare'],
    sharpness: ['Tranchant', 5, 'common'],
    smite: ['Châtiment', 5, 'uncommon'],
    bane_of_arthropods: ['Fléau des arthropodes', 5, 'uncommon'],
    knockback: ['Recul', 2, 'uncommon'],
    fire_aspect: ['Aspect ignifère', 2, 'rare'],
    looting: ['Butin', 3, 'rare'],
    sweeping_edge: ['Tranchant balayant', 3, 'rare'],
    density: ['Densité', 5, 'rare'],
    breach: ['Brèche', 4, 'rare'],
    wind_burst: ['Rafale de vent', 3, 'rare'],
    efficiency: ['Efficacité', 5, 'common'],
    silk_touch: ['Toucher de soie', 1, 'very_rare'],
    fortune: ['Fortune', 3, 'rare'],
    unbreaking: ['Solidité', 3, 'uncommon'],
    mending: ['Réparation', 1, 'rare'],
    curse_binding: ['Malédiction de lien', 1, 'very_rare'],
    curse_vanishing: ['Malédiction de disparition', 1, 'very_rare'],
    power: ['Puissance', 5, 'common'],
    punch: ['Frappe', 2, 'rare'],
    flame: ['Flamme', 1, 'rare'],
    infinity: ['Infinité', 1, 'very_rare'],
    multishot: ['Tir multiple', 1, 'rare'],
    quick_charge: ['Charge rapide', 3, 'uncommon'],
    piercing: ['Perforation', 4, 'common'],
    loyalty: ['Fidélité', 3, 'uncommon'],
    impaling: ['Empalement', 5, 'rare'],
    riptide: ['Ruée aquatique', 3, 'rare'],
    channeling: ['Foudroiement', 1, 'very_rare'],
    luck_of_the_sea: ['Chance de la mer', 3, 'rare'],
    lure: ['Appât', 3, 'rare'],
  };

  const ARMOR_MENDING = ['unbreaking', 'mending', 'curse_vanishing'];
  const PROTECTION_ARMOR = ['protection', 'fire_protection', 'blast_protection', 'projectile_protection', 'thorns'];
  const TOOL_BASE = ['efficiency', 'unbreaking', 'mending', 'curse_vanishing'];

  // Catégories d'équipement. `icon` = fichier dans assets/items/.
  const CATEGORIES = [
    { id: 'helmet', name: 'Casque', icon: 'netherite_helmet', group: 'Armure',
      enchants: [...PROTECTION_ARMOR, 'respiration', 'aqua_affinity', 'curse_binding', ...ARMOR_MENDING] },
    { id: 'chestplate', name: 'Plastron', icon: 'netherite_chestplate', group: 'Armure',
      enchants: [...PROTECTION_ARMOR, 'curse_binding', ...ARMOR_MENDING] },
    { id: 'leggings', name: 'Jambières', icon: 'netherite_leggings', group: 'Armure',
      enchants: [...PROTECTION_ARMOR, 'swift_sneak', 'curse_binding', ...ARMOR_MENDING] },
    { id: 'boots', name: 'Bottes', icon: 'netherite_boots', group: 'Armure',
      enchants: [...PROTECTION_ARMOR, 'feather_falling', 'depth_strider', 'frost_walker', 'soul_speed', 'curse_binding', ...ARMOR_MENDING] },
    { id: 'sword', name: 'Épée', icon: 'netherite_sword', group: 'Armes',
      enchants: ['sharpness', 'smite', 'bane_of_arthropods', 'knockback', 'fire_aspect', 'looting', 'sweeping_edge', 'unbreaking', 'mending', 'curse_vanishing'] },
    { id: 'axe', name: 'Hache', icon: 'netherite_axe', group: 'Outils', verify: true,
      enchants: ['sharpness', 'smite', 'bane_of_arthropods', 'efficiency', 'silk_touch', 'fortune', 'unbreaking', 'mending', 'curse_vanishing'] },
    { id: 'pickaxe', name: 'Pioche', icon: 'netherite_pickaxe', group: 'Outils',
      enchants: ['efficiency', 'silk_touch', 'fortune', 'unbreaking', 'mending', 'curse_vanishing'] },
    { id: 'shovel', name: 'Pelle', icon: 'netherite_shovel', group: 'Outils',
      enchants: ['efficiency', 'silk_touch', 'fortune', 'unbreaking', 'mending', 'curse_vanishing'] },
    { id: 'hoe', name: 'Houe', icon: 'netherite_hoe', group: 'Outils', verify: true,
      enchants: ['fortune', 'unbreaking', 'mending', 'curse_vanishing'] },
    { id: 'bow', name: 'Arc', icon: 'bow', group: 'Distance',
      enchants: ['power', 'punch', 'flame', 'infinity', 'unbreaking', 'mending', 'curse_vanishing'] },
    { id: 'crossbow', name: 'Arbalète', icon: 'crossbow_standby', group: 'Distance',
      enchants: ['multishot', 'quick_charge', 'piercing', 'unbreaking', 'mending', 'curse_vanishing'] },
    { id: 'trident', name: 'Trident', icon: 'trident', group: 'Distance',
      enchants: ['loyalty', 'impaling', 'riptide', 'channeling', 'unbreaking', 'mending', 'curse_vanishing'] },
    { id: 'mace', name: 'Masse', icon: 'mace', group: 'Armes', verify: true,
      enchants: ['density', 'breach', 'wind_burst', 'unbreaking', 'mending', 'curse_vanishing'] },
    { id: 'fishing_rod', name: 'Canne à pêche', icon: 'fishing_rod', group: 'Divers', verify: true,
      enchants: ['luck_of_the_sea', 'lure', 'unbreaking', 'mending', 'curse_vanishing'] },
    { id: 'elytra', name: 'Élytres', icon: 'elytra', group: 'Divers',
      enchants: ['unbreaking', 'mending', 'curse_binding', 'curse_vanishing'] },
    { id: 'shears', name: 'Cisailles', icon: 'shears', group: 'Divers',
      enchants: ['efficiency', 'unbreaking', 'mending', 'curse_vanishing'] },
  ];

  // Paires qui ne peuvent pas coexister sur un même objet.
  const CONFLICT_GROUPS = [
    ['protection', 'fire_protection', 'blast_protection', 'projectile_protection'],
    ['sharpness', 'smite', 'bane_of_arthropods'],
    ['silk_touch', 'fortune'],
    ['infinity', 'mending'],
    ['multishot', 'piercing'],
    ['riptide', 'loyalty', 'channeling'],
    ['frost_walker', 'depth_strider'],
    ['density', 'breach'], // verify
  ];

  // Matières d'armure (dossier items/) et leur couleur de base.
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

  // Couleurs de teinture du cuir (valeurs de l'API de teinture du jeu).
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

  // Matières de trim (fichier palettes/<id>.png, 8 couleurs du plus clair au plus sombre).
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

  // Motifs de trim (icône de template = assets/trims/templates/<id>_armor_trim_smithing_template.png).
  const TRIM_PATTERNS = [
    'sentry', 'dune', 'coast', 'wild', 'ward', 'eye', 'vex', 'tide', 'snout',
    'rib', 'spire', 'wayfinder', 'shaper', 'silence', 'raiser', 'host', 'flow', 'bolt',
  ].map((id) => ({ id, name: id.charAt(0).toUpperCase() + id.slice(1) }));

  return {
    RARITY, ENCHANTS, CATEGORIES, CONFLICT_GROUPS,
    ARMOR_MATERIALS, ARMOR_PIECES, DYES, TRIM_MATERIALS, TRIM_PATTERNS,
  };
});
