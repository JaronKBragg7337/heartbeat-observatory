"""Wet crushed-stone gravel for Turkey Trouble: finer, greyer, lower contrast. PIL + numpy only.
Built from the Poly Haven gravelly_sand scan (CC0), tiled 2x2 (stones half the size), mixed with fine code-made stones."""
import numpy as np, sys
from PIL import Image
PH = r"C:\Users\lilli\Projects\turkey-work\polyhaven\gravelly_sand"
OUT = sys.argv[1]
S = 512
def to_lin(a): return np.where(a <= .04045, a / 12.92, ((a + .055) / 1.055) ** 2.4)
def to_srgb(l): l = np.clip(l, 0, 1); return np.where(l <= .0031308, l * 12.92, 1.055 * l ** (1 / 2.4) - .055)
def load(n, size):
    im = Image.open(f"{PH}/{n}").convert("RGB").resize((size, size), Image.LANCZOS)
    return np.asarray(im).astype(np.float64) / 255
def tile2(a): return np.tile(a, (2, 2, 1))
rng = np.random.default_rng(11)

# --- colour
d = tile2(load("gravelly_sand_diff_1k.jpg", S // 2))
lin = to_lin(d)
L = lin @ np.array([.2126, .7152, .0722])
# fine code-made stones: a wrapped cellular noise at ~6 px cells, each stone its own grey
def cells(n_pts, seed):
    r = np.random.default_rng(seed)
    pts = r.random((n_pts, 2)) * S
    val = r.random(n_pts)
    yy, xx = np.mgrid[0:S, 0:S].astype(np.float64)
    best = np.full((S, S), 1e9); second = np.full((S, S), 1e9); v = np.zeros((S, S))
    for (px, py), pv in zip(pts, val):
        dx = np.abs(xx - px); dx = np.minimum(dx, S - dx)
        dy = np.abs(yy - py); dy = np.minimum(dy, S - dy)
        dd = dx * dx + dy * dy
        m = dd < best
        second = np.where(m, best, np.minimum(second, dd))
        v = np.where(m, pv, v); best = np.where(m, dd, best)
    edge = np.sqrt(second) - np.sqrt(best)          # small at the cracks between stones
    return v, np.clip(edge / 2.5, 0, 1)
v, edge = cells(4200, 5)
stones = (0.62 + 0.76 * v) * (0.5 + 0.5 * edge)     # grey per stone, dark cracks
logL = np.log(np.maximum(L, 1e-4))
logL = logL.mean() + (logL - logL.mean()) * 0.72     # lower contrast in the scan
Ls = np.exp(logL)
Lmix = Ls ** 0.5 * (stones * Ls.mean()) ** 0.5
# a soft wrapped mottle (damp patches), so it is not one flat felt
k = np.fft.fftfreq(S)[:, None] ** 2 + np.fft.fftfreq(S)[None, :] ** 2
mot = np.real(np.fft.ifft2(np.fft.fft2(rng.standard_normal((S, S))) * np.exp(-k * 1500)))
mot = (mot - mot.mean()) / mot.std()
Lmix = Lmix * (1 + 0.13 * mot)
# colour: mostly grey with a faint cool-brown of the scan
chroma = lin / np.maximum(L[..., None], 1e-4)
chroma = 1 + (chroma - 1) * 0.18                     # nearly grey
grey_tint = np.array([0.98, 1.0, 1.03])              # wet stone leans a touch cool
out = Lmix[..., None] * chroma * grey_tint
Lo = out @ np.array([.2126, .7152, .0722])
out *= 0.085 / Lo.mean()
srgb = to_srgb(out)
Image.fromarray((srgb * 255 + 0.5).astype(np.uint8)).save(OUT + r"\ground_gravel.webp", quality=88, method=6)
print("colour mean lin lum", (out @ np.array([.2126, .7152, .0722])).mean(), "srgb mean", srgb.mean(), "std", srgb.std())

# --- normal: the scan's normal tiled 2x2, plus small bumps of the code stones, softened
n = tile2(load("gravelly_sand_nor_gl_1k.jpg", S // 2)) * 2 - 1
h = stones * 1.0                                     # height from the stones
gx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * 0.5
gy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * 0.5
nx = n[..., 0] * 0.6 - gx * 0.9
ny = n[..., 1] * 0.6 + gy * 0.9
nz = np.sqrt(np.clip(1 - nx * nx - ny * ny, 0.05, 1))
nn = np.dstack([nx, ny, nz]); nn /= np.linalg.norm(nn, axis=2, keepdims=True)
Image.fromarray(((nn * 0.5 + 0.5) * 255 + 0.5).clip(0, 255).astype(np.uint8)).save(OUT + r"\ground_gravel_n.webp", quality=92, method=6)
print("normal done")
