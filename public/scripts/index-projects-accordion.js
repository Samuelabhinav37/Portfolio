/* Projects accordion: clicking a header opens that project and closes the
   others (single-open). */
(function(){
  var accs=[].slice.call(document.querySelectorAll('#projects-section .acc'));
  if(!accs.length) return;
  function open(idx){
    accs.forEach(function(a,i){
      var on=(i===idx);
      a.classList.toggle('is-open', on);
      var h=a.querySelector('.acc-head'); if(h) h.setAttribute('aria-expanded', on?'true':'false');
    });
  }
  accs.forEach(function(a){
    var h=a.querySelector('.acc-head');
    if(h) h.addEventListener('click', function(){ open(parseInt(a.dataset.idx,10)||0); });
  });
})();
