# Paints the projects sheet's scenery for the homepage (see README.md).
#   creatures-top.webp     two spotted mantas and a fish beside the "Selected work" heading
#   creatures-bottom.webp  sea floor: coral and weed at the corners, turtle, fish school, sea stars, bubbles
#   rays.webp              faint light shafts coming down from the top of the sheet
#   stars-tile.webp        seamless star dust with darker winding paths and a few sparkles
#   waves-tile.webp        seamless, barely-there brushed swells
#   clouds-tile.webp       seamless soft cloud banks, lit along their tops
#   side-l/-r.webp         vertical strips: small coral trees on rock shelves, sea stars, passing fish
#   scatter-tile.webp      a few sea stars and fish for the gaps between rows
# Creatures come from the site's own sky-cast.js shapes (rendered by shapes.mjs),
# painted the way whale sharks and mantas look at night: dark bodies covered
# in pale spots, with a soft moonlit rim.
import sys, json, numpy as np
from PIL import Image, ImageFilter, ImageDraw

SH, OUT = sys.argv[1], sys.argv[2]

def fnoise(h, w, beta, seed):
    """Periodic 1/f^beta noise via FFT (tiles seamlessly), scaled to 0..1."""
    r = np.random.default_rng(seed)
    fy = np.fft.fftfreq(h)[:, None]; fx = np.fft.fftfreq(w)[None, :]
    f = np.sqrt(fx * fx + fy * fy); f[0, 0] = 1
    n = np.real(np.fft.ifft2((r.normal(size=(h, w)) + 1j * r.normal(size=(h, w))) / f ** beta))
    return (n - n.min()) / (n.max() - n.min())

def blur(a, r):
    return np.array(Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r)), float) / 255

def rgba(rgb, a):
    rgb = np.broadcast_to(np.asarray(rgb, float), a.shape + (3,))
    return Image.fromarray(np.clip(np.dstack([rgb, a[..., None] * 255]), 0, 255).astype(np.uint8), 'RGBA')

def load(name):
    m = json.load(open(f'{SH}/{name}.json'))
    return np.frombuffer(open(f'{SH}/{name}.raw', 'rb').read(), np.uint8).reshape(m['h'], m['w']).astype(float) / 255

BODY = np.array([10, 16, 36.]); RIM = np.array([140, 172, 228.]); SPOT = np.array([226, 232, 246.])
MOON = np.array([158, 176, 226.]); CREAM = np.array([236, 223, 200.])

def creature(name, scale, seed, rot=0, flip=False, spots=1.0, strength=1.0):
    """A dark spotted body with a moonlit rim, like a whale shark at night."""
    I = load(name)
    w, h = int(I.shape[1] * scale), int(I.shape[0] * scale)
    I = np.array(Image.fromarray((I * 255).astype(np.uint8)).resize((w, h), Image.LANCZOS), float) / 255
    pad = 30
    I = np.pad(I, pad); H_, W_ = I.shape
    img = Image.fromarray(((I > 0.06) * 255).astype(np.uint8)).copy()
    ImageDraw.floodfill(img, (0, 0), 128)
    fill = (np.array(img) != 128).astype(float)
    m = blur(fill, 1.0)
    inner = blur(m, 4)
    rim = np.clip(m - inner, 0, 1) * 2.4                       # light catching the edge
    shade = 0.55 + 0.45 * fnoise(H_, W_, 1.6, seed)           # watercolour unevenness inside
    a = m * (0.78 + 0.18 * shade)
    rgb = BODY[None, None] * (0.8 + 0.5 * shade[..., None])
    rgb = rgb * (1 - rim[..., None] * .6) + RIM * (rim[..., None] * .6)
    rgb = rgb + I[..., None] * 40                              # the drawing's own lines, faintly lit
    out = np.dstack([rgb, a])
    # spots: denser toward the back and edges, sizes 1-3px
    r = np.random.default_rng(seed)
    n = int(fill.sum() / 70 * spots)
    ys, xs = np.nonzero(fill * (inner > .6))
    if len(xs):
        pick = r.integers(0, len(xs), n)
        sp = Image.new('L', (W_, H_)); d = ImageDraw.Draw(sp)
        for k in pick:
            s = r.choice([0.7, 1.0, 1.0, 1.4, 1.9]) * max(.8, scale * 1.6)
            v = int(r.uniform(120, 255))
            d.ellipse([xs[k] - s, ys[k] - s, xs[k] + s, ys[k] + s], fill=v)
        spa = np.array(sp.filter(ImageFilter.GaussianBlur(.5)), float) / 255
        out[..., :3] = out[..., :3] * (1 - spa[..., None]) + SPOT * spa[..., None]
    halo = blur(m, 9) * .18                                    # moonlit haze around it
    hrgb = RIM
    A = out[..., 3]
    tot = A + halo * (1 - A)
    col = (out[..., :3] * A[..., None] + hrgb * (halo * (1 - A))[..., None]) / np.maximum(tot, 1e-4)[..., None]
    im = rgba(col, np.clip(tot * strength, 0, 1))
    if flip: im = im.transpose(Image.FLIP_LEFT_RIGHT)
    if rot: im = im.rotate(rot, Image.BICUBIC, expand=True)
    return im

