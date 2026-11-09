/* Pixel-art clouds for the day sky (SiteSky.astro), drawn over the WebGL
   sky and under the page. Each cloud is a tiny canvas, painted here from
   overlapping puffs and a 4-colour palette, then scaled up with
   image-rendering:pixelated so the pixels stay crisp.

   Motion, after vega.io: each cloud sways sideways (+-60px at 8px/s), leans
   a few px toward the pointer, and moves slower than the page on scroll
   (bigger = nearer = faster). The "hero" clouds in the first screen also
   part sideways over the first 1200px of scroll. The loop only runs in the
   light theme while the tab is visible; reduced motion keeps them still. */
(function(){
  var root = document.documentElement;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var small = matchMedia('(max-width:900px)').matches;
  var SCALE = small ? 2 : 3;
  // white top, two blue-greys, the shadowed underside: picked against #8fb0e0
  var PAL = ['#ffffff', '#eaf1fb', '#cddcf1', '#aec4e6'];

  // seeded so the clouds look the same on every visit
  var seed = 7;
  function rnd(){ seed = (seed + 0x6D2B79F5) | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }

  // one cloud: puffs along a flat base, shaded from the top left, dithered between shades
  function paint(w){
    var h = Math.round(w * 0.34), base = h - 2, puffs = [], n = 3 + Math.round(w / 22);
    for(var i = 0; i < n; i++){
      var t = (i + 0.5) / n, mid = 1 - Math.abs(t - 0.5) * 2; // taller in the middle
      var r = (h * 0.28 + h * 0.42 * mid) * (0.75 + rnd() * 0.45);
      r = Math.min(r, (base - 1) / 1.55, w * 0.3); // keep each puff inside the canvas, top and sides
      var px = w * (0.08 + t * 0.84) + (rnd() - 0.5) * w * 0.06;
      puffs.push({ x: Math.max(r + 1, Math.min(w - r - 1, px)), y: base - r * 0.55, r: r });
    }
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    var g = c.getContext('2d'), img = g.createImageData(w, h);
    var cols = PAL.map(function(hex){ return [1, 3, 5].map(function(k){ return parseInt(hex.substr(k, 2), 16); }); });
    // a height field (each puff a half sphere), lit from its slope: smoother than per-puff shading
    var Hf = new Float32Array(w * h);
    for(var y = 0; y < h; y++) for(var x = 0; x < w; x++){
      var top = 0;
      for(var p = 0; p < puffs.length; p++){
        var P = puffs[p], dx = x + 0.5 - P.x, dy = y + 0.5 - P.y, q = P.r * P.r - dx * dx - dy * dy;
        if(q > 0) top = Math.max(top, Math.sqrt(q));
      }
      if(!top && y >= base - 3 && y <= base && x > w * 0.1 && x < w * 0.9) top = 0.5;
      Hf[y * w + x] = top;
    }
    var at = function(x, y){ return x < 0 || y < 0 || x >= w || y >= h ? 0 : Hf[y * w + x]; };
    for(var y = 0; y < h; y++) for(var x = 0; x < w; x++){
      if(!Hf[y * w + x]) continue;
      // brighter where the surface faces up and left; the bottom rows sit in shadow
      var gx = at(x + 1, y) - at(x - 1, y), gy = at(x, y + 1) - at(x, y - 1);
      var light = (gx * 0.5 + gy * 0.85) / 2 + (base - y) / h * 0.9 - 0.25;
      var shade = light > 0.35 ? 0 : light > 0.05 ? 1 : light > -0.2 ? 2 : 3;
      if(y >= base - 1) shade = 3;
      // one checker row where two shades meet
      var lim = [0.35, 0.05, -0.2][Math.min(shade, 2)];
      if(shade < 3 && light - lim < 0.04 && (x + y) % 2) shade++;
      var o = (y * w + x) * 4, col = cols[shade];
      img.data[o] = col[0]; img.data[o + 1] = col[1]; img.data[o + 2] = col[2]; img.data[o + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    c.className = 'pxc';
    c.style.width = w * SCALE + 'px'; c.style.height = h * SCALE + 'px';
    return c;
  }

  var layer, clouds = [], H = innerHeight, W = innerWidth;
  var mx = 0, my = 0, tx = 0, ty = 0, last = 0, raf = 0;
  // [sprite width, left %, top % of the field, hero, flip]; heroes sit in the first screen
  var PLAN = [
    [64, 8, 14, 1, 0], [40, 30, 8, 1, 1], [96, 78, 18, 1, 0], [52, 58, 34, 1, 1], [36, 92, 46, 1, 0], [72, 20, 52, 1, 1],
    [44, 64, 70, 0, 0], [110, 12, 88, 0, 1], [56, 86, 104, 0, 0], [40, 44, 120, 0, 1],
    [80, 70, 140, 0, 1], [48, 6, 160, 0, 0], [64, 40, 178, 0, 0]
  ];
  if(small) PLAN = PLAN.filter(function(_, i){ return i % 2 === 0; });

  function build(){
    layer = document.createElement('div');
    layer.id = 'px-clouds'; layer.setAttribute('aria-hidden', 'true');
    PLAN.forEach(function(p){
      var el = paint(p[0]);
      if(p[4]) el.style.scale = '-1 1';
      layer.appendChild(el);
      clouds.push({ el: el, x: p[1], y: p[2], hero: !!p[3], w: p[0] * SCALE,
        depth: 0.12 + (p[0] / 110) * 0.3, drift: (rnd() - 0.5) * 120, dir: rnd() < 0.5 ? -1 : 1 });
    });
    var sky = document.getElementById('sky');
    (sky && sky.parentNode ? sky.parentNode : document.body).insertBefore(layer, sky ? sky.nextSibling : null);
  }

  function place(dt){
    var sy = scrollY, part = Math.min(sy / 1200, 1), field = H * 2; // non-hero clouds loop through two screens
    tx += (mx - tx) * 0.08; ty += (my - ty) * 0.08;
    for(var i = 0; i < clouds.length; i++){
      var c = clouds[i];
      if(dt){ c.drift += c.dir * 8 * dt; if(c.drift > 60 || c.drift < -60){ c.dir = -c.dir; c.drift = Math.max(-60, Math.min(60, c.drift)); } }
      var x = c.x / 100 * W + c.drift + tx * 6 * c.depth * 3;
      var y = c.y / 100 * H - sy * c.depth + ty * 6 * c.depth * 3;
      if(c.hero) x += (c.x < 50 ? -1 : 1) * part * 300 * c.depth * 2.5;
      else y = ((y % field) + field) % field - H * 0.25;
      c.el.style.transform = 'translate3d(' + (x - c.w / 2).toFixed(1) + 'px,' + y.toFixed(1) + 'px,0)';
    }
  }

  function on(){ return root.getAttribute('data-theme') === 'light' && !document.hidden; }
  function tick(t){
    var dt = last ? Math.min((t - last) / 1000, 0.1) : 0; last = t;
    place(dt); raf = requestAnimationFrame(tick);
  }
  function sync(){
    if(on() && !layer) build();
    if(!layer) return;
    if(on() && !reduce){ if(!raf){ last = 0; raf = requestAnimationFrame(tick); } }
    else { cancelAnimationFrame(raf); raf = 0; if(on()) place(0); }
  }

  addEventListener('resize', function(){ H = innerHeight; W = innerWidth; if(layer && !raf) place(0); });
  if(reduce) addEventListener('scroll', function(){ if(layer && on()) place(0); }, { passive: true });
  if(!small) addEventListener('pointermove', function(e){ mx = e.clientX / W * 2 - 1; my = e.clientY / H * 2 - 1; }, { passive: true });
  document.addEventListener('visibilitychange', sync);
  document.addEventListener('theme:change', sync);
  sync();
})();
