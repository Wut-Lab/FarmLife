# Generates the 32x32 world art: assets/art/world.png (+ src/art-index.js) and the two farmer sheets.
# Crop items and seed bags come from the CC0 "Farming Set" by ScratchIO (assets/cc0-farming-set); everything else is drawn here.
import math, random
from PIL import Image, ImageDraw

S = 32
OUT = (52, 33, 44, 255)
rnd = random.Random(3)

def C(h, a=255):
    h = h.lstrip('#'); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) + (a,)

def new(w=S, h=S, fill=(0, 0, 0, 0)): return Image.new('RGBA', (w, h), fill)

def shape(im, fn, base, light=None, dark=None, d=2):
    """Fill a shape drawn by fn(ImageDraw) with base colour, a highlight on its top-left rim and shade on its bottom-right."""
    m = Image.new('L', im.size, 0); md = ImageDraw.Draw(m); md.fill, md.ink = True, 255; fn(md); mp = m.load(); px = im.load(); W, H = im.size
    inside = lambda x, y: 0 <= x < W and 0 <= y < H and mp[x, y]
    for y in range(H):
        for x in range(W):
            if not mp[x, y]: continue
            c = C(base)
            if dark and any(not inside(x + k, y + k) or not inside(x, y + k + 1) for k in range(1, d + 1)): c = C(dark)
            elif light and (not inside(x - 1, y - 1) or not inside(x, y - 1)): c = C(light)
            px[x, y] = c

def outline(im):
    px = im.load(); W, H = im.size; pts = []
    for y in range(H):
        for x in range(W):
            if px[x, y][3] < 128 and any(0 <= x + a < W and 0 <= y + b < H and px[x + a, y + b][3] > 128 and px[x + a, y + b] != OUT
                                        for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1))): pts.append((x, y))
    for p in pts: px[p] = OUT
    return im

def speckle(im, cols, n, box=(0, 0, S, S), mask=None):
    px = im.load()
    for _ in range(n):
        x, y = rnd.randrange(box[0], box[2]), rnd.randrange(box[1], box[3])
        if mask is None or mask(x, y): px[x, y] = C(rnd.choice(cols))

# ---------- ground ----------
G = ['#7cc35a', '#6cb44c', '#8fd16a']
def grass(kind=0):
    im = new(fill=C(G[0])); speckle(im, G[1:], 70)
    d = ImageDraw.Draw(im)
    for _ in range(3 if kind else 1):
        x, y = rnd.randrange(3, 28), rnd.randrange(4, 29)
        d.line([(x, y), (x - 1, y - 3)], C('#4f9a3c')); d.line([(x + 2, y), (x + 3, y - 3)], C('#4f9a3c')); d.point((x + 1, y - 4), C('#4f9a3c'))
    if kind == 2:
        for col in ('#f6f0e0', '#f28fb8', '#f6d04d'):
            x, y = rnd.randrange(4, 27), rnd.randrange(4, 27)
            for a, b in ((0, -1), (0, 1), (-1, 0), (1, 0)): d.point((x + a, y + b), C(col))
            d.point((x, y), C('#e8a33a' if col != '#f6d04d' else '#c9772f'))
    return im

DIRT = ['#d9a066', '#c98f57', '#e6b57e']
def path(j, k):
    im = grass(0); px = im.load()
    wav = lambda t, o: o + round(1.5 * math.sin(t / S * 4 * math.pi) + math.sin(t / S * 2 * math.pi + 1))
    for y in range(S):
        for x in range(S):
            inside = (j != 0 or y >= wav(x, 12)) and (j != 2 or y <= wav(x, 19)) and (k != 0 or x >= wav(y, 12)) and (k != 2 or x <= wav(y, 19))
            if inside: px[x, y] = C(DIRT[0])
    for y in range(S):
        for x in range(S):
            if px[x, y] == C(DIRT[0]):
                if rnd.random() < .12: px[x, y] = C(rnd.choice(DIRT[1:]))
                if y + 1 < S and px[x, y + 1] != C(DIRT[0]) and px[x, y + 1] not in map(C, DIRT): px[x, y] = C('#a8703f')
                elif y > 0 and px[x, y - 1] not in map(C, DIRT): px[x, y] = C('#b98050')
    return im

def soil(part):  # 0 left end, 1 middle, 2 right end of a plot row: drawn as one 3-tile row, then cut
    row = new(3 * S, S)
    for i in range(3): row.alpha_composite(grass(0), (i * S, 0))
    shape(row, lambda d: d.rounded_rectangle([3, 5, 3 * S - 4, 28], 6), '#8a5a3a', '#a06c45', '#6b4229')
    for y in (11, 17, 23):
        for x in range(6, 3 * S - 6):
            if (x + y) % 5: row.putpixel((x, y), C('#704630'))
    speckle(row, ['#7a4c30', '#9a6844'], 70, (5, 7, 3 * S - 5, 27))
    return cell(row, part * S, 0)

# ---------- crops ----------
LEAF = ('#5cb33f', '#86d45f', '#3e8a2e')
def sprouts(im, n, h, spread):
    for i in range(n):
        x = 16 + round((i - (n - 1) / 2) * spread); top = 22 - h
        shape(im, lambda d, x=x: d.ellipse([x - 3, top, x + 1, top + 4]), *LEAF, d=1)
        shape(im, lambda d, x=x: d.ellipse([x, top + 1, x + 4, top + 5]), *LEAF, d=1)
        ImageDraw.Draw(im).line([(x, top + 4), (x, 22)], C('#3e8a2e'))

def crop(kind, stage):
    im = new()
    if stage == 0:
        shape(im, lambda d: d.ellipse([11, 19, 21, 25]), '#7a4c30', '#946039', '#5c3822', 1); sprouts(im, 2, 4, 4)
    elif stage == 1: sprouts(im, 3, 7, 4)
    elif kind == 'cabbage':
        r = 6 if stage == 2 else 9
        shape(im, lambda d: d.ellipse([16 - r - 3, 24 - r, 16 + r + 3, 26]), '#4f9e3a', '#6cbf4a', '#3e7a2e')
        shape(im, lambda d: d.ellipse([16 - r + 1, 24 - 2 * r + 4, 16 + r - 1, 24]), '#b8de7a', '#dff2a8', '#8cc05a')
        if stage == 3: ImageDraw.Draw(im).line([(16, 24 - 2 * r + 7), (16, 22)], C('#8cc05a'))
    else:
        top = '#f08a2c' if kind == 'carrot' else '#f2eadf'
        if stage == 3:
            shape(im, lambda d: d.ellipse([11, 19, 21, 27]), top, '#ffffff' if kind == 'turnip' else '#f9b25c', '#c45e1c' if kind == 'carrot' else '#9b4f9e')
            if kind == 'turnip': shape(im, lambda d: d.ellipse([11, 19, 21, 24]), '#a35ab0', '#c27ccc', '#7a3d85', 1)
        for a in ((-6, 9), (0, 12), (6, 9)) if stage == 3 else ((-4, 7), (0, 9), (4, 7)):
            x, h = 16 + a[0], a[1]
            shape(im, lambda d, x=x, h=h: d.ellipse([x - 2, 21 - h, x + 2, 21]), *LEAF, d=1)
    return outline(im)

