/* "Recent writing" reel: the post cards drift left in an endless loop, very
   slowly. Speed model after 4wide.jp's work strip: scrolling the page pushes
   the reel along (backwards when you scroll up) and the push glides out,
   most of it gone within a second; a drag throws it the same way. The cards
   lean a little with the speed. A mouse over the reel slows it to a crawl,
   keyboard focus stops it, reduced-motion keeps it still, and it only
   animates while on screen. */
(window.onPage || function (f) { f(new AbortController().signal); })(function (signal) {
  "use strict";
  var reel = document.querySelector('#writing .wr-reel');
  if(!reel) return;
  var track = reel.querySelector('.wr-track');
  var originals = [].slice.call(track.children);
  if(!originals.length) return;

  var SPEED = 14;     // px a second when left alone
  var PUSH = 3;       // px/s added per px the page scrolls: a steady scroll moves the reel about as fast as the page
  var MAX = 2000;     // px/s cap on the push
  var FRICTION = 3;   // the push fades as e^(-3t): ~95% gone in a second
  var HOVER = 0.15;   // share of SPEED under a mouse
  var LEAN = 3;       // deg the cards lean at full speed...
  var FULL = 1500;    // ...which is this many px/s
  var still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var setW = 0, pos = 0, scale = 1, target = 1, vel = 0, lean = 0, lastY = 0;
  var onScreen = false, raf = 0, last = 0;
  var drag = null, moved = false;
  function clamp(n, m){ return Math.max(-m, Math.min(m, n)); }

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
  function apply(){ track.style.transform = 'translate3d(' + pos + 'px,0,0) skewX(' + lean.toFixed(2) + 'deg)'; }

  function frame(t){
    var dt = Math.max(0, Math.min((t - last) / 1000, 0.05));
    last = t;
    scale += (target - scale) * (1 - Math.exp(-4 * dt));
    var y = window.scrollY, dy = y - lastY;
    lastY = y;
    if(!drag){
      if(dy) vel = clamp(vel + dy * PUSH, MAX);
      vel *= Math.exp(-FRICTION * dt);
      pos -= (SPEED * scale + vel) * dt;
      wrap();
    }
    var speed = drag ? drag.v : SPEED * scale + vel;
    lean += (clamp(speed / FULL, 1) * LEAN - lean) * (1 - Math.exp(-6 * dt));
    apply();
    raf = onScreen && !document.hidden ? requestAnimationFrame(frame) : 0;
  }
  function start(){
    if(still || raf || !onScreen || document.hidden) return;
    last = performance.now();
    lastY = window.scrollY; // scrolling done while the reel was away doesn't count
    raf = requestAnimationFrame(frame);
  }

  measure();
  var io = new IntersectionObserver(function(es){ onScreen = es[0].isIntersecting; start(); });
  io.observe(reel);
  signal.addEventListener('abort', function(){ io.disconnect(); onScreen = false; cancelAnimationFrame(raf); raf = 0; });
  document.addEventListener('visibilitychange', start, { signal: signal });
  var resizeQueued = false;
  addEventListener('resize', function(){
    if(resizeQueued) return;
    resizeQueued = true;
    requestAnimationFrame(function(){ resizeQueued = false; measure(); wrap(); apply(); });
  }, { signal: signal });

  reel.addEventListener('pointerenter', function(e){ if(e.pointerType === 'mouse') target = HOVER; });
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
    // v: the reel's speed under the finger, px/s leftward (smoothed), for the throw
    drag = { x: e.clientX, pos: pos, id: e.pointerId, lx: e.clientX, lt: e.timeStamp, v: 0 };
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
    var ms = e.timeStamp - drag.lt;
    if(ms > 0){ drag.v += (-(e.clientX - drag.lx) / ms * 1000 - drag.v) * 0.3; drag.lx = e.clientX; drag.lt = e.timeStamp; }
    if(moved){ pos = drag.pos + dx; wrap(); apply(); }
  }, { signal: signal });
  function endDrag(){
    if(!drag) return;
    // let go while still moving: the reel keeps that speed and glides out
    vel = moved ? clamp(drag.v - SPEED * scale, MAX) : vel;
    drag = null;
    reel.classList.remove('is-drag');
  }
  addEventListener('pointerup', endDrag, { signal: signal });
  addEventListener('pointercancel', endDrag, { signal: signal });
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
    vel = 0;
  }, { passive: false });
});
