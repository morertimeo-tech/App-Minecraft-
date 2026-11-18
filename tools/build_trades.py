#!/usr/bin/env python3
"""Génère js/trades-data.js à partir de trades.json (tools/extract_trades.py).

Usage : python3 -I tools/build_trades.py trades.json PACK_26_1_DIR OUT_REPO_DIR
  - traduit noms / niveaux / notes en français
  - résout une texture par objet dans le pack (items/ puis blocks/) et la copie dans
    OUT_REPO_DIR/assets/trade-icons/<slug>.png
Les noms français sont écrits de mémoire (la source wiki est en anglais).
"""
import json, os, re, shutil, sys

trades_json, pack, out = sys.argv[1:4]

FR = {
 'Acacia Log': "Bûche d'acacia", 'Acacia Sapling': "Pousse d'acacia", 'Allium': "Ail d'ornement", 'Andesite': 'Andésite',
 'Any color Banner': 'Bannière (couleur au choix)', 'Any color Bed': 'Lit (couleur au choix)', 'Any color Carpet': 'Tapis (couleur au choix)',
 'Any color Glazed Terracotta': 'Terre cuite émaillée (couleur au choix)', 'Any color Stained Terracotta': 'Terre cuite teintée (couleur au choix)',
 'Any color Wool': 'Laine (couleur au choix)', 'Apple': 'Pomme', 'Arrow': 'Flèche', 'Azure Bluet': 'Houstonie', 'Baked Potato': 'Pomme de terre cuite',
 'Banner': 'Bannière', 'Beetroot': 'Betterave', 'Beetroot Seeds': 'Graines de betterave', 'Bell': 'Cloche', 'Birch Log': 'Bûche de bouleau',
 'Birch Sapling': 'Pousse de bouleau', 'Black Dye': 'Teinture noire', 'Black Wool': 'Laine noire', 'Block of Quartz': 'Bloc de quartz',
 'Blue Dye': 'Teinture bleue', 'Blue Ice': 'Glace bleue', 'Blue Orchid': 'Orchidée bleue', 'Boat': 'Bateau', 'Book': 'Livre',
 'Book and Quill': 'Livre et plume', 'Bookshelf': 'Bibliothèque', "Bottle o' Enchanting": "Fiole d'expérience", 'Bow': 'Arc',
 'Brain Coral Block': 'Bloc de corail cérébral', 'Bread': 'Pain', 'Brick': 'Brique', 'Brown Dye': 'Teinture marron',
 'Brown Mushroom': 'Champignon marron', 'Brown Wool': 'Laine marron', 'Bubble Coral Block': 'Bloc de corail bulle',
 'Bucket of Cod': 'Seau de morue', 'Bucket of Pufferfish': 'Seau de poisson-globe', 'Bucket of Tropical Fish': 'Seau de poisson tropical',
 "Buried Trial Chambers Map": "Carte des chambres d'épreuves", 'Cactus': 'Cactus', 'Cake': 'Gâteau', 'Campfire': 'Feu de camp', 'Carrot': 'Carotte',
 'Chainmail Boots': 'Bottes en mailles', 'Chainmail Chestplate': 'Plastron en mailles', 'Chainmail Helmet': 'Casque en mailles',
 'Chainmail Leggings': 'Jambières en mailles', 'Cherry Log': 'Bûche de cerisier', 'Cherry Sapling': 'Pousse de cerisier',
 'Chiseled Stone Bricks': 'Briques de pierre ciselées', 'Clay Ball': "Boule d'argile", 'Clock': 'Horloge', 'Coal': 'Charbon', 'Compass': 'Boussole',
 'Cooked Chicken': 'Poulet cuit', 'Cooked Cod': 'Morue cuite', 'Cooked Porkchop': 'Côtelette de porc cuite', 'Cooked Salmon': 'Saumon cuit',
 'Cookie': 'Cookie', 'Cornflower': 'Bleuet', 'Crossbow': 'Arbalète', 'Cyan Dye': 'Teinture cyan', 'Dandelion': 'Pissenlit',
 'Dark Oak Log': 'Bûche de chêne noir', 'Dark Oak Sapling': 'Pousse de chêne noir', 'Diamond': 'Diamant', 'Diamond Hoe': 'Houe en diamant',
 'Diorite': 'Diorite', 'Dried Kelp Block': 'Bloc de varech séché', 'Dripstone Block': 'Bloc de dripstone', 'Emerald': 'Émeraude',
 'Empty Map': 'Carte vide', 'Enchanted Book': 'Livre enchanté', 'Enchanted Bow': 'Arc enchanté', 'Enchanted Crossbow': 'Arbalète enchantée',
 'Enchanted Diamond Axe': 'Hache en diamant enchantée', 'Enchanted Diamond Boots': 'Bottes en diamant enchantées',
 'Enchanted Diamond Chestplate': 'Plastron en diamant enchanté', 'Enchanted Diamond Helmet': 'Casque en diamant enchanté',
 'Enchanted Diamond Leggings': 'Jambières en diamant enchantées', 'Enchanted Diamond Pickaxe': 'Pioche en diamant enchantée',
 'Enchanted Diamond Shovel': 'Pelle en diamant enchantée', 'Enchanted Diamond Sword': 'Épée en diamant enchantée',
 'Enchanted Fishing Rod': 'Canne à pêche enchantée', 'Enchanted Iron Axe': 'Hache en fer enchantée', 'Enchanted Iron Pickaxe': 'Pioche en fer enchantée',
 'Enchanted Iron Shovel': 'Pelle en fer enchantée', 'Enchanted Iron Sword': 'Épée en fer enchantée', 'Ender Pearl': "Perle de l'Ender",
 'Feather': 'Plume', 'Fermented Spider Eye': "Œil d'araignée fermenté", 'Fern': 'Fougère', 'Fire Coral Block': 'Bloc de corail de feu',
 'Firefly Bush': 'Buisson à lucioles', 'Flint': 'Silex', 'Glass': 'Verre', 'Glass Bottle': 'Fiole en verre', 'Glass Pane': 'Vitre',
 'Glistering Melon Slice': 'Tranche de pastèque scintillante', 'Globe Banner Pattern': 'Motif de bannière globe', 'Glowstone': 'Pierre lumineuse',
 'Gold Ingot': "Lingot d'or", 'Golden Carrot': 'Carotte dorée', 'Golden Dandelion': 'Pissenlit doré', 'Granite': 'Granite', 'Gravel': 'Gravier',
 'Gray Dye': 'Teinture grise', 'Gray Wool': 'Laine grise', 'Green Dye': 'Teinture verte', 'Gunpowder': 'Poudre à canon', 'Hay Bale': 'Botte de foin',
 'Horn Coral Block': 'Bloc de corail corne', 'Ink Sac': "Poche d'encre", 'Iron Axe': 'Hache en fer', 'Iron Boots': 'Bottes en fer',
 'Iron Chestplate': 'Plastron en fer', 'Iron Helmet': 'Casque en fer', 'Iron Ingot': 'Lingot de fer', 'Iron Leggings': 'Jambières en fer',
 'Item Frame': 'Cadre', 'Jungle Log': "Bûche d'acajou", 'Jungle Sapling': "Pousse d'acajou", 'Kelp': 'Varech', 'Lantern': 'Lanterne',
 'Lapis Lazuli': 'Lapis-lazuli', 'Lava Bucket': 'Seau de lave', 'Leather': 'Cuir', 'Leather Boots': 'Bottes en cuir', 'Leather Cap': 'Casque en cuir',
 'Leather Horse Armor': 'Armure en cuir pour cheval', 'Leather Pants': 'Jambières en cuir', 'Leather Tunic': 'Tunique en cuir',
 'Light Blue Dye': 'Teinture bleu clair', 'Light Gray Dye': 'Teinture gris clair', 'Lily Pad': 'Nénuphar', 'Lily of the Valley': 'Muguet',
 'Lime Dye': 'Teinture vert clair', 'Magenta Dye': 'Teinture magenta', 'Mangrove Log': 'Bûche de palétuvier', 'Mangrove Propagule': 'Propagule de palétuvier',
 'Melon': 'Pastèque', 'Melon Seeds': 'Graines de pastèque', 'Milk Bucket': 'Seau de lait', 'Moss Block': 'Bloc de mousse', 'Name Tag': 'Étiquette',
 'Nautilus Shell': 'Coquille de nautile', 'Nether Quartz': 'Quartz du Nether', 'Nether Wart': 'Verrue du Nether', 'Oak Log': 'Bûche de chêne',
 'Oak Sapling': 'Pousse de chêne', 'Ocean Monument Map': 'Carte de monument océanique', 'Open Eyeblossom': 'Œil-fleur ouvert',
 'Orange Dye': 'Teinture orange', 'Orange Tulip': 'Tulipe orange', 'Oxeye Daisy': 'Marguerite', 'Packed Ice': 'Glace compacte',
 'Painting': 'Peinture', 'Pale Hanging Moss': 'Mousse pâle suspendue', 'Pale Moss Block': 'Bloc de mousse pâle', 'Pale Oak Log': 'Bûche de chêne pâle',
 'Pale Oak Sapling': 'Pousse de chêne pâle', 'Paper': 'Papier', 'Pink Dye': 'Teinture rose', 'Pink Tulip': 'Tulipe rose', 'Podzol': 'Podzol',
 'Pointed Dripstone': 'Dripstone pointue', 'Polished Andesite': 'Andésite polie', 'Polished Diorite': 'Diorite polie', 'Polished Granite': 'Granite poli',
 'Poplar Log': 'Bûche de peuplier', 'Poplar Sapling': 'Pousse de peuplier', 'Poppy': 'Coquelicot', 'Potato': 'Pomme de terre',
 'Potion of Invisibility': "Potion d'invisibilité", 'Pufferfish': 'Poisson-globe', 'Pumpkin': 'Citrouille', 'Pumpkin Pie': 'Tarte à la citrouille',
 'Pumpkin Seeds': 'Graines de citrouille', 'Purple Dye': 'Teinture violette', 'Quartz Pillar': 'Pilier de quartz', 'Rabbit Hide': 'Peau de lapin',
 'Rabbit Stew': 'Ragoût de lapin', "Rabbit's Foot": 'Patte de lapin', 'Raw Beef': 'Bœuf cru', 'Raw Chicken': 'Poulet cru', 'Raw Cod': 'Morue crue',
 'Raw Mutton': 'Mouton cru', 'Raw Porkchop': 'Côtelette de porc crue', 'Raw Rabbit': 'Lapin cru', 'Raw Salmon': 'Saumon cru',
 'Red Candle': 'Bougie rouge', 'Red Dye': 'Teinture rouge', 'Red Mushroom': 'Champignon rouge', 'Red Sand': 'Sable rouge', 'Red Tulip': 'Tulipe rouge',
 'Redstone Dust': 'Poudre de redstone', 'Rooted Dirt': 'Terre racinée', 'Rotten Flesh': 'Chair putréfiée', 'Saddle': 'Selle', 'Sand': 'Sable',
 'Sea Pickle': 'Cornichon de mer', 'Shears': 'Cisailles', 'Shelf Mushroom': 'Champignon-étagère', 'Shield': 'Bouclier', 'Slimeball': 'Boule de slime',
 'Small Dripleaf': 'Petite dripleaf', 'Spruce Log': 'Bûche de sapin', 'Spruce Sapling': 'Pousse de sapin', 'Stick': 'Bâton', 'Stone': 'Pierre',
 'Stone Axe': 'Hache en pierre', 'Stone Hoe': 'Houe en pierre', 'Stone Pickaxe': 'Pioche en pierre', 'Stone Shovel': 'Pelle en pierre',
 'String': 'Ficelle', 'Sugar Cane': 'Canne à sucre', 'Sulfur Spike': 'Pointe de soufre', 'Suspicious Stew': 'Ragoût suspect',
 'Sweet Berries': 'Baies sucrées', 'Tall Dry Grass': 'Hautes herbes sèches', 'Tipped Arrow': 'Flèche à effet', 'Tripwire Hook': 'Crochet de fil',
 'Tropical Fish': 'Poisson tropical', 'Tube Coral Block': 'Bloc de corail tubulaire', 'Turtle Scute': 'Écaille de tortue', 'Village Map': 'Carte de village',
 'Vines': 'Lianes', 'Water Bottle': "Fiole d'eau", 'Water Bucket': "Seau d'eau", 'Wheat': 'Blé', 'Wheat Seeds': 'Graines de blé',
 'White Dye': 'Teinture blanche', 'White Tulip': 'Tulipe blanche', 'White Wool': 'Laine blanche', 'Wildflowers': 'Fleurs sauvages',
 'Woodland Mansion Map': 'Carte de manoir', 'Yellow Candle': 'Bougie jaune', 'Yellow Dye': 'Teinture jaune',
}

