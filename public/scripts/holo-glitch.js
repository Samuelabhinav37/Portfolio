/* Signal drops for the white holograms (the homepage beliefs, the blog
   index title): every 8-15s while one is on screen, red and cyan copies
   of it slip sideways in thin bands for a few frames, the way the contact
   card glitches. Mark an element with data-holo-glitch; its offsetParent
   must be positioned, since the copies are placed against it.
   Skipped for reduced motion. */
(function(){
  if(matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var rnd = function(a, b){ return a + Math.random() * (b - a); };

  document.querySelectorAll('[data-holo-glitch]').forEach(function(st){
    var inView = false, timer = 0;
    var ghost = function(tint){
      var g = st.cloneNode(true);
      g.removeAttribute('id');
      g.removeAttribute('data-holo-glitch');
      g.removeAttribute('aria-label');
      g.setAttribute('aria-hidden', 'true');
      g.style.cssText = 'position:absolute;margin:0;pointer-events:none;visibility:visible;filter:none;animation:none;-webkit-mask:none;mask:none;' +
        'left:' + st.offsetLeft + 'px;top:' + st.offsetTop + 'px;width:' + st.offsetWidth + 'px;' +
        'color:' + tint + ';--lit-on:' + tint + ';--lit-off:' + tint.replace(/[\d.]+\)$/, '.1)') + ';';
      g.classList.add('holo-ghost');
      (st.offsetParent || st.parentNode).appendChild(g);
      return g;
    };
    var glitch = function(){
      var a = ghost('rgba(255,70,200,.75)'), b = ghost('rgba(70,190,255,.8)'), f = 0, n = Math.round(rnd(4, 7));
      var frame = function(){
        if(++f > n){ a.remove(); b.remove(); st.style.translate = ''; return; }
        [a, b].forEach(function(g, i){
          var top = rnd(0, 80), h = rnd(8, 30);
          g.style.clipPath = 'inset(' + top + '% 0 ' + Math.max(0, 100 - top - h) + '% 0)';
          g.style.transform = 'translateX(' + (i ? -1 : 1) * rnd(6, 22) + 'px)';
        });
        st.style.translate = rnd(-3, 3) + 'px 0';   // translate, not transform: the element may already animate its transform
        setTimeout(frame, rnd(70, 120));
      };
      frame();
    };
    var idle = function(){
      clearTimeout(timer);
      timer = setTimeout(function(){ if(inView && !document.hidden) glitch(); idle(); }, rnd(8000, 15000));
    };
    new IntersectionObserver(function(e){ inView = e[0].isIntersecting; }).observe(st);
    idle();
  });
})();
