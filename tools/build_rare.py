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

def e(rank, name, icon, rate, rate_note, where, chips=(), note=None, check=None):
    d = dict(rank=rank, name=name, icon=icon, rate=rate, rateNote=rate_note, where=where, chips=list(chips), note=note)
    if check: d['check'] = check
    return d

SUB = [
 dict(id='items', name='Objets', metric="Chance d'obtenir l'objet (par mort de mob ou par coffre)", entries=[
   e(1, 'Trident', 'Trident', '≈ 0,53 %', 'par noyé tué',
     "Noyé armé d'un trident",
     ['Rare', 'Renouvelable'],
     "6,25 % des noyés apparaissent avec un trident et le lâchent dans 8,5 % des cas (Java) : 6,25 % × 8,5 % ≈ 0,53 %. Calcul fait à partir des valeurs du wiki ; +1 % de lâcher par niveau de Butin. Aussi 2,1 % dans les vaults des chambres d'épreuves."),
   e(2, 'Armure en diamant pour nautile', 'Diamond Nautilus Armor', '1,1 %', 'par coffre',
     "Épaves, ruines océaniques, trésor enterré", [],
     "Chance de l'avoir dans chaque coffre concerné (butin le plus rare des coffres marins).", check=dict(name='Armure en diamant pour nautile', chance='1.1%')),
   e(3, 'Modèle de forge : Silence', 'Silence Armor Trim', '1,2 %', 'par coffre',
     "Cité antique (coffres)", ['Épique', 'Non renouvelable'],
     "La rareté la plus haute des modèles de forge.", check=dict(name='Modèle de forge : Silence', chance='1.2%')),
 ]),
 dict(id='mobs', name='Mobs', metric="Probabilité d'apparition ou de naissance de la variante rare", entries=[
   e(1, 'Axolotl bleu', 'Axolotl Spawn Egg', '0,083 %', 'soit 1 chance sur 1 200',
     "Élevage d'axolotls", [],
     "Lors de la reproduction de deux axolotls, le petit a 1 chance sur 1 200 d'être bleu (variante rare)."),
   e(2, 'Mooshroom brun', 'Mooshroom Spawn Egg', '≈ 0,098 %', 'soit 1 chance sur 1 024',
     "Élevage de deux mooshrooms rouges", [],
     "Un petit brun naît 1 fois sur 1 024. Un éclair à moins de 4 blocs change aussi la couleur d'un mooshroom."),
   e(3, 'Mouton rose', 'Sheep Spawn Egg', '0,164 %', 'par apparition naturelle',
     "Biomes tempérés (plaines, forêts, marais, prairie…)", [],
     "Couleur « très rare » : les moutons blancs (81,836 %), noirs, gris, gris clair (5 % chacun) et bruns (3 %) sont bien plus fréquents."),
 ]),
 dict(id='blocks', name='Blocs', metric="Chance de trouver le bloc (par coffre ou une seule fois)", entries=[
   e(1, 'Œuf de dragon', 'Dragon Egg', '1 par monde', 'unique (2 en Bedrock)',
     "Vaincre l'Ender Dragon", ['Épique', 'Non renouvelable'],
     "Il se téléporte pour éviter d'être miné. Obtenable une seule fois par monde en Java."),
   e(2, 'Bloc de diamant', 'Block of Diamond', '0,3 %', 'par pot décoré',
     "Pots décorés des couloirs des chambres d'épreuves", [],
     "Aussi 2,3 % dans les coffres d'intersection et 2,8 % dans les vaults sinistres.", check=dict(name='Bloc de diamant', chance='0.3%')),
   e(3, "Bloc d'émeraude", 'Block of Emerald', '1,4 %', 'par pot décoré',
     "Pots décorés des couloirs des chambres d'épreuves", [], None, check=dict(name="Bloc d'émeraude", chance='1.4%')),
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
 ]),
 dict(id='structures', name='Structures', metric="Fréquence de génération (espacement et probabilité du wiki)", entries=[
   e(1, 'Forteresse (stronghold)', 'Eye of Ender', '128 par monde', 'en tout, par anneaux',
     "Tous les biomes de l'Overworld", [],
     "Seules 128 forteresses existent dans un monde Java, placées en anneaux concentriques."),
   e(2, 'Manoir', 'Totem of Undying', '1 pour 6 400 chunks', 'région de 80 × 80',
     "Forêt sombre, jardin pâle", [],
     "Espacement de 80 chunks, le plus grand des structures. Il faut en plus le bon biome, donc il est encore plus rare en pratique."),
   e(3, 'Avant-poste de pillards', 'Crossbow', '≈ 1 pour 5 120 chunks', 'région de 32 × 32, 20 %',
     "Plaines, désert, savane, taïga, plaines enneigées, bosquet, prairie…", [],
     "Une région de 32 × 32 chunks sur 5 en reçoit un (20 %), à au moins 10 chunks d'un village."),
 ]),
]

icons_dir = out + '/assets/item-icons'
os.makedirs(icons_dir, exist_ok=True)
slug = lambda n: re.sub(r'[^a-z0-9]+', '_', n.lower().replace("'", '')).strip('_')
missing = []
for sc in SUB:
    for en in sc['entries']:
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
