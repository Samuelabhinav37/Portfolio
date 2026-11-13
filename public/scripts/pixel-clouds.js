/* Pixel-art clouds over the WebGL sky (SiteSky.astro) and under the page, in
   both themes: the day art in light, the moonlit -night art in dark. The art is
   drawn by scripts/make-clouds.mjs into /images/clouds and shown at 2x with
   image-rendering:pixelated.

   Motion, after vega.io: each cloud sways sideways (+-60px at 8px/s), leans
   up to 6px toward the pointer, and moves slower than the page on scroll
   (bigger = nearer = faster), looping through two screens. The sway is a CSS
   animation (pxSway in SiteSky.astro), so nothing runs here while the page
   sits still: the script only places the clouds while you scroll or move the
   pointer. Reduced motion keeps them still. */
(function(){
  var root = document.documentElement;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var small = matchMedia('(max-width:900px)').matches;
  var SCALE = small ? 1 : 2;
  // [image, width, height (art px), left %, top % of the two-screen field, depth]
  var PLAN = [
    ['cloud-1', 260, 100, 72, 18, 0.3],
    ['cloud-3', 64, 34, 84, 82, 0.16],
    ['cloud-2', 220, 52, 30, 112, 0.22],
    ['cloud-5', 180, 22, 62, 156, 0.1]
  ];

  var layer, clouds = [], H = innerHeight, W = innerWidth;
  // the sway runs on the visit's clock (set by sky.js), so the clouds pick up
  // where they were on the last page instead of starting over
  var clock = null;
  try{ clock = JSON.parse(sessionStorage.getItem('sky-clock')); }catch(e){}
  var t0 = clock && clock.at > 0 ? clock.at : Date.now();
  function sway(c){ // a back-and-forth of +-60px at 8px/s
    var p = (((Date.now() - t0) / 1000 * 8 + c.phase) % 240 + 240) % 240;
    return p < 120 ? p - 60 : 180 - p;
  }
  var mx = 0, my = 0, tx = 0, ty = 0, raf = 0;

  function build(){
    layer = document.createElement('div');
    layer.id = 'px-clouds'; layer.setAttribute('aria-hidden', 'true');
    PLAN.forEach(function(p, i){
      var el = new Image(p[1] * SCALE, p[2] * SCALE);
      el.alt = ''; el.decoding = 'async'; el.className = 'pxc';
      layer.appendChild(el);
      var c = { el: el, name: p[0], x: p[3], y: p[4], w: p[1] * SCALE, depth: p[5], phase: i * 70 };
      c.drift = reduce ? sway(c) : 0; clouds.push(c); // moving: the CSS animation sways it, picked up at the visit's clock
      if(!reduce) el.style.animationDelay = (-(((Date.now() - t0) / 1000 + c.phase / 8) % 30)).toFixed(2) + 's';
    });
    var sky = document.getElementById('sky');
    (sky && sky.parentNode ? sky.parentNode : document.body).insertBefore(layer, sky ? sky.nextSibling : null);
  }

  function place(){
    var L = window.SITE && window.SITE.lenis;
    var sy = L ? L.scroll : scrollY, field = H * 2; // Lenis's own number when it drives the page: reading scrollY after the scroll effects have moved things makes the browser recalculate the whole page
    tx += (mx * 6 - tx) * 0.08; ty += (my * 6 - ty) * 0.08;
    for(var i = 0; i < clouds.length; i++){
      var c = clouds[i];
      var x = c.x / 100 * W + c.drift + tx - c.w / 2;
      var y = c.y / 100 * H - sy * c.depth + ty;
      y = (((y + H * 0.3) % field) + field) % field - H * 0.3; // loops, and may sit a little above the top

      c.el.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0)';
    }
  }

  function on(){ return !document.hidden; }
  function art(){
    var suffix = root.getAttribute('data-theme') === 'light' ? '' : '-night';
    for(var i = 0; i < clouds.length; i++){ var src = '/images/clouds/' + clouds[i].name + suffix + '.png'; if(clouds[i].el.getAttribute('src') !== src) clouds[i].el.src = src; }
  }
  function tick(){ // runs only until the lean toward the pointer has settled
    raf = 0; place();
    if(Math.abs(mx * 6 - tx) > 0.05 || Math.abs(my * 6 - ty) > 0.05) kick();
  }
  function kick(){ if(layer && !raf && on()) raf = requestAnimationFrame(tick); }
  function sync(){
    if(on() && !layer) build();
    if(!layer) return;
    art();
    kick();
  }

  addEventListener('resize', function(){ H = innerHeight; W = innerWidth; kick(); });
  addEventListener('scroll', kick, { passive: true });
  if(!small && !reduce) addEventListener('pointermove', function(e){ mx = e.clientX / W * 2 - 1; my = e.clientY / H * 2 - 1; kick(); }, { passive: true });
  document.addEventListener('visibilitychange', sync);
  document.addEventListener('theme:change', sync);
  sync();
})();
