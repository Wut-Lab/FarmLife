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
    elif kind in SEASONAL: seasonal_crop(im, kind, stage)
    elif kind == 'wheat': wheat_crop(im, stage)
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

# Seasonal crops, drawn from scratch: spinach (spring), tomato (summer), arugula (fall), peas (winter).
SEASONAL = ('spinach', 'tomato', 'arugula', 'peas')
def leaf(im, x, y, w, h, cols): shape(im, lambda d: d.ellipse([x, y, x + w, y + h]), *cols, d=1)
def seasonal_crop(im, kind, stage):
    big = stage == 3; d = ImageDraw.Draw(im)
    if kind == 'spinach':  # a low rosette of round dark leaves
        r = 5 if big else 4
        for a in ((-7, 2), (7, 2), (-4, -3), (4, -3), (0, 0)): leaf(im, 16 + a[0] - r, 18 + a[1] - r, 2 * r, 2 * r - 1, ('#2f7a32', '#4c9c42', '#1f5a26'))
    elif kind == 'arugula':  # tall, narrow, notched leaves
        for x, h in ((-6, 10), (-2, 13), (2, 13), (6, 10)) if big else ((-4, 8), (0, 10), (4, 8)):
            leaf(im, 15 + x, 22 - h, 3, h, ('#6aa83c', '#8cc85a', '#4a8028'))
            for y in range(24 - h, 21, 3): d.point((14 + x, y), C('#4a8028'))
    elif kind == 'tomato':  # a staked bush, with red fruit when ripe
        shape(im, lambda d: d.rectangle([15, 6, 16, 26]), '#a8744a', '#c48e5e', '#6f4426', 1)
        for x, y in ((-6, 10), (4, 8), (-5, 16), (5, 15), (-1, 4)) if big else ((-5, 13), (4, 11), (-1, 8)): leaf(im, 16 + x - 3, y, 7, 5, LEAF)
        if big:
            for x, y in ((9, 13), (19, 12), (12, 19), (20, 19)): shape(im, lambda d, x=x, y=y: d.ellipse([x - 2, y - 2, x + 2, y + 2]), '#d93a2c', '#f26a50', '#9a2a1f', 1)
    else:  # peas: a little trellis with vines and pods
        for x in (10, 22): shape(im, lambda d, x=x: d.rectangle([x, 6, x + 1, 26]), '#a8744a', '#c48e5e', '#6f4426', 1)
        d.line([(10, 10), (23, 10)], C('#6f4426'))
        for x in (13, 19):
            for y in range(12 if big else 16, 26, 4): leaf(im, x - 2, y, 5, 3, LEAF)
        if big:
            for x, y in ((11, 15), (20, 18), (14, 21)): shape(im, lambda d, x=x, y=y: d.rounded_rectangle([x, y, x + 3, y + 6], 1), '#7cc84e', '#a8e078', '#4f9030', 1)
def seasonal_item(kind):
    im = new(); d = ImageDraw.Draw(im)
    if kind == 'spinach':
        for a in ((-5, 0), (5, 0), (0, -3)): leaf(im, 16 + a[0] - 6, 12 + a[1], 12, 11, ('#2f7a32', '#4c9c42', '#1f5a26'))
        shape(im, lambda d: d.rectangle([14, 22, 18, 26]), '#c8a070', '#e0c090', '#8a6a40', 1)
    elif kind == 'arugula':
        for x in (-5, 0, 5): leaf(im, 14 + x, 7, 4, 16, ('#6aa83c', '#8cc85a', '#4a8028'))
        shape(im, lambda d: d.rectangle([13, 22, 19, 25]), '#e8d8b0', '#fff0d0', '#a89870', 1)
    elif kind == 'tomato':
        shape(im, lambda d: d.ellipse([8, 10, 24, 25]), '#d93a2c', '#f26a50', '#9a2a1f')
        for a in ((-4, 0), (4, 0), (0, -2)): leaf(im, 16 + a[0] - 2, 9 + a[1], 4, 3, LEAF)
    else:
        shape(im, lambda d: d.rounded_rectangle([7, 12, 25, 20], 4), '#7cc84e', '#a8e078', '#4f9030')
        for x in (11, 16, 21): shape(im, lambda d, x=x: d.ellipse([x - 2, 14, x + 2, 18]), '#a8e078', '#d0f0a0', '#6aa83c', 1)
    return outline(im)

# Wheat (sold by the robed stranger): a clump of stalks that turn gold, with heavy grain heads.
def wheat_crop(im, stage):  # an unruly clump: stalks of uneven height leaning every which way, heads nodding when ripe
    d = ImageDraw.Draw(im); ripe = stage == 3; stalk = '#d8a838' if ripe else '#6aa83c'
    # (base x, top x, top y, head lean): crossing stalks, a couple bent over
    stalks = ((14, 4, 11, -1), (15, 10, 6, -1), (16, 17, 3, 1), (17, 13, 9, 0), (17, 24, 6, 1), (18, 28, 13, 1), (15, 21, 10, 1)) if ripe else \
             ((14, 8, 14, 0), (16, 13, 10, 0), (16, 19, 12, 0), (18, 24, 15, 0), (15, 17, 16, 0))
    for bx, x, y, _ in stalks: d.line([(bx, 26), (x, y + 3)], C(stalk))
    if ripe:
        for bx, x, y, lean in stalks:  # grain heads tip over in the direction they lean
            shape(im, lambda d, x=x, y=y, lean=lean: d.polygon([(x - 2 + lean, y - 3), (x + 2 + lean, y - 2), (x + 2, y + 4), (x - 1, y + 4)]), '#f2c84a', '#fbe48a', '#b8862a', 1)
            d = ImageDraw.Draw(im); d.line([(x + lean, y - 3), (x + 2 * lean, y - 6)], C('#e8c060'))  # whiskers
        for x, y in ((10, 20), (21, 18)): leaf(im, x, y, 4, 2, ('#b8a040', '#d8c060', '#8a7028'))  # loose dry leaves
    else:
        for bx, x, y, _ in stalks: d.point((x + (1 if x > 16 else -1), y + 5), C('#8cc85a'))
        leaf(im, 9, 21, 5, 2, LEAF); leaf(im, 19, 19, 5, 2, LEAF)
def wheat_item():
    im = new(); d = ImageDraw.Draw(im)
    for x, top in ((11, 7), (16, 5), (21, 7)):
        d.line([(16, 26), (x, top + 6)], C('#d8a838'))
        shape(im, lambda d, x=x, top=top: d.ellipse([x - 3, top, x + 3, top + 9]), '#f2c84a', '#fbe48a', '#b8862a', 1)
    shape(im, lambda d: d.rectangle([13, 19, 19, 21]), '#a8744a', '#c48e5e', '#6f4426', 1)  # tied bundle
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
def shovel():  # long handle with a D grip at the top, rounded pointed blade at the bottom
    im = new(); d = ImageDraw.Draw(im)
    d.line([(11, 21), (24, 7)], C('#a86a3a'), 3); d.line([(12, 20), (23, 8)], C('#c88a50'), 1)
    d.line([(22, 3), (29, 6)], C('#8a5a2e'), 2); d.line([(22, 3), (21, 8)], C('#8a5a2e'), 2); d.line([(29, 6), (26, 10)], C('#8a5a2e'), 2)
    shape(im, lambda d: d.polygon([(9, 17), (15, 23), (12, 27), (4, 30), (5, 22)]), '#9aa7b8', '#d6e0ea', '#6a7688', 1)
    return outline(im)
def shoes():  # a running shoe from the side: red upper, white sole and laces, a swoosh
    im = new()
    shape(im, lambda d: d.polygon([(4, 12), (11, 11), (15, 16), (24, 18), (29, 21), (29, 24), (4, 24)]), '#e0483f', '#f5786a', '#a82c2a', 1)
    shape(im, lambda d: d.rounded_rectangle([3, 23, 30, 27], 2), '#f4f1ea', '#ffffff', '#b8b4aa', 1)
    d = ImageDraw.Draw(im)
    for k in range(3): d.line([(12 + k * 3, 14 + k), (14 + k * 3, 17 + k)], C('#ffffff'))
    d.line([(7, 21), (14, 21), (22, 19)], C('#ffd84a'), 1)
    return outline(im)