PROF = {
 'Armorer': ('Armurier', 'Iron Chestplate'), 'Butcher': ('Boucher', 'Raw Beef'), 'Cartographer': ('Cartographe', 'Empty Map'),
 'Cleric': ('Clerc', "Bottle o' Enchanting"), 'Farmer': ('Fermier', 'Wheat'), 'Fisherman': ('Pêcheur', 'Raw Cod'),
 'Fletcher': ('Archer', 'Arrow'), 'Leatherworker': ('Tanneur', 'Leather'), 'Librarian': ('Bibliothécaire', 'Book'),
 'Mason': ('Maçon', 'Brick'), 'Shepherd': ('Berger', 'White Wool'), 'Toolsmith': ("Forgeron d'outils", 'Enchanted Diamond Pickaxe'),
 'Weaponsmith': ("Forgeron d'armes", 'Enchanted Iron Sword'), 'Wandering Trader': ('Colporteur', 'Potion of Invisibility'),
}
LEVEL = {'Novice': ('Novice', 0), 'Apprentice': ('Apprenti', 10), 'Journeyman': ('Compagnon', 70), 'Expert': ('Expert', 150), 'Master': ('Maître', 250),
         'Purchase': ('Achats', None), 'Special': ('Spéciaux', None), 'Ordinary': ('Ordinaires', None)}

