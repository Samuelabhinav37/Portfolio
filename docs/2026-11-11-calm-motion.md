# Calm motion (2026-11-11)

Replaces the lamalama-style pixel motion (docs/2026-11-11-lamalama-alitwotimes-motion.md):
the scramble labels, the dithered picture reveal and the pixel page cover read as
noisy next to the smooth light rays.

## What the reference sites do

From the user's Notion list of malik.url website breakdowns (23 sites) and two measured live:

- oliverdupuy.com: no animation library; only opacity and colour transitions,
  0.6s `cubic-bezier(0.1, 0, 0, 1)`. Project images show about a third at first.
- laurent.fyi: no library; opacity/border 0.18-0.3s ease, height 0.5s `cubic-bezier(0, 0, 0.2, 1)`.
- Studio Chen (from the breakdown): the bottom image row shows 10% and rises as you scroll.
- Yuri Roga (from the breakdown): snappy hover title animations; the rest is still.

Common thread: layout and type carry the site; motion is short fades and crops, never glitches.

## What we built (src/scripts/motion.js, src/components/Motion.astro)

- Page change: plain crossfade. Old page out 200ms, new page in 450ms `cubic-bezier(.1,0,0,1)`, no movement.
- Pictures (.pw-img, .wk-img, .fn-pic): crop reveal tied to scroll, from the bottom 25% to full,
  with the image settling from 1.06 to 1.
- Labels (.pw-tags, .fn-cap > span, .wk-no, .wk-year): slow typewriter, 55-90ms a letter,
  110ms on a space, 260ms after punctuation, thin caret that blinks twice then fades.
  Letters keep their space from the start (opacity only), so nothing shifts.
- Masked text lines: kept, 1.05s shortened to 0.8s.

## Typewriter accessibility

- Screen readers get the full label at once (sr-only copy; the typed layer is aria-hidden),
  not letter-by-letter updates. No aria-live.
- Reduced motion: no typing, labels show as plain text (init() returns before reveals).
- The caret stops blinking after two blinks instead of blinking forever.
