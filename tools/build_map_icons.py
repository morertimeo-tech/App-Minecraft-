#!/usr/bin/env python3
"""Copie les petites icônes de la carte (structures, biomes) depuis le pack de textures et écrit js/map-icons.js.
Usage : python3 tools/build_map_icons.py <dossier du pack, ex. .../minecraft-assets/data/26.1> [liste-biomes.txt]"""
import json, os, shutil, sys

pack = sys.argv[1]
out_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'assets', 'map-icons')
root = os.path.dirname(out_dir)

# identifiant cubiomes de la structure -> texture (items/… ou blocks/…)
STRUCTS = {
    '5': 'items/bell', '10': 'items/crossbow_standby', '9': 'items/totem_of_undying', '8': 'blocks/prismarine_bricks',
    '13': 'items/echo_shard', '24': 'items/trial_key', '1': 'blocks/sandstone', '2': 'blocks/mossy_cobblestone',
    '3': 'items/cauldron', '4': 'blocks/snow', '6': 'blocks/mossy_stone_bricks', '7': 'items/oak_boat',
    '14': 'items/heart_of_the_sea', '15': 'blocks/rail', '11': 'blocks/obsidian', '12': 'blocks/obsidian',
    '16': 'items/water_bucket', '23': 'items/brush', '18': 'blocks/nether_bricks', '19': 'blocks/gilded_blackstone',
    '20': 'blocks/purpur_block', 'stronghold': 'items/ender_eye', 'spawn': 'items/compass_00',
}
# (mot contenu dans le nom du biome) -> texture ; le premier qui correspond gagne
BIOME_RULES = [
    ('deep_frozen_ocean', 'blocks/ice'), ('frozen_ocean', 'blocks/ice'), ('deep_cold_ocean', 'items/cod'), ('cold_ocean', 'items/cod'),
    ('warm_ocean', 'items/tropical_fish'), ('lukewarm', 'items/pufferfish'), ('ocean', 'items/kelp'),
    ('frozen_river', 'blocks/ice'), ('river', 'items/clay_ball'), ('mushroom', 'blocks/red_mushroom'),
    ('snowy_beach', 'items/snowball'), ('beach', 'blocks/sand'), ('stony_shore', 'blocks/gravel'), ('stone_shore', 'blocks/gravel'),
    ('ice_spikes', 'blocks/packed_ice'), ('frozen_peaks', 'blocks/blue_ice'), ('stony_peaks', 'blocks/calcite'),
    ('jagged_peaks', 'items/snowball'), ('snowy_slopes', 'items/powder_snow_bucket'), ('grove', 'items/powder_snow_bucket'),
    ('snowy', 'items/snowball'), ('taiga', 'blocks/spruce_sapling'),
    ('cherry', 'blocks/cherry_sapling'), ('pale_garden', 'blocks/pale_oak_sapling'), ('mangrove', 'items/mangrove_propagule'),
    ('dark_forest', 'blocks/dark_oak_sapling'), ('birch', 'blocks/birch_sapling'), ('flower_forest', 'blocks/allium'),
    ('windswept_forest', 'blocks/spruce_sapling'), ('forest', 'blocks/oak_sapling'),
    ('bamboo', 'items/bamboo'), ('jungle', 'blocks/jungle_sapling'), ('swamp', 'blocks/blue_orchid'),
    ('sunflower', 'blocks/sunflower_front'), ('meadow', 'blocks/azure_bluet'), ('plains', 'blocks/dandelion'),
    ('savanna', 'blocks/acacia_sapling'), ('desert', 'blocks/sand'),
    ('wooded_badlands', 'blocks/terracotta'), ('badlands', 'blocks/red_sand'),
    ('gravelly', 'blocks/gravel'), ('windswept', 'blocks/emerald_ore'), ('mountain', 'blocks/emerald_ore'),
    ('hills', 'blocks/oak_sapling'), ('shrubland', 'blocks/oak_sapling'),
    ('dripstone', 'items/pointed_dripstone'), ('lush', 'items/glow_berries'), ('deep_dark', 'blocks/sculk'),
    ('nether_wastes', 'blocks/netherrack'), ('crimson', 'blocks/crimson_fungus'), ('warped', 'blocks/warped_fungus'),
    ('soul_sand', 'blocks/soul_sand'), ('basalt', 'blocks/basalt_side'),
    ('end_midlands', 'items/chorus_fruit'), ('end_highlands', 'items/chorus_fruit'), ('the_end', 'blocks/end_stone'),
    ('small_end', 'blocks/end_stone'), ('end_barrens', 'blocks/end_stone'),
]

def biome_icon(name):
    for key, tex in BIOME_RULES:
        if key in name:
            return tex
    return None

names = []
if len(sys.argv) > 2:
    names = [n.strip() for n in open(sys.argv[2], encoding='utf-8') if n.strip()]
need = {}
files = {}
def take(tex):
    src = os.path.join(pack, tex + '.png')
    if not os.path.isfile(src):
        raise SystemExit('texture introuvable : ' + tex)
    key = tex.replace('/', '_')
    files[key] = src
    return key
data = {'structures': {k: take(v) for k, v in STRUCTS.items()}, 'biomes': {}}
missing = []
for n in names:
    t = biome_icon(n)
    if t: data['biomes'][n] = take(t)
    else: missing.append(n)
shutil.rmtree(out_dir, ignore_errors=True); os.makedirs(out_dir)
for k, src in files.items():
    shutil.copyfile(src, os.path.join(out_dir, k + '.png'))
js = '// Généré par tools/build_map_icons.py — petites icônes de la carte.\nwindow.MC_MAP_ICONS = ' + json.dumps(data, indent=1, sort_keys=True) + ';\n'
open(os.path.join(root, '..', 'js', 'map-icons.js'), 'w', encoding='utf-8').write(js)
print(len(files), 'icônes ;', len(data['biomes']), 'biomes ; sans icône :', missing)
