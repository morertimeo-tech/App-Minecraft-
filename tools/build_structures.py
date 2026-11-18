#!/usr/bin/env python3
"""Génère js/structures-data.js : structures du jeu, où les trouver, butins possibles.

Usage : python3 -I tools/build_structures.py structures_raw.json PACK_26_1_DIR OUT_REPO_DIR
  structures_raw.json vient de tools/extract_structures.py (butins du wiki, version Java sortie).
Les descriptions, biomes et conseils sont rédigés ici en français à partir des pages du wiki
(Structure, pages de chaque structure) ; les butins sont ceux du wiki.
"""
import json, os, re, runpy, shutil, sys

raw_json, pack, out = sys.argv[1:4]
HERE = os.path.dirname(os.path.abspath(__file__))
C = runpy.run_path(os.path.join(HERE, 'common.py'))
fr_item, make_resolver = C['fr_item'], C['make_resolver']
resolve = make_resolver(pack)
raw = json.load(open(raw_json, encoding='utf-8'))

# ---------------------------------------------------------------------------
# Structures : (id wiki, nom, dimension, objet-icône, biomes, ids /locate, astuces, description)
OW, NE, EN = 'Overworld', 'Nether', "L'End"
ALL_OW = "Tous les biomes de l'Overworld sauf Deep Dark (obscurité profonde)"
OCEANS = "Océans et océans profonds (normal, froid, gelé, tiède, chaud)"
CARTO = "Carte d'exploration vendue par le cartographe"
S = [
 dict(id='village', name='Village', dim=OW, icon='Bell',
      biomes=['Plaines', 'Prairie (Meadow)', 'Désert', 'Savane', 'Taïga', 'Plaines enneigées', 'Taïga enneigée'],
      locate=['village_plains', 'village_desert', 'village_savanna', 'village_snowy', 'village_taiga'],
      tips=["Le cartographe vend une carte de village (niveau Apprenti)."],
      desc="Ville de maisons et de postes de travail habitée par des villageois, avec jusqu'à deux golems de fer. L'architecture dépend du biome."),
 dict(id='desert_pyramid', name='Pyramide du désert', dim=OW, icon='TNT', biomes=['Désert'], locate=['desert_pyramid'], tips=[],
      desc="Grand bâtiment de grès avec quatre coffres dans une salle souterraine cachée sous de la terre cuite. Les coffres sont piégés : une plaque de pression centrale déclenche de la TNT qui détruit coffres et butin."),
 dict(id='jungle_pyramid', name='Temple de la jungle', dim=OW, icon='Vines', biomes=['Jungle', 'Jungle de bambous'], locate=['jungle_pyramid'], tips=[],
      desc="Structure de pierre envahie par la végétation, avec deux coffres : l'un piégé par deux distributeurs de flèches, l'autre caché derrière un puzzle de leviers."),
 dict(id='igloo', name='Igloo', dim=OW, icon='Snowball', biomes=['Plaines enneigées', 'Taïga enneigée', 'Pentes enneigées'], locate=['igloo'], tips=[],
      desc="Bâtiment de neige pouvant avoir un sous-sol caché sous un tapis blanc : un villageois et un zombie villageois captifs derrière des barreaux, avec de quoi guérir le zombie."),
 dict(id='swamp_hut', name='Cabane de sorcière', dim=OW, icon='Water Bottle', biomes=['Marais'], locate=['swamp_hut'], tips=[],
      desc="Petite cabane en bois sur pilotis, avec un chaudron contenant une potion aléatoire et une table de craft. Une sorcière et un chat noir y apparaissent. Pas de coffre."),
 dict(id='pillager_outpost', name='Avant-poste de pillards', dim=OW, icon='Crossbow',
      biomes=['Plaines', 'Désert', 'Savane', 'Taïga', 'Plaines enneigées', 'Bosquet (Grove)', 'Prairie (Meadow)', 'Cerisaie (Cherry Grove)', 'Pics de montagne', 'Pentes enneigées', 'Taïga enneigée'],
      locate=['pillager_outpost'], tips=[],
      desc="Ensemble de structures où apparaissent des pillards. La tour de guet, en bois et pierre, a un coffre à son dernier étage."),
 dict(id='woodland_mansion', name='Manoir', dim=OW, icon='Totem of Undying', biomes=['Forêt sombre', 'Jardin pâle (Pale Garden)'], locate=['mansion'],
      tips=["Le cartographe vend une carte de manoir (niveau Maître)."],
      desc="Immense bâtiment en chêne noir sur fondation de pierre : nombreuses pièces (certaines cachées) et coffres sur trois étages, habité par des vindicateurs et des évocateurs."),
 dict(id='mineshaft', name='Mine abandonnée', dim=OW, icon='Powered Rail', biomes=[ALL_OW], locate=['mineshaft', 'mineshaft_mesa'], tips=[],
      desc="Labyrinthe de couloirs soutenus par des barrières de chêne, avec des rails incomplets où peuvent apparaître des wagonnets avec coffre, et des spawners d'araignées des cavernes entourés de toiles. Dans les badlands, elle est en chêne noir."),
 dict(id='stronghold', name='Forteresse (stronghold)', dim=OW, icon='Eye of Ender', biomes=["Tous les biomes de l'Overworld"], locate=['stronghold'],
      tips=["Lance un œil de l'Ender : il vole vers la forteresse la plus proche."],
      desc="Labyrinthe souterrain de salles spécialisées : bibliothèques, cellules, réserves, et la salle du portail, seule porte vers l'End."),
 dict(id='ancient_city', name='Cité antique', dim=OW, icon='Echo Shard', biomes=['Deep Dark (obscurité profonde)'], locate=['ancient_city'], tips=[],
      desc="Longs couloirs de deepslate et de laine menant à un bâtiment central en deepslate renforcé qui ressemble à un portail. De petites ruines alentour contiennent des coffres."),
 dict(id='trial_chambers', name="Chambres d'épreuves", dim=OW, icon='Trial Key', biomes=[ALL_OW], locate=['trial_chambers'],
      tips=["Le cartographe vend une carte des chambres d'épreuves (niveau Compagnon)."],
      desc="Grande structure souterraine en cuivre et tuf, avec des générateurs d'épreuves et des vaults dans des salles de combat. Seul endroit où l'on trouve la brise, et le cœur lourd (dans les vaults)."),
 dict(id='trail_ruins', name='Ruines de sentier', dim=OW, icon='Archer Pottery Sherd',
      biomes=['Jungle', 'Forêt de bouleaux ancienne', 'Taïga de pins anciens', 'Taïga d\'épicéas anciens', 'Taïga enneigée', 'Taïga'], locate=['trail_ruins'], tips=[],
      desc="Groupe de bâtiments en ruine enterrés, dont seule la pointe de la tour dépasse. Contient du gravier suspect à fouiller au pinceau."),
 dict(id='abandoned_camp', name='Camp abandonné', dim=OW, icon='Torch',
      biomes=['Prairie', 'Marais', 'Savane', 'Cerisaie', 'Forêt', 'Forêt de bouleaux', 'Forêt de bouleaux ancienne', 'Forêt fleurie', 'Forêt venteuse', 'Forêt tachetée (Dappled Forest)',
              'Taïga', 'Taïga enneigée', "Taïga d'épicéas ancienne", 'Taïga de pins ancienne', 'Jungle clairsemée', 'Jungle de bambous', 'Badlands boisés', 'Jardin pâle (Pale Garden)'],
      locate=[], tips=["Un camp contient des cartes de camp (voir les butins)."],
      desc="Petite tente remplie d'objets : statues de golem de cuivre oxydé, établi, chaudron, lits de paille. Faite d'escaliers et de barrières de laine, elle change d'apparence selon le biome. Tonneaux et coffres."),
 dict(id='ocean_monument', name='Monument océanique', dim=OW, icon='Prismarine Crystals', biomes=['Océans profonds (normal, froid, gelé, tiède)'], locate=['monument'],
      tips=["Le cartographe vend une carte de monument océanique (niveau Compagnon)."],
      desc="Immense temple de prismarine gardé par des gardiens et trois grands gardiens. Éponges humides et huit blocs d'or. Pas de coffre."),
 dict(id='ocean_ruins', name='Ruines océaniques', dim=OW, icon='Sea Pickle', biomes=[OCEANS], locate=['ocean_ruin_cold', 'ocean_ruin_warm'], tips=[],
      desc="Petites structures de briques de pierre (eaux froides) ou de grès (eaux chaudes). Des noyés peuvent y apparaître. Coffres, sable et gravier suspects."),
 dict(id='shipwreck', name='Épave', dim=OW, icon='Boat', biomes=[OCEANS, 'Plage', 'Plage enneigée'], locate=['shipwreck', 'shipwreck_beached'],
      tips=["Le coffre à carte contient une carte au trésor : elle mène à un trésor enterré."],
      desc="Structure en bois évoquant un navire coulé, avec jusqu'à trois coffres. Peut aussi se trouver sur terre."),
 dict(id='buried_treasure', name='Trésor enterré', dim=OW, icon='Heart of the Sea', biomes=['Plage', 'Plage enneigée', 'Rivage rocheux (Stony Shore)'], locate=['buried_treasure'],
      tips=["Se trouve avec une carte au trésor prise dans une épave ou, parfois, des ruines océaniques."],
      desc="Coffre caché dans un biome côtier. Il contient toujours un cœur de l'océan."),
 dict(id='ruined_portal', name='Portail en ruine', dim='Overworld et Nether', icon='Crying Obsidian', biomes=[ALL_OW, 'Tous les biomes du Nether'],
      locate=['ruined_portal', 'ruined_portal_desert', 'ruined_portal_jungle', 'ruined_portal_mountain', 'ruined_portal_nether', 'ruined_portal_ocean', 'ruined_portal_swamp'], tips=[],
      desc="Portail du Nether incomplet, en matériaux variés (pierre dans l'Overworld, pierre noire dans le Nether). Un coffre et quelques blocs d'or."),
 dict(id='monster_room', name='Donjon (monster room)', dim=OW, icon='Bone', biomes=['Sous terre'], locate=[], tips=[],
      desc="Petite salle souterraine avec un spawner de monstres et des coffres."),
 dict(id='nether_fortress', name='Forteresse du Nether', dim=NE, icon='Nether Wart', biomes=['Tous les biomes du Nether'], locate=['fortress'], tips=[],
      desc="Châteaux de briques du Nether avec des spawners de blazes et des fermes de verrues. Seul endroit où apparaissent les squelettes wither et les blazes. Coffres dans certains couloirs."),
 dict(id='bastion_remnant', name='Bastion', dim=NE, icon='Gilded Blackstone', biomes=['Désert du Nether (Nether Wastes)', 'Forêt carmin', 'Forêt tordue', 'Vallée des âmes'], locate=['bastion_remnant'], tips=[],
      desc="Énormes bastions de pierre noire habités par des piglins et des brutes. Quatre types : ponts, quartiers d'habitation, étables à hoglins, salles au trésor. Beaucoup de blocs d'or."),
 dict(id='nether_fossil', name='Fossile du Nether', dim=NE, icon='Bone Block', biomes=['Vallée des âmes'], locate=['nether_fossil'], tips=[],
      desc="Fossiles faits uniquement de blocs d'os. Des ghasts desséchés peuvent apparaître à proximité. Pas de coffre."),
 dict(id='end_city', name="Cité de l'End", dim=EN, icon='Elytra', biomes=["Terres intermédiaires de l'End", "Hautes terres de l'End"], locate=['end_city'], tips=[],
      desc="Tours de purpur, de briques d'End stone et de verre magenta, gardées par des shulkers. Coffres de butin, et parfois un vaisseau avec des élytres."),
]

