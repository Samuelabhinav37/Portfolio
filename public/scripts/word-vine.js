/* A creeper of words up the left edge (SiteSky.astro), behind the page.
   After typographic plant posters: no strokes, the plant is only text.
   Stems are columns of short word fragments ("detec / tion"), wider at the
   foot; leaves are almond outlines filled row by row with overlapping words;
   side shoots, a few small flowers and curled tendrils. Drawn once into a
   fixed canvas (again on resize and theme change), grows up on load via a CSS
   clip. Hidden on narrow screens and touch. */
(function(){
  if (matchMedia('(max-width:1000px), (pointer:coarse)').matches) return;
  var root = document.documentElement;
  var FONT = "'Cormorant Garamond', Georgia, serif";
  var WORDS = ('detection and response quiet networks reading logs at night packets alerts triage ' +
    'signals in the noise threat hunting timelines evidence baseline anomaly honeypot telemetry ' +
    'beacons lateral movement patching trust nothing verify everything sandbox hashes entropy ' +
    'rules that fire incident notes coffee curiosity small tools careful hands open source ' +
    'keeping people safe learning every day').split(' ');
  var W = 220, cv, ctx, rnd, wi = 0, resizeT = 0;

  function rng(seed){ var s = seed | 0; return function(){ s = (s + 0x6D2B79F5) | 0; var t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function word(){ var w = WORDS[wi % WORDS.length]; wi++; return w; }
  // the next piece of the running text, at most n letters (words split as "detec", "tion")
  var rest = '';
  function frag(n){
    if (!rest) rest = word();
    var cut = rest.length <= n + 1 ? rest.length : n, f = rest.slice(0, cut);
    rest = rest.slice(cut); return f;
  }
  // AM, SZ: alpha and size of the layer being drawn (a dim, blurred, larger one behind the sharp one)
  var AM = 1, SZ = 1;
  function light(){ return root.getAttribute('data-theme') === 'light'; }
  // dark: a soft warm cream (the glow is set per layer); light: green ink
  function ink(a){ a = Math.min(1, a * AM); return light() ? 'rgba(34,58,40,' + a + ')' : 'rgba(222,212,168,' + (a * 0.85).toFixed(3) + ')'; }
  // every word a little bigger or smaller than its neighbours
  function text(s, x, y, size, a){
    ctx.font = (light() ? '500 ' : '400 ') + (size * SZ * (0.82 + rnd() * 0.36)).toFixed(1) + 'px ' + FONT;
    ctx.fillStyle = ink(a); ctx.fillText(s, x, y);
  }

  // a column of fragments along a path; n(t) = letters per piece, t from 0 (start) to 1
  function stem(pt, len, n, size){
    var step = size * 0.72;
    for (var d = 0; d <= len; d += step){
      var t = d / len, p = pt(t), f = frag(Math.max(1, Math.round(n(t))));
      ctx.font = '500 ' + size + 'px ' + FONT;
      text(f, p[0] - ctx.measureText(f).width / 2, p[1], size, 0.6 + rnd() * 0.3);
    }
  }

  // an almond leaf from (x, y) along angle a: rows of overlapping words inside its outline
  function leaf(x, y, a, len, wid){
    var size = 10 + rnd() * 2, step = size * 0.68, ca = Math.cos(a), sa = Math.sin(a);
    var inside = function(px, py){
      var dx = px - x, dy = py - y, u = dx * ca + dy * sa, v = -dx * sa + dy * ca;
      if (u < 0 || u > len) return false;
      return Math.abs(v) <= wid * Math.pow(Math.sin(Math.PI * u / len), 0.8) * (u < len * 0.5 ? 0.85 : 1);
    };
    var tipX = x + ca * len, tipY = y + sa * len, r = wid + 2;
    var x0 = Math.min(x, tipX) - r, x1 = Math.max(x, tipX) + r, y0 = Math.min(y, tipY) - r, y1 = Math.max(y, tipY) + r;
    ctx.font = '500 ' + size + 'px ' + FONT;
    for (var yy = y0; yy <= y1; yy += step){
      var a0 = null, b0 = null;
      for (var xx = x0; xx <= x1; xx += 1) if (inside(xx, yy)) { if (a0 === null) a0 = xx; b0 = xx; }
      if (a0 === null) continue;
      var cx = a0 - rnd() * 3;
      while (cx < b0){
        var span = b0 - cx, w = word(), mw = ctx.measureText(w).width;
        if (mw > span + 4){ var keep = Math.max(1, Math.floor(w.length * (span + 4) / mw)); w = w.slice(0, keep); mw = ctx.measureText(w).width; }
        // brighter toward the tip
        var uu = ((cx - x) * ca + (yy - y) * sa) / len;
        text(w, cx, yy, size, 0.3 + uu * 0.35 + rnd() * 0.3);
        cx += mw * (0.7 + rnd() * 0.2) + 1;
      }
    }
    // a vein of short fragments down the middle
    for (var d = 3; d < len * 0.85; d += size * 0.6) text(frag(2), x + ca * d - 3, y + sa * d, size * 0.8, 0.95);
  }

  // a small flower: five word petals around a knot of short fragments
  function flower(x, y, s){
    var turn = rnd() * Math.PI;
    for (var k = 0; k < 5; k++) leaf(x, y, turn + k * Math.PI * 2 / 5, s, s * 0.32);
    for (var j = 0; j < 4; j++) text(frag(3), x - 6 + rnd() * 4, y - 3 + j * 4, 9, 0.9);
  }

  // a tendril: single letters on a tightening spiral
  function tendril(x, y, dir){
    var ang = -Math.PI / 2, r = 16;
    for (var k = 0; k < 22; k++){
      x += Math.cos(ang) * 5; y += Math.sin(ang) * 5;
      text(frag(1), x, y, 9, 0.75); ang += dir * (0.25 + k * 0.02); r *= 0.95;
    }
  }

  function draw(){
    var H = innerHeight, dpr = Math.min(2, devicePixelRatio || 1);
    cv.width = W * dpr; cv.height = H * dpr; cv.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H); ctx.textBaseline = 'middle';
    // the back layer: bigger, dimmer and out of focus, a little further left
    ctx.save(); if ('filter' in ctx) ctx.filter = 'blur(1.6px)';
    AM = light() ? 0.3 : 0.32; SZ = 1.3; plant(H, -18, 23, 1.25); ctx.restore();
    // the front layer, sharp; in the dark a faint glow round the letters
    ctx.save(); if (!light()){ ctx.shadowColor = 'rgba(230,214,150,.35)'; ctx.shadowBlur = 6; }
    AM = 1; SZ = 1; plant(H, 12, 11, 1); ctx.restore();
  }

  // the creeper itself; ox = how far in from the edge the stem stands, k = scale of its leaves
  function plant(H, ox, seed, k){
    rnd = rng(seed); wi = seed; rest = '';
    var sx = function(y){ return ox + 12 * Math.sin(y / 170) + 6 * Math.sin(y / 61 + 1); };
    // main stem, bottom to top, 4 letters wide at the foot thinning to 1
    stem(function(t){ var y = H + 10 - t * (H - 70); return [sx(y), y]; }, H - 70, function(t){ return 4 - t * 3; }, 12);
    // a second, thinner stem winding round the first for the lower two thirds
    stem(function(t){ var y = H + 10 - t * H * 0.66; return [sx(y) + 10 * Math.sin(y / 38), y]; }, H * 0.66, function(t){ return 2 - t; }, 11);
    // side shoots, alternating right and left, each ending in a leaf; some carry a flower or a tendril
    // small leaflets all the way up, alternating sides
    for (var ly = H - 20, ls = 1; ly > 110; ly -= 26 + rnd() * 18, ls = -ls)
      leaf(sx(ly), ly, ls > 0 ? -0.6 - rnd() * 0.5 : -Math.PI + 0.5 + rnd() * 0.5, (14 + rnd() * 10) * k, (4 + rnd() * 2) * k);
    // side shoots, mostly to the right now the stem stands at the edge
    var side = 1, n = 0;
    for (var y = H - 60; y > 170; y -= (60 + rnd() * 40) * k, n++, side = n % 3 === 2 ? -1 : 1){
      var bx = sx(y), dirA = side > 0 ? -0.5 - rnd() * 0.5 : -Math.PI + 0.6 + rnd() * 0.4;
      var blen = side > 0 ? 30 + rnd() * 40 : 10 + rnd() * 10;
      var ex = bx + Math.cos(dirA) * blen, ey = y + Math.sin(dirA) * blen;
      stem(function(t){ return [bx + (ex - bx) * t, y + (ey - y) * t - Math.sin(Math.PI * t) * 8]; }, blen, function(){ return 1.5; }, 10);
      leaf(ex, ey, dirA + (rnd() - 0.5) * 0.6, side > 0 ? 64 + rnd() * 40 : 40 + rnd() * 16, side > 0 ? 16 + rnd() * 8 : 11);
      if (side > 0) leaf(bx + (ex - bx) * 0.5, y + (ey - y) * 0.5, dirA - 0.9, 34 + rnd() * 14, 9 + rnd() * 3);
      // a second leaf straight off the main stem
      leaf(bx, y + 22, side > 0 ? -Math.PI + 0.9 : -0.8, 34 + rnd() * 20, 9 + rnd() * 4);
      if (side > 0 && n % 4 === 1) flower(ex + 20, ey - 34, 24 + rnd() * 8);
      else if (n % 4 === 3) tendril(ex + 4, ey - 10, 1);
    }
  }

  function start(){
    cv = document.createElement('canvas'); cv.id = 'word-vine'; cv.setAttribute('aria-hidden', 'true');
    cv.style.width = W + 'px'; ctx = cv.getContext('2d');
    var sky = document.getElementById('px-clouds') || document.getElementById('sky');
    (sky && sky.parentNode ? sky.parentNode : document.body).insertBefore(cv, sky ? sky.nextSibling : null);
    draw();
    addEventListener('resize', function(){ clearTimeout(resizeT); resizeT = setTimeout(draw, 150); });
    document.addEventListener('theme:change', draw);
  }
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(start);
})();
