/* What falls across the homepage hero changes with the season, all drawn as
   small pixel art on one 2px grid like the pixel clouds, in day and night colours:
     autumn  leaves come loose from the left edge and tumble (Sep-Nov)
     winter  snow crystals, slowly turning (Dec-Feb)
     spring  petals, lighter than leaves, fluttering more (Mar-May)
     summer  fireflies at night, dandelion seeds rising by day (Jun-Aug)
   The season comes from the date (northern seasons). ?season=winter etc.
   forces one; ?seasons shows a small switch (preview only, not linked).

   Leaves and petals, after kartik.to: each falls slower at each end of its
   swing, sways and drifts with the wind, and tumbles: turning about its length
   squashes it across, pitching squashes it along, its back face swaps the lit
   and shadow halves. New ones come in pixel by pixel through a Bayer matrix.
   Snow crystals follow Libbrecht's common types (stellar dendrite, fernlike
   dendrite, sectored plate, simple star): six identical arms with mirrored
   side branches, worked out per frame onto the grid so they can turn and
   rock while they fall. No single-pixel flakes: those read as stars.
   Nearer pieces are bigger, faster and brighter. Everything thins out behind
   the hero sentence so it stays readable.
   Cost: about 30fps, only while the hero is on screen and the tab visible;
   one still frame for reduced motion; off on narrow screens
   and touch. window.seasons.set({ season: 'winter' }) changes it live. */
