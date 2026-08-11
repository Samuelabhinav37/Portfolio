/* Footer reveal + render-gate observer. Extracted from an inline <script> block, unmodified. */
/* Footer reveal + render gate (replaces the old scroll-calm pin/enter).
   When the footer scrolls into view, add .fpin/.fenter to fire its staggered
   entrance and flip __fPinOn true so the map/oscilloscope loop renders. Remove
   them when it leaves so the entrance can replay and the loop idles off-screen. */
(function(){
  var f=document.getElementById('site-footer');
  if(!f) return;
  if(!('IntersectionObserver' in window)){
    f.classList.add('fpin','fenter'); window.SITE.__fPinOn=true; return;
  }
  var io=new IntersectionObserver(function(es){
    var vis=es[0].isIntersecting;
    window.SITE.__fPinOn=vis;
    f.classList.toggle('fpin',vis);
    f.classList.toggle('fenter',vis);
  },{threshold:0.12});
  io.observe(f);
})();