def sneakers():  # a low, light trainer: pale blue mesh upper, thin white sole, mint stripe
    im = new()
    shape(im, lambda d: d.polygon([(5, 16), (12, 15), (17, 18), (25, 20), (29, 22), (29, 25), (5, 25)]), '#9fd4ee', '#d2eefa', '#5f9cc0', 1)
    shape(im, lambda d: d.rounded_rectangle([4, 24, 30, 27], 2), '#ffffff', '#ffffff', '#c8c4ba', 1)
    d = ImageDraw.Draw(im)
    for k in range(3): d.point((13 + k * 3, 18 + k), C('#ffffff')); d.point((14 + k * 3, 19 + k), C('#ffffff'))
    d.line([(8, 22), (16, 22), (24, 21)], C('#6fe0b0'), 1)
    return outline(im)
def dig_spot():  # loose earth: a low mound of dark soil with a crack and a few pebbles
    im = new()
    shape(im, lambda d: d.ellipse([7, 15, 25, 26]), '#7a4f2c', '#9a6a40', '#55361e', 1)
    d = ImageDraw.Draw(im)
    d.line([(12, 19), (15, 21), (14, 23)], C('#3f2716')); d.line([(18, 18), (20, 21)], C('#3f2716'))
    for x, y in ((10, 22), (21, 23), (17, 17)): d.point((x, y), C('#c8b89a'))
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
def building(roof, roof_l, roof_d, wall, wall_l, wall_d):
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
        for i in range(4): d.point((x + 2 + i * 5, 80), C(rnd.choice(['#f28fb8', '#f6d04d', '#ffffff'])))
    shape(im, lambda d: d.rounded_rectangle([38, 62, 57, 95], 3), '#8a5a3a', '#a87048', '#5f3b25')
    d.line([(47, 64), (47, 94)], C('#5f3b25')); d.point((53, 80), C('#f6d04d')); d.point((42, 80), C('#f6d04d'))
    return outline(im)

def stall():  # 96x96 seed stall: striped awning on posts, shelves of seed packets, a counter of seed crates, sacks at its feet
    im = new(96, 96); d = ImageDraw.Draw(im); WOOD, WOOD_L, WOOD_D = '#a8744a', '#c48e5e', '#6f4426'
    shape(im, lambda d: d.rectangle([10, 26, 85, 70]), '#8a5a36', '#9a6a42', '#5f3b25')  # back board
    for y in (40, 56): shape(im, lambda d, y=y: d.rectangle([10, y, 85, y + 2]), WOOD, WOOD_L, WOOD_D, 1)  # shelves
    PK = {k: packet(ITEMS[k]).crop((7, 4, 26, 30)).resize((10, 13), Image.BOX) for k in ITEMS}
    for row, y in enumerate((27, 43)):
        for i, x in enumerate(range(13, 82, 12)): im.alpha_composite(PK[('carrot', 'turnip', 'cabbage')[(i + row) % 3]], (x, y))
    for x in (5, 85): shape(im, lambda d, x=x: d.rectangle([x, 12, x + 5, 92]), WOOD, WOOD_L, WOOD_D, 1)  # posts
    # Striped awning, scalloped along the front edge.
    for i, x in enumerate(range(0, 96, 8)):
        top, top_l, top_d = ('#e86a8a', '#f28fb8', '#b8466a') if i % 2 else ('#fff3e6', '#ffffff', '#d8c8b8')
        shape(im, lambda d, x=x: d.polygon([(x + 2, 6), (x + 10, 6), (x + 8, 22), (x, 22)] if x < 48 else [(x - 2, 6), (x + 6, 6), (x + 8, 22), (x, 22)]), top, top_l, None)
        shape(im, lambda d, x=x: d.pieslice([x, 17, x + 8, 27], 0, 180), top, None, top_d, 1)
    shape(im, lambda d: d.rectangle([2, 3, 93, 7]), '#b8466a', '#e86a8a', '#8a2e4a', 1)  # rail along the top
    # Hanging sign with a sprout on it.
    d.line([(38, 22), (38, 28)], C(WOOD_D)); d.line([(57, 22), (57, 28)], C(WOOD_D))
    shape(im, lambda d: d.rounded_rectangle([33, 26, 62, 38], 2), '#e0b47a', '#f0cc98', '#a8744a', 1)
    d.line([(47, 36), (47, 31)], C('#3e7a32'))
    shape(im, lambda d: d.ellipse([41, 28, 47, 32]), '#6cb455', '#8fd16a', '#3e7a32', 1); shape(im, lambda d: d.ellipse([47, 28, 53, 32]), '#6cb455', '#8fd16a', '#3e7a32', 1)
    # Counter with three crates of loose seed on top.
    shape(im, lambda d: d.rectangle([4, 68, 91, 91]), WOOD, WOOD_L, WOOD_D)
    for x in range(12, 90, 8): d.line([(x, 71), (x, 90)], C(WOOD_D))
    shape(im, lambda d: d.rectangle([2, 64, 93, 69]), '#c48e5e', '#e0a96a', '#8a5a36', 1)
    sr = random.Random(21)
    for x, seed in ((10, ('#e0892f', '#f5ad4f')), (38, ('#e8d8a8', '#c8b480')), (66, ('#6a4a8a', '#8a6aaa'))):
        shape(im, lambda d, x=x: d.rectangle([x, 56, x + 19, 65]), '#c88a50', '#e0a96a', '#8a5a36', 1)
        for _ in range(30): d.point((x + sr.randrange(2, 18), sr.randrange(55, 59)), C(sr.choice(seed)))
        d.line([(x + 1, 61), (x + 18, 61)], C('#8a5a36'))
    # Burlap seed sacks leaning on the counter's front corners.
    for x in (3, 76):
        shape(im, lambda d, x=x: d.rounded_rectangle([x, 76, x + 16, 95], 5), '#d8bf8a', '#ead6a8', '#a88a5a')
        shape(im, lambda d, x=x: d.rectangle([x + 4, 73, x + 12, 78]), '#c8ae78', '#ead6a8', '#a88a5a', 1)
        d.line([(x + 3, 79), (x + 13, 79)], C('#8a6a3a')); d.line([(x + 8, 86), (x + 8, 90)], C('#3e7a32'))
        for a, b in ((6, 85), (7, 86), (5, 84), (10, 85), (9, 86), (11, 84)): d.point((x + a, b), C('#6cb455'))
    return outline(im)

FONT = {'G': '111100101101111', 'E': '111100110100111', 'N': '111101101101101', 'R': '110101110101101', 'A': '010101111101101',
        'L': '100100100100111', 'S': '111100111001111', 'T': '111010010010010', 'O': '111101101101111', 'X': '101101010101101', 'I': '111010010010111', ' ': '000000000000000'}
