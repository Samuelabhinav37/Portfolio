/* Homepage subliminal background-flash layer. Extracted from an inline <script> block, unmodified. */
(function(){
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var layer = document.getElementById('subliminal-layer');
  var flash = document.getElementById('subliminal-flash');
  if (!layer) return;

  function rnd(a,b){ return a + Math.random()*(b-a); }

  function jaggedClip(){
    var pts = [[0,0],[100,0],[100,100],[0,100]];
    return 'polygon(' + pts.map(function(p){
      var jx = Math.max(0,Math.min(100, p[0]+rnd(-8,8)));
      var jy = Math.max(0,Math.min(100, p[1]+rnd(-8,8)));
      return jx+'% '+jy+'%';
    }).join(',') + ')';
  }

  function tearMark(){
    var d = document.createElement('div');
    d.className = 'subliminal-mark sm-tear';
    d.style.width = rnd(40,90) + 'px';
    d.style.height = (Math.random() < 0.6 ? 2 : 3) + 'px';
    d.style.left = rnd(4,90) + 'vw'; d.style.top = rnd(4,92) + 'vh';
    return d;
  }
  function barsMark(){
    var d = document.createElement('div');
    d.className = 'subliminal-mark sm-bars';
    d.style.width = rnd(40,90) + 'px';
    d.style.height = '14px';
    d.style.left = rnd(4,90) + 'vw'; d.style.top = rnd(4,90) + 'vh';
    d.innerHTML = '<span class="b1"></span><span class="b2"></span><span class="b3"></span>';
    return d;
  }
  function rgbMark(){
    var d = document.createElement('div');
    d.className = 'subliminal-mark sm-rgb';
    d.style.width = rnd(36,120) + 'px'; d.style.height = rnd(1,3) + 'px';
    d.style.left = rnd(4,90) + 'vw'; d.style.top = rnd(4,92) + 'vh';
    d.innerHTML = '<span class="r"></span><span class="c"></span><span class="b"></span>';
    return d;
  }
  function staticMark(){
    var d = document.createElement('div');
    d.className = 'subliminal-mark sm-static';
    d.style.width = rnd(22,60) + 'px'; d.style.height = rnd(14,34) + 'px';
    d.style.left = rnd(4,90) + 'vw'; d.style.top = rnd(4,92) + 'vh';
    d.style.clipPath = jaggedClip();
    return d;
  }
  var MAKERS = [tearMark, barsMark, rgbMark, staticMark];

  /* irregular hard-cut stutter: 3-6 abrupt opacity/position jumps, no easing —
     mimics a dropped signal instead of a designed fade in/out. */
  function buildGlitchSteps(){
    var n = 3 + ((Math.random()*4)|0);
    var steps = [];
    for (var i=0; i<n; i++){
      var on = i % 2 === 0;
      steps.push({ op: on ? rnd(.55,1) : (Math.random() < .35 ? .12 : 0), dx: rnd(-3,3), t: rnd(10,40) });
    }
    steps.push({ op:0, dx:0, t:8 });
    return steps;
  }
  function playSteps(el, steps, onDone){
    var i = 0;
    (function tick(){
      if (i >= steps.length){ if (onDone) onDone(); return; }
      var s = steps[i];
      el.style.opacity = String(s.op);
      el.style.transform = 'translateX(' + s.dx.toFixed(1) + 'px)';
      i++;
      setTimeout(tick, s.t);
    })();
  }

  var visible = !document.hidden;
  document.addEventListener('visibilitychange', function(){ visible = !document.hidden; });

  function hit(){
    var el = MAKERS[(Math.random()*MAKERS.length)|0]();
    el.style.opacity = '0';
    layer.appendChild(el);
    playSteps(el, buildGlitchSteps(), function(){ el.remove(); });
  }
  function spawn(){
    if (!visible) return;
    hit();
    if (flash && Math.random() < 0.2){
      flash.style.opacity = '.06';
      setTimeout(function(){ flash.style.opacity = '0'; }, rnd(14,32));
    }
    if (Math.random() < 0.25) setTimeout(hit, rnd(40,130));
  }
  function loop(){
    spawn();
    setTimeout(loop, 3400 + Math.random() * 3200);
  }
  setTimeout(loop, 900);
})();
