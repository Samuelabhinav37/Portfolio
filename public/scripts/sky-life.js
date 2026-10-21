/* Jellyfish floating through the contact page's sky (SkyLife.astro), with a
   few tiny glitching stars and the odd bubble, and the lilies' video in the
   corner.

   Each jellyfish is the same short looping video (a jellyfish drawn in serif
   digits, pulsing once every PULSE seconds), started at a different point in
   its loop. This script only moves them: it reads each video's clock to know
   where it is in its pulse, so the squeeze you see is what pushes it along a
   slow diagonal; between pulses it drifts. It leans the way it travels, lets
   out the odd bubble, and one that leaves the sky comes back in from the
   bottom heading the other way.

   The videos wait for the page to finish loading so they never compete with
   the card. Nothing runs while the tab is hidden, and with reduced motion
   everything holds still on its first frame.

   The stars are a 3s video too: a solid four-point star in digits that
   breathes and twice a loop glitches. Each one starts at a different point
   in the loop, so they never flicker together. */
(function(){
  'use strict';
  var svg = document.getElementById('life-sky');
  var layer = document.getElementById('life-jellies');
  if(!svg || !layer) return;
  var NS = 'http://www.w3.org/2000/svg';
  var still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var CREAM = '#ecdfc8';

  var W = 0, H = 0, narrow = false;
  function size(){
    W = innerWidth; H = innerHeight; narrow = W <= 900;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
  }
  size();
  addEventListener('resize', size);

  var DEG = 180 / Math.PI;
  function rnd(a, b){ return a + Math.random() * (b - a); }
  function el(tag, attrs, parent){
    var e = document.createElementNS(NS, tag);
    for(var k in attrs) e.setAttribute(k, attrs[k]);
    if(parent) parent.appendChild(e);
    return e;
  }

  /* the clip: 240x420, the bell's centre 110px down, one pulse per loop */
  var PULSE = 5, BELL_Y = 110 / 240, ASPECT = 420 / 240;
  /* the same squeeze the clip was drawn with: quick in, slow out, a rest */
  function squeeze(p){
    if(p < 0.2) return Math.pow(Math.sin(Math.PI / 2 * p / 0.2), 2);
    if(p < 0.75) return 0.5 + 0.5 * Math.cos(Math.PI * (p - 0.2) / 0.55);
    return 0;
  }

  /* a muted looping clip, started `start` seconds into its loop */
  function clip(name, cls, w, start){
    var v = document.createElement('video');
    v.className = cls;
    v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'none';
    v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
    v.poster = '/images/contact-' + name + '-poster.webp';
    v.style.width = w.toFixed(0) + 'px';
    [['webm', 'video/webm'], ['mp4', 'video/mp4']].forEach(function(s){
      var src = document.createElement('source');
      src.src = '/videos/contact-' + name + '.' + s[0]; src.type = s[1];
      v.appendChild(src);
    });
    v.addEventListener('loadedmetadata', function(){ v.currentTime = start; }, { once:true });
    v.setAttribute('data-sky-video', '');
    layer.appendChild(v);
    return v;
  }

  /* jellyfish keep to the open sky at the sides of the card on wide screens */
  function jellyX(){
    if(narrow) return rnd(0.06, 0.94) * W;
    return Math.random() < 0.5 ? rnd(0.04, 0.22) * W : rnd(0.78, 0.96) * W;
  }
  /* phones get one small jellyfish, drifting across the top of the sky */
  var jellies = (narrow ? [0] : [0, 1, 2]).map(function(i){
    var w = narrow ? rnd(34, 40) : [rnd(70, 84), rnd(56, 66), rnd(44, 52)][i];
    var start = rnd(0, PULSE);
    var j = {
      v: clip('jelly', 'life-jelly', w, start), w: w, x: jellyX(), y: rnd(0.2, 1) * H,
      ph: rnd(0, 1), seed: rnd(0, 100), nextBubble: rnd(2, 6),
      /* a heading up and to one side, between 25 and 55 degrees off vertical */
      dir: (Math.random() < 0.5 ? -1 : 1) * rnd(0.45, 0.95), lean: 0
    };
    return j;
  });
  if(!narrow){ jellies[0].x = rnd(0.05, 0.2) * W; jellies[1].x = rnd(0.8, 0.95) * W; }
  /* on a phone: mostly sideways, high up, so it never crosses the form */
  function topLane(j){
    var right = Math.random() < 0.5;
    j.x = right ? -j.w : W + j.w; j.y = rnd(0.07, 0.16) * H;
    j.dir = (right ? 1 : -1) * rnd(1.25, 1.45); j.lean = j.dir;
  }
  if(narrow){ topLane(jellies[0]); jellies[0].x = rnd(0.2, 0.8) * W; }
  jellies.forEach(function(j){ j.lean = j.dir; });

  var bubbleLayer = el('g', {}, svg);

  var bubbles = [];
  function bubble(x, y, fs){
    var t = el('text', { x:0, y:0, 'font-size':(fs * rnd(0.8, 1.1)).toFixed(1), fill:CREAM, 'text-anchor':'middle' }, bubbleLayer);
    t.textContent = Math.random() < 0.5 ? 'o' : '°';
    bubbles.push({ t:t, x:x, y:y, life:0, dur:rnd(3, 4.5), drift:rnd(-5, 5) });
  }

  /* the stars stay put; their clips do the twinkling */
  for(var i = 0; i < (narrow ? 3 : 9); i++){
    var star = clip('star', 'life-star', rnd(11, 19), rnd(0, 3));
    star.style.left = rnd(3, 97).toFixed(1) + '%';
    star.style.top = rnd(5, 95).toFixed(1) + '%';
    star.style.opacity = rnd(0.55, 0.95).toFixed(2);
  }

  function place(j){
    var ox = j.w / 2, oy = j.w * BELL_Y;
    j.v.style.transformOrigin = ox.toFixed(1) + 'px ' + oy.toFixed(1) + 'px';
    j.v.style.transform = 'translate(' + (j.x - ox).toFixed(1) + 'px,' + (j.y - oy).toFixed(1) + 'px) rotate(' + (j.lean * DEG * 0.6).toFixed(2) + 'deg)';
  }

  function stepJellies(dt, t){
    jellies.forEach(function(j){
      /* where it is in its pulse: from the video while it plays */
      var playing = j.v.readyState >= 2 && !j.v.paused;
      j.ph = playing ? (j.v.currentTime % PULSE) / PULSE : (j.ph + dt / PULSE) % 1;
      var sq = squeeze(j.ph);
      var heading = j.dir + (narrow ? 0.08 : 0.18) * Math.sin(t * 0.07 + j.seed);
      var speed = (1.4 + 6 * sq) * j.w / 70;
      j.x += Math.sin(heading) * speed * dt;
      j.y -= Math.cos(heading) * speed * dt;
      j.lean += (heading - j.lean) * Math.min(1, dt * 0.4);
      place(j);
      j.nextBubble -= dt;
      if(j.nextBubble <= 0){ bubble(j.x + (Math.random() < 0.5 ? -1 : 1) * j.w * rnd(0.35, 0.5), j.y - j.w * rnd(0.1, 0.3), 11); j.nextBubble = rnd(4, 9); }
      /* out of the sky: back in from the bottom, heading the other way across */
      var m = j.w * 1.2;
      if(j.y < -m * ASPECT || j.x < -m || j.x > W + m){
        if(narrow) topLane(j);
        else {
          j.y = H + j.w * rnd(0.3, 1); j.x = jellyX();
          j.dir = (j.x < W / 2 ? 1 : -1) * rnd(0.45, 0.95); j.lean = j.dir;
        }
      }
    });
  }

  function stepBubbles(dt){
    bubbles = bubbles.filter(function(b){
      b.life += dt;
      var u = b.life / b.dur;
      if(u >= 1){ b.t.remove(); return false; }
      b.t.setAttribute('transform', 'translate(' + (b.x + b.drift * u).toFixed(1) + ' ' + (b.y - 40 * u).toFixed(1) + ')');
      b.t.setAttribute('opacity', (Math.sin(Math.PI * u) * 0.8).toFixed(2));
      return true;
    });
  }

  var videos = Array.prototype.slice.call(document.querySelectorAll('[data-sky-video]'));
  /* only clips that are actually on show: a hidden one is never fetched */
  function playAll(){
    videos.forEach(function(v){
      if(!v.getClientRects().length) return;
      var p = v.play(); if(p && p.catch) p.catch(function(){});
    });
  }
  function pauseAll(){ videos.forEach(function(v){ v.pause(); }); }

  if(still){
    stepJellies(0, 0);
    return;
  }

  /* start the videos once the page itself has loaded */
  if(document.readyState === 'complete') playAll();
  else addEventListener('load', playAll, { once:true });
  /* a window resized wider can bring hidden clips into view */
  var resizeTimer = 0;
  addEventListener('resize', function(){ clearTimeout(resizeTimer); resizeTimer = setTimeout(playAll, 400); });

  var last = 0, clock = 0, raf = 0;
  function frame(now){
    raf = 0;
    var dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now; clock += dt;
    stepJellies(dt, clock);
    stepBubbles(dt);
    if(!document.hidden) raf = requestAnimationFrame(frame);
  }
  document.addEventListener('visibilitychange', function(){
    if(document.hidden){ if(raf) cancelAnimationFrame(raf); raf = 0; pauseAll(); }
    else { if(!raf){ last = 0; raf = requestAnimationFrame(frame); } playAll(); }
  });
  raf = requestAnimationFrame(frame);
})();
