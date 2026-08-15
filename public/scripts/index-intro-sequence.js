/* Homepage intro + Luna portal-arrival choreography (~6.4s timeline). Extracted from an inline <script> block, unmodified. */
/* ──────────────────────────────────────────────────────────────────
   HOMEPAGE INTRO + LUNA PORTAL ARRIVAL  —  ~6.4s total
   ──────────────────────────────────────────────────────────────────
   The terminal frame is gone; the canvas is the page background from
   t=0. The intro is a pure chrome reveal (no window collapse). After
   the main intro finishes and settles, Luna arrives through a portal,
   the canvas brightness lifts, and the chrome-damp pools fade in
   alongside her — one combined "the page comes alive" beat.

   Timeline:
     t=0      canvas visible & booting; chrome at opacity:0
     t=200    network boot begins
     t=700    wordmark fades in over the live booting canvas
     t=2500   wordmark fades out
       t=3000   chrome reveal — identity, nav, topbar fade in together
     t=4500   main intro complete — body.intro-done
     t=4900   Luna sequence begins: portal opens, brightness lift
              starts, chrome-damp fades in
     t=5700   Luna fades in (emerging at the portal's peak)
     t=6400   portal collapses out, settled state reached
   ──────────────────────────────────────────────────────────────────*/
(function(){
  /* Flip to false to bring the ~6.4s boot choreography back — everything
     below is untouched, this just forces the same instant-settle path
     already used for returning visitors and reduced-motion. */
  var FORCE_SKIP_INTRO = true;

  var logo     = document.getElementById('intro-logo');
  var identity = document.getElementById('site-identity');
  var nav      = document.getElementById('menu-trigger'); /* living-chrome nav replaced by collapsed menu */
  var lunaWrap = document.getElementById('luna-wrap');
  var portal   = document.getElementById('luna-portal');
  var damp     = document.getElementById('chrome-damp');

  window.SITE._introRevealReady = false;
  window.SITE._bgBoost = 0.85;   // multiplier on #bg-bloom intensity; lifted on Luna's arrival

  /* Snap everything to its final settled state with no animation. Used by
     both the returning-visitor fast path and the reduced-motion path. */
  function settleInstantly(){
    if(identity) identity.style.opacity = '1';
    if(nav)      nav.style.opacity = '1';
    if(lunaWrap) lunaWrap.style.opacity = '1';
    if(damp)     damp.style.opacity = '1';
    if(logo)     logo.style.display = 'none';
    document.body.classList.add('chrome-in');
    document.body.classList.add('intro-done');
    window.SITE._introFullyDone = true;
    window.SITE._introRevealReady = true;
    try { startBootSeq(); } catch(_) {}
    try { if(window.U && U.uBright){ U.uBright.value = 0.6; } } catch(_) {}   /* dimmer (was 0.85) */
    window.SITE._bgBoost = 0.95;
    try { sessionStorage.setItem('introSeen', '1'); } catch(_) {}
  }

  /* ── Skip the 6.4s choreography when it isn't wanted ──
     Returning visitors (intro already seen this session) and anyone with
     prefers-reduced-motion jump straight to the settled state. */
  var seen = false;
  try { seen = sessionStorage.getItem('introSeen') === '1'; } catch(_) {}
  var _reduceMotion = false;
  try { _reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch(_) {}

  if(FORCE_SKIP_INTRO || seen || _reduceMotion){
    settleInstantly();
    return;
  }

  /* ── main intro beats ──
     Driven by a single GSAP timeline (exposed as window.SITE._introTL so it's
     seekable and killable) instead of a fan of absolute setTimeouts. One
     source of truth: if a beat needs to move, you change one number and the
     rest stay anchored. Offsets below are absolute seconds, matching the
     previous 6.4s choreography exactly:
       0.2  network boot begins
       0.7  wordmark fades in
       2.5  wordmark fades out
       3.0  chrome reveal — identity, nav, topbar together
       4.2  Luna sequence begins (overlaps chrome's last 300ms)
       4.5  body.intro-done
       5.0  Luna fades in                                                 */
  var introTL = gsap.timeline();
  window.SITE._introTL = introTL;

  introTL
    .call(function(){ window.SITE._introRevealReady=true; startBootSeq(); }, null, 0.2)
    .call(function(){ logo.classList.add('in'); }, null, 0.7)
    .call(function(){
      logo.style.transition='opacity 0.5s cubic-bezier(0.4,0,0.6,1), transform 0.5s cubic-bezier(0.4,0,0.6,1)';
      logo.style.opacity='0';
      logo.style.transform='translate(-50%,-50%) translateY(-6px)';
    }, null, 2.5)
    .call(function(){
      document.body.classList.add('chrome-in');
      identity.style.transition='opacity 0.7s cubic-bezier(0.22,1,0.36,1)';
      nav.style.transition     ='opacity 0.7s cubic-bezier(0.22,1,0.36,1) 0.10s';
      identity.style.opacity='1';
      nav.style.opacity='1';
    }, null, 3.0)
    .call(function(){
      /* Luna arrival — fired before intro-done so the two reveals overlap
         instead of stalling. Portal, damp pools and brightness lift start
         together as one "the page comes alive" beat. */
      if(portal) portal.classList.add('opening');   // CSS keyframe runs 1.5s
      if(damp)   damp.style.opacity='1';            // CSS transition 1.3s ease
      liftBrightness(0.6, 0.95, 850);   /* dimmer settled atmosphere (was 0.85) */
    }, null, 4.2)
    .call(function(){
      window.SITE._introFullyDone = true;
      document.body.classList.add('intro-done');
      window.SITE._introRevealReady = true;
      /* Do NOT reset revealAlpha/revealDone here — the boot reveal already
         finished, and resetting it caused a stall where nodes briefly faded
         back to invisible. */
      identity.style.transition='';
      nav.style.transition='';
    }, null, 4.5)
    .call(function(){
      lunaWrap.style.transition='opacity 0.6s cubic-bezier(0.22,1,0.36,1)';
      lunaWrap.style.opacity='1';
      /* Mark the intro as seen for this session — reloads/back-nav fast-path
         to the settled state instead of replaying the full intro. */
      try { sessionStorage.setItem('introSeen', '1'); } catch(_) {}
    }, null, 5.0);

  /* Animates the shader nebula brightness (uBright) and the bloom
     intensity multiplier (_bgBoost) together. easeOutCubic over `ms`. */
  function liftBrightness(uBrightTo, bgBoostTo, ms){
    if(!window.U || !U.uBright) return;
    var uFrom = U.uBright.value, bFrom = window.SITE._bgBoost || 1.0;
    var start = performance.now();
    (function step(now){
      var k = Math.min(1, (now - start) / ms);
      var e = 1 - Math.pow(1 - k, 3);
      U.uBright.value  = uFrom + (uBrightTo  - uFrom) * e;
      window.SITE._bgBoost  = bFrom + (bgBoostTo  - bFrom) * e;
      if(k < 1) requestAnimationFrame(step);
    })(start);
  }
})();
