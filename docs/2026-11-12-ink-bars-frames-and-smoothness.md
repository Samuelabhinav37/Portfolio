# Ink bars, project frames, and why busy sites stay smooth (2026-11-12)

References read: denormalized.co (its `js/classified.js` and page source),
noth.in (page source, plus values measured in the browser), grail-app.com
(page source only: one bundled script, nothing to read).

Frame rates could not be measured: the automation tab was throttled to one
frame a second. Everything below is from reading code and computed styles.

## 1. Denormalized's black bars

Not CSS. One transparent WebGL canvas lies over the heading; the words stay in
the DOM underneath. A fragment shader paints each phrase's line boxes as ink:

- At rest the edge is uneven: distance to the rectangle's edge plus noise.
- On hover a "drop" lands where the pointer is and spreads as a circle; more
  drops land along the bar at staggered times. The reveal finishes by the
  circles overlapping, not by fading.
- The moving edge gets noise added (frayed tendrils); behind it is clean.
- 1.7s to clear with an ease-out, 0.65s to flood back on leave.
- Touch: tap toggles. No WebGL: flat bars that toggle.
- Bars are measured with the sheet's tilt transform removed, so they land
  right while the sheet is still moving.
- It draws only while a bar is changing, and caps the canvas at 2x.

Ours (`src/pages/about.astro`): same technique, our own shader. Differences:
ink grain is sized in bar heights (our text is smaller), the flat CSS bars
show until the canvas is drawing, and bars are re-measured whenever the line
splitter rebuilds the statement.

## 2. Noth.in's project tiles

Webflow interactions on GSAP, with Lenis smooth scroll. Per tile:

- The frame has `clip-path: inset(~100% ~100% 0 0)` far below the screen and
  eases to `inset(0)`: it opens from its outer bottom corner (left tiles from
  bottom left, right tiles from bottom right), mostly done as it enters, with
  a long tail.
- The picture is about 40% taller than the frame (`overflow:hidden`) and
  slides inside it.
- The tile itself is translated by a different amount per tile (30 to 80px),
  so neighbours pass each other.
- Every value follows the scroll with a lag. That lag, plus Lenis, is the
  "fluid" feel.

Ours (`src/scripts/motion.js`, `spread`): the same three movements with
`scrub: 0.8`. The picture is 24% taller, not 40%, because our tile pictures
are logos and a bigger crop cuts them. The CSS view-timeline version is gone:
the frame clips, so `view()` on the picture tracked the frame, not the page.

Not built: the pinned "WORKS" label whose letters travel across the top.

## 3. Why those sites stay smooth with a lot going on

What they have in common, from their code:

1. **Only cheap properties move.** Transforms, opacity and clip-path. No
   animated width, height, top, margin, shadow or filter.
2. **Nothing runs when nothing changes.** The ink canvas draws only during a
   dissolve. Videos load and play only while on screen and pause when they
   leave (IntersectionObserver).
3. **One scroll clock.** Lenis smooths the wheel and every scroll effect reads
   that same position on the same frame. No separate scroll listeners.
4. **Scrub with lag.** Effects ease toward the scroll position, which hides
   uneven wheel input and the odd slow frame.
5. **Measure rarely.** Layout is read on resize and font load, not per frame.
6. **Capped resolution.** Canvases never exceed 2x.
7. **Small pages.** About 1,200 elements each, lazy images, WebP with srcset.

## 4. Where our Home stands

Already in place: Lenis and ScrollTrigger share GSAP's ticker; scroll effects
use transforms and clip-path.

Measured on Home: 2,316 elements, 56 scripts, 4 canvases (two full-screen:
`sky-fx` 1920x889 and `season-fx`), 4 fixed full-screen layers, 18 elements
with a filter, backdrop-filter or blend mode, and 4 of 15 images lazy.

Not verified, worth checking in this order:

1. Whether each always-on loop (sky, clouds, rays, seasons, Kai, writing reel)
   stops when its section is off screen. All of them handle a hidden tab;
   few use IntersectionObserver.
2. The 18 filter and blend-mode elements over a moving sky: each can force a
   full repaint every frame.
3. `cursor-tip.js`, `scroll-toc.js`, `kai-watch.js` and `pixel-clouds.js`
   each add their own scroll listener instead of reading Lenis.
4. Eleven images load eagerly.
