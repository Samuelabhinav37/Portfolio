/* Shared Luna/Kai iframe-companion engine — gaze tracking, idle actions,
   costume/emote push, and the discovery nudge quip. Consolidated from
   about-luna-companion.js, contact-luna-companion.js and
   blog-post-luna-companion.js, which were ~95% identical copies of this
   same logic with a handful of real per-page differences, now expressed as
   the `cfg` object each page's own thin script passes in.

   index-luna-companion.js deliberately stays separate — it has its own
   bespoke section-aware reading-paced quip system (scroll-driven
   IntersectionObserver, per-section line pools) that doesn't fit this
   shape, verified via diff before this consolidation (see its own header
   comment).

   cfg:
     resolveCostume(lastActivity)
                            required. Returns the costume key for right now.
                            Called with the shared _lastActivity timestamp
                            (only meaningful when trackActivity is true).
     costumeIntervalMs     how often to re-check resolveCostume on a timer
                            (about/contact: 30000 — dwell-only signals move
                            slowly; blog-post: 6000 — scroll-driven signals
                            move faster).
     costumeOnScroll       also re-check on scroll (true wherever
                            resolveCostume reads scrollY; false for contact,
                            whose costume is dwell-only).
     trackActivity         maintain a `_lastActivity` timestamp (bumped by
                            pointermove/scroll) that cfg.resolveCostume can
                            close over — only blog-post's 'surf' state needs
                            this; about/contact's resolveCostume ignores it.
     waitForIntro          true: poll window.SITE._introFullyDone before the
                            first greet (about/contact, which sit behind the
                            homepage-style portal intro). false: greet
                            immediately (blog-post has no intro to wait on).
     dwellPerform          array of set-piece names to cycle through on a
                            slow dwell timer (about/contact: ['signal',
                            'patrol','startle']), or null to skip entirely
                            (blog-post has no dwell scheduler). */
