#!/usr/bin/env python3
"""Génère js/farms-data.js : la liste des fermes (avec icônes), pour l'onglet Fermes.

Usage : python3 -I tools/build_farms.py PACK_26_1_DIR OUT_REPO_DIR

La liste est rédigée à la main (types de fermes classiques de Minecraft Java, sans chiffres) ;
elle ne vient pas d'une page du wiki, qui ne propose pas d'inventaire des fermes.
Les noms français sont écrits de mémoire.
"""
import json, os, re, runpy, shutil, sys

pack, out = sys.argv[1:3]
HERE = os.path.dirname(os.path.abspath(__file__))
C = runpy.run_path(os.path.join(HERE, 'common.py'))
resolve = C['make_resolver'](pack)
C['ALIAS'].update({'Cobblestone': 'cobblestone', 'Chorus Fruit': 'chorus_fruit', 'Blaze Rod': 'blaze_rod', 'Oak Log': 'oak_log', 'Basalt': 'basalt_side',
                   'Iron Sword': 'iron_sword', 'Honeycomb': 'honeycomb', 'Sugar Cane': 'sugar_cane', 'Gunpowder': 'gunpowder', 'Iron Ingot': 'iron_ingot'})

MOBS, DROPS, CROPS, ANIM, RES, NETH = 'Mobs et expérience', 'Drops de mobs', 'Cultures', 'Élevage et pêche', 'Blocs et ressources', 'Nether et End'

def f(id, name, cat, icon, produces, desc):
    return dict(id=id, name=name, cat=cat, icon=icon, produces=produces, desc=desc)

