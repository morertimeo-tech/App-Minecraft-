#!/usr/bin/env python3
"""Génère js/rare-data.js : le podium des 3 choses les plus rares de chaque sous-catégorie.

Usage : python3 -I tools/build_rare.py PACK_26_1_DIR OUT_REPO_DIR

Sous-catégories : objets, mobs, blocs, minerais, structures. Chaque taux vient du wiki
(minecraft.wiki, Java Edition) ou de nos données de butin (js/structures-data.js) :
  - mobs      : pages Axolotl, Mooshroom, Sheep (probabilités d'apparition / de naissance)
  - minerais  : page Ore (« Abundance »)
  - structures: page Structure set (espacement, probabilité, anneaux de forteresses)
  - objets / blocs : pages Trident, Smithing Template, Dragon Egg + coffres (onglet Structures)
`check` sert aux tests : le pourcentage doit se retrouver dans les butins de structures.
Les noms français sont écrits de mémoire.
"""
import json, os, re, runpy, shutil, sys

pack, out = sys.argv[1:3]
HERE = os.path.dirname(os.path.abspath(__file__))
C = runpy.run_path(os.path.join(HERE, 'common.py'))
resolve = C['make_resolver'](pack)

def e(rank, name, icon, rate, rate_note, where, chips=(), note=None, check=None, p=None):
    d = dict(rank=rank, name=name, icon=icon, rate=rate, rateNote=rate_note, where=where, chips=list(chips), note=note)
    if p is not None: d['p'] = p
    if check: d['check'] = check
    return d

