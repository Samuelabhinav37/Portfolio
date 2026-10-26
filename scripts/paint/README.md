# Projects sheet paintings

Generators for `public/images/paint/` (the watercolour sheet behind Selected work on the homepage). Run them once by hand; the outputs are committed.

1. `node scripts/paint/shapes.mjs <shapes-dir>` renders each creature's field and digit drawing from `public/scripts/sky-cast.js`.
2. `python scripts/paint/wash.py <out-dir>` makes `wash-tile.webp` and the brush edge (`wash-edge.webp`, flipped for `wash-edge-b.webp`, resized to 1600x280).
3. `python scripts/paint/creatures.py <shapes-dir> <out-dir>` paints `creatures-top.webp`, `creatures-bottom.webp`, `rays.webp`, `stars-tile.webp`, `waves-tile.webp`, `clouds-tile.webp`, `side-l.webp`, `side-r.webp`, `scatter-tile.webp`, and the animated pieces the blog index moves with CSS: `sprite-fish-0..2.webp`, `sprite-star-0..1.webp` and `twinkle-0..2.webp`.

4. `python scripts/paint/reef.py <out-dir>` paints the about page's reef: `about-reef-floor.webp` and `about-reef-l/-r.webp`, a mix of coral growth forms (staghorn, table, brain, lettuce, pillar, sponges, sea fans, whips, anemones) in three hazed depth rows.

Needs Python with numpy and Pillow, and Playwright with Chrome for step 1.
