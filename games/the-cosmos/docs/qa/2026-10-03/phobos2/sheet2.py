# Before | after contact sheets (PNG, committed; the JPEG frames they are cut from are gitignored).   python sheet2.py
from PIL import Image, ImageDraw
import os
here = os.path.dirname(os.path.abspath(__file__))
D = ['1-orbit-whole', '1-orbit-low-grooves', '2-approach-700', '2-approach-final', '3-landing-ship', '3-landing-wide', '4-ground-pad', '4-ground-heroes', '4-hero-lit', '4-pad-aerial', '6-cargo-module', '5-aerial']
SETS = {
  'sheet-phobos-orbit-approach': ('d-phobos', ['1-orbit-whole', '1-orbit-low-grooves', '2-approach-700', '2-approach-final', '5-aerial']),
  'sheet-phobos-landing-ground': ('d-phobos', ['3-landing-ship', '3-landing-wide', '4-ground-pad', '4-pad-aerial', '4-ground-heroes', '6-cargo-module', '6-sky-mars']),
  'sheet-deimos-orbit-approach': ('d-deimos', ['1-orbit-whole', '1-orbit-low-grooves', '2-approach-700', '2-approach-final', '5-aerial']),
  'sheet-deimos-landing-ground': ('d-deimos', ['3-landing-ship', '3-landing-wide', '4-ground-pad', '4-pad-aerial', '4-ground-heroes', '6-cargo-module', '6-sky-mars']),
  'sheet-phone-phobos': ('p-phobos', ['1-orbit-whole', '2-approach-final', '3-landing-ship', '4-ground-pad', '5-aerial', '6-cargo-module']),
  'sheet-phone-deimos': ('p-deimos', ['1-orbit-whole', '2-approach-final', '3-landing-ship', '4-ground-pad', '5-aerial', '6-cargo-module']),
}
for name, (tag, stages) in SETS.items():
    rows = []
    for n in stages:
        b, a = os.path.join(here, f'before-{tag}-{n}.jpg'), os.path.join(here, f'after-{tag}-{n}.jpg')
        if not (os.path.exists(b) and os.path.exists(a)):
            print('missing', name, n); continue
        rows.append((n, Image.open(b).convert('RGB'), Image.open(a).convert('RGB')))
    if not rows: continue
    if tag.startswith('d'):
        W, H = 560, 315
        sheet = Image.new('RGB', (W * 2 + 30, (H + 22) * len(rows) + 8), (18, 18, 20)); d = ImageDraw.Draw(sheet)
        for i, (n, b, a) in enumerate(rows):
            y = 8 + i * (H + 22)
            d.text((10, y), f'BEFORE   {n}', fill=(235, 190, 140)); d.text((W + 20, y), f'AFTER   {n}', fill=(140, 220, 160))
            sheet.paste(b.resize((W, H), Image.LANCZOS), (10, y + 14)); sheet.paste(a.resize((W, H), Image.LANCZOS), (W + 20, y + 14))
    else:
        W, H = 180, 390
        sheet = Image.new('RGB', (W * len(rows) + 10 * (len(rows) + 1), H * 2 + 70), (18, 18, 20)); d = ImageDraw.Draw(sheet)
        d.text((10, 6), 'BEFORE (top) / AFTER (bottom)', fill=(235, 235, 235))
        for i, (n, b, a) in enumerate(rows):
            x = 10 + i * (W + 10)
            d.text((x, 22), n[:26], fill=(200, 200, 200))
            sheet.paste(b.resize((W, H), Image.LANCZOS), (x, 36)); sheet.paste(a.resize((W, H), Image.LANCZOS), (x, 44 + H))
    sheet.save(os.path.join(here, name + '.png'), optimize=True); print('wrote', name)
