/* Luna iframe companion (gaze-tracking, idle actions, costume, reading-paced
   quips) for the homepage. Extracted from an inline <script> block. This page's
   version has a bespoke section-aware quip system distinct from the other
   pages' — verified via diff before extracting, not merged with theirs. */
(function(){
  var f = document.getElementById('luna-frame');
  /* Viewport height + document height, cached instead of read live —
     innerHeight/scrollHeight are both on the classic forced-synchronous-
     layout list, and resolveCostume()/the scroll handlers below were reading
     them every scroll frame (flagged by DevTools as a top reflow site).
     _vh only changes on resize. _docH can change from content mutating
     (accordion, lazy-loaded sections) without a resize firing, so it's
     re-measured lazily, throttled instead of read fresh every frame. */
  var _vh = innerHeight, _docH = document.documentElement.scrollHeight, _docHStamp = 0;
  addEventListener('resize', function(){ _vh = innerHeight; _docH = document.documentElement.scrollHeight; _docHStamp = Date.now(); }, {passive:true});
  function _freshDocH(){
    var now = Date.now();
    if(now - _docHStamp > 250){ _docH = document.documentElement.scrollHeight; _docHStamp = now; }
    return _docH;
  }
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

    /* ---------- context-driven costume + emotes:  costume = f(page, time, dwell) ----------
       Persistent COSTUME is resolved from real page signals and pushed only when it
       changes; momentary EMOTES fire on events. (Page-specific costumes — Reader on the
       blog, Comms on contact, Guide on the globe tour — get wired where those sections live;
       here we drive the homepage from time, dwell and scroll depth.) */
    var _lunaStart = Date.now(), _lastCostume = null, _lastActivity = Date.now();
    function _send(msg){ if(f.contentWindow){ try{ f.contentWindow.postMessage(msg, location.origin); }catch(_){ } } }

    /* ── her voice: casual, a little dry, varied rhythm; no stiff phrasing, no dashes.
         Each line carries a topic, so clicking the quip opens the chat and answers it. ── */
    var _quipEl = document.getElementById('luna-quip'), _quipT = null, _quipTopic = null;
    function showQuip(text, topic, ms){
      if(!_quipEl || !text) return;
      _quipTopic = topic || null;
      _quipEl.innerHTML = '<span class="lq-cursor">&rsaquo; </span>' + text
        + (topic ? '<span class="lq-hint">click to ask Luna</span>' : '');
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
    function _pick(a){ return a[Math.floor(Math.random()*a.length)]; }

    /* ── what she might say, grouped by where you actually are on the page. Each
         line is a distinct question in her voice; she never repeats one until the
         pool is used up, and she only speaks once you've settled in to read. ── */
    var LINES = {
      top: { topic:'greeting', pool:[
        "take your time. i'll be down here if you want a map.",
        "first time here? i can point you somewhere good.",
        "no rush. ask me anything whenever you're ready.",
        "you can just click me if you'd rather i drive."
      ]},
      editorial: { topic:'about', pool:[
        "this part's more how he thinks than what he uses. curious?",
        "want the short version of what he's actually about?",
        "there's a whole philosophy buried in here if you want it."
      ]},
      projects: { topic:'sentinel', pool:[
        "these three are the real work. want the story behind one?",
        "sentinel, prism, axon. pick one and i'll break it down.",
        "the globe isn't just for show. want me to tour it?",
        "curious how any of these actually got built?"
      ]},
      signal: { topic:'labs', pool:[
        "this feed's live. want me to explain what you're seeing?",
        "it's real security signal, not filler. curious how it works?",
        "there's more here than headlines. ask if you want the rundown."
      ]},
      cases: { topic:'labs', pool:[
        "these are the case files. want me to walk you through one?",
        "each one's a real chain he pulled apart. want the story?"
      ]},
      footer: { topic:'contact', pool:[
        "you made it all the way down. want his contact?",
        "end of the line. i can hand you his email if you like.",
        "nice, all the way through. want to reach him?"
      ]}
    };
    var _usedLines = {};
    function _freshLine(sec){
      var g=LINES[sec]; if(!g) return null;
      var used=_usedLines[sec]||(_usedLines[sec]=[]);
      if(used.length>=g.pool.length) used.length=0;                 // pool spent → start over
      var i, guard=0;
      do { i=Math.floor(Math.random()*g.pool.length); guard++; } while(used.indexOf(i)!==-1 && guard<20);
      used.push(i);
      return { text:g.pool[i], topic:g.topic };
    }

    /* ── reading-paced speaking: she watches you scroll, waits until you stop to
         read, then speaks once, tied to the section you're in. Never mid-scroll,
         at most once every ~40s, and quiet while the chat is open. ── */
    var _lastScroll=Date.now(), _scrolledSince=false, _lastQuipAt=0, _activeSection='top';
    var READ_PAUSE=6500, QUIP_COOLDOWN=42000;
    function observeSections(){
      if(!('IntersectionObserver' in window)) return;
      var map=[['#editorial','editorial'],['#projects-section','projects'],['#beat-tour','projects'],
               ['#signal','signal'],['#case-rail','cases'],['#site-footer','footer']];
      var io=new IntersectionObserver(function(es){
        es.forEach(function(e){ if(e.isIntersecting && e.target._lsec) _activeSection=e.target._lsec; });
      }, {rootMargin:'-45% 0px -45% 0px'});                          // a band counts once it's centred
      map.forEach(function(m){ var n=document.querySelector(m[0]); if(n){ n._lsec=m[1]; io.observe(n); } });
    }
    if(document.readyState!=='loading') observeSections();
    else document.addEventListener('DOMContentLoaded', observeSections);
    function _currentSection(){
      if(scrollY < _vh*0.6) return 'top';                          // hero wins up top
      var maxS=Math.max(1, _freshDocH()-_vh);
      if((maxS-scrollY)<200) return 'footer';                       // footer at the very bottom
      return _activeSection;
    }
    function maybeSpeak(){
      if(!window.SITE._introFullyDone || document.hidden) return;
      if(window.SITE.LunaChat && window.SITE.LunaChat.isOpen && window.SITE.LunaChat.isOpen()) return;
      var now=Date.now();
      if(!_scrolledSince) return;                                   // nothing new since she last spoke
      if(now-_lastScroll < READ_PAUSE) return;                      // still scrolling → let them read
      if(now-_lastQuipAt < QUIP_COOLDOWN) return;                   // don't chatter
      var line=_freshLine(_currentSection());
      if(!line) return;
      _lastQuipAt=now; _scrolledSince=false;
      showQuip(line.text, line.topic, 7000);
    }
    setInterval(maybeSpeak, 1500);
    function resolveCostume(){
      if(scrollY < _vh * 0.5)               return 'host';        // up at the hero: the greeter
      if(Date.now() - _lunaStart > 300000)  return 'settled';     // dwell > 5 min: settled in
      /* quiet mid-page for a while → off-duty, riding the scroll (not right at the footer) */
      if(Date.now() - _lastActivity > 22000){
        var maxS = Math.max(1, _freshDocH() - _vh);
        if((maxS - scrollY) > 260) return 'surf';
      }
      var h = new Date().getHours();
      return (h >= 6 && h < 18) ? 'day' : 'night';                // base: day-analyst / night-moon
    }
    function updateCostume(){
      if(!window.SITE._introFullyDone) return;
      var c = resolveCostume();
      if(c !== _lastCostume){ _lastCostume = c; _send({type:'lunaCostume', key:c}); }   // dress silently; she talks on the reading pause
    }
    var _ctxQueued=false;
    addEventListener('scroll', function(){
      var t=Date.now(); _lastActivity=t; _lastScroll=t; _scrolledSince=true;
      if(_ctxQueued) return; _ctxQueued=true;
      requestAnimationFrame(function(){ _ctxQueued=false; updateCostume(); });
    }, {passive:true});
    setInterval(updateCostume, 6000);                             // catch time-of-day / dwell / idle crossings

    /* Arrival: once she's through the portal, dress for context + a small delighted hello. */
    var _greeted=false;
    (function waitArrival(){
      if(window.SITE._introFullyDone && !_greeted){
        _greeted=true;
        updateCostume();
        setTimeout(function(){ _send({type:'lunaEmote', name:'sparkle', hold:1800}); }, 400);
        setTimeout(function(){ _send({type:'lunaAction', name:'wave'}); }, 750);
        setTimeout(function(){ showQuip("hey, i'm Luna. click me if you ever get lost.", 'greeting', 6500); _lastQuipAt=Date.now(); }, 1250);
        return;
      }
      setTimeout(waitArrival, 600);
    })();

    /* ── Performance triggers: scroll-depth milestones + footer arrival ──
       Additive layer over the idle loop. Fires Luna's set-pieces on real
       page signals, each once per descent, gated on intro + reduced-motion. */
    var _perfRM = matchMedia('(prefers-reduced-motion: reduce)').matches;
    var _firedSignal=false, _firedFooter=false, _perfBusy=false, _pQ=false;
    function _perf(name, ms){
      if(_perfRM || _perfBusy || !window.SITE._introFullyDone) return;
      _perfBusy=true;
      _send({type:'lunaAction', name:name});
      setTimeout(function(){ _perfBusy=false; }, ms||1600);
    }
    addEventListener('scroll', function(){
      if(_pQ) return; _pQ=true;
      requestAnimationFrame(function(){
        _pQ=false;
        var max=Math.max(1, _freshDocH() - _vh);
        var depth=scrollY / max;
        var nearBottom=(max - scrollY) < 220;
        /* mid-page: she points at the signal before you reach it */
        if(depth>0.5 && depth<0.9 && !_firedSignal){ _firedSignal=true; _perf('signal',1600); }
        if(depth<0.45) _firedSignal=false;                         // re-arm on the way back up
        /* footer: the CRT scope's glitch startles her, then she patrols the edge */
        if(nearBottom && !_firedFooter){
          _firedFooter=true;
          _perf('startle',1400);
          setTimeout(function(){ _perfBusy=false; _perf('patrol',4200); }, 1500);
        }
        if(depth<0.8) _firedFooter=false;
      });
    }, {passive:true});
  }
})();