ALIAS = {'Raw Chicken': 'chicken', 'Raw Beef': 'beef', 'Raw Porkchop': 'porkchop', 'Raw Mutton': 'mutton', 'Raw Rabbit': 'rabbit', 'Raw Cod': 'cod',
 'Raw Salmon': 'salmon', 'Redstone Dust': 'redstone', 'Leather Cap': 'leather_helmet', 'Leather Tunic': 'leather_chestplate', 'Leather Pants': 'leather_leggings',
 'Bucket of Cod': 'cod_bucket', 'Bucket of Pufferfish': 'pufferfish_bucket', 'Bucket of Tropical Fish': 'tropical_fish_bucket', 'Boat': 'oak_boat',
 'Book and Quill': 'writable_book', 'Empty Map': 'map', 'Village Map': 'filled_map', 'Ocean Monument Map': 'filled_map', 'Woodland Mansion Map': 'filled_map',
 'Buried Trial Chambers Map': 'filled_map', "Rabbit's Foot": 'rabbit_foot', 'Nether Quartz': 'quartz', "Bottle o' Enchanting": 'experience_bottle',
 'Hay Bale': 'hay_block', 'Potion of Invisibility': 'potion', 'Water Bottle': 'potion', 'Block of Quartz': 'quartz_block', 'Dried Kelp Block': 'dried_kelp_side',
 'Vines': 'vine', 'Shelf Mushroom': 'brown_mushroom_block', 'Any color Carpet': 'white_wool', 'Any color Wool': 'white_wool',
 'Any color Glazed Terracotta': 'white_glazed_terracotta', 'Any color Stained Terracotta': 'white_terracotta', 'Clock': 'clock_00', 'Compass': 'compass_00',
 'Crossbow': 'crossbow_standby', 'Slimeball': 'slime_ball', 'Tipped Arrow': 'arrow', 'Quartz Pillar': 'quartz_pillar'}

