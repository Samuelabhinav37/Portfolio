# Paints the about page's reef (see README.md):
#   about-reef-floor.webp  the sea floor across the bottom of the page
#   about-reef-l/-r.webp   the reef climbing each side edge from the floor (different on each side)
# Unlike creatures.py's one bushy coral repeated everywhere, this mixes the
# growth forms a real reef is built from: branching staghorn, table plates,
# brain domes, foliose lettuce plates, pillar columns, tube sponges, sea fans,
# sea whips and anemones. Rows further back are smaller, paler and bluer:
# water swallows red first, so at depth everything drifts toward blue.
#
# usage: python scripts/paint/reef.py <out-dir>
import sys, numpy as np
from PIL import Image, ImageFilter, ImageDraw

OUT = sys.argv[1]
SPOT = np.array([226, 232, 246.]); RIM = np.array([150, 180, 232.]); WATER = np.array([22, 34, 72.])

def fnoise(h, w, beta, seed):
    """1/f^beta noise via FFT, scaled to 0..1 (same as creatures.py)."""
    r = np.random.default_rng(seed)
    fy = np.fft.fftfreq(h)[:, None]; fx = np.fft.fftfreq(w)[None, :]
    f = np.sqrt(fx * fx + fy * fy); f[0, 0] = 1
    n = np.real(np.fft.ifft2((r.normal(size=(h, w)) + 1j * r.normal(size=(h, w))) / f ** beta))
    return (n - n.min()) / (n.max() - n.min())

def blur(a, r):
    return np.array(Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r)), float) / 255

def L(W, H):
    img = Image.new('L', (W, H)); return img, ImageDraw.Draw(img)

def arr(img, r=0.7):
    return np.array(img.filter(ImageFilter.GaussianBlur(r)), float) / 255

def tube(d, pts, w0, w1):
    """A tapered stroke along pts, drawn as overlapping discs."""
    pts = np.asarray(pts, float); n = len(pts)
    seg = np.r_[0, np.cumsum(np.hypot(*np.diff(pts, axis=0).T))]
    for t in np.linspace(0, seg[-1], max(2, int(seg[-1] / 1.5))):
        i = min(n - 2, np.searchsorted(seg, t, 'right') - 1); u = (t - seg[i]) / max(1e-6, seg[i + 1] - seg[i])
        x, y = pts[i] + (pts[i + 1] - pts[i]) * u; w = (w0 + (w1 - w0) * t / seg[-1]) / 2
        d.ellipse([x - w, y - w, x + w, y + w], fill=255)

# ---- growth forms: each returns (mask, shading 0..1, texture 0..1) ----
def staghorn(W, H, x, y, s, seed):
    """Antler-like: a few long round branches forking in twos, blunt pale tips."""
    r = np.random.default_rng(seed); img, d = L(W, H); tips = []
    def br(x0, y0, a, ln, w, dep):
        pts = [(x0, y0)]
        for k in range(1, 7):
            a += r.normal(0, .06); pts.append((pts[-1][0] + np.cos(a) * ln / 6, pts[-1][1] - np.sin(a) * ln / 6))
        tube(d, pts, w, w * .8)
        if dep == 0 or r.random() < .12: tips.append((pts[-1], w * .8)); return
        for da in (-1, 1): br(*pts[-1], a + da * r.uniform(.3, .6), ln * r.uniform(.6, .8), w * .82, dep - 1)
    for k in range(r.integers(3, 5)):
        br(x + r.uniform(-.3, .3) * s, y, np.pi / 2 + r.uniform(-.8, .8), s * r.uniform(.32, .5), s * .075, 4)
    tip = Image.new('L', (W, H)); td = ImageDraw.Draw(tip)
    for (tx, ty), w in tips: td.ellipse([tx - w * .7, ty - w * .7, tx + w * .7, ty + w * .7], fill=255)
    m = arr(img); return m, blur(m, s * .05), arr(tip, 1.2)

