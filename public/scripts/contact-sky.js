/* Boots the contact page sky (sky-engine.js).

   Where the browser can, both canvases are handed to sky-worker.js as
   OffscreenCanvases, so the sky renders off the main thread. If that isn't
   available, or the worker can't get WebGL (older Safari supports
   OffscreenCanvas 2D but not WebGL), it falls back to fresh canvases driven
   on the main thread, which loads sky-engine.js on demand.

   It also keeps the engine told about the viewport, where the form card
   sits (so the chase flies through open sky and the courier launches from
   the card), whether the tab is visible, and the form's send result:
   contact-form-handler.js fires `contact:sent` / `contact:failed`. */
(function(){
  'use strict';
  var host = document.getElementById('sky');
  if(!host) return;

  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var tier = reduce ? 'still' : (innerWidth <= 900 ? 'lite' : 'full');
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
  function cardRect(){
    var el = document.querySelector('.form-panel');
    if(!el) return { type:'card', rect:null };
    var r = el.getBoundingClientRect();
    return { type:'card', rect:{ x0:r.left, y0:r.top, x1:r.right, y1:r.bottom } };
  }
  function greet(){ send(size()); send(cardRect()); send({ type:'running', on:!document.hidden }); }

  function runInline(){
    var c = canvases();
    function boot(){
      var engine = window.ContactSky.create(c.sky, c.fx, { tier:tier });
      if(!engine.hasGL) host.classList.add('no-gl');
      send = engine.handle;
      greet();
    }
    if(window.ContactSky) return boot();
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
    var panel = document.querySelector('.form-panel');
    if(panel) new ResizeObserver(sync).observe(panel);
  }
  document.addEventListener('visibilitychange', function(){ send({ type:'running', on:!document.hidden }); });
  addEventListener('contact:sent', function(){ send(cardRect()); send({ type:'launch', ok:true }); });
  addEventListener('contact:failed', function(){ send(cardRect()); send({ type:'launch', ok:false }); });
})();
