/* Kai's runner, for the 404 page: a little pixel-art game on a 360x110 screen,
   scaled up with crisp pixels. Kai (the site's robot) runs along a night
   horizon under drifting clouds, a moon and twinkling stars. Server towers
   stand in the way (jump them); from 300 points glitch packets fly at three
   heights: low (jump), head height (duck), high (run under, don't jump).

   Feel, from the Chromium dino source and platformer practice: fixed 120Hz
   physics, variable jump (let go early for a hop), a 130ms jump buffer, 3x
   fast drop when ducking in the air, a quiet 1.5s start, a 700ms restart lock,
   gaps that always fit a full jump, squash and stretch, landing dust, a score
   blink every 100, a shake on a crash.
   Space / up / W / tap jumps, down / S / swipe down ducks, P / Esc pauses.
   The best score stays in localStorage when the browser allows it. */
(function () {
  var cv = document.getElementById('runner');
  if (!cv || !cv.getContext) return;
  var x = cv.getContext('2d');
  var W = 360, H = 110, GROUND = 92;
  x.imageSmoothingEnabled = false;

  // palette: pale phosphor on night blue, one warm accent shared with the bulb sign
  var BG = '#070910', INK = '#dfe6f3', MID = '#8e9ab2', DIM = '#3c4457', FAINT = '#1c2130', WARM = '#ffb347';
  var FONT = '8px "Press Start 2P", monospace';

  var STEP = 1000 / 120;
  var G = 0.0013, JUMP_V = -0.37, CUT = 0.45, DROP = 3, BUFFER = 130;
  var KX = 26;

  var best = 0;
  try { best = +localStorage.getItem('kai-runner-best') || 0; } catch (e) {}

  var state = 'idle', kai, obs, dust, speed, score, gapLeft, clearLeft, lockUntil = 0;
  var acc = 0, last = 0, shake = 0, blink = 0, nextMilestone = 100, paused = false, t0 = 0;
  var held = false, duckKey = false, bufferedAt = -1e9, groundX = 0, cloudX = 0;

  function R(n) { return Math.random() * n | 0; }
  function px(c, X, Y, w, h) { x.fillStyle = c; x.fillRect(X | 0, Y | 0, w, h); }

  // ── scenery, built once ──
  // ground: a line with small bumps, and pebbles below it, tiled every 720px
  var ground = [];
  for (var gx = 0; gx < 720; gx += 2 + R(14)) {
    var r = Math.random();
    if (r < .12) ground.push({ x: gx, y: -1, w: 2 + R(4), h: 1, c: INK });      // a bump on the line
    else if (r < .2) ground.push({ x: gx, y: 1, w: 2 + R(3), h: 1, c: BG });    // a dip in the line
    ground.push({ x: gx + R(6), y: 3 + R(9), w: 1 + R(3), h: 1, c: Math.random() < .5 ? DIM : MID });
  }
  // clouds: blocky shapes, row spans of [x, width], drawn at three heights
  var CLOUDS = [
    [[4, 6], [2, 11], [0, 16], [1, 14]],
    [[3, 4], [9, 5], [1, 15], [0, 19], [2, 15]],
    [[2, 7], [0, 12], [3, 9]],
  ];
  var clouds = [{ s: 0, x: 40, y: 18 }, { s: 1, x: 170, y: 30 }, { s: 2, x: 290, y: 12 }, { s: 1, x: 420, y: 24 }];
  var stars = [];
  for (var i = 0; i < 26; i++) stars.push({ x: R(W), y: 4 + R(54), p: Math.random() * 6 });

  function reset() {
    kai = { y: 0, vy: 0, air: false, sq: 0 };
    obs = []; dust = []; speed = 0.18; score = 0; gapLeft = 0; clearLeft = 1500;
    nextMilestone = 100; blink = 0; acc = 0; last = 0;
  }
  function airtime() { return 2 * -JUMP_V / G; }

  // ── obstacles ──
  // a server tower: w 7 or 11, h 14-22, rack lines, one LED that blinks
  // a glitch packet: a 9x5 block with a flapping tail of loose pixels
  function spawn() {
    var o;
    if (score > 300 && Math.random() < .32) {
      var lvl = R(3);
      o = { kind: 'packet', w: 9, h: 5, y: [GROUND - 9, GROUND - 14, GROUND - 27][lvl] };
    } else {
      var n = score > 150 && Math.random() < .3 ? 2 : 1, wide = Math.random() < .4;
      var w = wide ? 11 : 7, h = 14 + R(score > 200 ? 9 : 6);
      o = { kind: 'tower', w: n * w + (n - 1) * 2, h: h, n: n, tw: w, y: GROUND - h, led: R(4) };
    }
    o.x = W + 4; obs.push(o);
    var minGap = speed * airtime() * 1.05 + o.w + 10;
    gapLeft = minGap * (1 + Math.random() * 0.9);
  }

  function press() {
    if (paused) { paused = false; return; }
    if (state !== 'run') { if (performance.now() > lockUntil) start(); return; }
    held = true; bufferedAt = performance.now();
  }
  function release() {
    held = false;
    if (state === 'run' && kai.air && kai.vy < JUMP_V * CUT) kai.vy = JUMP_V * CUT;
  }
  function start() { reset(); state = 'run'; held = true; bufferedAt = performance.now(); }

  function box() {
    var low = duckKey && !kai.air;
    return low ? { x: KX, y: GROUND - 8 + kai.y, w: 16, h: 8 } : { x: KX + 1, y: GROUND - 13 + kai.y, w: 13, h: 13 };
  }
  function hit(a, o) { return a.x + 2 < o.x + o.w - 1 && a.x + a.w - 2 > o.x + 1 && a.y + 2 < o.y + o.h && a.y + a.h - 1 > o.y + 1; }

  function tick(dt) {
    var now = performance.now();
    score += dt * speed * 0.11;
    speed = Math.min(0.41, speed + dt * 0.0000052);
    if (score >= nextMilestone) { blink = 900; nextMilestone += 100; }
    if (blink > 0) blink -= dt;

    if (!kai.air && now - bufferedAt < BUFFER) { kai.vy = held ? JUMP_V : JUMP_V * .8; kai.air = true; kai.sq = -1; bufferedAt = -1e9; }
    kai.vy += G * (duckKey && kai.air ? DROP : 1) * dt;
    kai.y += kai.vy * dt;
    if (kai.y >= 0) {
      if (kai.air) { kai.sq = 1; for (var p = 0; p < 5; p++) dust.push({ x: KX + 6 + R(6), y: GROUND - 1, vx: -(Math.random() * .03 + speed * .4), vy: -Math.random() * .03, life: 240 }); }
      kai.y = 0; kai.vy = 0; kai.air = false;
    }
    kai.sq *= Math.pow(0.98, dt);

    if (clearLeft > 0) clearLeft -= dt; else { gapLeft -= speed * dt; if (gapLeft <= 0) spawn(); }
    var k = box();
    for (var i = obs.length - 1; i >= 0; i--) {
      var o = obs[i]; o.x -= speed * dt * (o.kind === 'packet' ? 1.12 : 1);
      if (o.x + o.w < -6) { obs.splice(i, 1); continue; }
      if (hit(k, o)) { over(); return; }
    }
    groundX = (groundX + speed * dt) % 720;
    cloudX += speed * dt * .12;
    for (var j = dust.length - 1; j >= 0; j--) { var d = dust[j]; d.x += d.vx * dt; d.y += d.vy * dt; d.life -= dt; if (d.life <= 0) dust.splice(j, 1); }
  }
  function over() {
    state = 'over'; shake = 180; lockUntil = performance.now() + 700; held = false;
    var s = score | 0;
    if (s > best) { best = s; try { localStorage.setItem('kai-runner-best', String(best)); } catch (e) {} }
  }

  // ── drawing ──
  function drawSky(t) {
    px(BG, 0, 0, W, H);
    stars.forEach(function (s) { var on = Math.sin(t / 500 + s.p) > -.2; if (on) px(Math.sin(t / 300 + s.p) > .8 ? MID : DIM, s.x, s.y, 1, 1); });
    // a pixel moon, crescent cut by the background colour, with two craters
    var mx = 150, my = 8;
    for (var yy = 0; yy < 12; yy++) for (var xx = 0; xx < 12; xx++) {
      var dx = xx - 5.5, dy = yy - 5.5;
      if (dx * dx + dy * dy <= 30 && (dx + 3) * (dx + 3) + (dy - 1) * (dy - 1) > 22) px(dx * dx + dy * dy > 22 ? MID : INK, mx + xx, my + yy, 1, 1);
    }
    px(MID, mx + 8, my + 4, 1, 1); px(MID, mx + 7, my + 8, 2, 1);
    clouds.forEach(function (c) {
      var shape = CLOUDS[c.s];
      var cx = ((c.x - cloudX) % (W + 60) + W + 60) % (W + 60) - 30;
      shape.forEach(function (row, ri) {
        px('#232a3b', cx + row[0], c.y + ri * 2, row[1], 2);
        if (ri === 0 || shape[ri - 1][0] > row[0]) px('#5d6982', cx + row[0], c.y + ri * 2, ri === 0 ? row[1] : Math.min(row[1], 3), 1); // moonlit top edge
      });
    });
  }
  function drawGround() {
    px(INK, 0, GROUND, W, 1);
    ground.forEach(function (g) {
      var gx = ((g.x - groundX) % 720 + 720) % 720;
      if (gx < W) px(g.c, gx, GROUND + g.y, g.w, g.h);
      if (gx - 720 + W > 0 && gx > 720 - W) px(g.c, gx - 720, GROUND + g.y, g.w, g.h);
    });
  }
  function drawTower(o, t) {
    for (var n = 0; n < o.n; n++) {
      var X = Math.round(o.x) + n * (o.tw + 2), Y = o.y;
      px(INK, X, Y, o.tw, o.h);
      px(BG, X + 1, Y + 1, o.tw - 2, o.h - 2);
      for (var u = Y + 3; u < Y + o.h - 2; u += 3) px(DIM, X + 2, u, o.tw - 4, 1);       // rack units
      px(MID, X + 2, Y + 2, 1, 1);
      var ledOn = Math.floor(t / (180 + o.led * 60)) % 3 !== 0;
      px(ledOn ? WARM : DIM, X + o.tw - 3, Y + 2, 1, 1);                                   // status LED
      px(INK, X - 1, GROUND - 1, o.tw + 2, 1);                                             // feet
    }
  }
  function drawPacket(o, t) {
    var X = Math.round(o.x), Y = Math.round(o.y), f = Math.floor(t / 120) % 2;
    px(INK, X, Y, o.w, o.h);
    px(BG, X + 1, Y + 1, o.w - 2, o.h - 2);
    px(INK, X + 2, Y + 2, 1, 1); px(INK, X + 4, Y + 2, 1, 1); px(WARM, X + 6, Y + 2, 1, 1);   // a few bits
    // tail of loose pixels that flaps
    px(MID, X + o.w + 1, Y + (f ? 1 : 3), 2, 1); px(DIM, X + o.w + 4, Y + (f ? 3 : 1), 2, 1); px(FAINT, X + o.w + 7, Y + 2, 2, 1);
  }
  function drawKai(t) {
    var low = duckKey && !kai.air && state === 'run';
    var y = GROUND + Math.round(kai.y);
    var run = state === 'run' && !kai.air, frame = run ? Math.floor(t / 90) % 2 : 0;
    var st = Math.round(kai.sq);                       // -1 stretched, 1 squashed
    if (low) {
      // ducked: a wide low screen, antenna laid back
      px(INK, KX, y - 8, 16, 6); px(BG, KX + 1, y - 7, 14, 4);
      px(INK, KX + 4, y - 6, 2, 2); px(INK, KX + 9, y - 6, 2, 2);
      px(INK, KX - 3, y - 9, 4, 1);
      px(INK, KX + 2 + frame * 2, y - 2, 2, 2); px(INK, KX + 11 - frame * 2, y - 2, 2, 2);
      return;
    }
    var w = 13 + st * 2, h = 10 - st, bx = KX + 1 - st, by = y - 3 - h;
    // antenna, swaying with speed
    var sway = state === 'run' ? (Math.floor(t / 160) % 2) + (speed > .3 ? 1 : 0) : 0;
    px(INK, bx + (w >> 1), by - 3, 1, 3); px(WARM, bx + (w >> 1) - sway, by - 4, 2, 1);
    // body: a little TV with a dark screen
    px(INK, bx, by, w, h); px(BG, bx + 2, by + 2, w - 4, h - 4);
    px(INK, bx, by, 1, 1); px(BG, bx, by, 1, 1); px(BG, bx + w - 1, by, 1, 1);      // round the top corners
    // eyes: x x when out, blink sometimes, otherwise look toward the next obstacle
    var ey = by + 3, eh = (t % 3400) < 110 ? 1 : 3;
    if (state === 'over') {
      [bx + 3, bx + w - 6].forEach(function (ex) { px(INK, ex, ey, 1, 1); px(INK, ex + 2, ey, 1, 1); px(INK, ex + 1, ey + 1, 1, 1); px(INK, ex, ey + 2, 1, 1); px(INK, ex + 2, ey + 2, 1, 1); });
    } else {
      var next = obs.find(function (o) { return o.x > KX; }), look = next && next.y < y - 14 ? -1 : 0;
      px(INK, bx + 4, ey + look + (3 - eh), 2, eh); px(INK, bx + w - 6, ey + look + (3 - eh), 2, eh);
    }
    // feet: two that step in turn (tucked in the air)
    if (kai.air) { px(INK, bx + 3, y - 3, 2, 2); px(INK, bx + w - 5, y - 3, 2, 2); }
    else { px(INK, bx + 2 + frame, y - 2, 2, 2); px(INK, bx + w - 4 - frame, y - 2 - frame, 2, 2); }
    // shadow while in the air
    if (kai.air) { var s = Math.max(4, 12 + Math.round(kai.y / 4)); px(DIM, KX + 7 - (s >> 1), GROUND + 1, s, 1); }
  }
  function text(s, X, Y, c, align) {
    x.font = FONT; x.textBaseline = 'top'; x.textAlign = align || 'left'; x.fillStyle = c; x.fillText(s, X, Y);
  }
  function draw(t) {
    x.save();
    if (shake > 0) x.translate(R(3) - 1, R(3) - 1);
    drawSky(t);
    drawGround();
    obs.forEach(function (o) { if (o.kind === 'tower') drawTower(o, t); else drawPacket(o, t); });
    dust.forEach(function (d) { px(d.life > 120 ? MID : DIM, d.x, d.y, 1, 1); });
    drawKai(t);
    x.restore();

    text('HI ' + String(best).padStart(5, '0'), W - 60, 6, MID, 'right');
    if (blink <= 0 || Math.floor(blink / 150) % 2 === 0) text(String(score | 0).padStart(5, '0'), W - 6, 6, INK, 'right');

    if (paused || state !== 'run') {
      var flash = Math.floor(t / 530) % 2 === 0;
      var title = paused ? 'PAUSED' : state === 'over' ? 'GAME OVER' : 'KAI IS LOST TOO';
      var sub = paused ? 'PRESS SPACE' : state === 'over' ? 'PRESS SPACE TO RETRY' : 'PRESS SPACE TO RUN';
      text(title, W / 2, 34, state === 'over' ? WARM : INK, 'center');
      if (flash) text(sub, W / 2, 50, MID, 'center');
    }
    x.textAlign = 'left';
  }

  function loop(t) {
    requestAnimationFrame(loop);
    if (document.hidden) { last = 0; return; }
    var dt = last ? Math.min(100, t - last) : STEP; last = t;
    if (shake > 0) shake -= dt;
    if (state === 'run' && !paused) {
      acc += dt;
      while (acc >= STEP && state === 'run') { tick(STEP); acc -= STEP; }
    }
    draw(t - t0);
  }

  addEventListener('keydown', function (e) {
    var k = e.key;
    if (k === ' ' || k === 'ArrowUp' || k === 'w' || k === 'W') { e.preventDefault(); if (!e.repeat) press(); }
    else if (k === 'ArrowDown' || k === 's' || k === 'S') { e.preventDefault(); duckKey = true; }
    else if ((k === 'p' || k === 'P' || k === 'Escape') && state === 'run') paused = !paused;
  });
  addEventListener('keyup', function (e) {
    var k = e.key;
    if (k === ' ' || k === 'ArrowUp' || k === 'w' || k === 'W') release();
    else if (k === 'ArrowDown' || k === 's' || k === 'S') duckKey = false;
  });
  var sy = 0;
  cv.addEventListener('pointerdown', function (e) { e.preventDefault(); sy = e.clientY; press(); });
  cv.addEventListener('pointermove', function (e) { if (e.buttons && e.clientY - sy > 24) { duckKey = true; release(); } });
  addEventListener('pointerup', function () { release(); duckKey = false; });
  addEventListener('blur', function () { if (state === 'run') paused = true; });

  reset();
  // the pixel font has to be ready before the first frame, or the score draws in a fallback face
  var go = function () { t0 = performance.now(); requestAnimationFrame(loop); };
  if (document.fonts && document.fonts.load) document.fonts.load(FONT).then(go, go); else go();
})();