# ---------- CC0 items ----------
VEG = Image.open('assets/cc0-farming-set/Vegetables.png').convert('RGBA')
def cell(img, x, y, w=S, h=S): return img.crop((x, y, x + w, y + h))
def turnip_from_beet():
    im = cell(VEG, 96, 64); px = im.load()
    ys = [y for y in range(S) for x in range(S) if px[x, y][3] and px[x, y][0] > px[x, y][1] + 20]
    mid = (min(ys) + max(ys)) / 2
    for y in range(S):
        for x in range(S):
            r, g, b, a = px[x, y]
            if a and r > g + 20:
                lum = (r + g + b) / 3 / 255
                px[x, y] = (int(150 + 60 * lum), int(80 + 60 * lum), int(160 + 60 * lum), a) if y < mid else (int(200 + 55 * lum), int(195 + 55 * lum), int(185 + 55 * lum), a)
    return im
def cabbage_small():
    im = cell(VEG, 64, 96, 64, 64).resize((S, S), Image.BOX); px = im.load()
    for y in range(S):
        for x in range(S):
            r, g, b, a = px[x, y]; px[x, y] = (r, g, b, 255) if a > 120 else (0, 0, 0, 0)
    return im
ITEMS = {'carrot': cell(VEG, 64, 32), 'turnip': turnip_from_beet(), 'cabbage': cabbage_small()}
BAGS = Image.open('assets/cc0-farming-set/Seeds_Cereals.png').convert('RGBA')
def packet(item):
    im = cell(BAGS, 0, 0).copy(); px = im.load()
    for y in range(13, 27):
        for x in range(9, 24):
            if px[x, y][3] and sum(px[x, y][:3]) > 330: px[x, y] = C('#e9c88f')
    mini = item.resize((14, 14), Image.BOX); im.alpha_composite(mini, (9, 12)); return im

# ---------- tools ----------
def hoe():
    im = new(); d = ImageDraw.Draw(im)
    d.line([(7, 28), (23, 6)], C('#a86a3a'), 3); d.line([(8, 27), (22, 7)], C('#c88a50'), 1)
    shape(im, lambda d: d.polygon([(20, 3), (29, 5), (28, 12), (24, 10), (22, 6)]), '#9aa7b8', '#d6e0ea', '#6a7688', 1)
    return outline(im)
def can():
    im = new()
    shape(im, lambda d: d.polygon([(4, 13), (11, 15), (11, 19), (3, 15)]), '#7fb3d8', '#b9dcf2', '#4f80aa', 1)
    shape(im, lambda d: d.ellipse([9, 8, 25, 18]), '#5c8fbf', None, None)
    shape(im, lambda d: d.rounded_rectangle([10, 12, 26, 28], 4), '#7fb3d8', '#b9dcf2', '#4f80aa')
    d = ImageDraw.Draw(im); d.arc([13, 4, 27, 18], 200, 360, C('#4f80aa'), 2); d.line([(12, 21), (24, 21)], C('#4f80aa'))
    return outline(im)

