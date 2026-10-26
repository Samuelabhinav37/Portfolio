/* Homepage star trail: a dashed line that draws itself as you scroll, looping
   out from under the beliefs statement and sweeping down toward the work,
   with a small star at the tip (after the paper-plane trail on
   zainabkabira.com). It lives inside the beliefs scene, so it sinks with
   it and the painted projects sheet slides over it.

   Layout is measured only on load and resize; scrolling just moves the
   reveal. Desktop and tablet only; with reduced motion it shows whole. */
(function(){
  var scene = document.getElementById('beliefs');
  var from = scene && scene.querySelector('.ed-statement');
  if(!from || !document.createElementNS) return;
  var wide = matchMedia('(min-width:1000px)');
  var still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var NS = 'http://www.w3.org/2000/svg';
  function el(tag, attrs, parent){ var n = document.createElementNS(NS, tag); for(var k in attrs) n.setAttribute(k, attrs[k]); if(parent) parent.appendChild(n); return n; }

  var svg = el('svg', { 'class':'thread', 'aria-hidden':'true', focusable:'false' });
  var mask = el('mask', { id:'thread-mask', maskUnits:'userSpaceOnUse' }, el('defs', {}, svg));
  var reveal = el('path', { fill:'none', stroke:'#fff', 'stroke-width':'6', 'stroke-linecap':'round' }, mask);
  var line = el('path', { fill:'none', stroke:'rgba(214,224,255,.75)', 'stroke-width':'1.6', 'stroke-dasharray':'4 8', 'stroke-linecap':'round', mask:'url(#thread-mask)' }, svg);
  var star = el('g', { 'class':'thread-star' }, svg);
  el('circle', { r:'9', fill:'rgba(201,214,255,.16)' }, star);
  el('path', { d:'M0-6 L1.4-1.4 6 0 1.4 1.4 0 6 -1.4 1.4 -6 0 -1.4-1.4Z', fill:'#eef1f8' }, star);
  var st = document.createElement('style');
  st.textContent = '.thread{position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;overflow:visible}.thread-star{filter:drop-shadow(0 0 6px rgba(201,214,255,.8))}';
  document.head.appendChild(st);
  scene.appendChild(svg);

  var top = 0, span = 1, len = 1, y = scrollY, vh = innerHeight, raf = 0, on = false;

  function measure(){
    on = wide.matches;
    svg.style.display = on ? '' : 'none';
    if(!on) return;
    var s = scene.getBoundingClientRect(), a = from.getBoundingClientRect();
    var W = s.width, H = s.height;
    var sx = a.left - s.left + a.width / 2, sy = a.bottom - s.top + 60;
    var ex = Math.max(60, (W - Math.min(W * .87, W)) / 2 - 10), ey = H + 40;   // into the margin, past the bottom edge
    var o = function(x, yy){ return Math.round(x) + ' ' + Math.round(yy); };
    var d = 'M' + o(sx, sy) +
      ' C' + o(sx - 40, sy + 160) + ' ' + o(sx - 320, sy + 120) + ' ' + o(sx - 260, sy + 20) +
      ' C' + o(sx - 210, sy - 60) + ' ' + o(sx - 120, sy + 140) + ' ' + o(sx - 420, sy + 170) +
      ' C' + o(ex + 160, sy + 210) + ' ' + o(ex, ey - 120) + ' ' + o(ex, ey);
    line.setAttribute('d', d); reveal.setAttribute('d', d);
    svg.setAttribute('viewBox', '0 0 ' + Math.round(W) + ' ' + Math.round(H));
    len = line.getTotalLength();
    reveal.style.strokeDasharray = len + ' ' + len;
    // drawn while the statement's underside travels from 80% to 40% of the screen
    top = a.bottom + scrollY - innerHeight * .8; span = innerHeight * .4;
    vh = innerHeight; y = scrollY;
    draw();
  }

  function draw(){
    raf = 0;
    if(!on) return;
    var p = still ? 1 : Math.max(0, Math.min(1, (y - top) / span));
    reveal.style.strokeDashoffset = len * (1 - p);
    var pt = line.getPointAtLength(len * p);
    star.setAttribute('transform', 'translate(' + pt.x.toFixed(1) + ' ' + pt.y.toFixed(1) + ')');
    star.style.opacity = p > 0 ? 1 : 0;
  }

  addEventListener('scroll', function(){ y = scrollY; if(!raf && !still) raf = requestAnimationFrame(draw); }, { passive:true });
  var t = 0;
  function later(){ clearTimeout(t); t = setTimeout(measure, 120); }
  if('ResizeObserver' in window) new ResizeObserver(later).observe(document.body);
  addEventListener('resize', later);
  if(wide.addEventListener) wide.addEventListener('change', later);
  addEventListener('load', measure);
  measure();
})();
