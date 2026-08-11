/* Intro-logo idle glitch (monochrome char-scramble). Extracted from an inline <script> block, unmodified. */
/* ════════════════ Intro-logo idle glitch — monochrome char-scramble ════════════════ */
(function(){
  "use strict";
  var logo = document.getElementById('intro-logo');
  if(!logo) return;
  var spans = Array.prototype.slice.call(logo.querySelectorAll('.gtxt'));
  if(!spans.length) return;
  var originals = spans.map(function(s){ return s.getAttribute('data-text'); });
  var GLYPHS = '!<>-_\\/[]{}=+*#%01ABCXZ';
  var RM = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function corrupt(){
    // only glitch while the intro logo is actually on screen
    if(!logo.classList.contains('in')) return;
    logo.classList.add('glitch-flick');
    var si = Math.floor(Math.random()*spans.length);
    var orig = originals[si];
    var chars = orig.split('');
    var hits = 1 + (Math.random()<0.5?1:0);
    for(var k=0;k<hits;k++){
      var ci = Math.floor(Math.random()*chars.length);
      if(chars[ci] !== ' ') chars[ci] = GLYPHS[Math.floor(Math.random()*GLYPHS.length)];
    }
    var node = spans[si].childNodes[0];
    if(node && node.nodeType===3){ node.nodeValue = chars.join(''); } else { spans[si].textContent = chars.join(''); }
    setTimeout(function(){
      var n = spans[si].childNodes[0];
      if(n && n.nodeType===3){ n.nodeValue = orig; } else { spans[si].textContent = orig; }
      logo.classList.remove('glitch-flick');
    }, 90);
  }
  if(!RM){
    setTimeout(corrupt, 1400);
    setInterval(corrupt, 3200);
  }
})();
