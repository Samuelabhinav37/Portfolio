/* One download per clip. Several players of the same short loop (the three
   jellyfish, the three broken-screen overlays) each fetched their own copy,
   since they all start at once, before anything is cached. playClip(v)
   downloads the first <source> this browser can play once, hands every
   player the same in-memory copy, then plays. Players use preload="none",
   so nothing is fetched before this. Loaded by SkyLife.astro; the callers
   fall back to a plain play() without it. */
(function(){
  var cache = {};
  window.playClip = function(v){
    var src = [].filter.call(v.querySelectorAll('source'), function(s){ return v.canPlayType(s.type); })[0];
    var url = src && src.getAttribute('src');
    if(!url) return v.play();
    if(!cache[url]) cache[url] = fetch(url).then(function(r){ if(!r.ok) throw new Error(r.status); return r.blob(); }).then(URL.createObjectURL);
    return cache[url].then(function(u){ if(v.src !== u) v.src = u; }, function(){}).then(function(){ return v.play(); });
  };
})();
