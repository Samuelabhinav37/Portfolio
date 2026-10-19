/* Kai's chat on the real pages. Each page's knowledge-base script ends with
     window.SITE.initLunaDrawer(KB, extraTargetHandler, options)
   (about-luna-kb.js, contact-luna-kb.js, index-luna-kb.js, blog-luna-kb.js,
   blog-post-luna-kb.js), so this keeps that entry point and draws the new
   chat (kai-chat.js) instead of the old drawer. The brain is the same
   keyword matcher the drawer had: typo-tolerant scoring, "tell me more"
   follow-ups, "did you mean" guesses, and misses reported to /api/luna-miss
   so the knowledge base can grow from real questions.
   options: { chips: [{ label, topic }], related: { id: [ids] },
              guesses: [ids], hello: { title, text }, placeholder } */
window.SITE = window.SITE || {};
window.SITE.initLunaDrawer = function (KB, extraTargetHandler, options) {
  'use strict';
  options = options || {};
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var byId = function (id) { return KB.find(function (t) { return t.id === id; }); };
  var GUESS_IDS = options.guesses || ['sentinel', 'moat', 'bounty', 'about'];
  var RELATED = options.related || {
    sentinel: ['moat', 'skills', 'labs'], moat: ['cluster', 'sentinel', 'skills'],
    cluster: ['moat', 'skills', 'about'], bounty: ['labs', 'blog', 'about'],
    labs: ['bounty', 'blog', 'sentinel'], blog: ['bounty', 'labs', 'about'],
    skills: ['sentinel', 'moat', 'about'], about: ['bounty', 'skills', 'contact'],
    contact: ['about', 'blog', 'bounty'], greeting: ['sentinel', 'bounty', 'about']
  };

  /* ---- the keyword matcher (unchanged from the drawer) ---- */
  var MATCH_MIN = 3;
  var norm = function (s) { return (s || '').toLowerCase().replace(/[^a-z0-9&\s-]/g, ' ').replace(/\s+/g, ' ').trim(); };
  var toks = function (s) { return norm(s).split(' ').filter(Boolean); };
  function lev(a, b) {
    if (Math.abs(a.length - b.length) > 1) return 2;
    var m = a.length, n = b.length, d = [];
    for (var i = 0; i <= m; i++) { d[i] = [i]; for (var j = 1; j <= n; j++) d[i][j] = i ? 0 : j; }
    for (i = 1; i <= m; i++) for (j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[m][n];
  }
  function score(query, topic) {
    var q = ' ' + norm(query) + ' ', qt = toks(query), s = 0;
    topic.keywords.forEach(function (raw) {
      var k = norm(raw); if (!k) return;
      if (k.indexOf(' ') !== -1 || k.indexOf('-') !== -1) { if (q.indexOf(' ' + k + ' ') !== -1) s += 3 + k.split(/[\s-]/).length; }
      else qt.forEach(function (t) {
        if (t === k) s += 3;
        else if (t.length > 3 && k.length > 3 && (t.indexOf(k) === 0 || k.indexOf(t) === 0)) s += 1;
        else if (t.length > 3 && k.length > 3 && lev(t, k) === 1) s += 1;
      });
    });
    return s;
  }
  function ranked(query) { return KB.map(function (t) { return { t: t, s: score(query, t) }; }).sort(function (a, b) { return b.s - a.s; }); }
  function reportMiss(query) {
    try {
      fetch('/api/luna-miss', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: String(query || '').slice(0, 300), page: location.pathname }) }).catch(function () {});
    } catch (e) {}
  }
  var FOLLOWUP = /^(how (does|do) (it|that|this) work|how it works?|tell me more|more|details?|why|explain( that| this| it)?|go on|what else|and\??|elaborate)$/;

  /* where an answer can take you */
  var chat;
  function navigate(target) {
    if (!target) return null;
    if (target.type === 'scroll') {
      var n = document.querySelector(target.value);
      // Kai points at the spot once the page has scrolled there
      return n ? { label: 'Take me there', run: function () { n.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }); setTimeout(function () { chat.kai.pointAt(n); }, reduce ? 0 : 650); } } : null;
    }
    if (target.type === 'url') return { label: 'Open ' + target.value.replace(/^https?:\/\//, '').replace(/\/$/, ''), href: target.value };
    // Same-site page; values come only from the knowledge base, never from typed text.
    if (target.type === 'page' && /^\/[a-z0-9\-\/]*$/.test(target.value)) return { label: 'Take me there', href: target.value };
    if (extraTargetHandler) {
      var r = extraTargetHandler(target, { close: function () { chat.close(true); }, reduce: reduce });
      if (r) return { label: r.label, run: r.run };
    }
    return null;
  }

  var lastCite = null;
  function found(t, useDetail) {
    lastCite = t.id;
    var choices = [];
    if (t.detail && !useDetail) choices.push({ label: 'Tell me more', text: 'tell me more' });
    (RELATED[t.id] || []).slice(0, 2).forEach(function (id) { var r = byId(id); if (r) choices.push({ label: r.title, topic: r.id }); });
    return { text: useDetail ? (t.detail || t.reply) : t.reply, kind: t.id === 'greeting' ? 'hello' : 'found', action: navigate(t.target), choices: choices };
  }
  function respond(text, ctx) {
    if (ctx && ctx.topic) { var t = byId(ctx.topic); if (t) return found(t); }
    var nq = norm(text);
    if (lastCite && FOLLOWUP.test(nq)) { var last = byId(lastCite); if (last) return found(last, true); }
    var list = ranked(text);
    if (list[0] && list[0].s >= MATCH_MIN) return found(list[0].t);
    reportMiss(text);
    var pool = list.filter(function (r) { return r.s > 0; }).slice(0, 3).map(function (r) { return r.t; });
    if (!pool.length) pool = GUESS_IDS.map(byId).filter(Boolean);
    return { text: 'That one isn’t in my memory yet. Did you mean one of these?', kind: 'miss',
      choices: pool.map(function (t) { return { label: t.title, topic: t.id }; }) };
  }

  var mount = document.getElementById('luna-wrap') || document.body;
  chat = window.KaiChat({
    respond: respond,
    mount: mount,
    chips: options.chips || [
      { label: 'What is Sentinel?', topic: 'sentinel' },
      { label: 'Show me the bounty findings', topic: 'bounty' },
      { label: 'Is Samuel open to work?', topic: 'about' }
    ].filter(function (c) { return byId(c.topic); }),
    hello: options.hello,
    placeholder: options.placeholder,
    launcher: 'corner',
    storageKey: 'kai-watch-site',
    onOpen: function () { window.SITE.__lunaEverOpened = true; }
  });
  // pages visited this visit, so hopping through pages fast counts as
  // "looking for something" (kai-watch.js)
  if (chat.watch) {
    var PAGES = 'kai-pages', seen = [];
    try { seen = JSON.parse(sessionStorage.getItem(PAGES)) || []; } catch (e) {}
    var t = Date.now();
    seen = seen.filter(function (v) { return v && t - v.t < 60000; });
    seen.forEach(function (v) { chat.watch.section(v.p, v.t); });
    chat.watch.section(location.pathname);
    seen.push({ p: location.pathname, t: t });
    try { sessionStorage.setItem(PAGES, JSON.stringify(seen.slice(-8))); } catch (e) {}
  }
  /* Moments: Kai reacts right after something the visitor did
     (docs/kai-character.md). Pages call window.SITE.kaiMoment(name). */
  var kai = chat.kai, lastMoment = 0;
  var MOMENTS = {
    sent: function () { kai.do('celebrate'); chat.say('Sent. Samuel reads every one.'); },
    arcadeWin: function () { kai.do('celebrate'); chat.say('Nice. You beat it.'); },
    arcadeLose: function () { kai.do('startle'); setTimeout(function () { kai.setMood('sad', 1600); }, 700); chat.say('Oof. One more go?'); }
  };
  window.SITE.kaiMoment = function (name) {
    var m = MOMENTS[name], t = Date.now();
    if (!m || t - lastMoment < 3000) return;
    lastMoment = t;
    m();
  };
  // The About page's arcade runs in a sandboxed frame and posts only
  // { kai: 'arcade', result: 'win' | 'lose' }; trust nothing else.
  addEventListener('message', function (e) {
    var game = document.getElementById('game-iframe');
    if (!game || e.source !== game.contentWindow || !e.data || e.data.kai !== 'arcade') return;
    if (e.data.result === 'win') window.SITE.kaiMoment('arcadeWin');
    else if (e.data.result === 'lose') window.SITE.kaiMoment('arcadeLose');
  });
  // a project you hover on the homepage: Kai looks (the brain does that) and perks up
  var curiousAt = 0;
  document.addEventListener('pointerover', function (e) {
    var card = e.target.closest && e.target.closest('#projects-section .acc-head');
    if (!card || chat.root.contains(card) || Date.now() - curiousAt < 2500) return;
    curiousAt = Date.now();
    kai.setMood('curious', 1400);
  });
  // The site menu closes the chat when it opens (SiteMenu.astro, blog-client.js).
  window.SITE.LunaChat = { open: chat.open, close: function () { chat.close(true); }, isOpen: chat.isOpen };
  return chat;
};
