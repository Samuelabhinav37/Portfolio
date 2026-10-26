/* Logo letters (src/components/Logo.astro). Each .logo-l holds four cuts of
   one letter; data-v picks the one on show (0 is the normal cut).
   - Pointer: the letter under it switches to another cut and switches back
     a moment after the pointer leaves it, so a sweep leaves a short trail.
   - Touch: a tap ripples a cut change through every letter.
   - Scroll: while html.is-scrolled is set, the 2nd and 5th letters hold
     other cuts, so the logo reads slightly different down the page.
   Nothing runs under prefers-reduced-motion. */
(function () {
  'use strict';
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var logo = document.querySelector('.logo');
  if (!logo || logo._wired) return;
  logo._wired = true;
  var letters = Array.prototype.slice.call(logo.querySelectorAll('.logo-l'));
  var CUTS = 3;   // alternate cuts per letter, besides the normal one
  var SCROLL_CUTS = { 1: '1', 4: '2' };   // letter index -> cut while scrolled
  var scrolled = false;

  function rest(i) { return (scrolled && SCROLL_CUTS[i]) || '0'; }
  function swap(i) {
    var l = letters[i], now = l.dataset.v, v;
    do { v = String(1 + Math.floor(Math.random() * CUTS)); } while (v === now);
    l.dataset.v = v;
    clearTimeout(l._t);
    l._t = setTimeout(function () { l.dataset.v = rest(i); }, 650);
  }

  var last = -1;
  logo.addEventListener('pointermove', function (e) {
    if (e.pointerType !== 'mouse') return;
    var l = e.target.closest && e.target.closest('.logo-l');
    var i = l ? letters.indexOf(l) : -1;
    if (i !== -1 && i !== last) swap(i);
    last = i;
  });
  logo.addEventListener('pointerleave', function () { last = -1; });
  logo.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'mouse') return;
    letters.forEach(function (_, i) { setTimeout(function () { swap(i); }, i * 60); });
  });

  function onScroll() {
    var on = document.documentElement.classList.contains('is-scrolled');
    if (on === scrolled) return;
    scrolled = on;
    letters.forEach(function (l, i) { if (SCROLL_CUTS[i]) l.dataset.v = rest(i); });
  }
  new MutationObserver(onScroll).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  onScroll();
})();
