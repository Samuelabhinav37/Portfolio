// ════════════════════════════════════════════════════════════════════
//  TAB TITLE MANAGER
//  Phoenix-favicon companion. The cursor (▌) lives at the end of the
//  title at all times during rest, blinking at terminal rate. Glitches
//  occasionally corrupt one or two characters. Page is auto-detected
//  from the filename — drop this same script into other pages and they
//  pick up their correct title automatically.
//
//  Public API:  window.SITE.titleManager.setPage(p) / fireGlitch() / snapshot()
//  Pages:       home, about, blog, contact
// ════════════════════════════════════════════════════════════════════
(function(){
  'use strict';

  // ── CONFIG ───────────────────────────────────────────────────────
  var PAGES = Object.freeze({
    home:    'Samuel Abhinav',
    about:   '~/about',
    blog:    '~/blog',
    contact: '~/contact'
  });
  var CURSOR = '▌';
  var SUBPAGE_PREFIX = '~/';
  var GLITCH_BLOCKS = ['▓', '░', '▒', '█', '▌'];
  var GLITCH_PUNCT  = ['~', '`', '*', '#'];
  var WIDE_LETTERS  = new Set('mbanwesMBANWES'.split(''));

  var T = Object.freeze({
    boot: { preDelay: 250, preHoldMs: 380 },
    type: { charMin: 80, charMax: 140, slashHold: [140,200], spaceHold: [100,140], settledHold: 700 },
    del:  { charMin: 38, charMax: 65, thinkPause: 340, preDelBlinks: 1, preDelMs: 280 },
    rest: { blinkMs: 530 },
    away: { delayMin: 800, delayMax: 1200 },
    glitch: {
      firstDelay: [10000, 50000],
      earlyEvery: [10000, 50000],
      lateEvery:  [10000, 50000],
      decayAfter: 300000,
      hold: [200, 350], doubleChance: 0.4, doubleGap: [100, 150], doubleHold: [120, 180]
    }
  });

  // ── PAGE AUTO-DETECT ─────────────────────────────────────────────
  function detectPage(){
    var path = (window.location.pathname || '').toLowerCase();
    if (/about/.test(path))   return 'about';
    if (/blog/.test(path))    return 'blog';
    if (/contact/.test(path)) return 'contact';
    return 'home';
  }

  // ── STATE MACHINE ────────────────────────────────────────────────
  var VALID_TRANSITIONS = {
    idle:      ['booting', 'deferred', 'resting'],
    deferred:  ['booting'],
    booting:   ['resting', 'idle'],
    resting:   ['typing', 'deleting', 'glitching', 'away', 'idle'],
    typing:    ['resting', 'idle', 'away'],
    deleting:  ['typing', 'idle', 'away'],
    glitching: ['resting', 'idle', 'away'],
    away:      ['resting', 'typing', 'idle']
  };

  // ── CORE MODEL ───────────────────────────────────────────────────
  var realTitle = '';
  var cursorOn  = false;
  var state     = 'idle';
  var currentPage = detectPage();
  var isVisible = !document.hidden;
  var gen = 0;

  var firstGlitchPending = true;
  var restStartedAt = 0;
  var nextGlitchAt = 0;
  var pausedTypingTarget = null;
  var restBlinkTimer = null;
  var glitchTimer = null;
  var awayTimer = null;

  // ── RENDER ───────────────────────────────────────────────────────
  function render(){ document.title = realTitle + (cursorOn ? CURSOR : ''); }
  function setReal(s){ realTitle = s; render(); }
  function setCursor(b){ cursorOn = b; render(); }

  function transition(next){
    var allowed = VALID_TRANSITIONS[state] || [];
    if (allowed.indexOf(next) === -1) return false;
    state = next;
    return true;
  }

  // ── ASYNC HELPERS ────────────────────────────────────────────────
  function StaleGenError(){ this.name = 'StaleGenError'; }
  StaleGenError.prototype = Object.create(Error.prototype);

  function wait(ms, myGen){
    return new Promise(function(resolve, reject){
      setTimeout(function(){
        if (myGen !== gen) reject(new StaleGenError());
        else resolve();
      }, ms);
    });
  }
  function cancel(){
    gen++;
    if (restBlinkTimer){ clearTimeout(restBlinkTimer); restBlinkTimer = null; }
  }
  function rng(min, max){ return min + Math.random() * (max - min); }
  function pick(arr){ return arr[Math.floor(Math.random() * arr.length)]; }

  // ── PRIMITIVES ───────────────────────────────────────────────────
  async function typeForward(target, fromIdx, myGen){
    setCursor(true);
    var i = fromIdx | 0;
    setReal(target.substring(0, i));
    while (i < target.length){
      var ch = target[i];
      i++;
      setReal(target.substring(0, i));
      var delay;
      if (ch === '/')      delay = rng(T.type.slashHold[0], T.type.slashHold[1]);
      else if (ch === ' ') delay = rng(T.type.spaceHold[0], T.type.spaceHold[1]);
      else                 delay = rng(T.type.charMin, T.type.charMax);
      await wait(delay, myGen);
    }
  }

  async function deleteBackward(toPrefix, myGen){
    setCursor(true);
    while (realTitle.length > toPrefix.length){
      setReal(realTitle.substring(0, realTitle.length - 1));
      await wait(rng(T.del.charMin, T.del.charMax), myGen);
    }
    if (realTitle !== toPrefix) setReal(toPrefix);
  }

  async function blink(count, rate, myGen){
    for (var i = 0; i < count; i++){
      setCursor(false); await wait(rate, myGen);
      setCursor(true);  await wait(rate, myGen);
    }
  }

  // ── REST BLINK ───────────────────────────────────────────────────
  function startRestBlink(){
    if (restBlinkTimer) clearTimeout(restBlinkTimer);
    if (!isVisible) return;
    setCursor(true);
    function tick(){
      if (state !== 'resting' && state !== 'away'){ restBlinkTimer = null; return; }
      cursorOn = !cursorOn;
      render();
      restBlinkTimer = setTimeout(tick, T.rest.blinkMs);
    }
    restBlinkTimer = setTimeout(tick, T.rest.blinkMs);
  }
  function stopRestBlink(){
    if (restBlinkTimer){ clearTimeout(restBlinkTimer); restBlinkTimer = null; }
  }

  // ── FLOWS ────────────────────────────────────────────────────────
  async function bootFlow(){
    cancel();
    var myGen = gen;
    transition('booting');
    setReal(''); setCursor(false);
    try {
      await wait(T.boot.preDelay, myGen);
      setCursor(true);
      await wait(T.boot.preHoldMs, myGen);
      await typeForward(PAGES[currentPage], 0, myGen);
      await wait(T.type.settledHold, myGen);
      enterRest(myGen);
    } catch (e){
      if (!(e instanceof StaleGenError)) throw e;
    }
  }

  async function navigateFlow(page){
    if (!PAGES[page]) return;
    if (page === currentPage && state === 'resting') return;
    cancel();
    var myGen = gen;
    var prevPage = currentPage;
    var prevText = realTitle.indexOf(CURSOR) === realTitle.length - CURSOR.length
      ? realTitle.slice(0, -CURSOR.length) : realTitle;
    var newText = PAGES[page];
    currentPage = page;
    var fromHome = (prevPage === 'home');
    var toHome   = (page === 'home');
    var sharedPrefix = (fromHome || toHome) ? '' : SUBPAGE_PREFIX;
    try {
      transition('deleting');
      setReal(prevText); setCursor(true);
      await blink(T.del.preDelBlinks, T.del.preDelMs, myGen);
      await deleteBackward(sharedPrefix, myGen);
      await wait(T.del.thinkPause, myGen);
      transition('typing');
      await typeForward(newText, sharedPrefix.length, myGen);
      await wait(T.type.settledHold, myGen);
      enterRest(myGen);
    } catch (e){
      if (!(e instanceof StaleGenError)) throw e;
    }
  }

  function enterRest(myGen){
    if (myGen !== gen) return;
    transition('resting');
    setReal(PAGES[currentPage]);
    setCursor(true);
    if (restStartedAt === 0) restStartedAt = Date.now();
    startRestBlink();
    scheduleGlitch();
  }

  // ── GLITCH ───────────────────────────────────────────────────────
  function scheduleGlitch(){
    if (glitchTimer){ clearTimeout(glitchTimer); glitchTimer = null; }
    if (!isVisible){ nextGlitchAt = 0; return; }
    var delay;
    if (firstGlitchPending){
      delay = rng(T.glitch.firstDelay[0], T.glitch.firstDelay[1]);
      firstGlitchPending = false;
    } else {
      var sessionAge = Date.now() - restStartedAt;
      if (sessionAge < T.glitch.decayAfter)
        delay = rng(T.glitch.earlyEvery[0], T.glitch.earlyEvery[1]);
      else
        delay = rng(T.glitch.lateEvery[0], T.glitch.lateEvery[1]);
    }
    nextGlitchAt = Date.now() + delay;
    glitchTimer = setTimeout(function(){
      glitchTimer = null;
      if (state === 'resting' && isVisible) glitchFlow();
      else scheduleGlitch();
    }, delay);
  }

  async function glitchFlow(){
    cancel();
    var myGen = gen;
    transition('glitching');
    stopRestBlink();
    setCursor(true);
    var original = PAGES[currentPage];
    setReal(original);

    var lettersOnly = (original.match(/[a-zA-Z]/g) || []).length;
    var includeDollar = lettersOnly < 8;
    var all = [], wide = [];
    for (var i = 0; i < original.length; i++){
      var ch = original[i];
      if (ch === ' ' || ch === '/') continue;
      if (ch === '$' && !includeDollar) continue;
      all.push(i);
      if (WIDE_LETTERS.has(ch) || ch === '$') wide.push(i);
    }
    if (!all.length){ enterRest(myGen); return; }
    var pool = (wide.length && Math.random() < 0.7) ? wide : all;

    function corruptAt(idx, useBlock){
      var ch = original[idx];
      var sub;
      if (ch === '$') sub = pick(GLITCH_PUNCT);
      else if (useBlock || /[^a-zA-Z]/.test(ch)) sub = pick(GLITCH_BLOCKS);
      else {
        sub = (ch === ch.toLowerCase()) ? ch.toUpperCase() : ch.toLowerCase();
        if (sub === ch) sub = pick(GLITCH_BLOCKS);
      }
      return original.substring(0, idx) + sub + original.substring(idx + 1);
    }

    try {
      var idx1 = pick(pool);
      setReal(corruptAt(idx1, Math.random() < 0.6));
      if (Math.random() < T.glitch.doubleChance){
        await wait(rng(T.glitch.doubleGap[0], T.glitch.doubleGap[1]), myGen);
        var idx2 = pick(pool);
        setReal(corruptAt(idx2, Math.random() < 0.6));
        await wait(rng(T.glitch.doubleHold[0], T.glitch.doubleHold[1]), myGen);
      } else {
        await wait(rng(T.glitch.hold[0], T.glitch.hold[1]), myGen);
      }
      setReal(original);
      enterRest(myGen);
    } catch (e){
      if (!(e instanceof StaleGenError)) throw e;
    }
  }

  // ── VISIBILITY ───────────────────────────────────────────────────
  document.addEventListener('visibilitychange', function(){
    if (document.hidden){
      isVisible = false;
      if (awayTimer) clearTimeout(awayTimer);
      if (glitchTimer){ clearTimeout(glitchTimer); glitchTimer = null; nextGlitchAt = 0; }
      stopRestBlink();
      awayTimer = setTimeout(function(){
        if (isVisible) return;
        if (state === 'typing' || state === 'deleting'){
          pausedTypingTarget = PAGES[currentPage];
          cancel();
        }
        setCursor(true);
        if (['resting','typing','deleting','glitching'].indexOf(state) !== -1){
          transition('away');
        }
      }, rng(T.away.delayMin, T.away.delayMax));
    } else {
      isVisible = true;
      if (awayTimer){ clearTimeout(awayTimer); awayTimer = null; }
      if (state === 'deferred'){ bootFlow(); return; }
      if (state === 'away'){
        if (pausedTypingTarget){
          var target = pausedTypingTarget;
          pausedTypingTarget = null;
          (async function(){
            cancel();
            var myGen = gen;
            transition('typing');
            try {
              await typeForward(target, realTitle.length, myGen);
              await wait(T.type.settledHold, myGen);
              enterRest(myGen);
            } catch (e){ if (!(e instanceof StaleGenError)) throw e; }
          })();
        } else {
          transition('resting');
          startRestBlink();
          scheduleGlitch();
        }
      } else if (state === 'resting'){
        startRestBlink();
        if (!glitchTimer) scheduleGlitch();
      }
    }
  });

  // ── INIT ─────────────────────────────────────────────────────────
  function start(){
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches){
      realTitle = PAGES[currentPage]; cursorOn = false; render();
      state = 'resting'; restStartedAt = Date.now();
      return;
    }
    if (document.hidden){
      realTitle = PAGES[currentPage]; cursorOn = false; render();
      isVisible = false;
      transition('deferred');
    } else {
      bootFlow();
    }
  }

  // ── PUBLIC API ───────────────────────────────────────────────────
  window.SITE.titleManager = {
    setPage:    function(p){ navigateFlow(p); },
    fireGlitch: function(){
      if (state === 'resting' && isVisible){
        if (glitchTimer){ clearTimeout(glitchTimer); glitchTimer = null; }
        glitchFlow();
      }
    },
    snapshot: function(){
      return { state: state, realTitle: realTitle, cursorOn: cursorOn, currentPage: currentPage, isVisible: isVisible, gen: gen };
    }
  };

  start();
})();