FARMS = [
 # --- Mobs et expérience
 f('mob_farm', 'Ferme à mobs (broyeur)', MOBS, 'Bone', "Os, flèches, ficelle, poudre à canon, chair putréfiée… et de l'expérience",
   "Grande salle sombre où les mobs apparaissent naturellement, puis sont acheminés vers un broyeur qui les tue vite. Plusieurs conceptions existent : tour d'apparition, gouffre, canal, bacs d'eau."),
 f('xp_farm', "Ferme à expérience", MOBS, "Bottle o' Enchanting", "Niveaux d'expérience",
   "Récupère l'expérience des mobs tués (ferme à mobs, à spawner, à raids…) pour enchanter et réparer à volonté."),
 f('spawner_trap', 'Piège à spawner', MOBS, 'Zombie Spawn Egg', "Drops d'une seule espèce de mob",
   "Construit autour d'un spawner trouvé dans une structure : il produit une espèce précise de mobs, tués dans une salle dédiée."),
 f('raid_farm', 'Ferme à raids', MOBS, 'Totem of Undying', "Totems, émeraudes, expérience",
   "Déclenche des raids en boucle (cloche et mauvais présage) pour tuer les pillards, les vindicateurs et les évocateurs."),
 # --- Drops de mobs
 f('creeper_farm', 'Ferme à creepers', DROPS, 'Gunpowder', 'Poudre à canon', "Attire et tue des creepers pour la poudre à canon (fusées, TNT)."),
 f('skeleton_farm', 'Ferme à squelettes', DROPS, 'Arrow', 'Os, flèches', "Squelettes, souvent via un spawner ou une grande salle sombre."),
 f('spider_farm', 'Ferme à araignées', DROPS, 'String', "Ficelle, yeux d'araignée", "Araignées tuées automatiquement ; la ficelle sert aux fermes de cultures et au bétail."),
 f('witch_farm', 'Ferme à sorcières', DROPS, 'Redstone Dust', 'Redstone, pierre lumineuse, sucre, bâtons…', "Utilise les huttes de marais où les sorcières apparaissent."),
 f('slime_farm', 'Ferme à slimes', DROPS, 'Slimeball', 'Boules de slime', "Dans un chunk à slimes ou un marais ; les boules de slime servent aux pistons collants."),
 f('guardian_farm', 'Ferme à gardiens', DROPS, 'Prismarine Crystals', 'Prismarine, poissons', "Construite autour d'un monument océanique."),
 f('drowned_farm', 'Ferme à noyés', DROPS, 'Trident', 'Tridents, coquilles de nautile', "Transforme des zombies en noyés pour obtenir les drops rares."),
 f('iron_farm', 'Ferme à fer (golems)', DROPS, 'Iron Ingot', 'Lingots de fer', "Fait apparaître des golems de fer avec des villageois, puis les tue."),
 # --- Cultures
 f('crop_farm', 'Ferme de cultures', CROPS, 'Wheat', 'Blé, carottes, pommes de terre, betteraves', "Récolte automatique avec de l'eau, des pistons ou des villageois."),
 f('sugarcane_farm', 'Ferme à canne à sucre', CROPS, 'Sugar Cane', 'Canne à sucre', "Observateurs et pistons coupent les tiges quand elles ont poussé ; sert pour le papier et les fusées."),
 f('bamboo_farm', 'Ferme à bambou', CROPS, 'Bamboo', 'Bambou', "Coupe automatique du bambou ; combustible et bâtons."),
 f('kelp_farm', 'Ferme à varech', CROPS, 'Kelp', 'Varech, varech séché', "Un bon combustible pour les fours."),
 f('melon_pumpkin_farm', 'Ferme à pastèques et citrouilles', CROPS, 'Melon', 'Pastèques, citrouilles', "Les tiges poussent à côté d'observateurs et de pistons."),
 f('cactus_farm', 'Ferme à cactus', CROPS, 'Cactus', 'Cactus', "Le cactus se casse tout seul quand un bloc se place à côté ; sert aux teintures vertes."),
 f('tree_farm', 'Ferme à bois', CROPS, 'Oak Log', 'Bûches, pousses, pommes', "Coupe automatique des arbres avec des TNT, pistons ou machines de redstone."),
 f('nether_wart_farm', 'Ferme à verrues du Nether', CROPS, 'Nether Wart', 'Verrues du Nether', "Pour les potions ; pousse sur du sable des âmes."),
 f('honey_farm', 'Ferme à miel', CROPS, 'Honeycomb', 'Miel, rayons de miel', "Abeilles, ruches et distributeurs ou pistons collants."),
 # --- Élevage et pêche
 f('animal_farm', "Ferme d'animaux", ANIM, 'Raw Beef', 'Viande, cuir, laine', "Élevage automatique de vaches, cochons ou moutons, avec abattage à la chaîne."),
 f('chicken_farm', 'Ferme à poulets', ANIM, 'Raw Chicken', 'Poulet, plumes, œufs', "Des œufs tombent dans un entonnoir ; les poussins sont élevés puis tués."),
 f('fishing_farm', 'Ferme de pêche', ANIM, 'Fishing Rod', 'Poissons et objets de pêche', "Pêche automatique, avec un système de redstone qui relève la canne."),
 f('villager_breeder', 'Ferme à villageois', ANIM, 'Emerald', 'Villageois pour les échanges', "Élève des villageois avec de la nourriture et des lits."),
 # --- Blocs et ressources
 f('cobble_generator', 'Générateur de pierre', RES, 'Cobblestone', 'Pierre, roche', "Lave et eau qui se rencontrent produisent de la pierre en continu."),
 f('sand_gravel_farm', 'Ferme à sable et gravier', RES, 'Sand', 'Sable, gravier', "Blocs qui tombent et sont récupérés par un entonnoir."),
 # --- Nether et End
 f('gold_farm', "Ferme à or (piglins zombifiés)", NETH, 'Gold Ingot', "Pépites et lingots d'or, expérience", "Dans le Nether, avec des portails ou des spawners de piglins zombifiés."),
 f('blaze_farm', 'Ferme à blazes', NETH, 'Blaze Rod', 'Verges de blaze', "Autour du spawner d'une forteresse du Nether."),
 f('wither_skeleton_farm', 'Ferme à squelettes wither', NETH, 'Coal', 'Charbon, crânes de squelette wither', "Dans une forteresse du Nether ; seule source renouvelable de crânes."),
 f('enderman_farm', 'Ferme à endermen', NETH, 'Ender Pearl', "Perles de l'Ender, expérience", "Très rentable dans l'End, où ils apparaissent en grand nombre."),
 f('chorus_farm', 'Ferme à chorus', NETH, 'Chorus Fruit', 'Fruits de chorus, purpur', "Dans l'End, avec des pistons ou des TNT."),
 f('basalt_generator', 'Générateur de basalte', NETH, 'Basalt', 'Basalte', "Glace bleue, lave et sol des âmes."),
]

icons_dir = out + '/assets/item-icons'
os.makedirs(icons_dir, exist_ok=True)
slug = lambda n: re.sub(r'[^a-z0-9]+', '_', n.lower().replace("'", '')).strip('_')
missing = []
for fm in FARMS:
    src = resolve(fm['icon'])
    if not src:
        missing.append(fm['icon']); fm['icon'] = None; continue
    key = slug(C['icon_base'](fm['icon']))
    dst = f'{icons_dir}/{key}.png'
    if not os.path.exists(dst): shutil.copyfile(src, dst)
    fm['icon'] = key

js = ('/* Généré par tools/build_farms.py (liste rédigée à la main). Ne pas éditer à la main. */\n'
      'window.MC_FARMS = ' + json.dumps(FARMS, ensure_ascii=False, separators=(',', ':')) + ';\n')
open(out + '/js/farms-data.js', 'w', encoding='utf-8').write(js)
print(len(FARMS), 'fermes ;', len({f['cat'] for f in FARMS}), 'catégories ; sans icône :', missing)
