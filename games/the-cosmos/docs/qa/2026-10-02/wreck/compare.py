# before | after side-by-side sheets. usage: python compare.py
from PIL import Image, ImageDraw
pairs = {
 'descent-approach': ('before-desk-descent-approach', 'after-desk-descent-1-approach'),
 'descent-alarm': ('before-desk-descent-alarm-fwd', 'after-desk-descent-4-alarm-fwd'),
 'cabin-forward': ('before-desk-cabin-fwd', 'after-desk-cabin-1-fwd'),
 'cabin-aft': ('before-desk-cabin-aft', 'after-desk-cabin-2-aft'),
 'cabin-ceiling': ('before-desk-cabin-ceiling', 'after-desk-cabin-6-ceiling'),
 'cabin-door': ('before-desk-cabin-exit', 'after-desk-cabin-7-door'),
 'wreck-front': ('before-desk-ext-front34', 'after-desk-wreck-1-front34'),
 'wreck-side': ('before-desk-ext-side-r', 'after-desk-wreck-2-side-high'),
 'wreck-stern': ('before-desk-ext-stern-close', 'after-desk-wreck-6-stern-close'),
 'wreck-rear': ('before-desk-ext-rear34-r', 'after-desk-wreck-5-rear34-left'),
 'wreck-aerial': ('before-desk-ext-high', 'after-desk-wreck-8-aerial'),
 'crate': ('before-desk-crate-close', 'after-desk-crate-2-close'),
 'wreck-wide': ('before-desk-wreck-dusk-wide', 'after-desk-wreck-10-dusk-wide'),
 'port': ('before-desk-port-horizon', 'after-desk-port-1-horizon'),
 'phone-cabin': ('before-phone-cabin-aft', 'after-phone-cabin-2-aft'),
 'phone-wreck': ('before-phone-ext-front34', 'after-phone-wreck-1-front34'),
 'phone-stern': ('before-phone-ext-stern-close', 'after-phone-wreck-6-stern-close'),
}
for name, (b, a) in pairs.items():
    ib, ia = Image.open(b + '.jpg').convert('RGB'), Image.open(a + '.jpg').convert('RGB')
    s = 640 / ib.width if ib.width > 600 and ib.width > 400 else 1
    w, h = int(ib.width * s), int(ib.height * s)
    S = Image.new('RGB', (w * 2 + 6, h), (255, 255, 255)); S.paste(ib.resize((w, h)), (0, 0)); S.paste(ia.resize((w, h)), (w + 6, 0))
    d = ImageDraw.Draw(S)
    for x, t in ((8, 'BEFORE'), (w + 14, 'AFTER')): d.rectangle([x - 4, 6, x + 62, 24], fill=(0, 0, 0)); d.text((x, 9), t, fill=(255, 255, 255))
    S.save('compare-' + name + '.jpg', quality=88)
print('ok')
