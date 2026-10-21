"""Generate the player character sprite sheets (male and female farmer).

Each sheet is 48x64: 3 columns (idle, step A, step B) x 4 rows (down, left, right, up),
16x16 per frame, drawn in the Kenney Tiny palette so they sit alongside the tilesets.

Run: python3 tools/make_characters.py
"""
from pathlib import Path
from PIL import Image

OUT = Path(__file__).resolve().parent.parent / "assets" / "characters"

BASE = {
    "o": "#3f2631",  # outline
    "s": "#f7c282",  # skin
    "S": "#e19a65",  # skin shadow
    "e": "#262b44",  # eyes
    "b": "#52607c",  # overalls
    "B": "#8c9cb5",  # overall buttons
    "k": "#763b36",  # boots
    "f": "#e86a9a",  # flower clip
}
LOOKS = {
    "male":   {"h": "#bd6c4a", "H": "#763b36", "t": "#6ba446", "T": "#3e7a3a"},
    "female": {"h": "#e6a64a", "H": "#b06a2c", "t": "#f28462", "T": "#c34b35"},
}

LEGS_FRONT = ["..oobbbbbbbboo..", "...obbo..obbo...", "...okko..okko...", "...oooo..oooo..."]
LEGS_SIDE = ["....obbbbbo.....", "....obbbbo......", "....okkkko......", "....oooooo......"]
LEGS_STRIDE = ["....obbbbbo.....", "...obo.obo......", "..okko.okko.....", "..oooo.oooo....."]

MAPS = {
    "male": {
        "down": [
            "................", "....oooooooo....", "...ohhhhhhhho...", "..ohhhhhhhhhho..",
            "..ohHssssssHho..", "..oHsessssesHo..", "..oSssssssssSo..", "...oSSssssSSo...",
            "....otssssto....", "...otttttttto...", "..otbttttttbto..", "..osbbBbbBbbso..",
        ],
        "up": [
            "................", "....oooooooo....", "...ohhhhhhhho...", "..ohhhhhhhhhho..",
            "..ohhhhhhhhhho..", "..oHhhhhhhhhHo..", "..oHHhhhhhhHHo..", "...oHHHHHHHHo...",
            "....otssssto....", "...otttttttto...", "..otbttttttbto..", "..osbbbbbbbbso..",
        ],
        "left": [
            "................", "....ooooooo.....", "...ohhhhhhho....", "..ohhhhhhhhho...",
            "..osssshhhHho...", "..oesssshhHHo...", ".osssssSHHHo....", "..oSsssSSHHo....",
            "....ottttto.....", "....otttttto....", "....otTTtto.....", "....osbbbbo.....",
        ],
    },
    "female": {
        "down": [
            "................", "....oooooooo....", "...ohhhhhhhho...", "..ohhhhhhhhhfo..",
            "..ohHssssssHho..", "..ohsessssesho..", "..ohSsssssSSho..", "..ohhSSssSShho..",
            "..ohhotsstohho..", "..ohhtttttthho..", "..oHtbttttbtHo..", "..osbbBbbBbbso..",
        ],
        "up": [
            "................", "....oooooooo....", "...ohhhhhhhho...", "..ofhhhhhhhhho..",
            "..ohhhhhhhhhho..", "..ohhhhhhhhhho..", "..ohhhhhhhhhho..", "..ohhhhhhhhhho..",
            "..ohhhhhhhhhho..", "..oHhhhhhhhhHo..", "..oHtbttttbtHo..", "..osbbbbbbbbso..",
        ],
        "left": [
            "................", "....ooooooo.....", "...ohhhhhhho....", "..ohhhhhhhhho...",
            "..osssshhhfho...", "..oesssshhhhho..", ".osssssShhhhho..", "..oSsssShhhhho..",
            "....ottohhhho...", "....otttohhho...", "....otTTtoHo....", "....osbbbbo.....",
        ],
    },
}


def lift(rows, left):
    """Walk frame: raise one foot by a row (front/back views)."""
    rows = rows[:]
    a, b = (0, 8) if left else (8, 16)
    for y in (13, 14, 15):
        src = rows[y + 1][a:b] if y < 15 else "." * (b - a)
        rows[y] = rows[y][:a] + src + rows[y][b:]
    return rows


def frames(look):
    m = MAPS[look]
    down, up, side = m["down"] + LEGS_FRONT, m["up"] + LEGS_FRONT, m["left"] + LEGS_SIDE
    stride = m["left"] + LEGS_STRIDE[:]
    return {
        "down": [down, lift(down, True), lift(down, False)],
        "left": [side, stride, side],
        "up": [up, lift(up, True), lift(up, False)],
    }


def draw(rows, pal, mirror=False):
    im = Image.new("RGBA", (16, 16))
    for y, row in enumerate(rows):
        assert len(row) == 16, (y, row)
        for x, c in enumerate(row):
            if c != ".":
                im.putpixel((x, y), tuple(int(pal[c][i:i + 2], 16) for i in (1, 3, 5)) + (255,))
    return im.transpose(Image.FLIP_LEFT_RIGHT) if mirror else im


def build(look):
    pal = {**BASE, **LOOKS[look]}
    f = frames(look)
    sheet = Image.new("RGBA", (48, 64))
    for r, (d, mirror) in enumerate([("down", 0), ("left", 0), ("left", 1), ("up", 0)]):
        for c, rows in enumerate(f[d]):
            sheet.paste(draw(rows, pal, mirror), (c * 16, r * 16))
    return sheet


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for look in LOOKS:
        build(look).save(OUT / f"farmer_{look}.png")
        print("wrote", OUT / f"farmer_{look}.png")