def table(W, H, x, y, s, seed):
    """A short stalk holding a wide flat plate, a smaller tier under it."""
    r = np.random.default_rng(seed); img, d = L(W, H); top, td = L(W, H)
    tube(d, [(x, y), (x + r.uniform(-.05, .05) * s, y - s * .32)], s * .14, s * .1)
    for k, (dy, wf) in enumerate([(.32, 1.0), (.2, .55)]):
        cy, hw = y - s * dy, s * wf * r.uniform(.85, 1)
        cx = x + (r.uniform(-.25, -.1) if k else 0) * s
        edge = [(cx + hw * np.cos(t) * (1 + .06 * np.sin(5 * t + seed)), cy - s * .05 * np.sin(t) - s * .02) for t in np.linspace(0, np.pi, 30)]
        edge += [(cx + hw * np.cos(t) * .9, cy + s * .07) for t in np.linspace(np.pi, 0, 20)]
        d.polygon(edge, fill=255)
        if k == 0: td.polygon(edge[:30] + [(cx - hw * .9, cy - s * .01)], fill=255)
    m = arr(img); return m, .35 + .65 * arr(top, 3), fnoise(H, W, .2, seed) > .8

def brain(W, H, x, y, s, seed):
    """A low dome covered in meandering grooves."""
    img, d = L(W, H); d.ellipse([x - s, y - s * .75, x + s, y + s * .2], fill=255)
    m = arr(img, 1.2) * (np.arange(H)[:, None] < y + 2)
    yy, xx = np.mgrid[0:H, 0:W].astype(float)
    # the zero lines of band-pass noise wind into an even labyrinth, like the valleys on a brain coral
    rr = np.random.default_rng(seed); fy = np.fft.fftfreq(H)[:, None]; fx = np.fft.fftfreq(W)[None, :]; f = np.hypot(fx, fy)
    lo = max(3, s * .05); g = np.exp(-(f * lo) ** 2 * 20) - np.exp(-(f * lo * 2) ** 2 * 20)
    b = np.real(np.fft.ifft2(np.fft.fft2(rr.normal(size=(H, W))) * g))
    grooves = blur((np.abs(b) < .22 * b.std()).astype(float), .5)
    dome = np.clip(1 - (((xx - x) / s) ** 2 + ((yy - (y - s * .3)) / (s * .7)) ** 2), 0, 1) ** .5
    return m, dome, grooves * m

def lettuce(W, H, x, y, s, seed):
    """Foliose coral: stacked thin ruffled plates, lit along each edge."""
    r = np.random.default_rng(seed); img, d = L(W, H); edges, ed = L(W, H)
    for k in range(9):
        cy = y - k * s * .09 - r.uniform(0, .05) * s; hw = s * (1 - k * .07) * r.uniform(.35, .6); cx = x + r.uniform(-.4, .4) * s
        rim_ = [(cx + t * hw, cy - s * .06 * (1 - t * t) + s * .02 * np.sin(t * 13 + k * 2)) for t in np.linspace(-1, 1, 40)]
        und = [(cx + t * hw * .8, cy + s * .05 * (1 - t * t)) for t in np.linspace(1, -1, 30)]
        d.polygon(rim_ + und, fill=255)                                  # a thin leafy plate, curling at the edge
        tube(ed, rim_, s * .025, s * .025)
    m = arr(img); return m, .4 + .6 * arr(edges, 1), np.zeros((H, W))

def pillar(W, H, x, y, s, seed):
    """Upright columns with rounded tops and fuzzy polyp edges."""
    r = np.random.default_rng(seed); img, d = L(W, H)
    for k in range(r.integers(5, 9)):
        cx = x + r.uniform(-.35, .35) * s; h = s * r.uniform(.5, 1.2); w = s * r.uniform(.05, .08)
        tube(d, [(cx + r.normal(0, w * .2) * t, y - h * t) for t in np.linspace(0, 1, 12)], w * 2.2, w * 1.5)
    m = arr(img, .8); fuzz = fnoise(H, W, .3, seed)
    m = np.clip(blur(m, 1.5) * (.6 + .8 * fuzz) * 1.3, 0, 1)   # furry with polyps
    xx = np.arange(W)[None, :]
    return m, blur(m, s * .03), (np.sin(xx * 1.6) > .6) * m   # fine upright grooves

