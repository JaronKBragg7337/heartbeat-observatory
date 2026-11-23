s = '''
# This city is its own code. Lit window = 1, dark = 0. Window columns left
# to right, each top to bottom, 7 windows = one ASCII letter. Read: this file.
from PIL import Image, ImageDraw, ImageOps
import random
N = chr(10)
src = "s = " + "'" * 3 + s + "'" * 3 + N + "exec(s)" + N
bits = "".join(format(ord(c), "07b") for c in src)
R = random.Random(2026)
plan, room, x = [], 0, 14
while room < len(bits):
    cols, bands = R.choice([10, 12, 14, 16]), R.randint(6, 12)
    plan.append((x, cols, bands))
    room += cols * bands * 7
    x += cols * 5 + 6 + R.randint(4, 14)
W, G = x + 10, 600
H = G + 110
img = Image.new("RGB", (W, H))
d = ImageDraw.Draw(img)
for y in range(G):
    t = y / G
    d.line([(0, y), (W, y)], fill=(int(6 + 24 * t), int(8 + 18 * t), int(26 + 42 * t)))
for i in range(300):
    b = R.randint(80, 230)
    d.point((R.randrange(W), R.randrange(G * 3 // 5)), fill=(b, b, min(255, b + 25)))
mx, my = W * 4 // 5, 46
for r in range(64, 26, -2):
    c = 70 - r
    d.ellipse((mx - r, my - r, mx + r, my + r), fill=(14 + c, 16 + c, 40 + c))
d.ellipse((mx - 26, my - 26, mx + 26, my + 26), fill=(242, 238, 222))
bx = -10
while bx < W:
    w, h = R.randint(26, 70), R.randint(150, 420)
    d.rectangle((bx, G - h, bx + w, G), fill=(20, 24, 44))
    bx += w - R.randint(0, 12)
k = 0
for x, cols, bands in plan:
    rows, w = bands * 7, cols * 5 + 6
    top = G - rows * 6 - 12
    body = R.choice([(34, 38, 56), (42, 36, 52), (30, 42, 54), (46, 46, 62)])
    d.rectangle((x, top, x + w - 1, G), fill=body)
    if R.random() < 0.5:
        ax = x + w // 2
        d.line([(ax, top - 20), (ax, top)], fill=body)
        d.rectangle((ax - 1, top - 23, ax + 1, top - 21), fill=(230, 50, 50))
    for c in range(cols):
        for r in range(rows):
            on = k < len(bits) and bits[k] == "1"
            k += 1
            wx, wy = x + 4 + c * 5, top + 6 + r * 6
            col = (255, R.randint(190, 230), R.randint(90, 150)) if on else (30, 40, 64)
            d.rectangle((wx, wy, wx + 2, wy + 3), fill=col)
d.rectangle((0, G, W, G + 3), fill=(14, 16, 26))
up = ImageOps.flip(img.crop((0, G - (H - G - 4), W, G)))
img.paste(Image.blend(up, Image.new("RGB", up.size, (6, 10, 24)), 0.6), (0, G + 4))
for y in range(G + 5, H, 3):
    d.line([(0, y), (W, y)], fill=(8, 12, 28))
img.save("city.png")
'''
exec(s)
