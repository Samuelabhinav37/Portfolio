# Projects sheet paintings

Generators for `public/images/paint/` (the watercolour sheet behind Selected work on the homepage). Run them once by hand; the outputs are committed.

1. `node scripts/paint/shapes.mjs <shapes-dir>` renders each creature's field and digit drawing from `public/scripts/sky-cast.js`.
2. `python scripts/paint/wash.py <out-dir>` makes `wash-tile.webp` and the brush edge (`wash-edge.webp`, flipped for `wash-edge-b.webp`, resized to 1600x280).
3. `python scripts/paint/creatures.py <shapes-dir> <out-dir>` paints `creatures-top.webp`, `creatures-bottom.webp`, `rays.webp`, `stars-tile.webp`, `waves-tile.webp`, `clouds-tile.webp`, `side-l.webp`, `side-r.webp` and `scatter-tile.webp`.

Needs Python with numpy and Pillow, and Playwright with Chrome for step 1.
