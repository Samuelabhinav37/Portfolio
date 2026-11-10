/* Homepage settle: shows the page chrome (identity, menu, Kai, the CRT hero)
   at once and marks the intro as done, which other scripts wait on. The old
   ~6.4s wordmark intro was removed. Runs on each visit to the homepage
   (Motion.astro onPage). */
(window.onPage || function (f) { f(new AbortController().signal); })(function (signal) {
  if(!document.getElementById('term-stage')) return;
  var identity = document.getElementById('site-identity');
  var nav      = document.getElementById('site-nav');
  var lunaWrap = document.getElementById('luna-wrap');
  var damp     = document.getElementById('chrome-damp');
  var termStage    = document.getElementById('term-stage');

  /* #term-stage has a CSS fade on body.intro-done; skip it for
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
    document.body.classList.add('chrome-in');
    document.body.classList.add('intro-done');
    window.SITE._introFullyDone = true;
    window.SITE._introRevealReady = true;
  }

  settleInstantly();
});
