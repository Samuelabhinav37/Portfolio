/* Lenis smooth scroll + Beat-1 expand wiring, synced to the GSAP ticker. Extracted from an inline <script> block, unmodified. */
/* ════════════════ Lenis smooth scroll + Beat 1 expand (floating → fullscreen) ════════════════ */
(function(){
  "use strict";
  if(!window.gsap){ return; }
  var RM = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Lenis momentum scroll, synced to GSAP's single ticker (no lag smoothing).
     ScrollTrigger was removed — nothing on the page uses triggers; the globe,
     tour and footer all read scrollY through their own cached-metric progress. */
  if(window.Lenis && !RM){
    var lenis = new Lenis({ lerp:0.1, smoothWheel:true, syncTouch:false });
    gsap.ticker.add(function(t){ lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
  }
})();
