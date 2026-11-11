/* Light rays over the sky (SiteSky.astro): warm sunbeams by day, cool
   moonbeams by night. Crepuscular rays fan out from a light just off the top right of the screen
   (where the nav's sun/moon switch sits).

   Smooth: the screen is split into 10px cells, each cell gets the rays'
   strength there, and the small canvas is stretched to the screen with
   smoothing, so beams are soft at any pixel density (the earlier pixel
   dither looked coarse on phones). With nothing to occlude, each beam is a
   soft wedge of angle from the light, fading with distance.

   Motion: each beam shimmers (brightens and dims) on its own 11-22s clock;
   the whole canvas sways around the light with CSS (#light-rays in SiteSky.astro).

   Cost: each cell's angle and distance from the light are worked out once per
   resize; a frame sums the beams (6) into a table by angle, then looks each
   cell up into an ImageData, at about 12fps while the tab is visible. Reduced motion: one still frame.
   window.lightRays.set({ on: false }) turns it off (the ?seasons preview switch). */
(function(){
  if (document.getElementById('light-rays')) return;   // kept across ClientRouter page changes
  var root = document.documentElement;
  var still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var CELL = 10;
  // [r, g, b, alpha at a beam's brightest]: warm sunlight, cool moonlight
  var TONE = { day: [255, 246, 222, 0.39], night: [196, 212, 255, 0.30] };
  var on = true;

  var cv = document.createElement('canvas'); cv.id = 'light-rays'; cv.setAttribute('aria-hidden', 'true');
  var ctx = cv.getContext('2d'), img, gw = 0, gh = 0, BIN, FADE, beams = [], amin = 0, amax = 1, NB = 2048, LUT = new Float32Array(NB);

  function rnd(a, b){ return a + Math.random() * (b - a); }
  function measure(){
    var W = innerWidth, H = innerHeight;
    gw = Math.ceil(W / CELL); gh = Math.ceil(H / CELL);
    cv.width = gw; cv.height = gh; img = ctx.createImageData(gw, gh);
    // the light: off screen, top right
    var sx = W * 0.9, sy = -H * 0.3, near = Math.hypot(W, H);
    // a ray's strength depends only on the angle from the light, so each cell keeps its angle as
    // a bin into a table the frame fills once (NB entries), instead of summing beams per cell
    var ANG = new Float32Array(gw * gh); BIN = new Uint16Array(gw * gh); FADE = new Float32Array(gw * gh);
    amin = Infinity; amax = -Infinity;
    for (var y = 0; y < gh; y++) for (var x = 0; x < gw; x++){
      var px = x * CELL, py = y * CELL, i = y * gw + x, d = Math.hypot(px - sx, py - sy);
      var a = ANG[i] = Math.atan2(py - sy, px - sx);
      if (a < amin) amin = a; if (a > amax) amax = a;
      // strongest near the light, gone by the far side of the screen
      FADE[i] = Math.max(0, 1 - d / (near * 0.95));
    }
    for (i = 0; i < ANG.length; i++) BIN[i] = Math.round((ANG[i] - amin) / (amax - amin) * (NB - 1));
    // beams spread over the angles that cross the screen, from straight down to the bottom left corner
    var a0 = Math.atan2(H - sy, W - sx), a1 = Math.atan2(H - sy, -sx);
    beams = [];
    for (var b = 0; b < 6; b++) beams.push({
      a: a0 + (a1 - a0) * (b + rnd(0.15, 0.85)) / 6, w: rnd(0.025, 0.06), k: rnd(0.6, 1),
      ph: rnd(0, 6.28), rate: rnd(0.35, 0.7), drift: rnd(0, 6.28)
    });
  }
  function draw(t){
    var night = root.getAttribute('data-theme') !== 'light', c = TONE[night ? 'night' : 'day'], d = img.data;
    var hi = c[3] * 255, n = gw * gh;
    // shimmer: each beam brightens and dims on its own clock (11-22s) and drifts a little in angle
    var A = [], Wd = [], K = [];
    for (var b = 0; b < beams.length; b++){
      var q = beams[b];
      A.push(q.a + 0.008 * Math.sin(t * 0.07 + q.drift)); Wd.push(1 / (q.w * q.w));
      K.push(q.k * (0.2 + 0.8 * (0.5 + 0.5 * Math.sin(t * 0.8 * q.rate + q.ph))));
    }
    for (var k = 0; k < NB; k++){
      var a = amin + (amax - amin) * k / (NB - 1), v = 0;
      for (b = 0; b < A.length; b++){ var e = a - A[b]; v += K[b] * Math.exp(-e * e * Wd[b]); }
      LUT[k] = Math.min(1, v);
    }
    for (var i = 0; i < n; i++){
      var o = i * 4;
      d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = FADE[i] > 0 ? LUT[BIN[i]] * FADE[i] * hi : 0;
    }
    ctx.putImageData(img, 0, 0);
  }

  var raf = 0, last = 0, t0 = performance.now();
  function frame(now){
    raf = 0;
    if (document.hidden || !on) return;
    raf = requestAnimationFrame(frame);
    if (now - last < 1000 / 12) return;   // slow light needs few frames
    last = now; draw((now - t0) / 1000);
  }
  function run(){ if (!on){ ctx.clearRect(0, 0, gw, gh); return; } draw((performance.now() - t0) / 1000); if (!raf && !still) raf = requestAnimationFrame(frame); }

  function start(){
    var anchor = document.getElementById('px-clouds') || document.getElementById('sky');
    (anchor && anchor.parentNode ? anchor.parentNode : document.body).insertBefore(cv, anchor ? anchor.nextSibling : null);
    measure(); run();
    var rt = 0;
    addEventListener('resize', function(){ clearTimeout(rt); rt = setTimeout(function(){ measure(); run(); }, 150); });
    document.addEventListener('visibilitychange', run);
    document.addEventListener('theme:change', run);
  }
  window.lightRays = { set: function(o){ if ('on' in o) on = !!o.on; run(); }, get on(){ return on; } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
