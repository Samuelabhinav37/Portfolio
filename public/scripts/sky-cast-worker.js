/* Draws the sky cast's rest poses off the main thread and hands back
   finished pictures, so the page never stutters while they are made. Each
   rest pose gets a few versions that differ only in their digits, which the
   page cross-fades so the digits shimmer; the sea star gets a loop of its
   arms slowly curling. */
importScripts('/scripts/sky-cast.js');
const { digits, manta, whale, turtle, seastar, fish, TAU } = self.SkyCast;
const FIELDS = {
  manta: () => manta({ ph: 0, flat: true }),
  whaleBody: () => whale({ wave: false, part: 'body' }),
  whaleFlipper: () => whale({ wave: false, part: 'flipper' }),
  turtleBody: () => turtle({ part: 'body' }),
  turtleFlipper: () => turtle({ part: 'flipper' }),
  star: (q) => seastar({ t: (q * TAU) / 0.18 }),
  fish: () => fish(),
};
onmessage = (e) => {
  const { id, kind, S, cell, reach, reachY, frames, dpr, seed, w, h, mask, still, ox = 0, oy = 0 } = e.data;
  for (let i = 0; i < frames; i++) {
    const c = new OffscreenCanvas(Math.ceil(w * dpr), Math.ceil(h * dpr)), x = c.getContext('2d'), q = i / frames;
    x.scale(dpr, dpr);
    digits(x, { cell, f: FIELDS[kind](q), cx: w / 2 - ox * S, cy: h / 2 - oy * S, S, reach, reachY, seed: seed + (still ? i * 17 : 0), now: still ? i * 7 : q * 6, W: w, H: h, mask });
    const bmp = c.transferToImageBitmap();
    postMessage({ id, i, bmp }, [bmp]);
  }
};