def text(d, x, y, msg, col):  # 3x5 pixel capitals
    for ch in msg:
        for k, b in enumerate(FONT[ch]):
            if b == '1': d.point((x + k % 3, y + k // 3), C(col))
        x += 4
def store():  # 192x128 general store: green gable roof with a name board, striped awning, display windows, goods out front,
    # and a covered patio stall on its right side
    im = new(6 * S, 4 * S); d = ImageDraw.Draw(im); G, Gl, Gd = '#4f8a4a', '#6fae5f', '#2f5a30'
    patio(im, G, Gl, Gd)
    shape(im, lambda d: d.rectangle([6, 56, 121, 118]), '#efe6d2', '#fffaf0', '#c8bca4')  # walls
    for y in range(62, 118, 6): d.line([(7, y), (120, y)], C('#d8ccb4'))
    shape(im, lambda d: d.polygon([(0, 60), (14, 8), (114, 8), (127, 60)]), G, Gl, Gd, 3)
    sh = new(6 * S, 4 * S); sd = ImageDraw.Draw(sh)
    for r, y in enumerate(range(14, 58, 7)):
        for x in range(4 + (r % 2) * 5, 126, 10): sd.arc([x - 5, y - 4, x + 5, y + 4], 20, 160, C(Gd))
    for x, y in [(x, y) for y in range(8, 58) for x in range(128) if sh.getpixel((x, y))[3] and im.getpixel((x, y))[:3] == C(G)[:3]]: im.putpixel((x, y), C(Gd))
    shape(im, lambda d: d.rectangle([0, 57, 127, 61]), Gd, None, None)
    shape(im, lambda d: d.rounded_rectangle([40, 24, 87, 42], 2), '#f6e7c1', '#fff8e0', '#c8a878', 1)  # name board
    d.rectangle([42, 26, 85, 40], outline=C('#a8744a')); text(d, 50, 28, 'GENERAL', '#2f5a30'); text(d, 54, 34, 'STORE', '#b8372f')
    # Display windows with goods on shelves, and a glazed door.
    for x in (12, 84):
        shape(im, lambda d, x=x: d.rectangle([x, 80, x + 31, 105]), '#f6e7c1', '#fff8e0', '#c8a878', 1)
        shape(im, lambda d, x=x: d.rectangle([x + 2, 82, x + 29, 103]), '#7fb3d8', '#b9dcf2', '#4f80aa', 1)
        for y in (91, 101): d.line([(x + 3, y), (x + 28, y)], C('#a8744a'))
        for i, gx in enumerate(range(x + 4, x + 27, 5)):
            c1, c2 = ('#e8504a', '#f6d04d', '#6cb455', '#f28fb8', '#e0892f')[i % 5], ('#f4f2ee', '#c88a50', '#e8504a', '#6a4a8a', '#4a8ad8')[i % 5]
            d.rectangle([gx, 87, gx + 2, 90], C(c1)); d.rectangle([gx, 97, gx + 2, 100], C(c2))
        shape(im, lambda d, x=x: d.rectangle([x - 1, 106, x + 32, 108]), '#a8744a', '#c48e5e', None)
    shape(im, lambda d: d.rounded_rectangle([53, 78, 74, 118], 2), '#4f8a4a', '#6fae5f', '#2f5a30')
    shape(im, lambda d: d.rectangle([56, 82, 71, 100]), '#7fb3d8', '#b9dcf2', '#4f80aa', 1); d.point((70, 106), C('#f6d04d'))
    shape(im, lambda d: d.rectangle([4, 116, 123, 127]), '#9a968e', '#b4b0a8', '#706c66', 1)  # foundation
    shape(im, lambda d: d.rectangle([48, 118, 79, 124]), '#a8a49c', '#c4c0b8', '#7a766e', 1)  # step
    # Striped awning over the front.
    for i, x in enumerate(range(4, 124, 8)):
        top, top_l, top_d = ('#4f8a4a', '#6fae5f', '#2f5a30') if i % 2 else ('#fff3e6', '#ffffff', '#d8c8b8')
        shape(im, lambda d, x=x: d.polygon([(x, 62), (x + 7, 62), (x + 7, 72), (x, 72)]), top, top_l, None)
        shape(im, lambda d, x=x: d.pieslice([x, 68, x + 7, 77], 0, 180), top, None, top_d, 1)
    # Goods out front: apple barrel, produce crates, potted flowers, sacks and a broom.
    shape(im, lambda d: d.rounded_rectangle([4, 106, 22, 127], 3), '#a8744a', '#c48e5e', '#6f4426')
    for y in (110, 122): d.line([(5, y), (21, y)], C('#5f6168'))
    for x, y in ((7, 105), (11, 104), (15, 105), (19, 105), (9, 102), (14, 102), (17, 102)):
        shape(im, lambda d, x=x, y=y: d.ellipse([x - 2, y - 2, x + 2, y + 2]), '#d83838', '#f06060', '#a02020', 1)
    for x, y, c in ((25, 114, ('#e0892f', '#f5ad4f', '#b0601f')), (37, 114, ('#6cb455', '#8fd16a', '#3e7a32')), (31, 104, ('#f6d04d', '#fde27a', '#c08a18'))):
        shape(im, lambda d, x=x, y=y: d.rectangle([x, y, x + 13, y + 11]), '#c88a50', '#e0a96a', '#8a5a36', 1)
        d.line([(x + 1, y + 6), (x + 12, y + 6)], C('#8a5a36'))
        for k in range(4): shape(im, lambda d, x=x, y=y, k=k: d.ellipse([x + 1 + k * 3, y - 2, x + 4 + k * 3, y + 1]), *c, 1)
    for x in (84, 96):  # flower pots
        shape(im, lambda d, x=x: d.polygon([(x, 116), (x + 10, 116), (x + 8, 127), (x + 2, 127)]), '#c8643a', '#e0845a', '#8a3e22', 1)
        shape(im, lambda d, x=x: d.ellipse([x - 1, 108, x + 11, 117]), '#4e9440', '#6cb455', '#356c2c', 1)
        for a, b in ((2, 110), (6, 109), (9, 112), (4, 113)): d.point((x + a, b), C('#f28fb8' if x == 84 else '#f6d04d'))
    for x in (108, 116):  # sacks
        shape(im, lambda d, x=x: d.rounded_rectangle([x - 2, 112, x + 9, 127], 4), '#d8bf8a', '#ead6a8', '#a88a5a')
        d.line([(x, 115), (x + 7, 115)], C('#8a6a3a'))
    d.line([(124, 96), (121, 120)], C('#8a5a36'), 2)  # broom leaning on the wall
    shape(im, lambda d: d.polygon([(118, 119), (125, 119), (126, 127), (116, 127)]), '#e0c070', '#f0d890', '#a88a40', 1)
    return outline(im)
def patio(im, G, Gl, Gd):  # lean-to on the store's right, open at the back: plank deck, green roof with a striped valance, a table of produce
    d = ImageDraw.Draw(im); WOOD, WOOD_L, WOOD_D = '#a8744a', '#c48e5e', '#6f4426'
    shape(im, lambda d: d.rectangle([118, 112, 191, 124]), WOOD, WOOD_L, WOOD_D, 1)  # deck
    for x in range(126, 190, 9): d.line([(x, 113), (x, 123)], C(WOOD_D))
    shape(im, lambda d: d.rectangle([118, 123, 191, 127]), '#8a5a36', None, '#5f3b25', 1)
    for x in (122, 184): shape(im, lambda d, x=x: d.rectangle([x, 70, x + 4, 122]), WOOD, WOOD_L, WOOD_D, 1)  # posts
    shape(im, lambda d: d.polygon([(118, 54), (191, 66), (191, 74), (118, 74)]), G, Gl, Gd, 2)  # lean-to roof
    for x in range(126, 190, 8): d.line([(x, 56 + (x - 118) * 12 // 73), (x, 72)], C(Gd))
    for i, x in enumerate(range(118, 190, 8)):  # valance
        top, top_l, top_d = (G, Gl, Gd) if i % 2 else ('#fff3e6', '#ffffff', '#d8c8b8')
        shape(im, lambda d, x=x: d.rectangle([x, 74, x + 7, 78]), top, top_l, None)
        shape(im, lambda d, x=x: d.pieslice([x, 75, x + 7, 82], 0, 180), top, None, top_d, 1)
    shape(im, lambda d: d.pieslice([150, 80, 162, 90], 0, 180), '#a8744a', '#c48e5e', '#6f4426', 1)  # hanging flower basket
    shape(im, lambda d: d.ellipse([149, 79, 163, 86]), '#4e9440', '#6cb455', '#356c2c', 1)
    for a, b in ((152, 81), (156, 80), (160, 82), (154, 84), (158, 84)): d.point((a, b), C('#f28fb8'))
    # Table with a checked cloth and baskets of produce.
    shape(im, lambda d: d.rectangle([134, 100, 180, 104]), '#d83838', '#f06060', '#a02020', 1)
    for x in range(135, 180, 4):
        for y in (101, 103): d.point((x + (y == 103) * 2, y), C('#fff3e6'))
    shape(im, lambda d: d.rectangle([134, 104, 180, 112]), '#d83838', '#f06060', '#a02020', 1)
    for x in range(136, 180, 4): d.line([(x, 105), (x, 111)], C('#fff3e6'))
    for x in (138, 176): d.line([(x, 112), (x, 118)], C(WOOD_D), 2)
    for x, c in ((136, ('#e0892f', '#f5ad4f', '#b0601f')), (151, ('#6a4a8a', '#8a6aaa', '#4a2a6a')), (166, ('#d83838', '#f06060', '#a02020'))):
        shape(im, lambda d, x=x: d.pieslice([x, 92, x + 12, 104], 0, 180), '#c88a50', '#e0a96a', '#8a5a36', 1)
        for k in range(3): shape(im, lambda d, x=x, k=k: d.ellipse([x + 1 + k * 3, 94, x + 6 + k * 3, 99]), *c, 1)
    shape(im, lambda d: d.ellipse([170, 112, 182, 123]), '#e0892f', '#f5ad4f', '#b0601f', 1)  # pumpkin on the deck
    d.line([(176, 113), (176, 121)], C('#b0601f')); d.line([(176, 110), (177, 112)], C('#3e7a32'), 2)

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

# ---------- more variety: cars, wildflowers, dandelions, rocks, a stone house ----------
def chrome(im, box): shape(im, lambda d: d.rounded_rectangle(box, 1), '#d8dce0', '#ffffff', '#9aa0a8', 1)
def lamp(im, box): shape(im, lambda d: d.ellipse(box), '#fff4c0', '#ffffff', '#c8b878', 1)
def taxi():  # 96x64 yellow sedan with a roof sign, checker stripe and a dented rear door
    im = new(3 * S, 2 * S); d = ImageDraw.Draw(im); Y, Yl, Yd = '#f2c230', '#fde27a', '#b8861a'
    d.ellipse([8, 58, 90, 63], (0, 0, 0, 60))
    shape(im, lambda d: d.polygon([(22, 32), (32, 18), (62, 18), (72, 32)]), Y, Yl, Yd)  # cabin
    shape(im, lambda d: d.rounded_rectangle([2, 30, 93, 52], 5), Y, Yl, Yd)  # body
    shape(im, lambda d: d.polygon([(27, 31), (34, 21), (46, 21), (46, 31)]), '#7fb3d8', '#b9dcf2', '#4f80aa', 1)
    shape(im, lambda d: d.polygon([(49, 21), (60, 21), (67, 31), (49, 31)]), '#7fb3d8', '#b9dcf2', '#4f80aa', 1)
    shape(im, lambda d: d.rounded_rectangle([38, 11, 56, 18], 1), '#fff4c0', '#ffffff', '#c8b878', 1)  # roof sign
    text(d, 40, 12, 'TAXI', '#2a2a30')
    for i, x in enumerate(range(6, 90, 3)):  # checker band
        for j in range(2): d.rectangle([x, 39 + j * 2, x + 1, 40 + j * 2], C('#2a2a30' if (i + j) % 2 else '#f4f2ee'))
    d.line([(47, 32), (47, 50)], C(Yd)); d.line([(70, 33), (70, 50)], C(Yd)); d.line([(24, 33), (24, 50)], C(Yd))
    d.line([(40, 35), (43, 35)], C('#d8dce0')); d.line([(62, 35), (65, 35)], C('#d8dce0'))
    for x, y, c in ((29, 43, Yd), (30, 44, Yd), (31, 45, Yd), (32, 45, Yd), (33, 44, Yd), (34, 43, Yd), (30, 42, Yl), (33, 42, Yl), (31, 43, '#d8a828'), (32, 43, '#d8a828'),
                    (28, 47, '#9aa0a8'), (29, 48, '#9aa0a8'), (30, 48, '#9aa0a8')):  # the dent and a scrape
        d.point((x, y), C(c))
    lamp(im, [87, 34, 92, 39]); d.rectangle([3, 34, 4, 38], C('#e8504a'))
    chrome(im, [84, 48, 95, 52]); chrome(im, [0, 48, 10, 52])
    wheel(im, 21, 53, 8); wheel(im, 75, 53, 8)
    return outline(im)
def suv():  # 96x64 big black full-size SUV: boxy, tall, tinted glass, chrome grille and trim
    im = new(3 * S, 2 * S); d = ImageDraw.Draw(im); K, Kl, Kd = '#2a2a32', '#4a4a58', '#141418'
    d.ellipse([6, 58, 92, 63], (0, 0, 0, 70))
    shape(im, lambda d: d.polygon([(3, 14), (64, 14), (74, 28), (93, 31), (93, 52), (3, 52)]), K, Kl, Kd)
    shape(im, lambda d: d.rectangle([6, 11, 60, 13]), '#9aa0a8', '#d8dce0', None)  # roof rails
    for box in ([7, 17, 22, 28], [25, 17, 44, 28], [47, 17, 62, 28]): shape(im, lambda d, box=box: d.rectangle(box), '#3a4a5a', '#5a7088', '#222a34', 1)
    shape(im, lambda d: d.polygon([(64, 17), (71, 28), (64, 28)]), '#3a4a5a', '#5a7088', '#222a34', 1)
    for x in (10, 28, 50): d.line([(x, 26), (x + 5, 19)], C('#7a90a8'))  # glare on the tint
    d.line([(4, 36), (92, 36)], C('#9aa0a8'))  # chrome belt line
    for x in (24, 45, 66): d.line([(x, 30), (x, 50)], C(Kd))
    for x in (38, 59): d.line([(x, 33), (x + 3, 33)], C('#d8dce0'))
    shape(im, lambda d: d.rectangle([86, 33, 93, 46]), '#b8bcc4', '#e8ecf0', '#7a8088', 1)  # grille
    for y in range(35, 46, 3): d.line([(87, y), (92, y)], C('#7a8088'))
    lamp(im, [82, 31, 88, 35]); d.rectangle([3, 30, 5, 38], C('#c8343a'))
    shape(im, lambda d: d.rectangle([24, 50, 66, 52]), '#3a3a42', '#5a5a62', None)  # step bar
    chrome(im, [84, 48, 95, 53]); chrome(im, [0, 48, 9, 53])
    wheel(im, 20, 52, 10); wheel(im, 76, 52, 10)
    return outline(im)

def wild_tile(m, cols, seed):  # meadow of small flowers; thins out toward edges with no meadow beside them
    im = grass(0); wr = random.Random(seed)
    put = lambda x, y, c: im.putpixel((x % S, y % S), C(c))  # wraps, so blooms on a tile edge carry on in the next tile
    open_sides = [k for k, b in enumerate((N_, E_, S_, W_)) if not m & b]
    corners = [((31, 0) if b == NE else (31, 31) if b == SE else (0, 31) if b == SW else (0, 0)) for b, a, c in ((NE, N_, E_), (SE, S_, E_), (SW, S_, W_), (NW, N_, W_)) if m & a and m & c and not m & b]
    def room(x, y):
        dist = [(y, 31 - x, 31 - y, x)[k] for k in open_sides] + [math.hypot(x - cx, y - cy) for cx, cy in corners]
        return min(dist, default=99)
    for _ in range(30):  # leafy sprigs under the flowers
        x, y = wr.randrange(1, 31), wr.randrange(2, 31)
        if room(x, y) > wr.uniform(2, 12): put(x, y, '#5aa042'); put(x + 1, y - 1, '#4e9440')
    for _ in range(46):
        x, y, c = wr.randrange(32), wr.randrange(32), wr.choice(cols)
        if room(x, y) < wr.uniform(2, 14): continue
        if wr.random() < .65:  # five-petal bloom
            for a, b in ((1, 0), (-1, 0), (0, -1), (0, 1)): put(x + a, y + b, c)
            put(x, y, '#fff6c0'); put(x + 1, y + 2, '#4e9440')
        else:  # small bud on a stem
            put(x, y, c); put(x, y + 1, '#4e9440')
    return im
def dandelions():  # rosettes of toothed leaves, yellow heads and two seed clocks, loose ones fading into the grass
    im = new(); d = ImageDraw.Draw(im); dr = random.Random(31)
    for cx, cy in ((10, 26), (21, 27)):
        for a in range(0, 360, 40):
            r = math.radians(a); x1, y1 = cx + 7 * math.cos(r), cy + 3 * math.sin(r)
            shape(im, lambda d, x1=x1, y1=y1, cx=cx, cy=cy: d.polygon([(cx, cy - 1), (x1, y1), (cx, cy + 1)]), '#5a9e42', '#7cc35a', '#3e7a32', 1)
    d = ImageDraw.Draw(im)
    for x0, y0, x1, y1 in ((10, 25, 8, 14), (11, 25, 14, 18), (21, 26, 22, 12), (20, 26, 18, 20)): d.line([(x0, y0), (x1, y1)], C('#5a9e42'))
    for cx, cy in ((14, 17), (18, 19)):
        shape(im, lambda d, cx=cx, cy=cy: d.ellipse([cx - 3, cy - 3, cx + 3, cy + 3]), '#f6d04d', '#fde27a', '#d8a020', 1); d.point((cx, cy), C('#e8b020'))
    for cx, cy in ((8, 11), (22, 9)):  # seed clocks
        shape(im, lambda d, cx=cx, cy=cy: d.ellipse([cx - 4, cy - 4, cx + 4, cy + 4]), '#f4f2ee', '#ffffff', '#c8c4bc', 1)
        for a in range(0, 360, 45): d.point((round(cx + 2 * math.cos(math.radians(a))), round(cy + 2 * math.sin(math.radians(a)))), C('#d8d4cc'))
    outline(im)
    for x, y in ((3, 18), (28, 16), (4, 30), (29, 30), (15, 4), (27, 3)):  # loose heads and a drifting seed, no outline
        d.point((x, y + 1), C('#4e9440')); d.point((x, y), C('#f6d04d')); d.point((x + 1, y), C('#f6d04d'))
    d.point((14, 2), C('#ffffff')); d.point((30, 9), C('#ffffff'))
    return im
def rock(size):  # grey boulders with a lit top face, cracks and a patch of moss
    w, h = (S, S) if size != 'large' else (2 * S, 2 * S)
    im = new(w, h); d = ImageDraw.Draw(im); rr = random.Random({'small': 41, 'medium': 42, 'large': 43}[size])
    pts = {'small': [(10, 29), (9, 25), (12, 21), (18, 20), (22, 23), (23, 28), (20, 30)],
           'medium': [(4, 30), (3, 23), (7, 15), (14, 11), (22, 12), (28, 18), (29, 26), (26, 30)],
           'large': [(4, 61), (2, 46), (6, 32), (14, 22), (28, 16), (42, 17), (54, 24), (61, 38), (62, 54), (56, 62)]}[size]
    d.ellipse([pts[0][0], h - 5, pts[-1][0] + 2, h - 1], (0, 0, 0, 50))
    shape(im, lambda d: d.polygon(pts), '#8e8a84', '#b4b0a8', '#5f5c58', 2 if size != 'small' else 1)
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]; x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    top = Image.new('L', im.size); ImageDraw.Draw(top).ellipse([x0 + 2, y0 + 1, x1 - (x1 - x0) // 3, y0 + (y1 - y0) // 2], 255)
    for y in range(h):
        for x in range(w):
            if top.getpixel((x, y)) and im.getpixel((x, y))[:3] == C('#8e8a84')[:3]: im.putpixel((x, y), C('#a29e96'))
    for _ in range((x1 - x0) * (y1 - y0) // 12):  # grain
        x, y = rr.randrange(x0, x1), rr.randrange(y0, y1)
        if im.getpixel((x, y))[:3] in (C('#8e8a84')[:3], C('#a29e96')[:3]): im.putpixel((x, y), C(rr.choice(('#7a766f', '#b4b0a8'))))
    if size != 'small':  # cracks
        cx = (x0 + x1) // 2; d.line([(cx, y0 + 3), (cx - 2, (y0 + y1) // 2), (cx + 1, y1 - 3)], C('#5f5c58'))
        if size == 'large': d.line([(x0 + 10, y0 + 18), (x0 + 18, y0 + 24), (x0 + 16, y1 - 6)], C('#5f5c58'))
    for _ in range({'small': 4, 'medium': 9, 'large': 26}[size]):  # moss on the lower left
        x, y = rr.randrange(x0, (x0 + x1) // 2), rr.randrange((y0 + y1) // 2, y1)
        if im.getpixel((x, y))[3] > 200 and im.getpixel((x, y))[:3] != OUT[:3]: d.point((x, y), C(rr.choice(('#6a9a42', '#86b452'))))
    return outline(im)

def stones(im, box, seed):  # fill a box with irregular courses of fieldstone
    d = ImageDraw.Draw(im); sr = random.Random(seed); x0, y0, x1, y1 = box
    d.rectangle(box, C('#6e6a62'))
    for y in range(y0, y1, 6):
        x = x0 - sr.randrange(0, 6)
        while x < x1:
            w = sr.randrange(6, 13); c = sr.choice(('#a8a294', '#b4ae9e', '#9c968a', '#aca69a'))
            bx = [max(x + 1, x0), y + 1, min(x + w - 1, x1), min(y + 5, y1)]
            if bx[0] < bx[2]:
                d.rounded_rectangle(bx, 1, C(c)); d.line([(bx[0] + 1, bx[1]), (bx[2] - 1, bx[1])], shade(C(c), 22))
                d.line([(bx[0] + 1, bx[3]), (bx[2] - 1, bx[3])], shade(C(c), -22))
            x += w
def stone_house():  # 160x128: fieldstone cottage with two front gables, a side chimney and a wooden lean-to shed
    im = new(5 * S, 4 * S); d = ImageDraw.Draw(im); R, Rl, Rd = '#55606e', '#6e7a88', '#3a434e'
    # Shed on the right, behind the house's end wall.
    shape(im, lambda d: d.rectangle([116, 74, 155, 121]), '#8a5a36', '#a8744a', '#5f3b25')
    for x in range(121, 155, 6): d.line([(x, 76), (x, 120)], C('#5f3b25'))
    shape(im, lambda d: d.rectangle([126, 88, 145, 121]), '#a8744a', '#c48e5e', '#6f4426', 1)
    d.line([(127, 90), (144, 119)], C('#6f4426'), 2); d.line([(127, 104), (144, 104)], C('#6f4426'))
    shape(im, lambda d: d.polygon([(112, 58), (159, 70), (159, 77), (112, 77)]), R, Rl, Rd, 2)  # shed roof
    for x in range(118, 158, 6): d.line([(x, 60 + (x - 112) * 12 // 47), (x, 75)], C(Rd))
    for y in range(108, 121, 4):  # firewood stacked against it
        for x in range(148 + (y // 4 % 2) * 2, 158, 4): shape(im, lambda d, x=x, y=y: d.ellipse([x, y, x + 3, y + 3]), '#c88a50', '#e0a96a', '#8a5a36', 1)
    # Main walls and roof.
    stones(im, (6, 64, 119, 119), 51)
    shape(im, lambda d: d.polygon([(0, 70), (12, 22), (108, 22), (122, 70)]), R, Rl, Rd, 3)
    sh = new(5 * S, 4 * S); sd = ImageDraw.Draw(sh)
    for r, y in enumerate(range(28, 68, 6)):
        for x in range(4 + (r % 2) * 4, 122, 8): sd.line([(x, y - 3), (x, y)], C(Rd)); sd.line([(x - 4, y), (x + 4, y)], C(Rd))
    for x, y in [(x, y) for y in range(22, 70) for x in range(124) if sh.getpixel((x, y))[3] and im.getpixel((x, y))[:3] == C(R)[:3]]: im.putpixel((x, y), C(Rd))
    shape(im, lambda d: d.rectangle([0, 66, 123, 70]), Rd, None, None)
    # Two front gables: shingled triangles with a round window, trimmed by roof bands.
    for gx in (16, 70):
        pk = (gx + 18, 30)
        shape(im, lambda d, gx=gx, pk=pk: d.polygon([(gx, 72), pk, (gx + 36, 72)]), '#e8dcc0', '#f6ecd4', '#c4b494')
        for y in range(40, 72, 4): d.line([(gx + 2, y), (gx + 34, y)], C('#c4b494'))
        shape(im, lambda d, pk=pk: d.ellipse([pk[0] - 5, 46, pk[0] + 5, 56]), '#f6e7c1', '#fff8e0', None)
        shape(im, lambda d, pk=pk: d.ellipse([pk[0] - 3, 48, pk[0] + 3, 54]), '#7fb3d8', '#b9dcf2', '#4f80aa', 1)
        d.line([(pk[0], 48), (pk[0], 54)], C('#f6e7c1')); d.line([(pk[0] - 3, 51), (pk[0] + 3, 51)], C('#f6e7c1'))
        # mask the gable triangle back into shape where the shingle lines spilled, then the roof bands
        for x in range(gx - 4, gx + 41):
            for y in range(28, 73):
                if not inside_poly([(gx, 72), pk, (gx + 36, 72)], x, y) and im.getpixel((x, y))[:3] in (C('#c4b494')[:3],): im.putpixel((x, y), C(R))
        d.line([(gx - 3, 74), pk, (gx + 39, 74)], C(R), 4); d.line([(gx - 3, 76), (pk[0], 33), (gx + 39, 76)], C(Rd), 1)
    stones(im, (6, 74, 119, 119), 52)
    for x in (22, 76):  # windows under the gables, with stone lintels
        shape(im, lambda d, x=x: d.rectangle([x, 84, x + 23, 103]), '#f6e7c1', '#fff8e0', None)
        shape(im, lambda d, x=x: d.rectangle([x + 2, 86, x + 21, 101]), '#7fb3d8', '#b9dcf2', '#4f80aa', 1)
        d.line([(x + 12, 86), (x + 12, 101)], C('#f6e7c1')); d.line([(x + 2, 93), (x + 21, 93)], C('#f6e7c1'))
        shape(im, lambda d, x=x: d.rectangle([x - 2, 80, x + 25, 83]), '#c8c2b4', '#e0dacc', '#8e887c', 1)
        shape(im, lambda d, x=x: d.rectangle([x - 1, 104, x + 24, 106]), '#c8c2b4', '#e0dacc', '#8e887c', 1)
    shape(im, lambda d: d.chord([53, 82, 69, 98], 180, 360), '#7a4a2c', '#9a6440', '#55321e')  # arched door
    shape(im, lambda d: d.rectangle([53, 90, 69, 119]), '#7a4a2c', '#9a6440', '#55321e')
    for x in (57, 61, 65): d.line([(x, 88), (x, 118)], C('#55321e'))
    d.point((66, 104), C('#f6d04d')); d.arc([51, 80, 71, 100], 180, 360, C('#c8c2b4'), 2)
    shape(im, lambda d: d.rectangle([4, 118, 121, 124]), '#7a766e', '#9a968e', '#55524c', 1)  # footing
    shape(im, lambda d: d.rectangle([49, 119, 73, 125]), '#a8a49c', '#c4c0b8', '#7a766e', 1)  # step
    # Chimney up the left end wall.
    stones(im, (1, 10, 14, 123), 53); shape(im, lambda d: d.rectangle([0, 6, 15, 10]), '#7a766e', '#9a968e', '#55524c', 1)
    d.rectangle([4, 2, 11, 6], C('#3a3a42'))
    return outline(im)

def wanderer_robe(im, d, dir_, step, p):  # long robe over the legs: a flared skirt that sways with the step
    K, Kl, Kd = p['robe']
    pts = [(11, 16), (21, 16), (24 - step, 28), (8 - step, 28)] if dir_ in (0, 3) else [(12, 16), (20, 16), (22 + step, 28), (10 + step, 28)]
    shape(im, lambda d: d.polygon(pts), K, Kl, Kd, 1)
    d = ImageDraw.Draw(im)
    if dir_ == 0: d.line([(16, 18), (16, 27)], C(Kd))
    d.line([(pts[3][0] + 1, 27), (pts[2][0] - 1, 27)], C(Kd))

# ---------- vehicles (side view, facing right) ----------
def wheel(im, cx, cy, r):
    shape(im, lambda d: d.ellipse([cx - r, cy - r, cx + r, cy + r]), '#3a3a42', '#55555e', '#22222a', 1)
    h = r // 2; shape(im, lambda d: d.ellipse([cx - h, cy - h, cx + h, cy + h]), '#d8dce0', '#ffffff', '#9aa0a8', 1)
    im.putpixel((cx, cy), C('#6a6e76'))
def pickup():  # 96x64 rounded fifties pickup in faded red, chrome grille and bumpers
    im = new(3 * S, 2 * S); d = ImageDraw.Draw(im); R, Rl, Rd = '#b8372f', '#d65a4a', '#82211e'
    d.ellipse([10, 58, 92, 63], (0, 0, 0, 60))
    shape(im, lambda d: d.rounded_rectangle([4, 30, 46, 50], 2), R, Rl, Rd)  # bed
    shape(im, lambda d: d.rectangle([4, 29, 46, 32]), '#d65a4a', '#e8806e', Rd, 1)
    shape(im, lambda d: d.ellipse([8, 37, 38, 59]), R, Rl, Rd)  # rear fender
    shape(im, lambda d: d.polygon([(40, 50), (40, 18), (44, 11), (63, 11), (69, 27), (90, 29), (93, 35), (93, 48), (40, 50)]), R, Rl, Rd)  # cab and hood
    shape(im, lambda d: d.ellipse([60, 34, 92, 60]), R, Rl, Rd)  # front fender
    shape(im, lambda d: d.polygon([(45, 15), (61, 15), (65, 27), (45, 27)]), '#7fb3d8', '#b9dcf2', '#4f80aa', 1)  # window
    d.line([(64, 30), (64, 47)], C(Rd)); d.line([(42, 30), (42, 47)], C(Rd)); d.line([(57, 33), (60, 33)], C('#d8dce0'))  # door and handle
    shape(im, lambda d: d.rectangle([38, 49, 62, 51]), '#4a4a52', None, '#2a2a30', 1)  # running board
    for x in range(88, 93, 2): d.line([(x, 37), (x, 46)], C('#d8dce0'))  # grille
    shape(im, lambda d: d.ellipse([84, 30, 90, 36]), '#fff4c0', '#ffffff', '#c8b878', 1)  # headlight
    shape(im, lambda d: d.rounded_rectangle([84, 47, 95, 51], 1), '#d8dce0', '#ffffff', '#9aa0a8', 1)  # bumpers
    shape(im, lambda d: d.rounded_rectangle([0, 46, 8, 50], 1), '#d8dce0', '#ffffff', '#9aa0a8', 1)
    d.rectangle([4, 34, 5, 37], C('#f6d04d'))  # tail light
    for x, y in ((14, 33), (30, 42), (70, 40), (50, 44)): d.point((x, y), C('#9a5a3a'))  # a few rust spots
    wheel(im, 23, 53, 9); wheel(im, 76, 53, 9)
    return outline(im)
def small_car():  # 64x64 little rounded blue hatchback
    im = new(2 * S, 2 * S); d = ImageDraw.Draw(im); B, Bl, Bd = '#4a8ad8', '#72aaee', '#2e5ea8'
    d.ellipse([6, 58, 58, 63], (0, 0, 0, 60))
    shape(im, lambda d: d.ellipse([10, 20, 52, 50]), B, Bl, Bd)  # cabin dome
    shape(im, lambda d: d.rounded_rectangle([2, 36, 61, 54], 7), B, Bl, Bd)  # body
    shape(im, lambda d: d.polygon([(16, 25), (29, 23), (29, 35), (13, 35)]), '#7fb3d8', '#b9dcf2', '#4f80aa', 1)
    shape(im, lambda d: d.polygon([(33, 23), (43, 25), (49, 35), (33, 35)]), '#7fb3d8', '#b9dcf2', '#4f80aa', 1)
    d.line([(31, 38), (31, 51)], C(Bd)); d.line([(25, 40), (28, 40)], C('#d8dce0'))
    shape(im, lambda d: d.ellipse([55, 39, 60, 44]), '#fff4c0', '#ffffff', '#c8b878', 1); d.rectangle([3, 40, 4, 43], C('#e8504a'))
    shape(im, lambda d: d.rounded_rectangle([54, 49, 63, 53], 1), '#d8dce0', '#ffffff', '#9aa0a8', 1)
    shape(im, lambda d: d.rounded_rectangle([0, 49, 8, 53], 1), '#d8dce0', '#ffffff', '#9aa0a8', 1)
    wheel(im, 15, 53, 7); wheel(im, 48, 53, 7)
    return outline(im)
def box_truck():  # 128x96 white box van with a red cab
    im = new(4 * S, 3 * S); d = ImageDraw.Draw(im); R, Rl, Rd = '#c8343a', '#e05a5a', '#8a2028'
    d.ellipse([8, 89, 122, 95], (0, 0, 0, 60))
    shape(im, lambda d: d.rectangle([6, 76, 122, 83]), '#4a4a52', None, '#2a2a30', 1)  # chassis
    shape(im, lambda d: d.rounded_rectangle([2, 10, 88, 78], 2), '#f4f2ee', '#ffffff', '#c8c4bc', 3)  # box
    for x in range(14, 86, 12): d.line([(x, 13), (x, 75)], C('#dcd8d0'))
    d.line([(4, 14), (86, 14)], C('#dcd8d0')); d.line([(4, 72), (86, 72)], C('#c8c4bc'))
    shape(im, lambda d: d.polygon([(90, 80), (90, 34), (112, 34), (122, 52), (125, 56), (125, 80)]), R, Rl, Rd)  # cab
    shape(im, lambda d: d.polygon([(94, 38), (110, 38), (118, 52), (94, 52)]), '#7fb3d8', '#b9dcf2', '#4f80aa', 1)
    d.line([(112, 55), (112, 78)], C(Rd)); d.line([(104, 58), (108, 58)], C('#d8dce0'))
    shape(im, lambda d: d.rectangle([87, 40, 89, 50]), '#3a3a42', None, None)  # mirror
    shape(im, lambda d: d.ellipse([119, 59, 124, 64]), '#fff4c0', '#ffffff', '#c8b878', 1)
    shape(im, lambda d: d.rounded_rectangle([116, 77, 127, 82], 1), '#d8dce0', '#ffffff', '#9aa0a8', 1)
    d.rectangle([3, 66, 5, 70], C('#e8504a'))
    for cx in (22, 44, 108): wheel(im, cx, 84, 10)
    return outline(im)

# ---------- characters ----------
SKIN, SKIN_L, SKIN_D = '#f5c7a0', '#ffdcc0', '#d99a78'
def eye(d, p, ex, out):
    """2x4 eye: lash line on top, white glint, iris, lighter bottom. out = side for the outer lash flick."""
    d.line([(ex, 9), (ex + 1, 9)], C('#2a1a2a'))
    if p['long'] or p.get('lashes'): d.point((ex + out, 9 - (out > 0) * 0), C('#2a1a2a')); d.point((ex + out, 8), C('#2a1a2a'))
    d.point((ex, 10), C('#ffffff')); d.point((ex + 1, 10), C(p['eye']))
    d.line([(ex, 11), (ex + 1, 11)], C(p['eye'])); d.line([(ex, 12), (ex + 1, 12)], C(p['eye_l']))
def farmer(p):
    sheet = new(3 * S, 4 * S); SK, SKL, SKD = p.get('skin', (SKIN, SKIN_L, SKIN_D))
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
                        shape(im, lambda d, off=off: d.rectangle([14 + off, 28 - (1 if off < 0 else 0), 18 + off if dir_ == 2 else 17 + off, 30 - (1 if off < 0 else 0)]), p.get('shoes', '#5f3b25'), None, None)
                    break
                shape(im, lambda d: d.rectangle([lx, 23, lx + 2, 28 - max(0, lift)]), p['pants'], None, p['pants_d'], 1)
                shape(im, lambda d: d.rectangle([lx, 28 - max(0, lift), lx + 2, 30 - max(0, lift)]), p.get('shoes', '#5f3b25'), None, None)
            if p.get('robe'): wanderer_robe(im, d, dir_, step, p)
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
                if p.get('apron') is True and dir_ == 0: shape(im, lambda d: d.rectangle([13, 19, 19, 24]), '#fff3e6', None, '#d8c8b8', 1)
                if isinstance(p.get('apron'), tuple):  # full bib apron in the given colours, tied at the back
                    A_, Al, Ad = p['apron']
                    if dir_ == 0:
                        shape(im, lambda d: d.rectangle([12, 17, 20, 24]), A_, Al, Ad, 1)
                        d.line([(13, 15), (13, 16)], C(Ad)); d.line([(19, 15), (19, 16)], C(Ad)); d.line([(14, 21), (18, 21)], C(Ad)); d.line([(16, 21), (16, 23)], C(Ad))
                    elif dir_ == 3: d.line([(12, 20), (20, 20)], C(A_)); d.point((15, 21), C(A_)); d.point((17, 21), C(A_)); d.point((16, 20), C(Ad)); d.line([(16, 15), (16, 19)], C(A_))
                    else: shape(im, lambda d: d.rectangle([12, 17, 14, 24] if dir_ == 1 else [18, 17, 20, 24]), A_, Al, Ad, 1)
            for ax, sw in arms:
                if p.get('tee'):  # short sleeves, bare forearms
                    shape(im, lambda d: d.rounded_rectangle([ax, 16 + sw, ax + 2, 23 + sw], 1), SK, SKL, SKD, 1)
                    shape(im, lambda d: d.rounded_rectangle([ax, 16 + sw, ax + 2, 19 + sw], 1), p['shirt'], p['shirt_l'], p['shirt_d'], 1)
                    continue
                shape(im, lambda d: d.rounded_rectangle([ax, 16 + sw, ax + 2, 22 + sw], 1), p['shirt'], p['shirt_l'], p['shirt_d'], 1)
                shape(im, lambda d: d.rectangle([ax, 22 + sw, ax + 2, 23 + sw]), SK, None, None)
            # head
            shape(im, lambda d: d.ellipse([8, 2, 24, 17]), SK, SKL, SKD, 1)
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
            if p.get('robe'):  # deep hood; the face inside stays in shadow but for two glinting eyes
                K, Kl, Kd = p['robe']
                shape(im, lambda d: d.polygon([(6, 12), (9, 3), (16, -1), (23, 3), (26, 12), (25, 19), (7, 19)]), K, Kl, Kd, 1)
                d = ImageDraw.Draw(im)
                if dir_ != 3:
                    box = [10, 6, 22, 18] if dir_ == 0 else [6, 7, 13, 17] if dir_ == 1 else [19, 7, 26, 17]
                    shape(im, lambda d: d.ellipse(box), '#241a2c', None, '#140e1a', 1)
                    d = ImageDraw.Draw(im)
                    for ex in ((12, 19) if dir_ == 0 else (8,) if dir_ == 1 else (23,)): d.line([(ex, 11), (ex + 1, 11)], C('#e8e0a0'))
                else: d.line([(16, 4), (16, 18)], C(Kd))
            elif p.get('bald'):  # just a fringe of hair round the back and a shine on top
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
                shape(im, lambda d: d.chord([7, 1, 25, 15], 180, 360), K, Kl, Kd, 1)
                d = ImageDraw.Draw(im); d.line([(16, 2), (16, 6)], C(Kd)); d.point((16, 1), C(Kl))
                if dir_ == 0: shape(im, lambda d: d.rounded_rectangle([8, 6, 24, 8], 1), Kd, K, None)
                elif side: shape(im, lambda d: d.rectangle([3, 6, 13, 8] if dir_ == 1 else [19, 6, 29, 8]), Kd, K, None)
                else: d.rectangle([14, 6, 18, 7], C(H))  # strap gap at the back
            d = ImageDraw.Draw(im)
            if p.get('stubble') and dir_ != 3:  # dotted shadow along the jaw
                xs = range(10, 23) if dir_ == 0 else range(8, 17) if dir_ == 1 else range(16, 25)
                for y in range(13, 18):
                    for x in xs:
                        if im.getpixel((x, y))[:3] in (C(SK)[:3], C(SKD)[:3]) and (x + y) % 2 and not (dir_ == 0 and 14 <= x <= 17 and y == 14):
                            im.putpixel((x, y), C(p['stubble']))
            if p.get('glasses') and dir_ != 3:  # thin round frames, arms back to the ears
                F = C(p['glasses'])
                for ex in ((12, 19) if dir_ == 0 else (10 if dir_ == 1 else 20,)):
                    d.line([(ex - 1, 8), (ex + 2, 8)], F); d.line([(ex - 1, 13), (ex + 2, 13)], F); d.line([(ex - 2, 9), (ex - 2, 12)], F); d.line([(ex + 3, 9), (ex + 3, 12)], F)
                if dir_ == 0: d.point((16, 10), F)
                elif dir_ == 1: d.line([(14, 10), (16, 10)], F)
                else: d.line([(16, 10), (17, 10)], F)
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
SHOPKEEPER = dict(hair='#5a3a28', hair_l='#7a5440', hair_d='#3a2418', shirt='#f4f2ee', shirt_l='#ffffff', shirt_d='#c8c4bc', accent='#f4f2ee', eye='#3a5a7a', eye_l='#7a9aba',
                  pants='#4a6aa8', pants_d='#34508a', long=False, sweater=True, tee=True, apron=('#8a5a36', '#a8744a', '#5f3b25'),
                  glasses='#3a2a2a', stubble='#b88a72',
                  fringe=[(7, 10), (8, 3), (12, 1), (20, 1), (24, 3), (25, 10), (24, 7), (21, 5), (14, 5), (10, 6), (8, 9)],
                  side=[(7, 11), (8, 3), (13, 1), (20, 1), (25, 4), (25, 7), (20, 5), (13, 5), (11, 7), (9, 12)])
STOREKEEPER = dict(hair='#8a3a26', hair_l='#aa5638', hair_d='#5e2418', shirt='#4f9a8a', shirt_l='#6fbaa8', shirt_d='#33706a', accent='#6fbaa8', eye='#5a3a2a', eye_l='#9a6a4a',
                   pants='#6a4a3a', pants_d='#4a3228', long=False, lashes=True, tail=True, tie='#f6d04d', sweater=True, apron=('#f4f2ee', '#ffffff', '#c8c4bc'),
                   fringe=VILLAGER_F['fringe'], side=VILLAGER_F['side'])
WANDERER = dict(hair='#3a2a3a', hair_l='#4a3a4a', hair_d='#2a1a2a', shirt='#4a3a5a', shirt_l='#6a5a7e', shirt_d='#2e2238', accent='#c8a868', eye='#e8e0a0', eye_l='#e8e0a0',
                pants='#4a3a5a', pants_d='#2e2238', long=False, sweater=True, robe=('#4a3a5a', '#6a5a7e', '#2e2238'), fringe=[], side=[])

# Wilds travellers: a few body styles drawn in key colours that the game swaps for random ones (src/traveller.js keeps the same keys).
KEY = dict(hair='#ff0001', hair_l='#ff0002', hair_d='#ff0003', shirt='#00ff01', shirt_l='#00ff02', shirt_d='#00ff03', accent='#00ff02',
           pants='#0100ff', pants_l='#0200ff', pants_d='#0300ff', eye='#ff01ff', eye_l='#ff02ff', skin=('#01ffff', '#02ffff', '#03ffff'),
           stache='#ff0001', stache_l='#ff0002', stache_d='#ff0003', tie='#00ff03', shoes='#fe0101')
TRAVELLERS = {
    'short': dict(KEY, long=False, fringe=MALE['fringe'], side=MALE['side']),
    'long': dict(KEY, long=True, fringe=FEMALE['fringe'], side=FEMALE['side']),
    'tail': dict(KEY, long=False, tail=True, sweater=True, fringe=VILLAGER_F['fringe'], side=VILLAGER_F['side']),
    'bald': dict(KEY, long=False, bald=True, overalls=True, fringe=[], side=[]),
    'cap': dict(KEY, long=False, tee=True, cap=('#00ff03', '#00ff02', '#00ff03'), fringe=VILLAGER_KID['fringe'], side=VILLAGER_KID['side']),
}
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
add('shop', stall())
add('barn', barn()); add('store', store())
add('house_brown', cottage('#8a5a3a', '#a87050', '#64402a', '#5e4f5a', '#7a6a76', '#3f343e', '#efe2c8', '#fff4dc', '#b8a888', 'stone',
                           shutters=('#f28fb8', '#f9b4d0', '#c45e7a'), brick_base=True, smoke=True, cx=74))
add('house_blue', cottage('#a8d0e8', '#c8e4f4', '#7aa8c8', '#5f6670', '#7c838c', '#43484f', '#3f5a80', '#5c7fa8', '#2a3e5c', 'brick', cx=8))
add('pickup', pickup()); add('car_small', small_car()); add('box_truck', box_truck())
add('roses', flower_patch('roses')); add('tulips', flower_patch('tulips'))
COB, BRK, SHAL, DEEP = cobble_tex(), brick_tex(), water_tex('#6cc4d8', '#86d2e2', '#c4eef4'), water_tex('#3a82b4', '#327aa8', '#6eb0d8')
add('cobble0', COB); add('brick0', BRK)
blob_set('cobbleb', COB, grass(0), 'kerb'); blob_set('brickb', BRK, grass(0), 'kerb', (C('#8a3c2c'), C('#7a3426')))
blob_set('shallow', SHAL, grass(0), 'shore'); blob_set('deep', DEEP, SHAL, 'deep')
add('shovel', shovel()); add('shoes', shoes())
add('sneakers', sneakers()); add('dig_spot', dig_spot())
for kind in SEASONAL:
    for st in range(4): add(f'{kind}{st}', crop(kind, st))
    add(f'{kind}_item', seasonal_item(kind)); add(f'{kind}_packet', packet(seasonal_item(kind)))
add('taxi', taxi()); add('suv', suv())
WILD = {'wildcool': ('#6a8ae8', '#9a7ae0', '#c8b8f0', '#f4f2ff', '#5ab0d8'), 'wildwarm': ('#f06a4a', '#f6a03a', '#f6d04d', '#e8507a', '#ff9a8a')}
for name, cols in WILD.items():
    for i, m in enumerate(BLOB): add(f'{name}{i}', wild_tile(m, cols, 61 if name == 'wildcool' else 62))  # same blooms in every piece; edges only thin them out
add('dandelions', dandelions()); add('rock_small', rock('small')); add('rock_medium', rock('medium')); add('rock_large', rock('large'))
add('stone_house', stone_house())
for st in range(4): add(f'wheat{st}', crop('wheat', st))
add('wheat_item', wheat_item()); add('wheat_packet', packet(wheat_item()))
COLS = 16
sheet = new(COLS * S, math.ceil(len(cells) / COLS) * S)
for i, im in enumerate(cells): sheet.alpha_composite(im, ((i % COLS) * S, (i // COLS) * S))
import os; os.makedirs('assets/art', exist_ok=True)
sheet.save('assets/art/world.png')
farmer(MALE).save('assets/characters/farmer_male.png'); farmer(FEMALE).save('assets/characters/farmer_female.png')
farmer(VILLAGER_M).save('assets/characters/villager_male.png'); farmer(VILLAGER_F).save('assets/characters/villager_female.png')
farmer(VILLAGER_KID).save('assets/characters/villager_child.png')
farmer(SHOPKEEPER).save('assets/characters/shopkeeper.png')  # Fredrick
farmer(STOREKEEPER).save('assets/characters/storekeeper.png')  # runs the general store
farmer(WANDERER).save('assets/characters/wanderer.png')  # hooded stranger, kept for a later event
for k_, p_ in TRAVELLERS.items(): farmer(p_).save(f'assets/characters/traveller_{k_}.png')
with open('src/art-index.js', 'w') as f:
    f.write('// Generated by tools/make_art.py: tile names -> index in assets/art/world.png (16 columns of 32x32).\n')
    f.write('export const A = ' + str(names).replace("'", '"') + ';\n')
print(len(cells), 'tiles')
