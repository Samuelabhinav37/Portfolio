/* Homepage intro, after andreas.vision's pixel sky reveal: the page starts
   covered in its own background colour, cut into square cells, and the cover
   breaks away from the middle of the hero outwards in a few visible steps,
   showing the sky underneath. Cells at the moving edge are drawn as a 2x2
   checker for one step, so the edge reads as dithered pixels, not a fade.

   Once per visit: the inline gate in index.astro's <head> adds html.px-intro
   (only when sessionStorage has no 'px-intro' and motion is allowed), which
   shows #px-intro as a solid cover before the first paint. This script cuts
   it away, then removes the class. If it never runs, CSS hides the cover after
   4s on its own. */
(window.onPage || function (f) { f(new AbortController().signal); })(function (signal) {
  var root = document.documentElement, cv = document.getElementById('px-intro');
  if (!cv || !root.classList.contains('px-intro')) return;
  try { sessionStorage.setItem('px-intro', '1'); } catch (e) {}

  var CELL = 22, MS = 950, STEPS = 9;
  var dpr = Math.min(2, devicePixelRatio || 1), W = innerWidth, H = innerHeight;
  cv.width = Math.ceil(W * dpr); cv.height = Math.ceil(H * dpr);
  var ctx = cv.getContext('2d');
  var bg = getComputedStyle(root).getPropertyValue('--c-bg').trim() || '#030307';
  // the moving front is lit in the vine's ink: on the dark sky a plain dark-to-dark reveal can't be seen
  var ink = root.getAttribute('data-theme') === 'light' ? 'rgba(56,42,36,.35)' : 'rgba(157,159,161,.38)';

  // 2x2 checker tiles, one cell / 4 per square: 'half' = cover with holes, 'lit' = cover with ink squares
  function checker(a, b){
    var tile = document.createElement('canvas'), q = Math.max(1, Math.round(CELL * dpr / 4));
    tile.width = tile.height = q * 2;
    var tc = tile.getContext('2d');
    if (b){ tc.fillStyle = b; tc.fillRect(0, 0, q * 2, q * 2); }
    tc.fillStyle = a; tc.fillRect(0, 0, q, q); tc.fillRect(q, q, q, q);
    return ctx.createPattern(tile, 'repeat');
  }
  var half = checker(bg), lit = checker(ink, bg);

  // when each cell opens: distance from the hero's middle, plus some noise so the edge is ragged
  function hash(x, y){ var h = Math.imul(x, 374761393) + Math.imul(y, 668265263) | 0; h = Math.imul(h ^ h >>> 13, 1274126177); return ((h ^ h >>> 16) >>> 0) / 4294967296; }
  var cells = [], cx = W / 2, cy = H / 2, R = Math.hypot(cx, cy);
  for (var y = 0, gy = 0; y < H; y += CELL, gy++) for (var x = 0, gx = 0; x < W; x += CELL, gx++){
    var d = Math.hypot(x + CELL / 2 - cx, (y + CELL / 2 - cy) * 1.25) / R;
    cells.push({ x: x, y: y, at: Math.min(1, d) * 0.8 + hash(gx, gy) * 0.2 });
  }

  function draw(p){ // p: share of the reveal done, in steps
    ctx.clearRect(0, 0, cv.width, cv.height);
    var edge = 1 / STEPS;
    for (var i = 0; i < cells.length; i++){
      var c = cells[i];
      if (c.at < p) continue;                                            // open
      ctx.fillStyle = c.at < p + edge ? half : c.at < p + 2 * edge ? lit : bg; // next to open: holed, then lit
      ctx.fillRect(Math.round(c.x * dpr), Math.round(c.y * dpr), Math.ceil(CELL * dpr), Math.ceil(CELL * dpr));
    }
  }
  draw(0);
  cv.style.background = 'transparent'; // the canvas now carries the cover itself

  function done(){ root.classList.remove('px-intro'); }
  signal.addEventListener('abort', done);
  // start once the page under the cover has painted (load), but never hold the cover past 1.4s
  var loaded = new Promise(function(r){ document.readyState === 'complete' ? r() : addEventListener('load', r, { once: true }); });
  var go = Promise.race([loaded, new Promise(function(r){ setTimeout(r, 1400); })]);
  go.then(function(){
    // stepped, not smooth; one step per MS/STEPS, and every step gets drawn even if the page
    // is busy loading (a time-based jump would skip steps and look like a cut)
    var step = 0, at = performance.now();
    (function tick(now){
      if (signal.aborted) return;
      if (now - at >= MS / STEPS){ at = now; step++; draw(step / STEPS * (1 + 1 / STEPS)); }
      if (step < STEPS) requestAnimationFrame(tick); else done();
    })(at);
  });
});