# ---------- trees, props ----------
def canopy(im, cols, cx, cy, r):
    base, light, dark = cols
    for dx, dy, rr in ((0, 4, r), (-r // 2, 0, r * 3 // 4), (r // 2, 0, r * 3 // 4), (0, -r // 2, r * 3 // 4)):
        shape(im, lambda d, dx=dx, dy=dy, rr=rr: d.ellipse([cx + dx - rr, cy + dy - rr, cx + dx + rr, cy + dy + rr]), base, light, dark)
    speckle(im, [light, dark], 40, (cx - r, cy - r, cx + r, cy + r), lambda x, y: im.getpixel((x, y))[:3] == C(base)[:3])
def tall_tree(cols):
    im = new(S, 2 * S)
    shape(im, lambda d: d.rectangle([13, 34, 18, 58]), '#8a5a3a', '#a87048', '#5f3b25')
    shape(im, lambda d: d.ellipse([7, 55, 25, 62]), '#3c6b2c', None, None)
    canopy(im, cols, 16, 24, 12); return outline(im)
def small_tree():
    im = new()
    shape(im, lambda d: d.rectangle([14, 20, 17, 29]), '#8a5a3a', '#a87048', '#5f3b25')
    canopy(im, ('#4f9e3a', '#6fc04f', '#357a2a'), 16, 13, 8); return outline(im)
def pine():  # 32x64 conifer: one silhouette of jagged needle tiers, each shadowed by the tier above
    im = new(S, 2 * S); px = im.load()
    shape(im, lambda d: d.ellipse([7, 56, 25, 62]), '#3c6b2c', None, None)
    shape(im, lambda d: d.rectangle([14, 48, 18, 59]), '#7a4e32', '#9a6440', '#55331f')
    base, light, dark, deep = C('#2f7a4a'), C('#4a9a5e'), C('#1f5a36'), C('#174a2c'); done = set()
    for top, bot, half in ((2, 17, 6), (9, 28, 9), (18, 39, 12), (28, 51, 15)):  # top tier first; lower tiers only fill what is still empty
        m = Image.new('L', im.size, 0); pts = [(16, top), (16 + half, bot)]
        pts += [(16 + half - k * 3, bot - 3 * (k % 2)) for k in range(1, 2 * half // 3 + 1)] + [(16 - half, bot)]
        ImageDraw.Draw(m).polygon(pts, 255); mp = m.load()
        for y in range(top, bot + 1):
            w = max(1, half * (y - top) / (bot - top))
            for x in range(S):
                if not mp[x, y] or (x, y) in done: continue
                t = (x - 16) / w
                shadow = any((x, y - k) in done for k in (1, 2))
                px[x, y] = deep if shadow else light if t < -0.4 else dark if t > 0.45 else base
        done |= {(x, y) for y in range(top, bot + 1) for x in range(S) if mp[x, y]}
    speckle(im, ['#4a9a5e', '#1f5a36'], 30, (2, 4, 30, 52), lambda x, y: im.getpixel((x, y))[:3] == base[:3])
    return outline(im)
def oak():  # 64x64 broad oak: thick trunk with roots under a wide lumpy crown
    im = new(2 * S, 2 * S)
    shape(im, lambda d: d.ellipse([12, 54, 52, 63]), '#3c6b2c', None, None)
    shape(im, lambda d: d.polygon([(26, 36), (38, 36), (39, 54), (44, 60), (20, 60), (25, 54)]), '#7a5a3a', '#987048', '#54391f')
    base, light, dark = '#5a9a3a', '#7cba52', '#3c7428'
    for cx, cy, r in ((32, 30, 18), (17, 26, 13), (47, 26, 13), (24, 14, 12), (41, 14, 12), (32, 9, 9)):
        shape(im, lambda d, cx=cx, cy=cy, r=r: d.ellipse([cx - r, cy - r, cx + r, cy + r * 3 // 4]), base, light, dark)
    speckle(im, [light, dark], 160, (3, 0, 61, 44), lambda x, y: im.getpixel((x, y))[:3] == C(base)[:3])
    return outline(im)
def shrub(w, flowers=False):  # round bush, 32 or 64 wide; flowers adds pink blossoms
    im = new(w, S); base, light, dark = ('#4e9440', '#6cb455', '#356c2c') if flowers else ('#468a3a', '#62a84c', '#2f6a2a')
    shape(im, lambda d: d.ellipse([3, 25, w - 4, 31]), '#3c6b2c', None, None)
    blobs = ((w // 2, 18, 11), (9, 21, 7), (w - 10, 21, 7)) if w == S else ((16, 20, 11), (32, 16, 13), (48, 20, 11), (8, 23, 7), (56, 23, 7))
    for cx, cy, r in blobs:
        shape(im, lambda d, cx=cx, cy=cy, r=r: d.ellipse([cx - r, cy - r, cx + r, min(cy + r, 29)]), base, light, dark)
    speckle(im, [light, dark], w * 2, (0, 0, w, S), lambda x, y: im.getpixel((x, y))[:3] == C(base)[:3])
    if flowers:
        d = ImageDraw.Draw(im)
        for x, y in ((10, 17), (16, 10), (22, 15), (14, 22), (24, 22), (7, 23), (19, 18)):
            for a, b in ((0, -1), (0, 1), (-1, 0), (1, 0)): d.point((x + a, y + b), C('#f28fb8'))
            d.point((x, y), C('#f6d04d'))
    return outline(im)
def shrub_small():  # low single bush, about half the flowering shrub's size
    im = new(); base, light, dark = '#4a8e3c', '#66ae50', '#326a2a'
    shape(im, lambda d: d.ellipse([8, 26, 24, 31]), '#3c6b2c', None, None)
    for cx, cy, r in ((16, 21, 7), (11, 24, 5), (21, 24, 5)):
        shape(im, lambda d, cx=cx, cy=cy, r=r: d.ellipse([cx - r, cy - r, cx + r, min(cy + r, 29)]), base, light, dark)
    speckle(im, [light, dark], 25, (6, 12, 27, 30), lambda x, y: im.getpixel((x, y))[:3] == C(base)[:3])
    return outline(im)

def flower_patch(kind):  # three big blooms on stems with leaves, small matching flowers scattered round it into the grass
    im = new(); d = ImageDraw.Draw(im); fr = random.Random(11 if kind == 'roses' else 12)
    G2 = ('#4a8e3c', '#66ae50', '#326a2a')
    if kind == 'roses': bloom, bloom_l, bloom_d, small = '#c8283a', '#ec5a64', '#8a1828', ('#e04a58', '#f48a96')
    else: bloom, bloom_l, bloom_d, small = '#f2c230', '#fde27a', '#b8801a', ('#f6d04d', '#fff0a0')
    d.ellipse([9, 28, 23, 31], (0, 0, 0, 50))  # soft shadow where the stems meet the ground
    STEM, LEAF, LEAF_L, LEAF_D = '#3e7a32', '#4e9440', '#6cb455', '#326a2a'
    for (x0, y0), (cx, cy) in zip(((16, 29), (14, 29), (18, 29)), ((16, 7), (8, 12), (24, 12))):  # three stems from one bundle
        d.line([(x0, y0), ((x0 + cx) // 2, (y0 + cy) // 2 + 2), (cx, cy + 3)], C(STEM))
    if kind == 'roses':  # small oval leaves in pairs along the stems
        leaves = [(11, 22, -1), (21, 22, 1), (14, 17, -1), (18, 16, 1), (7, 18, -1), (25, 18, 1), (13, 25, -1), (19, 25, 1)]
        for x, y, k in leaves:
            shape(im, lambda d, x=x, y=y, k=k: d.ellipse([x - 2 + k, y - 1, x + 2 + k, y + 1]), LEAF, LEAF_L, LEAF_D, 1)
            d.point((x + k, y), C(LEAF_D))
    else:  # long blade leaves curving up from the base
        for pts in (((15, 29), (10, 22), (8, 17), (11, 22), (16, 28)), ((17, 29), (22, 22), (25, 18), (21, 23), (17, 28)),
                    ((14, 29), (5, 25), (3, 22), (7, 26), (15, 28)), ((18, 29), (27, 25), (29, 22), (25, 26), (18, 28))):
            shape(im, lambda d, pts=pts: d.polygon(pts), LEAF, LEAF_L, LEAF_D, 1)
    for cx, cy in ((16, 7), (8, 12), (24, 12)):
        if kind == 'roses':  # round bloom with a spiral of darker petal edges
            shape(im, lambda d, cx=cx, cy=cy: d.ellipse([cx - 4, cy - 4, cx + 4, cy + 3]), bloom, bloom_l, bloom_d, 1)
            d.arc([cx - 2, cy - 2, cx + 2, cy + 2], 180, 450, C(bloom_d)); d.point((cx, cy), C(bloom_d)); d.point((cx - 1, cy - 3), C(bloom_l))
        else:  # tulip cup: two outer petals and a pointed middle one
            shape(im, lambda d, cx=cx, cy=cy: d.polygon([(cx - 4, cy - 4), (cx - 2, cy - 1), (cx, cy - 5), (cx + 2, cy - 1), (cx + 4, cy - 4), (cx + 4, cy + 1), (cx + 2, cy + 3), (cx - 2, cy + 3), (cx - 4, cy + 1)]), bloom, bloom_l, bloom_d, 1)
            d.line([(cx - 2, cy), (cx - 1, cy + 2)], C(bloom_d)); d.line([(cx + 2, cy), (cx + 1, cy + 2)], C(bloom_d))
        d.polygon([(cx - 2, cy + 3), (cx, cy + 5), (cx + 2, cy + 3)], C('#4e9440'))  # sepals
    outline(im)
    # Loose little flowers and blades with no outline round the edge, so the patch fades into the grass around it.
    for x, y in ((2, 14), (29, 7), (3, 28), (28, 29), (12, 2), (30, 18), (1, 21), (21, 3), (7, 4)):
        d.line([(x, y + 1), (x, y + 3)], C(G2[2])); c = C(fr.choice(small))
        for a, b in ((0, 0), (1, 0), (0, -1), (-1, 0)): d.point((x + a, y + b), c)
        d.point((x, y), C('#fff6c0'))
    return im

# ---------- paving and water: blob autotiles, 47 pieces per set chosen from all 8 neighbours ----------
N_, E_, S_, W_, NE, SE, SW, NW = 1, 2, 4, 8, 16, 32, 64, 128
def blob_reduce(m):  # a corner neighbour only matters when both sides next to it are connected
    for dg, a, b in ((NE, N_, E_), (SE, S_, E_), (SW, S_, W_), (NW, N_, W_)):
        if not (m & a and m & b): m &= ~dg
    return m
BLOB = sorted({blob_reduce(m) for m in range(256)})  # src/map-data.js builds the same list, in the same order
def shade(c, k): return tuple(max(0, min(255, v + k)) for v in c[:3]) + (255,)
def cobble_tex():  # wrap-around Voronoi stones, so the tile repeats seamlessly
    r = random.Random(11); pts = [(i * 8 + r.uniform(1.5, 6.5), j * 8 + r.uniform(1.5, 6.5), r.choice(['#a8a29a', '#9c968e', '#b6b0a6', '#928c86'])) for j in range(4) for i in range(4)]
    im = new(); px = im.load(); stone = {}
    wrap = lambda a: min(abs(a), S - abs(a))
    for y in range(S):
        for x in range(S):
            ds = sorted((wrap(x + .5 - a) ** 2 + wrap(y + .5 - b) ** 2, k) for k, (a, b, _) in enumerate(pts))
            stone[x, y] = -1 if math.sqrt(ds[1][0]) - math.sqrt(ds[0][0]) < 1.4 else ds[0][1]
    for (x, y), k in stone.items():
        if k < 0: px[x, y] = C('#6f6a66'); continue
        c = C(pts[k][2])
        px[x, y] = shade(c, 26) if stone[(x - 1) % S, (y - 1) % S] < 0 else shade(c, -22) if stone[(x + 1) % S, (y + 1) % S] < 0 else c
    return im
def brick_tex():  # running bond, 16x8 bricks
    r = random.Random(5); im = new(fill=C('#d8c8b0')); px = im.load()
    for row in range(4):
        for b in range(2):
            c, x0 = C(r.choice(['#b0563e', '#a44e39', '#bc6448', '#9a4834'])), b * 16 + (8 if row % 2 else 0)
            for y in range(row * 8, row * 8 + 7):
                for x in range(x0, x0 + 15):
                    px[x % S, y] = shade(c, 24) if y == row * 8 else shade(c, -20) if y == row * 8 + 6 else c
    return im
def water_tex(base, light, glint):
    r = random.Random(base); im = new(fill=C(base)); px = im.load()
    for _ in range(40): px[r.randrange(S), r.randrange(S)] = C(light)
    for x, y in ((r.randrange(S), r.randrange(0, 14)), (r.randrange(S), r.randrange(17, 30))):
        for k in range(3): px[(x + k) % S, y] = C(glint)
    return im
def blob_tile(m, top, under, edge):
    """One piece of a set: `top` fills the connected area, `under` shows where it ends. edge: 'kerb' (paving) or 'shore'/'deep' (water)."""
    inset = 3 if edge == 'kerb' else 4
    wave = (lambda t: 0) if edge == 'kerb' else (lambda t: round(math.sin(t / S * 4 * math.pi + 0.6)))  # period 16: edges line up tile to tile
    def cut(x, y):
        if (not m & N_ and y < inset + wave(x)) or (not m & S_ and y > S - 1 - inset - wave(x)) or \
           (not m & W_ and x < inset + wave(y)) or (not m & E_ and x > S - 1 - inset - wave(y)): return True
        r = inset + 4  # rounded outer corners
        for a, b, cx, cy in ((N_, W_, r, r), (N_, E_, S - 1 - r, r), (S_, W_, r, S - 1 - r), (S_, E_, S - 1 - r, S - 1 - r)):
            if not m & a and not m & b and (x < cx if cx == r else x > cx) and (y < cy if cy == r else y > cy) and math.hypot(x - cx, y - cy) > r - inset: return True
        for dg, a, b, cx, cy in ((NW, N_, W_, -.5, -.5), (NE, N_, E_, S - .5, -.5), (SW, S_, W_, -.5, S - .5), (SE, S_, E_, S - .5, S - .5)):
            if m & a and m & b and not m & dg and math.hypot(x - cx, y - cy) < inset + .5: return True  # inner corner notch
        return False
    on = {(x, y): not cut(x, y) for y in range(S) for x in range(S)}
    filled = lambda x, y: on.get((x, y), True)  # beyond the tile counts as connected
    near = lambda x, y, k: any(not filled(x + a, y + b) for a in range(-k, k + 1) for b in range(-k, k + 1) if abs(a) + abs(b) <= k)
    out = under.copy(); px, tp = out.load(), top.load()
    for (x, y), v in on.items():
        if not v:
            if edge == 'shore' and near_on(on, x, y): px[x, y] = C('#4a7a36')  # shaded bank just above the water
            continue
        c = tp[x, y]
        if edge == 'kerb':
            c = OUT if near(x, y, 1) else (KERB[1] if (x + y) % 7 == 0 else KERB[0]) if near(x, y, 3) else c
        elif edge == 'shore': c = C('#e2f6f2') if near(x, y, 1) else C('#9edcea') if near(x, y, 2) else c
        else: c = C('#5aa6d0') if near(x, y, 1) else C('#4892c2') if near(x, y, 2) else c
        px[x, y] = c
    return out
near_on = lambda on, x, y: any(on.get((x + a, y + b), False) for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1)))
KERB = (C('#c9c3b8'), C('#a59f96'))
def blob_set(name, top, under, edge, kerb=None):
    global KERB
    old, KERB = KERB, kerb or KERB
    for i, m in enumerate(BLOB): add(f'{name}{i}', blob_tile(m, top, under, edge))
    KERB = old

def mushrooms():
    im = new()
    for x, y, r in ((12, 18, 6), (22, 23, 4)):
        shape(im, lambda d, x=x, y=y, r=r: d.rectangle([x - r // 3, y, x + r // 3, y + r + 2]), '#f2eadf', '#ffffff', '#cbbfae', 1)
        shape(im, lambda d, x=x, y=y, r=r: d.pieslice([x - r, y - r, x + r, y + r], 180, 360), '#d9483b', '#f07060', '#a8302a', 1)
        d = ImageDraw.Draw(im); d.point((x - r // 2, y - r // 2), C('#ffffff')); d.point((x + r // 3, y - r + 2), C('#ffffff'))
    return outline(im)
def fence(part):
    im = new(); posts = {0: [6], 1: [], 2: [25]}[part]
    x0, x1 = (6, 31) if part == 0 else (0, 25) if part == 2 else (0, 31)
    for y in (13, 21): shape(im, lambda d, y=y: d.rectangle([x0, y, x1, y + 3]), '#c88a50', '#e0a96a', '#9a6436', 1)
    for x in posts + ([16] if part == 1 else []):
        shape(im, lambda d, x=x: d.rectangle([x - 2, 8, x + 2, 29]), '#b07440', '#d0965a', '#83532c', 1)
    return outline(im)
def fence_v():  # vertical run of fence seen from above: one long rail with a post
    im = new()
    shape(im, lambda d: d.rectangle([14, 0, 17, 31]), '#c88a50', '#e0a96a', '#9a6436', 1)
    shape(im, lambda d: d.rectangle([13, 10, 18, 25]), '#b07440', '#d0965a', '#83532c', 1)
    return outline(im)
def bin_():  # 64x32 wooden shipping bin with a lid, sliced into two tiles
    im = new(2 * S, S)
    shape(im, lambda d: d.rectangle([4, 12, 59, 30]), '#b07440', '#d0965a', '#83532c')
    d = ImageDraw.Draw(im)
    for y in (18, 24): d.line([(5, y), (58, y)], C('#83532c'))
    for x in (4, 31, 56): shape(im, lambda d, x=x: d.rectangle([x, 12, x + 3, 30]), '#9a6436', '#b07440', '#6f4426', 1)
    shape(im, lambda d: d.polygon([(2, 12), (6, 4), (57, 4), (61, 12)]), '#c88a50', '#e0a96a', '#9a6436')
    im.alpha_composite(ITEMS['carrot'].resize((14, 14), Image.BOX), (18, 14))
    im.alpha_composite(ITEMS['turnip'].resize((14, 14), Image.BOX), (36, 14))
    return outline(im)
def sign():
    im = new()
    shape(im, lambda d: d.rectangle([14, 18, 17, 30]), '#9a6436', '#b07440', '#6f4426', 1)
    shape(im, lambda d: d.rounded_rectangle([4, 6, 27, 20], 2), '#c88a50', '#e0a96a', '#9a6436')
    im.alpha_composite(ITEMS['carrot'].resize((12, 12), Image.BOX), (10, 7)); return outline(im)

# ---------- buildings (96x96, sliced 3x3) ----------
def building(roof, roof_l, roof_d, wall, wall_l, wall_d, awning=False):
    im = new(96, 96)
    shape(im, lambda d: d.rectangle([4, 46, 91, 95]), wall, wall_l, wall_d)
    d = ImageDraw.Draw(im)
    for y in range(52, 95, 7): d.line([(5, y), (90, y)], C(wall_d))
    shape(im, lambda d: d.polygon([(0, 50), (10, 4), (86, 4), (95, 50)]), roof, roof_l, roof_d, 3)
    for r, y in enumerate(range(10, 48, 7)):
        for x in range(4 + (r % 2) * 5, 94, 10): d.arc([x - 5, y - 4, x + 5, y + 4], 20, 160, C(roof_d))
    shape(im, lambda d: d.rectangle([0, 47, 95, 51]), roof_d, None, None)
    for x in (12, 64):  # windows
        shape(im, lambda d, x=x: d.rectangle([x, 60, x + 19, 77]), '#f6e7c1', '#fff8e0', None)
        shape(im, lambda d, x=x: d.rectangle([x + 2, 62, x + 17, 75]), '#7fb3d8', '#b9dcf2', '#4f80aa', 1)
        d.line([(x + 10, 62), (x + 10, 75)], C('#f6e7c1')); d.line([(x + 2, 68), (x + 17, 68)], C('#f6e7c1'))
        shape(im, lambda d, x=x: d.rectangle([x - 1, 78, x + 20, 81]), '#9a6436', '#c88a50', None)
        if not awning:
            for i in range(4): d.point((x + 2 + i * 5, 80), C(rnd.choice(['#f28fb8', '#f6d04d', '#ffffff'])))
    if awning:
        for i, x in enumerate(range(4, 92, 8)):
            shape(im, lambda d, x=x: d.pieslice([x, 50, x + 8, 60], 0, 180), '#f28fb8' if i % 2 else '#fff3e6', None, '#c45e7a' if i % 2 else '#d8c8b8', 1)
    shape(im, lambda d: d.rounded_rectangle([38, 62, 57, 95], 3), '#8a5a3a', '#a87048', '#5f3b25')
    d.line([(47, 64), (47, 94)], C('#5f3b25')); d.point((53, 80), C('#f6d04d')); d.point((42, 80), C('#f6d04d'))
    return outline(im)

def barn():  # 128x128 red gambrel barn with white trim, grey shingles behind the gable, grass tufts at its base
    im = new(4 * S, 4 * S); d = ImageDraw.Draw(im)
    RED, RED_L, RED_D, WH, WH_D = '#b8322c', '#d24a3e', '#86221e', '#f4efe6', '#c8c0b4'
    # Roof: a narrow band of grey shingles just outside the gable.
    shape(im, lambda d: d.polygon([(3, 68), (13, 37), (60, 13), (68, 13), (115, 37), (125, 68)]), '#8a8f96', '#a8adb4', '#62676e', 2)
    roof = {(x, y) for y in range(4 * S) for x in range(4 * S) if im.getpixel((x, y))[:3] == C('#8a8f96')[:3]}
    for (x, y) in roof:  # shingle rows: a dark seam under each row, a light lip above it, staggered joints
        r, k = divmod(y - 10, 6)
        c = '#62676e' if k == 5 else '#9ea3aa' if k == 0 else '#5c6168' if (x + (r % 2) * 5) % 10 == 0 else ('#7e838a' if (x * 7 + r * 3) % 11 == 0 else None)
        if c: im.putpixel((x, y), C(c))
    gable = [(10, 122), (10, 64), (20, 40), (64, 20), (108, 40), (118, 64), (118, 122)]
    shape(im, lambda d: d.polygon(gable), RED, RED_L, RED_D)
    for x in range(16, 116, 7): d.line([(x, 44 if 24 < x < 104 else 66), (x, 121)], C(RED_D))  # vertical boards
    for x in range(16, 116, 7):  # clip boards to the gable slope
        for y in range(18, 66):
            if im.getpixel((x, y))[:3] == C(RED_D)[:3] and not inside_poly(gable, x, y - 2): im.putpixel((x, y), C(RED))
    d.line(gable[1:-1], C(WH), 3); d.line([(9, 64), (9, 122)], C(WH), 2); d.line([(118, 64), (118, 122)], C(WH), 2)  # roof trim and corner boards
    shape(im, lambda d: d.rectangle([8, 118, 119, 125]), '#9a968e', '#b4b0a8', '#706c66', 1)  # stone footing
    def window(x, y, w, h):
        shape(im, lambda d: d.rectangle([x, y, x + w, y + h]), WH, '#ffffff', WH_D, 1)
        shape(im, lambda d: d.rectangle([x + 2, y + 2, x + w - 2, y + h - 2]), '#4f6f8f', '#7fa3c0', '#33506c', 1)
        d.line([(x + w // 2, y + 2), (x + w // 2, y + h - 2)], C(WH)); d.line([(x + 2, y + h // 2), (x + w - 2, y + h // 2)], C(WH))
    window(54, 36, 20, 16)  # hayloft
    window(16, 74, 16, 14); window(96, 74, 16, 14)
    # Double doors: white frame, white X brace on each leaf.
    shape(im, lambda d: d.rectangle([38, 70, 89, 118]), WH, '#ffffff', WH_D, 1)
    for x0 in (41, 65):
        shape(im, lambda d, x0=x0: d.rectangle([x0, 73, x0 + 21, 117]), RED, RED_L, RED_D, 1)
        d.line([(x0 + 1, 74), (x0 + 20, 116)], C(WH), 2); d.line([(x0 + 20, 74), (x0 + 1, 116)], C(WH), 2)
        d.rectangle([x0, 73, x0 + 21, 117], outline=C(WH), width=2)
    d.line([(63, 73), (63, 117)], C(WH_D), 2)
    outline(im)
    # Grass tufts over the base and corners, drawn after the outline so the barn sits in the turf.
    tr = random.Random(9)
    def tuft(x, y, n, h):
        for k in range(n):
            dx = k - n // 2; c = ('#4f9a3c', '#6fc04f', '#8fd16a')[tr.randrange(3)]
            d.line([(x + dx, y), (x + dx + (dx > 0) - (dx < 0), y - tr.randrange(h - 2, h + 1))], C(c))
    for x, y in ((6, 127), (11, 126), (3, 124), (117, 127), (122, 126), (125, 124)): tuft(x, y, 5, 7)  # corner clumps
    for x in list(range(15, 37, 4)) + list(range(92, 114, 4)): tuft(x + tr.randrange(-1, 2), 127, 3, 5)  # along the footing
    for x in (40, 87): tuft(x, 127, 3, 3)  # a little at the door posts, doorway kept clear
    return im
def cottage(wall, wall_l, wall_d, roof, roof_l, roof_d, door, door_l, door_d, chimney, shutters=None, brick_base=False, smoke=False, cx=76):
    """96x128 house (3x4 tiles): siding walls, shingle roof, chimney at one end of the roof (cx = its left edge); the top row holds chimney and smoke."""
    im = new(96, 128); d = ImageDraw.Draw(im)
    if chimney == 'brick':
        shape(im, lambda d: d.rectangle([cx, 22, cx + 13, 56]), '#a8483a', '#c46050', '#7a3028', 1)
        for y in range(25, 56, 4):
            d.line([(cx + 1, y), (cx + 12, y)], C('#7a3028'))
            for x in range(cx + 1 + (y // 4 % 2) * 3, cx + 13, 6): d.line([(x, y - 3), (x, y - 1)], C('#7a3028'))
        shape(im, lambda d: d.rectangle([cx - 2, 19, cx + 15, 23]), '#8a8680', '#a8a49e', '#625e58', 1)
    else:  # fieldstone
        shape(im, lambda d: d.rectangle([cx, 22, cx + 13, 56]), '#8e8a84', '#aaa69e', '#66625c', 1)
        for x, y in ((cx + 2, 26), (cx + 8, 31), (cx + 3, 37), (cx + 9, 43), (cx + 2, 48), (cx + 7, 52)): d.line([(x, y), (x + 4, y)], C('#66625c'))
        shape(im, lambda d: d.rectangle([cx - 2, 19, cx + 15, 23]), '#6e6a64', '#8e8a84', '#4e4a46', 1)
    shape(im, lambda d: d.rectangle([4, 78, 91, 118]), wall, wall_l, wall_d)
    for y in range(84, 118, 6): d.line([(5, y), (90, y)], C(wall_d))  # lap siding
    shape(im, lambda d: d.polygon([(0, 82), (10, 36), (86, 36), (95, 82)]), roof, roof_l, roof_d, 3)
    sh = new(96, 128); sd = ImageDraw.Draw(sh)
    for r, y in enumerate(range(42, 80, 7)):
        for x in range(4 + (r % 2) * 5, 94, 10): sd.arc([x - 5, y - 4, x + 5, y + 4], 20, 160, C(roof_d))
    for (x, y) in [(x, y) for y in range(36, 80) for x in range(96) if sh.getpixel((x, y))[3] and im.getpixel((x, y))[:3] == C(roof)[:3]]: im.putpixel((x, y), C(roof_d))  # shingles kept inside the roof
    shape(im, lambda d: d.rectangle([0, 79, 95, 83]), roof_d, None, None)
    for x in (12, 64):  # windows, with shutters either side when asked
        shape(im, lambda d, x=x: d.rectangle([x, 89, x + 19, 106]), '#f6e7c1', '#fff8e0', None)
        shape(im, lambda d, x=x: d.rectangle([x + 2, 91, x + 17, 104]), '#7fb3d8', '#b9dcf2', '#4f80aa', 1)
        d.line([(x + 10, 91), (x + 10, 104)], C('#f6e7c1')); d.line([(x + 2, 97), (x + 17, 97)], C('#f6e7c1'))
        shape(im, lambda d, x=x: d.rectangle([x - 1, 107, x + 20, 109]), '#f6e7c1' if not shutters else wall_d, '#fff8e0' if not shutters else wall_l, None)
        if shutters:
            for sx in (x - 7, x + 21):
                shape(im, lambda d, sx=sx: d.rectangle([sx, 88, sx + 5, 107]), shutters[0], shutters[1], shutters[2], 1)
                for y in range(91, 106, 3): d.line([(sx + 1, y), (sx + 4, y)], C(shutters[2]))
    shape(im, lambda d: d.rounded_rectangle([38, 88, 57, 120], 3), door, door_l, door_d)
    d.rectangle([41, 92, 54, 102], outline=C(door_d)); d.rectangle([41, 106, 54, 116], outline=C(door_d)); d.point((53, 109), C('#f6d04d'))
    if brick_base:  # faded brick: pale, low-contrast bricks with soft mortar
        shape(im, lambda d: d.rectangle([2, 118, 93, 127]), '#d2c0b2', None, '#a8968a', 1)
        br = random.Random(5)
        for row, y in enumerate((119, 123)):
            for x in range(3 - (row % 2) * 4, 93, 8):
                c = C(br.choice(['#b48a7c', '#bc968a', '#a88074', '#c4a296']))
                d.rectangle([max(x, 3), y, min(x + 6, 92), y + 2], c)
        for _ in range(40): d.point((br.randrange(3, 93), br.randrange(119, 126)), C(br.choice(['#d2c0b2', '#c8b4a6'])))
    else:
        shape(im, lambda d: d.rectangle([2, 118, 93, 127]), '#b4b0a8', '#cac6be', '#8a867e', 1)
    shape(im, lambda d: d.rectangle([34, 120, 61, 125]), '#9a968e', '#b4b0a8', '#706c66', 1)  # door step
    outline(im)
    if smoke:  # soft puffs drifting up and away from the roof's end, lighter as they rise
        k = -1 if cx > 48 else 1
        for (cx, cy, r), col in zip(((cx + 7, 14, 5), (cx + 7 + 6 * k, 8, 5), (cx + 7 + 13 * k, 4, 4), (cx + 7 + 19 * k, 1, 3)), ('#d8d4dc', '#e2dee6', '#ece8f0', '#f4f2f6')):
            sm = new(96, 128)
            shape(sm, lambda d, cx=cx, cy=cy, r=r: d.ellipse([cx - r, cy - r, cx + r, cy + r]), col, '#ffffff', '#aaa6b4', 1)
            sm.putalpha(sm.getchannel('A').point(lambda a: a * 215 // 255)); im.alpha_composite(sm)
    return im
def inside_poly(pts, x, y):
    m = Image.new('L', (4 * S, 4 * S)); ImageDraw.Draw(m).polygon(pts, 255); return m.getpixel((x, y)) > 0 if 0 <= y < 4 * S else False

# ---------- characters ----------
SKIN, SKIN_L, SKIN_D = '#f5c7a0', '#ffdcc0', '#d99a78'
def eye(d, p, ex, out):
    """2x4 eye: lash line on top, white glint, iris, lighter bottom. out = side for the outer lash flick."""
    d.line([(ex, 9), (ex + 1, 9)], C('#2a1a2a'))
    if p['long']: d.point((ex + out, 9 - (out > 0) * 0), C('#2a1a2a')); d.point((ex + out, 8), C('#2a1a2a'))
    d.point((ex, 10), C('#ffffff')); d.point((ex + 1, 10), C(p['eye']))
    d.line([(ex, 11), (ex + 1, 11)], C(p['eye'])); d.line([(ex, 12), (ex + 1, 12)], C(p['eye_l']))
def farmer(p):
    sheet = new(3 * S, 4 * S)
    for dir_ in range(4):
        for f in range(3):
            im = new(); step = (0, 1, -1)[f]
            d = ImageDraw.Draw(im); d.ellipse([9, 28, 23, 31], (0, 0, 0, 60))
            side = dir_ in (1, 2)
            if p.get('tail') and side:  # ponytail hangs behind the head
                tx = 22 if dir_ == 1 else 5
                shape(im, lambda d: d.rounded_rectangle([tx, 6, tx + 5, 18], 2), p['hair'], p['hair_l'], p['hair_d'], 1)
            if p['long'] and dir_ != 3:  # long hair behind the body
                box = [7, 8, 25, 23] if dir_ == 0 else [15, 8, 25, 22] if dir_ == 1 else [7, 8, 17, 22]
                shape(im, lambda d: d.rounded_rectangle(box, 5), p['hair'], None, p['hair_d'])
            # legs
            for i, lx in enumerate((13, 17) if not side else (15,)):
                lift = (step if i == 0 else -step) if not side else 0
                if side:
                    for k, off in enumerate((step * 2, -step * 2)):
                        shape(im, lambda d, off=off: d.rectangle([14 + off, 23, 17 + off, 28 - (1 if off < 0 else 0)]), p['pants'], None, p['pants_d'], 1)
                        shape(im, lambda d, off=off: d.rectangle([14 + off, 28 - (1 if off < 0 else 0), 18 + off if dir_ == 2 else 17 + off, 30 - (1 if off < 0 else 0)]), '#5f3b25', None, None)
                    break
                shape(im, lambda d: d.rectangle([lx, 23, lx + 2, 28 - max(0, lift)]), p['pants'], None, p['pants_d'], 1)
                shape(im, lambda d: d.rectangle([lx, 28 - max(0, lift), lx + 2, 30 - max(0, lift)]), '#5f3b25', None, None)
            # torso + arms
            tx0, tx1 = (11, 21) if not side else (12, 20)
            arms = [(9, step), (22, -step)] if not side else [(15 if dir_ == 1 else 16, step)]
            if not side or True:
                shape(im, lambda d: d.rounded_rectangle([tx0, 15, tx1, 24], 3), p['shirt'], p['shirt_l'], p['shirt_d'])
                d = ImageDraw.Draw(im)
                if dir_ == 0 and not p.get('sweater'): d.line([(16, 16), (16, 23)], C(p['shirt_d'])); d.point((16, 18), C(p['accent'])); d.point((16, 21), C(p['accent']))
                if p.get('sweater'): d.line([(tx0 + 1, 23), (tx1 - 1, 23)], C(p['shirt_d'])); d.line([(tx0 + 2, 15), (tx1 - 2, 15)], C(p['accent']))  # ribbed hem and collar
                if p.get('overalls'):  # bib and straps in the trouser colour, brass buttons
                    if dir_ == 0:
                        shape(im, lambda d: d.rectangle([13, 18, 19, 24]), p['pants'], p['pants_l'], p['pants_d'], 1)
                        d.line([(13, 15), (13, 18)], C(p['pants'])); d.line([(19, 15), (19, 18)], C(p['pants'])); d.point((14, 19), C('#f6d04d')); d.point((18, 19), C('#f6d04d'))
                    elif dir_ == 3: d.line([(13, 15), (19, 21)], C(p['pants'])); d.line([(19, 15), (13, 21)], C(p['pants'])); shape(im, lambda d: d.rectangle([12, 21, 20, 24]), p['pants'], None, p['pants_d'], 1)
                    else: d.line([(16, 15), (16, 20)], C(p['pants'])); shape(im, lambda d: d.rectangle([13, 20, 19, 24]), p['pants'], None, p['pants_d'], 1)
                if p.get('apron') and dir_ == 0: shape(im, lambda d: d.rectangle([13, 19, 19, 24]), '#fff3e6', None, '#d8c8b8', 1)
            for ax, sw in arms:
                shape(im, lambda d: d.rounded_rectangle([ax, 16 + sw, ax + 2, 22 + sw], 1), p['shirt'], p['shirt_l'], p['shirt_d'], 1)
                shape(im, lambda d: d.rectangle([ax, 22 + sw, ax + 2, 23 + sw]), SKIN, None, None)
            # head
            shape(im, lambda d: d.ellipse([8, 2, 24, 17]), SKIN, SKIN_L, SKIN_D, 1)
            d = ImageDraw.Draw(im)
            if dir_ == 0:
                for ex, out in ((12, -1), (19, 2)): eye(d, p, ex, out)
                d.point((11, 14), C('#f29a9a')); d.point((21, 14), C('#f29a9a')); d.line([(15, 14), (16, 14)], C('#c06060'))
                if p.get('stache'):  # thick moustache over the mouth, bushy brows
                    shape(im, lambda d: d.polygon([(11, 15), (13, 12), (16, 13), (19, 12), (21, 15), (19, 14), (16, 15), (13, 14)]), p['stache'], p['stache_l'], p['stache_d'], 1)
                    d.line([(11, 7), (14, 7)], C(p['stache'])); d.line([(18, 7), (21, 7)], C(p['stache']))
            elif side:
                ex = 10 if dir_ == 1 else 20
                eye(d, p, ex, 2 if dir_ == 2 else -1)
                d.point((ex + (1 if dir_ == 1 else -1), 14), C('#f29a9a'))
                if p.get('stache'):
                    mx = 8 if dir_ == 1 else 19
                    shape(im, lambda d: d.rectangle([mx, 12, mx + 4, 14]), p['stache'], p['stache_l'], p['stache_d'], 1)
                    d.line([(ex - 1, 7), (ex + 2, 7)], C(p['stache']))
            # hair
            H, Hl, Hd = p['hair'], p['hair_l'], p['hair_d']
            if p.get('bald'):  # just a fringe of hair round the back and a shine on top
                if dir_ == 3: shape(im, lambda d: d.chord([8, 2, 24, 17], 10, 170), H, Hl, Hd, 1)
                elif side: shape(im, lambda d: d.polygon([(20, 8), (24, 8), (24, 13), (21, 14)] if dir_ == 1 else [(12, 8), (8, 8), (8, 13), (11, 14)]), H, Hl, Hd, 1)
                else: shape(im, lambda d: d.rectangle([8, 9, 9, 12]), H, None, Hd); shape(im, lambda d: d.rectangle([23, 9, 24, 12]), H, None, Hd)
                d = ImageDraw.Draw(im); d.point((13, 4), C('#ffffff')); d.point((14, 4), C('#ffffff')); d.point((13, 5), C('#ffffff'))
            elif dir_ == 3: shape(im, lambda d: d.ellipse([7, 1, 25, 18]), H, Hl, Hd)
            elif dir_ == 0: shape(im, lambda d: d.polygon(p['fringe']), H, Hl, Hd, 1)
            else:
                pts = p['side']
                if dir_ == 1: pts = [(32 - x, y) for x, y in pts]
                shape(im, lambda d: d.polygon(pts), H, Hl, Hd, 1)
            if p['long'] and dir_ == 3: shape(im, lambda d: d.rounded_rectangle([8, 10, 24, 23], 5), H, Hl, Hd)
            if p.get('cap'):  # baseball cap over the hair: crown, then the brim facing the way the head does
                K, Kl, Kd = p['cap']
                shape(im, lambda d: d.chord([7, 0, 25, 15], 180, 360), K, Kl, Kd, 1)
                d = ImageDraw.Draw(im); d.line([(16, 1), (16, 6)], C(Kd)); d.point((16, 0), C(Kl))
                if dir_ == 0: shape(im, lambda d: d.rounded_rectangle([8, 6, 24, 8], 1), Kd, K, None)
                elif side: shape(im, lambda d: d.rectangle([3, 6, 13, 8] if dir_ == 1 else [19, 6, 29, 8]), Kd, K, None)
                else: d.rectangle([14, 6, 18, 7], C(H))  # strap gap at the back
            if p.get('tail') and dir_ == 3:
                shape(im, lambda d: d.rounded_rectangle([14, 12, 18, 24], 2), H, Hl, Hd, 1); d = ImageDraw.Draw(im); d.line([(14, 12), (18, 12)], C(p['tie']))
            if p.get('tail') and side: d = ImageDraw.Draw(im); tx = 22 if dir_ == 1 else 5; d.line([(tx, 7), (tx + 5, 7)], C(p['tie']))
            if p.get('clip') and dir_ != 2:
                cx = 22 if dir_ != 1 else 18; cy = 4
                for a, b in ((0, -1), (0, 1), (-1, 0), (1, 0)): d.point((cx + a, cy + b), C(p['clip']))
                d.point((cx, cy), C('#f6d04d'))
            outline(im)
            if p.get('child'):  # shorter body under the same head: drop two torso rows and two leg rows
                rows = [y for y in range(S) if y not in (19, 20, 25, 26)]
                short = new(); [short.paste(im.crop((0, y, S, y + 1)), (0, 4 + i)) for i, y in enumerate(rows)]; im = short
            sheet.alpha_composite(im, (f * S, dir_ * S))
    return sheet

MALE = dict(hair='#bd6c4a', hair_l='#d98a62', hair_d='#8a4632', shirt='#6ba446', shirt_l='#8cc35f', shirt_d='#3e7a3a', accent='#a7d46f', eye='#4a3a2a', eye_l='#8a6a4a',
            pants='#4a5a8a', pants_d='#34406a', long=False,
            fringe=[(7, 9), (8, 3), (12, 1), (20, 1), (24, 3), (25, 10), (23, 13), (22, 8), (20, 10), (18, 7), (16, 10), (14, 7), (12, 10), (10, 8), (9, 13)],
            side=[(7, 12), (8, 3), (13, 1), (20, 1), (25, 4), (25, 9), (21, 8), (19, 11), (17, 8), (14, 7), (12, 9), (10, 8), (9, 14)])
FEMALE = dict(hair='#e6a64a', hair_l='#f6c66a', hair_d='#b06a2c', shirt='#f28462', shirt_l='#f9a888', shirt_d='#c34b35', accent='#fec99c', eye='#2f4f8a', eye_l='#6f9ad8',
              pants='#7a5a9a', pants_d='#5a3f78', long=True, clip='#e86a9a', apron=True,
              fringe=[(7, 12), (8, 3), (12, 1), (20, 1), (24, 3), (25, 12), (23, 10), (22, 6), (17, 6), (13, 7), (10, 6), (9, 11)],
              side=[(7, 15), (8, 3), (13, 1), (20, 1), (25, 4), (24, 8), (19, 7), (14, 7), (12, 10), (10, 18)])
# Townsfolk built on the same body as the players.
VILLAGER_M = dict(hair='#7a6a5e', hair_l='#9a8a7e', hair_d='#5a4a40', shirt='#c8343a', shirt_l='#e05a5a', shirt_d='#8a2028', accent='#e05a5a', eye='#4a3a2a', eye_l='#8a6a4a',
                  pants='#3f68a8', pants_l='#5f88c8', pants_d='#2c4a80', long=False, bald=True, overalls=True,
                  stache='#6a4a36', stache_l='#8a6a50', stache_d='#4a3020', fringe=[], side=[])
VILLAGER_F = dict(hair='#7a4a2c', hair_l='#9a6440', hair_d='#55321e', shirt='#f2c230', shirt_l='#fde27a', shirt_d='#c08a18', accent='#fde27a', eye='#3a6a4a', eye_l='#7aaa7a',
                  pants='#4a6aa8', pants_d='#34508a', long=False, tail=True, tie='#c8343a', sweater=True,
                  fringe=[(7, 11), (8, 3), (12, 1), (20, 1), (24, 3), (25, 11), (23, 8), (20, 5), (15, 5), (11, 6), (9, 9)],
                  side=[(7, 11), (8, 3), (13, 1), (20, 1), (25, 4), (25, 8), (20, 6), (14, 6), (11, 8), (9, 12)])
VILLAGER_KID = dict(hair='#c8803a', hair_l='#e09a52', hair_d='#8a5228', shirt='#d8383e', shirt_l='#ee6066', shirt_d='#9a2430', accent='#ee6066', eye='#4a3a2a', eye_l='#8a6a4a',
                    pants='#8a5a36', pants_d='#5f3b25', long=False, sweater=True, child=True, cap=('#d8383e', '#ee6066', '#9a2430'),
                    fringe=[(7, 13), (8, 6), (24, 6), (25, 13), (23, 10), (22, 12), (20, 9), (12, 9), (10, 12), (9, 10)],
                    side=[(7, 7), (17, 7), (15, 10), (13, 13), (9, 15), (7, 12)])

# ---------- assemble ----------
cells, names = [], {}
def add(name, im):
    if im.height == S and im.width == S: names[name] = len(cells); cells.append(im); return
    for j in range(im.height // S):
        for i in range(im.width // S): add(f'{name}_{j * (im.width // S) + i}', cell(im, i * S, j * S))
for k in range(3): add(f'grass{k}', grass(k))
for j in range(3):
    for k in range(3): add(f'path{j * 3 + k}', path(j, k))
for k in range(3): add(f'soil{k}', soil(k))
for kind in ('carrot', 'turnip', 'cabbage'):
    for s in range(4): add(f'{kind}{s}', crop(kind, s))
    add(f'{kind}_item', ITEMS[kind]); add(f'{kind}_packet', packet(ITEMS[kind]))
add('hoe', hoe()); add('can', can()); add('bag', cell(BAGS, 0, 32))
add('tree_green', tall_tree(('#4f9e3a', '#6fc04f', '#357a2a'))); add('tree_orange', tall_tree(('#e0892f', '#f5ad4f', '#b0601f')))
add('tree', small_tree()); add('mushrooms', mushrooms())
add('pine', pine()); add('oak', oak()); add('shrub_large', shrub(2 * S)); add('shrub_flower', shrub(S, True))
add('shrub_small', shrub_small())
for k in range(3): add(f'fence{k}', fence(k))
add('fence3', fence_v())
add('sign', sign()); add('bin', bin_())
add('house', building('#d9583b', '#f07a5a', '#a83a2a', '#c88a50', '#e0a96a', '#9a6436'))
add('shop', building('#5c7fa8', '#7fa3c8', '#3f5a80', '#efe2c8', '#fff4dc', '#c8b898', awning=True))
add('barn', barn())
add('house_brown', cottage('#8a5a3a', '#a87050', '#64402a', '#5e4f5a', '#7a6a76', '#3f343e', '#efe2c8', '#fff4dc', '#b8a888', 'stone',
                           shutters=('#f28fb8', '#f9b4d0', '#c45e7a'), brick_base=True, smoke=True, cx=74))
add('house_blue', cottage('#a8d0e8', '#c8e4f4', '#7aa8c8', '#5f6670', '#7c838c', '#43484f', '#3f5a80', '#5c7fa8', '#2a3e5c', 'brick', cx=8))
add('roses', flower_patch('roses')); add('tulips', flower_patch('tulips'))
COB, BRK, SHAL, DEEP = cobble_tex(), brick_tex(), water_tex('#6cc4d8', '#86d2e2', '#c4eef4'), water_tex('#3a82b4', '#327aa8', '#6eb0d8')
add('cobble0', COB); add('brick0', BRK)
blob_set('cobbleb', COB, grass(0), 'kerb'); blob_set('brickb', BRK, grass(0), 'kerb', (C('#8a3c2c'), C('#7a3426')))
blob_set('shallow', SHAL, grass(0), 'shore'); blob_set('deep', DEEP, SHAL, 'deep')
COLS = 16
sheet = new(COLS * S, math.ceil(len(cells) / COLS) * S)
for i, im in enumerate(cells): sheet.alpha_composite(im, ((i % COLS) * S, (i // COLS) * S))
import os; os.makedirs('assets/art', exist_ok=True)
sheet.save('assets/art/world.png')
farmer(MALE).save('assets/characters/farmer_male.png'); farmer(FEMALE).save('assets/characters/farmer_female.png')
farmer(VILLAGER_M).save('assets/characters/villager_male.png'); farmer(VILLAGER_F).save('assets/characters/villager_female.png')
farmer(VILLAGER_KID).save('assets/characters/villager_child.png')
with open('src/art-index.js', 'w') as f:
    f.write('// Generated by tools/make_art.py: tile names -> index in assets/art/world.png (16 columns of 32x32).\n')
    f.write('export const A = ' + str(names).replace("'", '"') + ';\n')
print(len(cells), 'tiles')
