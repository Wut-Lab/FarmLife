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
def pine():  # 32x64 conifer: stacked tiers of needles over a short trunk
    im = new(S, 2 * S)
    shape(im, lambda d: d.ellipse([7, 56, 25, 62]), '#3c6b2c', None, None)
    shape(im, lambda d: d.rectangle([14, 48, 18, 59]), '#7a4e32', '#9a6440', '#55331f')
    for top, bot, half in ((3, 22, 7), (12, 34, 10), (22, 46, 13), (32, 54, 15)):
        shape(im, lambda d, t=top, b=bot, h=half: d.polygon([(16, t), (16 + h, b), (16 - h, b)]), '#2f7a4a', '#4a9a5e', '#1f5a36')
    speckle(im, ['#4a9a5e', '#1f5a36'], 50, (2, 4, 30, 54), lambda x, y: im.getpixel((x, y))[:3] == C('#2f7a4a')[:3])
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
                if dir_ == 0: d.line([(16, 16), (16, 23)], C(p['shirt_d'])); d.point((16, 18), C(p['accent'])); d.point((16, 21), C(p['accent']))
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
            elif side:
                ex = 10 if dir_ == 1 else 20
                eye(d, p, ex, 2 if dir_ == 2 else -1)
                d.point((ex + (1 if dir_ == 1 else -1), 14), C('#f29a9a'))
            # hair
            H, Hl, Hd = p['hair'], p['hair_l'], p['hair_d']
            if dir_ == 3: shape(im, lambda d: d.ellipse([7, 1, 25, 18]), H, Hl, Hd)
            elif dir_ == 0: shape(im, lambda d: d.polygon(p['fringe']), H, Hl, Hd, 1)
            else:
                pts = p['side']
                if dir_ == 1: pts = [(32 - x, y) for x, y in pts]
                shape(im, lambda d: d.polygon(pts), H, Hl, Hd, 1)
            if p['long'] and dir_ == 3: shape(im, lambda d: d.rounded_rectangle([8, 10, 24, 23], 5), H, Hl, Hd)
            if p.get('clip') and dir_ != 2:
                cx = 22 if dir_ != 1 else 18; cy = 4
                for a, b in ((0, -1), (0, 1), (-1, 0), (1, 0)): d.point((cx + a, cy + b), C(p['clip']))
                d.point((cx, cy), C('#f6d04d'))
            outline(im)
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
for k in range(3): add(f'fence{k}', fence(k))
add('sign', sign()); add('bin', bin_())
add('house', building('#d9583b', '#f07a5a', '#a83a2a', '#c88a50', '#e0a96a', '#9a6436'))
add('shop', building('#5c7fa8', '#7fa3c8', '#3f5a80', '#efe2c8', '#fff4dc', '#c8b898', awning=True))
COLS = 16
sheet = new(COLS * S, math.ceil(len(cells) / COLS) * S)
for i, im in enumerate(cells): sheet.alpha_composite(im, ((i % COLS) * S, (i // COLS) * S))
import os; os.makedirs('assets/art', exist_ok=True)
sheet.save('assets/art/world.png')
farmer(MALE).save('assets/characters/farmer_male.png'); farmer(FEMALE).save('assets/characters/farmer_female.png')
with open('src/art-index.js', 'w') as f:
    f.write('// Generated by tools/make_art.py: tile names -> index in assets/art/world.png (16 columns of 32x32).\n')
    f.write('export const A = ' + str(names).replace("'", '"') + ';\n')
print(len(cells), 'tiles')