items = {f[:-4] for f in os.listdir(pack + '/items') if f.endswith('.png')}
blocks = {f[:-4] for f in os.listdir(pack + '/blocks') if f.endswith('.png')}

def slug(n):
    return re.sub(r'[^a-z0-9]+', '_', n.lower().replace("'", '')).strip('_')

def base_name(n):
    return n[len('Enchanted '):] if n.startswith('Enchanted ') and n != 'Enchanted Book' else n

def resolve(n):
    b = base_name(n)
    for cand in (ALIAS.get(b), slug(b)):
        if cand and cand in items:
            return pack + '/items/' + cand + '.png'
    for cand in (ALIAS.get(b), slug(b)):
        if not cand: continue
        for suf in ('', '_side', '_top', '_front'):
            if cand + suf in blocks:
                return pack + '/blocks/' + cand + suf + '.png'
    return None

def fr_note(n):
    m = re.search(r'The price is (\d+) plus the experience cost', n)
    if m:
        return f"Enchanté avec un coût d'expérience aléatoire de 5 à 19. Prix : {m.group(1)} + ce coût, en émeraudes."
    rules = [
     ('Cartographers can offer multiple village maps', "Le cartographe peut proposer plusieurs cartes de village ; leur cible et leur nombre dépendent du biome, ce qui change les probabilités."),
     ('target is selected when the villager unlocks', "La cible est choisie quand le villageois débloque la carte ; la carte n'est pas proposée si aucune cible n'est trouvée."),
     ('Cartographers can offer multiple banners', "Le cartographe peut proposer plusieurs bannières ; leur couleur et leur nombre dépendent du biome, ce qui change les probabilités."),
     ('Blindness', "En Java, un effet est tiré au déblocage : Cécité, Saut amélioré, Vision nocturne, Poison, Saturation ou Faiblesse."),
     ('Due to a bug', "À cause d'un bug, le gâteau coûte actuellement 3 émeraudes en Java."),
     ("boat's material varies", "Le matériau du bateau demandé dépend du biome."),
     ('brewable regular, extended', "En Java, un effet (normal, prolongé ou renforcé) est tiré au déblocage."),
     ('random color created by two dyes', "L'armure en cuir a une couleur aléatoire, mélange de deux teintures (éventuellement la même)."),
     ('price in emeralds is randomly picked', "Prix en émeraudes tiré dans une plage selon le livre : de 2 + 3×niveau à 6 + 13×niveau (doublé pour les enchantements de trésor), plafonné à 64."),
     ('random enchantment other than Soul Speed', "Enchantement tiré au hasard (sauf Agilité des âmes, Furtivité rapide et Rafale), puis niveau aléatoire. Un villageois peut proposer deux fois le même livre."),
     ('only one is requested per trade', "En Java, un seul livre est demandé par échange (bug MC-248042)."),
     ('Because each color represents a unique trade', "Chaque couleur est un échange distinct : en Java, un villageois peut en proposer plusieurs."),
     ('Duration:', "Durée de l'effet : 8:00."),
    ]
    for key, txt in rules:
        if key in n: return txt
    return None

