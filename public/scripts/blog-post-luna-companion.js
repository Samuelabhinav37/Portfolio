/* Luna iframe companion for individual blog post pages. Extracted from
   Luna.astro's inline <script> block, unmodified — mirrors the extraction
   already done for about/contact/index (about-luna-companion.js,
   contact-luna-companion.js, index-luna-companion.js) and blog/index
   (src/scripts/blog-luna-companion.js). This is the one remaining un-extracted
   copy of this pattern. */
(function(){
  var f = document.getElementById('luna-frame');  // static markup above, not created by the engine script

  /* Parent → Luna iframe bridge.
     Two jobs:
       1. Forward every page-level mousemove to the iframe (translated to
          iframe-local coords) so Luna's gaze tracks across the whole page,
          not only when the user is hovering directly over her.
       2. Fire a random subtle action every 7-14s once she's arrived so
          she doesn't just sit there blinking. Skips when the document is
          hidden so she doesn't burn cycles in a background tab.            */

  var wrap = document.getElementById('luna-wrap');
  if(f && wrap){
    /* Cache the wrap rect and refresh it only when layout can actually
       change (resize/scroll), instead of reading it on every mousemove —
       a per-event getBoundingClientRect forces a layout flush. */
    var _lunaRect = wrap.getBoundingClientRect();
    function _refreshLunaRect(){ _lunaRect = wrap.getBoundingClientRect(); }
    addEventListener('resize', _refreshLunaRect, {passive:true});
    /* #luna-wrap is position:fixed, so its viewport rect can't change on scroll —
       only on resize. The old per-scroll refresh here was a forced layout on every
       scroll event for nothing; dropped. Resize + the post-intro settle cover it. */
    /* Luna arrives ~5s in and the layout settles after the intro, so
       refresh once it's done to capture her final position. */
    setTimeout(_refreshLunaRect, 6500);

    /* Coalesce gaze updates to at most one message per animation frame.
       Raw mousemove can fire dozens of times per frame; without this each
       one paid a structured-clone postMessage across the iframe boundary. */
    var _lmX=0, _lmY=0, _lmQueued=false;
    /* pointermove covers mouse hover AND touch-drag, so Luna's gaze tracks
       on phones/tablets too (mousemove never fires for touch). */
    document.addEventListener('pointermove', function(e){
      _lmX = e.clientX; _lmY = e.clientY;
      _lastActivity = Date.now();
      if(_lmQueued) return;
      _lmQueued = true;
      requestAnimationFrame(function(){
        _lmQueued = false;
        if(f.contentWindow){
          try{
            f.contentWindow.postMessage(
              {type:'lunaMouse', x: _lmX - _lunaRect.left, y: _lmY - _lunaRect.top}, location.origin);
          }catch(_){}
        }
      });
    }, {passive:true});

    var IDLE_ACTIONS = ['blink','wink','nod','wiggle','glitch','yawn','stretch'];
    function pickIdle(){ return IDLE_ACTIONS[Math.floor(Math.random()*IDLE_ACTIONS.length)]; }
    function scheduleIdle(){
      var ms = 7000 + Math.random()*7000;
      setTimeout(function(){
        if(!document.hidden && window.SITE._introFullyDone && f.contentWindow){
          try{
            f.contentWindow.postMessage({type:'lunaAction', name: pickIdle()}, location.origin);
          }catch(_){}
        }
        scheduleIdle();
      }, ms);
    }
    /* First idle waits past intro + Luna's arrival */
    setTimeout(scheduleIdle, 7000);

    /* ---------- costume: generic time-of-day / dwell signal ----------
       No section-specific wiring is needed here (unlike the homepage) since
       this is a single-article page — just time, scroll position and dwell. */
    var _lunaStart = Date.now(), _lastCostume = null, _lastActivity = Date.now();
    function _send(msg){ if(f.contentWindow){ try{ f.contentWindow.postMessage(msg, location.origin); }catch(_){ } } }

    /* ── the one-time greeting quip — a nudge toward the pill button, not a
         running commentary. Fires once on arrival, on every device width
         (CSS reflows it above the pill on narrow screens instead of hiding
         it, so mobile visitors get the same nudge desktop visitors do). ── */
    var _quipEl = document.getElementById('luna-quip'), _quipT = null, _quipTopic = null;
    function showQuip(text, topic, ms){
      if(!_quipEl || !text) return;
      _quipTopic = topic || null;
      _quipEl.innerHTML = text
        + (topic ? '<span class="lq-hint">tap to chat</span>' : '');
      _quipEl.classList.toggle('lq-clickable', !!topic);
      _quipEl.classList.add('show');
      clearTimeout(_quipT);
      _quipT = setTimeout(function(){ _quipEl.classList.remove('show'); }, ms || 6000);
    }
    if(_quipEl){
      _quipEl.addEventListener('click', function(){
        if(!_quipTopic) return;
        var topic=_quipTopic; _quipTopic=null;   // consume immediately — the
        /* fade-out is a .5s opacity transition, and lq-clickable (which
           carries pointer-events:auto) isn't removed until it finishes, so
           the still-fading bubble kept accepting taps and re-firing this
           handler, stacking up duplicate greeting bubbles in the thread. */
        clearTimeout(_quipT); _quipEl.classList.remove('show','lq-clickable');
        if(window.SITE.LunaChat && window.SITE.LunaChat.askTopic){ window.SITE.LunaChat.askTopic(topic); }
      });
      _quipEl.addEventListener('mouseenter', function(){ clearTimeout(_quipT); });
      _quipEl.addEventListener('mouseleave', function(){ clearTimeout(_quipT); _quipT = setTimeout(function(){ _quipEl.classList.remove('show'); }, 1500); });
    }

    function resolveCostume(){
      if(scrollY < innerHeight * 0.5)       return 'host';        // up top: the greeter
      if(Date.now() - _lunaStart > 300000)  return 'settled';     // dwell > 5 min: settled in
      /* quiet for a while mid-page → off-duty, riding the scroll (not right at the footer) */
      if(Date.now() - _lastActivity > 22000){
        var maxS = Math.max(1, document.documentElement.scrollHeight - innerHeight);
        if((maxS - scrollY) > 260) return 'surf';
      }
      var h = new Date().getHours();
      return (h >= 6 && h < 18) ? 'day' : 'night';                // base: day-analyst / night-moon
    }
    function updateCostume(){
      var c = resolveCostume();
      if(c !== _lastCostume){ _lastCostume = c; _send({type:'lunaCostume', key:c}); }
    }
    var _ctxQueued=false;
    addEventListener('scroll', function(){
      _lastActivity=Date.now();
      if(_ctxQueued) return; _ctxQueued=true;
      requestAnimationFrame(function(){ _ctxQueued=false; updateCostume(); });
    }, {passive:true});
    setInterval(updateCostume, 6000);                             // catch time-of-day / dwell crossings

    /* Arrival: dress for context, wave hello, greet once. No portal/intro
       choreography to wait on here — she's simply ready shortly after load. */
    updateCostume();
    setTimeout(function(){ _send({type:'lunaEmote', name:'sparkle', hold:1800}); }, 400);
    setTimeout(function(){ _send({type:'lunaAction', name:'wave'}); }, 750);

    /* ── Discovery: no persistent button on screen, so the quip itself is
         the invitation. She mentions it once shortly after arriving, then
         repeats a fresh line every ~65s (clicking the quip, or her, opens
         the chat) until the visitor actually opens the chat once, at which
         point she stops nudging for the rest of the visit. Short, plain,
         friendly sentences on purpose — no dashes, no jargon. ── */
    var NUDGE_LINES = [
      "hi, i'm Kai! ask me anything.",
      "need a hand? ask.",
      "curious about something here? ask away.",
      "happy to help you find your way around."
    ];
    var _nudgeI = 0, _nudgeCount = 0, NUDGE_INTERVAL = 65000, MAX_NUDGES = 5;
    function scheduleNudge(){
      setTimeout(function(){
        if(!window.SITE.__lunaEverOpened && _nudgeCount < MAX_NUDGES
           && !(window.SITE.LunaChat && window.SITE.LunaChat.isOpen())){
          showQuip(NUDGE_LINES[_nudgeI % NUDGE_LINES.length], 'greeting', 7000);
          _nudgeI++; _nudgeCount++;
        }
        if(!window.SITE.__lunaEverOpened && _nudgeCount < MAX_NUDGES) scheduleNudge();
      }, NUDGE_INTERVAL);
    }
    setTimeout(function(){
      showQuip(NUDGE_LINES[0], 'greeting', 7000);
      _nudgeI = 1; _nudgeCount = 1;
      scheduleNudge();
    }, 1250);
  }

  /* Fade the whole slot (creature + quip) in shortly after load — a quick,
     quiet reveal instead of the homepage's ~6.4s portal sequence, since a
     blog post is something a visitor may land on repeatedly. */
  var slot = document.getElementById('luna-slot');
  if(slot) setTimeout(function(){ slot.classList.add('luna-in'); }, 400);

  /* Hidden-until-keyboard-focus trigger (see .luna-pill CSS) — invisible and
     unclickable by mouse by design, but still a real, labeled, tabbable
     control for keyboard and screen-reader users. */
  var pill = document.getElementById('luna-pill');
  if(pill){
    pill.addEventListener('click', function(){
      if(!window.SITE.LunaChat) return;
      if(window.SITE.LunaChat.isOpen()) window.SITE.LunaChat.close(); else window.SITE.LunaChat.open();
    });
  }
})();
