# Generates the night-watercolour assets for the homepage projects sheet:
#   wash-tile.webp  seamless 1024px navy watercolour body (pigment pooling, granulation, blooms)
#   wash-edge.png   2400x420 alpha mask: a painted top edge with dry-brush fringe (white = paint)
import sys, numpy as np
from PIL import Image

out = sys.argv[1]
rng = np.random.default_rng(7)

def fnoise(h, w, beta, seed):
    """Periodic 1/f^beta noise via FFT (tiles seamlessly), scaled to 0..1."""
    r = np.random.default_rng(seed)
    fy = np.fft.fftfreq(h)[:, None]; fx = np.fft.fftfreq(w)[None, :]
    f = np.sqrt(fx * fx + fy * fy); f[0, 0] = 1
    spec = (r.normal(size=(h, w)) + 1j * r.normal(size=(h, w))) / f ** beta
    n = np.real(np.fft.ifft2(spec))
    return (n - n.min()) / (n.max() - n.min())

# ---- body tile ----
N = 1024
pool = fnoise(N, N, 1.6, 1)            # broad pigment density
mid = fnoise(N, N, 1.1, 2)             # mid blotches
gran = fnoise(N, N, 0.15, 3)           # granulation speckle
bloom = fnoise(N, N, 1.9, 4)
d = 0.55 * pool + 0.3 * mid + 0.15 * gran
# watercolour blooms: pale cauliflower rings where the wash pooled
ring = np.abs(bloom - 0.62) < 0.012
d = np.where(ring, d + 0.10, d)
d = np.clip((d - d.mean()) * 1.6 + 0.5, 0, 1)
dark = np.array([7, 11, 26], float); light = np.array([24, 36, 72], float)
rgb = dark + (light - dark) * d[..., None]
rgb += (gran[..., None] - 0.5) * 10       # paper tooth
Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8)).save(out + '/wash-tile.webp', quality=80, method=6)

# ---- painted edge mask ----
W, H = 2400, 420
x = np.arange(W)
# contour: slow swells plus a couple of tall brush lobes, lower = more paint
yb = (250 + 38 * np.sin(x / W * 2 * np.pi * 1.3 + 0.6) + 22 * np.sin(x / W * 2 * np.pi * 3.1 + 2.0)
      + 12 * np.sin(x / W * 2 * np.pi * 7.3) - 70 * np.exp(-((x - W * .3) / 160) ** 2) - 50 * np.exp(-((x - W * .78) / 220) ** 2))
yy = np.arange(H)[:, None]
edgeN = fnoise(H, W, 1.0, 5)
streak = fnoise(H, W // 8, 1.1, 6)                  # stretched 8x sideways below: long dry-brush streaks
streak = np.array(Image.fromarray((streak * 255).astype(np.uint8)).resize((W, H), Image.BILINEAR), float) / 255
dist = yy - yb[None, :] + (edgeN - 0.5) * 60       # >0 below the edge
a = np.clip(dist / 18 + 0.5, 0, 1)                 # soft-ish main edge
# dry-brush fringe: broken paint above the edge, thinning out upward
fr = np.clip(1 - (-dist) / 110, 0, 1) * (streak > 0.58) * (dist < 0)
a = np.maximum(a, fr * np.clip((streak - 0.58) * 6, 0, 1))
a = np.clip(a, 0, 1)
rgba = np.zeros((H, W, 4), np.uint8); rgba[..., :3] = 255; rgba[..., 3] = (a * 255).astype(np.uint8)
Image.fromarray(rgba, 'RGBA').save(out + '/wash-edge.webp', quality=85, method=6)
print('ok')