window.SITE.initLunaCompanion = function(cfg){
  var f = document.getElementById('luna-frame');
  var wrap = document.getElementById('luna-wrap');
  if(f && wrap){
    /* Cache the wrap rect and refresh it only when layout can actually
       change (resize), instead of reading it on every mousemove — a
       per-event getBoundingClientRect forces a layout flush. #luna-wrap is
       position:fixed, so scroll alone can't move it. */
    var _lunaRect = wrap.getBoundingClientRect();
    function _refreshLunaRect(){ _lunaRect = wrap.getBoundingClientRect(); }
    addEventListener('resize', _refreshLunaRect, {passive:true});
    /* Luna arrives ~5s in and the layout settles after the intro, so
       refresh once it's done to capture her final position. */
    setTimeout(_refreshLunaRect, 6500);

    var _lastActivity = Date.now();
    function _bumpActivity(){ _lastActivity = Date.now(); }

    /* Coalesce gaze updates to at most one message per animation frame.
       Raw mousemove can fire dozens of times per frame; without this each
       one paid a structured-clone postMessage across the iframe boundary. */
    var _lmX=0, _lmY=0, _lmQueued=false;
    /* pointermove covers mouse hover AND touch-drag, so Luna's gaze tracks
       on phones/tablets too (mousemove never fires for touch). */
    document.addEventListener('pointermove', function(e){
      _lmX = e.clientX; _lmY = e.clientY;
      if(cfg.trackActivity) _bumpActivity();
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

    /* 'stretch' joins the gentle rotation; the sharper set-pieces (startle,
       signal, patrol) run on their own slower scheduler below so they read
       as punctuation rather than tics. */
    var IDLE_ACTIONS = ['blink','wink','nod','wiggle','glitch','yawn','stretch'];
    var _perfRM = matchMedia('(prefers-reduced-motion: reduce)').matches;
    var _perfBusy = false;
    function perform(name, ms){
      if(_perfRM || _perfBusy || !window.SITE._introFullyDone || document.hidden) return false;
      _perfBusy = true;
      try{ f.contentWindow && f.contentWindow.postMessage({type:'lunaAction', name:name}, location.origin); }catch(_){}
      setTimeout(function(){ _perfBusy = false; }, ms || 1600);
      return true;
    }
    function pickIdle(){ return IDLE_ACTIONS[Math.floor(Math.random()*IDLE_ACTIONS.length)]; }
    function scheduleIdle(){
      var ms = 7000 + Math.random()*7000;
      setTimeout(function(){
        if(!document.hidden && window.SITE._introFullyDone && !_perfBusy && f.contentWindow){
          try{
            f.contentWindow.postMessage({type:'lunaAction', name: pickIdle()}, location.origin);
          }catch(_){}
        }
        scheduleIdle();
      }, ms);
    }
    /* ── Performance triggers: dwell, not scroll ──
       Only wired when cfg.dwellPerform is set — pages whose costume signal
       is itself scroll-driven (blog-post) don't need a separate dwell
       scheduler layered on top. */
    if(cfg.dwellPerform && cfg.dwellPerform.length){
      var _perfPieces = cfg.dwellPerform, _perfIdx = 0;
      (function schedulePerform(){
        setTimeout(function(){
          var name = _perfPieces[_perfIdx % _perfPieces.length];
          if(perform(name, name === 'patrol' ? 4200 : 1600)) _perfIdx++;
          schedulePerform();
        }, 38000 + Math.random()*32000);
      })();
    }

    /* First idle waits past intro + Luna's arrival */
    setTimeout(scheduleIdle, 7000);

    /* ---------- context-driven costume + emotes ----------
       Persistent COSTUME is resolved by cfg.resolveCostume() and pushed
       only when it changes; momentary EMOTES fire once on arrival. */
    var _lastCostume = null;
    function _send(msg){ if(f.contentWindow){ try{ f.contentWindow.postMessage(msg, location.origin); }catch(_){ } } }
    function updateCostume(){
      var c = cfg.resolveCostume(_lastActivity);
      if(c !== _lastCostume){ _lastCostume = c; _send({type:'lunaCostume', key:c}); }
    }
    if(cfg.costumeOnScroll){
      var _ctxQueued=false;
      addEventListener('scroll', function(){
        if(cfg.trackActivity) _bumpActivity();
        if(_ctxQueued) return; _ctxQueued=true;
        requestAnimationFrame(function(){ _ctxQueued=false; updateCostume(); });
      }, {passive:true});
    }
    setInterval(updateCostume, cfg.costumeIntervalMs || 30000);

    /* Arrival: dress for context + a small delighted hello. Either waits
       for the homepage-style portal intro to finish, or — on pages with no
       such intro — fires right away. */
    function greetArrival(){
      updateCostume();
      setTimeout(function(){ _send({type:'lunaEmote', name:'sparkle', hold:1800}); }, 400);
      setTimeout(function(){ _send({type:'lunaAction', name:'wave'}); }, 750);
    }
    if(cfg.waitForIntro){
      var _greeted=false;
      (function waitArrival(){
        if(window.SITE._introFullyDone && !_greeted){ _greeted=true; greetArrival(); return; }
        setTimeout(waitArrival, 600);
      })();
    } else {
      greetArrival();
    }

    /* ── Discovery: the corner companion is silent otherwise, so this quip
         is the invitation to ask her something. Mentions it once shortly
         after arriving, then repeats a fresh line every ~65s (clicking the
         quip opens the chat) until the visitor actually opens it once, at
         which point she stops nudging for the rest of the visit. ── */
    var _quipEl = document.getElementById('luna-quip'), _quipT = null, _quipTopic = null;
    function showQuip(text, topic, ms){
      if(!_quipEl || !text) return;
      _quipTopic = topic || null;
      _quipEl.innerHTML = text + (topic ? '<span class="lq-hint">tap to chat</span>' : '');
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

  /* Blog-post-only extras — no-op elsewhere since these elements only exist
     on that page template. Fade the whole slot (creature + quip) in
     shortly after load, and wire the hidden-until-keyboard-focus trigger. */
  var slot = document.getElementById('luna-slot');
  if(slot) setTimeout(function(){ slot.classList.add('luna-in'); }, 400);
  var pill = document.getElementById('luna-pill');
  if(pill){
    pill.addEventListener('click', function(){
      if(!window.SITE.LunaChat) return;
      if(window.SITE.LunaChat.isOpen()) window.SITE.LunaChat.close(); else window.SITE.LunaChat.open();
    });
  }
};