# ---------------------------------------------------------------------------
# Noms des conteneurs de butin (id de coffre du wiki -> libellé)
CONT = {
 'ancient-city': 'Coffres de la cité', 'ancient-city-ice-box': 'Glacières',
 'trial-chambers-reward': 'Vaults (récompenses)', 'trial-chambers-reward-ominous': 'Vaults sinistres', 'trial-chambers-entrance': "Coffres d'entrée",
 'trial-chambers-intersection': "Coffres d'intersection", 'trial-chambers-supply': 'Coffres de ravitaillement', 'trial-chambers-intersection-barrel': "Tonneaux d'intersection",
 'trial-chambers-corridor': 'Tonneaux de couloir', 'trial-chambers-corridor-pot': 'Pots décorés', 'trial-chambers-chamber-dispenser': 'Distributeur de salle',
 'trial-chambers-corridor-dispenser': 'Distributeur de couloir', 'trial-chambers-water-dispenser': "Distributeur d'eau",
 'trial-chambers-trial-spawner': "Générateur d'épreuve", 'trial-chambers-trial-spawner-ominous': "Générateur d'épreuve sinistre",
 'brushable-trail-ruins': 'Gravier suspect (commun)', 'brushable-trail-ruins-rare': 'Gravier suspect (rare)',
 'stronghold-altar': 'Autels', 'stronghold-storeroom': 'Réserves', 'stronghold-library': 'Bibliothèques',
 'mineshaft': 'Wagonnets avec coffre', 'sulfur-cave-mineshaft': 'Mine des grottes de soufre', 'buried-treasure': 'Coffre au trésor',
 'desert-temple': 'Coffres', 'brushable-desert-temple': 'Sable suspect', 'igloo': 'Coffre du sous-sol', 'jungle-temple': 'Coffres', 'jungle-temple-dispenser': 'Distributeurs',
 'pillager-outpost': 'Coffre de la tour', 'woodland-mansion': 'Coffres',
 'village-armorer': "Maison de l'armurier", 'village-butcher': 'Boucherie', 'village-cartographer': 'Maison du cartographe', 'village-fisherman': 'Chaumière du pêcheur',
 'village-fletcher': "Maison de l'archer", 'village-mason': 'Maison du maçon', 'village-shepherd': 'Maison du berger', 'village-tannery': 'Tannerie', 'village-temple': 'Église',
 'village-toolsmith': "Forge d'outils", 'village-weaponsmith': "Forge d'armes", 'village-desert-house': 'Maison du désert', 'village-plains-house': 'Maison des plaines',
 'village-savanna-house': 'Maison de savane', 'village-snowy-house': 'Maison enneigée', 'village-taiga-house': 'Maison de taïga',
 'abandoned-camp-barrel': 'Tonneaux', 'abandoned-camp-common-chest': 'Coffres communs', 'abandoned-camp-secret-chest': 'Coffres secrets',
 'underwater-ruin-big': 'Grandes ruines', 'underwater-ruin-small': 'Petites ruines',
 'brushable-cold-ocean-ruins': 'Gravier suspect', 'brushable-warm-ocean-ruins': 'Sable suspect',
 'shipwreck-supply': 'Coffres de ravitaillement', 'shipwreck-treasure': 'Coffres au trésor', 'shipwreck-map': 'Coffres à carte',
 'ruined-portal': 'Coffre', 'nether-fortress': 'Coffres', 'bastion-bridge': 'Pont', 'bastion-generic': 'Quartiers', 'bastion-hoglin-stable': 'Étable à hoglins',
 'bastion-treasure': 'Salle au trésor', 'end-city': 'Coffres', 'monster room': 'Coffre du donjon',
}

