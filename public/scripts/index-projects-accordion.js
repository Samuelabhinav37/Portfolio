/* Projects accordion, drives the globe constellation focus. Extracted from an inline <script> block, unmodified. */
/* Projects accordion: clicking a header opens it (single-open) and drives the
   globe. The active index is published as window.SITE.__globeFocus and handed to the
   globe module via window.SITE.__setConstellation(idx), which rotates to that project's
   cluster and redraws its constellation. A coarse observer gates the globe render
   to when the section is on-screen. */
(function(){
  var sec=document.getElementById('projects-section');
  var accs=[].slice.call(document.querySelectorAll('#projects-section .acc'));
  var pvLabel=document.getElementById('pv-label');
  var NAMES=['sentinel','prism','axon'];
  if(!accs.length) return;
  function open(idx){
    window.SITE.__globeFocus=idx;
    accs.forEach(function(a,i){
      var on=(i===idx);
      a.classList.toggle('is-open', on);
      var h=a.querySelector('.acc-head'); if(h) h.setAttribute('aria-expanded', on?'true':'false');
    });
    if(typeof window.SITE.__setConstellation==='function') window.SITE.__setConstellation(idx);
  }
  accs.forEach(function(a){
    var h=a.querySelector('.acc-head');
    if(h) h.addEventListener('click', function(){ open(parseInt(a.dataset.idx,10)||0); });
  });
  // section in-view gate (perf: don't render the globe when scrolled away)
  if('IntersectionObserver' in window && sec){
    new IntersectionObserver(function(es){ window.SITE.__globeInView=es[0].isIntersecting; },
      {rootMargin:'200px 0px 200px 0px'}).observe(sec);
  } else { window.SITE.__globeInView=true; }
  // boot the first project once the globe module is ready
  window.SITE.__globeFocus=0;
  (function waitReady(n){
    if(typeof window.SITE.__setConstellation==='function'){ window.SITE.__setConstellation(0); return; }
    if(n>0) setTimeout(function(){ waitReady(n-1); }, 250);
  })(40);
})();
