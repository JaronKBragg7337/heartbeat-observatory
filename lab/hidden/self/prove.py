# Proof loop: decode city.png -> run the decoded text in a fresh folder -> compare.
# Usage: python prove.py   (run from this folder, after python city.py)
import hashlib, os, subprocess, sys, tempfile
from PIL import Image, ImageChops

here = os.path.dirname(os.path.abspath(__file__))
sha = lambda p: hashlib.sha256(open(p, "rb").read()).hexdigest()
png = os.path.join(here, "city.png")
src = os.path.join(here, "city.py")
for n in (1, 2):
    work = tempfile.mkdtemp()
    out = os.path.join(work, "decoded.py")
    subprocess.run([sys.executable, os.path.join(here, "decode.py"), png, out], check=True)
    subprocess.run([sys.executable, "decoded.py"], cwd=work, check=True)
    new = os.path.join(work, "city.png")
    print(f"round {n}: decoded text == city.py: {open(out,'rb').read() == open(src,'rb').read()}")
    print(f"  picture in : {sha(png)}")
    print(f"  picture out: {sha(new)}")
    print(f"  bytes same: {sha(png) == sha(new)}   pixels same: {ImageChops.difference(Image.open(png).convert('RGB'), Image.open(new).convert('RGB')).getbbox() is None}")
    png = new