# ---------------------------------------------------------------------------
# Notes des lignes de butin (traduites ; les formules du wiki sont résumées)
ENCH = {'Breach': 'Brèche', 'Density': 'Densité', 'Knockback': 'Recul', 'Punch': 'Frappe', 'Smite': 'Châtiment', 'Looting': 'Butin', 'Multishot': 'Tir multiple',
        'Mending': 'Raccommodage', 'Riptide': 'Impulsion', 'Loyalty': 'Loyauté', 'Channeling': 'Canalisation', 'Impaling': 'Empalement', 'Sharpness': 'Tranchant',
        'Bane of Arthropods': 'Fléau des arthropodes', 'Efficiency': 'Efficacité', 'Fortune': 'Fortune', 'Silk Touch': 'Toucher de soie', 'Feather Falling': 'Chute amortie',
        'Soul Speed': 'Agilité des âmes', 'Swift Sneak': 'Furtivité rapide', 'Wind Burst': 'Rafale'}
def fr_note(n):
    m = re.match(r'Enchanted with a random level of (.+?)\.?$', n)
    if m:
        names = [x.strip() for x in re.split(r',\s*(?:or\s+)?|\s+or\s+', m.group(1)) if x.strip()]
        return 'Enchanté avec ' + ' ou '.join(ENCH.get(x, x) for x in names) + ' (niveau aléatoire).'
    m = re.match(r'Enchanted with level I of Wind Burst', n)
    if m: return 'Enchanté avec Rafale I.'
    if n.startswith('All enchantments are equally probable'):
        return "Tous les enchantements sont équiprobables (trésors inclus, sauf Agilité des âmes, Furtivité rapide et Rafale), à n'importe quel niveau."
    m = re.search(r'level-(\d+)(?: to level-(\d+))? enchantment', n)
    if n.startswith('Enchantment probabilities') and m:
        lv = f"{m.group(1)} à {m.group(2)}" if m.group(2) else m.group(1)
        return f"Enchantement comme un niveau {lv} d'une table d'enchantement (trésors inclus, sauf Agilité des âmes, Furtivité rapide et Rafale)."
    m = re.search(r'between (\d+)% and (\d+)% of its total durability', n)
    if m: return f"Objet avec {m.group(1)} à {m.group(2)} % de sa durabilité."
    if 'goat horn variants' in n: return "Hors cornes des chèvres hurlantes."
    if n.startswith('If a target cannot be found'): return "Si aucune cible n'est trouvée à distance raisonnable, la carte n'est pas donnée."
    if n.startswith('This map will not generate'): return "Cette carte ne se génère pas dans le biome qu'elle indique ; sans cible trouvée, elle n'est pas donnée."
    if n.startswith('Ominous bottle level between'):
        return 'Niveau ' + n.replace('Ominous bottle level between ', '').replace(' and ', ' à ') + '.'
    if n.startswith('The stew grants'): return "Le ragoût donne un effet aléatoire (cécité, vision nocturne, saut amélioré, poison, saturation ou faiblesse selon l'objet)."
    return None

