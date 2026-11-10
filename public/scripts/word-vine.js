/* A plant up the left edge of the homepage (index.astro), behind the page.
   The plant comes from a drawing: scripts/make-vine-mask.mjs turns a line
   drawing into a mask (ink lines bright, closed petals and leaves dim). This
   lays a fixed grid over it and puts one mark in every cell the plant covers:
   2px pixel art in three shades (pixel, the default, matching vine-leaves.js),
   or, brighter where the drawing's ink is: letters of a running text (words),
   a glyph picked by brightness (ascii), a dot matrix (dots) or 1-bit
   dithered squares (bits).
   The grid is read once (again on resize, theme change or wordVine.set) and
   redrawn at about 15fps with a slow living motion (off for reduced motion).
   Arrives on load with a scramble reveal. Hidden on narrow screens and touch.
   window.wordVine.set(options) changes the look live (/_vine-tune.html). */
(function(){
  var root = document.documentElement;
  var MONO = "ui-monospace, 'Cascadia Mono', Consolas, Menlo, monospace";
  var CFG = {
    vine: 'glory',      // public/images/vine/<name>.png
    x: -130,            // px of the plant's left edge from the screen's left
    y: 371,             // px the stacked plants are shifted down
    zoom: 0.74,         // plant height as a share of the screen height
    mirror: true,       // every other stacked copy mirrored
    flip: false,        // mirror the whole plant
    style: 'digits',    // digits (coloured digits, glyph by brightness) | pixel (3-shade pixel art) | words (letters flow through the shape) | ascii (glyph by brightness) | dots (dot matrix) | bits (1-bit dither)
    size: 7,            // cell px (text size; pixel: square size)
    row: 1.1,           // row height, in sizes
    cover: 0.25,        // share of a cell the plant must cover to get a mark (lower keeps thin stems unbroken)
    motion: 0.56,       // how much the plant moves (0 = still)
    speed: 0.6,         // how fast it moves
    weight: 600,
    bright: 0.8,        // overall brightness
    base: 0.3,          // brightness inside petals and leaves
    ink: 1.3,           // how strongly the drawing's ink brightens a cell (contrast)
    dark: '#9d9fa1',    // text colour on the dark sky
    light: '#382a24',   // text colour on the day sky
    // digits/pixel colours, [lit, base, outline] per part of the plant; throat = [outer, centre].
    // Day: hue-shifted pixel art (highlights warmer, outlines cooler); the glories are the violet
    // Ipomoea purpurea with a pink throat (sky-blue Heavenly Blue vanishes on the blue day sky),
    // pink buds. Night: rod vision (Purkinje shift) sees almost no colour, so night is greys
    // only, and the glories become white moonflowers (Ipomoea alba, the night-blooming
    // morning glory). Notes: docs/2026-11-10-kartik-andreas-research.md.
    colors: {
      day: { leaf: ['#a3bf63', '#6c9449', '#2f5843'], glory: ['#b48be0', '#7b4fc4', '#45277f'],
             bud: ['#f39ac9', '#d0609f', '#7d2f6b'], throat: ['#e27bb6', '#fdf6dc'] },
      // night is black and white, and like the line drawing itself the lines are the brightest
      // part (dark lines vanish on a black sky): [rim, body, line]; moonflowers the only whites
      night: { leaf: ['#8a8a8a', '#4f4f4f', '#c4c4c4'], glory: ['#d8d8d8', '#9e9e9e', '#f4f4f4'],
             bud: ['#7c7c7c', '#474747', '#adadad'], throat: ['#e2e2e2', '#ffffff'] }
    },
    // where the flowers are in glory.png (image px): glories [x0, y0, x1, y1, throat x, throat y], buds [x0, y0, x1, y1]
    parts: { glory: {
      glory: [[315, 68, 462, 190, 362, 152], [178, 545, 285, 722, 233, 618], [280, 948, 467, 1060, 372, 1018], [340, 1030, 395, 1120, 368, 1040]],
      bud: [[236, 72, 292, 112], [252, 128, 302, 178], [280, 193, 332, 246], [352, 428, 408, 488], [344, 532, 396, 578],
            [286, 676, 332, 726], [236, 726, 286, 782], [252, 900, 312, 948], [352, 1166, 396, 1214], [250, 1326, 302, 1368]]
    } },
    words: 'detection and response quiet networks reading logs at night packets alerts triage ' +
      'signals in the noise threat hunting timelines evidence baseline anomaly honeypot telemetry ' +
      'beacons lateral movement patching trust nothing verify everything sandbox hashes entropy ' +
      'rules that fire incident notes coffee curiosity small tools careful hands open source ' +
      'keeping people safe learning every day'
  };

  function rgb(hex){ var n = parseInt(hex.slice(1), 16); return (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255); }

  // width of the plant's image at this screen height
  function plantW(img, H, c){ return Math.round(img.width * Math.round(H * c.zoom) / img.height); }

  var RAMP = ' .,:;i1tfLCG08@';
  var DIGITS = ' .:1742359608';  // digits from light to dense

  // Sharper text art, after Alex Harri's "ASCII characters are not pixels": a glyph is chosen by
  // its shape, not only its brightness. Each cell and each glyph is measured in the same 6 zones
  // (2 across, 3 down); the cell gets the glyph whose 6 numbers are nearest, so a stem gets a 1,
  // a cell inked along its top gets a 7, a ring gets a 0.
  var ZX = 2, ZY = 3, SHAPES = ' 1742359608'; // digits only (and blank): every mark is a number
  function glyphShapes(set, c, cw, ch){
    var k = 8, cv = document.createElement('canvas'); cv.width = cw * k; cv.height = ch * k;
    var g = cv.getContext('2d', { willReadFrequently: true }), out = [], peak = new Array(ZX * ZY).fill(1e-6);
    g.font = c.weight + ' ' + c.size * k + 'px ' + MONO; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (var i = 0; i < set.length; i++){
      g.clearRect(0, 0, cv.width, cv.height); g.fillText(set[i], cv.width / 2, cv.height / 2);
      var v = zones(g.getImageData(0, 0, cv.width, cv.height).data, cv.width, 0, 0, cv.width, cv.height, 3);
      v.forEach(function(x, j){ peak[j] = Math.max(peak[j], x); });
      out.push(v);
    }
    // each zone scaled by its peak over all glyphs, so no zone is dominated by one wide glyph
    return out.map(function(v){ return v.map(function(x, j){ return x / peak[j]; }); });
  }
  // mean ink in each of the 6 zones of a box. ch 3: a glyph's alpha. ch 0: the plant mask, read as
  // ink (fill inside petals and leaves counts 0.6, a drawn line 1), so filled shapes stay solid
  function zones(px, rowW, x0, y0, w, h, ch){
    var v = [];
    for (var zy = 0; zy < ZY; zy++) for (var zx = 0; zx < ZX; zx++){
      var ax = Math.floor(x0 + w * zx / ZX), bx = Math.floor(x0 + w * (zx + 1) / ZX);
      var ay = Math.floor(y0 + h * zy / ZY), by = Math.floor(y0 + h * (zy + 1) / ZY), sum = 0, n = 0;
      for (var yy = ay; yy < by; yy++) for (var xx = ax; xx < bx; xx++){
        var a = px[(yy * rowW + xx) * 4 + ch]; n++;
        sum += ch === 3 ? a / 255 : a ? (a < 120 ? 0.6 : 1) : 0;
      }
      v.push(n ? sum / n : 0);
    }
    return v;
  }
  function nearest(v, shapes){
    // contrast: push each zone toward the cell's own peak, so edges snap instead of greying out
    var m = Math.max.apply(null, v), best = 0, bd = Infinity;
    if (m < 0.04) return 0;
    var w = v.map(function(x){ return m * Math.pow(x / m, 2); });
    for (var i = 0; i < shapes.length; i++){
      var d = 0, s = shapes[i];
      for (var j = 0; j < w.length; j++){ var e = w[j] - s[j]; d += e * e; }
      if (d < bd){ bd = d; best = i; }
    }
    return best;
  }
  var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

  // Reads the plant into grid cells. Everything sits on one grid, one mark per cell, and only
  // in cells the plant covers, so the silhouette stays crisp (the trick in typographic flower
  // posters and ASCII art). ox = x of the image's left edge on a W x H css px canvas.
  function cells(ctx, img, W, H, ox, c, dpr){
    var ph = Math.round(H * c.zoom), dw = plantW(img, H, c);
    var off = document.createElement('canvas'); off.width = dw; off.height = H;
    var o = off.getContext('2d');
    var start = ((c.y % ph) + ph) % ph - ph;
    for (var k = 0, y0 = start; y0 < H; k++, y0 += ph){
      var m = c.flip !== (c.mirror && k % 2 === 1);
      o.save(); if (m){ o.translate(dw, 0); o.scale(-1, 1); } o.drawImage(img, 0, y0, dw, ph); o.restore();
    }
    var px = o.getImageData(0, 0, dw, H).data, size = +c.size;
    ctx.font = c.weight + ' ' + size + 'px ' + MONO;
    // cell edges land on device pixels, so one cell can be cleared and redrawn without touching its neighbours
    var snap = function(v){ return Math.max(1, Math.round(v * dpr)) / dpr; };
    var text = c.style === 'words' || c.style === 'ascii' || c.style === 'digits';
    var cw = snap(text ? ctx.measureText('M').width : size * c.row), ch = snap(size * c.row);
    // digits sit on whole css px so each glyph lands on the same device pixels every time (crisp)
    if (c.style === 'digits'){ cw = Math.max(1, Math.round(cw)); ch = Math.max(1, Math.round(ch)); }
    var shapes = c.style === 'digits' ? glyphShapes(SHAPES, c, cw, ch) : null;
    var parts = c.parts[c.vine];
    var WORDS = String(c.words).split(/\s+/).filter(Boolean); if (!WORDS.length) WORDS = ['word'];
    var stream = WORDS.join(' ') + ' ', si = 0, out = [];
    for (var gy = 0, y = 0; y < H; gy++, y += ch){
      for (var gx = 0, x = 0; x < dw; gx++, x += cw){
        if (ox + x + cw < 0 || ox + x > W) continue;
        // share of the cell the plant covers, and how dark the drawing's ink is there
        // (mask: 80 = inside a petal or leaf, 150..255 = ink lines)
        var n = 0, cov = 0, sum = 0;
        for (var yy = y | 0; yy < Math.min(H, y + ch); yy++) for (var xx = x | 0; xx < Math.min(dw, x + cw); xx++){
          var v = px[(yy * dw + xx) * 4]; n++; if (v){ cov++; sum += v; }
        }
        if (!n || cov / n < c.cover) continue;
        var ink = Math.max(0, (sum / cov - 80) / 175), edge = 0.55 + 0.45 * cov / n;
        var h = Math.abs(Math.sin(gx * 12.9898 + gy * 78.233) * 43758.5453) % 1;
        out.push({ gx: gx, gy: gy, x: ox + x, y: y, ch: stream[si++ % stream.length],
          t: (c.base + (1 - c.base) * Math.min(1, ink * c.ink)) * edge, seed: h * 6.2832, at: h, ink: ink,
          part: parts ? part(parts, x + cw / 2, y + ch / 2) : 'leaf',
          glyph: shapes ? SHAPES[nearest(zones(px, dw, x, y, Math.min(cw, dw - x), Math.min(ch, H - y), 0), shapes)] : null });
        if (shapes && out[out.length - 1].glyph === ' ') out.pop();
      }
    }
    // which part of the drawing a cell's middle falls on, in glory.png's own pixels (undoing the stacking and mirroring)
    function part(P, cx, cy){
      var yl = cy - start, k = Math.floor(yl / ph);
      var iy = (yl - k * ph) / ph * img.height, ix = cx / dw * img.width;
      if (c.flip !== (c.mirror && k % 2 === 1)) ix = img.width - ix;
      for (var a = 0; a < P.glory.length; a++){
        var b = P.glory[a];
        if (ix >= b[0] && ix <= b[2] && iy >= b[1] && iy <= b[3]){
          var d = Math.hypot(ix - b[4], iy - b[5]);
          return d < 9 ? 'throat1' : d < 20 ? 'throat0' : 'glory';
        }
      }
      for (a = 0; a < P.bud.length; a++){ b = P.bud[a]; if (ix >= b[0] && ix <= b[2] && iy >= b[1] && iy <= b[3]) return 'bud'; }
      return 'leaf';
    }
    if (c.style === 'pixel' || c.style === 'digits'){
      // pixel art shading: the drawing's ink lines are the outline (3), petals and leaves are the
      // body (2), and body cells with open space above or to the left catch the light (1)
      var on = {};
      for (var j = 0; j < out.length; j++) on[out[j].gx + ',' + out[j].gy] = 1;
      for (j = 0; j < out.length; j++){
        var q = out[j];
        q.shade = q.ink > 0.35 ? 3 : !on[q.gx + ',' + (q.gy - 1)] || !on[(q.gx - 1) + ',' + q.gy] ? 1 : 2;
      }
    }
    return { list: out, cw: cw, ch: ch, w: W, h: H, keys: new Int32Array(out.length), rows: {} };
  }

  // Draws the cells at time s (seconds of motion) and intro age i (seconds since the plant
  // appeared, Infinity = settled). Motion is slow and layered, like living ASCII pieces: a band of
  // light drifting up the plant like sap, a soft breath over the whole plant, a faint per-cell
  // flicker, and rows swaying a pixel or two. Tone drives everything, so in ascii the glyphs
  // themselves shift along the ramp.
  // Intro: a scramble reveal. Cells arrive in random order, flicker through random tones for a
  // moment, then lock to their own.
  // Speed: tone is rounded to 20 steps and sway to device pixels, so most cells look the same as
  // last frame. Unless full is set, only cells whose look changed are cleared and redrawn, and a
  // row only when its sway moved.
  var STEPS = 20, ARRIVE = 2.2, LOCK = 0.6;
  function render(ctx, g, s, i, dark, c, full, dpr){
    var mo = +c.motion, style = c.style, cw = g.cw, ch = g.ch, L = g.list, keys = g.keys, rows = g.rows;
    var breath = Math.sin(s * 0.35), tick = Math.floor(i * 15), row = -1, rowNew = false, off = 0;
    if (full){ ctx.clearRect(0, 0, g.w, g.h); keys.fill(-1); rows = g.rows = {}; }
    ctx.fillStyle = 'rgb(' + rgb(dark ? c.dark : c.light) + ')'; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    ctx.font = c.weight + ' ' + c.size + 'px ' + MONO;
    for (var n = 0; n < L.length; n++){
      var e = L[n];
      if (e.gy !== row){
        row = e.gy;
        off = mo ? Math.round(mo * 3 * Math.sin(s * 0.45 + e.y * 0.005) * dpr) / dpr : 0;
        rowNew = !full && rows[row] !== undefined && rows[row] !== off;
        if (rowNew) ctx.clearRect(0, e.y, g.w, ch);
        rows[row] = off;
      }
      var t = e.t, key = null;
      if (mo) t = Math.max(0, Math.min(1, t * (1 + mo * (0.45 * Math.sin(e.gy * 0.09 + e.gx * 0.04 + s * 0.9) + 0.12 * breath + 0.1 * Math.sin(e.seed + s * 1.3)))));
      var age = i - e.at * ARRIVE;
      if (age < 0) key = -1;                                  // not arrived yet
      else if (age < LOCK){                                   // scrambling: a random tone each tick, fading up
        var r = Math.abs(Math.sin((n + 1) * 91.7 + tick * 13.1) * 43758.5453) % 1;
        t = r * t * (0.4 + 0.6 * age / LOCK); key = -2 - tick;
      }
      var q = Math.round(t * STEPS);
      if (style === 'digits') q = key !== null ? 1 + Math.floor(Math.random() * (DIGITS.length - 1)) : t > e.t * 1.25 ? 1 : 0; // scramble: a random digit; else 1 while the band of light passes
      if (style === 'pixel'){
        // the moving band of light lifts body cells to the lit shade; scrambling cells take a random shade
        q = key !== null ? 1 + (-key % 3) : e.shade === 2 && t > e.t * 1.3 ? 1 : e.shade;
      }
      if (key === null) key = q;
      if (!rowNew && keys[n] === key) continue;
      if (!rowNew && keys[n] !== -1) ctx.clearRect(e.x + rows[row], e.y, cw, ch);
      keys[n] = key;
      if (key === -1) continue;
      t = q / STEPS;
      var x = e.x + off;
      ctx.globalAlpha = Math.min(1, t * c.bright);
      if (style === 'pixel' || style === 'digits'){
        var pal = c.colors[dark ? 'night' : 'day'], col;
        if (e.part === 'throat0' || e.part === 'throat1') col = pal.throat[e.part === 'throat1' ? 1 : 0];
        else col = pal[e.part][(style === 'pixel' ? q : e.shade) - 1];
        ctx.fillStyle = col;
        if (style === 'pixel'){ ctx.globalAlpha = 1; ctx.fillRect(x, e.y, cw, ch); }
        else {
          // solid colour (see-through glyphs blur on black); the passing band of light shows the
          // brightest shade, a scrambling cell a random digit
          ctx.globalAlpha = 1;
          if (key < -1){ col = pal[e.part] ? pal[e.part][1] : col; ctx.fillStyle = col; }
          else if (q === 1) ctx.fillStyle = dark ? pal[e.part] ? pal[e.part][2] : col : pal[e.part] ? pal[e.part][0] : col;
          ctx.fillText(key < -1 ? DIGITS[q] : e.glyph, Math.round(x + cw / 2), Math.round(e.y + ch / 2));
        }
      } else if (style === 'bits'){
        if (t * 16 <= BAYER[(e.gy % 4) * 4 + e.gx % 4]) continue;
        ctx.globalAlpha = Math.min(1, c.bright);
        ctx.fillRect(x, e.y, cw - 1 / dpr, ch - 1 / dpr);
      } else if (style === 'dots'){
        ctx.beginPath(); ctx.arc(x + cw / 2, e.y + ch / 2, cw * (0.16 + 0.26 * t), 0, 6.2832); ctx.fill();
      } else {
        var k = style === 'ascii' ? RAMP[Math.max(1, Math.round(t * (RAMP.length - 1)))] : e.ch;
        if (k !== ' ') ctx.fillText(k, x + cw / 2, e.y + ch / 2);
      }
    }
    ctx.globalAlpha = 1;
  }

  var cv, ctx, imgs = {}, t = 0, started = false, grid = null, raf = 0, last = 0, born = -1, full = true, dpr = 1;
  var still = matchMedia('(prefers-reduced-motion: reduce)');
  function image(name, done){
    if (imgs[name] && imgs[name].complete) return done(imgs[name]);
    var im = imgs[name] = new Image(); im.onload = function(){ done(im); }; im.src = '/images/vine/' + name + '.png';
  }
  function frame(now){
    raf = 0;
    var age = born < 0 || still.matches ? Infinity : (now - born) / 1000, intro = age < ARRIVE + LOCK;
    if (full || now - last >= 1000 / 15){ // about 15fps: slow, stepped, and cheap
      last = now;
      render(ctx, grid, now / 1000 * CFG.speed, intro ? age : Infinity, root.getAttribute('data-theme') !== 'light', CFG, full, dpr);
      full = false;
    }
    if (intro || (CFG.motion > 0 && !still.matches)) raf = requestAnimationFrame(frame);
  }
  function draw(){
    image(CFG.vine, function(img){
      var H = innerHeight, dw = plantW(img, H, CFG);
      dpr = Math.min(2, devicePixelRatio || 1);
      var ox = CFG.x == null ? Math.round(-dw * 0.38) : +CFG.x, W = Math.max(1, Math.min(innerWidth, Math.ceil(dw + ox + 4)));
      cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      grid = cells(ctx, img, W, H, ox, CFG, dpr);
      if (born < 0) born = performance.now();
      if (raf) cancelAnimationFrame(raf);
      full = true; frame(performance.now());
    });
  }
  window.wordVine = {
    paint: function(ctx, img, W, H, ox, dark, opts, s){ var c = {}, k; for (k in CFG) c[k] = CFG[k]; for (k in opts) c[k] = opts[k]; render(ctx, cells(ctx, img, W, H, ox, c, 2), s || 0, Infinity, dark, c, true, 2); },
    intro: function(){ born = performance.now(); if (started) draw(); },
    set: function(opts){ for (var k in opts) CFG[k] = opts[k]; if (started) draw(); },
    config: CFG
  };

  if (document.currentScript && document.currentScript.hasAttribute('data-preview')) return;
  if (matchMedia('(max-width:1000px), (pointer:coarse)').matches) return;

  function start(){
    cv = document.createElement('canvas'); cv.id = 'word-vine'; cv.setAttribute('aria-hidden', 'true');
    ctx = cv.getContext('2d');
    var sky = document.getElementById('px-clouds') || document.getElementById('sky');
    (sky && sky.parentNode ? sky.parentNode : document.body).insertBefore(cv, sky ? sky.nextSibling : null);
    started = true; draw();
    addEventListener('resize', function(){ clearTimeout(t); t = setTimeout(draw, 150); });
    document.addEventListener('theme:change', draw);
  }
  // drawing it costs ~50ms: after an arriving page transition, not during it (Motion.astro)
  Promise.all([document.fonts && document.fonts.ready, window.afterPageChange]).then(start);
})();