def sponges(W, H, x, y, s, seed):
    """Tube sponges: leaning hollow tubes, each with a dark open mouth."""
    r = np.random.default_rng(seed); img, d = L(W, H); mouth, md = L(W, H); lip, ld = L(W, H)
    for k in range(r.integers(3, 5)):
        a = np.pi / 2 + r.uniform(-.45, .45); h = s * r.uniform(.55, 1); w = s * r.uniform(.09, .14)
        x0 = x + r.uniform(-.3, .3) * s; tx, ty = x0 + np.cos(a) * h, y - np.sin(a) * h
        tube(d, [(x0, y), (tx, ty)], w * 1.6, w * 2.1)
        ld.ellipse([tx - w * 1.05, ty - w * .45, tx + w * 1.05, ty + w * .45], fill=255)
        md.ellipse([tx - w * .75, ty - w * .3, tx + w * .75, ty + w * .3], fill=255)
    m = arr(img); return np.clip(m, 0, 1), .45 + .55 * arr(lip, 1) - .5 * arr(mouth, .8), np.zeros((H, W))

def fan(W, H, x, y, s, seed):
    """Sea fan: one flat lacy net on a short trunk, see-through between the twigs."""
    r = np.random.default_rng(seed); img, d = L(W, H)
    tube(d, [(x, y), (x, y - s * .15)], s * .06, s * .045)
    lean = r.uniform(-.25, .25)
    def br(x0, y0, a, ln, dep):
        x1, y1 = x0 + np.cos(a) * ln, y0 - np.sin(a) * ln
        d.line([x0, y0, x1, y1], fill=255, width=max(1, dep))
        if dep: [br(x1, y1, a + da * r.uniform(.15, .35), ln * r.uniform(.72, .85), dep - 1) for da in (-1, 1)]
    for k in range(7): br(x, y - s * .15, np.pi / 2 + lean + (k - 3) * .22, s * .16, 5)
    net = arr(img, .5)
    hull = blur(net, s * .05) > .08
    ridge = 1 - np.abs(fnoise(H, W, 1.2, seed + 9) * 2 - 1)        # thin ridges of a noise field read as a net of twigs
    lace = (ridge > .9) * hull * .5 + hull * .1
    m = np.clip(net + lace, 0, 1) * .9; return m, .6 + .4 * blur(net, 2), np.zeros((H, W))

def whips(W, H, x, y, s, seed):
    """Sea whips: a few long thin rods bending one way."""
    r = np.random.default_rng(seed); img, d = L(W, H); bend = r.uniform(-1, 1)
    for k in range(r.integers(3, 6)):
        h = s * r.uniform(.6, 1.1); x0 = x + r.uniform(-.1, .1) * s; b = bend * r.uniform(.15, .4) * s
        tube(d, [(x0 + b * (t ** 2), y - h * t) for t in np.linspace(0, 1, 20)], s * .035, s * .015)
    m = arr(img, .6); return m, np.full((H, W), .7), np.zeros((H, W))

def anemone(W, H, x, y, s, seed):
    """A small round body with a crown of short tentacles."""
    r = np.random.default_rng(seed); img, d = L(W, H); tips, td = L(W, H)
    d.ellipse([x - s * .35, y - s * .4, x + s * .35, y], fill=255)
    for k in range(26):
        a = np.pi * (.08 + .84 * k / 25) + r.normal(0, .05); ln = s * r.uniform(.4, .6)
        ex, ey = x + np.cos(a) * ln * .9, y - s * .3 - np.sin(a) * ln
        tube(d, [(x + np.cos(a) * s * .25, y - s * .3), (ex, ey)], s * .07, s * .04)
        td.ellipse([ex - s * .03, ey - s * .03, ex + s * .03, ey + s * .03], fill=255)
    m = arr(img); return m, .55 + .45 * blur(m, s * .06), arr(tips, .6)

def wall(W, H, x, y, s, seed):
    """A rough rock wall hugging the page edge, from the floor up, narrowing as it climbs."""
    r = np.random.default_rng(seed); img, d = L(W, H)
    for k in range(40):
        t = k / 39; cy = y - t * s * 4.4; w = s * (1 - t * .8) * r.uniform(.6, 1)
        d.ellipse([x - w, cy - s * .18, x + w, cy + s * .18], fill=255)
    m = arr(img, 2.5); m = np.clip((m + (fnoise(H, W, 1.2, seed) - .5) * .6 - .45) * 4, 0, 1)
    return m, blur(m, s * .1) * .6, fnoise(H, W, .5, seed + 1) > .7

