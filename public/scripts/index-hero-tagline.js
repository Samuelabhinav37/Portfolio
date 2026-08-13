/* Hero tagline "protected" idle glitch (monochrome char-scramble), same
   technique as index-logo-glitch.js. Only runs while the CRT hero is
   actually on screen and the tab is visible. */
(function(){
  "use strict";
  var word = document.getElementById('hero-tagline-word');
  var stage = document.getElementById('term-window');
  if(!word || !stage) return;
  if(matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var original = word.getAttribute('data-text') || word.textContent;
  var GLYPHS = '!<>-_\\/[]{}=+*#%01ABCXZ';
  var visible = false;

  function corrupt(){
    if(visible && !document.hidden){
      var chars = original.split('');
      var ci = Math.floor(Math.random()*chars.length);
      chars[ci] = GLYPHS[Math.floor(Math.random()*GLYPHS.length)];
      word.textContent = chars.join('');
      setTimeout(function(){ word.textContent = original; }, 90);
    }
    schedule();
  }
  function schedule(){
    setTimeout(corrupt, 3500 + Math.random()*3500);
  }

  new IntersectionObserver(function(entries){
    visible = entries[0].isIntersecting;
  }, { threshold: 0.2 }).observe(stage);

  schedule();
})();
