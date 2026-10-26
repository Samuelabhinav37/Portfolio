# Paints the sky cast as watercolour for the homepage projects sheet.
#   creatures-top.webp     a fish and a manta beside the "Selected work" heading
#   creatures-bottom.webp  turtle, sea star and fish on a painted sea floor under the last row
#   stars-tile.webp        seamless sparse painted stars
#   waves-tile.webp        seamless faint watercolour wave strokes
# Shapes come from the site's own sky-cast.js fields (rendered by shapes.mjs),
# so they match the creatures drifting in the background sky.
import sys, json, numpy as np
from PIL import Image, ImageFilter, ImageDraw

SH, OUT = sys.argv[1], sys.argv[2]

def fnoise(h, w, beta, seed):
    r = np.random.default_rng(seed)
    fy = np.fft.fftfreq(h)[:, None]; fx = np.fft.fftfreq(w)[None, :]
    f = np.sqrt(fx * fx + fy * fy); f[0, 0] = 1
    n = np.real(np.fft.ifft2((r.normal(size=(h, w)) + 1j * r.normal(size=(h, w))) / f ** beta))
    return (n - n.min()) / (n.max() - n.min())

def blur(a, r):
    return np.array(Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r)), float) / 255

def load(name):
    m = json.load(open(f'{SH}/{name}.json'))
    I = np.frombuffer(open(f'{SH}/{name}.raw', 'rb').read(), np.uint8).reshape(m['h'], m['w']).astype(float) / 255
    D = Image.open(f'{SH}/{name}-digits.png').convert('RGBA')
    return I, D

MOON = np.array([158, 176, 226.]); CREAM = np.array([236, 223, 200.]); DEEP = np.array([92, 112, 170.])

def paint(name, scale, seed, rot=0, flip=False, digits=.5, tint=0.):
    """One creature as a watercolour glaze: RGBA float array."""
    I, D = load(name)
    w, h = int(I.shape[1] * scale), int(I.shape[0] * scale)
    I = np.array(Image.fromarray((I * 255).astype(np.uint8)).resize((w, h), Image.LANCZOS), float) / 255
    D = D.resize((w, h), Image.LANCZOS)
    pad = 40
    I = np.pad(I, pad); Dp = Image.new('RGBA', (w + 2 * pad, h + 2 * pad)); Dp.paste(D, (pad, pad)); D = Dp
    H_, W_ = I.shape
    # silhouette: everything not reachable from the border through empty space
    img = Image.fromarray(((I > 0.06) * 255).astype(np.uint8)).copy()
    ImageDraw.floodfill(img, (0, 0), 128)
    fill = (np.array(img) != 128).astype(float)
    # a wet, wobbly edge: blur, then cut with noise
    n1 = fnoise(H_, W_, 1.0, seed); n2 = fnoise(H_, W_, 1.7, seed + 1); g = fnoise(H_, W_, 0.2, seed + 2)
    m = (blur(fill, 3) + (n1 - .5) * .45 > .5).astype(float)
    m = blur(m, 1.2)
    edge = np.clip(m - blur(m, 7), 0, 1) * 2.2            # pigment that dried at the rim
    pool = n2
    a = m * (0.14 + 0.24 * pool) + edge * 0.38 + I * 0.2
    bloom = (np.abs(fnoise(H_, W_, 1.9, seed + 3) - .6) < .014) * m * .18   # back-runs
    a = np.clip((a + bloom) * (0.82 + 0.3 * g), 0, 1)
    mix = np.clip(pool * 1.2 - .1 + tint, 0, 1)[..., None]
    rgb = MOON * (1 - mix) + CREAM * mix
    rgb = rgb * (1 - edge[..., None] * .35) + DEEP * (edge[..., None] * .35)
    # the soft bleed of wet paint around it
    halo = blur(m, 10) * .10
    A = np.maximum(a, halo)
    out = np.dstack([rgb, A])
    # the site's digit drawing on top, like the creatures in the sky
    Dn = np.array(D, float) / 255
    da = Dn[..., 3] * digits
    out[..., :3] = out[..., :3] * (1 - da[..., None]) + CREAM * da[..., None]
    out[..., 3] = np.clip(out[..., 3] + da * (1 - out[..., 3]), 0, 1)
    out[..., 3] *= 0.6                                    # quiet: a glaze, not a sticker
    im = Image.fromarray(np.clip(np.dstack([out[..., :3], out[..., 3:] * 255]), 0, 255).astype(np.uint8), 'RGBA')
    if flip: im = im.transpose(Image.FLIP_LEFT_RIGHT)
    if rot: im = im.rotate(rot, Image.BICUBIC, expand=True)
    return im

def over(canvas, im, x, y):
    canvas.alpha_composite(im, (int(x - im.width / 2), int(y - im.height / 2)))

# ---- top: a fish beside the heading, a manta further out ----
top = Image.new('RGBA', (1600, 560))
over(top, paint('manta', .42, 21, rot=-12, digits=.45), 1470, 200)
over(top, paint('fish', .55, 31, flip=True, digits=.5, tint=.3), 640, 390)
top.save(f'{OUT}/creatures-top.webp', quality=78, alpha_quality=70, method=6)

