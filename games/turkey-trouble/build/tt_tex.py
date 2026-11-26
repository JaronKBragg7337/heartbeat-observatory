# Turkey Trouble: every surface texture, made by code (numpy). Nothing is downloaded.
# Each maker gives (albedo HxWx3 in sRGB 0..1, height HxW 0..1, roughness HxW 0..1). All tile seamlessly.
# Row 0 is the BOTTOM row (Blender's image order), so "up" in a texture is increasing row.
import numpy as np

S = 512


def lattice(size, cells, rng):
    g = rng.random((cells, cells)).astype(np.float32)
    idx = np.arange(size) * cells / size
    i0 = np.floor(idx).astype(int) % cells
    i1 = (i0 + 1) % cells
    f = (idx - np.floor(idx)).astype(np.float32)
    s = f * f * (3 - 2 * f)
    a, b, c, d = g[i0][:, i0], g[i0][:, i1], g[i1][:, i0], g[i1][:, i1]
    top = a * (1 - s)[None, :] + b * s[None, :]
    bot = c * (1 - s)[None, :] + d * s[None, :]
    return top * (1 - s)[:, None] + bot * s[:, None]


def fbm(size, cells, octaves, rng, gain=0.5):
    out = np.zeros((size, size), np.float32)
    amp, tot = 1.0, 0.0
    for o in range(octaves):
        c = cells * 2 ** o
        if c > size // 2:
            break
        out += amp * lattice(size, c, rng)
        tot += amp
        amp *= gain
    return out / tot


def stretch(size, cells_x, cells_y, rng):
    """value noise with different cell counts across and up (for grain and streaks)"""
    g = rng.random((cells_y, cells_x)).astype(np.float32)
    def axis(cells):
        idx = np.arange(size) * cells / size
        i0 = np.floor(idx).astype(int) % cells
        f = (idx - np.floor(idx)).astype(np.float32)
        return i0, (i0 + 1) % cells, f * f * (3 - 2 * f)
    x0, x1, sx = axis(cells_x)
    y0, y1, sy = axis(cells_y)
    a, b, c, d = g[y0][:, x0], g[y0][:, x1], g[y1][:, x0], g[y1][:, x1]
    top = a * (1 - sx)[None, :] + b * sx[None, :]
    bot = c * (1 - sx)[None, :] + d * sx[None, :]
    return top * (1 - sy)[:, None] + bot * sy[:, None]


def cells_noise(size, n, rng):
    """distance to the nearest of n random points, wrapped: pebbles and cracks. Gives (d1, d2 - d1), both 0..1-ish"""
    pts = rng.random((n, 2)).astype(np.float32) * size
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32)
    d1 = np.full((size, size), 1e9, np.float32)
    d2 = np.full((size, size), 1e9, np.float32)
    for px, py in pts:
        dx = np.abs(xx - px); dx = np.minimum(dx, size - dx)
        dy = np.abs(yy - py); dy = np.minimum(dy, size - dy)
        d = np.sqrt(dx * dx + dy * dy)
        closer = d < d1
        d2 = np.where(closer, d1, np.minimum(d2, d))
        d1 = np.where(closer, d, d1)
    scale = size / np.sqrt(n)
    return d1 / scale, (d2 - d1) / scale


def normal_map(height, strength):
    dx = (np.roll(height, -1, 1) - np.roll(height, 1, 1)) * strength
    dy = (np.roll(height, -1, 0) - np.roll(height, 1, 0)) * strength
    n = np.dstack([-dx, -dy, np.ones_like(height)])
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    return (n * 0.5 + 0.5).astype(np.float32)


def mix(a, b, t):
    t = np.clip(t, 0, 1)[..., None]
    return a * (1 - t) + b * t


def col(r, g, b):
    return np.array([r, g, b], np.float32)


