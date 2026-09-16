/* Luna/Kai iframe companion for the about page — see luna-companion-core.js
   for the shared engine. This page has body overflow:hidden (fixed single
   viewport, no scroll), so its performance triggers use a dwell timer
   instead of the scroll-depth milestones the scrolling pages use, and its
   costume also reads scrollY (host at the hero, day/night once past it —
   scroll changes what's *visible* on this page even though the body itself
   doesn't scroll further). */
(function(){
  var _lunaStart = Date.now();
  window.SITE.initLunaCompanion({
    waitForIntro: true,
    costumeOnScroll: true,
    costumeIntervalMs: 30000,
    dwellPerform: ['signal','patrol','startle'],
    resolveCostume: function(){
      if(Date.now() - _lunaStart > 300000) return 'settled';      // dwell > 5 min: settled in
      if(scrollY < innerHeight * 0.5)      return 'host';         // up at the hero: the greeter
      var h = new Date().getHours();
      return (h >= 6 && h < 18) ? 'day' : 'night';                // base: day-analyst / night-moon
    }
  });
})();