(window.onPage || function (f) { f(new AbortController().signal); })(function (signal) {
  var host = document.getElementById('term-screen');
  if (!host || matchMedia('(max-width:1000px), (pointer:coarse)').matches) return;
  var root = document.documentElement;
  var still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function night(){ return root.getAttribute('data-theme') !== 'light'; }

  // per season: kind of piece, how many on a 1440px wide screen, sizes far .. near (css px),
  // css px per second, and colours [night, day]. Night is nearly colourless (rod vision), so
  // greys, except the fireflies' own light and the crystals' faint ice blue.
  var SEASONS = {
    autumn: { kind: 'leaf', count: 11, size: [14, 26], fall: 9, sway: 7, wind: 5, tumble: 0.8,
      // [moonlit rim, body, veins and outline] per leaf: only the lit side's outline catches the moon
      inks: [['#d6d6d6', '#6a6a6a', '#333333'], ['#c2c2c2', '#5c5c5c', '#2c2c2c'], ['#e6e6e6', '#787878', '#3a3a3a']],
      // day [lit half, body, veins and outline]: a dry tan, a sage, a rust
      day: [['#b98b55', '#93693a', '#5f4121'], ['#8c9c7e', '#6b7a5e', '#46523d'], ['#b4704a', '#8d5032', '#5a321e']] },
    spring: { kind: 'petal', count: 18, size: [16, 26], fall: 11, sway: 16, wind: 10, tumble: 0.55,
      inks: [['#e8e8e8', '#9a9a9a', '#5a5a5a'], ['#f2f2f2', '#b0b0b0', '#666666'], ['#ffffff', '#c4c4c4', '#707070']],
      day: [['#ffe4ee', '#f2a7c3', '#b8607f'], ['#fff0f5', '#f6c3d5', '#c47f97'], ['#ffffff', '#f6e9ee', '#b98f9e']] }, // cherry pink, blush, white
    winter: { kind: 'snow', count: 24, size: [10, 22], fall: [10, 24], sway: 5, wind: 3,
      inks: ['#ffffff', '#d4deec', '#8d9bb0'],                        // [arms, branches, far crystals]
      day: ['#ffffff', '#f1f6fd', '#dce7f5'] },                       // white on the blue sky, far ones paler
    summer: { kind: 'firefly', count: 30, fall: [6, 14], sway: 8, wind: 6,
      inks: ['#fbf6b4', '#c9c35a'],                                   // fireflies [core, glow]
      day: ['#ffffff', '#c9bfa4'] }                                   // seeds [tuft, stem]
  };
  var MONTH = ['winter', 'winter', 'spring', 'spring', 'spring', 'summer', 'summer', 'summer', 'autumn', 'autumn', 'autumn', 'winter'];
  var pick = /[?&]season=(autumn|winter|spring|summer)/.exec(location.search);
  var season = pick ? pick[1] : MONTH[new Date().getMonth()];
  var CFG = SEASONS[season], paused = false;
  var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5], CELL = 2;

  var cv = document.createElement('canvas');
  cv.id = 'season-fx'; cv.setAttribute('aria-hidden', 'true');
  host.appendChild(cv);
  var ctx = cv.getContext('2d'), W = 0, H = 0, dpr = 1, words = null, bits = [], EDGE = 260;

  function rnd(a, b){ return a + Math.random() * (b - a); }
  function measure(){
    var r = host.getBoundingClientRect();
    W = r.width; H = r.height; dpr = Math.min(2, devicePixelRatio || 1);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var line = host.querySelector('.hero-line');
    if (line){ var l = line.getBoundingClientRect(), m = 14; words = { x: l.left - r.left - m, y: l.top - r.top - m, w: l.width + 2 * m, h: l.height + 2 * m }; }
    var n = Math.round(CFG.count * Math.min(1, Math.max(0.55, W / 1440)));
    while (bits.length < n) bits.push(spawn(true));
    bits.length = n;
  }
  function behindWords(x, y){ return words && x > words.x && x < words.x + words.w && y > words.y && y < words.y + words.h; }

  // Snow crystal designs, one arm each in units of the crystal's radius: [from, to, angle off
  // the arm] segments; a side branch starts on the arm and leans out 60 degrees, as the real
  // ones do. 'ring' adds a hexagon at that radius (a sectored plate).
  var A = Math.PI / 3;
  function branches(list){ var s = [[0, 1, 0]]; list.forEach(function(b){ s.push([b[0], b[1], A], [b[0], b[1], -A]); }); return s; }
  var CRYSTALS = [
    { arm: branches([[0.38, 0.3], [0.62, 0.24], [0.82, 0.14]]) },                                 // stellar dendrite
    { arm: branches([[0.25, 0.2], [0.38, 0.28], [0.51, 0.26], [0.64, 0.21], [0.77, 0.15], [0.88, 0.09]]) }, // fernlike dendrite
    { arm: branches([[0.8, 0.16]]), ring: 0.5 },                                                  // sectored plate
    { arm: branches([[0.62, 0.32]]) },                                                            // simple star, forked arms
    { arm: [[0, 1, 0]] }                                                                          // plain six arms
  ];

  // first=true scatters the opening set across the hero
  function spawn(first){
    var k = CFG.kind, near = Math.random();
    var b = { near: near, ink: Math.random() < 0.5 ? 0 : Math.random() < 0.5 ? 1 : 2, age: first ? 9 : 0,
      swing: rnd(0, 6.28), swingRate: rnd(0.3, 0.55) * (Math.random() < 0.5 ? -1 : 1) };
    if (k === 'leaf' || k === 'petal'){
      // they let go somewhere along the left edge and the wind carries them right
      b.x = first ? rnd(0, W * 0.7) : rnd(EDGE * 0.15, EDGE * 0.85);
      b.y = first ? rnd(-0.1 * H, H * 0.9) : rnd(H * 0.02, H * 0.7);
      b.yaw = rnd(0, 6.28); b.yawRate = rnd(0.35, 0.8) * (k === 'petal' ? 1.3 : 1);
      b.pitch = rnd(0, 6.28); b.pitchRate = rnd(0.2, 0.45); b.spin = rnd(0, 6.28); b.spinRate = rnd(-0.2, 0.2) * (k === 'petal' ? 3 : 1);
    } else if (k === 'snow'){
      b.x = rnd(-0.05 * W, W); b.y = first ? rnd(0, H) : rnd(-40, -16);
      // finer designs clump into a blob when small: far crystals are plain six arms, middle ones
      // forked stars, only the nearest (biggest) get the branched designs
      b.design = near < 0.4 ? CRYSTALS[4] : near < 0.8 ? CRYSTALS[3] : CRYSTALS[Math.floor(Math.random() * 3)];
      b.spin = rnd(0, A); b.spinRate = rnd(0.08, 0.25) * (Math.random() < 0.5 ? -1 : 1);
      b.rock = rnd(0, 6.28); b.rockRate = rnd(0.4, 0.8);            // a falling plate rocks a little, so it foreshortens
    } else if (night()){
      // summer night: fireflies wander the lower sky
      b.x = rnd(0, W); b.y = rnd(H * 0.15, H);
      b.dx = rnd(-1, 1); b.dy = rnd(-1, 1); b.blink = rnd(0, 6.28); b.blinkRate = rnd(0.6, 1.3);
    } else {
      // summer day: dandelion seeds rise from the bottom left
      b.x = first ? rnd(0, W) : rnd(-20, W * 0.4); b.y = first ? rnd(H * 0.1, H) : H + 10;
    }
    return b;
  }

  function step(dt){
    var k = CFG.kind;
    for (var i = 0; i < bits.length; i++){
      var f = bits[i], e = 0.55 + 0.45 * f.near;
      f.age += dt; f.swing += f.swingRate * dt;
      if (k === 'leaf' || k === 'petal'){
        var slow = 0.55 + 0.7 * Math.abs(Math.cos(f.swing));
        f.x += (CFG.wind * e + CFG.sway * e * Math.cos(f.swing)) * dt;
        f.y += CFG.fall * e * slow * dt;
        f.yaw += f.yawRate * dt; f.pitch += f.pitchRate * dt; f.spin += f.spinRate * dt;
        if (f.y - CFG.size[1] > H || f.x - CFG.size[1] > W) bits[i] = spawn(false);
      } else if (k === 'snow'){
        f.x += (CFG.wind * e + CFG.sway * Math.sin(f.swing)) * dt;
        f.y += (CFG.fall[0] + (CFG.fall[1] - CFG.fall[0]) * f.near) * dt;
        f.spin += f.spinRate * dt; f.rock += f.rockRate * dt;
        if (f.y - CFG.size[1] > H || f.x - CFG.size[1] > W) bits[i] = spawn(false);
      } else if (!night()){
        // seeds: rise on warm air, sway, drift right
        f.x += (CFG.wind * e + CFG.sway * Math.cos(f.swing)) * dt;
        f.y -= (CFG.fall[0] + (CFG.fall[1] - CFG.fall[0]) * f.near) * (0.6 + 0.4 * Math.abs(Math.cos(f.swing))) * dt;
        if (f.y < -20 || f.x > W + 20) bits[i] = spawn(false);
      } else {
        // fireflies: a slow wander that turns gently, and a blink
        f.dx += rnd(-0.6, 0.6) * dt; f.dy += rnd(-0.6, 0.6) * dt;
        var m = Math.hypot(f.dx, f.dy) || 1; f.dx /= m; f.dy /= m;
        f.x += f.dx * CFG.fall[0] * e * dt; f.y += (f.dy * CFG.fall[0] - 2) * e * dt; f.blink += f.blinkRate * dt;
        if (f.x < -20 || f.x > W + 20 || f.y < -20 || f.y > H + 20) bits[i] = spawn(true);
      }
    }
  }

  // what a local point of a leaf or petal is (u along it, -1 base .. 1 tip; v across):
  // 0 off it, 1 the half facing the light, 2 the other half, 3 midrib, veins and stem,
  // 4 the outline on half 1's side, 5 the outline on half 2's side
  function leafShape(u, v){
    var a = Math.abs(v);
    if (u < -1) return u > -1.3 && a < 0.07 ? 3 : 0;            // stem
    if (u > 1) return 0;
    var w = 0.48 * Math.pow(1 - u * u, 0.6) * (1 - 0.25 * u);  // widest a little below the middle, pointed tip
    if (a > w) return 0;
    if (a > w * 0.8) return v < 0 ? 4 : 5;
    if (a < 0.06) return 3;                                     // midrib
    var k = (u + a * 1.4) * 3.2;
    if (k - Math.floor(k) < 0.14 && a < w * 0.7) return 3;      // side veins
    return v < 0 ? 1 : 2;
  }
  // a cherry petal: a rounded oval, narrow at the base, with a notch in its tip
  function petalShape(u, v){
    var a = Math.abs(v);
    if (u < -1 || u > 1) return 0;
    var w = 0.62 * Math.sqrt(1 - u * u) * (0.55 + 0.45 * (u + 1) / 2);
    if (a > w || (u > 0.72 && a < 0.1)) return 0;
    if (a > w * 0.78) return v < 0 ? 4 : 5;
    return v < 0 ? 1 : 2;
  }

  function cell(gx, gy, col){
    var x = gx * CELL, y = gy * CELL;
    ctx.globalAlpha = behindWords(x, y) ? 0.25 : 1; ctx.fillStyle = col; ctx.fillRect(x, y, CELL, CELL);
  }
  function drawTumbler(f, pal, shape, dark){
    var size = CFG.size[0] + (CFG.size[1] - CFG.size[0]) * f.near, R = size / 2, turn = Math.PI / 2 * CFG.tumble;
    var ey = Math.cos(turn * Math.sin(f.yaw)), ep = Math.cos(0.6 * turn * Math.sin(f.pitch));
    var sy = Math.max(0.12, Math.abs(ey)), sp = Math.max(0.35, Math.abs(ep));
    var flip = ey < 0, edgeOn = sy < 0.3;        // back face swaps the lit half; edge-on it is all shadow
    var grow = Math.min(1, f.age / 0.9) * 16;    // arriving: pixels come in through the Bayer matrix
    var co = Math.cos(f.spin), si = Math.sin(f.spin);
    var x0 = Math.floor((f.x - R * 1.4) / CELL), x1 = Math.ceil((f.x + R * 1.4) / CELL);
    var y0 = Math.floor((f.y - R * 1.4) / CELL), y1 = Math.ceil((f.y + R * 1.4) / CELL);
    for (var gy = y0; gy <= y1; gy++) for (var gx = x0; gx <= x1; gx++){
      if (grow < 16 && grow <= BAYER[(gy & 3) * 4 + (gx & 3)]) continue;
      var dx = gx * CELL + 1 - f.x, dy = gy * CELL + 1 - f.y;
      var k = shape((dx * co + dy * si) / (R * sp), (-dx * si + dy * co) / (R * sy));
      if (!k) continue;
      var lit = !edgeOn && k === (flip ? 2 : 1), rim = !edgeOn && k === (flip ? 5 : 4), body = k === 1 || k === 2;
      // shade 0 light, 1 base, 2 dark. Day: lit half light, outlines and veins dark.
      // Night: dark body, outlines and veins darker, only the lit side's outline moonlit
      cell(gx, gy, pal[dark ? (rim ? 0 : body ? 1 : 2) : (lit ? 0 : body ? 1 : 2)]);
    }
  }
  // a crystal: every segment of its six arms walked in half-cell steps onto the grid; each cell
  // drawn once, arms brightest. Far crystals are smaller and all one dimmer tone.
  function drawCrystal(f, pal){
    var R = (CFG.size[0] + (CFG.size[1] - CFG.size[0]) * f.near) / 2, tilt = 0.9 + 0.1 * Math.cos(f.rock);
    var grow = Math.min(1, f.age / 0.9) * 16, done = {}, d = f.design, far = f.near < 0.35;
    function put(x, y, tone){
      var gx = Math.round(x / CELL), gy = Math.round(y / CELL), key = gx + ',' + gy;
      if (done[key] !== undefined && done[key] <= tone) return;
      if (grow < 16 && grow <= BAYER[(gy & 3) * 4 + (gx & 3)]) return;
      done[key] = tone; cell(gx, gy, pal[far ? 2 : tone]);
    }
    function line(ax, ay, bx, by, tone){
      var n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / (CELL / 2)));
      for (var j = 0; j <= n; j++) put(ax + (bx - ax) * j / n, ay + (by - ay) * j / n, tone);
    }
    for (var a = 0; a < 6; a++){
      var th = f.spin + a * A, c0 = Math.cos(th), s0 = Math.sin(th);
      for (var s = 0; s < d.arm.length; s++){
        var g = d.arm[s], c1 = Math.cos(th + g[2]), s1 = Math.sin(th + g[2]);
        var ax = f.x + c0 * g[0] * R, ay = f.y + s0 * g[0] * R * tilt;
        var len = g[2] ? g[1] : g[1] - g[0];
        line(ax, ay, ax + c1 * len * R, ay + s1 * len * R * tilt, g[2] ? 1 : 0);
      }
      if (d.ring){
        var r = d.ring * R, t2 = th + A;
        line(f.x + c0 * r, f.y + s0 * r * tilt, f.x + Math.cos(t2) * r, f.y + Math.sin(t2) * r * tilt, 1);
      }
    }
  }
  function drawFirefly(f, pal){
    // a 2x2 core; while it is bright, a stepped halo two cells out (a pixel-art glow)
    var gx = Math.round(f.x / CELL), gy = Math.round(f.y / CELL), b = Math.max(0, Math.sin(f.blink)), x, y;
    if (b < 0.05) return;
    ctx.fillStyle = pal[1];
    if (b > 0.35) for (y = -2; y <= 3; y++) for (x = -2; x <= 3; x++){
      var d = Math.abs(x - 0.5) + Math.abs(y - 0.5);
      if (d < 1.5 || d > 3.5) continue;
      ctx.globalAlpha = (b - 0.35) * (d < 2.5 ? 0.8 : 0.35); ctx.fillRect((gx + x) * CELL, (gy + y) * CELL, CELL, CELL);
    }
    ctx.globalAlpha = b; ctx.fillStyle = pal[0]; ctx.fillRect(gx * CELL, gy * CELL, CELL * 2, CELL * 2);
  }
  // a dandelion seed: a fan of fine hairs over a short stem
  var TUFT = [[-2, -1], [-1, -2], [0, -2], [1, -2], [2, -1], [-3, 0], [3, 0], [0, -1]];
  function drawSeed(f, pal){
    var gx = Math.round(f.x / CELL), gy = Math.round(f.y / CELL);
    for (var a = 0; a < TUFT.length; a++) if (f.near > 0.5 || a % 2 === 0) cell(gx + TUFT[a][0], gy + TUFT[a][1], pal[0]);
    cell(gx, gy, pal[1]); cell(gx, gy + 1, pal[1]);
  }

  function draw(){
    ctx.clearRect(0, 0, W, H);
    if (paused) return;
    var k = CFG.kind, dark = night(), inks = dark ? CFG.inks : CFG.day;
    for (var i = 0; i < bits.length; i++){
      var f = bits[i];
      if (k === 'leaf') drawTumbler(f, inks[f.ink], leafShape, dark);
      else if (k === 'petal') drawTumbler(f, inks[f.ink], petalShape, dark);
      else if (k === 'snow') drawCrystal(f, inks);
      else if (dark) drawFirefly(f, inks);
      else drawSeed(f, inks);
    }
    ctx.globalAlpha = 1;
  }

  function set(o){
    if (o.season && SEASONS[o.season]){ season = o.season; CFG = SEASONS[season]; bits = []; document.dispatchEvent(new Event('season:change')); }
    if ('paused' in o) paused = o.paused;
    measure(); draw(); run();
  }
  window.seasons = { set: set, get season(){ return season; }, SEASONS: SEASONS };

  var raf = 0, last = 0, seen = true;
  function frame(now){
    raf = 0;
    if (signal.aborted || document.hidden || !seen || paused) return;
    raf = requestAnimationFrame(frame);
    if (now - last < 1000 / 30 - 2) return; // about 30fps
    var dt = last ? Math.min(0.1, (now - last) / 1000) : 0; last = now;
    step(dt); draw();
  }
  function run(){ if (!raf && !still && !paused){ last = 0; raf = requestAnimationFrame(frame); } }

  // preview switch (?seasons): pick a season, pause. Not linked anywhere yet.
  function switcher(){
    var bar = document.createElement('div'); bar.id = 'season-switch';
    var s = bar.style; s.position = 'fixed'; s.left = '16px'; s.bottom = '16px'; s.zIndex = '9999'; s.display = 'flex'; s.gap = '4px';
    s.padding = '6px'; s.borderRadius = '10px'; s.background = 'rgba(15,17,24,.82)'; s.font = '500 12px Inter Tight, system-ui, sans-serif';
    ['spring', 'summer', 'autumn', 'winter', 'pause', 'rays'].forEach(function(name){
      var b = document.createElement('button'); b.type = 'button'; b.textContent = name[0].toUpperCase() + name.slice(1);
      var t = b.style; t.border = '0'; t.borderRadius = '6px'; t.padding = '6px 10px'; t.cursor = 'pointer'; t.font = 'inherit';
      b.addEventListener('click', function(){
        if (name === 'pause'){ set({ paused: !paused }); b.textContent = paused ? 'Play' : 'Pause'; }
        else if (name === 'rays'){ var r = window.lightRays; if (r){ r.set({ on: !r.on }); b.textContent = r.on ? 'Rays' : 'No rays'; } }
        else set({ season: name });
        paint();
      });
      bar.appendChild(b);
    });
    function paint(){ [].forEach.call(bar.children, function(b){ var on = b.textContent.toLowerCase() === season;
      b.style.background = on ? '#e9ecf7' : 'transparent'; b.style.color = on ? '#141722' : '#e9ecf7'; }); }
    paint(); document.body.appendChild(bar);
    document.addEventListener('season:change', paint, { signal: signal });
    signal.addEventListener('abort', function(){ bar.remove(); });
  }

  // after an arriving page transition (Motion.astro)
  Promise.resolve(window.afterPageChange).then(function(){
    if (signal.aborted) return;
    measure(); draw();
    if (/[?&]seasons\b/.test(location.search)) switcher();
    var io = new IntersectionObserver(function(es){ seen = es[0].isIntersecting; if (seen) run(); });
    io.observe(cv);
    var rt = 0;
    addEventListener('resize', function(){ clearTimeout(rt); rt = setTimeout(function(){ measure(); draw(); }, 150); }, { signal: signal });
    document.addEventListener('visibilitychange', run, { signal: signal });
    // summer swaps fireflies for seeds: they live in different places, so start that set over
    document.addEventListener('theme:change', function(){ if (CFG.kind === 'firefly'){ bits = []; measure(); } draw(); run(); }, { signal: signal });
    signal.addEventListener('abort', function(){ io.disconnect(); if (raf) cancelAnimationFrame(raf); cv.remove(); });
    run();
  });
});
