/* Hero tagline: the second line types itself in once (after kvs.services),
   a beat after the first line has risen into place, with the block cursor
   riding at its end. Then "protected" keeps an idle glitch (monochrome
   char-scramble) that only runs while the CRT hero is on screen and the tab
   is visible. Under reduced motion the line is simply there. */
(function(){
  "use strict";
  var line = document.querySelector('#hero-tagline .hero-l2');
  var pre = document.getElementById('hero-tagline-pre');
  var word = document.getElementById('hero-tagline-word');
  var stage = document.getElementById('term-window');
  if(!line || !pre || !word || !stage) return;
  var original = word.getAttribute('data-text') || word.textContent;
  if(matchMedia('(prefers-reduced-motion: reduce)').matches){ line.classList.add('ready'); return; }

  var preText = pre.textContent, n = 0, total = preText.length + original.length;
  pre.textContent = ''; word.textContent = '';
  line.classList.add('ready');
  function type(){
    n++;
    pre.textContent = preText.slice(0, n);
    word.textContent = original.slice(0, Math.max(0, n - preText.length));
    if(n < total) setTimeout(type, 38 + Math.random() * 40);
    else schedule();
  }
  setTimeout(type, 1300);

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
})();
