/* Contact page window-stack (loading, depth, motion for the floating video cards). Extracted from an inline <script> block, unmodified. */
(function(){
  "use strict";
  /* ══════════ WINDOW STACK: loading, depth, motion ══════════
     Three jobs, all of them things the naive version got wrong.

     1. TRUE LAZY LOADING.  The clips are real files with preload="none" and
        NO src attribute — the browser fetches nothing until we hand it one.
        Previously they were base64 data URIs, which meant every visitor
        downloaded ~780KB of video inside the HTML whether they ever saw a
        card or not, and none of it could be cached separately from the page.
        A poster frame (~5KB) paints instantly as the card background, so a
        window is never an empty black rectangle.

     2. COMPOSITOR-ONLY MOTION.  Hover animates transform and opacity only.
        The resting and hover shadows are two static layers; we cross-fade
        their opacity instead of transitioning box-shadow, which is a paint
        operation and janks badly across eight overlapping cards.

     3. POINTER PARALLAX.  Each card carries a data-depth; the pointer offsets
        it proportionally, so the cluster resolves into real space instead of
        a flat pile. Lerped toward the target every frame — no easing library,
        no per-event layout. */

  var stack = document.querySelector('.stack');
  if(!stack) return;
  var cards = Array.prototype.slice.call(stack.querySelectorAll('.card'));
  var vids  = Array.prototype.slice.call(stack.querySelectorAll('video.clip'));
  var RM    = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var FINE  = matchMedia('(pointer: fine)').matches;
  var NARROW= matchMedia('(max-width: 1000px)').matches;

  /* ── posters first: instant paint, ~5KB each ── */
  vids.forEach(function(v){
    if(v.dataset.poster) v.style.backgroundImage = 'url(' + v.dataset.poster + ')';
  });

  /* ── entrance: reveal once the first poster is decoded, so the stack
        assembles onto something rather than onto nothing ── */
  var revealed = false;
  function reveal(){
    if(revealed) return;                 /* the poster race and the 900ms
                                            safety net both call this */
    revealed = true;
    requestAnimationFrame(function(){ stack.classList.add('ready'); });
  }
  var first = vids[0] && vids[0].dataset.poster;
  if(first){
    var img = new Image();
    img.onload = img.onerror = reveal;
    img.src = first;
    setTimeout(reveal, 900);           /* never let a slow poster hold the page hostage */
  } else { reveal(); }

  /* ── lazy load + decode budget: a card only fetches when it is on screen,
        and only decodes while it stays there ── */
  function activate(v){
    if(!v.src && v.dataset.src){ v.src = v.dataset.src; v.load(); }
    if(!RM){
      var p = v.play();
      if(p && p.catch) p.catch(function(){
        var resume = function(){ v.play().catch(function(){}); document.removeEventListener('pointerdown', resume); };
        document.addEventListener('pointerdown', resume);
      });
    } else if(!v.dataset.held){
      v.dataset.held = '1';
      v.addEventListener('loadeddata', function(){ v.currentTime = 1; v.pause(); }, {once:true});
    }
  }

  /* Remember which clips are actually on screen. The old visibilitychange
     handler restarted EVERY loaded video on tab-return, including the ones the
     observer had deliberately paused off-screen — which quietly undid the whole
     decode budget the observer exists to enforce. */
  if('IntersectionObserver' in window){
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        e.target.dataset.onscreen = e.isIntersecting ? '1' : '';
        if(e.isIntersecting) activate(e.target);
        else e.target.pause();
      });
    }, { threshold:0.05, rootMargin:'200px' });   /* fetch just before it lands */
    vids.forEach(function(v){ io.observe(v); });
  } else {
    vids.forEach(function(v){ v.dataset.onscreen = '1'; activate(v); });
  }

  document.addEventListener('visibilitychange', function(){
    vids.forEach(function(v){
      if(document.hidden) v.pause();
      else if(!RM && v.src && v.dataset.onscreen) v.play().catch(function(){});
    });
  });

  /* ── pointer parallax ── */
  if(RM || !FINE || NARROW) return;

  var tx = 0, ty = 0, cx = 0, cy = 0, raf = null;
  var AMP = 26;                                   /* px of travel at depth 1.0 */

  window.addEventListener('pointermove', function(e){
    var r = stack.getBoundingClientRect();
    tx = ((e.clientX - (r.left + r.width  / 2)) / (r.width  / 2)) || 0;
    ty = ((e.clientY - (r.top  + r.height / 2)) / (r.height / 2)) || 0;
    tx = Math.max(-1, Math.min(1, tx));
    ty = Math.max(-1, Math.min(1, ty));
    if(!raf) raf = requestAnimationFrame(tick);
  }, { passive:true });

  function tick(){
    raf = null;
    cx += (tx - cx) * 0.075;                      /* lerp — the whole trick */
    cy += (ty - cy) * 0.075;
    for(var i = 0; i < cards.length; i++){
      var d = parseFloat(cards[i].dataset.depth) || 0.5;
      cards[i].style.transform =
        'translate3d(' + (-cx * AMP * d).toFixed(2) + 'px,' +
                         (-cy * AMP * d).toFixed(2) + 'px,0)';
    }
    if(Math.abs(tx - cx) > 0.001 || Math.abs(ty - cy) > 0.001) raf = requestAnimationFrame(tick);
  }

  /* Let the stack drift back to rest when the pointer leaves.
     This was bound to `document`, which is not an element and never receives
     pointerleave — the cluster stayed frozen wherever the cursor last was.
     documentElement does fire it; window.blur covers alt-tab. */
  function rest(){ tx = 0; ty = 0; if(!raf) raf = requestAnimationFrame(tick); }
  document.documentElement.addEventListener('pointerleave', rest);
  window.addEventListener('blur', rest);
})();
