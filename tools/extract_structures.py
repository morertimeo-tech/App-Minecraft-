#!/usr/bin/env python3
"""Extrait butins et lieux des structures depuis les pages minecraft.wiki.

Usage : python3 -I tools/extract_structures.py WIKI_DIR OUT.json
WIKI_DIR contient Structure.html et st/<Page>.html (pages téléchargées, lues seulement).

Pour chaque tableau de butin on garde : conteneur (chemin de titres), version indiquée par
le paragraphe qui le précède, et pour chaque objet la quantité et la chance d'en trouver au
moins un dans le coffre. Quand le wiki donne deux tableaux pour un même conteneur (anciennes
et nouvelles versions), on garde le dernier (le plus récent).
"""
import re, html, json, os, sys

wiki = sys.argv[1]
read = lambda p: open(os.path.join(wiki, p), encoding='utf-8', errors='replace').read().replace('&#95;', '_')

def clean(c):
    c = re.sub(r'<sup[^>]*>.*?</sup>', '', c, flags=re.S)
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', c))).strip()

def refs(c):
    return re.findall(r'<sup[^>]*>.*?href="#(cite_note-[^"]+)"', c, re.S)

def note_map(src):
    out = {}
    for m in re.finditer(r'<li id="(cite_note-[^"]+)"[^>]*>(.*?)</li>', src, re.S):
        t = re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', m.group(2)))).replace('↑', '').strip()
        out[m.group(1)] = re.sub(r'^(?:[a-z]\s)+', '', t)
    return out

def loot_tables(src):
    """[(chemin de titres, version, rows)] dans l'ordre de la page."""
    notes = note_map(src)
    path = {}  # niveau -> titre
    last_p = ''
    res = []
    for m in re.finditer(r'<h([2-4])[^>]*>(.*?)</h\1>|<p(?:\s[^>]*)?>(.*?)</p>|<table[^>]*>.*?</table>', src, re.S):
        g = m.group(0)
        if g.startswith('<h'):
            lvl = int(m.group(1))
            path = {k: v for k, v in path.items() if k < lvl}
            path[lvl] = clean(m.group(2)).replace('[edit | edit source]', '').replace('[edit]', '').strip()
        elif g.startswith('<p>') or g.startswith('<p '):
            t = clean(m.group(3))
            if 'Edition' in t: last_p = t
        elif g.startswith('<table'):
            rows = re.findall(r'<tr[^>]*>(.*?)</tr>', g, re.S)
            if not rows: continue
            head = re.findall(r'<t([dh])([^>]*)>(.*?)</t[dh]>', rows[0], re.S)
            if not head or clean(head[0][2]) != 'Item' or not any('Chance' in clean(h[2]) for h in head):
                continue
            n_stack = 1
            for _, attrs, c in head:
                if clean(c).startswith('Stack Size'):
                    cs = re.search(r'colspan="(\d+)"', attrs); n_stack = int(cs.group(1)) if cs else 1
            items = []
            for r in rows[1:]:
                cells = re.findall(r'<t([dh])([^>]*)>(.*?)</t[dh]>', r, re.S)
                if len(cells) < 5 or cells[0][0] == 'h': continue
                name = clean(cells[0][2])
                if not name or name.startswith('Nothing'): continue
                chance = clean(cells[-3][2])
                if not chance.endswith('%'): continue
                qty = []
                for _, _, c in cells[1:1 + n_stack]:
                    v = clean(c)
                    if v and v != '—' and v not in qty: qty.append(v)
                items.append({'item': name, 'qty': ' / '.join(qty) or '1', 'chance': chance,
                              'notes': [notes[n] for n in refs(cells[0][2]) if n in notes]})
            if items:
                tail = src[m.end():m.end() + 6000]
                tail = re.split(r'<table|<h[2-4]', tail)[0]
                gv = re.search(r'gameVersion&#34;: &#34;(\w+)&#34;', tail)
                cn = re.search(r'chestNames&#34;: &#91; &#34;([^&]+)&#34;', tail)
                res.append(([path[k] for k in sorted(path)], gv.group(1) if gv else 'Java', items, cn.group(1) if cn else ''))
    return res

def newest_per_container(tables):
    """Même chemin de titres -> on garde le dernier tableau (version la plus récente)."""
    keep = {}
    for p, ver, rows, chest in tables:
        if ver != 'Java':   # Bedrock et versions à venir ignorées
            continue
        keep[(tuple(p), chest)] = (ver, rows)
    return [{'path': list(k[0]), 'chest': k[1], 'version': v[0], 'rows': v[1]} for k, v in keep.items()]

PAGES = {  # id de structure -> pages de butin
    'ancient_city': ['Ancient_City'], 'trial_chambers': ['Trial_Chambers'], 'trail_ruins': ['Trail_Ruins'],
    'stronghold': ['Stronghold'], 'mineshaft': ['Mineshaft'], 'buried_treasure': ['Buried_Treasure'],
    'desert_pyramid': ['Desert_Pyramid'], 'igloo': ['Igloo'], 'jungle_pyramid': ['Jungle_Pyramid'],
    'pillager_outpost': ['Pillager_Outpost'], 'village': ['Village_Loot'], 'woodland_mansion': ['Woodland_Mansion'],
    'abandoned_camp': ['Abandoned_Camp'], 'ocean_ruins': ['Cold_Ocean_Ruins', 'Warm_Ocean_Ruins'],
    'shipwreck': ['Shipwreck'], 'ruined_portal': ['Ruined_Portal'], 'nether_fortress': ['Nether_Fortress'],
    'bastion_remnant': ['Bastion_Remnant'], 'end_city': ['End_City'], 'monster_room': ['Monster_Room'],
}

out = {}
for sid, pages in PAGES.items():
    cont = []
    for pg in pages:
        for c in newest_per_container(loot_tables(read('st/' + pg + '.html'))):
            c['page'] = pg
            cont.append(c)
    out[sid] = cont

# Lieux : biomes (liens de la colonne « Biome(s) »), dimension et ids de /locate
s = read('Structure.html')
tabs = re.findall(r'<table[^>]*>.*?</table>', s, re.S)
places = {}
for t in tabs[:6]:
    for r in re.findall(r'<tr[^>]*>(.*?)</tr>', t, re.S)[1:]:
        cells = re.findall(r'<t[dh][^>]*>(.*?)</t[dh]>', r, re.S)
        if len(cells) < 3: continue
        name = clean(cells[0])
        cell = cells[1]
        # biomes Java : liens, en excluant ceux suivis d'une mention « BE only »
        biomes = []
        parts = re.split(r'(<a [^>]*title="[^"]+"[^>]*>)', cell)
        for i in range(1, len(parts), 2):
            title = re.search(r'title="([^"]+)"', parts[i]).group(1)
            after = clean(parts[i + 1]) if i + 1 < len(parts) else ''
            if 'BE only' in after and 'JE only' not in after: continue
            if title not in biomes: biomes.append(html.unescape(title))
        places[name] = {'biomes': biomes, 'raw': clean(cell), 'desc': clean(cells[2])}
ids = {}
for r in re.findall(r'<tr[^>]*>(.*?)</tr>', tabs[8], re.S)[1:]:
    cells = [clean(c) for c in re.findall(r'<t[dh][^>]*>(.*?)</t[dh]>', r, re.S)]
    if len(cells) >= 2: ids[cells[0]] = {'je': cells[1].split(), 'dim': cells[3] if len(cells) > 3 else ''}
json.dump({'loot': out, 'places': places, 'ids': ids}, open(sys.argv[2], 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print({k: (len(v), sum(len(c['rows']) for c in v)) for k, v in out.items()})
