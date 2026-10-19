/* Boots the site sky (sky-engine.js) for components/SkyBackground.astro.

   Where the browser can, both canvases are handed to sky-worker.js as
   OffscreenCanvases, so the sky renders off the main thread. If that isn't
   available, or the worker can't get WebGL (older Safari supports
   OffscreenCanvas 2D but not WebGL), it falls back to fresh canvases driven
   on the main thread, which loads sky-engine.js on demand.

   It also keeps the engine told about the viewport, whether the tab is
   visible, and, when the page names them with data-avoid on #sky (any CSS
   selector list), where those blocks sit on screen, so the cast flies
   through open sky around the cards and text instead of behind them.
   data-mood="calm" asks for the quiet sky used behind long reading. contact-form-handler.js fires `contact:sent` /
   `contact:failed`, which launch the courier. */
(function(){
  'use strict';
  var host = document.getElementById('sky');
  if(!host) return;

  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var tier = reduce ? 'still' : (innerWidth <= 900 ? 'lite' : (host.getAttribute('data-mood') === 'calm' ? 'calm' : 'full'));
  var send = function(){};

  function canvases(){
    host.querySelectorAll('canvas').forEach(function(c){ c.remove(); });
    var sky = document.createElement('canvas'), fx = document.createElement('canvas');
    sky.className = 'sky-gl'; fx.className = 'sky-fx';
    sky.setAttribute('aria-hidden', 'true'); fx.setAttribute('aria-hidden', 'true');
    host.insertBefore(fx, host.firstChild); host.insertBefore(sky, fx);
    return { sky:sky, fx:fx };
  }

  function size(){ return { type:'size', w:innerWidth, h:innerHeight, dpr:window.devicePixelRatio || 1 }; }
  var avoidSel = host.getAttribute('data-avoid');
  function cardRect(){
    var rects = [];
    if(avoidSel){
      var els = document.querySelectorAll(avoidSel);
      for(var i=0;i<els.length && rects.length < 16;i++){
        var r = els[i].getBoundingClientRect();
        if(r.width && r.bottom > 0 && r.top < innerHeight) rects.push({ x0:r.left, y0:r.top, x1:r.right, y1:r.bottom });
      }
    }
    return { type:'card', rects:rects };
  }
  function greet(){ send(size()); send(cardRect()); send({ type:'running', on:!document.hidden }); }

  function runInline(){
    var c = canvases();
    function boot(){
      var engine = window.SiteSky.create(c.sky, c.fx, { tier:tier });
      if(!engine.hasGL) host.classList.add('no-gl');
      send = engine.handle;
      greet();
    }
    if(window.SiteSky) return boot();
    var s = document.createElement('script');
    s.src = '/scripts/sky-engine.js';
    s.addEventListener('load', boot);
    document.head.appendChild(s);
  }

  function runWorker(){
    var c = canvases(), worker;
    try{
      var offSky = c.sky.transferControlToOffscreen(), offFx = c.fx.transferControlToOffscreen();
      worker = new Worker('/scripts/sky-worker.js');
      worker.postMessage({ type:'init', sky:offSky, fx:offFx, tier:tier }, [offSky, offFx]);
    }catch(e){ return runInline(); }
    var settled = false;
    function fail(){ if(settled) return; settled = true; try{ worker.terminate(); }catch(e){} runInline(); }
    worker.addEventListener('error', fail);
    worker.addEventListener('message', function(e){
      if(e.data.type !== 'ready' || settled) return;
      if(!e.data.gl) return fail();
      settled = true;
      send = function(m){ worker.postMessage(m); };
      greet();
    });
    setTimeout(function(){ if(!settled) fail(); }, 4000);
  }

  var canOffscreen = 'Worker' in window && typeof OffscreenCanvas !== 'undefined' &&
    'transferControlToOffscreen' in HTMLCanvasElement.prototype;
  if(canOffscreen) runWorker(); else runInline();

  /* keep the engine in step with the page */
  var queued = false;
  function sync(){
    if(queued) return; queued = true;
    requestAnimationFrame(function(){ queued = false; send(size()); send(cardRect()); });
  }
  addEventListener('resize', sync, { passive:true });
  addEventListener('scroll', function(){ if(!queued){ queued = true; requestAnimationFrame(function(){ queued = false; send(cardRect()); }); } }, { passive:true });
  if('ResizeObserver' in window){
    var ro = new ResizeObserver(sync);
    if(avoidSel) document.querySelectorAll(avoidSel).forEach(function(el){ ro.observe(el); });
  }
  document.addEventListener('visibilitychange', function(){ send({ type:'running', on:!document.hidden }); });
  addEventListener('contact:sent', function(){ send(cardRect()); send({ type:'launch', ok:true }); });
  addEventListener('contact:failed', function(){ send(cardRect()); send({ type:'launch', ok:false }); });
})();