SUB = [
 dict(id='items', name='Objets', metric="Chance d'obtenir l'objet (par mort de mob ou par coffre)", entries=[
   e(1, 'Trident', 'Trident', '≈ 0,53 %', 'par noyé tué',
     "Noyé armé d'un trident",
     ['Rare', 'Renouvelable'],
     "6,25 % des noyés apparaissent avec un trident et le lâchent dans 8,5 % des cas : 6,25 % × 8,5 % ≈ 0,53 %. Calcul fait à partir des valeurs du wiki ; +1 % de lâcher par niveau de Butin. Aussi 2,1 % dans les vaults des chambres d'épreuves."),
   e(2, 'Armure en diamant pour nautile', 'Diamond Nautilus Armor', '1,1 %', 'par coffre',
     "Épaves, ruines océaniques, trésor enterré", [],
     "Chance de l'avoir dans chaque coffre concerné (butin le plus rare des coffres marins).", check=dict(name='Armure en diamant pour nautile', chance='1.1%')),
   e(3, 'Modèle de forge : Silence', 'Silence Armor Trim', '1,2 %', 'par coffre',
     "Cité antique (coffres)", ['Épique', 'Non renouvelable'],
     "La rareté la plus haute des modèles de forge.", check=dict(name='Modèle de forge : Silence', chance='1.2%')),
 ]),
 dict(id='mobs', name='Mobs', metric="Probabilité d'apparition (ou de naissance) du mob ou de la combinaison, par mob apparu", entries=[
   e(1, 'Bébé zombie sur un poulet, en armure complète de diamant', 'Zombie Spawn Egg', '≈ 0,0000104 %', 'par zombie qui apparaît (environ 1 sur 9,6 millions)',
     "Overworld, en difficulté Difficile", [],
     "Calcul à partir des valeurs du wiki, cas le plus favorable (difficulté régionale maximale) : 0,2375 % de jockey × 15 % d'armure × 72,9 % d'ensemble complet × 0,04 % de diamant ≈ 1,04 × 10⁻⁷. Avec des poules à proximité (0,4875 %), environ 0,000021 % (1 sur 4,7 millions).",
     p=0.15 * 0.729 * 0.0004 * 0.002375),
   e(2, 'Zombie en armure complète de diamant', 'Diamond Chestplate', '≈ 0,0044 %', 'par zombie qui apparaît (environ 1 sur 23 000)',
     "Overworld, en difficulté Difficile", [],
     "15 % d'armure (maximum) × 72,9 % d'ensemble complet (Difficile) × 0,04 % de diamant ≈ 0,0044 %. Toutes les pièces sont de la même matière ; la netherite n'apparaît jamais naturellement. Calcul fait à partir des valeurs du wiki.",
     p=0.15 * 0.729 * 0.0004),
   e(3, 'Axolotl bleu', 'Axolotl Spawn Egg', '0,083 %', 'soit 1 chance sur 1 200',
     "Élevage d'axolotls", [],
     "Lors de la reproduction de deux axolotls, le petit a 1 chance sur 1 200 d'être bleu (variante rare).", p=1 / 1200),
 ], others=[
   e(4, 'Mooshroom brun', 'Mooshroom Spawn Egg', '≈ 0,098 %', 'soit 1 chance sur 1 024', "Élevage de deux mooshrooms rouges", [],
     "Un éclair à moins de 4 blocs change aussi la couleur d'un mooshroom.", p=1 / 1024),
   e(5, 'Mouton rose', 'Sheep Spawn Egg', '0,164 %', 'par apparition naturelle', "Biomes tempérés (plaines, forêts, marais, prairie…)", [],
     "Couleur « très rare » ; les moutons blancs font 81,836 % des apparitions.", p=0.00164),
   e(6, 'Bébé zombie sur un poulet (chicken jockey)', 'Chicken Spawn Egg', '0,2375 %', 'par zombie ; 0,4875 % avec des poules', "Overworld (Java)", [],
     "5 % des zombies sont des bébés, dont 4,75 % apparaissent déjà sur un poulet. Le même taux vaut pour les bébés zombifiés piglins.", p=0.002375),
   e(7, 'Araignée avec un squelette (spider jockey)', 'Spider Spawn Egg', '1 %', 'des araignées', "Overworld", [],
     "Le cavalier est un squelette ou un stray.", p=0.01),
   e(8, 'Panda brun', 'Panda Spawn Egg', '≈ 1,6 %', 'soit 1 sur 64 des pandas', "Jungle et jungle de bambous (sur de l'herbe)", [],
     "Personnalité la plus rare des pandas ; la normale en représente 63,7 %.", p=1 / 64),
   e(9, 'Chèvre hurlante', 'Goat Spawn Egg', '2 %', 'des chèvres', "Pics gelés, pics déchiquetés, pentes enneigées (ou élevage)", [],
     "Seule source des cornes « Admire », « Call », « Yearn » et « Dream ».", p=0.02),
 ]),
 dict(id='blocks', name='Blocs', metric="Chance de trouver le bloc dans un coffre ou un pot (butins de l'onglet Structures)", entries=[
   e(1, 'Bloc de diamant', 'Block of Diamond', '0,3 %', 'par pot décoré',
     "Pots décorés des couloirs des chambres d'épreuves", [],
     "Aussi 2,3 % dans les coffres d'intersection et 2,8 % dans les vaults sinistres.", check=dict(name='Bloc de diamant', chance='0.3%')),
   e(2, "Bloc d'émeraude", 'Block of Emerald', '1,4 %', 'par pot décoré',
     "Pots décorés des couloirs des chambres d'épreuves", [],
     "Aussi 11,2 % dans les coffres d'intersection.", check=dict(name="Bloc d'émeraude", chance='1.4%')),
   e(3, "Bloc d'or", 'Block of Gold', '1,5 %', 'par coffre',
     "Coffre des portails en ruine", [],
     "Ex æquo avec la cloche. 11,2 % dans les ponts des bastions.", check=dict(name="Bloc d'or", chance='1.5%')),
   e(3, 'Cloche', 'Bell', '1,5 %', 'par coffre',
     "Coffre des portails en ruine", [], None, check=dict(name='Cloche', chance='1.5%')),
 ], others=[
   e(5, "Œuf de renifleur", 'Sniffer Egg', '6,7 %', 'par bloc fouillé', "Sable suspect des ruines océaniques chaudes", ['Renouvelable'],
     "Peut aussi s'obtenir en élevant deux renifleurs.", check=dict(name="Œuf de renifleur", chance='6.7%')),
   e(6, 'Cœur lourd', 'Heavy Core', '7,5 %', 'par vault sinistre', "Vaults sinistres des chambres d'épreuves", ['Non renouvelable'],
     "Sert à fabriquer une masse avec une verge de brise.", check=dict(name='Cœur lourd', chance='7.5%')),
 ]),
 dict(id='ores', name='Minerais', metric="Abondance indiquée par le wiki (le meilleur niveau Y est celui où il est le plus trouvé)", entries=[
   e(1, 'Débris antiques', 'Ancient Debris', 'Très rare', 'abondance (wiki)',
     "Nether, surtout autour de y 16", ['Non renouvelable'],
     "Seule source de netherite. Rare au-delà de y 24 ; aucun à y 120 et au-dessus."),
   e(2, 'Minerai de diamant', 'Diamond Ore', 'Très rare', 'abondance (wiki)',
     "Overworld, surtout autour de y −59", [],
     "Aucun diamant à y 16 et au-dessus."),
   e(3, 'Minerai de lapis-lazuli', 'Lapis Ore', 'Rare', 'abondance (wiki)',
     "Overworld, surtout autour de y −2", [],
     "Ex æquo avec l'or (« rare » aussi)."),
   e(3, "Minerai d'or", 'Gold Ore', 'Rare', 'abondance (wiki)',
     "Overworld, surtout autour de y −18", [],
     "Dans les badlands, l'or est « commun » (filons supplémentaires de y 32 à 256)."),
 ], othersTitle="Dans les abîmes (sous y 0) : ce qui disparaît", others=[
   e(5, 'Charbon', 'Coal Ore', 'Absent sous y 0', 'alors que son abondance est « très commune »',
     "Overworld, y 0 à 320 (le plus trouvé vers y 45)", [],
     "Le wiki indique aucun charbon de y −64 à −1, et le deepslate (les abîmes) ne se forme que sous y 8. Le charbon des abîmes ne peut donc exister qu'entre y 0 et 7 (déduction)."),
   e(6, 'Émeraude', 'Emerald Ore', 'Absente sous y −17', "abondance « peu commune »",
     "Seulement en biome de montagne, le plus trouvé vers y 85", [],
     "Le wiki indique aucune émeraude de y −64 à −17. Sa variante des abîmes ne peut donc exister qu'entre y −16 et 7 (déduction)."),
   e(7, 'Cuivre', 'Copper Ore', 'Absent de y −64 à −17', "abondance « commune »",
     "Overworld, le plus trouvé vers y 43", [],
     "Aucun cuivre à y 113 et au-dessus non plus. Très commun dans les grottes à stalactites."),
   e(8, 'Diamant et redstone', 'Redstone Ore', 'Absents à y 16 et plus', "uniquement dans les profondeurs",
     "Overworld, y −59 en moyenne pour les deux", [],
     "À l'inverse du charbon, ces deux minerais n'existent qu'au fond : rien à y 16 ou plus."),
 ]),
 dict(id='structures', name='Structures', metric="Part des chunks qui reçoivent la structure (espacement et probabilité du wiki, hors contrainte de biome)", entries=[
   e(1, 'Manoir', 'Totem of Undying', '≈ 0,0156 %', 'des chunks (1 sur 6 400)',
     "Forêt sombre, jardin pâle", [],
     "Espacement de 80 chunks, le plus grand de toutes les structures : une région de 80 × 80 chunks reçoit un manoir. Il faut en plus le bon biome, donc il est encore plus rare en pratique.",
     p=1 / 6400),
   e(2, 'Avant-poste de pillards', 'Crossbow', '≈ 0,0195 %', 'des chunks (1 sur 5 120)',
     "Plaines, désert, savane, taïga, plaines enneigées, bosquet, prairie…", [],
     "Une région de 32 × 32 chunks sur 5 en reçoit un (20 %), à au moins 10 chunks d'un village.",
     p=0.2 / (32 * 32)),
   e(3, 'Forteresse du Nether', 'Nether Wart', '≈ 0,055 %', 'des chunks (1 sur 1 823)',
     "Tous les biomes du Nether", [],
     "Espacement de 27 chunks ; 40 % des emplacements du Nether sont des forteresses, 60 % des bastions.",
     p=0.4 / (27 * 27)),
 ], othersTitle="Autres structures peu fréquentes", others=[
   e(4, 'Portail en ruine', 'Crying Obsidian', '≈ 0,0625 %', 'des chunks (1 sur 1 600)', "Overworld et Nether", [], "Espacement de 40 chunks.", p=1 / (40 * 40)),
   e(5, 'Camp abandonné', 'Torch', '≈ 0,073 %', 'des chunks (1 sur 1 369)', "Forêts, taïga, savane, marais…", [], "Espacement de 37 chunks.", p=1 / (37 * 37)),
   e(6, 'Bastion', 'Gilded Blackstone', '≈ 0,082 %', 'des chunks (1 sur 1 215)', "Désert du Nether, forêts carmin et tordue, vallée des âmes", [], "Espacement de 27 chunks ; 60 % des emplacements du Nether.", p=0.6 / (27 * 27)),
   e(7, "Chambres d'épreuves", 'Trial Key', '≈ 0,087 %', 'des chunks (1 sur 1 156)', "Tous les biomes de l'Overworld sauf Deep Dark", [], "Espacement de 34 chunks (comme les villages et les ruines de sentier).", p=1 / (34 * 34)),
   e(8, 'Monument océanique', 'Prismarine Crystals', '≈ 0,098 %', 'des chunks (1 sur 1 024)', "Océans profonds", [], "Espacement de 32 chunks (comme les temples, igloos et cabanes).", p=1 / (32 * 32)),
   e(9, 'Cité antique', 'Echo Shard', '≈ 0,174 %', 'des chunks (1 sur 576)', "Deep Dark (obscurité profonde)", [], "Espacement de 24 chunks.", p=1 / (24 * 24)),
 ]),
]

icons_dir = out + '/assets/item-icons'
os.makedirs(icons_dir, exist_ok=True)
slug = lambda n: re.sub(r'[^a-z0-9]+', '_', n.lower().replace("'", '')).strip('_')
missing = []
for sc in SUB:
    for en in sc['entries'] + sc.get('others', []):
        name = en['icon']
        src = resolve(name)
        if not src:
            missing.append(name); en['icon'] = None; continue
        key = slug(C['icon_base'](name))
        dst = f'{icons_dir}/{key}.png'
        if not os.path.exists(dst): shutil.copyfile(src, dst)
        en['icon'] = key

js = ('/* Généré par tools/build_rare.py (minecraft.wiki, Java Edition). Ne pas éditer à la main. */\n'
      'window.MC_RARE = ' + json.dumps(SUB, ensure_ascii=False, separators=(',', ':')) + ';\n')
open(out + '/js/rare-data.js', 'w', encoding='utf-8').write(js)
print(sum(len(s['entries']) for s in SUB), 'entrées dans', len(SUB), 'sous-catégories ; sans icône :', missing)
