# Before | after contact sheets (PNG, committed; the JPEGs beside them are gitignored).  python sheet.py
from PIL import Image, ImageDraw
import os
here = os.path.dirname(os.path.abspath(__file__))
SETS = {
  'sheet-overview': ('d', ['port-from-ship', 'tower-mast-from-the-apron', 'port-one-km', 'pad-01-above', 'sign-eye']),
  'sheet-crew-hall': ('d', ['hall-front-wide', 'hall-door-outside', 'hall-door-inside', 'hall-bar', 'hall-corner', 'hall-interior']),
  'sheet-buildings': ('d', ['depot-door-outside', 'depot-east-wall', 'tower-door-outside', 'tower-reception', 'depot-interior']),
  'sheet-market-fuel-yard': ('d', ['market-row', 'market-trader-1', 'market-trader-2', 'fuel-eye', 'containers-eye']),
  'sheet-apron': ('d', ['pad-01-eye', 'apron-tug', 'pad-02-wear', 'ship-ramp-ground', 'tower-cab-south']),
  'sheet-dusk': ('d', ['port-from-ship-dusk', 'hall-door-outside-dusk', 'market-eye-dusk', 'tower-mast-from-the-apron-dusk', 'sign-eye-dusk', 'fuel-eye-dusk']),
  'sheet-phone': ('p', ['port-from-ship', 'hall-door-outside', 'hall-interior', 'depot-door-outside', 'market-trader-1', 'fuel-eye', 'pad-01-eye', 'tower-door-outside']),
  'sheet-iphone-webkit': ('w', ['port-from-ship', 'hall-door-outside', 'hall-interior', 'market-trader-1']),
}
for name, (tag, names) in SETS.items():
    rows = []
    for n in names:
        b, a = os.path.join(here, f'before-{tag}-{n}.jpg'), os.path.join(here, f'after-{tag}-{n}.jpg')
        if not os.path.exists(a):
            print('missing', name, n); continue
        rows.append((n, Image.open(b).convert('RGB') if os.path.exists(b) else None, Image.open(a).convert('RGB')))
    if not rows: continue
    if tag == 'd':
        W = 560; H = 315
        sheet = Image.new('RGB', (W * 2 + 30, (H + 22) * len(rows) + 8), (18, 18, 20))
        d = ImageDraw.Draw(sheet)
        for i, (n, b, a) in enumerate(rows):
            y = 8 + i * (H + 22)
            d.text((10, y), f'BEFORE   {n}' if b else f'BEFORE   {n}  (did not exist)', fill=(235, 190, 140)); d.text((W + 20, y), f'AFTER   {n}', fill=(140, 220, 160))
            if b: sheet.paste(b.resize((W, H), Image.LANCZOS), (10, y + 14))
            sheet.paste(a.resize((W, H), Image.LANCZOS), (W + 20, y + 14))
    else:
        W = 195; H = 422 if tag == 'p' else 423
        cols = len(rows)
        sheet = Image.new('RGB', ((W + 8) * cols + 8, (H + 18) * 2 + 10), (18, 18, 20))
        d = ImageDraw.Draw(sheet)
        for i, (n, b, a) in enumerate(rows):
            x = 8 + i * (W + 8)
            d.text((x, 4), f'B {n[:22]}', fill=(235, 190, 140)); d.text((x, H + 22), f'A {n[:22]}', fill=(140, 220, 160))
            if b: sheet.paste(b.resize((W, H), Image.LANCZOS), (x, 16))
            sheet.paste(a.resize((W, H), Image.LANCZOS), (x, H + 34))
    sheet.save(os.path.join(here, name + '.png'), optimize=True)
    print('wrote', name, len(rows))
