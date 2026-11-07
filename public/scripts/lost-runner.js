/* Kai's runner, for the 404 page. Kai is lost, so it runs along the horizon
   of the night sky: corrupted blocks (stacks of flickering glyphs) come from
   the right to be jumped, and from 250 points low-flying glitch packets that
   have to be ducked under. The speed creeps up. Space / up / W / tap jumps,
   down / S ducks (and drops faster in the air). Best score stays in
   localStorage when the browser allows it. Pauses when the tab is hidden. */
(function () {
  var cv = document.getElementById('runner');
  if (!cv || !cv.getContext) return;
  var x = cv.getContext('2d');
  var W = 0, H = 0, GROUND = 0, dpr = 1;
  var GLYPHS = 'ABCDEFGHJKMNPQRSTUVWXYZ0123456789#$%&*+=<>[]{}/\\@';
  var INK = '#e9eef8', DIM = 'rgba(205,214,226,.35)';

  var best = 0;
  try { best = +localStorage.getItem('kai-runner-best') || 0; } catch (e) {}

  var state, kai, obs, specks, speed, score, spawnIn, last, flash;
  function reset() {
    kai = { y: 0, vy: 0, duck: false, air: false };
    obs = []; speed = 0.34; score = 0; spawnIn = 700; flash = 0;
  }
  function size() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = cv.clientWidth; H = cv.clientHeight; GROUND = H - 38;
    cv.width = W * dpr; cv.height = H * dpr; x.setTransform(dpr, 0, 0, dpr, 0, 0);
    specks = []; for (var i = 0; i < W / 14; i++) specks.push({ x: Math.random() * W, y: GROUND + 6 + Math.random() * 26, w: 1 + Math.random() * 3 });
  }
  function glyph() { return GLYPHS[Math.random() * GLYPHS.length | 0]; }

  // obstacles: a block is cols x rows of glyph cells standing on the ground;
  // a packet is a short glyph strip at head height (duck under it, or jump it)
  function spawn() {
    var packet = score > 250 && Math.random() < .3;
    var o;
    if (packet) {
      var low = Math.random() < .5;
      o = { kind: 'packet', cols: 3, rows: 1, y: GROUND - 31 - (low ? 0 : 4) };
    } else {
      var cols = 1 + (Math.random() * (score > 120 ? 3 : 2) | 0), rows = 2 + (Math.random() * 2 | 0);
      o = { kind: 'block', cols: cols, rows: rows, y: GROUND - rows * 14 };
    }
    o.x = W + 10; o.w = o.cols * 10; o.h = o.rows * 14; o.cells = [];
    for (var i = 0; i < o.cols * o.rows; i++) o.cells.push(glyph());
    obs.push(o);
    // the gap shrinks with speed but always leaves room to land and jump again
    spawnIn = (520 + Math.random() * 900) * (0.34 / speed) + 260;
  }

  function jump() {
    if (state !== 'run') { start(); return; }
    if (!kai.air) { kai.vy = -0.7; kai.air = true; }
  }
  function start() { reset(); state = 'run'; last = 0; }

  function kaiBox() {
    var h = kai.duck && !kai.air ? 16 : 26;
    return { x: 46, y: GROUND - h + kai.y, w: 30, h: h };
  }
  function hit(a, b) { return a.x + 4 < b.x + b.w && a.x + a.w - 4 > b.x && a.y + 4 < b.y + b.h && a.y + a.h - 3 > b.y; }

  function step(dt) {
    score += dt * speed * 0.06;
    speed = Math.min(0.85, speed + dt * 0.000012);
    // gravity; holding down in the air drops faster
    kai.vy += (kai.duck ? 0.0065 : 0.0024) * dt;
    kai.y += kai.vy * dt;
    if (kai.y >= 0) { kai.y = 0; kai.vy = 0; kai.air = false; }
    spawnIn -= dt; if (spawnIn <= 0) spawn();
    var k = kaiBox();
    for (var i = obs.length - 1; i >= 0; i--) {
      var o = obs[i]; o.x -= speed * dt * (o.kind === 'packet' ? 1.12 : 1);
      if (Math.random() < .08) o.cells[Math.random() * o.cells.length | 0] = glyph();
      if (o.x + o.w < -10) { obs.splice(i, 1); continue; }
      if (hit(k, o)) { over(); return; }
    }
    specks.forEach(function (s) { s.x -= speed * dt; if (s.x < -4) s.x += W + 8; });
  }
  function over() {
    state = 'over'; flash = 10;
    var s = score | 0;
    if (s > best) { best = s; try { localStorage.setItem('kai-runner-best', String(best)); } catch (e) {} }
  }

  function drawKai(t) {
    var k = kaiBox(), bob = state === 'run' && !kai.air ? Math.round(Math.sin(t / 70)) : 0, y = k.y + bob;
    // soft shadow on the ground, smaller in the air
    var sh = 1 + kai.y / 120;
    x.fillStyle = 'rgba(150,180,235,.18)'; x.beginPath(); x.ellipse(k.x + 15, GROUND + 3, 14 * sh, 2.5 * sh, 0, 0, 7); x.fill();
    // antenna
    x.strokeStyle = INK; x.lineWidth = 1.5;
    if (!(kai.duck && !kai.air)) { x.beginPath(); x.moveTo(k.x + 15, y); x.lineTo(k.x + 15, y - 7); x.stroke(); x.fillStyle = INK; x.beginPath(); x.arc(k.x + 15, y - 8, 2, 0, 7); x.fill(); }
    // body: Kai's rounded screen with two eyes that blink
    x.fillStyle = INK; x.beginPath(); x.roundRect(k.x, y, k.w, k.h, 7); x.fill();
    x.fillStyle = '#0a0d16'; x.beginPath(); x.roundRect(k.x + 3, y + 3, k.w - 6, k.h - 6, 5); x.fill();
    var blink = (t % 3200) < 120, eh = blink ? 1.5 : (state === 'over' ? 2 : 6), ey = y + k.h / 2 - eh / 2;
    x.fillStyle = INK;
    if (state === 'over') { x.font = 'bold 9px "JetBrains Mono", monospace'; x.textBaseline = 'middle'; x.fillText('x', k.x + 8, y + k.h / 2); x.fillText('x', k.x + 17, y + k.h / 2); }
    else { x.fillRect(k.x + 9, ey, 4, eh); x.fillRect(k.x + 17, ey, 4, eh); }
  }

  function draw(t) {
    x.clearRect(0, 0, W, H);
    // horizon: a dashed line with passing specks of ground
    x.strokeStyle = 'rgba(205,214,226,.32)'; x.lineWidth = 1; x.setLineDash([6, 5]);
    x.lineDashOffset = state === 'run' ? (t * speed) % 11 : 0;
    x.beginPath(); x.moveTo(0, GROUND + .5); x.lineTo(W, GROUND + .5); x.stroke(); x.setLineDash([]);
    x.fillStyle = 'rgba(205,214,226,.22)';
    specks.forEach(function (s) { x.fillRect(s.x, s.y, s.w, 1); });

    x.font = '12px "JetBrains Mono", monospace'; x.textBaseline = 'top';
    obs.forEach(function (o) {
      x.fillStyle = 'rgba(6,7,11,.9)'; x.fillRect(o.x - 1, o.y - 1, o.w + 2, o.h + 2);
      for (var r = 0; r < o.rows; r++) for (var c = 0; c < o.cols; c++) {
        var g = o.cells[r * o.cols + c];
        x.fillStyle = (r + c) % 3 === 0 ? '#9fb2d6' : (o.kind === 'packet' ? '#c9d4ea' : '#6f7b93');
        x.fillText(g, o.x + c * 10 + 1, o.y + r * 14 + 1);
      }
    });
    drawKai(t);

    // score, top right
    x.font = '11px "JetBrains Mono", monospace'; x.textAlign = 'right'; x.textBaseline = 'top';
    x.fillStyle = DIM; x.fillText('HI ' + String(best).padStart(5, '0'), W - 74, 12);
    x.fillStyle = INK; x.fillText(String(score | 0).padStart(5, '0'), W - 14, 12);
    x.textAlign = 'left';

    if (state !== 'run') {
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillStyle = INK; x.font = '12px "JetBrains Mono", monospace';
      x.fillText(state === 'over' ? 'SIGNAL LOST' : 'KAI IS LOST TOO', W / 2, H / 2 - 30);
      x.fillStyle = DIM; x.font = '11px "JetBrains Mono", monospace';
      x.fillText(state === 'over' ? 'press space or tap to run again' : 'press space or tap to help it look', W / 2, H / 2 - 12);
      x.textAlign = 'left';
    }
    // on a crash, a few rows slip sideways for a moment
    if (flash > 0) {
      flash--;
      for (var i = 0; i < 3; i++) {
        var sy = Math.random() * H, sh = 4 + Math.random() * 12;
        x.drawImage(cv, 0, sy * dpr, W * dpr, sh * dpr, (Math.random() * 16 - 8), sy, W, sh);
      }
    }
  }

  function loop(t) {
    requestAnimationFrame(loop);
    if (document.hidden) { last = 0; return; }
    if (state === 'run') {
      var dt = last ? Math.min(40, t - last) : 16; last = t;
      step(dt);
    }
    draw(t);
  }

  // keys work anywhere on the page (nothing else here scrolls or types)
  addEventListener('keydown', function (e) {
    var k = e.key;
    if (k === ' ' || k === 'ArrowUp' || k === 'w' || k === 'W') { e.preventDefault(); if (!e.repeat) jump(); }
    else if (k === 'ArrowDown' || k === 's' || k === 'S') { e.preventDefault(); kai.duck = true; }
  });
  addEventListener('keyup', function (e) { if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') kai.duck = false; });
  cv.addEventListener('pointerdown', function (e) { e.preventDefault(); jump(); });
  addEventListener('resize', size);

  reset(); state = 'idle'; size(); requestAnimationFrame(loop);
})();
