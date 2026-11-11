# Motion study: lamalama.com and alitwotimes.com (2026-11-11)

Watched in Chrome (Playwright), frame bursts every ~100ms on load, scroll and page change.

## lamalama.com (GSAP, Canvas 2D + WebGL images, WordPress)

- **Page change / load: pixel-dither cover.** A full-screen canvas (`js-upper-canvas`,
  fixed, z 8) of big square blocks (~36px on a 1440 screen) with the pixel logo in the
  middle. The blocks fill in by an ordered dither: a sparse lattice, then a checker, then
  dense, until the screen is covered; then they dissolve the same way to show the new page.
  The cover can also carry a dithered photo or a cream tone.
- **Cards: dithered image reveal.** Project thumbnails are WebGL images (`js-webgl-image`).
  They arrive as a coarse dithered / scrambled-pixel version of the picture that resolves
  to the sharp image within ~0.5s.
- **Card text "typing": scramble decode.** Tags and labels (`js-mono-text-reveal`, mono
  caps) show random symbols first (`CORPO#@$`, `CAMP>1@`, `@>*>#%#%#`) and lock in
  letter by letter, left to right.
- **Paragraphs: line mask reveal.** Body text rises line by line from under a mask
  (lines visibly clipped mid-reveal).
- **Background images** on some sections are halftone-dithered photos.

## alitwotimes.com/bio (one bundle, no global libraries)

- **Page change: panel wipe.** The new page's panel (here cream) slides in from the
  right over the old page in ~0.4s, then its content comes in.
- **Text: masked line rise, staggered.** Headlines and paragraphs rise line by line from
  under a mask ("NAMED BY THE / 2014 GUNN REPORT / ..."), each line a beat after the one
  above. Small paragraphs reveal a line at a time, like typing by lines.
- **Cards/images:** photos sit in a loose staggered grid with captions; they fade/rise in
  as they enter, text beside them reveals by lines.
- **Grain** over the whole page.

## Mapping to this site (proposal)

| Effect | Where here | Fits because |
|---|---|---|
| Pixel-dither cover between pages (lamalama) | ClientRouter page change (Motion.astro) | the sky, clouds, rays and leaves are already ordered-dither pixel art |
| Dithered image reveal (lamalama) | project cards (/projects), blog cards, photos | same Bayer matrix as rays/clouds |
| Scramble decode on labels (lamalama) | card tags, categories, dates | the site already has a scramble intro (old vine) and mono labels |
| Masked line rise (ali) | blog post headings and paragraphs, About statement | calm, readable, works with the novel-page posts |
| Panel wipe between pages (ali) | alternative to the pixel cover | simpler, but less "this site" |

Only one page-change style should be used: pixel cover or panel wipe.
