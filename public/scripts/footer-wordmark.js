/* The name across the bottom of the homepage footer (index.astro .f-mark).
   Fits the text to the full width, and moves a soft light (--mx, --my) to the
   pointer while it is over the name, fading it in and out. On touch screens
   the light follows the finger. With reduced motion the light rests in the
   middle of the name. */
(function () {
  'use strict';
  var mark = document.getElementById('footerMark');
  if (!mark) return;
  var base = mark.querySelector('.f-mark-base');
  function fit() {
    mark.style.setProperty('--mfs', '100px');
    // the width of the letters themselves, not of the full-width box they sit in
    var range = document.createRange();
    range.selectNodeContents(base);
    var w = range.getBoundingClientRect().width || 1;
    mark.style.setProperty('--mfs', (100 * mark.clientWidth / w * 0.98).toFixed(2) + 'px');
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
  fit();
  addEventListener('resize', fit);

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    mark.style.setProperty('--mo', '0.6');
    return;
  }
  var raf = 0, x = 0, y = 0;
  function move(cx, cy) {
    var r = mark.getBoundingClientRect();
    x = cx - r.left; y = cy - r.top;
    if (!raf) raf = requestAnimationFrame(function () {
      raf = 0;
      mark.style.setProperty('--mx', x.toFixed(0) + 'px');
      mark.style.setProperty('--my', y.toFixed(0) + 'px');
    });
  }
  mark.addEventListener('pointerenter', function (e) { move(e.clientX, e.clientY); mark.style.setProperty('--mo', '1'); });
  mark.addEventListener('pointermove', function (e) { move(e.clientX, e.clientY); });
  mark.addEventListener('pointerleave', function () { mark.style.setProperty('--mo', '0'); });
})();