# ---- bottom: a sea floor wash with the turtle, a sea star and fish ----
bot = Image.new('RGBA', (1600, 560))
W, H = bot.size
x = np.arange(W); yy = np.arange(H)[:, None]
floor = 420 + 30 * np.sin(x / W * 2 * np.pi * 1.2 + 1) + 14 * np.sin(x / W * 2 * np.pi * 3.7)
nf = fnoise(H, W, 1.1, 41)
fa = np.clip((yy - floor[None, :] + (nf - .5) * 50) / 30, 0, 1) * (0.25 + 0.25 * fnoise(H, W, 1.6, 42))
frgb = DEEP * .7 + (CREAM - DEEP * .7) * fnoise(H, W, 1.4, 43)[..., None] * .35
bot.alpha_composite(Image.fromarray(np.dstack([frgb, fa * 255]).astype(np.uint8), 'RGBA'))
over(bot, paint('turtle', .55, 51, rot=-20, digits=.5), 330, 380)
over(bot, paint('star', .5, 61, rot=15, digits=.5, tint=.5), 1180, 450)
over(bot, paint('star', .32, 62, rot=-30, digits=.5, tint=.6), 1290, 480)
for i, (fx, fy, s) in enumerate([(820, 340, .42), (880, 315, .36), (905, 370, .38), (960, 340, .33), (850, 390, .3)]):
    over(bot, paint('fish', s, 70 + i, digits=.5, tint=.25), fx, fy)
bot.save(f'{OUT}/creatures-bottom.webp', quality=78, alpha_quality=70, method=6)

# ---- stars: seamless tile of small painted stars with a digit or two ----
N = 1024
st = Image.new('RGBA', (N, N))
r = np.random.default_rng(5)
for i in range(26):
    cx, cy = r.uniform(0, N, 2); s = r.uniform(2, 6) if i % 5 else r.uniform(7, 12)
    sz = int(s * 8)
    yy, xx = np.mgrid[-sz:sz + 1, -sz:sz + 1].astype(float)
    d = np.hypot(xx, yy)
    core = np.exp(-(d / (s * .7)) ** 2)
    spikes = (np.exp(-(np.abs(xx) / (s * .18)) ** 2) * np.exp(-(np.abs(yy) / (s * 2.6)) ** 2) +
              np.exp(-(np.abs(yy) / (s * .18)) ** 2) * np.exp(-(np.abs(xx) / (s * 2.6)) ** 2)) * (s > 6)
    halo = np.exp(-(d / (s * 2.2)) ** 2) * .25
    a = np.clip(core + spikes * .3 + halo, 0, 1) * r.uniform(.15, .38)
    tint = r.uniform(0, 1)
    rgb = np.ones(a.shape + (3,)) * (MOON * (1 - tint) + CREAM * tint)
    im = Image.fromarray(np.dstack([rgb, a * 255]).astype(np.uint8), 'RGBA')
    for ox in (-N, 0, N):                      # wrap so the tile repeats seamlessly
        for oy in (-N, 0, N):
            st.alpha_composite(im, (int(cx - sz + ox), int(cy - sz + oy))) if -2 * sz < cx + ox < N + 2 * sz and -2 * sz < cy + oy < N + 2 * sz else None
st.save(f'{OUT}/stars-tile.webp', quality=80, alpha_quality=70, method=6)

# ---- waves: a few loose brush strokes of swell, seamless in both directions ----
N = 1024
yy, xx = np.mgrid[0:N, 0:N].astype(float)
streak = fnoise(N, N // 8, 1.1, 81)
streak = np.array(Image.fromarray((streak * 255).astype(np.uint8)).resize((N, N), Image.BILINEAR), float) / 255
wa = np.zeros((N, N))
r = np.random.default_rng(9)
for k in range(5):
    y0 = (k + r.uniform(.2, .8)) * N / 5
    amp, per, ph = r.uniform(10, 22), N / r.choice([1, 2, 3]), r.uniform(0, 2 * np.pi)
    cy = y0 + amp * np.sin(2 * np.pi * xx / per + ph)             # whole periods across, so it tiles sideways
    d = np.minimum(np.abs(yy - cy), N - np.abs(yy - cy))           # and wraps top to bottom
    width = 2.5 + 2 * (0.5 + 0.5 * np.sin(2 * np.pi * xx / per + ph + 1.3))   # thicker on the crests
    stroke = np.exp(-(d / width) ** 2) * np.clip((streak - .35) * 3, 0, 1)      # dry brush breaks it up
    wa = np.maximum(wa, stroke * r.uniform(.10, .18))
rgb = np.ones((N, N, 3)) * MOON
Image.fromarray(np.dstack([rgb, wa * 255]).astype(np.uint8), 'RGBA').save(f'{OUT}/waves-tile.webp', quality=80, alpha_quality=70, method=6)
print('ok')
