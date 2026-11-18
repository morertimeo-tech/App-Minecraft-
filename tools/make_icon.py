#!/usr/bin/env python3
"""Génère les icônes de l'app (Grimoire) à partir de la texture du livre enchanté du jeu.

Usage : python3 -I tools/make_icon.py REPO_DIR
Sort assets/icons/icon-512.png, icon-192.png, apple-touch-icon.png (180) et favicon-32.png.
Fond plein bord (compatible « maskable ») : le contenu reste dans la zone centrale sûre.
"""
import math, os, random, sys
from PIL import Image, ImageDraw, ImageFilter

repo = sys.argv[1]
S = 512
book = Image.open(os.path.join(repo, 'assets/items/enchanted_book.png')).convert('RGBA')

# --- fond : dégradé radial violet -> nuit, avec une légère diagonale lumineuse
bg = Image.new('RGBA', (S, S))
px = bg.load()
cx, cy = S * 0.5, S * 0.44
for y in range(S):
    for x in range(S):
        d = math.hypot(x - cx, y - cy) / (S * 0.72)
        t = min(1.0, d)
        r = int(86 * (1 - t) + 18 * t); g = int(52 * (1 - t) + 13 * t); b = int(150 * (1 - t) + 36 * t)
        px[x, y] = (r, g, b, 255)

# --- poussière d'étoiles (petits carrés façon pixels du jeu)
rnd = random.Random(7)
dust = Image.new('RGBA', (S, S), (0, 0, 0, 0))
dd = ImageDraw.Draw(dust)
for _ in range(70):
    x, y = rnd.randrange(8, S - 8), rnd.randrange(8, S - 8)
    if math.hypot(x - S / 2, y - S / 2) < 150:   # on garde le centre dégagé
        continue
    s = rnd.choice((4, 4, 8))
    a = rnd.randrange(70, 170)
    col = rnd.choice(((255, 233, 150), (200, 170, 255), (160, 240, 255)))
    dd.rectangle([x, y, x + s - 1, y + s - 1], fill=col + (a,))
bg.alpha_composite(dust)

# --- halo derrière le livre
scale = 18                                   # 16 px -> 288 px
big = book.resize((16 * scale, 16 * scale), Image.NEAREST)
bx, by = (S - big.width) // 2, (S - big.height) // 2 - 6
alpha = Image.new('L', (S, S), 0)
alpha.paste(big.split()[3], (bx, by))
for radius, color, strength in ((46, (150, 90, 255), 220), (22, (120, 220, 255), 170)):
    glow = alpha.filter(ImageFilter.GaussianBlur(radius))
    layer = Image.new('RGBA', (S, S), color + (0,))
    layer.putalpha(glow.point(lambda v, s=strength: min(255, v * s // 120)))
    bg.alpha_composite(layer)

# --- contour sombre (livre dilaté) pour le contraste
mask_book = big.split()[3].point(lambda v: 255 if v else 0)
outline_mask = mask_book.filter(ImageFilter.MaxFilter(2 * 9 + 1))
outline = Image.new('RGBA', big.size, (22, 12, 46, 255)); outline.putalpha(outline_mask)

# --- reflet d'enchantement : bandes diagonales violettes dans la forme du livre
glint = Image.new('RGBA', big.size, (0, 0, 0, 0))
gd = ImageDraw.Draw(glint)
for k in range(-big.height, big.width + big.height, 72):
    gd.polygon([(k, 0), (k + 26, 0), (k + 26 + big.height, big.height), (k + big.height, big.height)], fill=(200, 120, 255, 120))
glint.putalpha(Image.composite(glint.split()[3], Image.new('L', big.size, 0), mask_book))
big = big.copy(); big.alpha_composite(glint)

# --- ombre portée nette puis livre
shadow = Image.new('RGBA', (S, S), (0, 0, 0, 0))
sh = Image.new('RGBA', big.size, (0, 0, 0, 140)); sh.putalpha(big.split()[3].point(lambda v: 140 if v else 0))
shadow.paste(sh, (bx + 10, by + 12))
bg.alpha_composite(shadow)
bg.alpha_composite(outline, (bx, by))
bg.alpha_composite(big, (bx, by))

# --- étincelles (croix de pixels) autour du livre
def sparkle(img, x, y, u, color):
    d = ImageDraw.Draw(img)
    for dx, dy in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1), (2, 0), (-2, 0), (0, 2), (0, -2)):
        d.rectangle([x + dx * u, y + dy * u, x + dx * u + u - 1, y + dy * u + u - 1], fill=color)
sparkle(bg, 98, 112, 8, (255, 236, 150, 255))
sparkle(bg, 398, 150, 6, (255, 255, 255, 255))
sparkle(bg, 376, 372, 8, (255, 236, 150, 255))
sparkle(bg, 120, 346, 5, (190, 240, 255, 255))

# --- liseré doré fin, en retrait (reste dans la zone sûre)
frame = Image.new('RGBA', (S, S), (0, 0, 0, 0))
m = 40
ImageDraw.Draw(frame).rounded_rectangle([m, m, S - m - 1, S - m - 1], radius=56, outline=(255, 184, 61, 110), width=4)
bg.alpha_composite(frame)

out = os.path.join(repo, 'assets/icons'); os.makedirs(out, exist_ok=True)
bg.save(os.path.join(out, 'icon-512.png'))
bg.resize((192, 192), Image.LANCZOS).save(os.path.join(out, 'icon-192.png'))
bg.resize((180, 180), Image.LANCZOS).save(os.path.join(out, 'apple-touch-icon.png'))
bg.resize((32, 32), Image.LANCZOS).save(os.path.join(out, 'favicon-32.png'))
print('icônes écrites dans', out)
