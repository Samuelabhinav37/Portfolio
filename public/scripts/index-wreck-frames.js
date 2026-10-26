/* The broken-screen roll on the empty project frames: the "Image coming
   soon" frames play the contact page's wreck video at half speed, only
   while on screen. Skipped for reduced motion. (The beliefs' signal drops
   are in holo-glitch.js.) */
(function(){
  if(matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var rnd = function(a, b){ return a + Math.random() * (b - a); };

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
