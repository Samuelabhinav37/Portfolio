# kartik.to + andreas.vision: how the effects are built (2026-11-10)

Both sites were read live in Chrome and their shipped JS bundles were read directly. Nothing here is copied code; it is how each effect works, so we can rebuild the idea our own way.

## kartik.to (Next.js, WebGL2)

Base: `@paper-design/shaders` (Apache-2.0, v0.0.82, zero deps, vanilla `ShaderMount` exists, so no React needed). His shaders are custom fragment shaders run through that mount.

### Hero: dithered falling leaves (`FallingLeavesGround`)
- One WebGL2 canvas behind the hero, `z:-1`, bleeds past the hero top/bottom, CSS `mask-image` fades the edges.
- Shader = paper's Dithering shader (Bayer 8x8, chunky `u_pxSize` pixels, 2 colors) plus a leaves layer and a soft diagonal light beam.
- Leaf art: drawn once with Canvas2D into a 256x256 texture. Red channel = leaf body, green = veins (midrib + side veins), sent as `u_leafShape`.
- Up to 16 leaves. JS moves them each frame and sends `place[x,y,size,spin]` + `look[yawCos,pitchCos,density,ink]` as uniforms.
  - Motion: fall speed x (0.55 + 0.7|cos swing|) so it slows at each end of a swing, sideways sway + wind, yaw/pitch/tilt tumble.
  - Flip: the shader squashes the leaf by cos(yaw) and cos(pitch). The back face is drawn 15% fainter.
  - Depth: `near` 0..1 scales size, speed and density. Nearer leaves are bigger, faster and denser.
  - Leaves that drop off the bottom respawn above the top, and ones that leave the sides wrap around.
- Text-aware: it walks the hero's `h1, p` text nodes, sends up to 24 line rects, and leaves get sparser and lighter behind words (`u_wordDensity`, `u_wordInk`, `u_wordMargin`). Rects are only re-measured on resize or animationend.
- Cost controls: count scales with width (`clamp(w/1440, .55, 1)`), the frame is skipped when the tab is hidden or the canvas is off screen, there is a frame cap, `maxPixelCount`, and reduced motion freezes it.
- Colours come from CSS tokens (`--colors-bg-canvas` + 2 inks) and are re-read on theme change through a MutationObserver on `data-theme`.
- Intro: there is none. There's no CSS animation on load and no storage flag. The beam and leaves just start moving.

### Project cards ("products")
- Horizontal carousel of wide cards. Each one has a small caption ("Spotwork • Design system"), an outcome headline ("…ship 1.5x as many releases"), and a black browser frame holding a live-looking product screen.
- Behind the frame, a WebGL "Blue Ribbon" light rises from the bottom centre of the card. It uses 4 OKLCH colour stops, an eased curve so there is no visible crease, and dither against banding. One canvas per card.
- On hover the caption turns accent orange, an expand icon appears, and the screen inside the frame pans.

### Lab tiles ("Shader Preset")
- 3-up grid: Pixel Comets (pixel grid, 30 heads with 14px tails, glow), Crest Icons (icon set), Cosmic Track (ribbons in perspective with dithered edges). These are his own presets shown as work.

### Testimonials
- Masonry wall. Each card has an SVG double sine wave in one tint (green, purple or orange), blurred, plus grain at the bottom.

## andreas.vision (Vite + React, Canvas2D, not WebGL)

### Pixel sky (`Sky` component, about 7 KB)
- A grid of square cells. Each cell's tone = 3-octave value noise (.6/.3/.1) cut at [.42,.49,.55,.61] into 5 tones: deep, deep/mid checker, mid, mid/pale checker, pale. The checkers are `createPattern` 2x2 tiles, so there are only 3 real colours (`--sky-deep/mid/pale`).
- Patches where a second noise is above .6 snap to 3x cells, which makes the chunky clumps.
- Small cloud strings: 3-12 humps built from tiny squares with a few gaps (1 in 14 skipped).
- `clear` rects keep cells empty around content.
- `image-rendering: pixelated`, drawn at devicePixelRatio.

### Intro
- Every cell gets `order = distance from centre (radial) or row (rows) x .82 + noise x .18`.
- Reveal = `revealMs` 500 by default, in `steps: 6`. The sky jumps in 6 visible chunks instead of fading smoothly, which is the pixel feel.
- `leaving: true` runs the same thing backwards as the exit.
- Drift: clouds slide with `shift`, redrawn at 24 fps max, paused off screen (IntersectionObserver). Reduced motion gives one static frame.
- The hero H1 is a light serif (TRJN DaVinci) over the white cloud, so contrast is very low. Don't copy that.

