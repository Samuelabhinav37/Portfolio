/* "Recent writing" reel: the post cards drift left in an endless loop, very
   slowly. Drag or swipe sideways to move it; it eases back to speed after.
   Hover or keyboard focus pauses it, reduced-motion keeps it still, and it
   only animates while on screen. */
(function(){
  "use strict";
  var reel = document.querySelector('#writing .wr-reel');
  if(!reel) return;
  var track = reel.querySelector('.wr-track');
  var originals = [].slice.call(track.children);
  if(!originals.length) return;

  var SPEED = 14; // px per second
  var still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var setW = 0, pos = 0, v = 1, target = 1;
  var onScreen = false, raf = 0, last = 0;
  var drag = null, moved = false;

  // Width of one full set of cards, plus enough copies to cover the screen
  function measure(){
    track.querySelectorAll('[data-clone]').forEach(function(n){ n.remove(); });
    var gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    var end = originals[originals.length - 1];
    setW = end.offsetLeft + end.offsetWidth + gap - originals[0].offsetLeft;
    var frag = document.createDocumentFragment();
    for(var i = 0; i < Math.ceil(reel.clientWidth / setW) + 1; i++){
      originals.forEach(function(n){
        var c = n.cloneNode(true);
        c.setAttribute('data-clone', '');
        c.setAttribute('aria-hidden', 'true');
        c.tabIndex = -1;
        frag.appendChild(c);
      });
    }
    track.appendChild(frag);
  }
  function wrap(){
    while(pos <= -setW) pos += setW;
    while(pos > 0) pos -= setW;
  }
  function apply(){ track.style.transform = 'translate3d(' + pos + 'px,0,0)'; }

  function frame(t){
    var dt = Math.max(0, Math.min((t - last) / 1000, 0.05));
    last = t;
    v += (target - v) * (1 - Math.exp(-dt / 0.35));
    if(!drag){ pos -= SPEED * v * dt; wrap(); apply(); }
    raf = onScreen && !document.hidden ? requestAnimationFrame(frame) : 0;
  }
  function start(){
    if(still || raf || !onScreen || document.hidden) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  measure();
  new IntersectionObserver(function(es){ onScreen = es[0].isIntersecting; start(); }).observe(reel);
  document.addEventListener('visibilitychange', start);
  var resizeQueued = false;
  addEventListener('resize', function(){
    if(resizeQueued) return;
    resizeQueued = true;
    requestAnimationFrame(function(){ resizeQueued = false; measure(); wrap(); apply(); });
  });

  reel.addEventListener('pointerenter', function(e){ if(e.pointerType === 'mouse') target = 0; });
  reel.addEventListener('pointerleave', function(e){ if(e.pointerType === 'mouse') target = 1; });
  reel.addEventListener('focusin', function(e){
    target = 0;
    var card = e.target.closest('.fn-tile');
    if(!card) return;
    var r = card.getBoundingClientRect(), box = reel.getBoundingClientRect();
    if(r.left < box.left || r.right > box.right){
      pos += box.left + (parseFloat(getComputedStyle(track).paddingLeft) || 0) - r.left;
      wrap(); apply();
    }
  });
  reel.addEventListener('focusout', function(){ target = 1; });

  reel.addEventListener('pointerdown', function(e){
    if(e.button !== 0) return;
    drag = { x: e.clientX, pos: pos, id: e.pointerId };
    moved = false;
  });
  addEventListener('pointermove', function(e){
    if(!drag || e.pointerId !== drag.id) return;
    var dx = e.clientX - drag.x;
    if(!moved && Math.abs(dx) > 6){
      moved = true;
      reel.setPointerCapture(drag.id);
      reel.classList.add('is-drag');
    }
    if(moved){ pos = drag.pos + dx; wrap(); apply(); }
  });
  function endDrag(){
    if(!drag) return;
    drag = null;
    reel.classList.remove('is-drag');
    v = 0; // ease back up to speed rather than snapping
  }
  addEventListener('pointerup', endDrag);
  addEventListener('pointercancel', endDrag);
  // Links and images would start a native drag and cancel ours
  reel.addEventListener('dragstart', function(e){ e.preventDefault(); });
  // A drag that ends over a card must not open it
  reel.addEventListener('click', function(e){
    if(moved){ e.preventDefault(); e.stopPropagation(); moved = false; }
  }, true);

  // Sideways trackpad swipes move the reel; vertical scrolling passes through
  reel.addEventListener('wheel', function(e){
    if(Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
    e.preventDefault();
    pos -= e.deltaX; wrap(); apply();
    v = 0;
  }, { passive: false });
})();
