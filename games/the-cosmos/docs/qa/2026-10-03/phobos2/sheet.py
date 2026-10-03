import sys, os
from PIL import Image
here = os.path.dirname(os.path.abspath(__file__))
names = sys.argv[2:]; out = sys.argv[1]
ims = [Image.open(os.path.join(here, n)).convert('RGB') for n in names]
W = 640; ims = [i.resize((W, int(i.height * W / i.width))) for i in ims]
cols = 2; rows = (len(ims) + 1) // 2; H = max(i.height for i in ims)
s = Image.new('RGB', (W * cols, H * rows))
for k, i in enumerate(ims): s.paste(i, ((k % cols) * W, (k // cols) * H))
s.save(os.path.join(here, out), quality=85)
