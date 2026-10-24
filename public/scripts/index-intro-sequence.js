/* Homepage settle: shows the page chrome (identity, menu, Kai, the CRT hero)
   at once and marks the intro as done, which other scripts wait on. The old
   ~6.4s wordmark intro was removed. */
(function(){
  var identity = document.getElementById('site-identity');
  var nav      = document.getElementById('menu-trigger');
  var lunaWrap = document.getElementById('luna-wrap');
  var damp     = document.getElementById('chrome-damp');
  var termStage    = document.getElementById('term-stage');
  var heroTagline  = document.getElementById('hero-tagline');

  /* #term-stage/#hero-tagline have a CSS fade on body.intro-done; skip it for
     one frame so the hero appears straight away instead of a ~1s black flash. */
  function snapOpacity(el){
    if(!el) return;
    var prev = el.style.transition;
    el.style.transition = 'none';
    el.style.opacity = '1';
    void el.offsetHeight; // force the 'none' transition to commit before restoring it
    el.style.transition = prev;
  }

  function settleInstantly(){
    if(identity) identity.style.opacity = '1';
    if(nav)      nav.style.opacity = '1';
    if(lunaWrap) lunaWrap.style.opacity = '1';
    if(damp)     damp.style.opacity = '1';
    snapOpacity(termStage);
    snapOpacity(heroTagline);
    document.body.classList.add('chrome-in');
    document.body.classList.add('intro-done');
    window.SITE._introFullyDone = true;
    window.SITE._introRevealReady = true;
  }

  settleInstantly();
})();
