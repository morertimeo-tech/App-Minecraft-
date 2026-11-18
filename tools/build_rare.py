#!/usr/bin/env python3
"""Génère js/rare-data.js : les objets et blocs les plus rares du jeu.

Usage : python3 -I tools/build_rare.py PACK_26_1_DIR OUT_REPO_DIR

Chaque entrée vient de la page wiki de l'objet (minecraft.wiki, Java Edition) :
  - tier  = « Rarity » de l'infobox (couleur du nom dans le jeu : Épique, Rare, Peu commun)
  - renew = « Renewable » de l'infobox
  - sources manuelles = taux de drop / conditions lus sur la page de l'objet
  - loot  = noms d'objets dont les coffres sont calculés dans l'app depuis les données
            de structures (js/structures-data.js), pour rester cohérent avec l'onglet Structures.
Les noms français sont écrits de mémoire.
"""
import json, os, re, runpy, shutil, sys

pack, out = sys.argv[1:3]
HERE = os.path.dirname(os.path.abspath(__file__))
C = runpy.run_path(os.path.join(HERE, 'common.py'))
resolve = C['make_resolver'](pack)

EPIC, RARE, UNC, NONE = 'Épique', 'Rare', 'Peu commun', None

def E(name, en, kind, tier, renew, sources=(), loot=(), note=None, icon=None):
    return dict(name=name, en=en, kind=kind, tier=tier, renew=renew, sources=list(sources), loot=list(loot), note=note, icon=icon or en)

