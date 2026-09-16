/* Luna/Kai iframe companion for individual blog post pages — see
   luna-companion-core.js for the shared engine. No portal/intro
   choreography to wait on here (waitForIntro:false — she's simply ready
   shortly after load), and costume tracks real scroll + idle-dwell signals
   (trackActivity:true) for its 'surf' off-duty state, unlike about/contact's
   simpler dwell-only signals. */
(function(){
  var _lunaStart = Date.now();
  window.SITE.initLunaCompanion({
    waitForIntro: false,
    costumeOnScroll: true,
    costumeIntervalMs: 6000,
    trackActivity: true,
    dwellPerform: null,
    resolveCostume: function(_lastActivity){
      if(scrollY < innerHeight * 0.5)      return 'host';        // up top: the greeter
      if(Date.now() - _lunaStart > 300000) return 'settled';     // dwell > 5 min: settled in
      /* quiet for a while mid-page → off-duty, riding the scroll (not right at the footer) */
      if(Date.now() - _lastActivity > 22000){
        var maxS = Math.max(1, document.documentElement.scrollHeight - innerHeight);
        if((maxS - scrollY) > 260) return 'surf';
      }
      var h = new Date().getHours();
      return (h >= 6 && h < 18) ? 'day' : 'night';                // base: day-analyst / night-moon
    }
  });
})();
