"""Swap the code-made ground textures for Poly Haven photo scans (CC0). PIL + numpy only."""
import os, sys
import numpy as np
from PIL import Image

PH = r"C:\Users\lilli\Projects\turkey-work\polyhaven"
ASSETS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets")
BEFORE = r"C:\Users\lilli\Projects\turkey-work\ground_before"   # old files (size + brightness reference)
COLOUR_Q, NORMAL_Q = int(os.environ.get("COLOUR_Q", 86)), 92
DESAT = 0.10
# target mean luminance (linear light) per colour file
TARGET = {"ground_mud": 0.045, "ground_gravel": 0.085, "ground_grass": 0.050, "ground_asphalt": 0.030, "ground_stubble": 0.075}
STRAW = np.array([0.80, 0.62, 0.30])   # sRGB dry-straw tint, used for stubble
# out name -> (poly haven folder, colour?, normal?)
JOBS = {
    "ground_mud": ("brown_mud_leaves_01", "diff"), "ground_mud_n": ("brown_mud_leaves_01", "nor_gl"),
    "ground_gravel": ("gravelly_sand", "diff"), "ground_gravel_n": ("gravelly_sand", "nor_gl"),
    "ground_grass": ("leafy_grass", "diff"),
    "ground_stubble": ("leafy_grass", "straw"),
    "ground_asphalt": ("asphalt_02", "diff"), "ground_asphalt_n": ("asphalt_02", "nor_gl"),
}

def to_lin(a): return np.where(a <= .04045, a / 12.92, ((a + .055) / 1.055) ** 2.4)
def to_srgb(l): l = np.clip(l, 0, 1); return np.where(l <= .0031308, l * 12.92, 1.055 * l ** (1 / 2.4) - .055)
def lum(l): return l @ np.array([.2126, .7152, .0722])

def resize_wrap(arr, size):
    """Lanczos resize of a float HxWxC array, padding by wrapping so tile edges stay seamless."""
    h, w, c = arr.shape
    big = np.tile(arr, (3, 3, 1))
    chans = [np.asarray(Image.fromarray(big[..., i].astype(np.float32), "F")
             .resize((size[0] * 3, size[1] * 3), Image.LANCZOS)) for i in range(c)]
    big = np.stack(chans, -1)
    return big[size[1]:2 * size[1], size[0]:2 * size[0]]

def find(folder, kind):
    for f in os.listdir(os.path.join(PH, folder)):
        if f"_{kind}_" in f and f.lower().endswith(".jpg"): return os.path.join(PH, folder, f)
    raise FileNotFoundError((folder, kind))

def seam(a):
    """mean abs diff: wrap seam (col/row edge) vs neighbouring inner pairs."""
    a = a.astype(np.float32)
    s_c = np.abs(a[:, 0] - a[:, -1]).mean(); s_r = np.abs(a[0] - a[-1]).mean()
    i_c = np.abs(a[:, 1:] - a[:, :-1]).mean(); i_r = np.abs(a[1:] - a[:-1]).mean()
    return s_c, i_c, s_r, i_r

def make_colour(src, size, target, straw=False):
    img = np.asarray(Image.open(src).convert("RGB")).astype(np.float32) / 255
    img = resize_wrap(img, size).clip(0, 1)
    l = to_lin(img)
    y = lum(l)[..., None]
    if straw:   # keep the photo's light/dark pattern, recolour toward dry straw (low saturation)
        tint = to_lin(STRAW); tint = tint / lum(tint)
        l = 0.8 * (y * tint) + 0.2 * l
        y = lum(l)[..., None]; l = y + (l - y) * 0.7
    else:
        l = y + (l - y) * (1 - DESAT)                  # pull saturation toward grey
    k = target / lum(l.reshape(-1, 3).mean(0))
    while (np.clip(l * k, 0, 2) > 1).any(axis=-1).mean() > 0.005: k *= .97
    return (to_srgb(l * k) * 255 + .5).astype(np.uint8), k

def make_normal(src, size):
    n = np.asarray(Image.open(src).convert("RGB")).astype(np.float32) / 255 * 2 - 1
    n = resize_wrap(n, size)
    n /= np.maximum(np.linalg.norm(n, axis=-1, keepdims=True), 1e-6)   # OpenGL convention kept (green up)
    return ((n * .5 + .5) * 255 + .5).clip(0, 255).astype(np.uint8)

def main():
    rows = []
    for name, (folder, kind) in JOBS.items():
        oldp = os.path.join(BEFORE, name + ".webp")
        old = np.asarray(Image.open(oldp).convert("RGB")).astype(np.float32) / 255
        size = (old.shape[1], old.shape[0])
        src = find(folder, "diff" if kind == "straw" else kind)
        if kind in ("diff", "straw"): out, k = make_colour(src, size, TARGET[name], kind == "straw")
        else: out, k = make_normal(src, size), None
        sc, ic, sr, ir = seam(out)
        outp = os.path.join(ASSETS, name + ".webp")

        Image.fromarray(out).save(outp, "WEBP", quality=COLOUR_Q if kind != "nor_gl" else NORMAL_Q, method=6)
        newm = lum(to_lin(out / 255.).reshape(-1, 3).mean(0)) if kind != "nor_gl" else None
        oldm = lum(to_lin(old).reshape(-1, 3).mean(0)) if kind != "nor_gl" else None
        rows.append((name, os.path.getsize(oldp) / 1024, os.path.getsize(outp) / 1024, oldm, newm))
        print(f"seam {name:17s} cols edge {sc:.2f} inner {ic:.2f} | rows edge {sr:.2f} inner {ir:.2f}  (src {os.path.basename(src)}, k={k})")
    print(f"\n{'file':17s} {'old KB':>7} {'new KB':>7}  old mean Y -> new mean Y")
    for n, o, w, om, nm in rows:
        print(f"{n:17s} {o:7.1f} {w:7.1f}  " + (f"{om:.4f} -> {nm:.4f}" if om else "-"))
    print("total growth KB:", round(sum(w - o for _, o, w, _, _ in rows), 1))

if __name__ == "__main__": main()