ENTRIES = [
 # ---- Épique -------------------------------------------------------------
 E('Œuf de dragon', 'Dragon Egg', 'Bloc', EPIC, 'Non',
   [dict(where="Vaincre l'Ender Dragon", note="Une seule fois par monde (deux fois en Bedrock). Il se téléporte pour éviter d'être miné.")]),
 E('Élytres', 'Elytra', 'Objet', EPIC, 'Non',
   [dict(where="Vaisseau de l'End (cité de l'End, îles extérieures)", note="Dans un cadre de la salle au trésor ; un shulker garde l'élytre et les deux coffres du vaisseau.")]),
 E('Tête de dragon', 'Dragon Head', 'Bloc', EPIC, 'Non',
   [dict(where="Proue d'un vaisseau de l'End (cité de l'End)", note="Seule source dans le jeu.")], icon='Dragon Head'),
 E('Cœur lourd', 'Heavy Core', 'Bloc', EPIC, 'Non (sauf vault sinistre)', loot=['Cœur lourd'],
   note="Sert à fabriquer une masse avec une verge de brise."),
 E('Modèle de forge : Silence', 'Silence Armor Trim', 'Objet', EPIC, 'Non', loot=['Modèle de forge : Silence']),
 # ---- Rare ---------------------------------------------------------------
 E('Pomme dorée enchantée', 'Golden Apple', 'Objet', RARE, 'Non (sauf vault sinistre)', loot=['Pomme dorée enchantée'],
   note="Ne se fabrique plus : on ne la trouve que dans des coffres.", icon='Enchanted Golden Apple'),
 E('Trident', 'Trident', 'Objet', RARE, 'Oui',
   [dict(where='Noyé armé d\'un trident', chance='6,25 %', note="6,25 % des noyés apparaissent avec un trident. Tué par un joueur ou un loup apprivoisé, il le lâche dans 8,5 % des cas (Java), +1 % par niveau de Butin.")],
   loot=['Trident']),
 E('Étoile du Nether', 'Nether Star', 'Objet', RARE, 'Oui',
   [dict(where='Wither (boss à invoquer)', chance='100 %', note="Toujours 1 à sa mort.")]),
 E('Balise', 'Beacon', 'Bloc', RARE, 'Oui',
   [dict(where='Fabrication', note="Verre, étoile du Nether et obsidienne.")]),
 E('Disque : Pigstep', 'Music Disc (Pigstep)', 'Objet', RARE, None, loot=['Disque : Pigstep']),
 E('Disque : Otherside', 'Music Disc (otherside)', 'Objet', RARE, None, loot=['Disque : otherside']),
 E('Disque : Creator', 'Music Disc (Creator)', 'Objet', RARE, None, loot=['Disque : Creator']),
 E('Modèle de forge : Ward', 'Ward Armor Trim', 'Objet', RARE, 'Non', loot=['Modèle de forge : Ward']),
 E('Modèle de forge : Eye', 'Eye Armor Trim', 'Objet', RARE, 'Non (sauf vault)', loot=['Modèle de forge : Eye']),
 E('Modèle de forge : Vex', 'Vex Armor Trim', 'Objet', RARE, 'Non (sauf vault)', loot=['Modèle de forge : Vex']),
 E('Modèle de forge : Spire', 'Spire Armor Trim', 'Objet', RARE, 'Non (sauf vault)', loot=['Modèle de forge : Spire']),
 # ---- Peu commun ---------------------------------------------------------
 E("Modèle d'amélioration en netherite", 'Netherite Upgrade', 'Objet', UNC, 'Non', loot=['Amélioration en netherite'],
   note="Indispensable pour passer un équipement en diamant à la netherite."),
 E("Cœur de l'océan", 'Heart of the Sea', 'Objet', UNC, 'Non',
   [dict(where='Carte au trésor', note="La carte, trouvée dans les épaves et parfois les ruines océaniques, marque le coffre d'une croix rouge.")],
   loot=["Cœur de l'océan"]),
 E('Coquille de nautile', 'Nautilus Shell', 'Objet', UNC, 'Oui',
   [dict(where='Noyé', chance='3 %', note="3 % des noyés apparaissent avec une coquille de nautile (Java) et la lâchent toujours à leur mort.")]),
 E('Œuf de renifleur', 'Sniffer Egg', 'Bloc', UNC, 'Oui',
   [dict(where='Élevage de deux renifleurs', note="Avec des graines de fleur-torche.")],
   loot=['Œuf de renifleur']),
 E("Totem d'immortalité", 'Totem of Undying', 'Objet', UNC, 'Oui',
   [dict(where='Évocateur (manoir, raids)', chance='100 %', note="Chaque évocateur en lâche toujours un, sans effet de Butin.")]),
 E('Disque : Relic', 'Music Disc (Relic)', 'Objet', UNC, None, loot=['Disque : Relic']),
 # ---- Rareté non indiquée par le jeu -------------------------------------
 E('Débris antiques', 'Ancient Debris', 'Bloc', NONE, 'Non',
   [dict(where='Nether, surtout entre y 8 et 24', note="Minerai « très rare » selon le wiki ; plus fréquent à y 16. À fondre pour la netherite.")]),
 E('Crâne de squelette wither', 'Wither Skeleton Skull', 'Objet', NONE, None,
   [dict(where='Squelette wither (forteresse du Nether)', chance='2,5 %', note="3,5 % / 4,5 % / 5,5 % avec Butin I / II / III. Sert à invoquer le Wither.")]),
 E('Rose de wither', 'Wither Rose', 'Bloc', NONE, 'Oui',
   [dict(where='Mort causée par un wither', note="Se laisse quand un mob ou un joueur est tué par le Wither.")]),
 E('Carapace de shulker', 'Shulker Shell', 'Objet', NONE, None,
   [dict(where="Shulker (cités de l'End)", chance='50 %', note="Seule source de carapaces, pour fabriquer des boîtes de shulker. Augmente avec Butin.")]),
]

icons_dir = out + '/assets/item-icons'
os.makedirs(icons_dir, exist_ok=True)
slug = lambda n: re.sub(r'[^a-z0-9]+', '_', n.lower().replace("'", '')).strip('_')
missing = []
def icon(name):
    key = slug(C['icon_base'](name))
    src = resolve(name)
    if not src:
        missing.append(name); return None
    dst = f'{icons_dir}/{key}.png'
    if not os.path.exists(dst): shutil.copyfile(src, dst)
    return key

res = []
for e in ENTRIES:
    d = {k: e[k] for k in ('name', 'kind', 'tier', 'renew', 'sources', 'loot', 'note')}
    d['icon'] = icon(e['icon'])
    res.append(d)

js = ('/* Généré par tools/build_rare.py (minecraft.wiki, Java Edition). Ne pas éditer à la main. */\n'
      'window.MC_RARE = ' + json.dumps(res, ensure_ascii=False, separators=(',', ':')) + ';\n')
open(out + '/js/rare-data.js', 'w', encoding='utf-8').write(js)
print(len(res), 'entrées ; sans icône :', missing)
