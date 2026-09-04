/* Luna iframe companion for the contact page. Extracted from an inline
   <script> block. Same fixed-viewport dwell-timer pattern as about.astro,
   plus a costume permanently resolved to 'comms' (headset) since this page
   has no scroll for the homepage's scrollY-based greeter/day/night logic. */
(function(){
  var f = document.getElementById('luna-frame');
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
    addEventListener('scroll', _refreshLunaRect, {passive:true});
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
       This page is a fixed single viewport (body overflow:hidden), so scrollY
       never moves and the homepage's scroll-depth milestones cannot fire here.
       A slow dwell cadence stands in: she settles, then punctuates. */
    var _perfPieces = ['signal','patrol','startle'], _perfIdx = 0;
    (function schedulePerform(){
      setTimeout(function(){
        var name = _perfPieces[_perfIdx % _perfPieces.length];
        if(perform(name, name === 'patrol' ? 4200 : 1600)) _perfIdx++;
        schedulePerform();
      }, 38000 + Math.random()*32000);
    })();

    /* First idle waits past intro + Luna's arrival */
    setTimeout(scheduleIdle, 7000);

    /* ---------- context-driven costume + emotes:  costume = f(page, time, dwell) ----------
       Persistent COSTUME is resolved from real page signals and pushed only when it
       changes; momentary EMOTES fire on events. (Page-specific costumes — Reader on the
       blog, Comms on contact, Guide on the globe tour — get wired where those sections live;
       here we drive the homepage from time, dwell and scroll depth.) */
    var _lunaStart = Date.now(), _lastCostume = null;
    function _send(msg){ if(f.contentWindow){ try{ f.contentWindow.postMessage(msg, location.origin); }catch(_){ } } }
    /* This came over from the homepage unchanged, and its first real test was
       `scrollY < innerHeight * 0.5` — on a page with overflow:hidden, scrollY is
       permanently 0, so Luna wore the homepage greeter's BOWTIE on the contact
       page, forever. The engine has had a 'comms' role (the headset — "Contact ·
       Comms") sitting unused this whole time. She wears it here now, and still
       settles in with the mug on a long dwell. */
    function resolveCostume(){
      if(Date.now() - _lunaStart > 300000) return 'settled';      // dwell > 5 min: settled in
      return 'comms';                                             // this is the contact page — headset on
    }
    function updateCostume(){
      if(!window.SITE._introFullyDone) return;
      var c = resolveCostume();
      if(c !== _lastCostume){ _lastCostume = c; _send({type:'lunaCostume', key:c}); }
    }
    /* No scroll on this page, so the scroll-driven costume refresh is dead
       weight; the 30s interval catches the dwell crossing on its own. */
    setInterval(updateCostume, 30000);                            // catch the dwell crossing

    /* Arrival: once she's through the portal, dress for context + a small delighted hello. */
    var _greeted=false;
    (function waitArrival(){
      if(window.SITE._introFullyDone && !_greeted){
        _greeted=true;
        updateCostume();
        setTimeout(function(){ _send({type:'lunaEmote', name:'sparkle', hold:1800}); }, 400);
        setTimeout(function(){ _send({type:'lunaAction', name:'wave'}); }, 750);
        return;
      }
      setTimeout(waitArrival, 600);
    })();

    /* ── Discovery: the corner companion is silent otherwise, so this quip is
         the invitation to ask her something. Mentions it once shortly after
         arriving, then repeats a fresh line every ~65s (clicking the quip
         opens the chat) until the visitor actually opens it once, at which
         point she stops nudging for the rest of the visit. ── */
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
})();