def rocks(W, H, x, y, s, seed):
    """A heap of rounded stones for things to grow on."""
    r = np.random.default_rng(seed); img, d = L(W, H)
    for k in range(9):
        cx = x + r.uniform(-1, 1) * s; w = s * r.uniform(.25, .5); h = w * r.uniform(.45, .7)
        d.ellipse([cx - w, y - h * r.uniform(.8, 1.4), cx + w, y + h * .4], fill=255)
    m = arr(img, 2.5); m = np.clip((m + (fnoise(H, W, 1.2, seed) - .5) * .5 - .45) * 4, 0, 1)
    return m, blur(m, s * .08) * .7, fnoise(H, W, .5, seed + 1) > .7

# muted night colours: no reds (gone at depth), each form its own tone so they read apart
FORMS = {
    'staghorn': (staghorn, [70, 86, 140]), 'table': (table, [50, 82, 112]), 'brain': (brain, [74, 68, 122]),
    'lettuce': (lettuce, [66, 90, 130]), 'pillar': (pillar, [58, 96, 116]), 'sponges': (sponges, [62, 54, 112]),
    'fan': (fan, [104, 82, 150]), 'whips': (whips, [112, 92, 156]), 'anemone': (anemone, [128, 138, 178]),
    'rocks': (rocks, [24, 32, 62]), 'wall': (wall, [20, 28, 56]),
}

