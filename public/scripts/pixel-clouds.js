/* Three pixel-art clouds for the day sky (SiteSky.astro), over the WebGL sky
   and under the page. The art is drawn by scripts/make-clouds.mjs into
   /images/clouds and shown at 2x with image-rendering:pixelated.

   Motion, after vega.io: each cloud sways sideways (+-60px at 8px/s), leans
   up to 6px toward the pointer, and moves slower than the page on scroll
   (bigger = nearer = faster), looping through two screens. The loop only
   runs in the light theme while the tab is visible; reduced motion keeps
   them still. */
(function(){
  var root = document.documentElement;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var small = matchMedia('(max-width:900px)').matches;
  var SCALE = small ? 1 : 2;
  // [image, width, height (art px), left %, top % of the two-screen field, depth]
  var PLAN = [
    ['cloud-1', 220, 70, 74, 20, 0.3],
    ['cloud-3', 104, 36, 14, 52, 0.14],
    ['cloud-2', 140, 46, 30, 124, 0.22]
  ];

  var layer, clouds = [], H = innerHeight, W = innerWidth;
  var mx = 0, my = 0, tx = 0, ty = 0, last = 0, raf = 0;

  function build(){
    layer = document.createElement('div');
    layer.id = 'px-clouds'; layer.setAttribute('aria-hidden', 'true');
    PLAN.forEach(function(p, i){
      var el = new Image(p[1] * SCALE, p[2] * SCALE);
      el.src = '/images/clouds/' + p[0] + '.png'; el.alt = ''; el.decoding = 'async'; el.className = 'pxc';
      layer.appendChild(el);
      clouds.push({ el: el, x: p[3], y: p[4], w: p[1] * SCALE, depth: p[5], drift: (i - 1) * 40, dir: i % 2 ? 1 : -1 });
    });
    var sky = document.getElementById('sky');
    (sky && sky.parentNode ? sky.parentNode : document.body).insertBefore(layer, sky ? sky.nextSibling : null);
  }

  function place(dt){
    var sy = scrollY, field = H * 2;
    tx += (mx * 6 - tx) * 0.08; ty += (my * 6 - ty) * 0.08;
    for(var i = 0; i < clouds.length; i++){
      var c = clouds[i];
      if(dt){ c.drift += c.dir * 8 * dt; if(c.drift > 60 || c.drift < -60){ c.dir = -c.dir; c.drift = Math.max(-60, Math.min(60, c.drift)); } }
      var x = c.x / 100 * W + c.drift + tx - c.w / 2;
      var y = c.y / 100 * H - sy * c.depth + ty;
      y = (((y + H * 0.3) % field) + field) % field - H * 0.3; // loops, and may sit a little above the top

      c.el.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0)';
    }
  }

  function on(){ return root.getAttribute('data-theme') === 'light' && !document.hidden; }
  function tick(t){
    var dt = last ? Math.min((t - last) / 1000, 0.05) : 0; last = t;
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
