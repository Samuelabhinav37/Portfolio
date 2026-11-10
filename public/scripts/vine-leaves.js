/* Leaves that come loose from the ASCII vine (word-vine.js) and fall across
   the homepage hero. The idea is kartik.to's falling leaves, rebuilt for this
   site in Canvas2D instead of a second WebGL context: each leaf is a shape
   worked out per grid cell and drawn as 1-bit Bayer-dithered squares (bits)
   or as the vine's own glyph ramp (ascii), so they read as bits of the vine.

   Per leaf, after kartik: it falls slower at each end of its swing, sways and
   drifts with the wind, and tumbles: turning about its length squashes it
   across (cos of the turn), pitching squashes it along, its back face is
   fainter. Nearer leaves are bigger, faster and denser. Leaves thin out
   behind the hero sentence so it stays readable.
   Cost: about 30fps, only while the hero is on screen and the tab visible;
   one still frame for reduced motion; off where the vine is off (narrow
   screens, touch). ?leaves=ascii|bits picks the look, window.vineLeaves.set()
   changes it live. */
(window.onPage || function (f) { f(new AbortController().signal); })(function (signal) {
  var host = document.getElementById('term-screen');
  if (!host || matchMedia('(max-width:1000px), (pointer:coarse)').matches) return;
  var root = document.documentElement;
  var still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var pick = /[?&]leaves=(ascii|bits)/.exec(location.search);

  var CFG = window.vineLeaves && window.vineLeaves.config || {
    style: pick ? pick[1] : 'bits', // bits = dithered squares, ascii = the vine's glyphs
    cell: 4,          // bits: square size, css px
    count: 9,         // leaves on a 1440px wide screen (fewer when narrower)
    size: [30, 64],   // leaf length, far .. near, css px
    fall: 34, sway: 26, wind: 20, // css px per second
    tumble: 0.85,     // 0 flat .. 1 turns fully edge-on
    dark: ['#9d9fa1', '#c4a77d'],  // inks on the night sky (the vine's grey, a dry-leaf tan)
    light: ['#382a24', '#8a5a32']  // inks on the day sky
  };
  var RAMP = ' .,:;i1tfLCG08@';
  var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  var MONO = "ui-monospace, 'Cascadia Mono', Consolas, Menlo, monospace";

  var cv = document.createElement('canvas');
  cv.id = 'vine-leaves'; cv.setAttribute('aria-hidden', 'true');
  host.appendChild(cv);
  var ctx = cv.getContext('2d'), W = 0, H = 0, dpr = 1, words = null, leaves = [], vineW = 260;

  function rnd(a, b){ return a + Math.random() * (b - a); }
  function measure(){
    var r = host.getBoundingClientRect();
    W = r.width; H = r.height; dpr = Math.min(2, devicePixelRatio || 1);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var line = host.querySelector('.hero-line'), vine = document.getElementById('word-vine');
    if (line){ var l = line.getBoundingClientRect(), m = 14; words = { x: l.left - r.left - m, y: l.top - r.top - m, w: l.width + 2 * m, h: l.height + 2 * m }; }
    if (vine && vine.offsetWidth) vineW = vine.offsetWidth;
    var n = Math.round(CFG.count * Math.min(1, Math.max(0.55, W / 1440)));
    while (leaves.length < n) leaves.push(spawn(true));
    leaves.length = n;
  }
  // a leaf lets go somewhere on the vine (the left strip); first=true scatters the opening set across the hero
  function spawn(first){
    var near = Math.random();
    return {
      near: near, ink: Math.random() < 0.3 ? 1 : 0,
      x: first ? rnd(0, W * 0.7) : rnd(vineW * 0.15, vineW * 0.85),
      y: first ? rnd(-0.1 * H, H * 0.9) : rnd(H * 0.02, H * 0.7),
      age: first ? 9 : 0,
      swing: rnd(0, 6.28), swingRate: rnd(0.8, 1.5) * (Math.random() < 0.5 ? -1 : 1),
      yaw: rnd(0, 6.28), yawRate: rnd(1.1, 2.3), pitch: rnd(0, 6.28), pitchRate: rnd(0.5, 1.1),
      spin: rnd(0, 6.28), spinRate: rnd(-0.6, 0.6)
    };
  }
  function step(dt){
    for (var i = 0; i < leaves.length; i++){
      var f = leaves[i], e = 0.55 + 0.45 * f.near;
      f.age += dt; f.swing += f.swingRate * dt;
      var slow = 0.55 + 0.7 * Math.abs(Math.cos(f.swing));
      f.x += (CFG.wind * e + CFG.sway * e * Math.cos(f.swing)) * dt;
      f.y += CFG.fall * e * slow * dt;
      f.yaw += f.yawRate * dt; f.pitch += f.pitchRate * dt; f.spin += f.spinRate * dt;
      var s = CFG.size[1];
      if (f.y - s > H || f.x - s > W) leaves[i] = spawn(false);
    }
  }

  // the leaf's tone at local point (u along it, -1 base .. 1 tip; v across), 0 = not on the leaf
  function shape(u, v){
    var a = Math.abs(v);
    if (u < -1) return u > -1.28 && a < 0.05 ? 0.9 : 0;         // stem
    if (u > 1) return 0;
    var w = 0.46 * Math.pow(1 - u * u, 0.65) * (1 - 0.2 * u);  // widest a little below the middle
    if (a > w) return 0;
    if (a < 0.05) return 1;                                     // midrib
    var k = (u + a * 1.3) * 4.2;
    if (k - Math.floor(k) < 0.16 && a < w * 0.86) return 0.85;  // side veins
    return a > w * 0.8 ? 0.85 : 0.7;                            // rim, then blade
  }

  function draw(){
    ctx.clearRect(0, 0, W, H);
    var dark = root.getAttribute('data-theme') !== 'light', inks = dark ? CFG.dark : CFG.light;
    var ascii = CFG.style === 'ascii';
    var cw = ascii ? 3.6 : CFG.cell, ch = ascii ? 6.6 : CFG.cell;
    if (ascii){ ctx.font = '500 6px ' + MONO; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; }
    var turn = Math.PI / 2 * CFG.tumble;
    for (var i = 0; i < leaves.length; i++){
      var f = leaves[i];
      var size = CFG.size[0] + (CFG.size[1] - CFG.size[0]) * f.near, R = size / 2;
      var ey = Math.cos(turn * Math.sin(f.yaw)), ep = Math.cos(0.6 * turn * Math.sin(f.pitch));
      var sy = Math.max(0.1, Math.abs(ey)), sp = Math.max(0.3, Math.abs(ep));
      var dens = (0.75 + 0.25 * f.near) * (0.7 + 0.3 * sy * sp) * (ey < 0 ? 0.8 : 1) * Math.min(1, f.age / 0.9);
      var co = Math.cos(f.spin), si = Math.sin(f.spin);
      ctx.fillStyle = inks[f.ink];
      // cells on one fixed grid, so leaves snap to pixels like the vine does
      var x0 = Math.floor((f.x - R * 1.35) / cw), x1 = Math.ceil((f.x + R * 1.35) / cw);
      var y0 = Math.floor((f.y - R * 1.35) / ch), y1 = Math.ceil((f.y + R * 1.35) / ch);
      for (var gy = y0; gy <= y1; gy++) for (var gx = x0; gx <= x1; gx++){
        var px = gx * cw + cw / 2, py = gy * ch + ch / 2, dx = px - f.x, dy = py - f.y;
        var t = shape((dx * co + dy * si) / (R * sp), (-dx * si + dy * co) / (R * sy));
        if (!t) continue;
        t *= dens;
        if (words && px > words.x && px < words.x + words.w && py > words.y && py < words.y + words.h) t *= 0.3;
        if (ascii){
          var k = RAMP[Math.round(t * (RAMP.length - 1))];
          if (k !== ' ') ctx.fillText(k, px, py);
        } else if (t * 16 > BAYER[(gy & 3) * 4 + (gx & 3)] + 0.5){
          ctx.fillRect(gx * cw, gy * ch, cw - 1 / dpr, ch - 1 / dpr);
        }
      }
    }
  }

  window.vineLeaves = { config: CFG, set: function(o){ for (var k in o) CFG[k] = o[k]; measure(); draw(); } };

  var raf = 0, last = 0, seen = true;
  function frame(now){
    raf = 0;
    if (signal.aborted || document.hidden || !seen) return;
    raf = requestAnimationFrame(frame);
    if (now - last < 1000 / 30 - 2) return; // about 30fps
    var dt = last ? Math.min(0.1, (now - last) / 1000) : 0; last = now;
    step(dt); draw();
  }
  function run(){ if (!raf && !still){ last = 0; raf = requestAnimationFrame(frame); } }

  // after an arriving page transition, like the vine (Motion.astro)
  Promise.resolve(window.afterPageChange).then(function(){
    if (signal.aborted) return;
    measure(); draw();
    var io = new IntersectionObserver(function(es){ seen = es[0].isIntersecting; if (seen) run(); });
    io.observe(cv);
    var rt = 0;
    addEventListener('resize', function(){ clearTimeout(rt); rt = setTimeout(function(){ measure(); draw(); }, 150); }, { signal: signal });
    document.addEventListener('visibilitychange', run, { signal: signal });
    document.addEventListener('theme:change', draw, { signal: signal });
    signal.addEventListener('abort', function(){ io.disconnect(); if (raf) cancelAnimationFrame(raf); cv.remove(); });
    run();
  });
});
