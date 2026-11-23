# Reads the windows of a city PNG back into text. Knows only the reading rule, not the drawing code:
#   a window is a 3x4 block; lit (warm yellow, red channel 255) = 1, dark (30,40,64) = 0;
#   buildings left to right, window columns left to right, each column top to bottom;
#   every 7 windows = one 7-bit ASCII letter; trailing all-dark letters (code 0) are padding.
# Usage: python decode.py city.png out.py
import sys
from PIL import Image

img = Image.open(sys.argv[1]).convert("RGB")
W, H = img.size
px = img.load()

def kind(x, y):
    r, g, b = px[x, y]
    if r == 255 and g >= 180 and b <= 160:
        return 1
    if (r, g, b) == (30, 40, 64):
        return 0
    return None

wins = {}  # top-left corner of each window -> bit
for y in range(1, H):
    for x in range(1, W):
        k = kind(x, y)
        if k is not None and kind(x - 1, y) is None and kind(x, y - 1) is None:
            wins[(x, y)] = k

columns = {}
for (x, y), k in wins.items():
    columns.setdefault(x, []).append((y, k))
bits = []
for x in sorted(columns):
    bits += [k for y, k in sorted(columns[x])]
text = "".join(chr(int("".join(map(str, bits[i:i + 7])), 2)) for i in range(0, len(bits) - 6, 7))
text = text.rstrip("\x00")
with open(sys.argv[2], "w", newline="\n") as f:
    f.write(text)
print(len(wins), "windows ->", len(text), "characters ->", sys.argv[2])
