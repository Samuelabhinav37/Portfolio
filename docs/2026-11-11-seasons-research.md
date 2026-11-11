# Seasons on the homepage sky (2026-11-11)

What falls across the homepage hero, drawn as pixel art on one 2px grid like the
pixel clouds. Code: `public/scripts/seasons.js` (one engine, one entry per season in
`SEASONS`), light rays in `public/scripts/light-rays.js`.

## Live now

| Sky | Shows |
|---|---|
| Day | spring petals + sunbeams |
| Night | summer fireflies + moonbeams |

The theme picks the season (`byTheme()`), not the month.

## Kept for later (all still in `SEASONS`)

| Season | Day | Night | Notes |
|---|---|---|---|
| Autumn | tan, sage, rust leaves; lit half light | grey leaves, only the moonlit rim bright | tumble after kartik.to: slower at each end of the swing, turn squashes across, pitch squashes along, back face swaps lit and shadow halves |
| Spring | cherry pink, blush, white petals (live) | grey petals | rounded oval, narrow base, notched tip; flutters more than leaves (sway 16, spin x3) |
| Summer | dandelion seeds rising (tuft of hairs on a short stem) | fireflies (live): 2x2 core, stepped halo while bright, blink | fireflies wander with a slowly turning heading |
| Winter | white crystals on the blue sky | white and ice-blue crystals | see below |

Switching to month-based seasons later: `MONTH` (northern seasons) is still in the
file; set `season = MONTH[new Date().getMonth()]` and drop `byTheme()`.

### Snow crystals

- Shapes from Libbrecht's common types ([classification](https://www.its.caltech.edu/~atomic/snowcrystals/class/class-old.htm)):
  stellar dendrite, fernlike dendrite, sectored plate, simple forked star, plain six arms.
- Six identical arms, side branches leaving the arm at 60 degrees, mirrored. A square
  grid cannot draw clean 60 degree lines, so each crystal is walked onto the grid every
  frame, which also lets it turn and rock (foreshortening) as it falls.
- No single-pixel flakes: on the night sky they read as stars. Smallest that still reads
  as a crystal on the 2px grid is about 8px; finer designs blob below about 16px, so far
  (small) crystals are plain arms, middle ones forked stars, near ones branched.
- Sizes tried: 12-30 (blobs), 22-46 (too big), 12-26, 8-18 (too small), 10-22 (liked).

### Rejected

- Monsoon rain (slanted streaks, splashes on the hero sentence): user didn't like it.
- Round snow dots: collide with the background stars.

## Light rays

- Crepuscular rays from just off the top right (where the sun/moon switch is).
- GPU "god rays" blur an occlusion mask along lines from the light
  ([GPU Gems 3, ch. 13](https://developer.nvidia.com/gpugems/GPUGems3/gpugems3_ch13.html)); with nothing to
  occlude, each beam here is a soft wedge of angle, fading with distance.
- Pixel-art look: ordered (Bayer 4x4) dithering on a 3px grid in two tones, the way
  pixel shaders dither god rays ([Pixelated God Rays](https://godotshaders.com/shader/pixelated-god-rays/)).
- Speed: strength only depends on the angle from the light, so a frame fills one
  2048-entry table by angle and each cell looks itself up (18ms -> 6ms a frame, 12fps).
- Moonbeams: cool and fainter (`TONE.night`). Lunar crepuscular rays are real: moonlight
  through gaps in cloud, made visible by haze, and they come and go as clouds cross the
  moon ([Atmospheric Optics](https://atoptics.co.uk/blog/lunar-rays/)).
- Small motion (2026-11-11):
  - each beam breathes (strength) and sways (angle) on its own slow clock;
  - a passing cloud: every 45s a soft shadow sweeps across the beams in 30s, dimming them
    one after another;
  - dust motes (Tyndall effect): specks drift down and sway, and only light up inside a
    beam, brighter in a stronger one. The usual "floating dust in a light shaft" touch in
    game VFX ([Foundry animated light rays](https://foundryvtt.com/packages/animated-light-rays-by-mattm),
    [Unreal forum](https://forums.unrealengine.com/t/stylized-fake-animated-light-shafts-with-fireflies/1941111)).
    About 8 of 56 are lit at a time.

## Still open

- A public pause control (WCAG 2.2.2 expects one for moving decoration over 5s):
  [W3C WAI list](https://lists.w3.org/Archives/Public/w3c-wai-ig/2022JulSep/0121.html),
  [Hidde de Vries](https://hidde.blog/meeting-2-22-pause-stop-hide-with-prefers-reduced-motion/).
- Preview: `/?seasons` shows a switch (seasons, Pause, Rays); `/?season=winter` forces one.
