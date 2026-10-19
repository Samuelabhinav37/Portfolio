/* Projects rows: one row open at a time. With a mouse, resting on a row
   opens it (after a short pause, so sweeping across the list doesn't
   flicker); a click or tap on the name toggles it. Rows open from
   pointer *movement* only, so a row sliding under a still cursor while the
   list re-flows never steals the open state. */
(function(){
  var list = document.querySelector('#projects-section .prows');
  if (!list) return;
  var rows = [].slice.call(list.querySelectorAll('.prow'));
  var hover = matchMedia('(hover: hover) and (pointer: fine)').matches;
  var timer = 0;

  function open(idx){
    rows.forEach(function(r, i){
      var on = i === idx;
      r.classList.toggle('is-open', on);
      var h = r.querySelector('.prow-head');
      if (h) h.setAttribute('aria-expanded', on ? 'true' : 'false');
    });
    list.classList.toggle('has-open', idx >= 0);
  }

  rows.forEach(function(r, i){
    var head = r.querySelector('.prow-head');
    if (!head) return;
    head.addEventListener('click', function(){
      clearTimeout(timer);
      open(r.classList.contains('is-open') && !hover ? -1 : i);
    });
    if (hover) {
      r.querySelector('.prow-top').addEventListener('pointermove', function(){
        if (r.classList.contains('is-open')) { clearTimeout(timer); return; }
        clearTimeout(timer);
        timer = setTimeout(function(){ open(i); }, 110);
      });
    }
  });
  list.addEventListener('pointerleave', function(){ clearTimeout(timer); });
  open(0);
})();