def over(canvas, im, x, y):
    canvas.alpha_composite(im, (int(x - im.width / 2), int(y - im.height / 2)))

def coral(W, H, seed, root, angle, length, depth, width):
    """Branching coral silhouette, drawn as tapered strokes."""
    r = np.random.default_rng(seed)
    img = Image.new('L', (W, H)); d = ImageDraw.Draw(img)
    def branch(x, y, ang, L, wd, dep):
        x2, y2 = x + np.cos(ang) * L, y - np.sin(ang) * L
        d.line([x, y, x2, y2], fill=255, width=max(1, int(wd)))
        d.ellipse([x2 - wd / 2, y2 - wd / 2, x2 + wd / 2, y2 + wd / 2], fill=255)
        if dep == 0: return
        for k in range(r.integers(3, 5)):                     # bushy, like a sea fan, not a bare tree
            branch(x2, y2, ang + r.uniform(-.6, .6), L * r.uniform(.62, .85), wd * .72, dep - 1)
    branch(root[0], root[1], angle, length, width, depth)
    return np.array(img.filter(ImageFilter.GaussianBlur(.8)), float) / 255

def weed(W, H, seed, x0, y0, height, n):
    r = np.random.default_rng(seed)
    img = Image.new('L', (W, H)); d = ImageDraw.Draw(img)
    for k in range(n):
        bx = x0 + r.uniform(-40, 40); ph = r.uniform(0, 6); hh = height * r.uniform(.5, 1)
        pts = [(bx + 12 * np.sin(t / hh * 7 + ph) * (t / hh), y0 - t) for t in np.linspace(0, hh, 40)]
        for i in range(len(pts) - 1):
            d.line([pts[i], pts[i + 1]], fill=255, width=max(2, int(7 * (1 - i / len(pts))) + 2))
    return np.array(img.filter(ImageFilter.GaussianBlur(.7)), float) / 255

CORAL = np.array([46, 64, 122.])

