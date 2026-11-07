/* Kai's runner, for the 404 page. Kai is lost, so it runs along the horizon
   of the night sky, jumping corrupted blocks (stacks of flickering glyphs)
   and, from 300 points, dodging glitch packets at three heights: low (jump),
   head height (duck) and high (just keep running, unless you jump into it).

   Tuned from the Chromium dino source and platformer game-feel practice:
   - fixed 120Hz physics, so the arc is the same at any refresh rate
   - variable jump: let go early for a short hop
   - a 130ms jump buffer: a press just before landing still jumps
   - down in the air drops 3x faster (Chromium's speedDropCoefficient)
   - the first obstacle waits 1.5s, and a crash locks restart for 700ms
   - every gap leaves room for a full jump at the current speed
   - narrow screens run slower, scaled by width (Chromium does the same)
   - squash and stretch, landing dust, a score blink every 100 points,
     a short shake on a crash
   Space / up / W / tap jumps; down / S / swipe down ducks; P pauses.
   Best score stays in localStorage when the browser allows it. */
(function () {
  var cv = document.getElementById('runner');
  if (!cv || !cv.getContext) return;
  var x = cv.getContext('2d');
  var GLYPHS = 'ABCDEFGHJKMNPQRSTUVWXYZ0123456789#$%&*+=<>[]{}/\\@';
  var INK = '#e9eef8', DIM = 'rgba(205,214,226,.38)';
  var STEP = 1000 / 120;
  var G = 0.0026, JUMP_V = -0.74, CUT = 0.45, DROP = 3, BUFFER = 130;
  var KX = 52, KW = 30, KH = 26, KH_DUCK = 16;

  var W = 0, H = 0, GROUND = 0, dpr = 1, scale = 1;
  var best = 0;
  try { best = +localStorage.getItem('kai-runner-best') || 0; } catch (e) {}

  var state = 'idle', kai, obs, dust, specks, far, speed, score, gapLeft, clearLeft, lockUntil = 0;
  var acc = 0, last = 0, shake = 0, blink = 0, nextMilestone = 100, paused = false;
  var held = false, duckKey = false, bufferedAt = -1e9;

  function reset() {
    kai = { y: 0, vy: 0, air: false, sq: 0 };
    obs = []; dust = []; speed = 0.36; score = 0; gapLeft = 0; clearLeft = 1500;
    nextMilestone = 100; blink = 0; acc = 0; last = 0;
  }
  function size() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = cv.clientWidth; H = cv.clientHeight; GROUND = H - 38;
    cv.width = W * dpr; cv.height = H * dpr; x.setTransform(dpr, 0, 0, dpr, 0, 0);
    scale = Math.min(1, Math.max(0.6, W / 600));
    specks = []; for (var i = 0; i < W / 12; i++) specks.push({ x: Math.random() * W, y: GROUND + 6 + Math.random() * 26, w: 1 + Math.random() * 3 });
    far = []; for (var j = 0; j < W / 40; j++) far.push({ x: Math.random() * W, y: 14 + Math.random() * (GROUND - 60), a: .15 + Math.random() * .35 });
  }
  function glyph() { return GLYPHS[Math.random() * GLYPHS.length | 0]; }
  function airtime() { return 2 * -JUMP_V / G; }

  function spawn() {
    var o, r = Math.random();
    if (score > 300 && r < .32) {
      // packet heights: 0 low (jump it), 1 head height (duck), 2 high (run under)
      var lvl = Math.random() * 3 | 0;
      var y = [GROUND - 20, GROUND - 30, GROUND - 52][lvl];
      o = { kind: 'packet', cols: 3, rows: 1, y: y, lvl: lvl };
    } else {
      var big = score > 150 && Math.random() < .35;
      var cols = big ? 2 + (Math.random() * 2 | 0) : 1 + (Math.random() * 2 | 0);
      var rows = big ? 3 : 2 + (Math.random() * 2 | 0);
      o = { kind: 'block', cols: cols, rows: rows, y: GROUND - rows * 13 };
    }
    o.x = W + 8; o.w = o.cols * 10; o.h = o.rows * 13; o.cells = [];
    for (var i = 0; i < o.cols * o.rows; i++) o.cells.push(glyph());
    obs.push(o);
    // room to land and take off again, plus a random extra like Chromium's gap coefficient
    var minGap = speed * airtime() * 1.05 + o.w + 20;
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
    var low = duckKey && !kai.air, h = low ? KH_DUCK : KH;
    return { x: KX, y: GROUND - h + kai.y, w: KW, h: h };
  }
  // forgiving hitboxes: corners of a rounded body should never count
  function hit(a, o) { return a.x + 5 < o.x + o.w - 1 && a.x + a.w - 5 > o.x + 1 && a.y + 5 < o.y + o.h - 1 && a.y + a.h - 2 > o.y + 1; }

  function tick(dt) {
    var now = performance.now();
    score += dt * speed * 0.055;
    speed = Math.min(0.82, speed + dt * 0.0000105);
    var v = speed * scale;
    if (score >= nextMilestone) { blink = 900; nextMilestone += 100; }
    if (blink > 0) blink -= dt;

    // jump (buffered), gravity, fast drop
    if (!kai.air && now - bufferedAt < BUFFER) { kai.vy = JUMP_V; kai.air = true; kai.sq = -1; bufferedAt = -1e9; if (!held) kai.vy = JUMP_V * 0.8; }
    kai.vy += G * (duckKey && kai.air ? DROP : 1) * dt;
    kai.y += kai.vy * dt;
    if (kai.y >= 0) {
      if (kai.air) { kai.sq = 1; for (var p = 0; p < 6; p++) dust.push({ x: KX + 15 + (Math.random() - .5) * 20, y: GROUND - 1, vx: (Math.random() - .5) * .08 - v * .3, vy: -Math.random() * .06, life: 260 }); }
      kai.y = 0; kai.vy = 0; kai.air = false;
    }
    kai.sq *= Math.pow(0.985, dt);

    if (clearLeft > 0) clearLeft -= dt; else { gapLeft -= v * dt; if (gapLeft <= 0) spawn(); }
    var k = box();
    for (var i = obs.length - 1; i >= 0; i--) {
      var o = obs[i]; o.x -= v * dt * (o.kind === 'packet' ? 1.1 : 1);
      if (Math.random() < .01 * dt / STEP) o.cells[Math.random() * o.cells.length | 0] = glyph();
      if (o.x + o.w < -10) { obs.splice(i, 1); continue; }
      if (hit(k, o)) { over(); return; }
    }
    specks.forEach(function (s) { s.x -= v * dt; if (s.x < -4) s.x += W + 8; });
    far.forEach(function (s) { s.x -= v * dt * .08; if (s.x < -2) s.x += W + 4; });
    for (var j = dust.length - 1; j >= 0; j--) { var dd = dust[j]; dd.x += dd.vx * dt; dd.y += dd.vy * dt; dd.life -= dt; if (dd.life <= 0) dust.splice(j, 1); }
  }
  function over() {
    state = 'over'; shake = 160; lockUntil = performance.now() + 700; held = false;
    var s = score | 0;
    if (s > best) { best = s; try { localStorage.setItem('kai-runner-best', String(best)); } catch (e) {} }
  }

  function drawKai(t) {
    var k = box(), run = state === 'run' && !kai.air;
    var bob = run ? Math.round(Math.sin(t / 60)) : 0;
    // squash on landing, stretch on take-off
    var sw = 1 + kai.sq * 0.12, sh = 1 - kai.sq * 0.12;
    var w = k.w * sw, h = k.h * sh, bx = k.x + (k.w - w) / 2, by = GROUND + kai.y - h + bob;
    var shd = Math.max(.3, 1 + kai.y / 110);
    x.fillStyle = 'rgba(150,180,235,.2)'; x.beginPath(); x.ellipse(k.x + 15, GROUND + 3, 13 * shd, 2.4 * shd, 0, 0, 7); x.fill();
    if (h > 18) {
      var sway = state === 'run' ? Math.sin(t / 90) * 2 + speed * 3 : 0;
      x.strokeStyle = INK; x.lineWidth = 1.5; x.beginPath(); x.moveTo(bx + w / 2, by); x.quadraticCurveTo(bx + w / 2, by - 5, bx + w / 2 - sway, by - 8); x.stroke();
      x.fillStyle = INK; x.beginPath(); x.arc(bx + w / 2 - sway, by - 9, 2, 0, 7); x.fill();
    }
    x.fillStyle = INK; x.beginPath(); x.roundRect(bx, by, w, h, 7); x.fill();
    x.fillStyle = '#0a0d16'; x.beginPath(); x.roundRect(bx + 3, by + 3, w - 6, h - 6, 5); x.fill();
    x.fillStyle = INK;
    if (state === 'over') {
      x.font = 'bold 9px "JetBrains Mono", monospace'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText('x', bx + w / 2 - 5, by + h / 2); x.fillText('x', bx + w / 2 + 5, by + h / 2); x.textAlign = 'left';
      return;
    }
    // eyes look ahead at the next obstacle, and blink
    var next = obs.find(function (o) { return o.x > k.x; });
    var look = next ? Math.max(-1, Math.min(2, (next.y + next.h / 2 - (by + h / 2)) / 20)) : 0;
    var eh = (t % 3400) < 110 ? 1.5 : 6, ey = by + h / 2 - eh / 2 + look;
    x.fillRect(bx + w / 2 - 6, ey, 4, eh); x.fillRect(bx + w / 2 + 2, ey, 4, eh);
  }

  function draw(t) {
    x.save();
    if (shake > 0) x.translate((Math.random() - .5) * 6, (Math.random() - .5) * 4);
    x.clearRect(-10, -10, W + 20, H + 20);
    far.forEach(function (s) { x.fillStyle = 'rgba(205,214,226,' + s.a * .5 + ')'; x.fillRect(s.x, s.y, 1, 1); });
    x.strokeStyle = 'rgba(205,214,226,.32)'; x.lineWidth = 1; x.setLineDash([6, 5]);
    x.lineDashOffset = state === 'run' ? (t * speed * scale) % 11 : 0;
    x.beginPath(); x.moveTo(0, GROUND + .5); x.lineTo(W, GROUND + .5); x.stroke(); x.setLineDash([]);
    x.fillStyle = 'rgba(205,214,226,.22)';
    specks.forEach(function (s) { x.fillRect(s.x, s.y, s.w, 1); });

    x.font = '11px "JetBrains Mono", monospace'; x.textBaseline = 'top'; x.textAlign = 'left';
    obs.forEach(function (o) {
      x.fillStyle = 'rgba(6,7,11,.92)'; x.fillRect(o.x - 1, o.y - 1, o.w + 2, o.h + 2);
      for (var r = 0; r < o.rows; r++) for (var c = 0; c < o.cols; c++) {
        x.fillStyle = (r + c) % 3 === 0 ? '#9fb2d6' : (o.kind === 'packet' ? '#c9d4ea' : '#6f7b93');
        x.fillText(o.cells[r * o.cols + c], o.x + c * 10 + 1, o.y + r * 13 + 1);
      }
      if (o.kind === 'packet') { x.fillStyle = 'rgba(159,178,214,.35)'; x.fillRect(o.x + o.w + 2, o.y + 6, 6 + speed * 10, 1); }
    });
    dust.forEach(function (d) { x.fillStyle = 'rgba(205,214,226,' + (d.life / 260 * .6) + ')'; x.fillRect(d.x, d.y, 2, 2); });
    drawKai(t);
    x.restore();

    x.font = '11px "JetBrains Mono", monospace'; x.textAlign = 'right'; x.textBaseline = 'top';
    x.fillStyle = DIM; x.fillText('HI ' + String(best).padStart(5, '0'), W - 74, 12);
    var showScore = blink <= 0 || Math.floor(blink / 150) % 2 === 0;
    if (showScore) { x.fillStyle = INK; x.fillText(String(score | 0).padStart(5, '0'), W - 14, 12); }

    if (state !== 'run' || paused) {
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillStyle = INK; x.font = '12px "JetBrains Mono", monospace';
      var title = paused ? 'PAUSED' : state === 'over' ? 'SIGNAL LOST' : 'KAI IS LOST TOO';
      var sub = paused ? 'press space to carry on' : state === 'over' ? 'press space or tap to run again' : 'press space or tap to help it look';
      x.fillText(title, W / 2, H / 2 - 30);
      x.fillStyle = DIM; x.font = '11px "JetBrains Mono", monospace'; x.fillText(sub, W / 2, H / 2 - 12);
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
    draw(t);
  }

  // keys work anywhere on the page (nothing else here scrolls or types)
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
  // touch: tap to jump (hold for higher), swipe down to duck
  var sy = 0;
  cv.addEventListener('pointerdown', function (e) { e.preventDefault(); sy = e.clientY; press(); });
  cv.addEventListener('pointermove', function (e) { if (e.buttons && e.clientY - sy > 24) { duckKey = true; release(); } });
  addEventListener('pointerup', function () { release(); duckKey = false; });
  addEventListener('blur', function () { if (state === 'run') paused = true; });
  addEventListener('resize', size);

  reset(); size(); requestAnimationFrame(loop);
})();
