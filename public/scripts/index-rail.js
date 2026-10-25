/* Homepage page rail (#hrail): the section under the reading line is the
   active dash, sections above it are "past", the rest stay dim. Same hover
   dwell / Escape behaviour as the blog post's strip (blog-client.js). */
(function(){
  var rail = document.getElementById('hrail');
  if (!rail) return;
  var dashes = [].slice.call(rail.querySelectorAll('.hrail-dashes span'));
  var links = [].slice.call(rail.querySelectorAll('.hrail-card a'));
  var secs = dashes.map(function(d){ return document.getElementById(d.dataset.sec); });
  var current = -1, ticking = false, openT, closeT;

  function update(){
    ticking = false;
    var line = innerHeight * 0.45, idx = 0;
    // at the very bottom the footer is current even if it never reaches the line
    if (innerHeight + scrollY >= document.documentElement.scrollHeight - 4) idx = secs.length - 1;
    else secs.forEach(function(s, i){ if (s && s.getBoundingClientRect().top <= line) idx = i; });
    if (idx === current) return;
    current = idx;
    dashes.forEach(function(d, i){ d.classList.toggle('is-active', i === idx); d.classList.toggle('is-past', i < idx); });
    links.forEach(function(a, i){
      a.classList.toggle('is-active', i === idx);
      if (i === idx) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
    });
  }
  function close(){ clearTimeout(openT); clearTimeout(closeT); rail.classList.remove('is-open'); }

  addEventListener('scroll', function(){ if (!ticking){ ticking = true; requestAnimationFrame(update); } }, { passive:true });
  addEventListener('resize', update);
  update();
  rail.addEventListener('mouseenter', function(){ clearTimeout(closeT); openT = setTimeout(function(){ rail.classList.add('is-open'); }, 60); });
  rail.addEventListener('mouseleave', function(){ clearTimeout(openT); closeT = setTimeout(function(){ rail.classList.remove('is-open'); }, 200); });
  rail.addEventListener('keydown', function(e){ if (e.key === 'Escape'){ close(); if (document.activeElement) document.activeElement.blur(); } });
  links.forEach(function(a){ a.addEventListener('click', function(){ setTimeout(close, 150); }); });
})();