### Seam
- A pixel horizon where the sky meets the dark page: columns of cells whose height follows noise, with the 2 bottom rows forced dark plus a few stray dark cells. Sky and page meet as a broken pixel edge, not a straight line.

### Reuse of the one look
- A tiny sky square inside the headline, the sky behind the main case-study screenshot, a pixel globe on scroll (zooms out from Poland to the Netherlands to the US with flag pins and a route line), and writing covers in other hues (green, pink, orange, blue).

### Products
- Left: big case-study cards. Each has a screenshot on a pixel-sky background, tags ("Design tool · Design engineering · AI"), an outcome headline ("Product prototyping made 90% faster…") and a client/product line.
- Right: 2-column grid of small looping clips of side experiments (piano, music player, clock, orbit diagram).

## What we already have
- WebGL sky (`sky-engine.js`, `sky.js`, worker), shared on every page through `SiteSky.astro`, with dark/day tones and a clock that carries across pages.
- `pixel-clouds.js`: hand-drawn pixel-art PNG clouds in both themes, sway + parallax.
- `word-vine.js`: ASCII vine on Home.
- `index-intro-sequence.js`: now an instant settle, with no intro.
- Projects tiles on `/projects/<slug>` (branch `feat/projects-path-2026-11`).

## Options for us
1. **Pixel reveal intro (andreas idea).** A Canvas2D grid in our sky colours. Radial order + noise, about 500ms in 6 steps, once per visit (sessionStorage). It hands over to the real WebGL sky by fading the canvas out. The same code run backwards could be the page-leave beat for the ClientRouter. Small: about 120 lines, no dependency.
2. **Dithered leaves off the vine (kartik idea).** Our own leaf shape and our own inks. Either an extra pass in our WebGL sky or a small WebGL2 canvas over the hero only. Reuse his good ideas: tumble by cos(yaw/pitch), depth scaling, fade behind text rects, count by width, pause off screen, freeze on reduced motion. Write the shader ourselves (about 150 lines). Adding `@paper-design/shaders` would also work (Apache-2.0, no deps) but brings its whole uniform system for one effect.
3. **Project cards.** A screenshot in a frame on a per-project background. Either the pixel sky in each project's hue (andreas) or a dithered light rising from the bottom (kartik). Plus a one-line outcome headline. Visual only, no new page structure.
4. **Pixel seam.** Where the sky meets the content on Home, use a broken pixel edge instead of a gradient. Cheap, and it ties the sky to the page.

Risks: the pixel-art PNG clouds and a noise pixel sky could clash. Pick one pixel size and one palette. Running a second WebGL context on Home next to the sky costs GPU, and first-visit raster stalls are already 250-590ms on some pages.

## Colour for the vine and leaves (built 2026-11-10)
- Morning glories: *Ipomoea tricolor* 'Heavenly Blue' is sky blue with a white/yellow throat; *I. purpurea* ('Grandpa Ott') is violet with a pink throat. Blue vanished on the day sky (#8fb0e0), so day glories are violet, pink-throated; buds pink. Sources: [NC State Extension](https://plants.ces.ncsu.edu/plants/ipomoea-tricolor/), [Gardenia](https://www.gardenia.net/plants/genera/ipomoea-morning-glory).
- Night: the moonflower *Ipomoea alba* is the morning glory's night-blooming relative, opening white at dusk, so night glories turn white. Source: [Wikipedia](https://en.wikipedia.org/wiki/Ipomoea_alba), [UF/IFAS](https://gardeningsolutions.ifas.ufl.edu/plants/ornamentals/moonflower/).
- Night colour: the Purkinje shift moves the eye's sensitivity toward blue in low light, so reds and greens darken first ([Wikipedia](https://en.wikipedia.org/wiki/Purkinje_effect)). Pixel-art practice: value first, then hue-shift; shadows cooler, highlights warmer ([Lospec hue-shift palettes](https://lospec.com/palette-list/tag/hue%20shift), [pixnote shading](https://pixnote.net/en/learn/shading)).
- So at night everything takes the night pixel clouds' own slate ramp (#68738c, #56617a, #444e66, #30384d, #202637), leaves tinted slightly mauve or plum, with a brighter moonlit rim on the lit side. Day leaves: warm yellow-green highlights, cool blue-green outlines.
