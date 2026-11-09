/* A small label that rides the cursor over anything with data-tip ("View"
   on the project tiles), after isablued.com. Mouse only. It writes one
   translate per frame and never reads layout; scrolling hides it until
   the pointer moves again. */
(function () {
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  var tip = document.createElement('span');
  tip.className = 'cursor-tip';
  tip.setAttribute('aria-hidden', 'true');
  document.body.appendChild(tip);
  var on = null, x = 0, y = 0, raf = 0;
  function place() { raf = 0; tip.style.translate = 'calc(' + x + 'px - 50%) calc(' + y + 'px - 50%)'; }
  function set(t) {
    if (t === on) return;
    on = t;
    if (t) { tip.textContent = t.getAttribute('data-tip'); place(); }
    tip.classList.toggle('on', !!t);
  }
  addEventListener('pointermove', function (e) {
    x = e.clientX; y = e.clientY;
    set(e.target.closest ? e.target.closest('[data-tip]') : null);
    if (on && !raf) raf = requestAnimationFrame(place);
  }, { passive: true });
  addEventListener('scroll', function () { set(null); }, { passive: true });
  document.documentElement.addEventListener('pointerleave', function () { set(null); });
})();
