/* Boots the site sky (sky-engine.js) for components/SkyBackground.astro.

   Where the browser can, both canvases are handed to sky-worker.js as
   OffscreenCanvases, so the sky renders off the main thread. If that isn't
   available, or the worker can't get WebGL (older Safari supports
   OffscreenCanvas 2D but not WebGL), it falls back to fresh canvases driven
   on the main thread, which loads sky-engine.js on demand.

   It also keeps the engine told about the viewport and whether the tab is
   visible. data-mood="calm" asks for the quiet sky used behind long
   reading; data-tone="aged" for the faded one behind the contact print. */
(function(){
  'use strict';
  var host = document.getElementById('sky');
  if(!host) return;

  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var tier = reduce ? 'still' : (innerWidth <= 900 ? 'lite' : (host.getAttribute('data-mood') === 'calm' ? 'calm' : 'full'));
  var tone = host.getAttribute('data-tone') || undefined;
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
  var covered = false;
  function running(){ send({ type:'running', on:!document.hidden && !covered }); }
  function greet(){ send(size()); running(); }

  function runInline(){
    var c = canvases();
    function boot(){
      var engine = window.SiteSky.create(c.sky, c.fx, { tier:tier, tone:tone });
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
      worker.postMessage({ type:'init', sky:offSky, fx:offFx, tier:tier, tone:tone }, [offSky, offFx]);
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
  addEventListener('resize', function(){
    if(queued) return; queued = true;
    requestAnimationFrame(function(){ queued = false; send(size()); });
  }, { passive:true });
  document.addEventListener('visibilitychange', running);

  /* While an opaque part of the page fills the whole screen (marked
     data-covers-sky: the homepage's painted projects sheet), nobody can see
     the sky, so it stops drawing; the 'sky:covered' event tells the sky
     cast (sky-cast-life.js) to hold too. data-covers-sky="top bottom" gives
     the px at each end where the sky still shows through (a soft edge). */
  var covers = document.querySelectorAll('[data-covers-sky]');
  if(covers.length && 'IntersectionObserver' in window){
    var state = new Map(), th = [];
    for(var i = 0; i <= 200; i++) th.push(i / 200);
    covers.forEach(function(el){
      var e = (el.getAttribute('data-covers-sky') || '0 0').split(' ').map(Number);
      new IntersectionObserver(function(es){
        es.forEach(function(x){ state.set(x.target, !!x.rootBounds && x.intersectionRect.height >= x.rootBounds.height - 2); });
        var now = false; state.forEach(function(v){ now = now || v; });
        if(now === covered) return;
        covered = now; running();
        document.dispatchEvent(new CustomEvent('sky:covered', { detail:covered }));
      }, { threshold:th, rootMargin:(e[0] || 0) + 'px 0px ' + (e[1] || 0) + 'px 0px' }).observe(el);
    });
  }
})();
