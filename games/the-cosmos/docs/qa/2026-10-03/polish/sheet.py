# Before | after contact sheets (PNG, committed; the 1280x720 JPEGs beside them are gitignored).  python sheet.py
from PIL import Image, ImageDraw
import os
here = os.path.dirname(os.path.abspath(__file__))
SETS = {
  'sheet-rover-opening': ('d', ['rover-front34', 'rover-rear34', 'rover-close-cab', 'ride-2-driver', 'ride-1-start', 'ride-5-dash']),
  'sheet-rover-hold': ('d', ['hold-quarter', 'hold-rear', 'hold-seat-driver', 'hold-seat-right', 'hold-driving-chase']),
  'sheet-phobos': ('d', ['rock-tall-rake-9m', 'rock-tall-lit-11m', 'rock-mid-6m', 'field-pad-from-70', 'field-aerial']),
  'sheet-helmets': ('d', ['face-0', 'three-quarter-3', 'three-quarter-1', 'back-1', 'lineup']),
  'sheet-cargo': ('d', ['cargo-side-low', 'cargo-front', 'cargo-end-low', 'cargo-wide']),
  'sheet-phone': ('p', ['rover-front34', 'rover-rear34', 'ride-4-lights', 'hold-seat-driver', 'rock-tall-rake-9m', 'cargo-side-low', 'face-0', 'three-quarter-3']),
}
for name, (tag, names) in SETS.items():
    rows = []
    for n in names:
        b, a = os.path.join(here, f'before-{tag}-{n}.jpg'), os.path.join(here, f'after-{tag}-{n}.jpg')
        if not (os.path.exists(b) and os.path.exists(a)):
            print('missing', name, n); continue
        rows.append((n, Image.open(b).convert('RGB'), Image.open(a).convert('RGB')))
    if not rows: continue
    if tag == 'd':
        W = 560; H = 315
        sheet = Image.new('RGB', (W * 2 + 30, (H + 22) * len(rows) + 8), (18, 18, 20))
        d = ImageDraw.Draw(sheet)
        for i, (n, b, a) in enumerate(rows):
            y = 8 + i * (H + 22)
            d.text((10, y), f'BEFORE   {n}', fill=(235, 190, 140)); d.text((W + 20, y), f'AFTER   {n}', fill=(140, 220, 160))
            sheet.paste(b.resize((W, H), Image.LANCZOS), (10, y + 14)); sheet.paste(a.resize((W, H), Image.LANCZOS), (W + 20, y + 14))
    else:
        W = 195; H = 422
        per = 4
        groups = [rows[i:i + per] for i in range(0, len(rows), per)]
        sheet = Image.new('RGB', ((W * 2 + 16) * per + 12, (H + 22) * len(groups) + 8), (18, 18, 20))
        d = ImageDraw.Draw(sheet)
        for gi, g in enumerate(groups):
            y = 8 + gi * (H + 22)
            for i, (n, b, a) in enumerate(g):
                x = 8 + i * (W * 2 + 16)
                d.text((x, y), f'BEFORE | AFTER  {n}', fill=(235, 220, 200))
                sheet.paste(b.resize((W, H), Image.LANCZOS), (x, y + 14)); sheet.paste(a.resize((W, H), Image.LANCZOS), (x + W + 4, y + 14))
    sheet.save(os.path.join(here, name + '.png'), optimize=True)
    print('wrote', name, sheet.size)