def paint(canvas, kind, x, y, s, seed, depth):
    """Draw one coral: lit from above, shaded by its form, speckled, and hazed toward blue with depth."""
    fn, col = FORMS[kind]; W, H = canvas.size
    m, shade, tex = fn(W, H, x, y, s, seed)
    if kind != 'fan': m = np.clip(m + (fnoise(H, W, .9, seed + 3) - .5) * .5 * blur(m, 2) * (1 - m) * 4 - (fnoise(H, W, .6, seed + 4) < .18) * m * .5, 0, 1)
    shade = np.clip(shade, 0, 1) * (.75 + .5 * fnoise(H, W, 1.5, seed + 5))   # watercolour unevenness
    yy = np.arange(H)[:, None]
    base = np.clip((y - yy) / (s * .25), 0, 1) ** .6               # darker where it meets the rock
    lit = np.clip(m - np.roll(blur(m, 2.5), 3, axis=0), 0, 1) * 1.8  # light catching the upper edges
    rgb = np.asarray(col, float)[None, None] * (.35 + .75 * shade[..., None]) * (.55 + .45 * base[..., None])
    tex = np.asarray(tex, float)[..., None]
    rgb = rgb * (1 - .45 * tex) + SPOT * (.08 * tex)
    rgb = rgb * (1 - lit[..., None] * .5) + RIM * (lit[..., None] * .5)
    rgb = rgb * (1 - depth * .55) + WATER * depth * .55 + np.array([10, 18, 40.]) * depth * .4
    rr = np.random.default_rng(seed); ys, xs = np.nonzero(m > .6)
    sp = Image.new('L', (W, H)); sd = ImageDraw.Draw(sp)
    for k in rr.integers(0, len(xs), len(xs) // 350) if len(xs) and kind not in ('rocks', 'wall', 'brain') else []:   # a few polyps catching the light
        q = rr.uniform(.4, .9); sd.ellipse([xs[k] - q, ys[k] - q, xs[k] + q, ys[k] + q], fill=int(rr.uniform(60, 150)))
    spa = np.array(sp, float)[..., None] / 255 * m[..., None] * (1 - depth)
    rgb = rgb * (1 - spa) + SPOT * spa
    a = m * (.92 - depth * .35)
    canvas.alpha_composite(Image.fromarray(np.clip(np.dstack([rgb, a[..., None] * 255]), 0, 255).astype(np.uint8), 'RGBA'))

def scene(W, H, items, sand=None, seed=0):
    c = Image.new('RGBA', (W, H))
    if sand is not None:                                           # the floor: dark sand with soft ripples
        x = np.arange(W); yy = np.arange(H)[:, None]
        top = sand + 18 * np.sin(x / W * 2 * np.pi * 1.3 + seed) + 8 * np.sin(x / W * 2 * np.pi * 4.1)
        n = fnoise(H, W, 1.1, seed)
        fa = np.clip((yy - top[None, :] + (n - .5) * 40) / 40, 0, 1) * (.55 + .3 * fnoise(H, W, 1.6, seed + 1))
        rip = (np.sin(yy / 5 + n * 30) > .7) * fa * .25
        rgb = np.broadcast_to(np.array([16, 24, 50.]), (H, W, 3)) * (1 + rip[..., None])
        c.alpha_composite(Image.fromarray(np.clip(np.dstack([rgb, fa[..., None] * 255]), 0, 255).astype(np.uint8), 'RGBA'))
    for depth in sorted({it[-1] for it in items}, reverse=True):  # back rows first
        for it in items:
            if it[-1] == depth: paint(c, *it)
    return c

# ---- the sea floor: a far row along a ridge, a middle row, the big ones at the corners ----
FW, FH = 1800, 560
far = [(k, 120 + i * 190 + (i * 53) % 70, 470 - (i % 3) * 8, 34 + (i * 13) % 18, 300 + i, .7)
       for i, k in enumerate(['brain', 'staghorn', 'fan', 'pillar', 'lettuce', 'whips', 'table', 'brain', 'sponges'])]
mid = [('rocks', 260, 520, 120, 401, .35), ('table', 250, 470, 92, 402, .35), ('fan', 470, 505, 120, 403, .35),
       ('brain', 640, 520, 60, 404, .35), ('whips', 820, 515, 110, 405, .35), ('anemone', 990, 520, 54, 406, .35),
       ('rocks', 1260, 525, 110, 407, .35), ('sponges', 1210, 510, 104, 408, .35), ('lettuce', 1420, 515, 84, 409, .35),
       ('pillar', 1610, 520, 110, 410, .35)]
near = [('rocks', 90, 560, 160, 501, 0), ('staghorn', 110, 545, 190, 502, 0), ('anemone', 300, 556, 64, 503, 0),
        ('brain', 1700, 560, 110, 504, 0), ('fan', 1560, 552, 170, 505, 0), ('sponges', 1420, 560, 120, 506, 0)]
scene(FW, FH, far + mid + near, sand=440, seed=21).save(f'{OUT}/about-reef-floor.webp', quality=80, alpha_quality=75, method=6)

# ---- the sides: the reef climbing each edge from the floor, thinning out as it rises ----
SW, SH = 420, 1000
# corals higher up grow out of the wall: x sits on its face at that height
left = [('wall', 0, 1000, 150, 600, .3), ('rocks', 70, 1010, 190, 601, .15),
        ('fan', 70, 640, 140, 604, .45), ('pillar', 40, 520, 60, 611, .55), ('whips', 25, 410, 120, 610, .6),
        ('table', 120, 800, 100, 605, .3), ('lettuce', 230, 1000, 110, 606, .1), ('staghorn', 70, 1000, 150, 607, .05),
        ('anemone', 300, 1000, 50, 608, .05), ('brain', 160, 1005, 60, 609, 0), ('sponges', 350, 1005, 70, 612, .2)]
right = [('wall', 420, 1000, 160, 700, .3), ('rocks', 360, 1010, 200, 701, .15),
         ('sponges', 360, 650, 100, 705, .45), ('table', 360, 800, 80, 711, .3), ('whips', 400, 420, 120, 710, .6),
         ('pillar', 330, 990, 140, 704, .1), ('fan', 250, 1000, 170, 706, .2), ('brain', 390, 1005, 70, 707, 0),
         ('staghorn', 190, 1000, 110, 708, .05), ('anemone', 120, 1002, 44, 709, 0), ('lettuce', 60, 1005, 70, 712, .15)]
for name, items, seed in (('l', left, 31), ('r', right, 32)):
    s = scene(SW, SH, items, seed=seed)
    fade = np.clip(np.arange(SH) / (SH * .45), 0, 1)[:, None]      # nothing ends in a hard line at the top
    a = np.array(s)[..., 3] * fade
    s.putalpha(Image.fromarray(a.astype(np.uint8)))
    s.save(f'{OUT}/about-reef-{name}.webp', quality=80, alpha_quality=75, method=6)
print('ok')