prof_in = json.load(open(trades_json, encoding='utf-8'))
icons_dir = out + '/assets/trade-icons'
os.makedirs(icons_dir, exist_ok=True)
for f in os.listdir(icons_dir): os.remove(os.path.join(icons_dir, f))

copied, missing, unknown = {}, set(), set()
def icon_of(n):
    s = slug(base_name(n))
    if s in copied: return copied[s]
    src = resolve(n)
    if not src:
        missing.add(n); copied[s] = None; return None
    shutil.copyfile(src, f'{icons_dir}/{s}.png'); copied[s] = s
    return s

def conv_items(lst):
    res = []
    for x in lst:
        name = x['item']
        if name not in FR: unknown.add(name)
        res.append({'n': x['n'], 'name': FR.get(name, name), 'icon': icon_of(name), 'ench': name.startswith('Enchanted ')})
    return res

def fr_prob(p):
    return 'selon le biome' if '–' in p else p

out_profs = []
for p in prof_in:
    pid = slug(p['name'])
    fr_name, ico = PROF[p['name']]
    levels = []
    for lv in p['levels']:
        lname, xp = LEVEL[lv['level']]
        tl = []
        for t in lv['trades']:
            notes = [x for x in (fr_note(n) for n in t['notes']) if x]
            row = {'p': fr_prob(t['p']), 'wants': conv_items(t['wants']), 'gives': conv_items(t['gives']), 'stock': t['stock']}
            if t.get('xp'): row['xp'] = t['xp']
            if notes: row['notes'] = notes
            tl.append(row)
        levels.append({'name': lname, 'xpNeeded': xp, 'trades': tl})
    out_profs.append({'id': pid, 'name': fr_name, 'icon': icon_of(ico), 'wandering': p['name'].startswith('Wandering'), 'levels': levels})

js = '/* Généré par tools/build_trades.py à partir de minecraft.wiki (Trading), Java Edition. Ne pas éditer à la main. */\nwindow.MC_TRADES = ' + json.dumps(out_profs, ensure_ascii=False, separators=(',', ':')) + ';\n'
open(out + '/js/trades-data.js', 'w', encoding='utf-8').write(js)
print(len(out_profs), 'professions,', sum(len(l['trades']) for p in out_profs for l in p['levels']), 'échanges,', len([v for v in copied.values() if v]), 'icônes copiées')
print('sans icône :', sorted(missing))
print('sans traduction :', sorted(unknown))
