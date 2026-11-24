#!/usr/bin/env python3
"""Régénère la liste de fichiers de sw.js. Usage : python3 tools/make_sw.py [nom-du-cache]"""
import os, re, sys
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sw = open(os.path.join(root, 'sw.js'), encoding='utf-8').read()
files = ['./', './index.html', './manifest.webmanifest']
for d in ('assets', 'css', 'js', 'vendor'):
    for base, _, names in os.walk(os.path.join(root, d)):
        for n in names:
            files.append('./' + os.path.relpath(os.path.join(base, n), root).replace(os.sep, '/'))
head, rest = files[:3], sorted(files[3:])
listing = 'const FILES = [\n  ' + ", ".join("'%s'" % f for f in head) + ',\n' + ',\n'.join("  '%s'" % f for f in rest) + ',\n];'
sw = re.sub(r"const FILES = \[.*?\n\];", lambda m: listing, sw, count=1, flags=re.S)
if len(sys.argv) > 1:
    sw = re.sub(r"const CACHE = '[^']*';", "const CACHE = '%s';" % sys.argv[1], sw, count=1)
open(os.path.join(root, 'sw.js'), 'w', encoding='utf-8').write(sw)
print(len(files), 'fichiers')
