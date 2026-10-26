/* Homepage thread: a dashed star trail that draws itself as you scroll,
   from the beliefs statement down the left margin to On my radar, so the
   sections read as one journey (after the paper-plane trail on
   zainabkabira.com). A small star rides the tip.

   Layout is measured only on load and resize; scrolling just moves the
   reveal. Desktop and tablet only; with reduced motion the whole trail
   shows at once. */
(function(){
  var from = document.querySelector('#beliefs .ed-statement');
  var mid = document.getElementById('ps-title');
  var grid = document.querySelector('.pw-grid');
  var to = document.querySelector('#signal .sec-title');
  if(!from || !mid || !grid || !to || !document.createElementNS) return;
  var wide = matchMedia('(min-width:1000px)');
  var still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var NS = 'http://www.w3.org/2000/svg';
  function el(tag, attrs, parent){ var n = document.createElementNS(NS, tag); for(var k in attrs) n.setAttribute(k, attrs[k]); if(parent) parent.appendChild(n); return n; }

  var svg = el('svg', { 'class':'thread', 'aria-hidden':'true', focusable:'false' });
  var defs = el('defs', {}, svg);
  var mask = el('mask', { id:'thread-mask', maskUnits:'userSpaceOnUse' }, defs);
  var reveal = el('path', { fill:'none', stroke:'#fff', 'stroke-width':'6', 'stroke-linecap':'round' }, mask);
  var line = el('path', { fill:'none', stroke:'rgba(214,224,255,.75)', 'stroke-width':'1.6', 'stroke-dasharray':'4 8', 'stroke-linecap':'round', mask:'url(#thread-mask)' }, svg);
  var star = el('g', { 'class':'thread-star' }, svg);
  el('circle', { r:'9', fill:'rgba(201,214,255,.16)' }, star);
  el('path', { d:'M0-6 L1.4-1.4 6 0 1.4 1.4 0 6 -1.4 1.4 -6 0 -1.4-1.4Z', fill:'#eef1f8' }, star);
  var st = document.createElement('style');
  st.textContent = '.thread{position:absolute;left:0;top:0;width:100%;pointer-events:none;z-index:2;overflow:visible}.thread-star{filter:drop-shadow(0 0 6px rgba(201,214,255,.8))}';
  document.head.appendChild(st);
  document.body.appendChild(svg);

  var top = 0, h = 1, len = 1, y = scrollY, vh = innerHeight, raf = 0, on = false;
  function box(n){ var r = n.getBoundingClientRect(); return { l:r.left + scrollX, r:r.right + scrollX, t:r.top + scrollY, b:r.bottom + scrollY, cx:r.left + scrollX + r.width / 2 }; }

  function measure(){
    on = wide.matches;
    svg.style.display = on ? '' : 'none';
    if(!on) return;
    var a = box(from), m = box(mid), g = box(grid), z = box(to);
    var gx = g.l / 2;                       // middle of the left margin
    var sx = a.cx, sy = a.b + 70;           // just under the statement
    var my = m.t + (m.b - m.t) / 2;         // level with Selected work
    var ey = z.t - 50;                      // just above On my radar
    top = sy - 20; h = ey - top + 40;
    var o = function(x, yy){ return Math.round(x) + ' ' + Math.round(yy - top); };
    // a loose loop under the statement, out to the margin, then down it
    // with a slow sway, curling in to the radar heading at the end
    var d = 'M' + o(sx, sy) +
      ' C' + o(sx - 40, sy + 160) + ' ' + o(sx - 320, sy + 120) + ' ' + o(sx - 260, sy + 20) +
      ' C' + o(sx - 210, sy - 60) + ' ' + o(sx - 120, sy + 140) + ' ' + o(sx - 420, my - 140) +
      ' C' + o(gx + 120, my - 90) + ' ' + o(gx, my - 60) + ' ' + o(gx, my);
    var span = ey - 60 - my, n = Math.max(2, Math.round(span / 900)), step = span / n;
    for(var i = 0; i < n; i++){
      var y0 = my + i * step, sway = i % 2 ? -18 : 18;
      d += ' C' + o(gx + sway, y0 + step * .35) + ' ' + o(gx - sway, y0 + step * .65) + ' ' + o(gx, y0 + step);
    }
    d += ' C' + o(gx, ey + 30) + ' ' + o(gx + 20, ey + 50) + ' ' + o(z.l - 12, ey + 50);
    line.setAttribute('d', d); reveal.setAttribute('d', d);
    svg.style.top = top + 'px'; svg.setAttribute('height', h); svg.setAttribute('viewBox', '0 0 ' + document.documentElement.clientWidth + ' ' + h);
    svg.setAttribute('width', document.documentElement.clientWidth);
    len = line.getTotalLength();
    reveal.style.strokeDasharray = len + ' ' + len;
    vh = innerHeight; y = scrollY;
    draw();
  }

  function draw(){
    raf = 0;
    if(!on) return;
    // the tip sits ~60% down the screen, so the trail leads the reader
    var p = still ? 1 : Math.max(0, Math.min(1, (y + vh * .6 - top) / h));
    reveal.style.strokeDashoffset = len * (1 - p);
    var pt = line.getPointAtLength(len * p);
    star.setAttribute('transform', 'translate(' + pt.x.toFixed(1) + ' ' + pt.y.toFixed(1) + ')');
    star.style.opacity = p > 0 && p < 1 ? 1 : p >= 1 ? .7 : 0;
  }

  addEventListener('scroll', function(){ y = scrollY; if(!raf && !still) raf = requestAnimationFrame(draw); }, { passive:true });
  var t = 0;
  function later(){ clearTimeout(t); t = setTimeout(measure, 120); }
  if('ResizeObserver' in window) new ResizeObserver(later).observe(document.body);
  addEventListener('resize', later);
  wide.addEventListener && wide.addEventListener('change', later);
  addEventListener('load', measure);
  measure();
})();
