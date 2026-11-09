/* Runs the site sky (sky-engine.js) off the main thread, on the two
   OffscreenCanvases sky.js transfers in, so typing and scrolling never
   wait on the background. */
importScripts('/scripts/sky-engine.js?v=7');  // bump ?v= with sky-engine.js changes: scripts are cached 4h

var engine = null;
self.onmessage = function(e){
  var m = e.data;
  if(m.type === 'init'){
    try{
      engine = self.SiteSky.create(m.sky, m.fx, { tier:m.tier, tone:m.tone });
      self.postMessage({ type:'ready', gl:engine.hasGL });
    }catch(err){
      self.postMessage({ type:'ready', gl:false, error:String(err && err.message) });
    }
    return;
  }
  if(engine) engine.handle(m);
};