def plants(c, seed, light=1.0, rough=.3):
    """Coral, weed and rock masks painted a shade lighter than the sheet, moonlit at the edges, speckled with polyps."""
    H, W = c.shape
    m = blur((c + (fnoise(H, W, 1.0, seed) - .5) * rough > .35).astype(float), .8)
    rim = np.clip(m - blur(m, 3), 0, 1) * 2
    shade = .7 + .5 * fnoise(H, W, 1.6, seed + 1)
    rgb = CORAL * shade[..., None] * light
    rgb = rgb * (1 - rim[..., None] * .55) + RIM * (rim[..., None] * .55)
    r = np.random.default_rng(seed)
    ys, xs = np.nonzero(m > .6)
    sp = Image.new('L', (W, H)); d = ImageDraw.Draw(sp)
    for k in r.integers(0, len(xs), len(xs) // 90) if len(xs) else []:
        s = r.uniform(.6, 1.5); d.ellipse([xs[k] - s, ys[k] - s, xs[k] + s, ys[k] + s], fill=int(r.uniform(90, 200)))
    spa = np.array(sp, float)[..., None] / 255 * m[..., None]
    rgb = rgb * (1 - spa) + SPOT * spa
    return rgba(rgb, m * .9)

def ledge(W, H, seed, y, length, left=True):
    """A rough rock shelf sticking out from the side edge."""
    r = np.random.default_rng(seed)
    img = Image.new('L', (W, H)); d = ImageDraw.Draw(img)
    x0 = 0 if left else W
    for k in range(9):                                     # a pile of rounded stones, bumpy on top
        cx = x0 + (1 if left else -1) * r.uniform(0, length * .85); w = r.uniform(.12, .3) * length; h = r.uniform(12, 30)
        d.ellipse([cx - w, y - h, cx + w, y + h * .5], fill=255)
    return np.array(img.filter(ImageFilter.GaussianBlur(1.2)), float) / 255

# ---- top: two spotted mantas gliding past the heading, a fish further in ----
top = Image.new('RGBA', (1600, 560))
over(top, creature('manta', .62, 21, rot=-28, strength=.85), 1180, 270)
# y < ~250 sits under the sheet's faded top edge; y > ~380 hides behind the first row of cards
over(top, creature('manta', .44, 22, rot=-38, strength=.7), 1480, 300)
over(top, creature('fish', .5, 31, flip=True, spots=1.4, strength=.75), 880, 310)
top.save(f'{OUT}/creatures-top.webp', quality=80, alpha_quality=75, method=6)

# ---- bottom: the sea floor ----
bot = Image.new('RGBA', (1600, 600))
W, H = bot.size
x = np.arange(W); yy = np.arange(H)[:, None]
floor = 470 + 26 * np.sin(x / W * 2 * np.pi * 1.2 + 1) + 12 * np.sin(x / W * 2 * np.pi * 3.7)
nf = fnoise(H, W, 1.1, 41)
fa = np.clip((yy - floor[None, :] + (nf - .5) * 50) / 30, 0, 1) * (0.45 + 0.3 * fnoise(H, W, 1.6, 42))
bot.alpha_composite(rgba(BODY * 1.1, fa))
# coral and weed frame the corners, darkest of all, like the watercolour references
c = np.maximum.reduce([
    coral(W, H, 1, (80, 600), 1.45, 55, 5, 14), coral(W, H, 2, (200, 605), 1.7, 42, 5, 11),
    coral(W, H, 3, (1500, 600), 1.75, 58, 5, 14), coral(W, H, 4, (1390, 605), 1.45, 40, 5, 10),
    coral(W, H, 8, (640, 600), 1.6, 34, 4, 9), coral(W, H, 9, (1010, 602), 1.5, 30, 4, 8),
    weed(W, H, 5, 300, 600, 190, 7), weed(W, H, 6, 1270, 600, 170, 7), weed(W, H, 10, 760, 600, 110, 4)])
bot.alpha_composite(plants(c, 7))
over(bot, creature('turtle', .55, 51, rot=-20, strength=.85), 470, 420)
over(bot, creature('star', .45, 61, rot=15, spots=1.6, strength=.8), 1120, 500)
over(bot, creature('star', .3, 62, rot=-30, spots=1.6, strength=.7), 1215, 525)
for i, (fx, fy, s) in enumerate([(820, 300, .42), (880, 275, .36), (905, 330, .38), (960, 300, .33), (850, 350, .3), (1000, 270, .28)]):
    over(bot, creature('fish', s, 70 + i, spots=1.3, strength=.75), fx, fy)
# bubbles drifting up from the turtle
r = np.random.default_rng(12)
bub = Image.new('L', (W, H)); d = ImageDraw.Draw(bub)
for k in range(14):
    bx, by, s = 520 + r.normal(0, 18) + k * 2, 390 - k * 16 + r.normal(0, 6), r.uniform(1.5, 4.5)
    d.ellipse([bx - s, by - s, bx + s, by + s], outline=200, width=1)
bot.alpha_composite(rgba(SPOT, np.array(bub, float) / 255 * .5))
bot.save(f'{OUT}/creatures-bottom.webp', quality=80, alpha_quality=75, method=6)

# ---- light shafts from above ----
RW, RH = 1600, 1500
yy, xx = np.mgrid[0:RH, 0:RW].astype(float)
src = (1250, -300)
ang = np.arctan2(yy - src[1], xx - src[0])
dist = np.hypot(xx - src[0], yy - src[1])
rr = np.random.default_rng(3)
shafts = np.zeros((RH, RW))
for k in range(7):
    c0, wd = rr.uniform(1.75, 2.45), rr.uniform(.012, .035)
    shafts += np.exp(-((ang - c0) / wd) ** 2) * rr.uniform(.4, 1)
streak = fnoise(RH, RW // 6, 1.0, 4)
streak = np.array(Image.fromarray((streak * 255).astype(np.uint8)).resize((RW, RH), Image.BILINEAR), float) / 255
fade = np.clip(1 - dist / 1700, 0, 1) ** 1.5
ra = np.clip(shafts * fade * (.6 + .6 * streak) * .16, 0, .2)
Image.fromarray(np.dstack([np.broadcast_to(MOON * .5 + np.array([60, 90, 110.]), (RH, RW, 3)), ra * 255]).astype(np.uint8), 'RGBA').save(f'{OUT}/rays.webp', quality=78, alpha_quality=70, method=6)

# ---- star dust: dense fine speckle, thinned along winding dark paths ----
N = 1024
dens = fnoise(N, N, 1.8, 15)
path = np.abs(fnoise(N, N, 2.2, 16) - .5) < .06                 # the dark rivers through it
p = np.clip((dens - .35) * 1.6, 0, 1) * np.where(path, .12, 1) * .045
rs = np.random.default_rng(17)
hit = rs.random((N, N)) < p
dust = np.zeros((N, N)); dust[hit] = rs.uniform(.25, .8, hit.sum())
big = rs.random((N, N)) < p * .06                                 # a few slightly larger grains
dust = np.maximum(dust, blur(big.astype(float), .9) * 2.2)
st = rgba(np.broadcast_to(SPOT, (N, N, 3)), np.clip(dust, 0, 1) * .55)
# a handful of four-point sparkles
for i in range(9):
    cx, cy = rs.uniform(0, N, 2); s = rs.uniform(3, 6)
    sz = int(s * 7); yv, xv = np.mgrid[-sz:sz + 1, -sz:sz + 1].astype(float)
    a = np.clip(np.exp(-(np.hypot(xv, yv) / (s * .6)) ** 2) +
                (np.exp(-(np.abs(xv) / (s * .16)) ** 2) * np.exp(-(np.abs(yv) / (s * 2.2)) ** 2) +
                 np.exp(-(np.abs(yv) / (s * .16)) ** 2) * np.exp(-(np.abs(xv) / (s * 2.2)) ** 2)) * .6, 0, 1) * rs.uniform(.35, .6)
    im = rgba(SPOT, a)
    for ox in (-N, 0, N):                      # wrap so the tile repeats seamlessly
        for oy in (-N, 0, N):
            st.alpha_composite(im, (int(cx - sz + ox), int(cy - sz + oy))) if -2 * sz < cx + ox < N + 2 * sz and -2 * sz < cy + oy < N + 2 * sz else None
st.save(f'{OUT}/stars-tile.webp', quality=82, alpha_quality=80, method=6)

# ---- waves: a few loose brush strokes of swell, kept to a whisper ----
yy, xx = np.mgrid[0:N, 0:N].astype(float)
streak = fnoise(N, N // 8, 1.1, 81)
streak = np.array(Image.fromarray((streak * 255).astype(np.uint8)).resize((N, N), Image.BILINEAR), float) / 255
wa = np.zeros((N, N))
r = np.random.default_rng(9)
for k in range(3):
    y0 = (k + r.uniform(.2, .8)) * N / 3
    amp, per, ph = r.uniform(10, 22), N / r.choice([1, 2]), r.uniform(0, 2 * np.pi)
    cy = y0 + amp * np.sin(2 * np.pi * xx / per + ph)             # whole periods across, so it tiles sideways
    d_ = np.minimum(np.abs(yy - cy), N - np.abs(yy - cy))          # and wraps top to bottom
    width = 2 + 1.5 * (0.5 + 0.5 * np.sin(2 * np.pi * xx / per + ph + 1.3))
    stroke = np.exp(-(d_ / width) ** 2) * np.clip((streak - .45) * 3, 0, 1)
    wa = np.maximum(wa, stroke * r.uniform(.05, .08))
rgba(np.broadcast_to(MOON, (N, N, 3)), wa).save(f'{OUT}/waves-tile.webp', quality=80, alpha_quality=70, method=6)

# ---- clouds: soft moonlit banks drifting through the water, lit on top ----
n = fnoise(N, N, 2.6, 91)
body = np.clip((n - .58) / .16, 0, 1) ** 1.5
lit = np.clip(body - np.roll(blur(body, 6), 14, axis=0), 0, 1)       # the top edge catches the light
ca = body * .14 + lit * .32
rgba(np.broadcast_to(MOON * .9 + CREAM * .1, (N, N, 3)), np.clip(ca, 0, .4)).save(f'{OUT}/clouds-tile.webp', quality=78, alpha_quality=70, method=6)

# ---- sides: small coral trees on rock shelves down both edges, sea stars on the rocks, fish passing ----
# Each strip repeats vertically, so nothing touches its top or bottom edge.
SW, SHt = 300, 1800
def side(seed, fish=True):
    r = np.random.default_rng(seed)
    s = Image.new('RGBA', (SW, SHt))
    shelves = [(220 + k * 600 + r.uniform(-60, 60), r.uniform(90, 150)) for k in range(3)]
    masks = []
    for i, (y, ln) in enumerate(shelves):
        masks.append(ledge(SW, SHt, seed + i, y, ln))
        for t in range(r.integers(2, 4)):
            x = r.uniform(12, ln * .85)
            masks.append(coral(SW, SHt, seed * 10 + i * 4 + t, (x, y - 14), 1.57 + r.uniform(-.25, .25), r.uniform(24, 36), 3, r.uniform(4, 6)))
        masks.append(weed(SW, SHt, seed * 20 + i, ln * .5, y - 4, r.uniform(60, 110), 3))
    s.alpha_composite(plants(np.maximum.reduce(masks), seed, rough=.12))
    for i, (y, ln) in enumerate(shelves):
        over(s, creature('star', r.uniform(.24, .32), seed + 40 + i, rot=r.uniform(-40, 40), spots=1.6, strength=.85), r.uniform(25, ln * .7), y + 8)
        fy = y + r.uniform(200, 380)
        for f in range(r.integers(1, 4)):                              # a fish or a small school between shelves
            # drawn either way, so the fish-free strip keeps the same corals and stars
            sc, fl, x, y2 = r.uniform(.26, .36), r.random() < .5, r.uniform(90, 230), fy + r.uniform(-30, 30) + f * 22
            if fish: over(s, creature('fish', sc, seed + 60 + i * 5 + f, flip=fl, spots=1.3, strength=.75), x, y2)
    print('shelves', seed, [round(y) for y, _ in shelves])
    return s
side(3).save(f'{OUT}/side-l.webp', quality=80, alpha_quality=75, method=6)
side(4).transpose(Image.FLIP_LEFT_RIGHT).save(f'{OUT}/side-r.webp', quality=80, alpha_quality=75, method=6)

# ---- scattered sea stars and fish for the gaps between rows ----
TW, TH = 1400, 1300
sc = Image.new('RGBA', (TW, TH)); r = np.random.default_rng(5)
for i in range(4):
    over(sc, creature('star', r.uniform(.2, .3), 100 + i, rot=r.uniform(-60, 60), spots=1.6, strength=.6), r.uniform(80, TW - 80), r.uniform(80, TH - 80))
for i in range(6):
    over(sc, creature('fish', r.uniform(.24, .34), 110 + i, flip=r.random() < .5, spots=1.3, strength=.6), r.uniform(80, TW - 80), r.uniform(80, TH - 80))
sc.save(f'{OUT}/scatter-tile.webp', quality=80, alpha_quality=75, method=6)
print('ok')

# ---- moving pieces, as separate images the page animates ----
#   sprite-fish-0..2.webp  single fish (they bob in place)
#   sprite-star-0..1.webp  single sea stars (they turn and breathe)
#   twinkle-0..2.webp      seamless tiles of a few four-point sparkles each (they fade in and out out of step)
for i, (s, sp) in enumerate([(.36, 1.3), (.3, 1.3), (.26, 1.4)]):
    creature('fish', s, 200 + i, spots=sp, strength=.75).save(f'{OUT}/sprite-fish-{i}.webp', quality=82, alpha_quality=80, method=6)
for i, s in enumerate([.3, .24]):
    creature('star', s, 210 + i, spots=1.6, strength=.8).save(f'{OUT}/sprite-star-{i}.webp', quality=82, alpha_quality=80, method=6)
def sparkle(s, a0):
    sz = int(s * 7); yv, xv = np.mgrid[-sz:sz + 1, -sz:sz + 1].astype(float)
    a = np.clip(np.exp(-(np.hypot(xv, yv) / (s * .6)) ** 2) +
                (np.exp(-(np.abs(xv) / (s * .16)) ** 2) * np.exp(-(np.abs(yv) / (s * 2.2)) ** 2) +
                 np.exp(-(np.abs(yv) / (s * .16)) ** 2) * np.exp(-(np.abs(xv) / (s * 2.2)) ** 2)) * .6, 0, 1) * a0
    return rgba(SPOT, a), sz
for t in range(3):
    tw = Image.new('RGBA', (N, N)); rt = np.random.default_rng(300 + t)
    for i in range(7):
        im, sz = sparkle(rt.uniform(2.5, 5.5), rt.uniform(.5, .85))
        cx, cy = rt.uniform(0, N, 2)
        for ox in (-N, 0, N):
            for oy in (-N, 0, N):
                if -2 * sz < cx + ox < N + 2 * sz and -2 * sz < cy + oy < N + 2 * sz:
                    tw.alpha_composite(im, (int(cx - sz + ox), int(cy - sz + oy)))
    tw.save(f'{OUT}/twinkle-{t}.webp', quality=82, alpha_quality=80, method=6)
print('sprites ok')
