/* Luna/Kai iframe companion for the contact page — see
   luna-companion-core.js for the shared engine. Same fixed-viewport
   dwell-timer pattern as about.astro, but costume is permanently resolved
   to 'comms' (headset) since this page has no scroll for a scrollY-based
   greeter/day-night split — no costumeOnScroll needed here. */
(function(){
  var _lunaStart = Date.now();
  window.SITE.initLunaCompanion({
    waitForIntro: true,
    costumeOnScroll: false,
    costumeIntervalMs: 30000,
    dwellPerform: ['signal','patrol','startle'],
    resolveCostume: function(){
      if(Date.now() - _lunaStart > 300000) return 'settled';      // dwell > 5 min: settled in
      return 'comms';                                             // this is the contact page — headset on
    }
  });
})();
