/* The beliefs hologram's glitches, and the broken-screen roll on the empty
   project frames.
   - Decoding words: as each word of the statement lights up (motion.js
     adds .lit), it shows as scrambled glyphs for a moment, then settles.
   - Signal drops: every 8-15s while the beliefs are on screen, red and
     cyan copies of the statement slip sideways in thin bands for a few
     frames, the way the contact card glitches.
   - The "Image coming soon" frames play the contact page's wreck video
     at half speed, only while on screen.
   All of it is skipped for reduced motion. */
(function(){
  if(matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var rnd = function(a, b){ return a + Math.random() * (b - a); };
  var GLYPHS = '0123456789ABCDEF#%&@$/<>=+*';

  var st = document.querySelector('#beliefs .ed-statement');
  var decode = function(w){
    if(w.dataset.dec) return;
    var t = w.dataset.t || (w.dataset.t = w.textContent);
    w.dataset.dec = '1';
    w.style.width = w.offsetWidth + 'px';   // glyphs are a different width: keep the line from shifting
    var f = 0, N = 6;
    var step = function(){
      if(++f > N){ w.textContent = t; w.style.width = ''; delete w.dataset.dec; return; }
      var keep = Math.floor(t.length * f / N);   // resolves left to right
      w.textContent = t.slice(0, keep) + t.slice(keep).replace(/\S/g, function(){ return GLYPHS[Math.floor(Math.random() * GLYPHS.length)]; });
      setTimeout(step, 45);
    };
    step();
  };

  if(st){
    new MutationObserver(function(list){
      list.forEach(function(m){
        var w = m.target;
        if(w.classList.contains('lit-w') && w.classList.contains('lit') && !/(^|\s)lit(\s|$)/.test(m.oldValue || '')) decode(w);
      });
    }).observe(st, { subtree:true, attributes:true, attributeFilter:['class'], attributeOldValue:true });

    var body = st.parentNode, inView = false, timer = 0;
    var ghost = function(tint){
      var g = st.cloneNode(true);
      g.classList.add('ed-ghost');
      g.setAttribute('aria-hidden', 'true');
      g.removeAttribute('aria-label');
      g.style.cssText = 'position:absolute;margin:0;left:' + st.offsetLeft + 'px;top:' + st.offsetTop + 'px;width:' + st.offsetWidth + 'px;--lit-on:' + tint + ';--lit-off:' + tint.replace(/[\d.]+\)$/, '.1)') + ';';
      body.appendChild(g);
      return g;
    };
    var glitch = function(){
      var a = ghost('rgba(255,70,200,.75)'), b = ghost('rgba(70,190,255,.8)'), f = 0, n = Math.round(rnd(4, 7));
      var lit = st.querySelectorAll('.lit-w.lit');
      for(var k = 0; k < 2 && lit.length; k++) decode(lit[Math.floor(Math.random() * lit.length)]);
      var frame = function(){
        if(++f > n){ a.remove(); b.remove(); st.style.transform = ''; return; }
        [a, b].forEach(function(g, i){
          var top = rnd(0, 80), h = rnd(8, 30);
          g.style.clipPath = 'inset(' + top + '% 0 ' + Math.max(0, 100 - top - h) + '% 0)';
          g.style.transform = 'translateX(' + (i ? -1 : 1) * rnd(6, 22) + 'px)';
        });
        st.style.transform = 'translateX(' + rnd(-3, 3) + 'px)';
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
  }

  var vids = document.querySelectorAll('.pw-wreck');
  if(vids.length){
    var io = new IntersectionObserver(function(es){
      es.forEach(function(e){
        var v = e.target;
        v.dataset.on = e.isIntersecting ? '1' : '';
        if(e.isIntersecting && !document.hidden){ var q = v.play(); if(q && q.catch) q.catch(function(){}); }
        else v.pause();
      });
    }, { rootMargin:'100px' });
    vids.forEach(function(v){
      v.addEventListener('loadedmetadata', function(){ v.currentTime = rnd(0, v.duration || 10); }, { once:true });
      v.playbackRate = v.defaultPlaybackRate = 0.5;   // a slow drift, not a jitter
      io.observe(v);
    });
    document.addEventListener('visibilitychange', function(){ vids.forEach(function(v){
        if(document.hidden) v.pause(); else if(v.dataset.on){ var q = v.play(); if(q && q.catch) q.catch(function(){}); }
      });
    });
  }
})();
