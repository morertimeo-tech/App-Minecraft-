#!/usr/bin/env python3
"""Extrait les échanges des villageois depuis la page minecraft.wiki « Trading ».

Usage : python3 -I tools/extract_trades.py Trading.html trades.json
(Trading.html = page téléchargée ; ne pas l'exécuter, seulement la lire.)
Chaque profession donne des niveaux, chaque niveau des échanges (probabilité Java,
objets demandés / donnés, stock, XP, multiplicateur de prix) + notes de bas de tableau.
"""
import re, html, json, sys

src = open(sys.argv[1], encoding='utf-8', errors='replace').read().replace('&#95;', '_')

# Ordre des tableaux = ordre des sections ; on associe chaque tableau à la section précédente.
events = []
for m in re.finditer(r'<h([2-4])[^>]*>(.*?)</h\1>|<table[^>]*>.*?</table>', src, re.S):
    if m.group(0).startswith('<table'):
        events.append(('table', m.group(0), m.start(), m.end()))
    else:
        t = re.sub(r'<[^>]+>', '', html.unescape(m.group(2))).replace('[edit | edit source]', '').strip()
        events.append(('h', t, m.start(), m.end()))

# Notes de bas de page : id -> texte
notes = {}
for m in re.finditer(r'<li id="(cite_note-[^"]+)"[^>]*>(.*?)</li>', src, re.S):
    txt = re.sub(r'<[^>]+>', ' ', html.unescape(m.group(2)))
    txt = re.sub(r'\s+', ' ', txt).replace('↑', '').strip()
    txt = re.sub(r'^(?:[a-z]\s)+', '', txt)  # retire les lettres « a b » des renvois multiples
    notes[m.group(1)] = txt

PROFS = ['Armorer', 'Butcher', 'Cartographer', 'Cleric', 'Farmer', 'Fisherman', 'Fletcher',
         'Leatherworker', 'Librarian', 'Mason', 'Shepherd', 'Toolsmith', 'Weaponsmith', 'Wandering Trader offers']

def clean(c):
    c = re.sub(r'<sup[^>]*>.*?</sup>', '', c, flags=re.S)
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', c))).strip()

def refs(c):
    return [h for h in re.findall(r'<sup[^>]*>.*?href="#(cite_note-[^"]+)"', c, re.S)]

def parse_items(cell):
    """« 5–64 × Emerald + Book » -> [{'n': '5–64', 'item': 'Emerald'}, {'n': '1', 'item': 'Book'}]"""
    out = []
    for part in [p.strip() for p in clean(cell).split(' + ')]:
        m = re.match(r'^(\d+(?:[–-]\d+)?)\s*×\s*(.+)$', part)
        out.append({'n': m.group(1), 'item': m.group(2)} if m else {'n': '1', 'item': part})
    return out

def parse_table(t, wandering=False):
    levels, cur, rows = [], None, re.findall(r'<tr[^>]*>(.*?)</tr>', t, re.S)
    for r in rows:
        cells = re.findall(r'<t([dh])([^>]*)>(.*?)</t[dh]>', r, re.S)
        first = clean(cells[0][2]) if cells else ''
        # en-têtes de colonnes ; mais une cellule <th rowspan> est un niveau (Novice…)
        if not cells or first in ('Level', 'JE', 'JE BE') or (cells[0][0] == 'h' and 'rowspan' not in cells[0][1]):
            continue
        has_level = 'rowspan' in cells[0][1]
        vals = [c[2] for c in cells]
        if has_level:
            cur = {'level': clean(vals[0]), 'trades': []}
            levels.append(cur)
            vals = vals[1:]
        if cur is None or len(vals) < 4:
            continue
        je = clean(vals[0])
        rest = vals[2:]  # saute JE et BE
        tr = {'p': je, 'wants': parse_items(rest[0]), 'gives': parse_items(rest[1]),
              'stock': clean(rest[2]) if len(rest) > 2 else ''}
        if not wandering and len(rest) >= 5:
            tr['xp'] = clean(rest[3]); tr['mult'] = clean(rest[4])
        tr['notes'] = [notes[n] for n in refs(rest[0]) + refs(rest[1]) if n in notes]
        cur['trades'].append(tr)
    return levels

result, last_head = [], None
for kind, body, a, b in events:
    if kind == 'h':
        last_head = body
    elif last_head in PROFS and 'Villager wants' in body:
        result.append({'name': last_head.replace(' offers', ''), 'levels': parse_table(body, last_head.startswith('Wandering'))})
        PROFS.remove(last_head)

json.dump(result, open(sys.argv[2], 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(len(result), 'professions,', sum(len(l['trades']) for p in result for l in p['levels']), 'échanges')
