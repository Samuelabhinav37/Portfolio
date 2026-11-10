/* Leaves that come loose from the ASCII vine (word-vine.js) and fall across
   the homepage hero. The idea is kartik.to's falling leaves, rebuilt for this
   site in Canvas2D instead of a second WebGL context: each leaf is a shape
   worked out per 2px grid cell and drawn as small pixel art in three shades
   (lit half, shadow half, outline and veins), like the pixel clouds; new
   leaves come in pixel by pixel through a Bayer matrix. ?leaves=ascii draws
   them in the vine's monospace glyphs instead.

   Per leaf, after kartik: it falls slower at each end of its swing, sways and
   drifts with the wind, and tumbles: turning about its length squashes it
   across (cos of the turn), pitching squashes it along, its back face swaps
   the lit and shadow halves. Nearer leaves are bigger, faster and denser. Leaves thin out
   behind the hero sentence so it stays readable.
   Cost: about 30fps, only while the hero is on screen and the tab visible;
   one still frame for reduced motion; off where the vine is off (narrow
   screens, touch). ?leaves=ascii|pixel picks the look, window.vineLeaves.set()
   changes it live. */
(window.onPage || function (f) { f(new AbortController().signal); })(function (signal) {
  var host = document.getElementById('term-screen');
  if (!host || matchMedia('(max-width:1000px), (pointer:coarse)').matches) return;
  var root = document.documentElement;
  var still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var pick = /[?&]leaves=(ascii|pixel)/.exec(location.search);

  var CFG = window.vineLeaves && window.vineLeaves.config || {
    style: pick ? pick[1] : 'digits', // digits = shape-matched digits like the vine, pixel = shaded pixel art, ascii = simple glyphs
    cell: 2,          // pixel: square size, css px
    count: 11,        // leaves on a 1440px wide screen (fewer when narrower)
    size: [14, 26],   // leaf length, far .. near, css px (digits: 1.6x, so a leaf is more than a few digits)
    fall: 9, sway: 7, wind: 5, // css px per second: floating, not falling
    tumble: 0.8,      // 0 flat .. 1 turns fully edge-on
    // three shades per leaf [light, base, dark], like the pixel clouds: a dry tan, a sage, a rust.
    // Night is black and white (rod vision sees almost no colour): three grey leaves, dark
    // bodies, only the lit side's outline catches the moon
    // [moonlit rim, body, line]: lines brighter than the body, like the vine at night
    dark: [['#e2e2e2', '#5a5a5a', '#a8a8a8'], ['#d0d0d0', '#4e4e4e', '#9a9a9a'], ['#ececec', '#666666', '#b4b4b4']],
    // day: the vine's warm near-black ink and greys [lit, body, line]
    light: [['#8a817c', '#6b625d', '#2b211c'], ['#9a918c', '#776e69', '#382a24'], ['#7c736e', '#5d544f', '#1f1714']]
  };
  var RAMP = ' .,:;i1tfLCG08@';
  var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  var MONO = "ui-monospace, 'Cascadia Mono', Consolas, Menlo, monospace";

  var cv = document.createElement('canvas');
  cv.id = 'vine-leaves'; cv.setAttribute('aria-hidden', 'true');
  host.appendChild(cv);
  var ctx = cv.getContext('2d'), W = 0, H = 0, dpr = 1, words = null, leaves = [], vineW = 260, glyphs = null;

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
      near: near, ink: Math.random() < 0.5 ? 0 : Math.random() < 0.5 ? 1 : 2,
      x: first ? rnd(0, W * 0.7) : rnd(vineW * 0.15, vineW * 0.85),
      y: first ? rnd(-0.1 * H, H * 0.9) : rnd(H * 0.02, H * 0.7),
      age: first ? 9 : 0,
      swing: rnd(0, 6.28), swingRate: rnd(0.3, 0.55) * (Math.random() < 0.5 ? -1 : 1),
      yaw: rnd(0, 6.28), yawRate: rnd(0.35, 0.8), pitch: rnd(0, 6.28), pitchRate: rnd(0.2, 0.45),
      spin: rnd(0, 6.28), spinRate: rnd(-0.2, 0.2)
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

  // what a local point of the leaf is (u along it, -1 base .. 1 tip; v across):
  // 0 off the leaf, 1 the half facing the light, 2 the other half, 3 midrib, veins and stem,
  // 4 the outline on half 1's side, 5 the outline on half 2's side
  function shape(u, v){
    var a = Math.abs(v);
    if (u < -1) return u > -1.3 && a < 0.07 ? 3 : 0;            // stem
    if (u > 1) return 0;
    var w = 0.48 * Math.pow(1 - u * u, 0.6) * (1 - 0.25 * u);  // widest a little below the middle, pointed tip
    if (a > w) return 0;
    if (a > w * 0.8) return v < 0 ? 4 : 5;                      // outline, on each side
    if (a < 0.06) return 3;                                     // midrib
    var k = (u + a * 1.4) * 3.2;
    if (k - Math.floor(k) < 0.14 && a < w * 0.7) return 3;      // side veins
    return v < 0 ? 1 : 2;
  }

  function draw(){
    ctx.clearRect(0, 0, W, H);
    var dark = root.getAttribute('data-theme') !== 'light', inks = dark ? CFG.dark : CFG.light;
    var ascii = CFG.style === 'ascii', digits = CFG.style === 'digits' && window.wordVine && window.wordVine.shapes;
    var cw = ascii ? 3.6 : digits ? 4 : CFG.cell, ch = ascii ? 6.6 : digits ? 7 : CFG.cell;
    if (ascii || digits){ ctx.font = (digits ? '600 6px ' : '500 6px ') + MONO; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; }
    if (digits && !glyphs) glyphs = window.wordVine.shapes({ weight: 600, size: 6 }, cw, ch);
    var grow0 = digits ? 1.6 : 1;
    var turn = Math.PI / 2 * CFG.tumble;
    for (var i = 0; i < leaves.length; i++){
      var f = leaves[i], pal = inks[f.ink];
      var size = (CFG.size[0] + (CFG.size[1] - CFG.size[0]) * f.near) * grow0, R = size / 2;
      var ey = Math.cos(turn * Math.sin(f.yaw)), ep = Math.cos(0.6 * turn * Math.sin(f.pitch));
      var sy = Math.max(0.12, Math.abs(ey)), sp = Math.max(0.35, Math.abs(ep));
      var flip = ey < 0, edgeOn = sy < 0.3;        // back face swaps the lit half; edge-on it is all shadow
      var grow = Math.min(1, f.age / 0.9) * 16;    // arriving: pixels come in through the Bayer matrix
      var co = Math.cos(f.spin), si = Math.sin(f.spin);
      var x0 = Math.floor((f.x - R * 1.4) / cw), x1 = Math.ceil((f.x + R * 1.4) / cw);
      var y0 = Math.floor((f.y - R * 1.4) / ch), y1 = Math.ceil((f.y + R * 1.4) / ch);
      // cells on one fixed grid, so leaves snap to pixels like the vine and the clouds do
      for (var gy = y0; gy <= y1; gy++) for (var gx = x0; gx <= x1; gx++){
        if (grow < 16 && grow <= BAYER[(gy & 3) * 4 + (gx & 3)]) continue;
        var px = gx * cw + cw / 2, py = gy * ch + ch / 2, dx = px - f.x, dy = py - f.y;
        var k = shape((dx * co + dy * si) / (R * sp), (-dx * si + dy * co) / (R * sy));
        var dg = null;
        if (digits){
          // the vine's method: measure the leaf in the cell's 6 zones (2 across, 3 down, 2x2 samples
          // each; a line counts 1, the blade 0.6) and take the digit with the nearest shape
          var zv = [];
          for (var zy = 0; zy < 3; zy++) for (var zx = 0; zx < 2; zx++){
            var sum = 0;
            for (var sy2 = 0; sy2 < 2; sy2++) for (var sx2 = 0; sx2 < 2; sx2++){
              var qx = gx * cw + (zx + (sx2 + 0.5) / 2) * cw / 2 - f.x, qy = gy * ch + (zy + (sy2 + 0.5) / 2) * ch / 3 - f.y;
              var kk = shape((qx * co + qy * si) / (R * sp), (-qx * si + qy * co) / (R * sy));
              sum += kk === 1 || kk === 2 ? 0.6 : kk ? 1 : 0;
            }
            zv.push(sum / 4);
          }
          dg = window.wordVine.SHAPE_SET[window.wordVine.nearest(zv, glyphs)];
          if (dg === ' ') continue;
          if (!k) k = 3;
        } else if (!k) continue;
        // the back face (flip) swaps which half faces the light; edge-on nothing does
        var lit = !edgeOn && k === (flip ? 2 : 1), rim = !edgeOn && k === (flip ? 5 : 4), body = k === 1 || k === 2;
        // shade 0 light, 1 base, 2 dark. Day: lit half light, outlines and veins dark.
        // Night: dark body, outlines and veins darker, only the lit side's outline moonlit
        var shade = dark ? (rim ? 0 : body ? 1 : 2) : (lit ? 0 : body ? 1 : 2);
        ctx.globalAlpha = words && px > words.x && px < words.x + words.w && py > words.y && py < words.y + words.h ? 0.25 : 1;
        if (digits){
          ctx.fillStyle = pal[shade];
          ctx.fillText(dg, gx * cw + cw / 2, gy * ch + ch / 2);
        } else if (ascii){
          ctx.fillStyle = pal[1];
          ctx.fillText(shade === 2 ? '#' : shade === 0 ? '*' : '+', px, py);
        } else {
          ctx.fillStyle = pal[shade];
          ctx.fillRect(gx * cw, gy * ch, cw, ch);
        }
      }
    }
    ctx.globalAlpha = 1;
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