def smooth(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


# ---------------------------------------------------------------- ground
def mud(rng):
    base = fbm(S, 4, 6, rng)
    fine = fbm(S, 32, 3, rng)
    d1, edge = cells_noise(S, 260, rng)
    pebble = smooth(0.34, 0.12, d1) * (fbm(S, 8, 3, rng) > 0.52)
    height = 0.55 * base + 0.2 * fine + 0.35 * pebble
    alb = mix(col(0.105, 0.078, 0.055)[None, None], col(0.19, 0.145, 0.10)[None, None], base * 1.2 - 0.1)
    alb = mix(alb, col(0.26, 0.24, 0.21)[None, None], pebble * 0.8)
    alb *= (0.85 + 0.3 * fine)[..., None]
    rough = np.clip(0.55 + 0.4 * base - 0.3 * (1 - fine), 0.2, 1)
    return alb, height, rough


def gravel(rng):
    d1, edge = cells_noise(S, 900, rng)
    stone = smooth(0.5, 0.15, d1)
    d1b, _ = cells_noise(S, 2600, rng)
    small = smooth(0.5, 0.2, d1b)
    tint = fbm(S, 64, 2, rng)
    big = fbm(S, 4, 4, rng)
    height = 0.6 * stone + 0.3 * small + 0.1 * big
    alb = mix(col(0.20, 0.185, 0.165)[None, None], col(0.42, 0.40, 0.37)[None, None], stone * (0.5 + 0.8 * tint))
    alb = mix(alb, col(0.10, 0.09, 0.08)[None, None], (1 - stone) * (1 - small) * 0.9)
    alb *= (0.8 + 0.4 * big)[..., None]
    rough = np.clip(0.6 + 0.3 * (1 - stone), 0.3, 1)
    return alb, height, rough


def grass(rng):
    big = fbm(S, 3, 5, rng)
    blades = stretch(S, 180, 22, rng) * 0.6 + stretch(S, 90, 12, rng) * 0.4
    fine = fbm(S, 64, 2, rng)
    dry = smooth(0.42, 0.62, big)
    alb = mix(col(0.11, 0.135, 0.05)[None, None], col(0.30, 0.25, 0.11)[None, None], dry)
    alb = mix(alb, col(0.06, 0.07, 0.03)[None, None], smooth(0.6, 0.2, blades) * 0.7)
    alb = mix(alb, col(0.36, 0.31, 0.16)[None, None], smooth(0.72, 0.95, blades) * 0.5)
    alb *= (0.85 + 0.3 * fine)[..., None]
    height = 0.7 * blades + 0.3 * big
    rough = np.clip(0.75 + 0.2 * fine, 0, 1)
    return alb, height, rough


def asphalt(rng):
    fine = fbm(S, 128, 2, rng)
    d1, _ = cells_noise(S, 3200, rng)
    agg = smooth(0.42, 0.12, d1)
    big = fbm(S, 3, 5, rng)
    _, crack_e = cells_noise(S, 22, rng)
    warp = fbm(S, 8, 3, rng)
    crack = smooth(0.035, 0.0, crack_e + (warp - 0.5) * 0.06) * (big > 0.45)
    alb = mix(col(0.045, 0.047, 0.05)[None, None], col(0.11, 0.11, 0.115)[None, None], agg * 0.8 + fine * 0.3)
    alb *= (0.75 + 0.5 * big)[..., None]
    alb = mix(alb, col(0.015, 0.015, 0.016)[None, None], crack)
    height = 0.5 * agg + 0.2 * fine + 0.3 * big - 0.6 * crack
    rough = np.clip(0.45 + 0.35 * agg - 0.25 * (1 - big), 0.12, 1)
    return alb, height, rough


def stubble(rng):
    """a cut cornfield seen from above: rows of pale stubs on dark soil; rows run across (along x)"""
    base, h, r = mud(rng)
    yy, xx = np.mgrid[0:S, 0:S].astype(np.float32)
    row = (np.cos(yy / S * 2 * np.pi * 6) * 0.5 + 0.5) ** 6
    stub = (stretch(S, 96, 6, rng) > 0.55) * row
    litter = smooth(0.55, 0.8, stretch(S, 60, 200, rng)) * 0.5
    alb = mix(base * 0.8, col(0.50, 0.42, 0.24)[None, None], np.clip(stub + litter * 0.6, 0, 1))
    return alb, np.clip(h * 0.6 + stub * 0.5, 0, 1), np.clip(r + 0.1, 0, 1)


# ---------------------------------------------------------------- built things
def boards(rng, paint, bare, wear=0.45, planks=6):
    """vertical boards (run up). paint and bare are colours; wear 0..1 is how much paint is gone"""
    edges = np.sort(np.concatenate([[0], np.round(np.cumsum(rng.uniform(0.7, 1.3, planks - 1)) / planks * S / 1.0).astype(int) % S]))
    edges = np.unique(np.clip(np.linspace(0, S, planks + 1)[:-1] + rng.integers(-10, 10, planks), 0, S - 1).astype(int))
    xs = np.arange(S)
    plank_id = np.searchsorted(edges, xs, side='right') - 1
    plank_tint = rng.uniform(0.75, 1.1, len(edges) + 1)[plank_id]
    gap = np.min(np.abs(xs[:, None] - edges[None, :]), axis=1)
    gap = np.minimum(gap, np.min(np.abs(xs[:, None] - (edges[None, :] + S)), axis=1))
    groove = smooth(2.5, 0.0, gap.astype(np.float32))
    grain = stretch(S, 140, 5, rng) * 0.6 + stretch(S, 60, 3, rng) * 0.4
    patch = fbm(S, 5, 5, rng)
    streak = stretch(S, 40, 3, rng)
    gone = smooth(1 - wear - 0.10, 1 - wear + 0.10, patch * 0.22 + streak * 0.5 + grain * 0.28)
    # more wear near the bottom of the tile (it is tiled in height, so keep it gentle)
    wood = mix(bare[None, None] * 0.7, bare[None, None] * 1.25, grain)
    painted = paint[None, None] * (0.8 + 0.3 * grain[..., None])
    alb = mix(painted, wood, gone) * plank_tint[None, :, None]
    alb = mix(alb, col(0.02, 0.018, 0.015)[None, None], np.broadcast_to(groove[None, :], (S, S)) * 0.9)
    height = 0.6 - 0.5 * np.broadcast_to(groove[None, :], (S, S)) + 0.15 * (grain - 0.5) - 0.06 * gone
    rough = np.clip(0.5 + 0.4 * gone, 0, 1)
    return alb, height, rough


def clapboard(rng, paint):
    """horizontal lap siding: 4 laps per tile"""
    yy = np.arange(S, dtype=np.float32)
    lap = (yy / S * 4) % 1.0
    shadow = smooth(0.12, 0.0, lap)                       # the dark line under each lap
    tilt = lap                                           # each board leans out toward its bottom edge
    grain = stretch(S, 6, 160, rng)
    stain = fbm(S, 4, 5, rng)
    drip = stretch(S, 50, 3, rng)
    alb = paint[None, None] * (0.86 + 0.14 * grain[..., None])
    alb = mix(alb, alb * col(0.72, 0.70, 0.64)[None, None], smooth(0.5, 0.85, stain * 0.6 + drip * 0.4) * 0.7)
    alb = mix(alb, col(0.03, 0.03, 0.03)[None, None], np.broadcast_to(shadow[:, None], (S, S)) * 0.85)
    height = np.broadcast_to((0.35 + 0.5 * (1 - tilt) - 0.45 * shadow)[:, None], (S, S)) + 0.04 * (grain - 0.5)
    rough = np.clip(0.55 + 0.25 * stain, 0, 1)
    return alb, height.astype(np.float32), rough


def shingles(rng):
    rows = 8
    yy, xx = np.mgrid[0:S, 0:S].astype(np.float32)
    r = yy / S * rows
    row = np.floor(r)
    fr = r - row
    tabs = 6
    u = xx / S * tabs + (row % 2) * 0.5
    tab = np.floor(u)
    fu = u - tab
    slot = smooth(0.06, 0.0, np.minimum(fu, 1 - fu))
    butt = smooth(0.10, 0.0, fr)
    tint_tab = rng.uniform(0.7, 1.15, (rows, tabs + 1)).astype(np.float32)[row.astype(int) % rows, tab.astype(int) % (tabs + 1)]
    gran = fbm(S, 128, 2, rng)
    moss = smooth(0.62, 0.8, fbm(S, 5, 4, rng))
    alb = col(0.105, 0.095, 0.09)[None, None] * (tint_tab * (0.8 + 0.4 * gran))[..., None]
    alb = mix(alb, col(0.09, 0.12, 0.06)[None, None], moss * 0.45)
    alb = mix(alb, col(0.01, 0.01, 0.01)[None, None], np.clip(slot + butt, 0, 1) * 0.9)
    height = 0.4 + 0.45 * fr - 0.5 * np.clip(slot + butt, 0, 1) + 0.05 * gran
    rough = np.clip(0.42 + 0.3 * gran, 0, 1)
    return alb, height, rough


def metal(rng, paint, rust=0.4):
    """corrugated sheet: ribs run up; rust streaks run down from seams"""
    xx = np.arange(S, dtype=np.float32)
    rib = np.cos(xx / S * 2 * np.pi * 8) * 0.5 + 0.5
    patch = fbm(S, 4, 5, rng)
    streak = stretch(S, 46, 3, rng)
    r = smooth(1 - rust - 0.15, 1 - rust + 0.1, patch * 0.55 + streak * 0.45)
    fine = fbm(S, 64, 2, rng)
    alb = paint[None, None] * (0.8 + 0.25 * np.broadcast_to(rib[None, :], (S, S))[..., None])
    alb = mix(alb, mix(col(0.20, 0.085, 0.035)[None, None], col(0.34, 0.16, 0.06)[None, None], fine), r)
    height = 0.2 + 0.7 * np.broadcast_to(rib[None, :], (S, S)) + 0.05 * fine * r
    rough = np.clip(0.28 + 0.55 * r + 0.1 * fine, 0, 1)
    return alb, height.astype(np.float32), rough


def concrete(rng):
    big = fbm(S, 3, 5, rng)
    fine = fbm(S, 96, 2, rng)
    stain = stretch(S, 30, 3, rng)
    d1, _ = cells_noise(S, 500, rng)
    pit = smooth(0.2, 0.05, d1)
    alb = mix(col(0.30, 0.29, 0.27)[None, None], col(0.46, 0.45, 0.42)[None, None], big)
    alb = mix(alb, col(0.17, 0.165, 0.15)[None, None], smooth(0.55, 0.9, stain) * 0.5)
    alb *= (0.9 + 0.2 * fine)[..., None]
    height = 0.5 + 0.2 * (fine - 0.5) - 0.3 * pit
    rough = np.clip(0.7 + 0.2 * fine, 0, 1)
    return alb, height, rough


def brick(rng):
    rows, cols_ = 8, 4
    yy, xx = np.mgrid[0:S, 0:S].astype(np.float32)
    r = yy / S * rows
    row = np.floor(r); fr = r - row
    u = xx / S * cols_ + (row % 2) * 0.5
    c = np.floor(u); fu = u - c
    mortar = np.clip(smooth(0.07, 0.0, np.minimum(fr, 1 - fr)) + smooth(0.035, 0.0, np.minimum(fu, 1 - fu)), 0, 1)
    tint = rng.uniform(0.6, 1.2, (rows, cols_ + 1)).astype(np.float32)[row.astype(int) % rows, c.astype(int) % (cols_ + 1)]
    fine = fbm(S, 64, 3, rng)
    alb = col(0.30, 0.11, 0.075)[None, None] * (tint * (0.8 + 0.4 * fine))[..., None]
    alb = mix(alb, col(0.36, 0.34, 0.31)[None, None], mortar)
    height = 0.6 - 0.45 * mortar + 0.1 * (fine - 0.5)
    return alb, height, np.clip(0.75 + 0.2 * fine, 0, 1)


def bark(rng):
    ridges = np.abs(stretch(S, 26, 4, rng) - 0.5) * 2
    ridges2 = np.abs(stretch(S, 60, 9, rng) - 0.5) * 2
    big = fbm(S, 4, 4, rng)
    h = 0.6 * ridges + 0.3 * ridges2 + 0.1 * big
    alb = mix(col(0.035, 0.03, 0.026)[None, None], col(0.16, 0.135, 0.11)[None, None], h)
    alb = mix(alb, col(0.11, 0.13, 0.08)[None, None], smooth(0.6, 0.85, big) * 0.3)
    return alb, h, np.clip(0.8 + 0.15 * h, 0, 1)


def hay(rng):
    a = stretch(S, 6, 220, rng) * 0.5 + stretch(S, 14, 120, rng) * 0.5
    b = fbm(S, 6, 4, rng)
    alb = mix(col(0.24, 0.20, 0.11)[None, None], col(0.50, 0.45, 0.28)[None, None], a * 0.8 + b * 0.2)
    alb = mix(alb, col(0.07, 0.06, 0.035)[None, None], smooth(0.3, 0.1, a) * 0.8)
    alb = mix(alb, col(0.22, 0.21, 0.19)[None, None], smooth(0.55, 0.8, b) * 0.35)
    return alb, a, np.full((S, S), 0.85, np.float32)


def window_lit(rng, curtain=True):
    """a lit window seen from outside at dusk: warm glow, curtains, a cross of glazing bars. Used as an emissive picture."""
    yy, xx = np.mgrid[0:256, 0:256].astype(np.float32) / 255.0
    glow = 0.55 + 0.45 * np.exp(-(((xx - 0.5) / 0.6) ** 2 + ((yy - 0.38) / 0.7) ** 2))
    alb = col(1.0, 0.66, 0.32)[None, None] * glow[..., None]
    if curtain:
        fold = 0.82 + 0.18 * np.cos(xx * 2 * np.pi * 9 + np.sin(yy * 6) * 0.6)
        side = np.clip(smooth(0.32, 0.20, xx) + smooth(0.68, 0.80, xx), 0, 1)
        swag = smooth(0.80, 0.93, yy + 0.06 * np.cos(xx * 2 * np.pi))
        cloth = np.clip(side + swag, 0, 1)
        alb = mix(alb, alb * col(0.9, 0.62, 0.42)[None, None] * fold[..., None], cloth * 0.85)
    bars = np.clip(smooth(0.014, 0.004, np.abs(xx - 0.5)) + smooth(0.014, 0.004, np.abs(yy - 0.5)) + smooth(0.03, 0.012, np.minimum(np.minimum(xx, 1 - xx), np.minimum(yy, 1 - yy))), 0, 1)
    alb = mix(alb, col(0.05, 0.035, 0.025)[None, None], bars)
    return np.clip(alb, 0, 1)


def make_all(seed=7):
    rng = np.random.default_rng(seed)
    out = {}
    out['mud'] = mud(rng)
    out['gravel'] = gravel(rng)
    out['grass'] = grass(rng)
    out['asphalt'] = asphalt(rng)
    out['stubble'] = stubble(rng)
    out['barn'] = boards(rng, col(0.27, 0.045, 0.035), col(0.20, 0.185, 0.165), wear=0.40, planks=7)
    out['greywood'] = boards(rng, col(0.30, 0.28, 0.25), col(0.24, 0.22, 0.195), wear=0.9, planks=5)
    out['siding'] = clapboard(rng, col(0.62, 0.60, 0.54))
    out['siding_dummy'] = clapboard(rng, col(0.36, 0.44, 0.40))
    out['shingles'] = shingles(rng)
    out['tin'] = metal(rng, col(0.36, 0.38, 0.39), rust=0.38)
    out['concrete'] = concrete(rng)
    out['brick'] = brick(rng)
    out['bark'] = bark(rng)
    out['hay'] = hay(rng)
    return out, {'window_a': window_lit(rng, True), 'window_b': window_lit(rng, False)}