# ---------------------------------------------------------------------------
icons_dir = out + '/assets/item-icons'
os.makedirs(icons_dir, exist_ok=True)
slug = lambda n: re.sub(r'[^a-z0-9]+', '_', n.lower().replace("'", '')).strip('_')
copied, missing = {}, set()
def icon(name):
    key = slug(C['icon_base'](name))
    if key in copied: return copied[key]
    src = resolve(name)
    if not src:
        missing.add(name); copied[key] = None; return None
    dst = f'{icons_dir}/{key}.png'
    if not os.path.exists(dst): shutil.copyfile(src, dst)
    copied[key] = key
    return key

SDICT = {s['id']: s for s in S}
result, unknown_cont = [], set()
for s in S:
    conts = []
    for c in raw['loot'].get(s['id'], []):
        label = CONT.get(c['chest'])
        if not label:
            unknown_cont.add(c['chest']); label = c['chest']
        if s['id'] == 'ocean_ruins':
            label = ('Ruines froides · ' if 'Cold' in c['page'] else 'Ruines chaudes · ') + label
        rows = []
        for r in c['rows']:
            notes = [x for x in (fr_note(n) for n in r['notes']) if x]
            row = {'name': fr_item(r['item']), 'icon': icon(r['item']), 'qty': r['qty'].replace('–', '–'), 'chance': r['chance']}
            if notes: row['notes'] = notes
            rows.append(row)
        rows.sort(key=lambda x: -float(x['chance'].rstrip('%').replace(',', '.')))
        conts.append({'name': label, 'rows': rows})
    result.append({'id': s['id'], 'name': s['name'], 'dim': s['dim'], 'icon': icon(s['icon']), 'biomes': s['biomes'],
                   'locate': s['locate'], 'tips': s['tips'], 'desc': s['desc'], 'containers': conts})

js = ('/* Généré par tools/build_structures.py (butins : minecraft.wiki, Java Edition). Ne pas éditer à la main. */\n'
      'window.MC_STRUCTURES = ' + json.dumps(result, ensure_ascii=False, separators=(',', ':')) + ';\n')
open(out + '/js/structures-data.js', 'w', encoding='utf-8').write(js)
n_rows = sum(len(c['rows']) for s in result for c in s['containers'])
print(len(result), 'structures,', sum(len(s['containers']) for s in result), 'conteneurs,', n_rows, 'lignes de butin')
print('sans icône :', sorted(missing))
print('conteneurs sans libellé :', sorted(unknown_cont))
