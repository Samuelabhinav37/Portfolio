/* Light rays over the sky (SiteSky.astro): sunbeams by day, fainter cool
   moonbeams by night. Crepuscular rays fan out from a light just off the top
   right of the screen (where the nav's sun/moon switch sits). Small motion:
   - each beam slowly breathes (strength) and sways (angle)
   - now and then a passing cloud's shadow sweeps across the beams, dimming
     them one after another, as real rays come and go with the clouds
   - dust motes (glints at night) drift through the sky and only show while
     they are inside a beam (the Tyndall effect: the beam lights the dust)

   Drawn the pixel-art way, to sit with the pixel clouds: the screen is split
   into 3px cells and each cell is lit or not by a 4x4 Bayer matrix against the
   rays' strength there (ordered dithering), in two tones, so beams have hard
   pixel edges that fade out through the dither pattern instead of a smooth
   blur. GPU god-ray shaders blur an occlusion mask along lines from the
   light; with nothing to occlude here, each beam is a soft wedge of angle
   from the light, fading with distance.

   Cost: each cell's angle and distance from the light are worked out once per
   resize; a frame sums the beams (6) into a table by angle, then looks each
   cell up into an ImageData, at about 12fps while the tab is visible; motes
   look the same table up. Reduced motion: one still frame.
   window.lightRays.set({ on: false }) turns it off (the ?seasons preview switch). */
(function(){
  if (document.getElementById('light-rays')) return;   // kept across ClientRouter page changes
  var root = document.documentElement;
  var still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var CELL = matchMedia('(max-width:900px)').matches ? 4 : 3;
  var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  // [r, g, b, alpha of the faint tone, alpha of the bright core]: warm sunlight, cool moonlight
  var TONE = { day: [255, 246, 222, 0.16, 0.28], night: [196, 212, 255, 0.09, 0.16] };
  var MOTES = { day: [255, 250, 236], night: [226, 234, 255] };
  var on = true;

  var cv = document.createElement('canvas'); cv.id = 'light-rays'; cv.setAttribute('aria-hidden', 'true');
  var s = cv.style; s.position = 'fixed'; s.inset = '0'; s.width = '100%'; s.height = '100%';
  s.zIndex = '1'; s.pointerEvents = 'none'; s.imageRendering = 'pixelated';
  var ctx = cv.getContext('2d'), img, gw = 0, gh = 0, BIN, FADE, beams = [], amin = 0, amax = 1, NB = 2048, LUT = new Float32Array(NB);
  var motes = [], W = 0, H = 0, lastT = 0;

  function rnd(a, b){ return a + Math.random() * (b - a); }
  function measure(){
    W = innerWidth; H = innerHeight;
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
    // dust: sinks slowly and sways; a few per beam's worth of screen
    motes = [];
    for (var m = 0; m < Math.round(56 * Math.min(1, W / 1440)); m++)
      motes.push({ x: rnd(0, W), y: rnd(0, H), vy: rnd(2, 6), sway: rnd(0, 6.28), sr: rnd(0.2, 0.5), tw: rnd(0, 6.28), tr: rnd(0.8, 2) });
  }
  function draw(t){
    var night = root.getAttribute('data-theme') !== 'light', c = TONE[night ? 'night' : 'day'], d = img.data;
    var lo = Math.round(c[3] * 255), hi = Math.round(c[4] * 255), n = gw * gh;
    // each beam breathes (strength) and sways (angle) on its own slow clock
    var A = [], Wd = [], K = [];
    for (var b = 0; b < beams.length; b++){
      var q = beams[b];
      A.push(q.a + 0.008 * Math.sin(t * 0.07 + q.drift)); Wd.push(1 / (q.w * q.w));
      K.push(q.k * (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 0.1 * q.rate + q.ph))));
    }
    // a passing cloud: every 45s a soft shadow crosses the beams in 30s, from the left edge's beams to the right's
    var cp = (t % 45) / 30, oa = amax + (amin - amax) * cp, shade = cp < 1 ? 0.6 * Math.sin(Math.PI * cp) : 0;
    for (var k = 0; k < NB; k++){
      var a = amin + (amax - amin) * k / (NB - 1), v = 0;
      for (b = 0; b < A.length; b++){ var e = a - A[b]; v += K[b] * Math.exp(-e * e * Wd[b]); }
      if (shade){ var u = (a - oa) / 0.09; v *= 1 - shade * Math.exp(-u * u); }
      LUT[k] = Math.min(1, v);
    }
    for (var i = 0; i < n; i++){
      var f = FADE[i], o = i * 4;
      if (f <= 0){ d[o + 3] = 0; continue; }
      v = LUT[BIN[i]] * f;
      var x = i % gw, y = (i / gw) | 0, th = (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
      // ordered dither: the faint tone where the beam beats the matrix, the bright tone where it beats it twice over
      var al = v > th ? (v * 0.55 > th ? hi : lo) : 0;
      d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = al;
    }
    // motes, drawn into the same cells: lit only as much as the beam they are in
    var mc = MOTES[night ? 'night' : 'day'], dt = Math.min(0.2, Math.max(0, t - lastT)); lastT = t;
    for (var j = 0; j < motes.length; j++){
      var m = motes[j];
      m.y += m.vy * dt; m.x += Math.sin(t * m.sr + m.sway) * 4 * dt;
      if (m.y > H) { m.y = -2; m.x = rnd(0, W); } if (m.x < 0) m.x += W; if (m.x >= W) m.x -= W;
      var gx = (m.x / CELL) | 0, gy = (m.y / CELL) | 0;
      if (gy < 0 || gy >= gh || gx >= gw) continue;
      var ci = gy * gw + gx, lit = LUT[BIN[ci]] * FADE[ci] * (0.55 + 0.45 * Math.sin(t * m.tr + m.tw));
      if (lit < 0.08) continue;
      // a lit speck stands out from the dithered beam around it, brighter the stronger the beam
      o = ci * 4; d[o] = mc[0]; d[o + 1] = mc[1]; d[o + 2] = mc[2];
      d[o + 3] = Math.round((night ? 110 : 150) + Math.min(1, lit * 2) * (night ? 110 : 105));
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
