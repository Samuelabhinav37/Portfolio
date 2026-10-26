# Paints the projects sheet's scenery for the homepage (see README.md).
#   creatures-top.webp     two spotted mantas and a fish beside the "Selected work" heading
#   creatures-bottom.webp  sea floor: coral and weed at the corners, turtle, fish school, sea stars, bubbles
#   rays.webp              faint light shafts coming down from the top of the sheet
#   stars-tile.webp        seamless star dust with darker winding paths and a few sparkles
#   waves-tile.webp        seamless, barely-there brushed swells
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
    weed(W, H, 5, 300, 600, 190, 7), weed(W, H, 6, 1270, 600, 170, 7)])
ce = (c + (fnoise(H, W, 1.0, 7) - .5) * .3 > .35).astype(float)
bot.alpha_composite(rgba(BODY * .7, blur(ce, .8) * .92))
bot.alpha_composite(rgba(RIM, np.clip(blur(ce, .8) - blur(ce, 3), 0, 1) * .35))   # a little moonlight on the tips
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
print('ok')
